/**
 * Intent Analysis Service
 * Phase 1: Analyze user intent and extract search keywords
 */

import { BedrockMessage } from '../../api/BedrockMessageConvertor';
import { SearchIntentResult } from '../types';
import { invokeBedrockWithCallBack } from '../../api/bedrock-api';
import { ChatMode } from '../../types/Chat';
import { jsonrepair } from 'jsonrepair';
import { updateTotalUsage } from '../../storage/StorageUtils';

const INTENT_ANALYSIS_PROMPT = `You are an AI question rephraser. Your role is to rephrase follow-up queries from a conversation into a standalone search query that can be used to retrieve information through web search.

## Guidelines:
1. If the question is a simple writing task, greeting, or general conversation, set "need_search" to false
2. If the user asks about specific URLs, include them in the "links" array
3. Extract ONE most comprehensive and appropriate search keyword into the "question" field, and use the SAME LANGUAGE as the user's question
4. Combine all aspects of the question into a single, complete search query
5. ONLY respond with valid JSON format, no other text or markdown code blocks

## Output Format:
{
  "need_search": boolean,
  "question": string,
  "links": string[]
}

## Examples:

Input: "Hello, how are you?"
Output:
{
  "need_search": false,
  "question": "",
  "links": []
}

Input: "Write a story about a cat"
Output:
{
  "need_search": false,
  "question": "",
  "links": []
}

Input: "What's the weather in Tokyo today?"
Output:
{
  "need_search": true,
  "question": "Tokyo weather today",
  "links": []
}

Input: "今天北京天气怎么样？"
Output:
{
  "need_search": true,
  "question": "北京天气",
  "links": []
}

Input: "Which company had higher revenue in 2022, Amazon or Google?"
Output:
{
  "need_search": true,
  "question": "Amazon vs Google revenue comparison 2022",
  "links": []
}

Input: "Summarize this doc: https://example.com/doc"
Output:
{
  "need_search": true,
  "question": "",
  "links": ["https://example.com/doc"]
}

Now analyze this conversation and extract a search query if needed. Respond with ONLY valid JSON, no other text.`;

function extractInfoFromJSON(response: string): SearchIntentResult {
  try {
    const repairedJson = jsonrepair(response);
    const parsed = JSON.parse(repairedJson);

    const keyword =
      typeof parsed.question === 'string' && parsed.question.trim()
        ? parsed.question.trim()
        : '';

    const result: SearchIntentResult = {
      needsSearch: parsed.need_search === true,
      keywords: keyword ? [keyword] : [],
      links:
        Array.isArray(parsed.links) && parsed.links.length > 0
          ? parsed.links
          : undefined,
    };
    return result;
  } catch (error) {
    return {
      needsSearch: false,
      keywords: [],
    };
  }
}

export class IntentAnalysisService {
  async analyze(
    userMessage: string,
    conversationHistory: BedrockMessage[],
    abortController?: AbortController
  ): Promise<SearchIntentResult> {
    try {
      const messages: BedrockMessage[] = [
        {
          role: 'user',
          content: [
            {
              text: INTENT_ANALYSIS_PROMPT,
            },
            {
              text: `\n\n## Conversation History:\n${this.formatConversationHistory(
                conversationHistory
              )}`,
            },
            {
              text: `\n\n## Current User Question:\n${userMessage}`,
            },
          ],
        },
      ];

      const fullResponse = await this.invokeModelSync(
        messages,
        abortController
      );

      const result = extractInfoFromJSON(fullResponse);

      return result;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Search aborted by user'
      ) {
        return { needsSearch: false, keywords: [] };
      }
      return { needsSearch: false, keywords: [] };
    }
  }

  private invokeModelSync(
    messages: BedrockMessage[],
    abortController?: AbortController
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullResponse = '';
      const controller = abortController || new AbortController();

      if (abortController) {
        abortController.signal.addEventListener('abort', () => {
          controller.abort();
          reject(new Error('Search aborted by user'));
        });
      }

      invokeBedrockWithCallBack(
        messages,
        ChatMode.Text,
        null,
        () => abortController?.signal.aborted || false,
        controller,
        (text: string, complete: boolean, needStop: boolean, usage) => {
          fullResponse = text;

          if (complete || needStop) {
            if (needStop) {
              reject(new Error('Request stopped'));
            } else {
              // Update total usage statistics
              if (usage) {
                updateTotalUsage(usage);
              }
              resolve(fullResponse);
            }
          }
        }
      ).catch(reject);
    });
  }

  private formatConversationHistory(messages: BedrockMessage[]): string {
    if (messages.length === 0) {
      return 'No previous conversation';
    }

    const recentMessages = messages.slice(-6);

    return recentMessages
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        let text = '';

        if (Array.isArray(msg.content)) {
          text = msg.content
            .filter((c): c is { text: string } => 'text' in c)
            .map(c => c.text)
            .join(' ');
        } else if (typeof msg.content === 'string') {
          text = msg.content;
        }

        if (text.length > 200) {
          text = text.slice(0, 200) + '...';
        }

        return `${role}: ${text}`;
      })
      .join('\n');
  }
}

export const intentAnalysisService = new IntentAnalysisService();
