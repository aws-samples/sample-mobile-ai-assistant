import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  StatusBar,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  PanGestureHandler,
  PinchGestureHandler,
  PanGestureHandlerGestureEvent,
  PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '../../theme';
import { isMac } from '../../App.tsx';

interface MermaidFullScreenViewerProps {
  visible: boolean;
  onClose: () => void;
  code: string;
}

const MermaidFullScreenViewer: React.FC<MermaidFullScreenViewerProps> = ({
  visible,
  onClose,
  code,
}) => {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [isLandscape, setIsLandscape] = useState(
    isMac ? false : screenData.width > screenData.height
  );

  // Animation values for pan and zoom
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
      setIsLandscape(isMac ? true : window.width > window.height);
    });

    return () => subscription?.remove();
  }, []);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Reset transforms when modal opens
  useEffect(() => {
    if (visible) {
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      baseScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      setHasError(false);
    }
  }, [
    visible,
    translateX,
    translateY,
    scale,
    baseScale,
    savedTranslateX,
    savedTranslateY,
  ]);

  const pinchHandler =
    useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
      onStart: () => {
        baseScale.value = scale.value;
      },
      onActive: event => {
        scale.value = Math.max(0.5, Math.min(baseScale.value * event.scale, 5));
      },
      onEnd: () => {
        if (scale.value < 1) {
          scale.value = withSpring(1);
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
        }
      },
    });

  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    },
    onActive: event => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    },
    onEnd: () => {
      // Only spring back to center if scale is 1 or less
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Save the final position for next pan
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const captureImageJS = useCallback(() => {
    return `
      (function() {
        try {
          const svg = document.querySelector('#mermaid-display svg');
          if (!svg) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'capture_error',
              message: 'No SVG found'
            }));
            return;
          }

          // Clone the SVG to avoid modifying the original
          const svgClone = svg.cloneNode(true);

          // Get the actual SVG dimensions from viewBox or computed values
          let svgWidth, svgHeight;
          const viewBox = svg.getAttribute('viewBox');

          if (viewBox) {
            // Use viewBox dimensions if available
            const [x, y, width, height] = viewBox.split(' ').map(Number);
            svgWidth = width;
            svgHeight = height;
            svgClone.setAttribute('width', width);
            svgClone.setAttribute('height', height);
          } else {
            // Fallback to intrinsic dimensions
            svgWidth = svg.scrollWidth || svg.clientWidth || parseFloat(svg.getAttribute('width')) || 800;
            svgHeight = svg.scrollHeight || svg.clientHeight || parseFloat(svg.getAttribute('height')) || 600;
            svgClone.setAttribute('width', svgWidth);
            svgClone.setAttribute('height', svgHeight);
          }

          // Ensure the SVG has proper styling for export
          svgClone.style.background = '${isDark ? '#1a1a1a' : '#ffffff'}';
          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

          // Serialize the complete SVG
          const svgData = new XMLSerializer().serializeToString(svgClone);

          // Create canvas with actual SVG dimensions at higher resolution
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const scale = 2; // Higher resolution multiplier

          canvas.width = svgWidth * scale;
          canvas.height = svgHeight * scale;

          const img = new Image();
          img.onload = function() {
            try {
              // Scale context for higher resolution
              ctx.scale(scale, scale);

              // Fill background
              ctx.fillStyle = '${isDark ? '#1a1a1a' : '#ffffff'}';
              ctx.fillRect(0, 0, svgWidth, svgHeight);

              // Draw the complete SVG
              ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

              const dataURL = canvas.toDataURL('image/png', 0.95);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'capture_success',
                data: dataURL
              }));
            } catch (error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'capture_error',
                message: 'Canvas operation failed: ' + error.message
              }));
            }
          };

          img.onerror = function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'capture_error',
              message: 'Failed to load image: ' + error
            }));
          };

          // Use Data URL instead of Blob URL to avoid security issues
          const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
          img.src = svgDataUrl;

        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'capture_error',
            message: error.message
          }));
        }
      })();
      true;
    `;
  }, [isDark]);

  const copyImage = useCallback(async () => {
    if (!webViewRef.current) {
      return;
    }

    try {
      const copyJS = captureImageJS().replace(
        "'capture_success'",
        "'copy_success'"
      );
      webViewRef.current.injectJavaScript(copyJS);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy image');
    }
  }, [captureImageJS]);

  const saveImage = useCallback(async () => {
    if (!webViewRef.current) {
      return;
    }

    try {
      const saveJS = captureImageJS().replace(
        "'capture_success'",
        "'save_success'"
      );
      webViewRef.current.injectJavaScript(saveJS);
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image');
    }
  }, [captureImageJS]);

  // Memoize the copy icon source to prevent flickering
  const copyIconSource = useMemo(() => {
    return copied
      ? isDark
        ? require('../../assets/done_dark.png')
        : require('../../assets/done.png')
      : require('../../assets/copy_grey.png');
  }, [copied, isDark]);

  const handleWebViewMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'copy_success') {
          const base64Data = message.data.replace(
            /^data:image\/png;base64,/,
            ''
          );
          // Copy image to clipboard (mac only)
          try {
            Clipboard.setImage(base64Data);
            setCopied(true);
          } catch (clipboardError) {
            console.log(
              '[MermaidFullScreenViewer] Clipboard error:',
              clipboardError
            );
            Alert.alert('Error', 'Failed to copy image to clipboard');
          }
        } else if (message.type === 'save_success') {
          const base64Data = message.data.replace(
            /^data:image\/png;base64,/,
            ''
          );
          const fileName = `mermaid_diagram_${Date.now()}.png`;

          // On Mac, save directly to Downloads folder
          if (isMac) {
            try {
              const downloadsPath = RNFS.DocumentDirectoryPath.replace(
                '/Documents',
                '/Downloads'
              );
              const filePath = `${downloadsPath}/${fileName}`;
              await RNFS.writeFile(filePath, base64Data, 'base64');
              Alert.alert(
                'Success',
                `Image saved to Downloads folder:\n${fileName}`
              );
            } catch (error) {
              console.log('[MermaidFullScreenViewer] Save error:', error);
              Alert.alert('Error', 'Failed to save image to Downloads folder');
            }
          } else {
            // On mobile platforms, use share sheet
            let filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, base64Data, 'base64');

            if (Platform.OS === 'android') {
              filePath = 'file://' + filePath;
            }

            const shareOptions = {
              url: filePath,
              type: 'image/png',
              title: 'Save Mermaid Diagram',
            };
            await Share.open(shareOptions);
          }
        } else if (message.type === 'capture_error') {
          Alert.alert('Error', `Failed to capture image: ${message.message}`);
        } else if (message.type === 'rendered') {
          setHasError(!message.success);
        }
      } catch (error) {
        console.log('[MermaidFullScreenViewer] Message parse error:', error);
      }
    },
    []
  );

  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html lang="">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=0.5, maximum-scale=5.0">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background-color: ${isDark ? '#1a1a1a' : '#ffffff'};
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .mermaid {
        text-align: center;
      }
      #mermaid-display {
        width: 100vw;
        height: ${isLandscape ? '100vh' : 'auto'};
        padding-top: ${isLandscape ? '25px' : '45px'};
        padding-bottom: ${isLandscape ? '45px' : '60px'};
        padding-left: ${isLandscape ? '60px' : '0px'};
        padding-right: ${isLandscape ? '60px' : '0px'};
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      svg {
        width: 100% !important;
        max-width: none;
        max-height: none;
        height: 100% !important;
        vector-effect: non-scaling-stroke;
        display: block; 
        margin: 0 auto;
      }
      .error-message {
        color: ${colors.text};
        font-size: 16px;
        text-align: center;
        padding: 20px;
        display: none;
      }
      .error-message.show {
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="mermaid" id="mermaid-container" style="display: none;">
      ${code}
    </div>
    <div id="mermaid-display"></div>
    <div id="error-message" class="error-message">Invalid Mermaid syntax</div>

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
          useWidth: 680
        },
        xyChart: {
          titlePadding: 10,
          titleFontSize: 18,
          showTitle: true,
          xAxis: {
            labelFontSize: 14,
            labelPadding: 10,
            titleFontSize: 16,
            titlePadding: 15
          },
          yAxis: {
            labelFontSize: 14,
            labelPadding: 20,
            titleFontSize: 16,
            titlePadding: 25
          },
          plotReservedSpacePercent: 55
        }
      });

      window.mermaid = mermaid;

      // Override console.log to send logs to React Native
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'log',
              message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
            }));
          }
        } catch (e) {
          originalLog('Failed to send log to RN:', e);
        }
      };

      // Function to hide error message
      function hideError() {
        document.getElementById('error-message').classList.remove('show');
        document.getElementById('mermaid-display').style.display = 'block';
      }

      // Function to show error message
      function showError() {
        document.getElementById('error-message').classList.add('show');
        document.getElementById('mermaid-display').style.display = 'none';
      }

      // Render the diagram
      const diagramCode = document.getElementById('mermaid-container').textContent.trim();
      const displayContainer = document.getElementById('mermaid-display');

      if (diagramCode && displayContainer) {
        mermaid.parse(diagramCode, { suppressErrors: true })
          .then((result) => {
            if (result) {
              return mermaid.render('mermaid-graph', diagramCode);
            } else {
              throw new Error('Invalid syntax');
            }
          })
          .then((result) => {
            displayContainer.innerHTML = result.svg;
            hideError();
            // Notify React Native that rendering is complete
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'rendered',
                success: true
              }));
            }
          })
          .catch((error) => {
            console.log('Mermaid render error:', error.message);
            showError();
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'rendered',
                success: false
              }));
            }
          });
      }
    </script>
  </body>
