import { ApiMode, Model } from '../../types/Chat.ts';
import {
  MantleMessagesModelIds,
  MantleResponsesModelIdPrefixes,
} from '../../storage/Constants.ts';

// Strips the cross-region inference profile prefix (us./eu./apac./global.) so
// a profile id like "us.anthropic.claude-fable-5" matches the same rules as the
// bare foundation-model id "anthropic.claude-fable-5". The mantle Messages route
// only accepts the bare id (unlike Converse, which requires the profile prefix).
export const stripRegionPrefix = (modelId: string): string =>
  modelId.replace(/^(us|eu|apac|global)\./, '');

/**
 * Determines which Bedrock API a model is invoked through. Mantle is the
 * preferred path for the models it serves; everything else falls back to the
 * legacy Converse API.
 */
export const resolveApiMode = (modelId: string): ApiMode => {
  const id = stripRegionPrefix(modelId).toLowerCase();
  if (MantleResponsesModelIdPrefixes.some(prefix => id.startsWith(prefix))) {
    return ApiMode.MantleResponses;
  }
  if (MantleMessagesModelIds.some(name => id.includes(name))) {
    return ApiMode.MantleMessages;
  }
  // Remaining OpenAI-compatible mantle models (gpt-oss, qwen, gemma, deepseek,
  // mistral, glm, …) are exposed by mantle's GET /v1/models and use Chat
  // Completions. They are tagged at list time via setApiModeFromMantleList.
  return ApiMode.Converse;
};

/**
 * Tags each Bedrock model with its apiMode. OpenAI-compatible model ids come
 * from the live mantle GET /v1/models list (region-specific); Anthropic models
 * and GPT-5.x are matched by id since mantle does not list them under OpenAI.
 */
export const tagModelsWithApiMode = (
  models: Model[],
  mantleOpenAiModelIds: Set<string>
): Model[] =>
  models.map(model => {
    const baseId = stripRegionPrefix(model.modelId).toLowerCase();
    let apiMode = resolveApiMode(model.modelId);
    if (apiMode === ApiMode.Converse && mantleOpenAiModelIds.has(baseId)) {
      apiMode = ApiMode.MantleChatCompletions;
    }
    return { ...model, apiMode };
  });

export const getMantleBaseUrl = (region: string): string =>
  `https://bedrock-mantle.${region}.api.aws`;

export const isMantleMode = (apiMode?: ApiMode): boolean =>
  apiMode === ApiMode.MantleResponses ||
  apiMode === ApiMode.MantleChatCompletions ||
  apiMode === ApiMode.MantleMessages;

// Friendly display names for GPT-5.x ids that the bedrock-runtime
// list_foundation_models call does not return (mantle-only models).
const GPT_DISPLAY_NAMES: Record<string, string> = {
  'openai.gpt-5.5': 'GPT-5.5',
  'openai.gpt-5.4': 'GPT-5.4',
};

/**
 * Builds the extra text models that exist only on mantle (GPT-5.x) from the
 * mantle GET /v1/models id set, plus the lower-cased id set used to tag
 * Chat-Completions models. Region-specific: the caller passes ids fetched for
 * the active region, so unavailable models simply never appear.
 */
export const buildMantleOnlyModels = (
  mantleModelIds: string[],
  bedrockTag: string
): { models: Model[]; openAiIdSet: Set<string> } => {
  const openAiIdSet = new Set(mantleModelIds.map(id => id.toLowerCase()));
  const models: Model[] = mantleModelIds
    .filter(id => /^openai\.gpt-5(\.\d+)?$/.test(id))
    .map(id => ({
      modelId: id,
      modelName: GPT_DISPLAY_NAMES[id] ?? id.replace('openai.', '').toUpperCase(),
      modelTag: bedrockTag,
      apiMode: ApiMode.MantleResponses,
    }));
  return { models, openAiIdSet };
};
