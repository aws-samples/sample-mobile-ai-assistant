import { SystemPrompt, Usage } from '../../types/Chat.ts';
import {
  BedrockMessage,
  TextContent,
  ImageContent,
} from '../BedrockMessageConvertor.ts';
import {
  liteRTService,
  AgentToolCall,
} from '../../chat/service/LiteRTService.ts';
import { getTextModel } from '../../storage/StorageUtils.ts';
import type { ChatCallbackFunction } from '../types.ts';
import RNFS from 'react-native-fs';

export const AGENT_PREFIX = '<!--AGENT-->';

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

  // Agent mode is triggered by any prompt flagged isAgent
  const isAgentMode = prompt?.isAgent === true;

  if (isAgentMode && (!textContent || textContent === prompt?.name)) {
    textContent = 'Inspect this image.';
  }

  if (!textContent) {
    callback('Empty message', true, false);
    return;
  }

  if (!liteRTService.getIsInitialized()) {
    const success = await liteRTService.initialize();
    if (!success) {
      callback(
        'Failed to initialize on-device model. Please check model status in Settings.',
        true,
        false
      );
      return;
    }
  }

  // Reset conversation for new chat sessions (only first user message)
  if (messages.length === 1) {
    await liteRTService.resetConversation();
  }

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

  // Agent mode: tool calling with node-style display
  if (isAgentMode && imagePaths && imagePaths.length > 0) {
    const systemPrompt = prompt?.prompt || '';
    const steps: AgentToolCall[] = [];
    let streamingText = '';

    const formatAgentData = (isComplete: boolean) => {
      return (
        AGENT_PREFIX +
        JSON.stringify({
          steps,
          finalText: streamingText || undefined,
          isStreaming: !isComplete,
        })
      );
    };

    liteRTService.setCallbacks(
      (text: string) => {
        if (shouldStop()) {
          liteRTService.stopGeneration();
          callback(formatAgentData(true), true, true);
          return;
        }
        // The final summary always comes after tool calls — stream it once
        // at least one finding has been recorded (ignore any pre-tool thinking text).
        if (steps.length >= 1 && text) {
          streamingText = text;
          callback(formatAgentData(false), false, false);
        }
      },
      undefined,
      (errorMsg: string) => {
        callback(`Error: ${errorMsg}`, true, false);
      }
    );

    liteRTService.setOnToolCallCallback(tc => {
      steps.push(tc);
      streamingText = '';
      callback(formatAgentData(false), false, false);
    });

    const result = await liteRTService.sendAgent(
      textContent,
      systemPrompt,
      imagePaths
    );

    liteRTService.setOnToolCallCallback(undefined);

    if (result) {
      streamingText = result.text;
      const usage: Usage = {
        modelName: getTextModel().modelName,
        inputTokens: 0,
        outputTokens: result.text.split(/\s+/).length,
        totalTokens: result.text.split(/\s+/).length,
      };
      callback(formatAgentData(true), true, false, usage);
    }
    return;
  }

  // Normal chat mode
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

  const systemPromptText = prompt?.prompt || undefined;
  await liteRTService.sendMessage(textContent, systemPromptText, imagePaths);
};
