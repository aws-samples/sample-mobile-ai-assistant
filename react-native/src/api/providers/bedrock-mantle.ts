import { ApiMode, SystemPrompt, Usage } from '../../types/Chat.ts';
import {
  getBedrockApiKey,
  getBedrockConfigMode,
  getRegion,
  getTextModel,
  getThinkingEnabled,
} from '../../storage/StorageUtils.ts';
import { BedrockThinkingModels } from '../../storage/Constants.ts';
import {
  BedrockMessage,
  ImageContent,
  OpenAIMessage,
  TextContent,
} from '../BedrockMessageConvertor.ts';
import { getApiPrefix, getAuthHeaders, isDev } from '../bedrock-api.ts';
import { getMantleBaseUrl } from './mantle-utils.ts';
import type { ChatCallbackFunction } from '../types.ts';

const MAX_TOKENS = 64000;

const thinkingEnabledForModel = (): boolean =>
  BedrockThinkingModels.includes(getTextModel().modelName) &&
  getThinkingEnabled();

/**
 * Invokes a model on the bedrock-mantle engine. Supports the three mantle
 * protocols (OpenAI Responses, OpenAI Chat Completions, Anthropic Messages) and
 * both deployment modes:
 *   - 'bedrock'   : client signs with the Bedrock API Key (Bearer) and calls
 *                   the mantle endpoint directly.
 *   - 'swiftchat' : request is proxied through the SwiftChat Server, which signs
 *                   with its IAM role (SigV4) — no Bedrock key needed.
 */
export const invokeBedrockMantle = async (
  apiMode: ApiMode,
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: ChatCallbackFunction
): Promise<void> => {
  const isServerMode = getBedrockConfigMode() !== 'bedrock';
  const region = getRegion();
  const modelId = getTextModel().modelId;
  const body = buildRequestBody(apiMode, modelId, messages, prompt);

  const { url, options } = isServerMode
    ? buildServerRequest(apiMode, region, body, controller)
    : buildDirectRequest(apiMode, region, modelId, body, controller);

  let completeMessage = '';
  let completeReasoning = '';
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  let buffer = '';

  const emit = (done: boolean, needStop: boolean, usage?: Usage) =>
    callback(completeMessage, done, needStop, usage, completeReasoning);

  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    const respBody = response.body;
    if (!respBody) {
      callback('Request error: empty response', true, true);
      return;
    }
    const reader = respBody.getReader();
    const decoder = new TextDecoder();
    let appendTimes = 0;
    while (true) {
      if (shouldStop()) {
        await reader.cancel();
        if (completeMessage === '') {
          completeMessage = '...';
        }
        emit(true, true);
        return;
      }
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        const parsed = parseEvent(apiMode, event);
        if (!parsed) {
          continue;
        }
        if (parsed.error) {
          callback(
            completeMessage + '\n\n' + parsed.error,
            true,
            true,
            undefined,
            completeReasoning
          );
          return;
        }
        if (parsed.reasoning) {
          completeReasoning += parsed.reasoning;
          emit(false, false);
        }
        if (parsed.text) {
          completeMessage += parsed.text;
          appendTimes++;
          if (appendTimes > 500 && appendTimes % 2 === 0) {
            continue;
          }
          emit(false, false);
        }
        if (parsed.usage) {
          parsed.usage.modelName = getTextModel().modelName;
          emit(false, false, parsed.usage);
        }
      }
      if (done) {
        emit(true, false);
        return;
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (shouldStop()) {
      if (completeMessage === '') {
        completeMessage = '...';
      }
      emit(true, true);
      return;
    }
    let errorMsg = String(error);
    if (errorMsg.endsWith('AbortError: Aborted')) {
      errorMsg = 'Timed out';
    }
    callback(
      completeMessage + '\n\nRequest error: ' + errorMsg,
      true,
      true,
      undefined,
      completeReasoning
    );
  }
};

// ---- Request body builders -------------------------------------------------

