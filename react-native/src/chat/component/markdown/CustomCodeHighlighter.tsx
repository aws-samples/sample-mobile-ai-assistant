import React, {
  type CSSProperties,
  type FunctionComponent,
  type ReactNode,
  useMemo,
  useCallback,
  memo,
  useRef,
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

// Memoized Text component to prevent unnecessary re-renders
const MemoizedText = memo(
  ({
    style,
    children,
  }: {
    style: StyleProp<TextStyle>;
    children: ReactNode;
  }) => <Text style={style}>{children}</Text>
);

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
    () => [textStyle, { color: stylesheet.hljs?.color }],
    [textStyle, stylesheet.hljs?.color]
  );

  // Cache of previously processed nodes (must be before conditional return for hooks rules)
  const processedNodesCache = useRef<ReactNode[][]>([]);
  const prevNodesLength = useRef<number>(0);

  // Process a single node into React elements
  const processNode = useCallback(
    (node: rendererNode, index: number): ReactNode[] => {
      const stack: rendererNode[] = [node];
      let result: ReactNode[] = [];

      while (stack.length > 0) {
        const currentNode = stack.pop()!;

        if (currentNode.type === 'text') {
          result.push(currentNode.value || '');
        } else if (currentNode.children) {
          const childElements = currentNode.children.map(
            (child, childIndex) => {
              if (child.type === 'text') {
                const nodeStyles = getStylesForNode(currentNode);
                return (
                  <MemoizedText
                    key={`${index}-${childIndex}`}
                    style={[...baseTextStyle, ...nodeStyles]}>
                    {child.value}
                  </MemoizedText>
                );
              } else {
                const childStyles = getStylesForNode(child);
                const childContent = child.children
                  ?.map(grandChild => grandChild.value)
                  .join('');

                return (
                  <MemoizedText
                    key={`${index}-${childIndex}`}
                    style={[...baseTextStyle, ...childStyles]}>
                    {childContent}
                  </MemoizedText>
                );
              }
            }
          );
          result = result.concat(childElements);
        }
      }
      return result;
    },
    [baseTextStyle, getStylesForNode]
  );

  const renderNode = useCallback(
    (nodes: rendererNode[]): ReactNode => {
      // Optimization for streaming content - only process new nodes
      if (nodes.length >= prevNodesLength.current) {
        // When initial render or nodes are added (streaming case)
        if (processedNodesCache.current.length === 0) {
          // First render - process all nodes
          processedNodesCache.current = nodes.map((node, index) =>
            processNode(node, index)
          );
        } else if (nodes.length > prevNodesLength.current) {
          // Streaming case - only process new nodes
          for (let i = prevNodesLength.current; i < nodes.length; i++) {
            processedNodesCache.current[i] = processNode(nodes[i], i);
          }
        }
        // If same length but content changed (rare in streaming), we'll keep the cache as is
      } else {
        // If nodes length decreased (rare case, not typical for streaming)
        processedNodesCache.current = nodes.map((node, index) =>
          processNode(node, index)
        );
      }

      // Update length reference for next render
      prevNodesLength.current = nodes.length;

      return (
        <TextInput
          editable={false}
          multiline>
          {processedNodesCache.current}
        </TextInput>
      );
    },
    [processNode]
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

export default CustomCodeHighlighter;
