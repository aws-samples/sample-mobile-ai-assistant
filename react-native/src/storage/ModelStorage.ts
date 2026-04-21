import {
  AllModel,
  Model,
  ModelTag,
  OpenAICompatConfig,
  TokenResponse,
} from '../types/Chat.ts';
import { v4 as uuidv4 } from 'uuid';
import { storage, encryptStorage } from './StorageUtils.ts';
import {
  DefaultRegion,
  getDefaultImageModels,
  getDefaultTextModels,
  VoiceIDList,
} from './Constants.ts';

const keyPrefix = 'bedrock/';
const apiUrlKey = keyPrefix + 'apiUrlKey';
const apiKeyTag = keyPrefix + 'apiKeyTag';
const ollamaApiUrlKey = keyPrefix + 'ollamaApiUrlKey';
const ollamaApiKeyTag = keyPrefix + 'ollamaApiKeyTag';
const deepSeekApiKeyTag = keyPrefix + 'deepSeekApiKeyTag';
const openAIApiKeyTag = keyPrefix + 'openAIApiKeyTag';
const openAICompatApiKeyTag = keyPrefix + 'openAICompatApiKeyTag';
const openAICompatApiURLKey = keyPrefix + 'openAICompatApiURLKey';
const openAICompatModelsKey = keyPrefix + 'openAICompatModelsKey';
const openAICompatConfigsKey = keyPrefix + 'openAICompatConfigsKey';
const regionKey = keyPrefix + 'regionKey';
const textModelKey = keyPrefix + 'textModelKey';
const imageModelKey = keyPrefix + 'imageModelKey';
const allModelKey = keyPrefix + 'allModelKey';
const modelOrderKey = keyPrefix + 'modelOrderKey';
const tokenInfoKey = keyPrefix + 'tokenInfo';
const bedrockConfigModeKey = keyPrefix + 'bedrockConfigModeKey';
const bedrockApiKeyTag = keyPrefix + 'bedrockApiKeyTag';
const voiceIdKey = keyPrefix + 'voiceIdKey';

let currentApiUrl: string | undefined;
let currentApiKey: string | undefined;
let currentOllamaApiUrl: string | undefined;
let currentOllamaApiKey: string | undefined;
let currentDeepSeekApiKey: string | undefined;
let currentOpenAIApiKey: string | undefined;
let currentOpenAICompatApiKey: string | undefined;
let currentOpenAICompatApiURL: string | undefined;
let currentRegion: string | undefined;
let currentImageModel: Model | undefined;
let currentTextModel: Model | undefined;
let currentModelOrder: Model[] | undefined;
let currentBedrockConfigMode: string | undefined;
let currentBedrockApiKey: string | undefined;
let currentOpenAICompatibleConfig: OpenAICompatConfig[] | undefined;

// API URL & Key
export function saveKeys(apiUrl: string, apiKey: string) {
  if (apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }
  saveApiUrl(apiUrl);
  saveApiKey(apiKey);
  currentApiKey = apiKey;
  currentApiUrl = apiUrl;
}

export function getApiUrl(): string {
  if (currentApiUrl) {
    return currentApiUrl;
  } else {
    currentApiUrl = storage.getString(apiUrlKey) ?? '';
    return currentApiUrl;
  }
}

export function saveApiUrl(apiUrl: string) {
  storage.set(apiUrlKey, apiUrl);
}

export function getApiKey(): string {
  if (currentApiKey) {
    return currentApiKey;
  } else {
    currentApiKey = encryptStorage.getString(apiKeyTag) ?? '';
    return currentApiKey;
  }
}

export function saveApiKey(apiKey: string) {
  encryptStorage.set(apiKeyTag, apiKey);
}

// Ollama
export function getOllamaApiUrl(): string {
  if (currentOllamaApiUrl) {
    return currentOllamaApiUrl;
  } else {
    currentOllamaApiUrl = storage.getString(ollamaApiUrlKey) ?? '';
    return currentOllamaApiUrl;
  }
}

export function saveOllamaApiURL(apiUrl: string) {
  currentOllamaApiUrl = apiUrl;
  storage.set(ollamaApiUrlKey, apiUrl);
}

export function getOllamaApiKey(): string {
  if (currentOllamaApiKey) {
    return currentOllamaApiKey;
  } else {
    currentOllamaApiKey = encryptStorage.getString(ollamaApiKeyTag) ?? '';
    return currentOllamaApiKey;
  }
}

export function saveOllamaApiKey(apiKey: string) {
  currentOllamaApiKey = apiKey;
  encryptStorage.set(ollamaApiKeyTag, apiKey);
}

// DeepSeek
export function getDeepSeekApiKey(): string {
  if (currentDeepSeekApiKey) {
    return currentDeepSeekApiKey;
  } else {
    currentDeepSeekApiKey = encryptStorage.getString(deepSeekApiKeyTag) ?? '';
    return currentDeepSeekApiKey;
  }
}

export function saveDeepSeekApiKey(apiKey: string) {
  currentDeepSeekApiKey = apiKey;
  encryptStorage.set(deepSeekApiKeyTag, apiKey);
}

