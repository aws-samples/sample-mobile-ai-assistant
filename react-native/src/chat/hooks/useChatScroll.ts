import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { ChatStatus, SwiftChatMessage } from '../../types/Chat.ts';
import { CustomChatComponentRef } from '../component/message/CustomChatComponent.tsx';

export function useChatScroll(
  chatComponentRef: React.RefObject<CustomChatComponentRef | null>,
  chatStatusRef: React.MutableRefObject<ChatStatus>,
  messagesRef: React.MutableRefObject<SwiftChatMessage[]>
) {
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const containerHeightRef = useRef(0);

  const scrollToBottom = useCallback((animated = true) => {
    chatComponentRef.current?.scrollToEnd({ animated });
  }, [chatComponentRef]);

  const scrollToTop = useCallback(() => {
    setUserScrolled(true);
    if (messagesRef.current.length > 0) {
      chatComponentRef.current?.scrollToIndex({
        index: messagesRef.current.length - 1,
        animated: true,
      });
    }
  }, [chatComponentRef, messagesRef]);

  const showKeyboard = useCallback(() => {
    setTimeout(() => {
      chatComponentRef.current?.focusInput();
    }, 100);
  }, [chatComponentRef]);

  const handleScroll = useCallback(
    (scrollEvent: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = scrollEvent.nativeEvent.contentOffset.y;
    },
    []
  );

  const handleUserScroll = useCallback(
    (_: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (chatStatusRef.current === ChatStatus.Running) {
        setUserScrolled(true);
      }
    },
    [chatStatusRef]
  );

  const handleMomentumScrollEnd = useCallback(
    (endEvent: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (chatStatusRef.current === ChatStatus.Running && userScrolled) {
        const { contentOffset } = endEvent.nativeEvent;
        if (contentOffset.y > 0 && contentOffset.y < 100) {
          scrollToBottom();
        }
      }
    },
    [chatStatusRef, userScrolled, scrollToBottom]
  );

  const handleReasoningToggle = useCallback(
    (expanded: boolean, height: number, animated: boolean) => {
      if (height > 0) {
        const currentOffset = scrollOffsetRef.current;
        const newOffset = expanded
          ? currentOffset + height
          : Math.max(0, currentOffset - height);
        chatComponentRef.current?.scrollToOffset({
          offset: newOffset,
          animated,
        });
      }
    },
    [chatComponentRef]
  );

  // keyboard show listener for scroll to bottom
  useEffect(() => {
    const handleKeyboardShow = () => {
      if (chatComponentRef.current?.isInputFocused()) {
        scrollToBottom();
      }
    };

    const keyboardDidShowListener = Platform.select({
      ios: Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
      android: Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
    });

    return () => {
      keyboardDidShowListener && keyboardDidShowListener.remove();
    };
  }, [chatComponentRef, scrollToBottom]);

  // show keyboard on mount
  useEffect(() => {
    showKeyboard();
  }, [showKeyboard]);

  return {
    userScrolled,
    setUserScrolled,
    contentHeightRef,
    containerHeightRef,
    scrollToBottom,
    scrollToTop,
    showKeyboard,
    handleScroll,
    handleUserScroll,
    handleMomentumScrollEnd,
    handleReasoningToggle,
  };
}
