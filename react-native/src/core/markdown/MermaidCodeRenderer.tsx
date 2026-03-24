import React, {
  useState,
  Suspense,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ColorScheme } from '../../theme';
import MermaidRenderer from './MermaidRenderer';
import CopyButton from './CopyButton';
import { vs2015, github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Platform } from 'react-native';
import { useAppContext } from '../../history/AppProvider.tsx';

const CustomCodeHighlighter = React.lazy(
  () => import('./CustomCodeHighlighter')
);

interface MermaidCodeRendererProps {
  text: string;
  colors: ColorScheme;
  isDark: boolean;
}

interface MermaidCodeRendererRef {
  updateContent: (newText: string) => void;
}

interface MermaidRendererRef {
  updateContent: (newCode: string) => void;
}

const MermaidCodeRenderer = forwardRef<
  MermaidCodeRendererRef,
  MermaidCodeRendererProps
>(({ text, colors, isDark }, ref) => {
  const [showCode, setShowCode] = useState(false);
  const [showNewMermaid, setShowNewMermaid] = useState(false);
  const [currentText, setCurrentText] = useState(text);
  const { event } = useAppContext();
  const mermaidRendererRef = useRef<MermaidRendererRef>(null);
  const styles = createStyles(colors);
  const hljsStyle = isDark ? vs2015 : github;

  const updateContent = useCallback(
    (newText: string) => {
      setCurrentText(newText);
      if (!showCode && mermaidRendererRef.current) {
        mermaidRendererRef.current.updateContent(newText);
      }
    },
    [showCode]
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

  const setMermaidMode = () => {
    setShowCode(false);
  };

  const setCodeMode = () => {
    setShowCode(true);
  };

  // Listen for refresh event from ChatScreen and update key to remount WebView
  useEffect(() => {
    if (event?.event === 'refreshMermaid') {
      setShowNewMermaid(true);
    }
  }, [event]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.leftSection}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={setMermaidMode}
              style={[styles.tabButton, !showCode && styles.activeTab]}>
              <Text style={[styles.tabText, !showCode && styles.activeTabText]}>
                mermaid
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={setCodeMode}
              style={[styles.tabButton, showCode && styles.activeTab]}>
              <Text style={[styles.tabText, showCode && styles.activeTabText]}>
                code
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <CopyButton content={currentText} />
      </View>

      {showCode ? (
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
            language="mermaid">
            {currentText}
          </CustomCodeHighlighter>
        </Suspense>
      ) : (
        <MermaidRenderer
          ref={mermaidRendererRef}
          code={showNewMermaid ? currentText : currentText + ' '}
          style={styles.mermaidRenderer}
        />
      )}
    </View>
  );
});

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
    mermaidRenderer: {
      marginVertical: 0,
      minHeight: 100,
    },
  });

export default MermaidCodeRenderer;
