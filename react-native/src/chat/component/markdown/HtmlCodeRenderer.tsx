import React, {
  useState,
  Suspense,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { ColorScheme } from '../../../theme';
import HtmlPreviewRenderer from './HtmlPreviewRenderer';
import { vs2015, github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Platform } from 'react-native';
import { useAppContext } from '../../../history/AppProvider';
import { getLatestHtmlCode, setLatestHtmlCode } from '../../util/DiffUtils';
import { applyDiff } from '../../util/ApplyDiff';
import { showInfo } from '../../util/ToastUtils';
import CopyButton from './CopyButton';

const CustomCodeHighlighter = React.lazy(
  () => import('./CustomCodeHighlighter')
);

interface HtmlCodeRendererProps {
  text: string;
  language?: string;
  colors: ColorScheme;
  isDark: boolean;
  onPreviewToggle?: (
    expanded: boolean,
    height: number,
    animated: boolean
  ) => void;
  isCompleted?: boolean;
  messageHtmlCode?: string;
  messageDiffCode?: string;
  isLastHtml?: boolean;
}

interface HtmlCodeRendererRef {
  updateContent: (newText: string) => void;
}

interface HtmlPreviewRendererRef {
  updateContent: (newCode: string) => void;
}

// Check if diff has at least one complete block (new @@@@ format)
const hasDiffBlock = (text: string): boolean => {
  // New format: @@@@ separator with - or + lines
  return text.includes('@@@@') && (/^[-+]/m.test(text) || /\n[-+]/m.test(text));
};

const HtmlCodeRenderer = forwardRef<HtmlCodeRendererRef, HtmlCodeRendererProps>(
  (
    {
      text,
      language,
      colors,
      isDark,
      onPreviewToggle,
      isCompleted,
      messageHtmlCode,
      messageDiffCode,
      isLastHtml,
    },
    ref
  ) => {
    const { sendEvent } = useAppContext();
    const isDiffModeRef = useRef(language === 'diff');
    const hasProcessedRef = useRef(
      Boolean(messageHtmlCode) || isCompleted === true
    );
    const hadMessageHtmlCodeRef = useRef(Boolean(messageHtmlCode));

    const [showPreview, setShowPreview] = useState(
      () =>
        Boolean(messageHtmlCode) ||
        (!isDiffModeRef.current && isCompleted === true)
    );
    const [currentText, setCurrentText] = useState(text);
    const [appliedHtmlCode, setAppliedHtmlCode] = useState<string | undefined>(
      undefined
    );
    const [hasLoadedCode, setHasLoadedCode] = useState(
      () => (!messageHtmlCode && !isCompleted) || Boolean(messageDiffCode)
    );
    const [webViewLoaded, setWebViewLoaded] = useState(false);
    const htmlRendererRef = useRef<HtmlPreviewRendererRef>(null);
    const codeHeightRef = useRef<number>(0);
    const previewHeightRef = useRef<number>(0);
    // Track pending scroll compensation when waiting for layout
    const pendingToggleRef = useRef<'code' | 'preview' | null>(null);
    const onPreviewToggleRef = useRef(onPreviewToggle);
    onPreviewToggleRef.current = onPreviewToggle;

    const styles = createStyles(colors);
    const hljsStyle = isDark ? vs2015 : github;
    const previewHtmlCode = appliedHtmlCode || messageHtmlCode || currentText;

    const updateContent = useCallback(
      (newText: string) => {
        setCurrentText(newText);
        if (showPreview && htmlRendererRef.current) {
          htmlRendererRef.current.updateContent(messageHtmlCode || newText);
        }
      },
      [showPreview, messageHtmlCode]
    );

    useImperativeHandle(
      ref,
      () => ({
        updateContent,
      }),
      [updateContent]
    );

    useEffect(() => {
      setCurrentText(text);
    }, [text]);

    useEffect(() => {
      if (hasProcessedRef.current || !isCompleted) {
        return;
      }

      if (isDiffModeRef.current) {
        if (hasDiffBlock(text)) {
          const currentHtmlCode = getLatestHtmlCode();
          if (currentHtmlCode) {
            const { success, result } = applyDiff(currentHtmlCode, text);
            if (success) {
              setLatestHtmlCode(result);
              setAppliedHtmlCode(result);
              setShowPreview(true);
              sendEvent('diffApplied', { htmlCode: result, diffCode: text });
            } else {
              sendEvent('diffApplied', { htmlCode: undefined, diffCode: text });
              showInfo('Diff apply failed, please regenerate');
            }
          }
        }
      } else {
        setLatestHtmlCode(text);
        sendEvent('htmlCodeGenerated', { htmlCode: text });
        setShowPreview(true);
      }
      hasProcessedRef.current = true;
    }, [isCompleted, text, sendEvent]);

    const prevMessageHtmlCodeRef = useRef(messageHtmlCode);
    useEffect(() => {
      if (
        messageHtmlCode &&
        messageHtmlCode !== prevMessageHtmlCodeRef.current
      ) {
        hadMessageHtmlCodeRef.current = true;
        setShowPreview(true);
      }
      prevMessageHtmlCodeRef.current = messageHtmlCode;
    }, [messageHtmlCode]);

    // Handle code container layout changes
    const handleCodeLayout = useCallback((event: LayoutChangeEvent) => {
      const newHeight = event.nativeEvent.layout.height;
      codeHeightRef.current = newHeight;
      // If we're waiting for code layout after switching to code mode
      if (pendingToggleRef.current === 'code' && previewHeightRef.current > 0) {
        pendingToggleRef.current = null;
        const heightDiff = newHeight - previewHeightRef.current;
        if (heightDiff !== 0) {
          onPreviewToggleRef.current?.(
            heightDiff > 0,
            Math.abs(heightDiff),
            true
          );
        }
      }
    }, []);

    // Handle preview container layout changes
    const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
      const newHeight = event.nativeEvent.layout.height;
      previewHeightRef.current = newHeight;
      // If we're waiting for preview layout after switching to preview mode
      if (pendingToggleRef.current === 'preview' && codeHeightRef.current > 0) {
        pendingToggleRef.current = null;
        const heightDiff = newHeight - codeHeightRef.current;
        if (heightDiff !== 0) {
          onPreviewToggleRef.current?.(
            heightDiff > 0,
            Math.abs(heightDiff),
            true
          );
        }
      }
    }, []);

    const setCodeMode = useCallback(() => {
      if (!showPreview) {
        return;
      }
      if (!hasLoadedCode) {
        setHasLoadedCode(true);
      }
      // If we have both heights cached, use them directly
      if (codeHeightRef.current > 0 && previewHeightRef.current > 0) {
        const prevPreviewHeight = previewHeightRef.current;
        setShowPreview(false);
        // Use setTimeout to fire after layout settles
        setTimeout(() => {
          const heightDiff = codeHeightRef.current - prevPreviewHeight;
          if (heightDiff !== 0) {
            onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), false);
          }
        }, 0);
      } else {
        // Code view may not be loaded yet (lazy/suspense), wait for onLayout
        pendingToggleRef.current = 'code';
        setShowPreview(false);
      }
    }, [showPreview, hasLoadedCode, onPreviewToggle]);

    const setPreviewMode = useCallback(() => {
      if (showPreview) {
        return;
      }
      // If we have both heights cached, use them directly
      if (codeHeightRef.current > 0 && previewHeightRef.current > 0) {
        const prevCodeHeight = codeHeightRef.current;
        setShowPreview(true);
        setTimeout(() => {
          const heightDiff = previewHeightRef.current - prevCodeHeight;
          if (heightDiff !== 0) {
            onPreviewToggle?.(heightDiff > 0, Math.abs(heightDiff), false);
          }
        }, 0);
      } else {
        // Preview may not have been measured yet, wait for onLayout
        pendingToggleRef.current = 'preview';
        setShowPreview(true);
      }
    }, [showPreview, onPreviewToggle]);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.leftSection}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                onPress={setCodeMode}
                style={[styles.tabButton, !showPreview && styles.activeTab]}>
                <Text
                  style={[
                    styles.tabText,
                    !showPreview && styles.activeTabText,
                  ]}>
                  {isDiffModeRef.current ? 'diff' : 'code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={setPreviewMode}
                style={[styles.tabButton, showPreview && styles.activeTab]}>
                <Text
                  style={[styles.tabText, showPreview && styles.activeTabText]}>
                  preview
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <CopyButton
            content={() =>
              showPreview || !isDiffModeRef.current
                ? previewHtmlCode
                : messageDiffCode || previewHtmlCode
            }
          />
        </View>

        {(!isCompleted || hasLoadedCode) && (
          <View
            onLayout={handleCodeLayout}
            style={showPreview && isCompleted ? styles.hidden : undefined}>
            <Suspense fallback={<Text style={styles.loading}>Loading...</Text>}>
              <CustomCodeHighlighter
                hljsStyle={hljsStyle}
                scrollViewProps={{
                  contentContainerStyle: {
                    padding: 12,
                    minWidth: '100%',
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    backgroundColor: colors.codeBackground,
                  },
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-expect-error
                  backgroundColor: colors.codeBackground,
                }}
                textStyle={styles.codeText}
                language={isDiffModeRef.current ? 'diff' : 'html'}
                isCompleted={isCompleted}>
                {isDiffModeRef.current
                  ? messageDiffCode || currentText
                  : messageHtmlCode || currentText}
              </CustomCodeHighlighter>
            </Suspense>
          </View>
        )}

        {/* Preview view: only render after completed */}
        {isCompleted && (
          <View
            onLayout={handlePreviewLayout}
            style={!showPreview ? styles.hidden : undefined}>
            {/* Show WebView for last html message or if user clicked to load */}
            {isLastHtml || webViewLoaded || !hadMessageHtmlCodeRef.current ? (
              <HtmlPreviewRenderer
                ref={htmlRendererRef}
                code={previewHtmlCode}
                style={styles.htmlRenderer}
              />
            ) : (
              <View style={styles.loadPreviewContainer}>
                <TouchableOpacity
                  style={styles.loadPreviewButton}
                  onPress={() => setWebViewLoaded(true)}>
                  <Text style={styles.loadPreviewText}>Show Preview</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }
);

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.input,
      marginVertical: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.borderLight,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.input,
      borderRadius: 6,
      padding: 2,
    },
    tabButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      marginHorizontal: 1,
    },
    activeTab: {
      backgroundColor: colors.text,
    },
    tabText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
      opacity: 0.6,
    },
    activeTabText: {
      color: colors.background,
      opacity: 1,
    },
    loading: {
      padding: 12,
      color: colors.text,
    },
    codeText: {
      fontSize: 14,
      paddingVertical: 1.3,
      fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
      color: colors.text,
    },
    htmlRenderer: {
      marginVertical: 0,
      minHeight: 100,
    },
    hidden: {
      position: 'absolute',
      opacity: 0,
      pointerEvents: 'none',
    },
    loadPreviewContainer: {
      height: 480,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.codeBackground,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    loadPreviewButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: colors.border,
    },
    loadPreviewText: {
      fontSize: 15,
      color: colors.text,
    },
  });

export default HtmlCodeRenderer;
