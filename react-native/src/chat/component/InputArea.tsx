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
    // Use ref to store text to avoid re-renders on every keystroke
    const textRef = useRef('');
    const [hasText, setHasText] = useState(false);

    useImperativeHandle(ref, () => ({
      clear: () => {
        textRef.current = '';
        textInputRef.current?.clear();
        setHasText(false);
        onHasTextChange?.(false);
      },
      focus: () => {
        textInputRef.current?.focus();
      },
      getText: () => textRef.current,
      setText: (text: string) => {
        textRef.current = text;
        textInputRef.current?.setNativeProps({ text });
        const newHasText = text.length > 0;
        if (newHasText !== hasText) {
          setHasText(newHasText);
          onHasTextChange?.(newHasText);
        }
      },
      isFocused: () => textInputRef.current?.isFocused() ?? false,
    }));

    const handleTextChange = useCallback(
      (text: string) => {
        textRef.current = text;

        // Only update state when crossing the 0/non-0 boundary
        const newHasText = text.length > 0;
        if (newHasText !== hasText) {
          setHasText(newHasText);
          onHasTextChange?.(newHasText);
        }

        // Optional: sync to external callback
        onTextChange?.(text);
      },
      [hasText, onHasTextChange, onTextChange]
    );

    const handleSend = useCallback(() => {
      const text = textRef.current.trim();
      if (text.length > 0 && !disabled) {
        onSend(text);
        textRef.current = '';
        textInputRef.current?.clear();
        setHasText(false);
        onHasTextChange?.(false);
        // Re-focus after sending on Mac
        if (isMac) {
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 50);
        }
      }
    }, [onSend, disabled, onHasTextChange]);

    const handleSubmitEditing = useCallback(() => {
      handleSend();
      // Re-focus after submit
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
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
              onChangeText={handleTextChange}
              blurOnSubmit={blurOnSubmit}
              onSubmitEditing={handleSubmitEditing}
              editable={!disabled}
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
      paddingTop: Platform.OS === 'android' ? 8 : 10,
      paddingBottom: Platform.OS === 'android' ? 8 : 12,
      fontSize: 16,
      lineHeight: 22,
      color: colors.text,
      fontWeight: isMac ? '300' : 'normal',
    },
  });
