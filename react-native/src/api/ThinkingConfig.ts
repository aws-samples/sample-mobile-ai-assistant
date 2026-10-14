import { DropdownItem, Model } from '../types/Chat.ts';
import {
  BedrockThinkingModels,
  DeepSeekThinkingModels,
} from '../storage/Constants.ts';
import {
  getFastModeEnabled,
  getReasoningEffort,
  getRegion,
  getTextModel,
  getThinkingEnabled,
  saveReasoningEffort,
  saveThinkingEnabled,
} from '../storage/StorageUtils.ts';
import { isMantleMode, stripRegionPrefix } from './providers/mantle-utils.ts';

// One "Thinking" dropdown for every model; the options depend on how the
// model controls reasoning: an effort tier (GPT-5.6 / GPT-6) or on/off
// (Claude, DeepSeek).

const ON_OFF_OPTIONS: DropdownItem[] = [
  { label: 'Off', value: 'off' },
  { label: 'On', value: 'on' },
];

// GPT-6 has no "none" tier: thinking can't be turned off, only lowered.
const EFFORT_OPTIONS: DropdownItem[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'X-High', value: 'xhigh' },
  { label: 'Max', value: 'max' },
];

const GPT56_EFFORT_OPTIONS: DropdownItem[] = [
  { label: 'None', value: 'none' },
  ...EFFORT_OPTIONS,
];

const DEFAULT_EFFORT = 'medium';

const isGpt56 = (modelId: string): boolean => modelId.includes('gpt-5.6');

// gpt-6-sol, gpt-6-astra, gpt-6.1-sol, ...
const isGpt6 = (modelId: string): boolean =>
  /gpt-6(\.\d+)?-/.test(modelId);

export const usesReasoningEffort = (modelId: string): boolean =>
  isGpt56(modelId) || isGpt6(modelId);

/** Thinking dropdown options for the model, or null if it has no control. */
export const getThinkingOptions = (model: Model): DropdownItem[] | null => {
  if (isGpt56(model.modelId)) {
    return GPT56_EFFORT_OPTIONS;
  }
  if (isGpt6(model.modelId)) {
    return EFFORT_OPTIONS;
  }
  if (
    BedrockThinkingModels.includes(model.modelName) ||
    DeepSeekThinkingModels.includes(model.modelName)
  ) {
    return ON_OFF_OPTIONS;
  }
  return null;
};

/** Effort tier to send for an effort-based model, valid for that model. */
export const getEffectiveReasoningEffort = (modelId: string): string => {
  const effort = getReasoningEffort();
  const options = isGpt56(modelId) ? GPT56_EFFORT_OPTIONS : EFFORT_OPTIONS;
  return options.some(option => option.value === effort)
    ? effort
    : DEFAULT_EFFORT;
};

export const getThinkingValue = (model: Model): string => {
  if (usesReasoningEffort(model.modelId)) {
    return getEffectiveReasoningEffort(model.modelId);
  }
  return getThinkingEnabled() ? 'on' : 'off';
};

export const saveThinkingValue = (model: Model, value: string) => {
  if (usesReasoningEffort(model.modelId)) {
    saveReasoningEffort(value);
  } else {
    saveThinkingEnabled(value === 'on');
  }
};

// Fast mode is the mantle "ultrafast" service tier, which Bedrock serves only
// for these models and regions (verified 2026-10).
const FAST_MODE_REGIONS: Record<string, string[]> = {
  'openai.gpt-6-astra': ['us-east-1'],
  'openai.gpt-6.1-sol': ['us-east-1'],
};

export const FAST_MODE_OPTIONS: DropdownItem[] = [
  { label: 'Standard', value: 'standard' },
  { label: 'Fast', value: 'fast' },
];

export const supportsFastMode = (model: Model, region: string): boolean =>
  isMantleMode(model.apiMode) &&
  (FAST_MODE_REGIONS[stripRegionPrefix(model.modelId)] ?? []).includes(
    region
  );

/** Whether the current request should use the "ultrafast" service tier. */
export const isFastModeActive = (): boolean =>
  getFastModeEnabled() && supportsFastMode(getTextModel(), getRegion());
