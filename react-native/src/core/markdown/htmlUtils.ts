/**
 * Shared utilities for HTML WebView rendering
 */

/**
 * Injects error handling script into HTML code
 * This script reports render success/failure back to React Native
 */
export const injectErrorScript = (htmlCode: string): string => {
  const errorHandlingScript = `
    <script>
      window.onerror = function(message, source, lineno, colno, error) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rendered',
            success: false,
            error: message
          }));
        }
        return false;
      };
      window.addEventListener('load', function() {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rendered',
            success: true
          }));
        }
      });
    </script>
    `;

  if (htmlCode.includes('</body>')) {
    return htmlCode.replace('</body>', `${errorHandlingScript}</body>`);
  } else if (htmlCode.includes('</html>')) {
    return htmlCode.replace('</html>', `${errorHandlingScript}</html>`);
  } else {
    return htmlCode + errorHandlingScript;
  }
};

/**
 * Common WebView props for HTML rendering
 */
export const commonWebViewProps = {
  javaScriptEnabled: true,
  domStorageEnabled: true,
  allowFileAccess: true,
  allowUniversalAccessFromFileURLs: true,
  allowFileAccessFromFileURLs: true,
  mixedContentMode: 'compatibility' as const,
  originWhitelist: ['*'],
  scalesPageToFit: false,
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
};
