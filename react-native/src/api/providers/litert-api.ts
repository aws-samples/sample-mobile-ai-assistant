import { SystemPrompt, Usage } from '../../types/Chat.ts';
import {
  BedrockMessage,
  TextContent,
  ImageContent,
} from '../BedrockMessageConvertor.ts';
import { liteRTService } from '../../chat/service/LiteRTService.ts';
import { getTextModel } from '../../storage/StorageUtils.ts';
import { InspectionPromptName } from '../../storage/Constants.ts';
import type { ChatCallbackFunction } from '../types.ts';
import RNFS from 'react-native-fs';

export const INSPECTION_PREFIX = '<!--INSPECTION-->';

export const invokeLiteRTWithCallBack = async (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  _controller: AbortController,
  callback: ChatCallbackFunction
) => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) {
    callback('No message to send', true, false);
    return;
  }

  let textContent = lastMessage.content
    .filter(c => (c as TextContent).text)
    .map(c => (c as TextContent).text)
    .join('\n');

  // Default prompt for inspection mode
  if (prompt?.name === InspectionPromptName) {
    if (!textContent || textContent === InspectionPromptName) {
      textContent = 'Inspect this image.';
    }
  }

  if (!textContent) {
    callback('Empty message', true, false);
    return;
  }

  if (!liteRTService.getIsInitialized()) {
    const success = await liteRTService.initialize();
    if (!success) {
      callback('Failed to initialize on-device model. Please check model status in Settings.', true, false);
      return;
    }
  }

  // Reset conversation for new chat sessions (only first user message)
  if (messages.length === 1) {
    await liteRTService.resetConversation();
  }

  const startTime = Date.now();

  liteRTService.setCallbacks(
    (text: string) => {
      if (shouldStop()) {
        liteRTService.stopGeneration();
        callback(text || '...', true, true);
        return;
      }
      callback(text, false, false);
    },
    (text: string) => {
      const elapsed = Date.now() - startTime;
      const tokenCount = text.split(/\s+/).length;
      const usage: Usage = {
        modelName: getTextModel().modelName,
        inputTokens: 0,
        outputTokens: tokenCount,
        totalTokens: tokenCount,
      };
      callback(text, true, false, usage);
    },
    (errorMsg: string) => {
      callback(`Error: ${errorMsg}`, true, false);
    }
  );

  // Extract image paths from message content
  const imageContents = lastMessage.content.filter(
    c => (c as ImageContent).image
  ) as ImageContent[];

  let imagePaths: string[] | undefined;
  if (imageContents.length > 0) {
    imagePaths = [];
    for (let i = 0; i < imageContents.length; i++) {
      const base64Data = imageContents[i].image.source.bytes;
      const format = imageContents[i].image.format || 'jpeg';
      const tmpPath = `${RNFS.TemporaryDirectoryPath}/litert_img_${i}.${format}`;
      await RNFS.writeFile(tmpPath, base64Data, 'base64');
      imagePaths.push(tmpPath);
    }
  }

  // Inspection mode: use tool calling with node-style streaming display
  if (prompt?.name === InspectionPromptName && imagePaths && imagePaths.length > 0) {
    const steps: Array<{ check_type: string; status: string; details: string }> = [];
    let streamingText = '';

    const formatInspectionData = (isComplete: boolean) => {
      return INSPECTION_PREFIX + JSON.stringify({
        steps,
        finalText: streamingText || undefined,
        isStreaming: !isComplete,
      });
    };

    liteRTService.setCallbacks(
      (text: string) => {
        if (shouldStop()) {
          liteRTService.stopGeneration();
          callback(formatInspectionData(true), true, true);
          return;
        }
        if (steps.length >= 3 && text) {
          streamingText = text;
          callback(formatInspectionData(false), false, false);
        }
      },
      undefined,
      (errorMsg: string) => {
        callback(`Error: ${errorMsg}`, true, false);
      }
    );

    liteRTService.setOnToolCallCallback((tc) => {
      steps.push(tc);
      streamingText = '';
      callback(formatInspectionData(false), false, false);
      if (steps.length >= 3) {
        liteRTService.setOnToolCallCallback(undefined);
      }
    });

    const result = await liteRTService.sendInspection(textContent, prompt?.prompt, imagePaths);
    liteRTService.setOnToolCallCallback(undefined);

    if (result) {
      streamingText = result.text;
      const usage: Usage = {
        modelName: getTextModel().modelName,
        inputTokens: 0,
        outputTokens: result.text.split(/\s+/).length,
        totalTokens: result.text.split(/\s+/).length,
      };
      callback(formatInspectionData(true), true, false, usage);
    }
    return;
  }

  const systemPromptText = prompt?.prompt || undefined;
  await liteRTService.sendMessage(textContent, systemPromptText, imagePaths);
};
