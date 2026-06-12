import {
  AllModel,
  BedrockAPIChunk,
  Model,
  ModelTag,
  SystemPrompt,
  Usage,
} from '../../types/Chat.ts';
import {
  getBedrockApiKey,
  getRegion,
  getTextModel,
} from '../../storage/StorageUtils.ts';
import { BedrockMessage } from '../BedrockMessageConvertor.ts';
import { isEnableThinking } from '../bedrock-api.ts';
import {
  buildMantleOnlyModels,
  getMantleBaseUrl,
  tagModelsWithApiMode,
} from './mantle-utils.ts';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage,
  reasoning?: string
) => void;

// Sonnet >= 4 and Opus >= 4.5 accept the 1M input-context beta.
const supports1MContext = (modelId: string): boolean => {
  const id = modelId.toLowerCase();
  if (id.includes('claude-sonnet-4')) return true;
  return ['claude-opus-4-5', 'claude-opus-4-6', 'claude-opus-4-7'].some(v =>
    id.includes(v)
  );
};

export const invokeBedrockWithAPIKey = async (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  const modelId = getTextModel().modelId;

  const additionalModelRequestFields: Record<string, unknown> = {};
  if (isEnableThinking()) {
    additionalModelRequestFields.reasoning_config = {
      type: 'enabled',
      budget_tokens: 16000,
    };
  }
  if (supports1MContext(modelId)) {
    additionalModelRequestFields.anthropic_beta = ['context-1m-2025-08-07'];
  }
  const bodyObject: {
    messages: BedrockMessage[];
    additionalModelRequestFields?: Record<string, unknown>;
    system: { text: string }[] | undefined;
  } = {
    messages: messages,
    system: prompt ? [{ text: prompt?.prompt }] : undefined,
  };
  if (Object.keys(additionalModelRequestFields).length > 0) {
    bodyObject.additionalModelRequestFields = additionalModelRequestFields;
  }
  // Add system prompt if provided
  let completeMessage = '';
  let completeReasoning = '';
  const url = `https://bedrock-runtime.${getRegion()}.amazonaws.com/model/${modelId}/converse-stream`;
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  const options = {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      Authorization: 'Bearer ' + getBedrockApiKey(),
    },
    body: JSON.stringify(bodyObject),
    signal: controller.signal,
    reactNative: { textStreaming: true },
  };

  fetch(url!, options)
    .then(response => {
      return response.body;
    })
    .then(async body => {
      clearTimeout(timeoutId);
      if (!body) {
        return;
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let appendTimes = 0;
      while (true) {
        if (shouldStop()) {
          await reader.cancel();
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true, undefined, completeReasoning);
          return;
        }

        try {
          const { done, value } = await reader.read();
          const chunk = decoder.decode(value, { stream: true });
          if (chunk.length > 0) {
            // Split by SSE event boundaries
            const events = chunk.split('\n\n');
            for (const event of events) {
              const bedrockChunk = parseChunk(event);
              if (bedrockChunk) {
                if (bedrockChunk.reasoning) {
                  completeReasoning += bedrockChunk.reasoning ?? '';
                  callback(
                    completeMessage,
                    false,
                    false,
                    undefined,
                    completeReasoning
                  );
                }
                if (bedrockChunk.text) {
                  completeMessage += bedrockChunk.text ?? '';
                  appendTimes++;
                  if (appendTimes > 500 && appendTimes % 2 === 0) {
                    continue;
                  }
                  callback(
                    completeMessage,
                    false,
                    false,
                    undefined,
                    completeReasoning
                  );
                }
                if (bedrockChunk.usage) {
                  bedrockChunk.usage.modelName = getTextModel().modelName;
                  callback(
                    completeMessage,
                    false,
                    false,
                    bedrockChunk.usage,
                    completeReasoning
                  );
                }
              }
            }
          }
          if (done) {
            callback(
              completeMessage,
              true,
              false,
              undefined,
              completeReasoning
            );
            return;
          }
        } catch (readError) {
          console.log('Error reading stream:', readError);
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true, undefined, completeReasoning);
          return;
        }
      }
    })
    .catch(error => {
      console.log(error);
      clearTimeout(timeoutId);
      if (shouldStop()) {
        if (completeMessage === '') {
          completeMessage = '...';
        }
        callback(completeMessage, true, true);
      } else {
        const errorMsg = String(error);
        const errorInfo = 'Request error: ' + errorMsg;
        callback(completeMessage + '\n\n' + errorInfo, true, true);
      }
    });
};

