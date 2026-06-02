import { SystemPrompt } from '../types/Chat.ts';
import { storage } from './StorageUtils.ts';
import {
  DefaultImageSystemPrompts,
  DefaultVoiceSystemPrompts,
  InspectionPromptName,
  getDefaultSystemPrompts,
} from './Constants.ts';

const keyPrefix = 'bedrock/';
const systemPromptsKey = keyPrefix + 'systemPromptsKey';
const currentSystemPromptKey = keyPrefix + 'currentSystemPromptKey';
const currentVoiceSystemPromptKey = keyPrefix + 'currentVoiceSystemPromptKey';
const currentImageSystemPromptKey = keyPrefix + 'currentImageSystemPromptKey';
const currentPromptIdKey = keyPrefix + 'currentPromptIdKey';

let currentSystemPrompts: SystemPrompt[] | undefined;

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
        if (existingApp.prompt !== defaultAppPrompt.prompt) {
          currentSystemPrompts = currentSystemPrompts.map(p =>
            p.name === 'App' ? { ...defaultAppPrompt, id: p.id } : p
          );
          saveAllSystemPrompts(currentSystemPrompts);
        }
      } else {
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
    // Migration: Add FactoryInspect prompt if missing
    const hasInspect = currentSystemPrompts.some(
      p => p.name === InspectionPromptName
    );
    if (!hasInspect) {
      const defaultInspect = getDefaultSystemPrompts().find(
        p => p.name === InspectionPromptName
      );
      if (defaultInspect) {
        currentSystemPrompts = [...currentSystemPrompts, defaultInspect];
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
