import { MMKV } from 'react-native-mmkv';
import {
  AllModel,
  Chat,
  ChatMode,
  SwiftChatMessage,
  Model,
  SystemPrompt,
  Usage,
  TokenResponse,
  OpenAICompatConfig,
  ModelTag,
  FileInfo,
  SavedApp,
} from '../types/Chat.ts';
import { v4 as uuidv4 } from 'uuid';
import {
  DefaultImageSystemPrompts,
  DefaultRegion,
  DefaultVoiceSystemPrompts,
  getDefaultImageModels,
  getDefaultSystemPrompts,
  getDefaultTextModels,
  VoiceIDList,
} from './Constants.ts';

export const storage = new MMKV();

const initializeStorage = () => {
  const key = 'encryption_key';
  let encryptionKey = storage.getString(key);
  if (!encryptionKey) {
    encryptionKey = uuidv4();
    storage.set(key, encryptionKey);
  }

  return new MMKV({
    id: 'swiftchat',
    encryptionKey: encryptionKey,
  });
};
export const encryptStorage = initializeStorage();

const keyPrefix = 'bedrock/';
const messageListKey = keyPrefix + 'messageList';
const sessionIdPrefix = keyPrefix + 'sessionId/';
const currentSessionIdKey = keyPrefix + 'currentSessionId';
const hapticEnabledKey = keyPrefix + 'hapticEnabled';
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
const imageSizeKey = keyPrefix + 'imageSizeKey';
const modelUsageKey = keyPrefix + 'modelUsageKey';
const systemPromptsKey = keyPrefix + 'systemPromptsKey';
const currentSystemPromptKey = keyPrefix + 'currentSystemPromptKey';
const currentVoiceSystemPromptKey = keyPrefix + 'currentVoiceSystemPromptKey';
const currentImageSystemPromptKey = keyPrefix + 'currentImageSystemPromptKey';
const currentPromptIdKey = keyPrefix + 'currentPromptIdKey';
const openAIProxyEnabledKey = keyPrefix + 'openAIProxyEnabledKey';
const thinkingEnabledKey = keyPrefix + 'thinkingEnabledKey';
const reasoningExpandedKey = keyPrefix + 'reasoningExpandedKey';
const modelOrderKey = keyPrefix + 'modelOrderKey';
const voiceIdKey = keyPrefix + 'voiceIdKey';
const tokenInfoKey = keyPrefix + 'tokenInfo';
const bedrockConfigModeKey = keyPrefix + 'bedrockConfigModeKey';
const bedrockApiKeyTag = keyPrefix + 'bedrockApiKeyTag';
const lastVirtualTryOnImgFileTag = keyPrefix + 'lastVirtualTryOnImgFileTag';
const searchProviderKey = keyPrefix + 'searchProviderKey';
const tavilyApiKeyTag = keyPrefix + 'tavilyApiKeyTag';
const savedAppsKey = keyPrefix + 'savedAppsKey';
const googleLoginDoneKey = keyPrefix + 'googleLoginDoneKey';

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
let currentSystemPrompts: SystemPrompt[] | undefined;
let currentOpenAIProxyEnabled: boolean | undefined;
let currentThinkingEnabled: boolean | undefined;
let currentReasoningExpanded: boolean | undefined;
let currentSearchProvider: string | undefined;
let currentModelOrder: Model[] | undefined;
let currentBedrockConfigMode: string | undefined;
let currentBedrockApiKey: string | undefined;
let currentOpenAICompatibleConfig: OpenAICompatConfig[] | undefined;
let currentVirtualTryOnImgFile: FileInfo | undefined;
let currentTavilyApiKey: string | undefined;

export function saveMessages(
  sessionId: number,
  messages: SwiftChatMessage[],
  usage: Usage
) {
  messages[0].usage = usage;
  messages.forEach((message, index) => {
    if (index !== 0 && 'usage' in message) {
      delete message.usage;
    }
  });
  storage.set(sessionIdPrefix + sessionId, JSON.stringify(messages));
}

export function saveMessageList(
  sessionId: number,
  fistMessage: SwiftChatMessage,
  chatMode: ChatMode
) {
  let allMessageStr = getMessageListStr();
  const currentMessageStr = JSON.stringify({
    id: sessionId,
    title: fistMessage.text.substring(0, 50).replaceAll('\n', ' '),
    mode: chatMode.toString(),
    timestamp: (fistMessage.createdAt as Date).getTime(),
  });
  if (allMessageStr.length === 1) {
    allMessageStr = currentMessageStr + allMessageStr;
  } else {
    allMessageStr = currentMessageStr + ',' + allMessageStr;
  }
  storage.set(messageListKey, allMessageStr);
  storage.set(currentSessionIdKey, sessionId);
}

