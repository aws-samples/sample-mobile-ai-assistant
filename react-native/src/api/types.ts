import { Usage, SystemPrompt } from '../types/Chat.ts';
import { BedrockMessage } from './BedrockMessageConvertor.ts';

export type ChatCallbackFunction = (
  result: string,
  complete: boolean,
  needStop: boolean,
  usage?: Usage,
  reasoning?: string
) => void;

export interface ChatProvider {
  invoke(
    messages: BedrockMessage[],
    prompt: SystemPrompt | null,
    shouldStop: () => boolean,
    controller: AbortController,
    callback: ChatCallbackFunction
  ): Promise<void>;
}
