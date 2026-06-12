import { Model, ModelTag } from '../types/Chat.ts';
import { DeepSeekModels, LiteRTModels } from '../storage/Constants.ts';
import { getTextModel } from '../storage/StorageUtils.ts';

export function getModelTag(model: Model): string {
  if (model.modelTag) {
    return model?.modelTag;
  }
  const isLiteRT = LiteRTModels.some(m => m.modelId === model.modelId);
  if (isLiteRT) {
    return ModelTag.LiteRT;
  }
  const isDeepSeek = DeepSeekModels.some(
    deepseekModel => deepseekModel.modelId === model.modelId
  );
  if (isDeepSeek) {
    return ModelTag.DeepSeek;
  }
  if (model.modelId.includes('gpt')) {
    return ModelTag.OpenAI;
  }
  if (getTextModel().modelId.startsWith('ollama-')) {
    return ModelTag.Ollama;
  }
  return ModelTag.Bedrock;
}

export const getModelIcon = (
  modelTag: string,
  modelId: string | undefined,
  isDark: boolean
) => {
  let isDeepSeek = modelTag === ModelTag.DeepSeek;
  if (modelId) {
    isDeepSeek = DeepSeekModels.some(m => m.modelId === modelId);
  }
  const isLiteRT = modelTag === ModelTag.LiteRT;
  const isOpenAICompatible = modelTag === ModelTag.OpenAICompatible;
  const isOpenAI = modelTag === ModelTag.OpenAI || modelTag.includes('gpt');
  const isOllama =
    modelTag === ModelTag.Ollama || modelTag.startsWith('ollama-');

  return isLiteRT
    ? isDark
      ? require('../assets/google_dark.png')
      : require('../assets/google.png')
    : isDeepSeek
    ? isDark
      ? require('../assets/deepseek_dark.png')
      : require('../assets/deepseek.png')
    : isOpenAICompatible
    ? require('../assets/openai_api.png')
    : isOpenAI
    ? isDark
      ? require('../assets/openai_dark.png')
      : require('../assets/openai.png')
    : isOllama
    ? require('../assets/ollama_white.png')
    : isDark
    ? require('../assets/bedrock_dark.png')
    : require('../assets/bedrock.png');
};

export function getModelTagByUserName(
  modelTag: string | undefined,
  userName: string
): string {
  if (modelTag) {
    return modelTag;
  }
  if (userName.includes('Gemma 4 E2B')) {
    return ModelTag.LiteRT;
  }
  const isDeepSeek = DeepSeekModels.some(
    deepseekModel => deepseekModel.modelId === userName
  );
  if (isDeepSeek) {
    return ModelTag.DeepSeek;
  }
  if (userName.includes('GPT')) {
    return ModelTag.OpenAI;
  }
  if (userName.includes(':')) {
    return ModelTag.Ollama;
  }
  return ModelTag.Bedrock;
}
