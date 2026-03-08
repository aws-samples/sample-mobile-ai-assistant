/**
 * SearchWebView Component
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';
import { useAppContext } from '../../history/AppProvider';
import { webViewSearchService } from '../services/WebViewSearchService';

export const SearchWebView: React.FC = () => {
  const { colors } = useTheme();
  const { event, sendEvent } = useAppContext();
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const currentUrlRef = useRef<string>('');
  const [showWebView, setShowWebView] = useState<boolean>(false);
  const loadEndCalledRef = useRef<boolean>(false);
  const onWebViewLoadEndRef = useRef<(() => void) | null>(null);
  const onCaptchaClosedRef = useRef<(() => void) | null>(null);
  const sendEventRef = useRef(sendEvent);

  useEffect(() => {
    webViewSearchService.setSendEvent(sendEvent);
  }, [sendEvent]);

  // Register callbacks on mount
  useEffect(() => {
    onWebViewLoadEndRef.current = () => {
      sendEventRef.current('webview:loadEndTriggered');
    };

    onCaptchaClosedRef.current = () => {
      sendEventRef.current('webview:captchaClosed');
    };

    return () => {
      onWebViewLoadEndRef.current = null;
      onCaptchaClosedRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (event && event.event.startsWith('webview:')) {
      if (event.event === 'webview:message' && event.params?.data) {
        webViewSearchService.handleMessage(event.params.data);
      } else {
        webViewSearchService.handleEvent(event.event, event.params);
      }
    }
  }, [event]);

  useEffect(() => {
    if (!event) {
      return;
    }

    switch (event.event) {
      case 'webview:loadUrl':
        if (event.params?.url) {
          const newUrl = event.params.url;
          loadEndCalledRef.current = false;
          setShowWebView(false);

          if (currentUrlRef.current === newUrl) {
            if (onWebViewLoadEndRef.current) {
              onWebViewLoadEndRef.current();
            }
          } else {
            currentUrlRef.current = newUrl;
            setCurrentUrl(newUrl);
          }
        }
        break;

      case 'webview:injectScript':
        if (event.params?.script) {
          webViewRef.current?.injectJavaScript(event.params.script);
        }
        break;

      case 'webview:showCaptcha':
        console.log('[SearchWebView] Showing WebView for CAPTCHA verification');
        loadEndCalledRef.current = false;
        setShowWebView(true);
        break;

      case 'webview:hide':
        setShowWebView(false);
        break;
    }
  }, [event]);

  const handleLoadEnd = () => {
    if (!loadEndCalledRef.current && onWebViewLoadEndRef.current) {
      loadEndCalledRef.current = true;
      onWebViewLoadEndRef.current();
    }
  };

  const handleMessage = (data: string) => {
    sendEvent('webview:message', { data });
  };

  const handleError = (nativeEvent: { description?: string; code: number }) => {
    console.log('[SearchWebView] WebView error:', nativeEvent);

    const description = (nativeEvent.description || '').toLowerCase();
    const isFatalError =
      nativeEvent.code < 0 ||
      description.includes('redirect') ||
      description.includes('ssl') ||
      description.includes('cannot');

    if (isFatalError) {
      console.log('[SearchWebView] Fatal error detected, terminating search');
      console.log('[SearchWebView] Directly calling handleEvent with error');

      webViewSearchService.handleEvent('webview:error', {
        error: nativeEvent.description || 'WebView load failed',
        code: nativeEvent.code,
      });
    }
  };

  const handleClose = () => {
    setShowWebView(false);
    loadEndCalledRef.current = false;
    onWebViewLoadEndRef.current = null;
    if (onCaptchaClosedRef.current) {
      onCaptchaClosedRef.current();
      onCaptchaClosedRef.current = null;
    } else {
      console.log('[SearchWebView] WARNING: onCaptchaClosedRef is null!');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        containerBase: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        containerVisible: {
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          justifyContent: 'center',
          alignItems: 'center',
        },
        containerHidden: {
          left: -10000,
          width: 1,
          height: 1,
          backgroundColor: 'transparent',
          zIndex: -1,
          opacity: 0,
          pointerEvents: 'none',
        },
        modalContainer: {
          width: '90%',
          height: '80%',
          backgroundColor: colors.background,
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          backgroundColor: colors.border,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
        },
        closeButton: {
          padding: 8,
          borderRadius: 4,
          backgroundColor: colors.background,
        },
        closeButtonText: {
          fontSize: 16,
          color: colors.text,
        },
        webViewContainer: {
          flex: 1,
        },
        webViewStyle: {
          flex: 1,
        },
        hiddenWebView: {
          width: 800,
          height: 600,
        },
      }),
    [colors]
  );

  if (!currentUrl) {
    return null;
  }

  return (
    <View
      style={[
        styles.containerBase,
        showWebView ? styles.containerVisible : styles.containerHidden,
      ]}>
      {showWebView ? (
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Please Complete Verification</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.webViewContainer}>
            <WebView
              ref={webViewRef}
              source={{ uri: currentUrl }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              style={styles.webViewStyle}
              onMessage={messageEvent =>
                handleMessage(messageEvent.nativeEvent.data)
              }
              onLoadEnd={handleLoadEnd}
              onError={syntheticEvent =>
                handleError(syntheticEvent.nativeEvent)
              }
              userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            />
          </View>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          sharedCookiesEnabled={true}
          style={styles.hiddenWebView}
          onMessage={messageEvent =>
            handleMessage(messageEvent.nativeEvent.data)
          }
          onLoadEnd={handleLoadEnd}
          onError={syntheticEvent => handleError(syntheticEvent.nativeEvent)}
          userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        />
      )}
    </View>
  );
};