export function getMessageList(): Chat[] {
  return JSON.parse('[' + getMessageListStr()) as Chat[];
}

export function updateMessageList(chatList: Chat[]) {
  if (chatList.length > 0) {
    storage.set(messageListKey, JSON.stringify(chatList).substring(1));
  } else {
    storage.delete(messageListKey);
  }
}

function getMessageListStr() {
  return storage.getString(messageListKey) ?? ']';
}

export function getMessagesBySessionId(sessionId: number): SwiftChatMessage[] {
  const messageStr = storage.getString(sessionIdPrefix + sessionId);
  if (messageStr) {
    return JSON.parse(messageStr) as SwiftChatMessage[];
  }
  return [];
}

export function deleteMessagesBySessionId(sessionId: number) {
  storage.delete(sessionIdPrefix + sessionId);
}

export function getSessionId() {
  return storage.getNumber(currentSessionIdKey) ?? 0;
}

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

export function getOllamaApiUrl(): string {
  if (currentOllamaApiUrl) {
    return currentOllamaApiUrl;
  } else {
    currentOllamaApiUrl = storage.getString(ollamaApiUrlKey) ?? '';
    return currentOllamaApiUrl;
  }
}

export function getApiKey(): string {
  if (currentApiKey) {
    return currentApiKey;
  } else {
    currentApiKey = encryptStorage.getString(apiKeyTag) ?? '';
    return currentApiKey;
  }
}

export function getDeepSeekApiKey(): string {
  if (currentDeepSeekApiKey) {
    return currentDeepSeekApiKey;
  } else {
    currentDeepSeekApiKey = encryptStorage.getString(deepSeekApiKeyTag) ?? '';
    return currentDeepSeekApiKey;
  }
}

export function getOpenAIApiKey(): string {
  if (currentOpenAIApiKey) {
    return currentOpenAIApiKey;
  } else {
    currentOpenAIApiKey = encryptStorage.getString(openAIApiKeyTag) ?? '';
    return currentOpenAIApiKey;
  }
}

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

export function saveHapticEnabled(enabled: boolean) {
  storage.set(hapticEnabledKey, enabled);
}

export function getHapticEnabled() {
  return storage.getBoolean(hapticEnabledKey) ?? true;
}

export function saveApiUrl(apiUrl: string) {
  storage.set(apiUrlKey, apiUrl);
}

export function saveApiKey(apiKey: string) {
  encryptStorage.set(apiKeyTag, apiKey);
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

export function saveDeepSeekApiKey(apiKey: string) {
  currentDeepSeekApiKey = apiKey;
  encryptStorage.set(deepSeekApiKeyTag, apiKey);
}

export function saveOpenAIApiKey(apiKey: string) {
  currentOpenAIApiKey = apiKey;
  encryptStorage.set(openAIApiKeyTag, apiKey);
}

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
  storage.set(imageSizeKey, size);
}

export function getImageSize() {
  return storage.getString(imageSizeKey) ?? getAllImageSize()[1];
}

export function saveVoiceId(voiceId: string) {
  storage.set(voiceIdKey, voiceId);
}

export function getVoiceId() {
  return storage.getString(voiceIdKey) ?? VoiceIDList[0].voiceId;
}

export function getModelUsage(): Usage[] {
  const usage = storage.getString(modelUsageKey);
  return usage ? JSON.parse(usage) : [];
}

export function updateTotalUsage(usage: Usage) {
  const currentUsage = getModelUsage();
  const modelIndex = currentUsage.findIndex(
    m => m.modelName === usage.modelName
  );
  if (modelIndex >= 0) {
    if (usage.imageCount) {
      currentUsage[modelIndex].imageCount! += usage.imageCount;
    } else if (usage.smallImageCount) {
      currentUsage[modelIndex].smallImageCount! += usage.smallImageCount;
    } else if (usage.largeImageCount) {
      currentUsage[modelIndex].largeImageCount! += usage.largeImageCount;
    } else {
      currentUsage[modelIndex].inputTokens += usage.inputTokens;
      currentUsage[modelIndex].outputTokens += usage.outputTokens;
    }
  } else {
    currentUsage.push(usage);
  }
  storage.set(modelUsageKey, JSON.stringify(currentUsage));
}

