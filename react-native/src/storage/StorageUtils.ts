import { MMKV } from 'react-native-mmkv';
import { v4 as uuidv4 } from 'uuid';

// Core storage instances - used by all domain modules
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

export function generateAppId(): string {
  return uuidv4();
}

// Re-export all domain modules for backward compatibility
export {
  saveMessages,
  saveMessageList,
  getMessageList,
  updateMessageList,
  getMessagesBySessionId,
  deleteMessagesBySessionId,
  getSessionId,
  getModelUsage,
  updateTotalUsage,
  clearAllChatHistory,
} from './ChatStorage.ts';

export {
  saveKeys,
  getApiUrl,
  saveApiUrl,
  getApiKey,
  saveApiKey,
  getOllamaApiUrl,
  saveOllamaApiURL,
  getOllamaApiKey,
  saveOllamaApiKey,
  getDeepSeekApiKey,
  saveDeepSeekApiKey,
  getOpenAIApiKey,
  saveOpenAIApiKey,
  getOpenAICompatApiKey,
  getOpenAICompatApiURL,
  getOpenAICompatModels,
  saveOpenAICompatConfigs,
  getOpenAICompatConfigs,
  migrateOpenAICompatConfig,
  extractDomainFromUrl,
  generateOpenAICompatModels,
  saveRegion,
  getRegion,
  saveTextModel,
  getTextModel,
  saveImageModel,
  getImageModel,
  saveAllModels,
  getAllModels,
  getAllImageSize,
  isNewStabilityImageModel,
  isNovaCanvas,
  saveImageSize,
  getImageSize,
  saveModelOrder,
  getModelOrder,
  updateTextModelUsageOrder,
  getMergedModelOrder,
  saveVoiceId,
  getVoiceId,
  saveTokenInfo,
  getTokenInfo,
  isTokenValid,
  saveBedrockConfigMode,
  getBedrockConfigMode,
  saveBedrockApiKey,
  getBedrockApiKey,
} from './ModelStorage.ts';

export {
  saveCurrentSystemPrompt,
  getCurrentSystemPrompt,
  saveCurrentVoiceSystemPrompt,
  getCurrentVoiceSystemPrompt,
  saveCurrentImageSystemPrompt,
  getCurrentImageSystemPrompt,
  saveSystemPrompts,
  saveAllSystemPrompts,
  getSystemPrompts,
  getPromptId,
  savePromptId,
} from './PromptStorage.ts';

export {
  saveHapticEnabled,
  getHapticEnabled,
  saveOpenAIProxyEnabled,
  getOpenAIProxyEnabled,
  saveThinkingEnabled,
  getThinkingEnabled,
  saveReasoningExpanded,
  getReasoningExpanded,
  saveLastVirtualTryOnImgFile,
  getLastVirtualTryOnImgFile,
} from './PreferenceStorage.ts';

export {
  saveSearchProvider,
  getSearchProvider,
  saveGoogleLoginDone,
  isGoogleLoginDone,
  saveTavilyApiKey,
  getTavilyApiKey,
} from './SearchStorage.ts';

export type { AppMetadata } from './AppStorage.ts';
export {
  saveApp,
  getSavedApps,
  deleteApp,
  getAppById,
  pinApp,
  renameApp,
} from './AppStorage.ts';
