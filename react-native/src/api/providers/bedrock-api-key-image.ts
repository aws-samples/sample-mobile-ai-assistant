import { ImageRes } from '../../types/Chat.ts';
import {
  getBedrockApiKey,
  getImageModel,
  getImageSize,
  getRegion,
} from '../../storage/StorageUtils.ts';
import { ImageInfo } from '../BedrockMessageConvertor.ts';

export const genImageWithAPIKey = async (
  imagePrompt: string,
  controller: AbortController,
  image?: ImageInfo,
  garmentImage?: ImageInfo
): Promise<ImageRes> => {
  const bedrockApiKey = getBedrockApiKey();
  const modelId = getImageModel().modelId;
  const region = getRegion();
  const imageSize = getImageSize().split('x');
  const width = parseInt(imageSize[0].trim(), 10);
  const height = parseInt(imageSize[1].trim(), 10);

  let finalPrompt = imagePrompt;
  if (
    containsChinese(imagePrompt) &&
    (image === undefined || modelId.startsWith('stability.'))
  ) {
    try {
      finalPrompt = await translateToEnglish(imagePrompt, controller);
    } catch (error) {
      return {
        image: '',
        error: `Error translating prompt: ${error}`,
      };
    }
  }

  let requestBody = {};
  const seed = Math.floor(Math.random() * 2147483647);

  if (modelId.startsWith('amazon')) {
    if (image === undefined) {
      requestBody = {
        taskType: 'TEXT_IMAGE',
        textToImageParams: { text: finalPrompt },
        imageGenerationConfig: {
          numberOfImages: 1,
          quality: 'standard',
          cfgScale: 8.0,
          height: height,
          width: width,
          seed: seed,
        },
      };
    } else if (garmentImage) {
      const garment_class = await analyzeGarmentClass(
        finalPrompt,
        garmentImage,
        controller
      );
      requestBody = {
        taskType: 'VIRTUAL_TRY_ON',
        virtualTryOnParams: {
          sourceImage: image.source.bytes,
          referenceImage: garmentImage.source.bytes,
          returnMask: true,
          maskType: 'GARMENT',
          garmentBasedMask: {
            garmentClass: garment_class,
          },
        },
        imageGenerationConfig: {
          seed: seed,
        },
      };
    } else {
      try {
        const analysisResult = await analyzeImagePrompt(
          imagePrompt,
          controller
        );
        if (analysisResult && analysisResult.target_task_type) {
          const taskType = analysisResult.target_task_type;
          const optimizedPrompt =
            analysisResult.optimized_prompt || finalPrompt;

          switch (taskType) {
            case 'BACKGROUND_REMOVAL':
              requestBody = {
                taskType: 'BACKGROUND_REMOVAL',
                backgroundRemovalParams: {
                  image: image.source.bytes,
                },
              };
              break;
            case 'TEXT_IMAGE':
              requestBody = {
                taskType: 'TEXT_IMAGE',
                textToImageParams: { text: optimizedPrompt },
                imageGenerationConfig: {
                  numberOfImages: 1,
                  quality: 'standard',
                  cfgScale: 6.5,
                  height: height,
                  width: width,
                  seed: seed,
                },
              };
              break;
            case 'COLOR_GUIDED_GENERATION':
              requestBody = {
                taskType: 'COLOR_GUIDED_GENERATION',
                colorGuidedGenerationParams: {
                  text: optimizedPrompt,
                  negativeText: 'bad quality, low res',
                  referenceImage: image.source.bytes,
                  colors: analysisResult.colors || ['#ff8080'],
                },
                imageGenerationConfig: {
                  numberOfImages: 1,
                  cfgScale: 6.5,
                  height: height,
                  width: width,
                },
              };
              break;
            case 'INPAINTING':
              requestBody = {
                taskType: 'INPAINTING',
                inPaintingParams: {
                  text: optimizedPrompt,
                  negativeText: 'bad quality, low res',
                  image: image.source.bytes,
                  maskPrompt: analysisResult.mask_prompt || 'main subject',
                },
                imageGenerationConfig: {
                  numberOfImages: 1,
                  height: height,
                  width: width,
                  cfgScale: 6.5,
                },
              };
              break;
            case 'IMAGE_VARIATION':
            default:
              requestBody = {
                taskType: 'IMAGE_VARIATION',
                imageVariationParams: {
                  text: optimizedPrompt,
                  negativeText: 'bad quality, low resolution, cartoon',
                  images: [image.source.bytes],
                  similarityStrength: 0.7,
                },
                imageGenerationConfig: {
                  numberOfImages: 1,
                  height: height,
                  width: width,
                  cfgScale: 6.5,
                },
              };
              break;
          }
        } else {
          return {
            image: '',
            error: 'Error: ' + analysisResult?.error,
          };
        }
      } catch (error) {
        return {
          image: '',
          error: 'Error analyzing image prompt:' + error,
        };
      }
    }
  } else if (modelId.startsWith('stability.')) {
    if (image === undefined) {
      requestBody = {
        prompt: finalPrompt,
        output_format: 'jpeg',
        mode: 'text-to-image',
        aspect_ratio: '1:1',
      };
    } else {
      requestBody = {
        prompt: finalPrompt,
        output_format: 'jpeg',
        mode: 'image-to-image',
        image: image.source.bytes,
        strength: 0.5,
      };
    }
  }

  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;
  try {
    const timeoutMs = width >= 1024 ? 120000 : 90000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const options = {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        Authorization: 'Bearer ' + bedrockApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      reactNative: { textStreaming: true },
    };
    const response = await fetch(url, options);

    clearTimeout(timeoutId);

    if (!response.ok) {
      const responseText = await response.text();
      let errorDetail: string;
      try {
        const responseJson = JSON.parse(responseText);
        errorDetail =
          responseJson.message || responseJson.Message || responseText;
      } catch {
        errorDetail = responseText;
      }

      return {
        image: '',
        error: errorDetail,
      };
    }

    const data = await response.json();

    let base64ImageData = '';
    if (data.images && data.images.length > 0) {
      base64ImageData = data.images[0];
    }

    if (base64ImageData && base64ImageData.length > 0) {
      return {
        image: base64ImageData,
        error: '',
      };
    }

    return {
      image: '',
      error: 'Image data is empty in the response',
    };
  } catch (error) {
    const errMsg = `Error fetching image: ${error}`;
    console.log(errMsg);
    return {
      image: '',
      error: errMsg,
    };
  }
};