export function saveCurrentSystemPrompt(prompts: SystemPrompt | null) {
  storage.set(currentSystemPromptKey, prompts ? JSON.stringify(prompts) : '');
}

export function getCurrentSystemPrompt(): SystemPrompt | null {
  const promptString = storage.getString(currentSystemPromptKey) ?? '';
  if (promptString.length > 0) {
    return JSON.parse(promptString) as SystemPrompt;
  }
  return null;
}

export function saveCurrentVoiceSystemPrompt(prompts: SystemPrompt | null) {
  storage.set(
    currentVoiceSystemPromptKey,
    prompts ? JSON.stringify(prompts) : ''
  );
}

export function getCurrentVoiceSystemPrompt(): SystemPrompt | null {
  const promptString = storage.getString(currentVoiceSystemPromptKey) ?? '';
  if (promptString.length > 0) {
    return JSON.parse(promptString) as SystemPrompt;
  }
  return null;
}

export function saveCurrentImageSystemPrompt(prompts: SystemPrompt | null) {
  storage.set(
    currentImageSystemPromptKey,
    prompts ? JSON.stringify(prompts) : ''
  );
}

export function getCurrentImageSystemPrompt(): SystemPrompt | null {
  const promptString = storage.getString(currentImageSystemPromptKey) ?? '';
  if (promptString.length > 0) {
    return JSON.parse(promptString) as SystemPrompt;
  }
  return null;
}

export function saveSystemPrompts(prompts: SystemPrompt[], type?: string) {
  // get all prompt
  currentSystemPrompts = prompts;
  const promptsString = storage.getString(systemPromptsKey) ?? '';
  let allPrompts: SystemPrompt[] = [];

  if (promptsString.length > 0) {
    allPrompts = JSON.parse(promptsString) as SystemPrompt[];
  }
  const updatedPrompts = [
    ...allPrompts.filter(p => p.promptType !== type),
    ...prompts,
  ];
  storage.set(systemPromptsKey, JSON.stringify(updatedPrompts));
}

export function saveAllSystemPrompts(prompts: SystemPrompt[]) {
  storage.set(systemPromptsKey, JSON.stringify(prompts));
}

export function getSystemPrompts(type?: string): SystemPrompt[] {
  if (
    currentSystemPrompts &&
    currentSystemPrompts.length > 0 &&
    currentSystemPrompts[0].promptType === type
  ) {
    return currentSystemPrompts;
  }
  const promptsString = storage.getString(systemPromptsKey) ?? '';
  if (promptsString.length > 0) {
    currentSystemPrompts = JSON.parse(promptsString) as SystemPrompt[];
    if (
      currentSystemPrompts.filter(p => p.promptType === 'voice').length === 0
    ) {
      currentSystemPrompts = currentSystemPrompts.concat(
        DefaultVoiceSystemPrompts
      );
      saveAllSystemPrompts(currentSystemPrompts);
    }
    if (
      currentSystemPrompts.filter(p => p.promptType === 'image').length === 0
    ) {
      currentSystemPrompts = currentSystemPrompts.concat(
        DefaultImageSystemPrompts
      );
      saveAllSystemPrompts(currentSystemPrompts);
    }
    if (currentSystemPrompts.some(p => p.id === -3)) {
      currentSystemPrompts = currentSystemPrompts.filter(p => p.id !== -3);
      saveAllSystemPrompts(currentSystemPrompts);
    }
    // Migration: Add or update App prompt to ensure it's always up-to-date
    const defaultAppPrompt = getDefaultSystemPrompts().find(
      p => p.name === 'App'
    );
    if (defaultAppPrompt) {
      const existingApp = currentSystemPrompts.find(p => p.name === 'App');
      if (existingApp) {
        // Update existing App prompt with latest content, preserving id
        if (existingApp.prompt !== defaultAppPrompt.prompt) {
          currentSystemPrompts = currentSystemPrompts.map(p =>
            p.name === 'App' ? { ...defaultAppPrompt, id: p.id } : p
          );
          saveAllSystemPrompts(currentSystemPrompts);
        }
      } else {
        // No App prompt exists, check for OptimizeCode to replace or add new
        const hasOptimizeCode = currentSystemPrompts.some(
          p => p.name === 'OptimizeCode'
        );
        if (hasOptimizeCode) {
          currentSystemPrompts = currentSystemPrompts.map(p =>
            p.name === 'OptimizeCode' ? { ...defaultAppPrompt, id: p.id } : p
          );
        } else {
          currentSystemPrompts = [...currentSystemPrompts, defaultAppPrompt];
        }
        saveAllSystemPrompts(currentSystemPrompts);
      }
    }
  } else {
    currentSystemPrompts = getDefaultSystemPrompts();
    saveAllSystemPrompts(currentSystemPrompts);
  }
  currentSystemPrompts = type
    ? currentSystemPrompts.filter(p => p.promptType === type)
    : currentSystemPrompts.filter(p => p.promptType === undefined);
  if (currentSystemPrompts.length === 0) {
    // fix the crash issue
    currentSystemPrompts = getDefaultSystemPrompts();
    currentSystemPrompts = type
      ? currentSystemPrompts.filter(p => p.promptType === type)
      : currentSystemPrompts.filter(p => p.promptType === undefined);
    saveAllSystemPrompts(getDefaultSystemPrompts());
  }
  return currentSystemPrompts;
}

