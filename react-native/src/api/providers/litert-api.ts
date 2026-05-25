import { SystemPrompt, Usage } from '../../types/Chat.ts';
import {
  BedrockMessage,
  TextContent,
  ImageContent,
} from '../BedrockMessageConvertor.ts';
import { liteRTService } from '../../chat/service/LiteRTService.ts';
import { getTextModel } from '../../storage/StorageUtils.ts';
import type { ChatCallbackFunction } from '../types.ts';
import RNFS from 'react-native-fs';

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

  const textContent = lastMessage.content
    .filter(c => (c as TextContent).text)
    .map(c => (c as TextContent).text)
    .join('\n');

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

  const systemPromptText = prompt?.prompt || undefined;
  await liteRTService.sendMessage(textContent, systemPromptText, imagePaths);
};
