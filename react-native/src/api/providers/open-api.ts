import { ModelTag, SystemPrompt, Usage } from '../../types/Chat.ts';
import {
  getApiUrl,
  getDeepSeekApiKey,
  getOpenAIApiKey,
  getOpenAIProxyEnabled,
  getTextModel,
  getThinkingEnabled,
} from '../../storage/StorageUtils.ts';
import { DeepSeekThinkingModels } from '../../storage/Constants.ts';
import {
  BedrockMessage,
  ImageContent,
  OpenAIMessage,
  TextContent,
} from '../BedrockMessageConvertor.ts';
import { isDev } from '../bedrock-api.ts';
import { GITHUB_LINK } from '../../settings/SettingsScreen.tsx';

type CallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage,
  reasoning?: string
) => void;
const OpenRouterTag = ': OPENROUTER PROCESSING';

export const invokeOpenAIWithCallBack = async (
  messages: BedrockMessage[],
  prompt: SystemPrompt | null,
  shouldStop: () => boolean,
  controller: AbortController,
  callback: CallbackFunction
) => {
  const isOpenRouter = isOpenRouterRequest();
  const bodyObject: Record<string, unknown> = {
    model: getTextModel().modelId,
    messages: getOpenAIMessages(messages, prompt),
    stream: true,
    stream_options: {
      include_usage: true,
    },
  };
  if (DeepSeekThinkingModels.includes(getTextModel().modelName)) {
    bodyObject.thinking = {
      type: getThinkingEnabled() ? 'enabled' : 'disabled',
    };
  }

  const options = {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      Authorization: 'Bearer ' + getApiKey(),
    },
    body: JSON.stringify(bodyObject),
    signal: controller.signal,
    reactNative: { textStreaming: true },
  };
  const proxyRequestUrl = getProxyRequestURL();
  if (proxyRequestUrl.length > 0) {
    options.headers['request_url' as keyof typeof options.headers] =
      proxyRequestUrl;
  }
  if (isOpenRouter) {
    options.headers['HTTP-Referer' as keyof typeof options.headers] =
      GITHUB_LINK;
    options.headers['X-Title' as keyof typeof options.headers] = 'VifChat';
  }
  const url = getApiURL();
  let completeMessage = '';
  let completeReasoning = '';
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  fetch(url!, options)
    .then(response => {
      return response.body;
    })
    .then(async body => {
      clearTimeout(timeoutId);
      if (!body) {
        return;
      }
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let lastChunk = '';
      while (true) {
        if (shouldStop()) {
          await reader.cancel();
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true, undefined, completeReasoning);
          return;
        }

        try {
          const { done, value } = await reader.read();
          const chunk = decoder.decode(value, { stream: true });
          if (isOpenRouter && chunk === OpenRouterTag + '\n\n') {
            continue;
          }
          const parsed = parseStreamData(chunk, lastChunk);
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
          if (parsed.reason) {
            completeReasoning += parsed.reason;
          }
          if (parsed.content) {
            completeMessage += parsed.content;
          }
          if (parsed.dataChunk) {
            lastChunk = parsed.dataChunk;
          } else {
            lastChunk = '';
          }
          if (parsed.usage && parsed.usage.inputTokens) {
            callback(
              completeMessage,
              false,
              false,
              parsed.usage,
              completeReasoning
            );
          } else {
            callback(
              completeMessage,
              done,
              false,
              undefined,
              completeReasoning
            );
          }
          if (done) {
            if (lastChunk.length > 0) {
              callback(
                completeMessage + '\n\n' + '**Parse error**:\n' + lastChunk,
                true,
                true,
                undefined,
                completeReasoning
              );
            }
            return;
          }
        } catch (readError) {
          console.log('Error reading stream:', readError);
          if (completeMessage === '') {
            completeMessage = '...';
          }
          callback(completeMessage, true, true, undefined, completeReasoning);
          return;
        }
      }
    })
    .catch(error => {
      console.log(error);
      clearTimeout(timeoutId);
      if (shouldStop()) {
        if (completeMessage === '') {
          completeMessage = '...';
        }
        callback(completeMessage, true, true, undefined, completeReasoning);
      } else {
        const errorMsg = String(error);
        const errorInfo = 'Request error: ' + errorMsg;
        callback(
          completeMessage + '\n\n' + errorInfo,
          true,
          true,
          undefined,
          completeReasoning
        );
      }
    });
};