export function getPromptId() {
  return storage.getNumber(currentPromptIdKey) ?? 0;
}

export function savePromptId(promptId: number) {
  storage.set(currentPromptIdKey, promptId);
}

export function saveOpenAIProxyEnabled(enabled: boolean) {
  currentOpenAIProxyEnabled = enabled;
  storage.set(openAIProxyEnabledKey, enabled);
}

export function getOpenAIProxyEnabled() {
  if (currentOpenAIProxyEnabled !== undefined) {
    return currentOpenAIProxyEnabled;
  } else {
    currentOpenAIProxyEnabled =
      storage.getBoolean(openAIProxyEnabledKey) ?? false;
    return currentOpenAIProxyEnabled;
  }
}

export function saveThinkingEnabled(enabled: boolean) {
  currentThinkingEnabled = enabled;
  storage.set(thinkingEnabledKey, enabled);
}

export function getThinkingEnabled() {
  if (currentThinkingEnabled !== undefined) {
    return currentThinkingEnabled;
  } else {
    currentThinkingEnabled = storage.getBoolean(thinkingEnabledKey) ?? true;
    return currentThinkingEnabled;
  }
}

export function saveReasoningExpanded(expanded: boolean) {
  currentReasoningExpanded = expanded;
  storage.set(reasoningExpandedKey, expanded);
}

export function getReasoningExpanded() {
  if (currentReasoningExpanded !== undefined) {
    return currentReasoningExpanded;
  } else {
    currentReasoningExpanded = storage.getBoolean(reasoningExpandedKey) ?? true;
    return currentReasoningExpanded;
  }
}

// Model order functions
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

// Update model order when a model is used
export function updateTextModelUsageOrder(model: Model) {
  const currentOrder = getModelOrder();
  const updatedOrder = [
    model,
    ...currentOrder.filter(m => m.modelId !== model.modelId),
  ];
  saveModelOrder(updatedOrder);
  return updatedOrder;
}

// Get merged model order - combines history with current available models
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

// token related methods
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

// Bedrock configuration mode functions
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

// Bedrock API key functions
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

// Virtual try-on last base image file
export function saveLastVirtualTryOnImgFile(file: FileInfo) {
  currentVirtualTryOnImgFile = file;
  storage.set(lastVirtualTryOnImgFileTag, JSON.stringify(file));
}

export function getLastVirtualTryOnImgFile(): FileInfo | null {
  if (currentVirtualTryOnImgFile) {
    return currentVirtualTryOnImgFile;
  } else {
    const fileString = storage.getString(lastVirtualTryOnImgFileTag) ?? '';
    if (fileString) {
      currentVirtualTryOnImgFile = JSON.parse(fileString) as FileInfo;
      return currentVirtualTryOnImgFile;
    }
    return null;
  }
}

export function saveSearchProvider(provider: string) {
  currentSearchProvider = provider;
  storage.set(searchProviderKey, provider);
}

export function getSearchProvider(): string {
  if (currentSearchProvider) {
    return currentSearchProvider;
  }
  currentSearchProvider = storage.getString(searchProviderKey) ?? 'disabled';
  return currentSearchProvider;
}

export function saveGoogleLoginDone() {
  storage.set(googleLoginDoneKey, true);
}

