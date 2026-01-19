import React, { lazy, ReactElement, ReactNode, Suspense } from 'react';
import {
  Dimensions,
  ImageStyle,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import type { RendererInterface } from 'react-native-marked';
import { Renderer } from 'react-native-marked';
import { github, vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Cell, Table, TableWrapper } from 'react-native-table-component';
import RNFS from 'react-native-fs';
import MDSvg from 'react-native-marked/src/components/MDSvg.tsx';
import MDImage from 'react-native-marked/src/components/MDImage.tsx';
import ImageProgressBar from '../ImageProgressBar.tsx';
import { Citation, PressMode } from '../../../types/Chat.ts';
import MarkedList from '@jsamr/react-native-li';
import Decimal from '@jsamr/counter-style/lib/es/presets/decimal';
import Disc from '@jsamr/counter-style/lib/es/presets/disc';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import MathView from 'react-native-math-view';
import { isAndroid } from '../../../utils/PlatformUtils.ts';
import { ColorScheme } from '../../../theme';
import MermaidCodeRenderer from './MermaidCodeRenderer';
import HtmlCodeRenderer from './HtmlCodeRenderer';
import CitationBadge from '../CitationBadge';
import CopyButton from './CopyButton';

const CustomCodeHighlighter = lazy(() => import('./CustomCodeHighlighter'));
let mathViewIndex = 0;


function getMathKey() {
  mathViewIndex++;
  return 'math-' + mathViewIndex;
}

const MemoizedCodeHighlighter = React.memo(
  ({
    text,
    language,
    colors,
    isDark,
    onPreviewToggle,
    isCompleted,
    messageHtmlCode,
    messageDiffCode,
    isAppMode,
    isLastHtml,
  }: {
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
    isAppMode?: boolean;
    isLastHtml?: boolean;
  }) => {
    const styles = createCustomStyles(colors);
    // Use useRef to always capture the latest text value
    const textRef = React.useRef(text);
    textRef.current = text;

    const hljsStyle = isDark ? vs2015 : github;
    if (language === 'mermaid') {
      return (
        <MermaidCodeRenderer text={text} colors={colors} isDark={isDark} />
      );
    }

    // Show HtmlCodeRenderer for html and code diff
    if (language === 'html' || (isAppMode && language === 'diff')) {
      return (
        <HtmlCodeRenderer
          text={text}
          language={language}
          colors={colors}
          isDark={isDark}
          onPreviewToggle={onPreviewToggle}
          isCompleted={isCompleted}
          messageHtmlCode={messageHtmlCode}
          messageDiffCode={messageDiffCode}
          isLastHtml={isLastHtml}
        />
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {language === '' ? 'code' : language}
          </Text>
          <CopyButton content={() => textRef.current} />
        </View>
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
            textStyle={styles.text}
            language={language ?? 'code'}
            isCompleted={isCompleted}>
            {text}
          </CustomCodeHighlighter>
        </Suspense>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Mermaid diagrams need special handling - always re-render
    if (prevProps.language === 'mermaid' || nextProps.language === 'mermaid') {
      return false;
    }
    // Update when text/language/theme changes
    if (
      prevProps.text !== nextProps.text ||
      prevProps.language !== nextProps.language ||
      prevProps.colors !== nextProps.colors ||
      prevProps.isDark !== nextProps.isDark
    ) {
      return false;
    }
    // Update once when isCompleted becomes true
    if (!prevProps.isCompleted && nextProps.isCompleted) {
      return false;
    }
    // Update when messageHtmlCode changes (for preview switch)
    if (prevProps.messageHtmlCode !== nextProps.messageHtmlCode) {
      return false;
    }
    // Update when messageDiffCode changes (for diff history display)
    if (prevProps.messageDiffCode !== nextProps.messageDiffCode) {
      return false;
    }
    // Update when isAppMode changes
    if (prevProps.isAppMode !== nextProps.isAppMode) {
      return false;
    }
    // Update when isLastHtml changes
    if (prevProps.isLastHtml !== nextProps.isLastHtml) {
      return false;
    }
    return true;
  }
);

export class CustomMarkdownRenderer
  extends Renderer
  implements RendererInterface
{
  private width = Dimensions.get('window').width;
  private height = Dimensions.get('window').height;
  private colors: ColorScheme;
  private styles: ReturnType<typeof createCustomStyles>;
  private isDark: boolean;
  private citations: Citation[];
  private onPreviewToggle?: (
    expanded: boolean,
    height: number,
    animated: boolean
  ) => void;
  private messageHtmlCode?: string;
  private messageDiffCode?: string;
  private isAppMode?: boolean;
  private isLastHtml?: boolean;

  constructor(
    private onImagePress: (pressMode: PressMode, url: string) => void,
    colors: ColorScheme,
    isDark: boolean,
    citations: Citation[] = [],
    onPreviewToggle?: (
      expanded: boolean,
      height: number,
      animated: boolean
    ) => void,
    messageHtmlCode?: string,
    messageDiffCode?: string,
    isAppMode?: boolean,
    isLastHtml?: boolean
  ) {
    super();
    this.colors = colors;
    this.isDark = isDark;
    this.styles = createCustomStyles(colors);
    this.citations = citations;
    this.onPreviewToggle = onPreviewToggle;
    this.messageHtmlCode = messageHtmlCode;
    this.messageDiffCode = messageDiffCode;
    this.isAppMode = isAppMode;
    this.isLastHtml = isLastHtml;
  }

  getTextView(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    return (
      <Text selectable={!isAndroid} key={this.getKey()} style={styles}>
        {children}
      </Text>
    );
  }

  getNodeForTextArray(text: ReactNode[], styles?: TextStyle): ReactNode {
    if (text.length === 0) {
      return <></>;
    }
    if (text.length === 1) {
      return text[0];
    }
    return this.getTextView(text, styles);
  }

  // Parse citation marks [1], [2], [3] etc. and replace with CitationBadge components
  private parseCitationMarks(text: string): ReactNode[] {
    if (!this.citations || this.citations.length === 0) {
      return [text];
    }

    // Regular expression to match [number] pattern
    const citationRegex = /\[(\d+)\]/g;
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      const citationNumber = parseInt(match[1], 10);
      const citation = this.citations.find(c => c.number === citationNumber);

      // Add text before the citation mark
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add citation badge if we have a matching citation
      if (citation) {
        // Add space before citation badge
        parts.push(' ');
        parts.push(
          <CitationBadge
            key={`citation-${citationNumber}-${match.index}`}
            number={citationNumber}
            url={citation.url}
          />
        );
        // Add space after citation badge
      } else {
        // If no matching citation found, keep the original text
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last match
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  }

  codespan(text: string, styles?: TextStyle): ReactNode {
    return this.getTextView(text, {
      ...styles,
      ...this.styles.codeSpanText,
    });
  }

  text(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(text)) {
      return this.getNodeForTextArray(text, styles);
    }
    // Parse citation marks in the text
    const parsedContent = this.parseCitationMarks(text);
    if (parsedContent.length === 1 && typeof parsedContent[0] === 'string') {
      return this.getTextView(parsedContent[0], styles);
    }
    return this.getTextView(parsedContent, styles);
  }

  strong(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(children)) {
      return this.getNodeForTextArray(children, styles);
    }
    return this.getTextView(children, styles);
  }

  em(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(children)) {
      return this.getNodeForTextArray(children, styles);
    }
    return this.getTextView(children, styles);
  }

  br(): ReactNode {
    const text = '\n';
    return this.getTextView(text, {});
  }

  del(children: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(children)) {
      return this.getNodeForTextArray(children, styles);
    }
    return this.getTextView(children, styles);
  }

  heading(text: string | ReactNode[], styles?: TextStyle): ReactNode {
    if (Array.isArray(text)) {
      return this.getNodeForTextArray(text, styles);
    }
    return this.getTextView(text, styles);
  }

  escape(text: string, styles?: TextStyle): ReactNode {
    if (Array.isArray(text)) {
      return this.getNodeForTextArray(text, styles);
    }
    return this.getTextView(text, styles);
  }

  image(uri: string, alt?: string, style?: ImageStyle): ReactNode {
    const key = this.getKey();
    if (uri.startsWith('bedrock://imgProgress')) {
      return <ImageProgressBar key={key} />;
    }
    if (uri.endsWith('.svg')) {
      return <MDSvg uri={uri} key={key} />;
    }
    const imgUrl = uri.startsWith('http')
      ? uri
      : Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath + '/' + uri
      : uri;
    return (
      <TouchableOpacity
        style={this.styles.imageContainer}
        activeOpacity={0.8}
        onPress={() => this.onImagePress(PressMode.Click, imgUrl)}
        onLongPress={() => this.onImagePress(PressMode.LongPress, imgUrl)}
        key={key}>
        <MDImage
          key={key}
          uri={imgUrl}
          alt={alt}
          style={{ ...style, ...this.styles.imageStyle }}
        />
      </TouchableOpacity>
    );
  }

  code(
    text: string,
    language?: string,
    _containerStyle?: ViewStyle,
    _textStyle?: TextStyle,
    isCompleted?: boolean
  ): ReactNode {
    if (text && text !== '') {
      let componentKey = this.getKey();
      if (language === 'mermaid') {
        componentKey = 'mermaid-code-block';
      } else if (
        this.isAppMode &&
        (language === 'html' || language === 'diff')
      ) {
        componentKey = 'html-code-block';
      }
      return (
        <MemoizedCodeHighlighter
          key={componentKey}
          text={text}
          language={language}
          colors={this.colors}
          isDark={this.isDark}
          onPreviewToggle={this.onPreviewToggle}
          isCompleted={isCompleted}
          messageHtmlCode={this.messageHtmlCode}
          messageDiffCode={this.messageDiffCode}
          isAppMode={this.isAppMode}
          isLastHtml={this.isLastHtml}
        />
      );
    } else {
      return <></>;
    }
  }

  table(
    header: ReactNode[][],
    rows: ReactNode[][][],
    tableStyle?: ViewStyle,
    rowStyle?: ViewStyle,
    cellStyle?: ViewStyle
  ): React.ReactNode {
    const widthArr = getTableWidthArr(header.length, this.width, this.height);
    const { borderWidth, borderColor, ...tableStyleRest } = tableStyle || {};

    const headerTableStyle = {
      ...rowStyle,
      backgroundColor: this.colors.surface,
    };

    return (
      <ScrollView horizontal={true} style={this.styles.tableScroll}>
        <Table
          borderStyle={{
            borderWidth,
            borderColor: this.isDark ? this.colors.borderLight : borderColor,
          }}
          style={tableStyleRest}>
          <TableWrapper style={headerTableStyle}>
            {header.map((headerCol, index) => {
              if (React.isValidElement(headerCol[0])) {
                const element = headerCol[0] as ReactElement<TextProps>;
                const elementStyle =
                  (element.props as { style?: object })?.style || {};
                headerCol[0] = React.cloneElement(element, {
                  style: {
                    ...elementStyle,
                    fontWeight: '500',
                  },
                });
              }
              return (
                <Cell
                  width={widthArr[index]}
                  style={this.styles.cell}
                  key={`${index}`}
                  data={<View style={cellStyle}>{headerCol}</View>}
                />
              );
            })}
          </TableWrapper>
          {rows.map((rowData, index) => {
            return (
              <TableWrapper key={`${index}`} style={rowStyle}>
                {rowData.map((cellData, cellIndex) => {
                  return (
                    <Cell
                      width={widthArr[cellIndex]}
                      style={this.styles.cell}
                      key={`${cellIndex}`}
                      data={<View style={cellStyle}>{cellData}</View>}
                    />
                  );
                })}
              </TableWrapper>
            );
          })}
        </Table>
      </ScrollView>
    );
  }

  list(
    ordered: boolean,
    li: ReactNode[],
    listStyle?: ViewStyle,
    textStyle?: TextStyle,
    startIndex?: number
  ): ReactNode {
    return (
      <MarkedList
        counterRenderer={ordered ? Decimal : Disc}
        markerTextStyle={textStyle}
        markerBoxStyle={listStyle}
        lineStyle={this.styles.listLine}
        enableMarkerClipping={true}
        key={this.getKey()}
        startIndex={startIndex}>
        {li.map(node => node)}
      </MarkedList>
    );
  }

  custom(
    identifier: string,
    _raw: string,
    _children?: ReactNode[],
    args?: Record<string, unknown>
  ): ReactNode {
    if (identifier === 'latex') {
      const text = args?.text as string;
      const isDisplayMode = args?.displayMode as boolean;
      const mathView = (
        <MathView
          key={getMathKey()}
          math={text}
          renderError={() => this.getTextView(_raw, this.styles.text)}
          style={
            isDisplayMode
              ? this.styles.displayMathView
              : this.styles.inlineMathView
          }
        />
      );

      return (
        <View
          key={getMathKey()}
          style={
            isDisplayMode ? this.styles.displayMath : this.styles.inlineMath
          }>
          {isDisplayMode ? (
            <ScrollView
              key={getMathKey()}
              horizontal={true}
              showsHorizontalScrollIndicator={false}>
              {mathView}
            </ScrollView>
          ) : (
            mathView
          )}
        </View>
      );
    }
    return null;
  }
}

