import React, { useCallback, useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteParamList } from '../types/RouteTypes';
import { HeaderLeftView } from '../prompt/HeaderLeftView';
import { useTheme, ColorScheme } from '../theme';
import { WebViewMessageEvent } from 'react-native-webview';
import AIWebView, { AIWebViewRef } from './AIWebView';
import RNFS from 'react-native-fs';
import { saveApp, generateAppId } from '../storage/StorageUtils';
import { SavedApp } from '../types/Chat';
import { injectErrorScript } from '../chat/component/markdown/htmlUtils';
import { isMac } from '../App';
import DocumentPicker from 'react-native-document-picker';

type NavigationProp = DrawerNavigationProp<RouteParamList>;

const MAX_NAME_LENGTH = 20;
const APP_SCREENSHOTS_DIR = `${RNFS.DocumentDirectoryPath}/app`;
const MAX_SCREENSHOT_RETRIES = 3;

// Check if content looks like HTML
const isHtmlContent = (content: string): boolean => {
  const trimmed = content.trim().toLowerCase();
  return (
    (trimmed.startsWith('<html') || trimmed.startsWith('<!doctype')) &&
    (trimmed.endsWith('</html>') || trimmed.includes('</html>'))
  );
};

function CreateAppScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors);

  const [appName, setAppName] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef<AIWebViewRef>(null);
  const screenshotRetryCount = useRef(0);

  const headerLeft = useCallback(
    () => HeaderLeftView(navigation, isDark),
    [navigation, isDark]
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft,
      title: 'Create App',
    });
  }, [navigation, headerLeft]);

  // Auto-detect HTML and switch to preview
  const handleCodeChange = useCallback(
    (text: string) => {
      setHtmlCode(text);
      const shouldShowPreview = isHtmlContent(text);
      setShowPreview(shouldShowPreview);
      if (shouldShowPreview) {
        setHasError(false);
        // Auto-fill app name from HTML <title> if name is empty
        if (!appName.trim()) {
          const match = text.match(/<title[^>]*>(.*?)<\/title>/i);
          if (match) {
            setAppName(match[1].trim().slice(0, MAX_NAME_LENGTH));
          }
        }
      }
    },
    [appName]
  );

  // Import file from document picker
  const handleImportFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText, 'text/html', 'public.html'],
      });
      const file = result[0];
      if (file.uri) {
        const filePath =
          Platform.OS === 'ios'
            ? decodeURIComponent(file.uri.replace('file://', ''))
            : file.uri;
        const content = await RNFS.readFile(filePath, 'utf8');
        handleCodeChange(content);

        // Auto-fill app name from file name (without extension)
        if (file.name) {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
          setAppName(nameWithoutExt.slice(0, MAX_NAME_LENGTH));
        }
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('Error picking file:', err);
        Alert.alert('Error', 'Failed to read file');
      }
    }
  }, [handleCodeChange]);

  const htmlContent = useMemo(
    () => (showPreview ? injectErrorScript(htmlCode) : ''),
    [htmlCode, showPreview]
  );

  // Ensure app directory exists
  const ensureAppDir = async () => {
    const exists = await RNFS.exists(APP_SCREENSHOTS_DIR);
    if (!exists) {
      await RNFS.mkdir(APP_SCREENSHOTS_DIR);
    }
  };

  // Capture screenshot using html2canvas
  const captureScreenshot = useCallback(() => {
    return `
      (function() {
        if (typeof html2canvas === 'undefined') {
          var script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = function() {
            captureNow();
          };
          script.onerror = function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_error',
              message: 'Failed to load html2canvas'
            }));
          };
          document.head.appendChild(script);
        } else {
          captureNow();
        }

        function captureNow() {
          var pixelRatio = window.devicePixelRatio || 1;
          var captureWidth = Math.min(document.body.scrollWidth || window.innerWidth, 800);
          var captureHeight = Math.min(document.body.scrollHeight || window.innerHeight, 800);

          html2canvas(document.body, {
            backgroundColor: null,
            useCORS: true,
            allowTaint: true,
            scale: Math.min(pixelRatio, 1),
            width: captureWidth,
            height: captureHeight,
            windowWidth: captureWidth,
            windowHeight: captureHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          }).then(function(canvas) {
            var dataURL = canvas.toDataURL('image/jpeg', 0.9);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_success',
              data: dataURL
            }));
          }).catch(function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_error',
              message: error.message || 'Screenshot failed'
            }));
          });
        }
      })();
      true;
    `;
  }, []);

  const handleScreenshotMessage = useCallback(
    async (data: string) => {
      try {
        await ensureAppDir();

        const appId = generateAppId();
        const base64Data = data.replace(/^data:image\/(png|jpeg);base64,/, '');
        const screenshotFileName = `${appId}.jpg`;
        const screenshotFullPath = `${APP_SCREENSHOTS_DIR}/${screenshotFileName}`;

        await RNFS.writeFile(screenshotFullPath, base64Data, 'base64');

        const storedPath =
          Platform.OS === 'android'
            ? `file://${screenshotFullPath}`
            : `app/${screenshotFileName}`;

        const app: SavedApp = {
          id: appId,
          name: appName.trim(),
          htmlCode: htmlCode,
          screenshotPath: storedPath,
          createdAt: Date.now(),
        };

        saveApp(app);

        setIsSaving(false);
        Alert.alert('Success', `App "${appName}" created successfully!`, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (error) {
        console.error('[CreateApp] Save error:', error);
        setIsSaving(false);
        Alert.alert('Error', 'Failed to save app');
      }
    },
    [appName, htmlCode, navigation]
  );

  // Retry screenshot capture
  const retryScreenshot = useCallback(() => {
    if (screenshotRetryCount.current < MAX_SCREENSHOT_RETRIES) {
      screenshotRetryCount.current += 1;
      console.log(
        `[CreateApp] Retrying screenshot (${screenshotRetryCount.current}/${MAX_SCREENSHOT_RETRIES})`
      );
      setTimeout(() => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(captureScreenshot());
        }
      }, 500);
      return true;
    }
    return false;
  }, [captureScreenshot]);

  const handleSaveWithoutScreenshot = useCallback(async () => {
    try {
      await ensureAppDir();

      const appId = generateAppId();

      const app: SavedApp = {
        id: appId,
        name: appName.trim(),
        htmlCode: htmlCode,
        screenshotPath: undefined,
        createdAt: Date.now(),
      };

      saveApp(app);

      setIsSaving(false);
      Alert.alert('Success', `App "${appName}" created (without preview)`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('[CreateApp] Save error:', error);
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save app');
    }
  }, [appName, htmlCode, navigation]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);

        if (message.type === 'console_error') {
          setHasError(true);
          return;
        }

        if (message.type === 'rendered' || message.type === 'update_rendered') {
          setHasError(!message.success);
        }

        if (message.type === 'screenshot_success') {
          screenshotRetryCount.current = 0;
          handleScreenshotMessage(message.data);
        }

        if (message.type === 'screenshot_error') {
          console.error('[CreateApp] Screenshot error:', message.message);
          // Try to retry, if max retries reached, save without screenshot
          if (!retryScreenshot()) {
            handleSaveWithoutScreenshot();
          }
        }
      } catch (error) {
        console.log('[CreateApp] Raw message:', event.nativeEvent.data);
      }
    },
    [handleScreenshotMessage, handleSaveWithoutScreenshot, retryScreenshot]
  );

  const handleCreate = useCallback(() => {
    if (!appName.trim()) {
      Alert.alert('Error', 'Please enter an app name');
      return;
    }
    if (appName.length > MAX_NAME_LENGTH) {
      Alert.alert(
        'Error',
        `App name must be ${MAX_NAME_LENGTH} characters or less`
      );
      return;
    }
    if (!htmlCode.trim()) {
      Alert.alert('Error', 'Please enter HTML code');
      return;
    }
    if (!isHtmlContent(htmlCode)) {
      Alert.alert('Error', 'Please enter valid HTML code with <html> tags');
      return;
    }

    setIsSaving(true);
    screenshotRetryCount.current = 0;

    // Capture screenshot
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(captureScreenshot());
    } else {
      handleSaveWithoutScreenshot();
    }
  }, [appName, htmlCode, captureScreenshot, handleSaveWithoutScreenshot]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.container}>
          {/* Name Input */}
          <TextInput
            style={[styles.input, isMac && styles.macInput]}
            placeholder="App name (max 20 chars)"
            placeholderTextColor={colors.placeholder}
            value={appName}
            onChangeText={text => setAppName(text.slice(0, MAX_NAME_LENGTH))}
            maxLength={MAX_NAME_LENGTH}
          />

          {/* HTML Code Input or Preview */}
          {!showPreview ? (
            <View style={styles.codeInputContainer}>
              <TouchableOpacity
                style={styles.importButton}
                onPress={handleImportFile}>
                <Image
                  source={
                    isDark
                      ? require('../assets/document_dark.png')
                      : require('../assets/document.png')
                  }
                  style={styles.importIcon}
                />
              </TouchableOpacity>
              <ScrollView
                style={styles.codeScrollView}
                horizontal
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.codeScrollContent}>
                <TextInput
                  style={[styles.codeInput, isMac && styles.macInput]}
                  placeholder="Paste HTML code here..."
                  placeholderTextColor={colors.placeholder}
                  value={htmlCode}
                  onChangeText={handleCodeChange}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled={true}
                />
              </ScrollView>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewTitle}>Preview</Text>
                <TouchableOpacity
                  onPress={() => setShowPreview(false)}
                  style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.webViewContainer}>
                <AIWebView
                  ref={webViewRef}
                  html={htmlContent}
                  style={styles.webView}
                  onMessage={handleMessage}
                  onError={() => setHasError(true)}
                  scrollEnabled={false}
                />
                {hasError && (
                  <View style={styles.errorOverlay}>
                    <Text style={styles.errorText}>Invalid HTML</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, isSaving && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={isSaving}>
            <Text style={styles.createButtonText}>
              {isSaving ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoid: {
      flex: 1,
    },
    container: {
      flex: 1,
      padding: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.promptScreenInputBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      backgroundColor: colors.inputBackground,
      color: colors.text,
      fontSize: 16,
    },
    codeInputContainer: {
      flex: 1,
      marginBottom: 16,
    },
    importButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 1,
      padding: 6,
      backgroundColor: colors.card,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    importIcon: {
      width: 18,
      height: 18,
      tintColor: colors.text,
    },
    codeScrollView: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.promptScreenInputBorder,
      borderRadius: 8,
      backgroundColor: colors.inputBackground,
    },
    codeScrollContent: {
      minWidth: '100%',
    },
    codeInput: {
      flex: 1,
      padding: 12,
      color: colors.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 14,
      minWidth: 800,
    },
    macInput: {
      fontWeight: '300',
    },
    previewContainer: {
      flex: 1,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
    },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    previewTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    editButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 6,
    },
    editButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    webViewContainer: {
      flex: 1,
      backgroundColor: '#ffffff',
    },
    webView: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    errorOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.input,
    },
    errorText: {
      fontSize: 14,
      color: colors.text,
    },
    createButton: {
      backgroundColor: colors.promptScreenSaveButton,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      color: colors.promptScreenSaveButtonText,
      fontSize: 16,
      fontWeight: '500',
    },
  });

export default CreateAppScreen;