function parseChunk(part: string) {
  if (part.length > 0) {
    let reasoning = '';
    let text = '';
    let lastUsage;
    try {
      const chunk: BedrockAPIChunk = JSON.parse(part);
      const content = extractChunkContent(chunk, part);
      if (content.reasoning) {
        reasoning = content.reasoning;
      }
      if (content.text) {
        text = content.text;
      }
      if (content.usage) {
        lastUsage = content.usage;
      }
    } catch (innerError) {
      console.log('DataChunk parse error:', innerError, part);
      return {
        reasoning: reasoning,
        text: part,
        usage: lastUsage,
      };
    }
    return {
      reasoning: reasoning,
      text: text,
      usage: lastUsage,
    };
  }
  return null;
}

function extractChunkContent(bedrockChunk: BedrockAPIChunk, rawChunk: string) {
  const reasoning = bedrockChunk?.delta?.reasoningContent?.text;
  let text = bedrockChunk?.delta?.text;
  const usage = bedrockChunk?.usage;
  if (bedrockChunk?.Message || bedrockChunk?.message) {
    text = rawChunk;
  }
  return { reasoning, text, usage };
}

export const requestAllModelsByBedrockAPI = async (): Promise<AllModel> => {
  if (getBedrockApiKey() === '') {
    return { imageModel: [], textModel: [] };
  }
  const controller = new AbortController();
  const url = `https://bedrock.${getRegion()}.amazonaws.com/foundation-models`;
  const options = {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Bearer ' + getBedrockApiKey(),
    },
    reactNative: { textStreaming: true },
  };
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`);
      return { imageModel: [], textModel: [] };
    }
    const allModel = await response.json();

    // Process the model data similar to the Python code
    if (allModel.modelSummaries) {
      const modelNames = new Set<string>();
      const textModel: Model[] = [];
      const imageModel: Model[] = [];
      const region = getRegion();

      for (const model of allModel.modelSummaries) {
        const needCrossRegion =
          model.inferenceTypesSupported?.includes('INFERENCE_PROFILE');

        if (
          model.modelLifecycle?.status === 'ACTIVE' &&
          (model.inferenceTypesSupported?.includes('ON_DEMAND') ||
            needCrossRegion) &&
          !model.modelId.endsWith('k') &&
          !modelNames.has(model.modelName)
        ) {
          if (
            model.outputModalities?.includes('TEXT') &&
            model.responseStreamingSupported
          ) {
            let modelId = model.modelId;
            if (needCrossRegion) {
              let regionPrefix = region.split('-')[0];
              if (regionPrefix === 'ap') {
                regionPrefix = 'apac';
              }
              modelId = regionPrefix + '.' + model.modelId;
            }

            textModel.push({
              modelId: modelId,
              modelName: model.modelName,
              modelTag: ModelTag.Bedrock,
            });
          } else if (model.outputModalities?.includes('IMAGE')) {
            imageModel.push({
              modelId: model.modelId,
              modelName: model.modelName,
              modelTag: ModelTag.Bedrock,
            });
          }

          modelNames.add(model.modelName);
        }
      }

      // Merge mantle-served models (GPT-5.x only-on-mantle + apiMode tags).
      const mantleModelIds = await fetchMantleModelIdsDirect();
      const { models: mantleOnly, openAiIdSet } = buildMantleOnlyModels(
        mantleModelIds,
        ModelTag.Bedrock
      );
      const taggedTextModel = tagModelsWithApiMode(textModel, openAiIdSet);
      return {
        textModel: [...mantleOnly, ...taggedTextModel],
        imageModel,
      };
    }

    return { imageModel: [], textModel: [] };
  } catch (error) {
    console.log('Bedrock API Error fetching models:', error);
    clearTimeout(timeoutId);
    return { imageModel: [], textModel: [] };
  }
};

// Lists model ids available on the mantle engine for the current region (used
// to discover GPT-5.x and to tag Chat-Completions models). Best-effort: returns
// [] on any failure so the legacy model list still loads.
const fetchMantleModelIdsDirect = async (): Promise<string[]> => {
  const controller = new AbortController();
  const url = getMantleBaseUrl(getRegion()) + '/v1/models';
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + getBedrockApiKey(),
      },
      signal: controller.signal,
      reactNative: { textStreaming: true },
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return [];
    }
    const json = await response.json();
    return (json.data ?? []).map((m: { id: string }) => m.id);
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('Mantle models fetch error:', error);
    return [];
  }
};

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));
