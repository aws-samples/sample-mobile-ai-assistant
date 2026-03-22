import React, {
  useCallback,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { isMac } from '../../App';
import { useTheme } from '../../theme';

export interface InputAreaProps {
  onSend: (text: string) => void;
  renderComposer?: () => React.ReactNode;
  renderSend: (props: { hasText: boolean; onPress: () => void }) => React.ReactNode;
  maxComposerHeight?: number;
  containerStyle?: ViewStyle;
  primaryStyle?: ViewStyle;
  textInputStyle?: TextStyle;
  onHasTextChange?: (hasText: boolean) => void;
  onTextChange?: (text: string) => void;
  blurOnSubmit?: boolean;
  disabled?: boolean;
}

export interface InputAreaRef {
  clear: () => void;
  focus: () => void;
  getText: () => string;
  setText: (text: string) => void;
  isFocused: () => boolean;
}

export const InputArea = forwardRef<InputAreaRef, InputAreaProps>(
  (
    {
      onSend,
      renderComposer,
      renderSend,
      maxComposerHeight = isMac ? 360 : 200,
      containerStyle,
      primaryStyle,
      textInputStyle,
      onHasTextChange,
      onTextChange,
      blurOnSubmit = isMac,
      disabled = false,
    },
    ref
  ) => {
    const { colors } = useTheme();
    const textInputRef = useRef<TextInput>(null);
    // Use controlled component for auto-grow to work on iOS
    const [text, setText] = useState('');

    const hasText = text.length > 0;

    useImperativeHandle(ref, () => ({
      clear: () => {
        setText('');
        onHasTextChange?.(false);
        if (isMac) {
          textInputRef.current?.clear();
        }
      },
      focus: () => {
        textInputRef.current?.focus();
      },
      getText: () => text,
      setText: (newText: string) => {
        setText(newText);
        onHasTextChange?.(newText.length > 0);
      },
      isFocused: () => textInputRef.current?.isFocused() ?? false,
    }));

    const handleTextChange = useCallback(
      (newText: string) => {
        setText(newText);
        const newHasText = newText.length > 0;
        onHasTextChange?.(newHasText);
        onTextChange?.(newText);
      },
      [onHasTextChange, onTextChange]
    );

    const handleSend = useCallback(() => {
      const trimmedText = text.trim();
      if (trimmedText.length > 0 && !disabled) {
        onSend(trimmedText);
        setText('');
        onHasTextChange?.(false);
      }
    }, [text, onSend, disabled, onHasTextChange]);

    const handleSubmitEditing = useCallback(() => {
      handleSend();
      // On Mac, controlled component value="" doesn't trigger native layout recalculation.
      // Calling clear() invokes the native setTextAndSelection which calls _updateState
      // to push state to shadow tree and trigger Yoga height recalculation.
      if (isMac) {
        textInputRef.current?.clear();
      }
    }, [handleSend]);

    const styles = createStyles(colors);

    return (
      <View style={[styles.container, containerStyle]}>
        <View style={[styles.primary, primaryStyle]}>
          {renderComposer ? (
            renderComposer()
          ) : (
            <TextInput
              ref={textInputRef}
              style={[styles.textInput, { maxHeight: maxComposerHeight }, textInputStyle]}
              placeholder="Message"
              placeholderTextColor={colors.textTertiary}
              multiline
              value={text}
              onChangeText={handleTextChange}
              submitBehavior={blurOnSubmit && !disabled ? 'submit' : 'newline'}
              onSubmitEditing={handleSubmitEditing}
              spellCheck={false}
              autoComplete="off"
              autoCorrect={false}
              keyboardType="default"
              textContentType="username"
              dataDetectorTypes="none"
            />
          )}
          {renderSend({ hasText, onPress: handleSend })}
        </View>
      </View>
    );
  }
);

InputArea.displayName = 'InputArea';

const createStyles = (colors: { background: string; chatInputBackground: string; text: string; textTertiary: string }) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderTopWidth: 0,
      paddingHorizontal: 10,
      paddingTop: 0,
      paddingBottom: isMac ? 10 : Platform.OS === 'android' ? 8 : 2,
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.chatInputBackground,
      borderRadius: 12,
      paddingHorizontal: 0,
    },
    textInput: {
      flex: 1,
      marginLeft: 10,
      marginRight: 4,
      paddingTop: Platform.OS === 'android' ? 10 : 10,
      paddingBottom: Platform.OS === 'android' ? 10 : 12,
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
      fontWeight: isMac ? '300' : 'normal',
      ...(Platform.OS === 'android' && { includeFontPadding: false }),
    },
  });