export function isGoogleLoginDone(): boolean {
  return storage.getBoolean(googleLoginDoneKey) ?? false;
}

export function saveTavilyApiKey(apiKey: string) {
  currentTavilyApiKey = apiKey;
  encryptStorage.set(tavilyApiKeyTag, apiKey);
}

export function getTavilyApiKey(): string {
  if (currentTavilyApiKey) {
    return currentTavilyApiKey;
  } else {
    currentTavilyApiKey = encryptStorage.getString(tavilyApiKeyTag) ?? '';
    return currentTavilyApiKey;
  }
}

// OpenAI Compatible configurations functions
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

// Migration function to convert old single config to new multi-config format
export function migrateOpenAICompatConfig() {
  const existingConfigs = getOpenAICompatConfigs();
  if (existingConfigs.length > 0) {
    return; // Already migrated
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

    // Clear old storage keys
    storage.delete(openAICompatApiURLKey);
    encryptStorage.delete(openAICompatApiKeyTag);
    storage.delete(openAICompatModelsKey);
  }
}

// Helper function to extract domain from URL
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

// Saved Apps functions
// Store metadata separately from htmlCode to improve performance
// Metadata list: savedAppsKey -> [{id, name, screenshotPath, createdAt}, ...]
// HTML code: app_code_{id} -> htmlCode string

export type AppMetadata = Omit<SavedApp, 'htmlCode'>;
let cachedAppMetadata: AppMetadata[] | undefined;

const getAppCodeKey = (appId: string) => `app_code_${appId}`;

export function saveApp(app: SavedApp): void {
  const { htmlCode, ...metadata } = app;

  // Save htmlCode separately
  storage.set(getAppCodeKey(app.id), htmlCode);

  // Save metadata to list
  const apps = getSavedApps();
  const existingIndex = apps.findIndex(a => a.id === app.id);
  if (existingIndex >= 0) {
    apps[existingIndex] = metadata;
  } else {
    apps.unshift(metadata);
  }
  cachedAppMetadata = apps;
  storage.set(savedAppsKey, JSON.stringify(apps));
}

export function getSavedApps(): AppMetadata[] {
  if (cachedAppMetadata) {
    return [...cachedAppMetadata];
  }
  const appsString = storage.getString(savedAppsKey) ?? '';
  if (appsString.length > 0) {
    cachedAppMetadata = JSON.parse(appsString) as AppMetadata[];
    return [...cachedAppMetadata];
  }
  return [];
}

export function deleteApp(appId: string): void {
  // Delete htmlCode
  storage.delete(getAppCodeKey(appId));

  // Delete from metadata list
  const apps = getSavedApps().filter(a => a.id !== appId);
  cachedAppMetadata = apps;
  storage.set(savedAppsKey, JSON.stringify(apps));
}

export function getAppById(appId: string): SavedApp | undefined {
  const metadata = getSavedApps().find(a => a.id === appId);
  if (!metadata) {
    return undefined;
  }
  // Load htmlCode on demand
  const htmlCode = storage.getString(getAppCodeKey(appId)) ?? '';
  return { ...metadata, htmlCode };
}

export function generateAppId(): string {
  return uuidv4();
}

export function pinApp(appId: string): void {
  const apps = getSavedApps();
  const index = apps.findIndex(a => a.id === appId);
  if (index > 0) {
    const [app] = apps.splice(index, 1);
    apps.unshift(app);
    cachedAppMetadata = apps;
    storage.set(savedAppsKey, JSON.stringify(apps));
  }
}

export function renameApp(appId: string, newName: string): void {
  const apps = getSavedApps();
  const app = apps.find(a => a.id === appId);
  if (app) {
    app.name = newName;
    cachedAppMetadata = apps;
    storage.set(savedAppsKey, JSON.stringify(apps));
  }
}

// Clear all chat history and related data
export function clearAllChatHistory(): void {
  // Get all message sessions and delete them
  const chatList = getMessageList();
  chatList.forEach(chat => {
    storage.delete(sessionIdPrefix + chat.id);
  });

  // Clear the message list
  storage.delete(messageListKey);

  // Clear current session ID
  storage.delete(currentSessionIdKey);

  // Clear saved apps metadata and their code
  const apps = getSavedApps();
  apps.forEach(app => {
    storage.delete(getAppCodeKey(app.id));
  });
  storage.delete(savedAppsKey);
  cachedAppMetadata = undefined;
}

// Generate OpenAI Compatible models from configs
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
