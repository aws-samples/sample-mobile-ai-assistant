import { type ReactNode, useMemo, useRef } from 'react';
import { lexer, type Tokenizer, type Token } from 'marked';
import type {
  MarkedStyles,
  UserTheme,
} from 'react-native-marked/src/theme/types';
import Renderer from 'react-native-marked/src/lib/Renderer';
import getStyles from 'react-native-marked/src/theme/styles';
import type { ColorSchemeName } from 'react-native';
import type { RendererInterface } from 'react-native-marked/src/lib/types';
import { ChatStatus } from '../../../types/Chat.ts';
import Parser from './Parser.tsx';

export interface useMarkdownHookOptions {
  colorScheme?: ColorSchemeName;
  renderer?: RendererInterface;
  theme?: UserTheme;
  styles?: MarkedStyles;
  baseUrl?: string;
  tokenizer?: Tokenizer;
  chatStatus?: ChatStatus;
}

const useMarkdown = (
  value: string,
  options?: useMarkdownHookOptions
): ReactNode[] => {
  const styles = useMemo(
    () => getStyles(options?.styles, options?.colorScheme, options?.theme),
    [options?.styles, options?.theme, options?.colorScheme]
  );

  const parser = useMemo(
    () =>
      new Parser({
        styles: styles,
        baseUrl: options?.baseUrl,
        renderer: options?.renderer ?? new Renderer(),
      }),
    [options?.renderer, options?.baseUrl, styles]
  );

  // Use useRef to store cache to prevent loss during re-renders
  const cacheRef = useRef<{
    lastValue: string;
    lastNewContent: string;
    cachedTokens: Token[];
    cachedElements: ReactNode[];
  }>({
    lastValue: '',
    lastNewContent: '',
    cachedTokens: [],
    cachedElements: [],
  });

  return useMemo(() => {
    // Early return for empty value
    if (!value) {
      return [];
    }

    // return the cached elements when no changes
    if (value === cacheRef.current.lastValue) {
      return cacheRef.current.cachedElements;
    }
    // If it's the first time, new answer, or rendering new session, parse directly
    if (
      cacheRef.current.lastValue.length === 0 ||
      cacheRef.current.lastValue === '![](bedrock://imgProgress)' ||
      value.length < cacheRef.current.lastValue.length ||
      options?.chatStatus === ChatStatus.Init
    ) {
      const tokens = lexer(value, {
        gfm: true,
        tokenizer: options?.tokenizer,
      });
      const elements = parser.parse(tokens);

      // Only update cache during streaming response
      if (options?.chatStatus === ChatStatus.Running && value !== '...') {
        cacheRef.current = {
          lastValue: value,
          lastNewContent: value,
          cachedTokens: tokens,
          cachedElements: elements,
        };
      }
      return elements;
    }

    // Get the streaming appended content
    const newContent = value.slice(cacheRef.current.lastValue.length);
    if (!newContent) {
      return cacheRef.current.cachedElements;
    }

    // Get the last token for combining
    const lastTokenIndex = cacheRef.current.cachedTokens.length - 1;
    const lastToken = cacheRef.current.cachedTokens[lastTokenIndex];

    // Combine the text of the last token with new text to get the latest content to parse
    let combinedText = lastToken.raw;
    if (lastToken.type === 'list') {
      const lastNewContent = cacheRef.current.lastNewContent;
      if (
        combinedText[combinedText.length - 1] === '\n' &&
        lastNewContent[lastNewContent.length - 1] === ' '
      ) {
        combinedText = combinedText.slice(0, -1) + ' ';
      }
    }
    combinedText += newContent;
    if (lastToken.type === 'space' && lastTokenIndex > 0) {
      combinedText =
        cacheRef.current.cachedTokens[lastTokenIndex - 1].raw + combinedText;
    }

    // Get new tokens
    const newTokens = lexer(combinedText, {
      gfm: true,
      tokenizer: options?.tokenizer,
    });

    // Parse new tokens into new Elements
    const newElements = parser.parse(newTokens);

    // Merge tokens: remove the last token from cache, add newly parsed tokens
    const mergedTokens = cacheRef.current.cachedTokens;
    if (mergedTokens.length > 0) {
      mergedTokens.splice(mergedTokens.length - 1, 1, ...newTokens);
    } else {
      mergedTokens.push(...newTokens);
    }

    // Merge new Elements into final Elements
    const mergedElements = cacheRef.current.cachedElements;
    if (mergedElements.length > 0) {
      mergedElements.splice(mergedElements.length - 1, 1, ...newElements);
    } else {
      mergedElements.push(...newElements);
    }
    // Update cache with new references
    cacheRef.current = {
      lastValue: value,
      lastNewContent: newContent,
      cachedTokens: mergedTokens,
      cachedElements: mergedElements,
    };
    return mergedElements;
  }, [value, parser, options?.tokenizer, options?.chatStatus]);
};

export default useMarkdown;
