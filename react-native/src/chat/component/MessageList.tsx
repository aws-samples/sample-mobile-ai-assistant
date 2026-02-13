import React, {
  useCallback,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SwiftChatMessage } from '../../types/Chat';
import { ScrollToBottomButton } from './ScrollToBottomButton';

export interface MessageListProps {
  messages: SwiftChatMessage[];
  user: { _id: number };
  renderMessage: (props: MessageRenderProps) => React.ReactNode;
  renderChatEmpty: () => React.ReactNode;
  scrollToBottomOffset?: number;
  scrollToBottomStyle?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  onScrollEvent?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: (width: number, height: number) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  maintainVisibleContentPosition?: {
    minIndexForVisible: number;
    autoscrollToTopThreshold?: number;
  } | null;
  onScrollToBottomPress?: () => void;
}

export interface MessageRenderProps {
  currentMessage: SwiftChatMessage;
  key: string;
}

export interface MessageListRef {
  scrollToEnd: (options?: { animated?: boolean }) => void;
  scrollToOffset: (options: { offset: number; animated?: boolean }) => void;
  scrollToIndex: (options: { index: number; animated?: boolean; viewPosition?: number }) => void;
}

const DEFAULT_SCROLL_TO_BOTTOM_OFFSET = 200;

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  (
    {
      messages,
      renderMessage,
      renderChatEmpty,
      scrollToBottomOffset = DEFAULT_SCROLL_TO_BOTTOM_OFFSET,
      scrollToBottomStyle,
      contentContainerStyle,
      onScrollEvent,
      onScrollBeginDrag,
      onMomentumScrollEnd,
      onContentSizeChange,
      onLayout,
      maintainVisibleContentPosition,
      onScrollToBottomPress,
    },
    ref
  ) => {
    const flatListRef = useRef<FlatList<SwiftChatMessage>>(null);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    useImperativeHandle(ref, () => ({
      // For inverted list, scroll to bottom (newest) means scroll to offset 0
      scrollToEnd: (options = { animated: true }) => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: options.animated });
      },
      scrollToOffset: (options) => {
        flatListRef.current?.scrollToOffset(options);
      },
      scrollToIndex: (options) => {
        flatListRef.current?.scrollToIndex(options);
      },
    }));

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset } = event.nativeEvent;
        // For inverted list, offset 0 means at bottom (newest), larger offset means scrolled up
        setShowScrollBottom(contentOffset.y > scrollToBottomOffset);
        onScrollEvent?.(event);
      },
      [scrollToBottomOffset, onScrollEvent]
    );

    const scrollToBottom = useCallback((animated = true) => {
      // For inverted list, scroll to offset 0 means scroll to bottom (newest)
      flatListRef.current?.scrollToOffset({ offset: 0, animated });
    }, []);

    const renderItem = useCallback(
      ({ item }: { item: SwiftChatMessage }): React.ReactElement | null => {
        const rendered = renderMessage({
          currentMessage: item,
          key: String(item._id),
        });
        return rendered as React.ReactElement | null;
      },
      [renderMessage]
    );

    const keyExtractor = useCallback(
      (item: SwiftChatMessage) => String(item._id),
      []
    );

    return (
      <View style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted={true}
          scrollsToTop={true}
          scrollEventThrottle={100}
          onScroll={handleScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onContentSizeChange={onContentSizeChange}
          onLayout={onLayout}
          contentContainerStyle={[
            styles.contentContainer,
            contentContainerStyle,
          ]}
          ListEmptyComponent={renderChatEmpty}
          keyboardShouldPersistTaps="never"
          maintainVisibleContentPosition={maintainVisibleContentPosition}
        />
        <ScrollToBottomButton
          visible={showScrollBottom}
          onPress={() => {
            onScrollToBottomPress?.();
            scrollToBottom(true);
          }}
          style={scrollToBottomStyle}
        />
      </View>
    );
  }
);

MessageList.displayName = 'MessageList';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 15,
    paddingBottom: 15,
  },
});