const getTableWidthArr = (
  totalCols: number,
  windowWidth: number,
  windowHeight: number
) => {
  if (totalCols < 1) {
    return [];
  }

  return Array(totalCols)
    .fill(0)
    .map(() => {
      if (windowHeight > windowWidth) {
        return Math.min(Math.floor((windowWidth - 64) * (1 / 2)), 170);
      } else {
        return Math.min(Math.floor((windowWidth - 182) * (1 / 5)), 170);
      }
    });
};

const createCustomStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    text: {
      fontSize: 12,
      paddingVertical: 1.3,
      fontFamily: Platform.OS === 'ios' ? 'Menlo-Regular' : 'monospace',
      color: colors.text,
    },
    codeSpanText: {
      fontStyle: 'normal',
      backgroundColor: colors.input,
      fontSize: 16,
      color: colors.text,
    },
    imageContainer: {
      marginVertical: 4,
      maxWidth: 400,
    },
    imageStyle: {
      borderRadius: 8,
    },
    container: {
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: colors.input,
      marginVertical: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.borderLight,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    headerText: {
      fontWeight: '500',
      paddingVertical: 8,
      paddingHorizontal: 12,
      color: colors.text,
    },
    copyButtonLayout: {
      padding: 10,
      marginLeft: 'auto',
    },
    copyButton: {
      width: 18,
      height: 18,
    },
    loading: {
      padding: 12,
      color: colors.text,
    },
    cell: {
      minHeight: 32,
    },
    displayMath: {
      alignItems: 'center',
      paddingVertical: 12,
      width: '100%',
    },
    inlineMath: {
      marginTop: Platform.OS === 'android' ? 0 : 2,
      maxHeight: 24,
    },
    displayMathView: {
      marginVertical: 0,
      alignSelf: 'center',
      color: colors.text,
    },
    tableScroll: {
      marginVertical: 4,
    },
    inlineMathView: {
      color: colors.text,
    },
    listLine: {
      alignItems: 'baseline',
    },
  });
