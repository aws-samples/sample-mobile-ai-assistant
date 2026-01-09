import type { ReactNode } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { Token, Tokens } from 'marked';
import { decode } from 'html-entities';
import type { MarkedStyles } from 'react-native-marked/src/theme/types';
import type {
  ParserOptions,
  RendererInterface,
} from 'react-native-marked/src/lib/types';
import { getValidURL } from 'react-native-marked/src/utils/url';
import { getTableColAlignmentStyle } from 'react-native-marked/src/utils/table';

// Custom token type for LaTeX support
interface CustomToken {
  type: 'custom';
  raw: string;
  identifier: string;
  tokens?: Token[];
  args?: Record<string, unknown>;
}

// Extended renderer interface with isCompleted parameter for code blocks and custom tokens
interface ExtendedRendererInterface extends RendererInterface {
  code(
    text: string,
    language?: string,
    containerStyle?: ViewStyle,
    textStyle?: TextStyle,
    isCompleted?: boolean
  ): ReactNode;
  custom(
    identifier: string,
    raw: string,
    children?: ReactNode[],
    args?: Record<string, unknown>
  ): ReactNode;
}

class Parser {
  private renderer: ExtendedRendererInterface;
  private styles: MarkedStyles;
  private readonly headingStylesMap: Record<number, TextStyle | undefined>;
  private readonly baseUrl: string;

  constructor(options: ParserOptions) {
    this.styles = { ...options.styles };
    this.baseUrl = options.baseUrl ?? '';
    this.renderer = options.renderer as ExtendedRendererInterface;
    this.headingStylesMap = {
      1: this.styles.h1,
      2: this.styles.h2,
      3: this.styles.h3,
      4: this.styles.h4,
      5: this.styles.h5,
      6: this.styles.h6,
    };
  }

  parse(tokens?: Token[]) {
    return this._parse(tokens);
  }

  private _parse(
    tokens?: Token[],
    styles?: ViewStyle | TextStyle | ImageStyle
  ): ReactNode[] {
    if (!tokens) {
      return [];
    }

    const elements: ReactNode[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Handle custom LaTeX tokens
      if (
        i + 1 < tokens.length &&
        tokens[i + 1].type === 'custom' &&
        token.type === 'text'
      ) {
        if (
          /^ +$/.test(token.raw) &&
          (tokens[i + 1] as unknown as CustomToken)?.args?.displayMode === true
        ) {
          // for empty string continue
          continue;
        }
      }
      if (i > 0 && token.type === 'custom' && tokens[i - 1].type === 'text') {
        if (
          tokens[i - 1].raw.trim() !== '' &&
          !tokens[i - 1].raw.endsWith('\n') &&
          (token as unknown as CustomToken)?.args?.displayMode === true
        ) {
          elements.push(this._parseToken({ type: 'br', raw: '  \n' }, styles));
          elements.push(this._parseToken(token, styles));
          if (i < tokens.length - 1 && !tokens[i + 1].raw.includes('\n')) {
            elements.push(
              this._parseToken({ type: 'br', raw: '  \n' }, styles)
            );
          }
          continue;
        }
      }
      elements.push(this._parseToken(token, styles));
    }
    return elements.filter(element => element !== null);
  }

