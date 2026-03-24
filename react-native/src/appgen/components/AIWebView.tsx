/**
 * AIWebView - WebView component with AI capabilities
 * Provides AI.chat() API for HTML apps to call AI
 */

import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  injectErrorScript,
  commonWebViewProps,
} from '../../core/markdown/htmlUtils';
import { generateAIBridgeScript } from './WebViewBridge';
import { invokeBedrockWithCallBack } from '../../api/bedrock-api';
import { ChatMode } from '../../types/Chat';
import { BedrockMessage } from '../../api/BedrockMessageConvertor';
import { updateTotalUsage } from '../../storage/StorageUtils';
import { tavilyProvider } from '../../websearch/providers/TavilyProvider';
import { jsonrepair } from 'jsonrepair';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIWebViewProps {
  html: string;
  baseUrl?: string;
  style?: ViewStyle;
  scrollEnabled?: boolean;
  bounces?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onMessage?: (event: WebViewMessageEvent) => void;
  onLoadEnd?: () => void;
  onError?: () => void;
}

export interface AIWebViewRef {
  injectJavaScript: (script: string) => void;
}

const AIWebView = forwardRef<AIWebViewRef, AIWebViewProps>(
  ({ html, baseUrl, style, onMessage, ...props }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const controllersRef = useRef<Map<string, AbortController>>(new Map());

    useImperativeHandle(ref, () => ({
      injectJavaScript: (script: string) => {
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    // Send message to WebView
    const sendToWebView = useCallback((msg: object) => {
      webViewRef.current?.injectJavaScript(
        `window._onAIMessage(${JSON.stringify(msg)}); true;`
      );
    }, []);

    // Convert messages to Bedrock format
    const convertToBedrockMessages = useCallback(
      (messages: ChatMessage[]): BedrockMessage[] => {
        return messages.map(msg => ({
          role: msg.role,
          content: [{ text: msg.content }],
        }));
      },
      []
    );

    // Handle chat request
    const handleChat = useCallback(
      (requestId: string, messages: ChatMessage[], systemPrompt?: string) => {
        const controller = new AbortController();
        controllersRef.current.set(requestId, controller);

        const bedrockMessages = convertToBedrockMessages(messages);

        // Create SystemPrompt object if string provided
        const systemPromptObj = systemPrompt
          ? {
              id: 0,
              name: 'WebView',
              prompt: systemPrompt,
              includeHistory: true,
            }
          : null;

        // Track previous text length to calculate incremental chunks
        let prevLength = 0;

        invokeBedrockWithCallBack(
          bedrockMessages,
          ChatMode.Text,
          systemPromptObj,
          () => controller.signal.aborted,
          controller,
          (result, complete, _needStop, usage, _reasoning) => {
            if (!complete) {
              // Send only the new chunk (incremental)
              const chunk = result.slice(prevLength);
              prevLength = result.length;
              if (chunk) {
                sendToWebView({ type: 'chunk', id: requestId, text: chunk });
              }
            } else {
              sendToWebView({ type: 'done', id: requestId, text: result });
              controllersRef.current.delete(requestId);
              // Update total usage statistics
              if (usage) {
                updateTotalUsage(usage);
              }
            }
          }
        ).then();
      },
      [convertToBedrockMessages, sendToWebView]
    );

    // Handle web search request
    const handleWebSearch = useCallback(
      async (requestId: string, query: string, maxResults: number) => {
        const controller = new AbortController();
        controllersRef.current.set(requestId, controller);

        try {
          const results = await tavilyProvider.search(
            query,
            maxResults,
            controller
          );
          // Return only url, title, content fields
          const simplifiedResults = results.map(r => ({
            url: r.url,
            title: r.title,
            content: r.content,
          }));
          sendToWebView({
            type: 'searchResults',
            id: requestId,
            results: simplifiedResults,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Web search failed';
          sendToWebView({ type: 'error', id: requestId, error: errorMessage });
        } finally {
          controllersRef.current.delete(requestId);
        }
      },
      [sendToWebView]
    );

    // Handle JSON repair request
    const handleRepairJSON = useCallback(
      (requestId: string, jsonString: string) => {
        try {
          const result = jsonrepair(jsonString);
          sendToWebView({ type: 'repairResult', id: requestId, result });
        } catch {
          sendToWebView({ type: 'repairResult', id: requestId, result: '' });
        }
      },
      [sendToWebView]
    );

    // Handle WebView messages
    const handleMessage = useCallback(
      (event: WebViewMessageEvent) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);

          if (data.type === 'chat') {
            handleChat(data.requestId, data.messages, data.systemPrompt);
            return;
          }

          if (data.type === 'webSearch') {
            handleWebSearch(data.requestId, data.query, data.maxResults);
            return;
          }

          if (data.type === 'repairJSON') {
            handleRepairJSON(data.requestId, data.jsonString);
            return;
          }

          // Pass other messages to external handler
          onMessage?.(event);
        } catch {
          onMessage?.(event);
        }
      },
      [handleChat, handleWebSearch, handleRepairJSON, onMessage]
    );

    // Inject Bridge script into HTML
    const processedHtml = injectBridgeScript(html);

    const source = baseUrl
      ? { html: processedHtml, baseUrl }
      : { html: processedHtml };

    return (
      <WebView
        ref={webViewRef}
        source={source}
        style={style}
        {...commonWebViewProps}
        automaticallyAdjustsScrollIndicatorInsets={false}
        contentInsetAdjustmentBehavior="never"
        {...props}
        onMessage={handleMessage}
      />
    );
  }
);

/**
 * Inject AI Bridge script into HTML
 */
function injectBridgeScript(html: string): string {
  const bridgeScript = generateAIBridgeScript();
  const htmlWithError = injectErrorScript(html);

  if (htmlWithError.includes('</head>')) {
    return htmlWithError.replace('</head>', `${bridgeScript}</head>`);
  } else if (htmlWithError.includes('<head>')) {
    return htmlWithError.replace('<head>', `<head>${bridgeScript}`);
  } else if (htmlWithError.includes('<html>')) {
    return htmlWithError.replace(
      '<html>',
      `<html><head>${bridgeScript}</head>`
    );
  }
  return bridgeScript + htmlWithError;
}

export default AIWebView;
