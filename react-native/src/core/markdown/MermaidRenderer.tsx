import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  ViewStyle,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { ColorScheme, useTheme } from '../../theme';
import MermaidFullScreenViewer from './MermaidFullScreenViewer';

interface MermaidRendererProps {
  code: string;
  style?: ViewStyle;
}

interface MermaidRendererRef {
  updateContent: (newCode: string) => void;
}

/**
 * Validates and filters Gantt chart code lines.
 * For Gantt charts, checks the last line:
 * - If the last line doesn't start with a digit, removes it
 * - If the last line starts with a digit, must contain both colon and comma, and end with a digit
 * - Otherwise returns original code
 */
const validateGanttChartCode = (code: string): string => {
  const isGantt = code.startsWith('gantt');
  if (!isGantt) {
    return code;
  }

  const lines = code.split('\n');
  if (lines.length < 2) {
    return code;
  }

  const lastLine = lines[lines.length - 1];
  const trimmedLast = lastLine.trim();

  // If last line is empty, keep it
  if (trimmedLast === '') {
    return code;
  }

  // Check if last line starts with a digit
  if (/^\d/.test(trimmedLast)) {
    // Must contain both colon and comma, and end with a digit
    const hasColon = trimmedLast.includes(':');
    const hasComma = trimmedLast.includes(',');
    const endsWithDigit = /\d$/.test(trimmedLast);

    if (hasColon && hasComma && endsWithDigit) {
      return code; // Valid, return original code
    } else {
      // Invalid, remove last line
      return lines.slice(0, -1).join('\n');
    }
  } else {
    // Last line doesn't start with a digit, remove it
    return lines.slice(0, -1).join('\n');
  }
};