  private _parseToken(
    token: Token | { type: string; raw: string },
    styles?: ViewStyle | TextStyle | ImageStyle
  ): ReactNode {
    switch (token.type) {
      case 'paragraph': {
        const paragraphToken = token as Tokens.Paragraph;
        if (
          paragraphToken.raw.startsWith('$') &&
          paragraphToken.raw.endsWith('$')
        ) {
          const sliceCount = paragraphToken.raw.startsWith('$$') ? 2 : 1;
          const children = this._parse(paragraphToken.tokens ?? []);
          return this.renderer.custom('latex', paragraphToken.raw, children, {
            text: paragraphToken.raw.slice(
              sliceCount,
              paragraphToken.raw.length - sliceCount
            ),
            displayMode: true,
          });
        }
        const children = this.getNormalizedSiblingNodesForBlockAndInlineTokens(
          paragraphToken.tokens ?? [],
          this.styles.text
        );

        return this.renderer.paragraph(children, this.styles.paragraph);
      }
      case 'blockquote': {
        const blockquoteToken = token as Tokens.Blockquote;
        const children = this.parse(blockquoteToken.tokens);
        return this.renderer.blockquote(children, this.styles.blockquote);
      }
      case 'heading': {
        const headingToken = token as Tokens.Heading;
        // eslint-disable-next-line @typescript-eslint/no-shadow
        const styles = this.headingStylesMap[headingToken.depth];

        if (this.hasDuplicateTextChildToken(headingToken)) {
          return this.renderer.heading(
            headingToken.text,
            styles,
            headingToken.depth
          );
        }

        const children = this._parse(headingToken.tokens, styles);
        return this.renderer.heading(children, styles, headingToken.depth);
      }
      case 'code': {
        const codeToken = token as Tokens.Code;
        // Check if code block is complete (has closing fence)
        // A complete fenced code block ends with ``` or ~~~
        const raw = codeToken.raw;
        const isCompleted =
          raw.trimEnd().endsWith('```') || raw.trimEnd().endsWith('~~~');
        return this.renderer.code(
          codeToken.text,
          codeToken.lang,
          this.styles.code,
          this.styles.em,
          isCompleted
        );
      }
      case 'hr': {
        return this.renderer.hr(this.styles.hr);
      }
      case 'list': {
        const listToken = token as Tokens.List;
        let startIndex = Number.parseInt(listToken.start.toString(), 10);
        if (Number.isNaN(startIndex)) {
          startIndex = 1;
        }
        const li = listToken.items.map(item => {
          const children = item.tokens.flatMap(cItem => {
            if (cItem.type === 'text') {
              /* getViewNode since tokens could contain a block like elements (i.e. img) */
              const childTokens = (cItem as Tokens.Text).tokens || [];
              // return this.renderer.listItem(listChildren, this.styles.li);
              return this.getNormalizedSiblingNodesForBlockAndInlineTokens(
                childTokens,
                this.styles.li
              );
            }

            /* Parse the nested token */
            return this._parseToken(cItem);
          });

          return this.renderer.listItem(children, this.styles.li);
        });

        return this.renderer.list(
          listToken.ordered,
          li,
          this.styles.list,
          this.styles.li,
          startIndex
        );
      }
      case 'escape': {
        const escapeToken = token as Tokens.Escape;
        return this.renderer.escape(escapeToken.text, {
          ...this.styles.text,
          ...styles,
        });
      }
      case 'link': {
        const linkToken = token as Tokens.Link;
        // Don't render anchors without text and children
        if (linkToken.text.trim().length < 1 || !linkToken.tokens) {
          return null;
        }

        // Note: Linking Images (https://www.markdownguide.org/basic-syntax/#linking-images) are wrapped
        // in paragraph token, so will be handled via `getNormalizedSiblingNodesForBlockAndInlineTokens`
        const linkStyle = {
          ...this.styles.link,
          ...styles,
          // To override color and fontStyle properties
          color: this.styles.link?.color,
          fontStyle: this.styles.link?.fontStyle,
        };
        const href = getValidURL(this.baseUrl, linkToken.href);

        if (this.hasDuplicateTextChildToken(linkToken)) {
          return this.renderer.link(linkToken.text, href, linkStyle);
        }

        const children = this._parse(linkToken.tokens, linkStyle);
        return this.renderer.link(children, href, linkStyle);
      }
      case 'image': {
        const imageToken = token as Tokens.Image;
        return this.renderer.image(
          imageToken.href,
          imageToken.text || imageToken.title || undefined,
          this.styles.image
        );
      }
      case 'strong': {
        const strongToken = token as Tokens.Strong;
        const boldStyle = {
          ...this.styles.strong,
          ...styles,
        };
        if (this.hasDuplicateTextChildToken(strongToken)) {
          return this.renderer.strong(strongToken.text, boldStyle);
        }

        const children = this._parse(strongToken.tokens, boldStyle);
        return this.renderer.strong(children, boldStyle);
      }
      case 'em': {
        const emToken = token as Tokens.Em;
        const italicStyle = {
          ...this.styles.em,
          ...styles,
        };
        if (this.hasDuplicateTextChildToken(emToken)) {
          return this.renderer.em(emToken.text, italicStyle);
        }

        const children = this._parse(emToken.tokens, italicStyle);
        return this.renderer.em(children, italicStyle);
      }
      case 'codespan': {
        const codespanToken = token as Tokens.Codespan;
        return this.renderer.codespan(decode(codespanToken.text), {
          ...this.styles.codespan,
          ...styles,
        });
      }
      case 'br': {
        return this.renderer.br();
      }
      case 'del': {
        const delToken = token as Tokens.Del;
        const strikethroughStyle = {
          ...this.styles.strikethrough,
          ...styles,
        };
        if (this.hasDuplicateTextChildToken(delToken)) {
          return this.renderer.del(delToken.text, strikethroughStyle);
        }

        const children = this._parse(delToken.tokens, strikethroughStyle);
        return this.renderer.del(children, strikethroughStyle);
      }
      case 'text':
        return this.renderer.text(token.raw, {
          ...this.styles.text,
          ...styles,
        });
      case 'html': {
        return this.renderer.html(token.raw, {
          ...this.styles.text,
          ...styles,
        });
      }
      case 'table': {
        const tableToken = token as Tokens.Table;
        const header = tableToken.header.map((row, i) =>
          this._parse(row.tokens, {
            ...getTableColAlignmentStyle(tableToken.align[i]),
          })
        );

        const rows = tableToken.rows.map(cols =>
          cols.map((col, i) =>
            this._parse(col.tokens, {
              ...getTableColAlignmentStyle(tableToken.align[i]),
            })
          )
        );

        return this.renderer.table(
          header,
          rows,
          this.styles.table,
          this.styles.tableRow,
          this.styles.tableCell
        );
      }
      case 'custom': {
        const customToken = token as unknown as CustomToken;
        const children = this._parse(customToken.tokens ?? []);
        return this.renderer.custom(
          customToken.identifier,
          customToken.raw,
          children,
          customToken.args
        );
      }
      default: {
        return null;
      }
    }
  }