function containsChinese(text: string): boolean {
  const pattern = /[\u4e00-\u9fff]/;
  return pattern.test(text);
}

async function invokeBedrockModel(
  prompt: string,
  systemPrompt: string,
  modelId: string = 'us.amazon.nova-lite-v1:0',
  controller: AbortController,
  maxTokens: number = 512,
  garmentImage?: ImageInfo
): Promise<string> {
  const region = getRegion();
  const bedrockApiKey = getBedrockApiKey();

  const messages = [
    {
      role: 'user',
      content: [
        { text: prompt },
        ...(garmentImage ? [{ image: garmentImage }] : []),
      ],
    },
  ];

  const requestBody = {
    inferenceConfig: { maxTokens },
    messages: messages,
    system: [
      {
        text: systemPrompt,
      },
    ],
    modelId: modelId,
  };
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;

  try {
    const options = {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        Authorization: 'Bearer ' + bedrockApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      reactNative: { textStreaming: true },
    };
    const response = await fetch(url, options);

    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return '';
    }
    const data = await response.json();
    const content = data?.output?.message?.content;
    if (content?.length > 0) {
      return content[0].text;
    }
    return '';
  } catch (error) {
    console.log('Error invoking model:', modelId, error);
    throw error;
  }
}

async function translateToEnglish(
  prompt: string,
  controller: AbortController
): Promise<string> {
  const systemPrompt =
    'Translate to English image prompt, output only English translation.';
  return invokeBedrockModel(
    prompt,
    systemPrompt,
    'us.amazon.nova-lite-v1:0',
    controller
  );
}

interface ImageAnalysisResult {
  target_task_type: string;
  optimized_prompt?: string;
  mask_prompt?: string;
  colors?: string[];
  error?: string;
}

async function analyzeImagePrompt(
  prompt: string,
  controller: AbortController
): Promise<ImageAnalysisResult | null> {
  const systemPrompt = getImageAnalysisPrompt();
  try {
    const result = await invokeBedrockModel(
      prompt,
      systemPrompt,
      'us.amazon.nova-lite-v1:0',
      controller
    );
    return JSON.parse(result) as ImageAnalysisResult;
  } catch (error) {
    console.log('Error analyzing image prompt:', error);
    return null;
  }
}

