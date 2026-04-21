/**
 * JS Bridge script for WebView AI capabilities
 * Provides AI.chat(), AI.webSearch() and AI.repairJSON() API for HTML apps
 */

export const generateAIBridgeScript = (): string => `
<script>
(function() {
  var pendingRequests = {};
  var reqId = 0;
  window.AI = {
    chat: function(options, onStream) {
      return new Promise(function(resolve, reject) {
        var requestId = 'r' + (++reqId);
        pendingRequests[requestId] = { resolve: resolve, reject: reject, onStream: onStream };
        var payload = { type: 'chat', requestId: requestId, messages: options.messages };
        if (options.systemPrompt) payload.systemPrompt = options.systemPrompt;
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      });
    },
    webSearch: function(query, maxResults) {
      return new Promise(function(resolve, reject) {
        var requestId = 'r' + (++reqId);
        pendingRequests[requestId] = { resolve: resolve, reject: reject };
        var payload = { type: 'webSearch', requestId: requestId, query: query, maxResults: maxResults || 5 };
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      });
    },
    repairJSON: function(jsonString) {
      return new Promise(function(resolve) {
        var requestId = 'r' + (++reqId);
        pendingRequests[requestId] = { resolve: resolve };
        var payload = { type: 'repairJSON', requestId: requestId, jsonString: jsonString };
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      });
    }
  };
  window._onAIMessage = function(msg) {
    var req = pendingRequests[msg.id];
    if (!req) return;
    if (msg.type === 'chunk' && req.onStream) req.onStream(msg.text);
    else if (msg.type === 'done') {
      req.resolve(msg.text);
      delete pendingRequests[msg.id];
    } else if (msg.type === 'searchResults') {
      req.resolve(msg.results);
      delete pendingRequests[msg.id];
    } else if (msg.type === 'repairResult') {
      req.resolve(msg.result);
      delete pendingRequests[msg.id];
    } else if (msg.type === 'error') {
      req.reject(new Error(msg.error));
      delete pendingRequests[msg.id];
    }
  };
})();
</script>
`;
