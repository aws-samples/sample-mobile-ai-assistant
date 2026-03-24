import { storage, encryptStorage } from './StorageUtils.ts';

const keyPrefix = 'bedrock/';
const searchProviderKey = keyPrefix + 'searchProviderKey';
const tavilyApiKeyTag = keyPrefix + 'tavilyApiKeyTag';
const googleLoginDoneKey = keyPrefix + 'googleLoginDoneKey';

let currentSearchProvider: string | undefined;
let currentTavilyApiKey: string | undefined;

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
