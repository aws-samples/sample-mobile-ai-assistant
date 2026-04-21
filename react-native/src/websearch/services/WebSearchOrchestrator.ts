/**
 * Web Search Orchestrator
 * Orchestrates all phases of web search and encapsulates search logic
 */

import { SystemPrompt, Citation } from '../../types/Chat';
import { BedrockMessage } from '../../api/BedrockMessageConvertor';
import { SearchEngine, SearchEngineOption } from '../types';
import { intentAnalysisService } from './IntentAnalysisService';
import { webViewSearchService } from './WebViewSearchService';
import { contentFetchService } from './ContentFetchService';
import { promptBuilderService } from './PromptBuilderService';
import { getSearchProvider } from '../../storage/StorageUtils';
import { tavilyProvider } from '../providers/TavilyProvider';

/**
 * Web search phase enum
 */
export enum WebSearchPhase {
  ANALYZING = 'Analyzing search intent...',
  SEARCHING = 'Searching the web...',
  FETCHING = 'Fetching content...',
  BUILDING = 'Building enhanced prompt...',
}

/**
 * Web search result
 */
export interface WebSearchResult {
  systemPrompt: SystemPrompt | null;
  citations: Citation[];
}

/**
 * Web Search Orchestrator
 */
export class WebSearchOrchestrator {
  /**
   * Execute web search flow
   * @param userMessage User message
   * @param bedrockMessages Conversation history
   * @param onPhaseChange Phase change callback
   * @param searchEngine Optional search engine to use
   * @param abortController Optional abort controller to cancel the search
   * @returns Web search result with system prompt and citations, or null if search is not needed
   */
  async execute(
    userMessage: string,
    bedrockMessages: BedrockMessage[],
    onPhaseChange?: (phase: string) => void,
    searchEngine?: SearchEngine,
    abortController?: AbortController
  ): Promise<WebSearchResult | null> {
    try {
      const providerOption =
        searchEngine || (getSearchProvider() as SearchEngineOption);

      if (providerOption === 'disabled') {
        return null;
      }

      const engine = providerOption as SearchEngine;

      onPhaseChange?.(WebSearchPhase.ANALYZING);

      if (abortController?.signal.aborted) {
        return null;
      }

      const intentResult = await intentAnalysisService.analyze(
        userMessage,
        bedrockMessages,
        abortController
      );

      if (!intentResult.needsSearch || intentResult.keywords.length === 0) {
        return null;
      }

      onPhaseChange?.(WebSearchPhase.SEARCHING);
      const keyword = intentResult.keywords[0];

      if (abortController?.signal.aborted) {
        return null;
      }

      let contents;

      if (engine === 'tavily') {
        contents = await tavilyProvider.search(keyword, 5, abortController);
      } else {
        const searchResults = await webViewSearchService.search(
          keyword,
          engine,
          8,
          abortController
        );

        if (searchResults.length === 0) {
          return null;
        }

        if (abortController?.signal.aborted) {
          return null;
        }

        onPhaseChange?.(WebSearchPhase.FETCHING);

        contents = await contentFetchService.fetchContents(
          searchResults,
          8000,
          10000,
          abortController
        );
      }

      if (contents.length === 0) {
        return null;
      }

      onPhaseChange?.(WebSearchPhase.BUILDING);
      const enhancedPrompt = promptBuilderService.buildPromptWithReferences(
        userMessage,
        contents
      );

      const webSearchSystemPrompt: SystemPrompt = {
        id: -999,
        name: 'Web Search References',
        prompt: enhancedPrompt,
        includeHistory: true,
      };

      const citations: Citation[] = contents.map((content, index) => ({
        number: index + 1,
        title: content.title,
        url: content.url,
        excerpt: content.excerpt,
      }));

      return {
        systemPrompt: webSearchSystemPrompt,
        citations: citations,
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === 'Search aborted by user'
      ) {
        return null;
      }

      return null;
    }
  }
}

export const webSearchOrchestrator = new WebSearchOrchestrator();