</html>`;
  }, [code, colors.text, isDark, isLandscape]);

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: isDark ? '#000000' : '#ffffff',
    },
    closeButtonTopLeft: {
      position: 'absolute',
      top:
        Platform.OS === 'ios'
          ? isLandscape
            ? 40
            : 60
          : (StatusBar.currentHeight || 20) + (isLandscape ? 10 : 20),
      left: isLandscape ? 40 : 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(50, 50, 50, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    closeButtonX: {
      fontSize: 20,
      fontWeight: '400',
      marginBottom: -2,
      color: '#ffffff',
      lineHeight: 20,
    },
    copyButtonBottomRight: {
      position: 'absolute',
      bottom: isLandscape ? 80 : 100,
      right: isLandscape ? 40 : 20,
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: 'rgba(50, 50, 50, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    saveButtonBottomRight: {
      position: 'absolute',
      bottom: isLandscape ? 20 : 40,
      right: isLandscape ? 40 : 20,
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: 'rgba(50, 50, 50, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    saveIcon: {
      width: 24,
      height: 24,
      tintColor: '#ffffff',
    },
    copyIcon: {
      width: 18,
      height: 18,
      tintColor: '#ffffff',
    },
    webViewContainer: {
      flex: 1,
      backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
    },
    webView: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)',
      zIndex: 998,
    },
    loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: colors.text,
    },
  });

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <View style={styles.modal}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent={true}
        />

        {/* Close button in top-left */}
        <TouchableOpacity style={styles.closeButtonTopLeft} onPress={onClose}>
          <Text style={styles.closeButtonX}>×</Text>
        </TouchableOpacity>

        {/* WebView with gesture handling */}
        <PanGestureHandler onGestureEvent={panHandler}>
          <Animated.View style={styles.webViewContainer}>
            <PinchGestureHandler onGestureEvent={pinchHandler}>
              <Animated.View style={[styles.webViewContainer, animatedStyle]}>
                <WebView
                  ref={webViewRef}
                  source={{ html: htmlContent }}
                  style={styles.webView}
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
                  onMessage={handleWebViewMessage}
                  scrollEnabled={true}
                  bounces={false}
                  decelerationRate="normal"
                />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>

        {/* Copy button in bottom-right (above save button) */}
        {isMac && (
          <TouchableOpacity
            activeOpacity={1}
            style={styles.copyButtonBottomRight}
            onPress={copyImage}>
            <Image source={copyIconSource} style={styles.copyIcon} />
          </TouchableOpacity>
        )}

        {/* Save button in bottom-right */}
        <TouchableOpacity
          style={styles.saveButtonBottomRight}
          onPress={saveImage}>
          <Image
            source={require('../../assets/download.png')}
            style={styles.saveIcon}
          />
        </TouchableOpacity>

        {/* Error overlay */}
        {hasError && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{'Invalid Mermaid syntax'}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default MermaidFullScreenViewer;