// OpenAI
export function getOpenAIApiKey(): string {
  if (currentOpenAIApiKey) {
    return currentOpenAIApiKey;
  } else {
    currentOpenAIApiKey = encryptStorage.getString(openAIApiKeyTag) ?? '';
    return currentOpenAIApiKey;
  }
}

export function saveOpenAIApiKey(apiKey: string) {
  currentOpenAIApiKey = apiKey;
  encryptStorage.set(openAIApiKeyTag, apiKey);
}

// OpenAI Compatible (legacy single config)
export function getOpenAICompatApiKey(): string {
  if (currentOpenAICompatApiKey) {
    return currentOpenAICompatApiKey;
  } else {
    currentOpenAICompatApiKey =
      encryptStorage.getString(openAICompatApiKeyTag) ?? '';
    return currentOpenAICompatApiKey;
  }
}

export function getOpenAICompatApiURL(): string {
  if (currentOpenAICompatApiURL) {
    return currentOpenAICompatApiURL;
  } else {
    currentOpenAICompatApiURL = storage.getString(openAICompatApiURLKey) ?? '';
    return currentOpenAICompatApiURL;
  }
}

export function getOpenAICompatModels(): string {
  return storage.getString(openAICompatModelsKey) ?? '';
}

// OpenAI Compatible multi-config
export function saveOpenAICompatConfigs(configs: OpenAICompatConfig[]) {
  currentOpenAICompatibleConfig = configs;
  encryptStorage.set(openAICompatConfigsKey, JSON.stringify(configs));
}

export function getOpenAICompatConfigs(): OpenAICompatConfig[] {
  if (currentOpenAICompatibleConfig) {
    return currentOpenAICompatibleConfig;
  } else {
    const configsStr = encryptStorage.getString(openAICompatConfigsKey);
    if (configsStr) {
      currentOpenAICompatibleConfig = JSON.parse(
        configsStr
      ) as OpenAICompatConfig[];
      return currentOpenAICompatibleConfig;
    }
    return [];
  }
}

export function migrateOpenAICompatConfig() {
  const existingConfigs = getOpenAICompatConfigs();
  if (existingConfigs.length > 0) {
    return;
  }

  const baseUrl = getOpenAICompatApiURL();
  const apiKey = getOpenAICompatApiKey();
  const modelIds = getOpenAICompatModels();

  if (baseUrl || apiKey || modelIds) {
    const domain = extractDomainFromUrl(baseUrl);
    const newConfig: OpenAICompatConfig = {
      id: uuidv4(),
      baseUrl,
      apiKey,
      modelIds,
      name: domain || 'OpenAI Compatible',
    };
    saveOpenAICompatConfigs([newConfig]);
    storage.delete(openAICompatApiURLKey);
    encryptStorage.delete(openAICompatApiKeyTag);
    storage.delete(openAICompatModelsKey);
  }
}

export function extractDomainFromUrl(url: string): string {
  if (!url) {
    return '';
  }
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const parts = hostname.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 2];
    }
    return parts[0];
  } catch {
    return '';
  }
}

export function generateOpenAICompatModels(
  configs: OpenAICompatConfig[]
): Model[] {
  const openAICompatModelList: Model[] = [];

  configs.forEach(config => {
    if (config.modelIds && config.modelIds.length > 0 && config.baseUrl) {
      const domain = extractDomainFromUrl(config.baseUrl);
      const prefix = domain ? `${domain}/` : '';

      const models = config.modelIds.split(',').map(modelId => {
        modelId = modelId.trim().replace(/(\r\n|\n|\r)/gm, '');
        const parts = modelId.split('/');
        const displayName =
          prefix + (parts.length === 2 ? parts[1] : modelId).trim();

        return {
          modelId: modelId,
          modelName: displayName,
          modelTag: ModelTag.OpenAICompatible,
          uniqueId: config.id,
          apiKey: config.apiKey ?? '',
          apiUrl: config.baseUrl ?? '',
        } as Model;
      });
      openAICompatModelList.push(...models);
    }
  });

  return openAICompatModelList;
}

// Region
export function saveRegion(region: string) {
  currentRegion = region;
  storage.set(regionKey, region);
}

export function getRegion() {
  if (currentRegion) {
    return currentRegion;
  } else {
    currentRegion = storage.getString(regionKey) ?? DefaultRegion;
    return currentRegion;
  }
}

// Text model
export function saveTextModel(model: Model) {
  currentTextModel = model;
  storage.set(textModelKey, JSON.stringify(model));
}

export function getTextModel(): Model {
  if (currentTextModel) {
    return currentTextModel;
  } else {
    const modelString = storage.getString(textModelKey) ?? '';
    if (modelString.length > 0) {
      currentTextModel = JSON.parse(modelString) as Model;
    } else {
      currentTextModel = getDefaultTextModels()[0];
    }
    return currentTextModel;
  }
}

// Image model
export function saveImageModel(model: Model) {
  currentImageModel = model;
  storage.set(imageModelKey, JSON.stringify(model));
}