const buildRequestBody = (
  apiMode: ApiMode,
  modelId: string,
  messages: BedrockMessage[],
  prompt: SystemPrompt | null
): Record<string, unknown> => {
  if (apiMode === ApiMode.MantleMessages) {
    const body: Record<string, unknown> = {
      model: modelId,
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: getAnthropicMessages(messages),
    };
    if (prompt) {
      body.system = prompt.prompt;
    }
    if (thinkingEnabledForModel()) {
      // Mantle Anthropic models use adaptive thinking; summarized so the
      // reasoning text streams to the UI instead of arriving empty.
      body.thinking = { type: 'adaptive', display: 'summarized' };
    }
    return body;
  }
  if (apiMode === ApiMode.MantleResponses) {
    const body: Record<string, unknown> = {
      model: modelId,
      input: getResponsesInput(messages, prompt),
      stream: true,
    };
    if (thinkingEnabledForModel()) {
      body.reasoning = { effort: 'medium', summary: 'auto' };
    }
    return body;
  }
  // MantleChatCompletions
  return {
    model: modelId,
    messages: getOpenAIMessages(messages, prompt),
    stream: true,
    stream_options: { include_usage: true },
  };
};

// ---- Transport builders ----------------------------------------------------

const directPath = (apiMode: ApiMode): string => {
  switch (apiMode) {
    case ApiMode.MantleResponses:
      return '/openai/v1/responses';
    case ApiMode.MantleChatCompletions:
      return '/openai/v1/chat/completions';
    default:
      return '/anthropic/v1/messages';
  }
};

const serverPath = (apiMode: ApiMode): string => {
  switch (apiMode) {
    case ApiMode.MantleResponses:
      return '/mantle/responses';
    case ApiMode.MantleChatCompletions:
      return '/mantle/chat';
    default:
      return '/mantle/messages';
  }
};

const buildDirectRequest = (
  apiMode: ApiMode,
  region: string,
  _modelId: string,
  body: Record<string, unknown>,
  controller: AbortController
) => {
  const headers: Record<string, string> = {
    accept: '*/*',
    'content-type': 'application/json',
    Authorization: 'Bearer ' + getBedrockApiKey(),
  };
  if (apiMode === ApiMode.MantleMessages) {
    headers['anthropic-version'] = '2023-06-01';
  }
  return {
    url: getMantleBaseUrl(region) + directPath(apiMode),
    options: {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      reactNative: { textStreaming: true },
    },
  };
};

const buildServerRequest = (
  apiMode: ApiMode,
  region: string,
  body: Record<string, unknown>,
  controller: AbortController
) => ({
  url:
    (isDev ? 'http://localhost:8080/api' : getApiPrefix()) +
    serverPath(apiMode),
  options: {
    method: 'POST',
    headers: getAuthHeaders('application/json'),
    body: JSON.stringify({ region, body }),
    signal: controller.signal,
    reactNative: { textStreaming: true },
  },
});

// ---- Stream parsers --------------------------------------------------------

type ParsedEvent = {
  text?: string;
  reasoning?: string;
  usage?: Usage;
  error?: string;
};

const parseEvent = (apiMode: ApiMode, event: string): ParsedEvent | null => {
  const dataLine = event
    .split('\n')
    .find(line => line.startsWith('data:'));
  if (!dataLine) {
    return null;
  }
  const payload = dataLine.slice(5).trim();
  if (!payload || payload === '[DONE]') {
    return null;
  }
  let json: MantleStreamEvent;
  try {
    json = JSON.parse(payload);
  } catch {
    return null;
  }
  if (apiMode === ApiMode.MantleResponses) {
    return parseResponsesEvent(json);
  }
  if (apiMode === ApiMode.MantleMessages) {
    return parseMessagesEvent(json);
  }
  return parseChatCompletionsEvent(json);
};

// Loose shape covering the union of fields across the three mantle SSE
// protocols; each parser reads only the fields relevant to its protocol.
type MantleTokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

type MantleStreamEvent = {
  type?: string;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
  } | string;
  message?: string;
  error?: { message?: string };
  response?: { usage?: MantleTokenUsage };
  usage?: MantleTokenUsage;
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
    };
  }>;
};