interface GarmentClassResult {
  garment_class: 'FULL_BODY' | 'UPPER_BODY' | 'LOWER_BODY' | 'FOOTWEAR';
}

async function analyzeGarmentClass(
  prompt: string,
  garmentImage: ImageInfo,
  controller: AbortController
): Promise<string> {
  const systemPrompt = getGarmentClassPrompt();
  try {
    const result = await invokeBedrockModel(
      prompt,
      systemPrompt,
      'us.amazon.nova-lite-v1:0',
      controller,
      512,
      garmentImage
    );
    return (JSON.parse(result) as GarmentClassResult).garment_class;
  } catch (error) {
    console.log('Error analyzing image prompt:', error);
    return 'FULL_BODY';
  }
}

function getGarmentClassPrompt(): string {
  return `You are a virtual try-on classification assistant. Analyze user input text and image to identify the garment type.

Categories of garment types are:
- UPPER_BODY: shirts, t-shirts, jackets, coats, sweaters, etc.
- LOWER_BODY: pants, shorts, skirts, jeans, etc.
- FOOTWEAR: shoes, boots, sneakers, sandals, etc.
- FULL_BODY: dresses, suits, full outfits, or unclear cases

Return ONLY a JSON response in this exact format:
{
  "garment_class": "TYPE"
}

Note:
- TYPE must be "UPPER_BODY", "LOWER_BODY", "FOOTWEAR", or "FULL_BODY"
- If multiple wearable items appear in the image, only consider the main subject in the center of the image.
- Default to "FULL_BODY" if the garment type is not clearly upper body, lower body, or footwear.

IMPORTANT:
DO NOT include any explanatory text or markdown in your response. Your entire response must be a single, valid JSON object.`;
}

function getImageAnalysisPrompt(): string {
  return `You are an AI assistant that helps users analyze image tasks and generate structured JSON responses. Your role is to:

1. Analyze user's input prompt
2. Determine the most appropriate image task type from these 5 types:

    - TEXT_IMAGE: Generate completely new image based on text prompt and giving image
    - COLOR_GUIDED_GENERATION: Generate image with specific color palette/style
    - IMAGE_VARIATION: Create variations of entire input image
    - INPAINTING: Remove, replace or modify specific objects/areas while keeping rest of image intact (e.g. remove person/object, replace item, modify part of image)
    - BACKGROUND_REMOVAL: Remove entire background, leaving only main subject with transparency

    Quick decision strategy - check these 5 rules in sequence:

        1. Only classify as BACKGROUND_REMOVAL if user specifically mentions "remove background" or "make background transparent"

        2. If user mentions image variations or similar style/alternatives, it must be IMAGE_VARIATION

        3. If user wants to generate content based on specific colors/palette, it must be COLOR_GUIDED_GENERATION

        4. If user wants to replace, modify or remove specific objects/areas within the image, it must be INPAINTING

        5. Only classify as TEXT_IMAGE if user wants to create new image following reference image layout

        Check these rules in order until a match is found. If no rules match using None instead.

3. Generate a JSON response with:
    - target_task_type: The matched task type, or "None" if no match
    - error: If no match, return "The current operation on the image is not supported. You can try these operations: Generate image, Generate variation, Remove Object, Replace Object, Remove Background."
    - optimized_prompt: Optimize the user's input prompt in English based on the detected task type
    - colors: Only For COLOR_GUIDED_GENERATION, array of 1-4 hex color codes (e.g. ["#ff8080"])
    - mask_prompt: Only For INPAINTING, the prompt is the mentioned subject, e.g.
        1. for INPAINTING, if user prompt: 'Modernize the windows of the house' the mask_prompt should be "windows"

Example JSON response:
{
  "target_task_type": "INPAINTING",
  "optimized_prompt": "replace the red car with a blue sports car",
  "mask_prompt": "windows",
  "colors":["#ff8080", "#ffb280"],
  "error": ""
}

Output rules:
1. Only include relevant fields based on the matched task type. Analyze the user's intent carefully to determine the most appropriate task type and generate optimal outputs.
2. Output content must start with "{" and end with "}". DO NOT use markup/format for any output responses.
3. DO NOT include any explanatory text or markdown in your response. Your entire response must be a single, valid JSON object.`;
}
