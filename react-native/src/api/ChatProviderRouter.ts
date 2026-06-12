import { ApiMode, ModelTag } from '../types/Chat.ts';
import {
  getBedrockApiKey,
  getBedrockConfigMode,
  getDeepSeekApiKey,
  getOpenAIApiKey,
  getTextModel,
} from '../storage/StorageUtils.ts';
import { getModelTag } from '../utils/ModelUtils.ts';
import type { ChatCallbackFunction } from './types.ts';
import type { BedrockMessage } from './BedrockMessageConvertor.ts';
import type { SystemPrompt } from '../types/Chat.ts';
import { invokeOpenAIWithCallBack } from './providers/open-api.ts';
import { invokeOllamaWithCallBack } from './providers/ollama-api.ts';
import { invokeLiteRTWithCallBack } from './providers/litert-api.ts';
import { invokeBedrockWithAPIKey } from './providers/bedrock-api-key.ts';
import { invokeBedrockMantle } from './providers/bedrock-mantle.ts';
import { resolveApiMode, isMantleMode } from './providers/mantle-utils.ts';
import {
  invokeBedrockServerWithCallBack,
  isConfigured,
} from './bedrock-api.ts';

/**
 * Routes a chat request to the appropriate provider based on the current model tag.
 * This is the single entry point for all chat invocations.
 */
export const invokeChatProvider = async (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: ChatCallbackFunction
): Promise<void> => {
  const currentModelTag = getModelTag(getTextModel());

  // On-device LiteRT provider
  if (currentModelTag === ModelTag.LiteRT) {
    await invokeLiteRTWithCallBack(
      messages,
      prompt,
      shouldStop,
      controller,
      callback
    );
    return;
  }

  // Non-Bedrock providers
  if (currentModelTag !== ModelTag.Bedrock) {
    if (
      currentModelTag === ModelTag.DeepSeek &&
      getDeepSeekApiKey().length === 0
    ) {
      callback('Please configure your DeepSeek API Key', true, false);
      return;
    }
    if (currentModelTag === ModelTag.OpenAI && getOpenAIApiKey().length === 0) {
      callback('Please configure your OpenAI API Key', true, false);
      return;
    }
    if (
      currentModelTag === ModelTag.OpenAICompatible &&
      getTextModel().apiUrl!.length === 0
    ) {
      callback('Please configure your OpenAI Compatible API URL', true, false);
      return;
    }
    if (currentModelTag === ModelTag.Ollama) {
      await invokeOllamaWithCallBack(
        messages,
        prompt,
        shouldStop,
        controller,
        callback
      );
    } else {
      await invokeOpenAIWithCallBack(
        messages,
        prompt,
        shouldStop,
        controller,
        callback
      );
    }
    return;
  }

  // Bedrock providers
  const bedrockConfigMode = getBedrockConfigMode();
  const bedrockApiKey = getBedrockApiKey();
  if (bedrockConfigMode === 'bedrock' && !bedrockApiKey) {
    callback('Please configure your Bedrock API Key', true, false);
    return;
  }
  if (bedrockConfigMode !== 'bedrock' && !isConfigured()) {
    callback(
      'Please configure your VifChat Server API URL and API Key',
      true,
      false
    );
    return;
  }

  // Mantle-served models (GPT-5.x, Fable 5, open-weight models) take the
  // preferred path; everything else uses the legacy Converse API.
  const apiMode =
    getTextModel().apiMode ?? resolveApiMode(getTextModel().modelId);
  if (isMantleMode(apiMode)) {
    await invokeBedrockMantle(
      apiMode as ApiMode,
      messages,
      prompt,
      shouldStop,
      controller,
      callback
    );
    return;
  }

  if (bedrockConfigMode === 'bedrock') {
    await invokeBedrockWithAPIKey(
      messages,
      prompt,
      shouldStop,
      controller,
      callback
    );
    return;
  }
  await invokeBedrockServerWithCallBack(
    messages,
    prompt,
    shouldStop,
    controller,
    callback
  );
};
