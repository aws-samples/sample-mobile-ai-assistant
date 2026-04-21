import React, {
  memo,
  useRef,
  useState,
  useEffect,
  type FunctionComponent,
} from 'react';
import {
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

const CHUNK_SIZE = 100;

interface ChunkedCodeViewProps {
  code: string;
  textStyle?: StyleProp<TextStyle>;
  backgroundColor?: string;
  scrollViewProps?: ScrollViewProps;
  containerStyle?: StyleProp<ViewStyle>;
  isCompleted?: boolean;
}

interface ChunkTextProps {
  content: string;
  textStyle?: StyleProp<TextStyle>;
  isComplete: boolean;
}

// Memoized chunk - complete chunks never re-render
const ChunkText: FunctionComponent<ChunkTextProps> = memo(
  ({ content, textStyle }) => {
    return <Text style={textStyle}>{content}</Text>;
  },
  (prevProps, nextProps) => {
    if (prevProps.isComplete) {
      return true;
    }
    return prevProps.content === nextProps.content;
  }
);

// Simple chunked code hook - splits code into 100-line chunks
const useChunkedCode = (code: string, isCompleted?: boolean): string[] => {
  // Frozen complete chunks (each contains exactly 100 lines)
  const frozenChunksRef = useRef<string[]>([]);
  // Throttle counter
  const updateCountRef = useRef(0);
  // Trigger re-render
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const lines = code ? code.split('\n') : [];
    const totalLines = lines.length;

    // How many complete 100-line chunks should exist
    // Use (totalLines - 1) to ensure the last line is complete before freezing
    const completeChunkCount =
      totalLines > 0 ? Math.floor((totalLines - 1) / CHUNK_SIZE) : 0;
    const frozenCount = frozenChunksRef.current.length;

    // Freeze new complete chunk when we cross 100-line boundary
    if (completeChunkCount > frozenCount) {
      const start = frozenCount * CHUNK_SIZE;
      const end = start + CHUNK_SIZE;
      const chunkContent = lines.slice(start, end).join('\n');
      frozenChunksRef.current.push(chunkContent);
    }

    // Throttle: skip odd updates during streaming
    updateCountRef.current++;
    if (!isCompleted && updateCountRef.current % 2 !== 0) {
      return;
    }

    forceUpdate(prev => prev + 1);
  }, [code, isCompleted]);

  // Build return array: frozen chunks + remaining lines
  const lines = code ? code.split('\n') : [];
  const frozenCount = frozenChunksRef.current.length;
  const remainingStart = frozenCount * CHUNK_SIZE;
  const lastChunk = lines.slice(remainingStart).join('\n');

  if (lastChunk) {
    return [...frozenChunksRef.current, lastChunk];
  }
  return [...frozenChunksRef.current];
};

/**
 * Chunked code renderer - splits into CHUNK_SIZE line chunks.
 * Complete chunks are memoized, only last chunk updates during streaming.
 */
const ChunkedCodeView: FunctionComponent<ChunkedCodeViewProps> = ({
  code,
  textStyle,
  backgroundColor,
  scrollViewProps,
  containerStyle,
  isCompleted,
}) => {
  const chunks = useChunkedCode(code, isCompleted);

  return (
    <ScrollView
      {...scrollViewProps}
      horizontal
      nestedScrollEnabled={false}
      contentContainerStyle={[
        { backgroundColor },
        scrollViewProps?.contentContainerStyle,
        containerStyle,
      ]}>
      <View style={styles.chunksContainer}>
        {chunks.map((chunk, index) => (
          <ChunkText
            key={isCompleted ? `chunk-${index}-${chunk.length}` : index}
            content={chunk}
            textStyle={textStyle}
            isComplete={index < chunks.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  chunksContainer: {
    flexDirection: 'column',
  },
  chunkText: {},
});

export default ChunkedCodeView;
