import React, { useMemo, useCallback } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import ImageSpinner from './ImageSpinner';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  SwiftChatMessage,
  SystemPrompt,
} from '../../types/Chat.ts';
import { CustomAddFileComponent } from './CustomAddFileComponent.tsx';
import { getImageModel, getTextModel } from '../../storage/StorageUtils.ts';
import { useTheme, ColorScheme } from '../../theme';

interface CustomSendComponentProps {
  text?: string;
  onSend?: (message: Partial<SwiftChatMessage>, shouldResetInput: boolean) => void;
  chatStatus: ChatStatus;
  chatMode: ChatMode;
  selectedFiles: FileInfo[];
  isShowLoading?: boolean;
  onStopPress: () => void;
  onFileSelected: (files: FileInfo[]) => void;
  onVoiceChatToggle?: () => void;
  systemPrompt?: SystemPrompt | null;
}

const CustomSendComponent: React.FC<CustomSendComponentProps> = ({
  text,
  onSend,
  chatStatus,
  chatMode,
  selectedFiles,
  isShowLoading: isShowLoading = false,
  onStopPress,
  onFileSelected,
  onVoiceChatToggle,
  systemPrompt,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isNovaSonic = getTextModel().modelId.includes('sonic');

  const handleSend = useCallback(() => {
    if (onSend) {
      onSend({ text: text ? text.trim() : '' } as Partial<SwiftChatMessage>, true);
    }
  }, [onSend, text]);

  const handleFileSelected = useCallback(
    (files: FileInfo[]) => {
      onFileSelected(files);
    },
    [onFileSelected]
  );
  const isVirtualTryOn = systemPrompt?.id === -7;
  let isShowSending = false;
  if (chatMode === ChatMode.Image) {
    isShowSending =
      !isModelSupportUploadImages(chatMode) ||
      (systemPrompt != null && !isVirtualTryOn && selectedFiles.length > 0) ||
      (isVirtualTryOn && selectedFiles.length === 2) ||
      (systemPrompt == null && text && text!.length > 0) ||
      chatStatus === ChatStatus.Running;
  } else if (chatMode === ChatMode.Text) {
    isShowSending =
      ((text && text!.length > 0) ||
        selectedFiles.length > 0 ||
        chatStatus === ChatStatus.Running) &&
      !isNovaSonic &&
      !isShowLoading;
  }
  if (isShowSending) {
    return (
      <TouchableOpacity
        style={styles.sendContainer}
        onPress={chatStatus !== ChatStatus.Running ? handleSend : undefined}
        disabled={chatStatus === ChatStatus.Running}
        activeOpacity={0.7}>
        <>
          {chatStatus === ChatStatus.Running && (
            <TouchableOpacity
              style={styles.stopContainer}
              onPress={() => onStopPress()}>
              <View style={styles.circle} />
              <View style={styles.rectangle} />
            </TouchableOpacity>
          )}
          {chatStatus !== ChatStatus.Running && (
            <Image
              source={
                isDark
                  ? require('../../assets/send_dark.png')
                  : require('../../assets/send.png')
              }
              style={styles.sendButton}
            />
          )}
        </>
      </TouchableOpacity>
    );
  } else {
    if ((isNovaSonic || isShowLoading) && chatMode === ChatMode.Text) {
      if (isShowLoading) {
        return (
          <View style={styles.loadingContainer}>
            <ImageSpinner
              source={require('../../assets/loading.png')}
              visible={true}
              size={26}
            />
          </View>
        );
      }
      return (
        <>
          {chatStatus === ChatStatus.Running && (
            <View style={styles.micContainer}>
              <TouchableOpacity
                style={styles.stopContainer}
                onPress={() => onStopPress()}>
                <View style={styles.circle} />
                <View style={styles.rectangle} />
              </TouchableOpacity>
            </View>
          )}
          {chatStatus !== ChatStatus.Running && (
            <TouchableOpacity
              style={styles.micContainer}
              onPress={onVoiceChatToggle}>
              <Image
                source={
                  isDark
                    ? require('../../assets/mic_dark.png')
                    : require('../../assets/mic.png')
                }
                style={styles.sendButton}
              />
            </TouchableOpacity>
          )}
        </>
      );
    } else {
      return (
        <CustomAddFileComponent
          onFileSelected={handleFileSelected}
          chatMode={chatMode}
        />
      );
    }
  }
};

const isModelSupportUploadImages = (chatMode: ChatMode): boolean => {
  return (
    chatMode === ChatMode.Image &&
    (getImageModel().modelId.includes('nova-canvas') ||
      getImageModel().modelId.includes('stability.sd3'))
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    stopContainer: {
      marginRight: 10,
      marginLeft: 10,
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    circle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.text,
      position: 'absolute',
    },
    rectangle: {
      width: 10,
      height: 10,
      backgroundColor: colors.surface,
      borderRadius: 2,
      position: 'absolute',
    },
    sendContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
      height: 44,
    },
    micContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'flex-end',
      height: 44,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
      marginLeft: 10,
      height: 44,
    },
    sendButton: {
      width: 26,
      height: 26,
      borderRadius: 15,
      marginRight: 10,
      marginLeft: 10,
    },
  });
export default CustomSendComponent;