const MermaidRenderer = forwardRef<MermaidRendererRef, MermaidRendererProps>(
  ({ code, style }, ref) => {
    const validatedCode = useMemo(() => validateGanttChartCode(code), [code]);
    const [currentCode, setCurrentCode] = useState(validatedCode);
    const [showFullScreen, setShowFullScreen] = useState(false);
    const [hasError, setHasError] = useState(false);
    const webViewRef = useRef<WebView>(null);
    const initialCodeRef = useRef<string>(validatedCode);
    const { isDark, colors } = useTheme();
    const styles = createStyles(colors);

    const updateContent = useCallback(
      (newCode: string) => {
        const validatedNewCode = validateGanttChartCode(newCode);
        if (validatedNewCode === currentCode) {
          return;
        }
        if (webViewRef.current) {
          const escapedCode = validatedNewCode
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
          const jsCode = `
        (function() {
          try {
            const container = document.getElementById('mermaid-container');
            const displayContainer = document.getElementById('mermaid-display');
            if (!container || !displayContainer) return;

            const newCodeContent = \`${escapedCode}\`;

            // Store the new code in a hidden container
            container.textContent = newCodeContent;
            container.style.display = 'none';

            // Try to parse and validate
            window.mermaid.parse(newCodeContent, { suppressErrors: true })
              .then((result) => {
                if (result) {
                  // Valid syntax, try to render
                  return window.mermaid.render('mermaid-graph', newCodeContent);
                } else {
                  // Don't update display, schedule error notification after 1 second
                  if (window.notifyRN) {
                    window.notifyRN('update_rendered', { success: false }, 1000);
                  }
                  // Terminate the promise chain
                  return Promise.reject(new Error('Parse failed'));
                }
              })
              .then((result) => {
                // Rendering successful, update display
                if (result && result.svg) {
                  displayContainer.innerHTML = result.svg;
                  window.lastValidCode = newCodeContent;
                  if (window.notifyRN) {
                    // Cancel any pending error notifications and immediately notify success
                    window.notifyRN('update_rendered', { success: true }, 0);
                  }
                }
              })
              .catch((error) => {
                // Schedule error notification after 1 second
                if (window.notifyRN) {
                  window.notifyRN('update_rendered', { success: false, error: error.message }, 1000);
                }
              });
          } catch (error) {
            // Don't update display, schedule error notification after 1 second
            if (window.notifyRN) {
              window.notifyRN('update_rendered', { success: false, error: error.message }, 1000);
            }
          }
        })();
        true;
      `;

          webViewRef.current.injectJavaScript(jsCode);
        }

        setCurrentCode(validatedNewCode);
      },
      [currentCode]
    );

    useEffect(() => {
      if (code !== currentCode) {
        updateContent(code);
      }
    }, [code, currentCode, updateContent]);

    useImperativeHandle(
      ref,
      () => ({
        updateContent,
      }),
      [updateContent]
    );

    const htmlContent = useMemo(() => {
      return `
<!DOCTYPE html>
<html lang="">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: transparent;
        overflow: hidden;
        min-height: 360px;
      }
      .mermaid {
        text-align: center;
        width: 100%;
      }
      #mermaid-display {
        width: 100%;
        min-height: 360px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }
      #mermaid-display svg {
        width: 100% !important;
        height: auto !important;
        max-width: 100% !important;
        max-height: 360px;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="mermaid" id="mermaid-container" style="display: none;">
    ${initialCodeRef.current}
    </div>
    <div id="mermaid-display"></div>

    <script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

      mermaid.initialize({
        startOnLoad: true,
        theme: '${isDark ? 'dark' : 'default'}',
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        gantt: {
          axisFormat: '%m-%d',
          topAxis: false,
          displayMode: 'compact',
          useWidth: 800
        },
        xyChart: {
          titlePadding: 10,
          titleFontSize: 16,
          showTitle: true,
          xAxis: {
            labelFontSize: 12,
            labelPadding: 8,
            titleFontSize: 14,
            titlePadding: 12
          },
          yAxis: {
            labelFontSize: 12,
            labelPadding: 8,
            titleFontSize: 14,
            titlePadding: 20
          },
          plotReservedSpacePercent: 55
        }
      });

      window.mermaid = mermaid;
      window.lastValidCode = null;
      window.errorTimer = null;

      // Override console.log to send logs to React Native
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'console_log',
              message: args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ')
            }));
          }
        } catch (e) {
          originalLog('Failed to send log to RN:', e);
        }
      };

      window.notifyRN = function(type, data = {}, delay = 0) {
        // Clear any existing timer
        if (window.errorTimer) {
          clearTimeout(window.errorTimer);
          window.errorTimer = null;
        }

        const notify = () => {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: type,
                ...data
              }));
            }
          } catch (e) {
            console.log('Failed to notify RN:', e);
          }
        };

        if (delay > 0) {
          window.errorTimer = setTimeout(notify, delay);
        } else {
          notify();
        }
      };

      // Validate and render initial content
      const initialCode = document.getElementById('mermaid-container').textContent.trim();
      const displayContainer = document.getElementById('mermaid-display');

      if (initialCode && displayContainer) {
        mermaid.parse(initialCode, { suppressErrors: true })
          .then((result) => {
            if (result) {
              return mermaid.render('mermaid-graph', initialCode);
            } else {
              // Initial render: notify immediately without delay
              window.notifyRN('rendered', { success: false }, 1000);
              return Promise.reject(new Error('Parse failed'));
            }
          })
          .then((result) => {
            if (result && result.svg) {
              displayContainer.innerHTML = result.svg;
              window.lastValidCode = initialCode;
              window.notifyRN('rendered', { success: true }, 0);
            }
          })
          .catch((error) => {
            // Initial render: notify immediately without delay
            if (error.message !== 'Parse failed') {
              window.notifyRN('rendered', { success: false, error: error.message }, 1000);
            }
          });
      } else {
        // Initial render: notify immediately without delay
        window.notifyRN('rendered', { success: false, error: 'No initial code' }, 1000);
      }
    </script>
  </body>
</html>`;
    }, [isDark]);

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        // Handle console logs from WebView
        if (message.type === 'console_log') {
          console.log('[WebView]', message.message);
          return;
        }

        if (message.type === 'rendered' || message.type === 'update_rendered') {
          setHasError(!message.success);
        }
      } catch (error) {
        console.log('[WebView] Raw message:', event.nativeEvent.data);
      }
    }, []);

    return (
      <>
        <TouchableOpacity
          onPress={() => setShowFullScreen(true)}
          activeOpacity={0.8}
          style={styles.container}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={[styles.webView, style]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            allowFileAccessFromFileURLs={true}
            mixedContentMode="compatibility"
            originWhitelist={['*']}
            scalesPageToFit={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onMessage={handleMessage}
            scrollEnabled={false}
            pointerEvents="none"
          />

          {hasError && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>{'Invalid Mermaid syntax'}</Text>
            </View>
          )}
        </TouchableOpacity>

        <MermaidFullScreenViewer
          visible={showFullScreen}
          onClose={() => setShowFullScreen(false)}
          code={currentCode}
        />
      </>
    );
  }
);

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      position: 'relative' as const,
    },
    webView: {
      height: 380,
      backgroundColor: 'transparent' as const,
    },
    loadingContainer: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.input,
    },
    loadingText: {
      marginTop: 10,
      fontSize: 14,
      color: colors.text,
    },
  });

export default MermaidRenderer;
