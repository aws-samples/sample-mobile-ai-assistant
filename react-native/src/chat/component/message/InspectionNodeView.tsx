import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MarkdownProps } from 'react-native-marked';
import { useTheme } from '../../../theme';
import Markdown from '../../../core/markdown/Markdown';
import { ChatStatus } from '../../../types/Chat';

export interface AgentStep {
  stepName: string;
  status: string;
  details: string;
}

interface InspectionNodeViewProps {
  steps: AgentStep[];
  finalText?: string;
  isStreaming?: boolean;
  renderer?: MarkdownProps['renderer'];
  tokenizer?: MarkdownProps['tokenizer'];
}

export const InspectionNodeView: React.FC<InspectionNodeViewProps> = ({
  steps,
  finalText,
  renderer,
  tokenizer,
}) => {
  const { colors, isDark } = useTheme();
  const lineColor = isDark ? '#484f58' : '#d0d7de';
  const grayDot = isDark ? '#8b949e' : '#8b949e';
  const greenDot = '#74c991';
  const redDot = '#c74e39';

  const totalItems = steps.length + (finalText ? 1 : 0);

  const toolResultStyles = {
    paragraph: { paddingVertical: 2 },
    h1: { fontSize: 18 },
    h2: { fontSize: 16 },
    h3: { fontSize: 15 },
    h4: { fontSize: 14 },
  };

  const finalTextStyles = {
    paragraph: { paddingVertical: 4 },
    h1: { fontSize: 20 },
    h2: { fontSize: 18 },
    h3: { fontSize: 16 },
    h4: { fontSize: 15 },
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isLast = index === totalItems - 1;
        const dotColor = step.status === 'Pass' ? greenDot : redDot;

        return (
          <View key={index} style={styles.nodeRow}>
            {/* Left timeline */}
            <View style={styles.timelineColumn}>
              {!isLast && (
                <View style={[styles.line, { backgroundColor: lineColor }]} />
              )}
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            </View>
            {/* Right content */}
            <View style={styles.contentColumn}>
              <Text style={[styles.stepTitle, { color: colors.textSecondary }]}>
                Call tool:{' '}
                <Text style={[styles.stepName, { color: colors.text }]}>
                  {step.stepName}
                </Text>
              </Text>
              <View
                style={[
                  styles.resultBox,
                  isDark ? styles.resultBoxDark : styles.resultBoxLight,
                ]}>
                <View style={styles.markdownWrap}>
                  <Markdown
                    value={`${step.status === 'Pass' ? '✅' : '❌'} ${step.status}: ${step.details}`}
                    chatStatus={ChatStatus.Complete}
                    styles={toolResultStyles}
                    renderer={renderer}
                    tokenizer={tokenizer}
                  />
                </View>
              </View>
            </View>
          </View>
        );
      })}

      {/* Final verdict */}
      {finalText ? (
        <View style={styles.nodeRow}>
          <View style={styles.timelineColumn}>
            <View
              style={[
                styles.dot,
                { backgroundColor: grayDot },
                (finalText.startsWith('**') || finalText.startsWith('#')) &&
                  styles.dotMarkdownOffset,
              ]}
            />
          </View>
          <View style={styles.contentColumn}>
            <View style={styles.markdownWrap}>
              <Markdown
                value={finalText}
                chatStatus={ChatStatus.Complete}
                styles={finalTextStyles}
                renderer={renderer}
                tokenizer={tokenizer}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  nodeRow: {
    flexDirection: 'row',
    minHeight: 36,
  },
  timelineColumn: {
    width: 14,
    alignItems: 'center',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: 3.5,
    top: 12,
    bottom: -10,
    width: 1.5,
    borderRadius: 1,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 5,
    marginLeft: -5,
    zIndex: 2,
  },
  contentColumn: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 12,
    paddingLeft: 6,
  },
  stepTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  stepName: {
    fontWeight: '600',
    fontSize: 14,
  },
  dotMarkdownOffset: {
    marginTop: 10,
  },
  markdownWrap: {
    marginTop: -4,
    marginBottom: -8,
  },
  resultBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
  },
  resultBoxDark: {
    borderColor: '#3d444d',
    backgroundColor: '#161b22',
  },
  resultBoxLight: {
    borderColor: '#d0d7de',
    backgroundColor: '#ffffff',
  },
});
