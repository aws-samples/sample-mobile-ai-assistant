import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { isMac } from '../../App';
import { SwiftChatMessage } from '../../types/Chat';
import { MessageList, MessageListRef, MessageRenderProps } from './MessageList';
import { InputArea, InputAreaRef } from './InputArea';
import { useTheme } from '../../theme';

export interface CustomChatComponentProps {
  // Core
  messages: SwiftChatMessage[];
  onSend: (messages: SwiftChatMessage[]) => void;
  user: { _id: number };

  // Render functions
  renderMessage: (props: MessageRenderProps) => React.ReactNode;
  renderChatEmpty: () => React.ReactNode;
  renderChatFooter?: () => React.ReactNode;
  renderComposer?: () => React.ReactNode;
  renderSend: (props: { hasText: boolean; onPress: () => void }) => React.ReactNode;

  // Input area config
  maxComposerHeight?: number;
  inputToolbarContainerStyle?: ViewStyle;
  inputToolbarPrimaryStyle?: ViewStyle;
  textInputStyle?: ViewStyle;
  onHasTextChange?: (hasText: boolean) => void;
  onTextChange?: (text: string) => void;

  // Scroll config
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

  // State
  alwaysShowSend?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  bottomOffset?: number;
  disabled?: boolean;
  keyboardVerticalOffset?: number;
}

export interface CustomChatComponentRef {
  scrollToEnd: (options?: { animated?: boolean }) => void;
  scrollToOffset: (options: { offset: number; animated?: boolean }) => void;
  scrollToIndex: (options: { index: number; animated?: boolean; viewPosition?: number }) => void;
  clearInput: () => void;
  focusInput: () => void;
  getInputText: () => string;
  setInputText: (text: string) => void;
  isInputFocused: () => boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const CustomChatComponent = forwardRef<
  CustomChatComponentRef,
  CustomChatComponentProps
>((props, ref) => {
  const {
    messages,
    onSend,
    user,
    renderMessage,
    renderChatEmpty,
    renderChatFooter,
    renderComposer,
    renderSend,
    maxComposerHeight,
    inputToolbarContainerStyle,
    inputToolbarPrimaryStyle,
    textInputStyle,
    onHasTextChange,
    onTextChange,
    scrollToBottomOffset,
    scrollToBottomStyle,
    contentContainerStyle,
    onScrollEvent,
    onScrollBeginDrag,
    onMomentumScrollEnd,
    onContentSizeChange,
    onLayout,
    maintainVisibleContentPosition,
    onScrollToBottomPress,
    bottomOffset,
    disabled = false,
    keyboardVerticalOffset = Platform.OS === 'ios' ? 106 : 114,
  } = props;

  const { colors } = useTheme();
  const messageListRef = useRef<MessageListRef>(null);
  const inputAreaRef = useRef<InputAreaRef>(null);

  useImperativeHandle(ref, () => ({
    scrollToEnd: (options) => {
      messageListRef.current?.scrollToEnd(options);
    },
    scrollToOffset: (options) => {
      messageListRef.current?.scrollToOffset(options);
    },
    scrollToIndex: (options) => {
      messageListRef.current?.scrollToIndex(options);
    },
    clearInput: () => {
      inputAreaRef.current?.clear();
    },
    focusInput: () => {
      inputAreaRef.current?.focus();
    },
    getInputText: () => inputAreaRef.current?.getText() ?? '',
    setInputText: (text) => {
      inputAreaRef.current?.setText(text);
    },
    isInputFocused: () => inputAreaRef.current?.isFocused() ?? false,
  }));

  const handleSend = useCallback(
    (text: string) => {
      const message: SwiftChatMessage = {
        _id: Date.now().toString(),
        text,
        createdAt: new Date(),
        user,
      };
      onSend([message]);
    },
    [onSend, user]
  );

  // Calculate bottom offset for iPhone notch
  const calculatedBottomOffset =
    bottomOffset ??
    (Platform.OS === 'android'
      ? 0
      : screenHeight > screenWidth && screenWidth < 500
      ? 24 // iPhone portrait
      : 12);

  const styles = createStyles(colors, calculatedBottomOffset);

  // On Mac, we don't need KeyboardAvoidingView
  const Container = isMac ? View : KeyboardAvoidingView;
  const containerProps = isMac
    ? { style: styles.container }
    : {
        style: styles.container,
        behavior: 'padding' as const,
        keyboardVerticalOffset: keyboardVerticalOffset,
      };

  return (
    <Container {...containerProps}>
      <MessageList
        ref={messageListRef}
        messages={messages}
        user={user}
        renderMessage={renderMessage}
        renderChatEmpty={renderChatEmpty}
        scrollToBottomOffset={scrollToBottomOffset}
        scrollToBottomStyle={scrollToBottomStyle}
        contentContainerStyle={contentContainerStyle || styles.listContent}
        onScrollEvent={onScrollEvent}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        maintainVisibleContentPosition={maintainVisibleContentPosition}
        onScrollToBottomPress={onScrollToBottomPress}
      />

      {/* Chat footer (system prompt + file preview) above input */}
      {renderChatFooter?.()}

      <InputArea
        ref={inputAreaRef}
        onSend={handleSend}
        renderComposer={renderComposer}
        renderSend={renderSend}
        maxComposerHeight={maxComposerHeight}
        containerStyle={inputToolbarContainerStyle}
        primaryStyle={inputToolbarPrimaryStyle}
        textInputStyle={textInputStyle}
        onHasTextChange={onHasTextChange}
        onTextChange={onTextChange}
        disabled={disabled}
      />
    </Container>
  );
});

CustomChatComponent.displayName = 'CustomChatComponent';

const createStyles = (colors: { background: string }, _bottomOffset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    listContent: {
      paddingTop: 15,
      paddingBottom: 15,
      flexGrow: 1,
    },
  });