// OpenAI Responses API SSE events. Here `delta` is a plain string.
const parseResponsesEvent = (json: MantleStreamEvent): ParsedEvent | null => {
  const type = json.type;
  const delta = typeof json.delta === 'string' ? json.delta : '';
  if (type === 'response.output_text.delta') {
    return { text: delta };
  }
  if (type === 'response.reasoning_summary_text.delta') {
    return { reasoning: delta };
  }
  if (type === 'response.completed' || type === 'response.incomplete') {
    const u = json.response?.usage;
    if (u) {
      return {
        usage: {
          modelName: '',
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          totalTokens: u.total_tokens ?? 0,
        },
      };
    }
  }
  if (type === 'error' || json.error) {
    return { error: '**Error:** ' + (json.message ?? json.error?.message ?? '') };
  }
  return null;
};

// Anthropic Messages API SSE events. Here `delta` is an object.
const parseMessagesEvent = (json: MantleStreamEvent): ParsedEvent | null => {
  const type = json.type;
  if (type === 'content_block_delta') {
    const delta = typeof json.delta === 'object' ? json.delta : undefined;
    if (delta?.type === 'text_delta') {
      return { text: delta.text ?? '' };
    }
    if (delta?.type === 'thinking_delta') {
      return { reasoning: delta.thinking ?? '' };
    }
    return null;
  }
  if (type === 'message_delta' && json.usage) {
    return {
      usage: {
        modelName: '',
        inputTokens: json.usage.input_tokens ?? 0,
        outputTokens: json.usage.output_tokens ?? 0,
        totalTokens:
          (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
      },
    };
  }
  if (type === 'error') {
    return { error: '**Error:** ' + (json.error?.message ?? '') };
  }
  return null;
};

// OpenAI Chat Completions API SSE events.
const parseChatCompletionsEvent = (
  json: MantleStreamEvent
): ParsedEvent | null => {
  if (json.error) {
    return { error: '**Error:** ' + (json.error?.message ?? '') };
  }
  const result: ParsedEvent = {};
  const delta = json.choices?.[0]?.delta;
  if (delta?.content) {
    result.text = delta.content;
  }
  if (delta?.reasoning_content) {
    result.reasoning = delta.reasoning_content;
  } else if (delta?.reasoning) {
    result.reasoning = delta.reasoning;
  }
  if (json.usage) {
    result.usage = {
      modelName: '',
      inputTokens: json.usage.prompt_tokens ?? 0,
      outputTokens: json.usage.completion_tokens ?? 0,
      totalTokens: json.usage.total_tokens ?? 0,
    };
  }
  return result.text || result.reasoning || result.usage ? result : null;
};

// ---- Message converters ----------------------------------------------------

// Anthropic Messages: content is an array of {type:'text'|'image'} blocks.
const getAnthropicMessages = (messages: BedrockMessage[]) =>
  messages.map(message => ({
    role: message.role,
    content: message.content.map(content => {
      if ('text' in content) {
        return { type: 'text' as const, text: (content as TextContent).text };
      }
      const base64Data = (content as ImageContent).image.source.bytes;
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/png' as const,
          data: base64Data,
        },
      };
    }),
  }));

// OpenAI Responses: input is the same shape as Chat Completions messages.
const getResponsesInput = (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null
): OpenAIMessage[] => getOpenAIMessages(messages, prompt);

// OpenAI Chat Completions message shape (mirrors open-api.ts).
const getOpenAIMessages = (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null
): OpenAIMessage[] => [
  ...(prompt ? [{ role: 'system', content: prompt.prompt }] : []),
  ...messages.map(message => {
    const hasImage = message.content.some(content => 'image' in content);
    if (hasImage) {
      return {
        role: message.role,
        content: message.content.map(content => {
          if ('text' in content) {
            return {
              type: 'text' as const,
              text: (content as TextContent).text,
            };
          }
          const base64Data = (content as ImageContent).image.source.bytes;
          return {
            type: 'image_url' as const,
            image_url: { url: `data:image/png;base64,${base64Data}` },
          };
        }),
      };
    }
    return {
      role: message.role,
      content: message.content
        .map(content => (content as TextContent).text)
        .join('\n'),
    };
  }),
];