export function getImageModel(): Model {
  if (currentImageModel) {
    return currentImageModel;
  } else {
    const modelString = storage.getString(imageModelKey) ?? '';
    if (modelString.length > 0) {
      currentImageModel = JSON.parse(modelString) as Model;
    } else {
      currentImageModel = getDefaultImageModels()[0];
    }
    return currentImageModel;
  }
}

// All models
export function saveAllModels(allModels: AllModel) {
  storage.set(allModelKey, JSON.stringify(allModels));
}

export function getAllModels() {
  const modelString = storage.getString(allModelKey) ?? '';
  if (modelString.length > 0) {
    return JSON.parse(modelString) as AllModel;
  }
  return {
    imageModel: getDefaultImageModels(),
    textModel: getDefaultTextModels(),
  };
}

// Image size
export function getAllImageSize(imageModelId: string = '') {
  if (isNewStabilityImageModel(imageModelId)) {
    return ['1024 x 1024'];
  }
  if (isNovaCanvas(imageModelId)) {
    return ['1024 x 1024', '2048 x 2048'];
  }
  return ['512 x 512', '1024 x 1024'];
}

export function isNewStabilityImageModel(modelId: string) {
  return (
    modelId === 'stability.sd3-large-v1:0' ||
    modelId === 'stability.stable-image-ultra-v1:0' ||
    modelId === 'stability.stable-image-core-v1:0'
  );
}

export function isNovaCanvas(modelId: string) {
  return modelId.includes('nova-canvas');
}

export function saveImageSize(size: string) {
  storage.set(keyPrefix + 'imageSizeKey', size);
}

export function getImageSize() {
  return storage.getString(keyPrefix + 'imageSizeKey') ?? getAllImageSize()[1];
}

// Model order
export function saveModelOrder(models: Model[]) {
  currentModelOrder = models;
  storage.set(modelOrderKey, JSON.stringify(models));
}

export function getModelOrder(): Model[] {
  if (currentModelOrder) {
    return currentModelOrder;
  } else {
    const modelOrderString = storage.getString(modelOrderKey) ?? '';
    if (modelOrderString.length > 0) {
      currentModelOrder = JSON.parse(modelOrderString) as Model[];
    } else {
      currentModelOrder = [];
    }
    return currentModelOrder;
  }
}

export function updateTextModelUsageOrder(model: Model) {
  const currentOrder = getModelOrder();
  const updatedOrder = [
    model,
    ...currentOrder.filter(m => m.modelId !== model.modelId),
  ];
  saveModelOrder(updatedOrder);
  return updatedOrder;
}

export function getMergedModelOrder(): Model[] {
  const historyModels = getModelOrder();
  const currentTextModels = getAllModels().textModel;
  const currentModelMap = new Map<string, Model>();
  currentTextModels.forEach(model => {
    currentModelMap.set(model.modelId, model);
  });
  const mergedModels: Model[] = [];
  historyModels.forEach(model => {
    if (currentModelMap.has(model.modelId)) {
      mergedModels.push(currentModelMap.get(model.modelId)!);
      currentModelMap.delete(model.modelId);
    }
  });
  currentModelMap.forEach(model => {
    mergedModels.push(model);
  });
  return mergedModels;
}

// Voice ID
export function saveVoiceId(voiceId: string) {
  storage.set(voiceIdKey, voiceId);
}

export function getVoiceId() {
  return storage.getString(voiceIdKey) ?? VoiceIDList[0].voiceId;
}

// Token
export function saveTokenInfo(tokenInfo: TokenResponse) {
  encryptStorage.set(tokenInfoKey, JSON.stringify(tokenInfo));
}

export function getTokenInfo(): TokenResponse | null {
  const tokenInfoStr = encryptStorage.getString(tokenInfoKey);
  if (tokenInfoStr) {
    return JSON.parse(tokenInfoStr) as TokenResponse;
  }
  return null;
}

export function isTokenValid(): boolean {
  const tokenInfo = getTokenInfo();
  if (!tokenInfo) {
    return false;
  }
  const expirationDate = new Date(tokenInfo.expiration).getTime();
  const now = new Date().getTime();
  return expirationDate > now + 10 * 60 * 1000;
}

// Bedrock config mode
export function saveBedrockConfigMode(mode: string) {
  currentBedrockConfigMode = mode;
  storage.set(bedrockConfigModeKey, mode);
}

export function getBedrockConfigMode(): string {
  if (currentBedrockConfigMode) {
    return currentBedrockConfigMode;
  } else {
    currentBedrockConfigMode =
      storage.getString(bedrockConfigModeKey) ??
      (getApiUrl().length > 0 ? 'swiftchat' : 'bedrock');
    return currentBedrockConfigMode;
  }
}

// Bedrock API key
export function saveBedrockApiKey(apiKey: string) {
  currentBedrockApiKey = apiKey;
  encryptStorage.set(bedrockApiKeyTag, apiKey);
}

export function getBedrockApiKey(): string {
  if (currentBedrockApiKey) {
    return currentBedrockApiKey;
  } else {
    currentBedrockApiKey = encryptStorage.getString(bedrockApiKeyTag) ?? '';
    return currentBedrockApiKey;
  }
}
