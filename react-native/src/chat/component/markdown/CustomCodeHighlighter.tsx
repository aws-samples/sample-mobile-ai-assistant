import React, {
  type CSSProperties,
  type FunctionComponent,
  type ReactNode,
  useMemo,
  useCallback,
} from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import SyntaxHighlighter, {
  type SyntaxHighlighterProps,
} from 'react-syntax-highlighter';
import transform, { StyleTuple } from 'css-to-react-native';
import { trimNewlines } from 'trim-newlines';
import ChunkedCodeView from './ChunkedCodeView';

type ReactStyle = Record<string, CSSProperties>;
type HighlighterStyleSheet = { [key: string]: TextStyle };

export interface CodeHighlighterProps extends SyntaxHighlighterProps {
  hljsStyle: ReactStyle;
  textStyle?: StyleProp<TextStyle>;
  scrollViewProps?: ScrollViewProps;
  /**
   * @deprecated Use scrollViewProps.contentContainerStyle instead
   */
  containerStyle?: StyleProp<ViewStyle>;
  /** Whether the content streaming is completed */
  isCompleted?: boolean;
}

const getRNStylesFromHljsStyle = (
  hljsStyle: ReactStyle
): HighlighterStyleSheet => {
  return Object.fromEntries(
    Object.entries(hljsStyle).map(([className, style]) => [
      className,
      cleanStyle(style),
    ])
  );
};

const cleanStyle = (style: CSSProperties) => {
  const styles = Object.entries(style)
    .filter(([key]) => ALLOWED_STYLE_PROPERTIES[key])
    .map<StyleTuple>(([key, value]) => [key, value]);

  return transform(styles);
};
const ALLOWED_STYLE_PROPERTIES: Record<string, boolean> = {
  color: true,
  background: true,
  backgroundColor: true,
  fontWeight: true,
  fontStyle: true,
};

export const CustomCodeHighlighter: FunctionComponent<CodeHighlighterProps> = ({
  children,
  textStyle,
  hljsStyle,
  scrollViewProps,
  containerStyle,
  isCompleted,
  ...rest
}) => {
  const stylesheet: HighlighterStyleSheet = useMemo(
    () => getRNStylesFromHljsStyle(hljsStyle),
    [hljsStyle]
  );

  const childrenString = String(children);

  const getStylesForNode = useCallback(
    (node: rendererNode): TextStyle[] => {
      const classes: string[] = node.properties?.className ?? [];
      return classes
        .map((c: string) => stylesheet[c])
        .filter(c => !!c) as TextStyle[];
    },
    [stylesheet]
  );

  // Calculate base text style once - used for both PlainTextCodeView and highlighted view
  const baseTextStyle = useMemo(
    () => [textStyle, {color: stylesheet.hljs?.color}],
    [textStyle, stylesheet.hljs?.color]
  );

  // Process a single line's children into Text elements
  const processLineChildren = useCallback(
    (lineChildren: rendererNode[] | undefined, lineIndex: number): ReactNode[] => {
      if (!lineChildren) return [];

      return lineChildren.map((child, childIndex) => {
        if (child.type === 'text') {
          // Plain text without styling (spaces, newlines, etc.)
          return child.value || '';
        }
        // Element with className - get its text content
        const childStyles = getStylesForNode(child);
        const textContent = child.children
          ?.map(grandChild => grandChild.value)
          .join('') ?? '';

        return (
          <Text key={`${lineIndex}-${childIndex}`} style={childStyles}>
            {textContent}
          </Text>
        );
      });
    },
    [getStylesForNode]
  );

  // Render all rows - each row wrapped in a Text component for line-based structure
  const renderNode = useCallback(
    (rows: rendererNode[]): ReactNode => {
      const lines = rows.map((row, lineIndex) => (
        <Text key={lineIndex} style={baseTextStyle}>
          {processLineChildren(row.children, lineIndex)}
        </Text>
      ));

      return (
        <TextInput
          editable={false}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          style={styles.codeTextInput}>
          {lines}
        </TextInput>
      );
    },
    [baseTextStyle, processLineChildren]
  );

  const renderAndroidNode = useCallback(
    (nodes: rendererNode[], keyPrefix = 'row') =>
      nodes.reduce<ReactNode[]>((acc, node, index) => {
        const keyPrefixWithIndex = `${keyPrefix}_${index}`;
        if (node.children) {
          const nodeStyles = StyleSheet.flatten([
            textStyle,
            { color: stylesheet.hljs?.color },
            getStylesForNode(node),
          ]);
          acc.push(
            <Text style={nodeStyles} key={keyPrefixWithIndex}>
              {renderAndroidNode(node.children, `${keyPrefixWithIndex}_child`)}
            </Text>
          );
        }

        if (node.value) {
          acc.push(trimNewlines(String(node.value)));
        }

        return acc;
      }, []),
    [textStyle, stylesheet, getStylesForNode]
  );

  const renderer = useCallback(
    (props: rendererProps) => {
      const { rows } = props;
      return (
        <ScrollView
          {...scrollViewProps}
          horizontal
          contentContainerStyle={[
            stylesheet.hljs,
            scrollViewProps?.contentContainerStyle,
            containerStyle,
          ]}>
          <View onStartShouldSetResponder={() => true}>
            {Platform.OS === 'ios' ? renderNode(rows) : renderAndroidNode(rows)}
          </View>
        </ScrollView>
      );
    },
    [stylesheet, scrollViewProps, containerStyle, renderNode, renderAndroidNode]
  );

  // Determine if we should show highlighting
  // HTML never gets highlighted; for others, use isCompleted prop
  const isHtml = rest.language === 'html';
  const shouldHighlight = isHtml ? false : isCompleted;

  // During streaming, render chunked plain text for performance
  if (!shouldHighlight) {
    return (
      <ChunkedCodeView
        code={childrenString}
        textStyle={baseTextStyle}
        backgroundColor={stylesheet.hljs?.backgroundColor as string}
        scrollViewProps={scrollViewProps}
        containerStyle={containerStyle}
        isCompleted={isCompleted}
      />
    );
  }

  return (
    <SyntaxHighlighter
      {...rest}
      renderer={renderer}
      CodeTag={View}
      PreTag={View}
      style={{}}
      testID="react-native-code-highlighter">
      {children}
    </SyntaxHighlighter>
  );
};

const styles = StyleSheet.create({
  codeTextInput: {
    lineHeight: 20,
    paddingBottom: 4,
  },
});

export default CustomCodeHighlighter;