const parseStreamData = (chunk: string, lastChunk: string = '') => {
  const dataChunks = (lastChunk + chunk).split('\n\n');
  let content = '';
  let reason = '';
  let usage: Usage | undefined;
  for (let dataChunk of dataChunks) {
    if (!dataChunk.trim()) {
      continue;
    }
    if (dataChunk[0] === '\n') {
      dataChunk = dataChunk.slice(1);
    }
    const cleanedData = dataChunk.replace(/^data: /, '');
    if (cleanedData.trim() === '[DONE]') {
      continue;
    }
    if (cleanedData.trim() === OpenRouterTag) {
      continue;
    }

    try {
      const parsedData: ChatResponse = JSON.parse(cleanedData);
      if (parsedData.error) {
        let errorMessage = '**Error:** ' + (parsedData.error?.message ?? '');
        if (parsedData.error?.metadata?.raw) {
          errorMessage += ':\n' + parsedData.error.metadata.raw;
        }
        return { error: errorMessage };
      }
      if (parsedData.detail) {
        return {
          error:
            `Error: Please upgrade your [server API](${GITHUB_LINK}?tab=readme-ov-file#upgrade-api), API ` +
            parsedData.detail,
        };
      }
      if (parsedData.choices[0]?.delta?.content) {
        content += parsedData.choices[0].delta.content;
      }

      if (parsedData.choices[0]?.delta?.reasoning_content) {
        reason += parsedData.choices[0].delta.reasoning_content;
      }
      if (parsedData.choices[0]?.delta?.reasoning) {
        reason += parsedData.choices[0].delta.reasoning;
      }

      if (parsedData.usage) {
        usage = {
          modelName: getTextModel().modelName,
          inputTokens:
            parsedData.usage.prompt_tokens -
            (parsedData.usage.prompt_cache_hit_tokens ?? 0),
          outputTokens: parsedData.usage.completion_tokens,
          totalTokens: parsedData.usage.total_tokens,
        };
      }
    } catch (error) {
      if (dataChunk === dataChunks[dataChunks.length - 1]) {
        return { reason, content, dataChunk, usage };
      } else {
        return { error: chunk };
      }
    }
  }
  return { reason, content, usage };
};

type ChatResponse = {
  choices: Array<{
    delta: {
      content: string;
      reasoning_content: string;
      reasoning: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens: number;
  };
  error?: {
    message?: string;
    metadata?: {
      raw?: string;
    };
  };
  detail?: string;
};

function getOpenAIMessages(
  messages: BedrockMessage[],
  prompt: SystemPrompt | null
): OpenAIMessage[] {
  return [
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
            } else {
              const base64Data = (content as ImageContent).image.source.bytes;
              return {
                type: 'image_url' as const,
                image_url: {
                  url: `data:image/png;base64,${base64Data}`,
                },
              };
            }
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
}

function getApiKey(): string {
  if (getTextModel().modelTag === ModelTag.OpenAICompatible) {
    return getTextModel().apiKey ?? '';
  } else if (getTextModel().modelId.includes('deepseek')) {
    return getDeepSeekApiKey();
  } else {
    return getOpenAIApiKey();
  }
}

function isOpenRouterRequest(): boolean {
  if (getTextModel().modelTag === ModelTag.OpenAICompatible) {
    return getTextModel().apiUrl!.startsWith('https://openrouter.ai/api');
  }
  return false;
}

function getProxyRequestURL(): string {
  if (getTextModel().modelTag === ModelTag.OpenAICompatible) {
    return getTextModel().apiUrl! + '/chat/completions';
  } else if (getTextModel().modelId.includes('deepseek')) {
    return '';
  } else {
    return 'https://api.openai.com/v1/chat/completions';
  }
}

function getApiURL(): string {
  if (getTextModel().modelTag === ModelTag.OpenAICompatible) {
    if (getOpenAIProxyEnabled()) {
      return (isDev ? 'http://localhost:8080' : getApiUrl()) + '/api/openai';
    } else {
      return getTextModel().apiUrl! + '/chat/completions';
    }
  } else if (getTextModel().modelId.includes('deepseek')) {
    return 'https://api.deepseek.com/chat/completions';
  } else {
    if (getOpenAIProxyEnabled()) {
      return (isDev ? 'http://localhost:8080' : getApiUrl()) + '/api/openai';
    } else {
      return 'https://api.openai.com/v1/chat/completions';
    }
  }
}
