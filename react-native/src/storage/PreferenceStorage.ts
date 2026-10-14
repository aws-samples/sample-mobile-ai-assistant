import { FileInfo } from '../types/Chat.ts';
import { storage } from './StorageUtils.ts';

const keyPrefix = 'bedrock/';
const hapticEnabledKey = keyPrefix + 'hapticEnabled';
const openAIProxyEnabledKey = keyPrefix + 'openAIProxyEnabledKey';
const thinkingEnabledKey = keyPrefix + 'thinkingEnabledKey';
const reasoningExpandedKey = keyPrefix + 'reasoningExpandedKey';
const reasoningEffortKey = keyPrefix + 'reasoningEffortKey';
const fastModeEnabledKey = keyPrefix + 'fastModeEnabledKey';
const lastVirtualTryOnImgFileTag = keyPrefix + 'lastVirtualTryOnImgFileTag';

let currentOpenAIProxyEnabled: boolean | undefined;
let currentThinkingEnabled: boolean | undefined;
let currentReasoningExpanded: boolean | undefined;
let currentReasoningEffort: string | undefined;
let currentFastModeEnabled: boolean | undefined;
let currentVirtualTryOnImgFile: FileInfo | undefined;

export function saveHapticEnabled(enabled: boolean) {
  storage.set(hapticEnabledKey, enabled);
}

export function getHapticEnabled() {
  return storage.getBoolean(hapticEnabledKey) ?? true;
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

// Reasoning effort tier for GPT-5.6 / GPT-6 (none/low/medium/high/xhigh/max).
export function saveReasoningEffort(effort: string) {
  currentReasoningEffort = effort;
  storage.set(reasoningEffortKey, effort);
}

export function getReasoningEffort(): string {
  if (currentReasoningEffort !== undefined) {
    return currentReasoningEffort;
  }
  currentReasoningEffort = storage.getString(reasoningEffortKey) ?? 'medium';
  return currentReasoningEffort;
}

// Fast mode (mantle "ultrafast" service tier) for models/regions that support it.
export function saveFastModeEnabled(enabled: boolean) {
  currentFastModeEnabled = enabled;
  storage.set(fastModeEnabledKey, enabled);
}

export function getFastModeEnabled(): boolean {
  if (currentFastModeEnabled !== undefined) {
    return currentFastModeEnabled;
  }
  currentFastModeEnabled = storage.getBoolean(fastModeEnabledKey) ?? false;
  return currentFastModeEnabled;
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