  private getNormalizedSiblingNodesForBlockAndInlineTokens(
    tokens: Token[],
    textStyle?: TextStyle
  ): ReactNode[] {
    let tokenRenderQueue: Token[] = [];
    const siblingNodes: ReactNode[] = [];
    for (const t of tokens) {
      /**
       * To avoid inlining images
       * Currently supports images, link images
       * Note: to be extend for other token types
       */
      if (
        t.type === 'image' ||
        (t.type === 'link' &&
          t.tokens &&
          t.tokens[0] &&
          t.tokens[0].type === 'image')
      ) {
        // Render existing inline tokens in the queue
        const parsed = this._parse(tokenRenderQueue);
        if (parsed.length > 0) {
          siblingNodes.push(this.renderer.text(parsed, textStyle));
        }

        // Render the current block token
        if (t.type === 'image') {
          siblingNodes.push(this._parseToken(t));
        } else if (t.type === 'link' && t.tokens && t.tokens[0]) {
          const imageToken = t.tokens[0] as Tokens.Image;
          const href = getValidURL(this.baseUrl, (t as Tokens.Link).href);
          siblingNodes.push(
            this.renderer.linkImage(
              href,
              imageToken.href,
              imageToken.text ?? imageToken.title ?? '',
              this.styles.image,
              imageToken.title
            )
          );
        }

        tokenRenderQueue = [];
        continue;
      }
      tokenRenderQueue = [...tokenRenderQueue, t];
    }

    /* Remaining temp tokens if any */
    if (tokenRenderQueue.length > 0) {
      siblingNodes.push(this.renderer.text(this.parse(tokenRenderQueue), {}));
    }

    return siblingNodes;
  }

  // To avoid duplicate text node nesting when there are no child tokens with text emphasis (i.e., italic)
  // ref: https://github.com/gmsgowtham/react-native-marked/issues/522
  private hasDuplicateTextChildToken(token: Token): boolean {
    if (!('tokens' in token)) {
      return false;
    }

    return !!(
      token.tokens &&
      token.tokens.length === 1 &&
      token.tokens[0]?.type === 'text'
    );
  }
}

export default Parser;
