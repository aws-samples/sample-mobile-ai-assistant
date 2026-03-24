import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  activateKeepAwake,
  deactivateKeepAwake,
} from '@sayem314/react-native-keep-awake';
import AudioWaveformComponent from './component/input/AudioWaveformComponent';
import { useChatScroll } from './hooks/useChatScroll.ts';
import { useChatVoice } from './hooks/useChatVoice.ts';
import { useChatSession, findLatestHtmlCode } from './hooks/useChatSession.ts';
import { useChatStreaming } from './hooks/useChatStreaming.ts';
import { ColorScheme, useTheme } from '../theme';
import { requestToken } from '../api/bedrock-api';
import CustomMessageComponent from './component/message/CustomMessageComponent.tsx';
import { EmptyChatComponent } from './component/EmptyChatComponent.tsx';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RouteParamList } from '../types/RouteTypes.ts';
import {
  getCurrentSystemPrompt,
  getCurrentVoiceSystemPrompt,
  getSessionId,
  getTextModel,
  isTokenValid,
  saveCurrentImageSystemPrompt,
  saveCurrentSystemPrompt,
  saveCurrentVoiceSystemPrompt,
  getLastVirtualTryOnImgFile,
  saveMessageList,
  saveMessages,
} from '../storage/StorageUtils.ts';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  SwiftChatMessage,
  SystemPrompt,
  Usage,
} from '../types/Chat.ts';
import { useAppContext } from '../history/AppProvider.tsx';
import { CustomHeaderRightButton } from './component/CustomHeaderRightButton.tsx';
import CustomSendComponent from './component/input/CustomSendComponent.tsx';
import { BedrockMessage } from '../api/BedrockMessageConvertor.ts';
import { trigger } from '../core/HapticUtils';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import { isMac } from '../App.tsx';
import { CustomChatFooter } from './component/toolbar/CustomChatFooter.tsx';
import HeaderTitle from './component/HeaderTitle.tsx';
import { HeaderOptions } from '@react-navigation/elements';
import {
  setLatestHtmlCode,
  clearLatestHtmlCode,
  getLatestHtmlCode,
  replaceHtmlWithPlaceholder,
  replaceDiffWithPlaceholder,
} from '../appgen/util/DiffUtils.ts';
import {
  CustomChatComponent,
  CustomChatComponentRef,
} from './component/message/CustomChatComponent.tsx';
import { MessageRenderProps } from './component/message/MessageList.tsx';
import { getLatestMessage } from './util/messageUtils.ts';
import { getBedrockMessage } from '../api/BedrockMessageConvertor.ts';
import { backgroundStreamManager } from '../appgen/service/BackgroundStreamManager.ts';
import { startBackgroundTaskIfNeeded } from './service/BackgroundTaskService.ts';
import type { ChatRefs, ChatSetters } from './hooks/ChatSharedState.ts';

const APP_PROMPT_NAME = 'App';
type ChatScreenRouteProp = RouteProp<RouteParamList, 'Bedrock'>;
let currentMode = ChatMode.Text;

function ChatScreen(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<ChatScreenRouteProp>();
  const initialSessionId = route.params?.sessionId;
  const tapIndex = route.params?.tapIndex;
  const mode = route.params?.mode ?? currentMode;
  const editAppCode = route.params?.editAppCode;
  const editAppName = route.params?.editAppName;
  const editTimestamp = route.params?.editTimestamp;
  const modeRef = useRef(mode);
  const isNovaSonic =
    getTextModel().modelId.includes('sonic') &&
    modeRef.current === ChatMode.Text;

  // Core state
  const [messages, setMessages] = useState<SwiftChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [systemPrompt, setSystemPrompt] = useState<SystemPrompt | null>(
    isNovaSonic ? getCurrentVoiceSystemPrompt : getCurrentSystemPrompt
  );
  const [screenDimensions, setScreenDimensions] = useState(
    Dimensions.get('window')
  );
  const [chatStatus, setChatStatus] = useState<ChatStatus>(ChatStatus.Init);
  const [usage, setUsage] = useState<Usage>();
  const [hasInputText, setHasInputText] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [searchPhase, setSearchPhase] = useState<string>('');

  // Core refs
  const chatStatusRef = useRef(chatStatus);
  const messagesRef = useRef(messages);
  const bedrockMessages = useRef<BedrockMessage[]>([]);
  const chatComponentRef = useRef<CustomChatComponentRef>(null);
  const sessionIdRef = useRef(initialSessionId || getSessionId() + 1);
  const activeCancelFlagRef = useRef<{ current: boolean }>({ current: false });
  const { sendEvent, event, drawerType } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const inputTextRef = useRef('');
  const controllerRef = useRef<AbortController | null>(null);
  const selectedFilesRef = useRef(selectedFiles);
  const usageRef = useRef(usage);
  const systemPromptRef = useRef(systemPrompt);
  const drawerTypeRef = useRef(drawerType);
  const isAppModeRef = useRef(false);
  const isNewChatRef = useRef(!initialSessionId);
  const saveCurrentMessagesRef = useRef<() => void>(() => {});

  // Build shared state objects for hooks
  const refs: ChatRefs = {
    messagesRef, chatStatusRef, bedrockMessages, sessionIdRef,
    activeCancelFlagRef, controllerRef, sendEventRef, usageRef,
    systemPromptRef, modeRef, isAppModeRef, isNewChatRef,
    drawerTypeRef, chatComponentRef, inputTextRef, selectedFilesRef,
  };
  const setters: ChatSetters = {
    setMessages, setChatStatus, setUsage, setSelectedFiles,
    setSystemPrompt, setIsLoadingMessages, setHasInputText, setSearchPhase,
  };

  // Hooks
  const scroll = useChatScroll(chatComponentRef, chatStatusRef, messagesRef);
  const voice = useChatVoice(setChatStatus, messagesRef, setMessages, saveCurrentMessagesRef);

  // Sync refs with state
  useEffect(() => {
    messagesRef.current = messages;
    chatStatusRef.current = chatStatus;
    usageRef.current = usage;
  }, [chatStatus, messages, usage]);

  useEffect(() => { drawerTypeRef.current = drawerType; }, [drawerType]);
  useEffect(() => { selectedFilesRef.current = selectedFiles; }, [selectedFiles]);

  // Keep screen awake during streaming
  useEffect(() => {
    if (chatStatus === ChatStatus.Running) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
    return () => { deactivateKeepAwake(); };
  }, [chatStatus]);

  // start new chat
  const startNewChat = useRef(
    useCallback(() => {
      trigger(HapticFeedbackTypes.impactMedium);
      sessionIdRef.current = getSessionId() + 1;
      isNewChatRef.current = true;
      sendEventRef.current('updateHistorySelectedId', {
        id: sessionIdRef.current,
      });
      setMessages([]);
      bedrockMessages.current = [];
      clearLatestHtmlCode();
      setUsage(undefined);
      scroll.showKeyboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // save the current message
  const saveCurrentMessages = () => {
    if (messagesRef.current.length === 0) {
      return;
    }
    const currentSessionId = getSessionId();
    if (isNewChatRef.current) {
      if (sessionIdRef.current <= currentSessionId) {
        sessionIdRef.current = currentSessionId + 1;
        setTimeout(() => {
          sendEventRef.current('updateHistorySelectedId', {
            id: sessionIdRef.current,
          });
        }, 100);
      }
    }
    saveMessages(sessionIdRef.current, messagesRef.current, usageRef.current!);
    if (isNewChatRef.current) {
      saveMessageList(
        sessionIdRef.current,
        messagesRef.current[messagesRef.current.length - 1],
        modeRef.current
      );
      isNewChatRef.current = false;
    }
  };
  saveCurrentMessagesRef.current = saveCurrentMessages;

  // Session management hook (session switching, delete, editApp, app mode events)
  useChatSession({
    refs, setters, initialSessionId, tapIndex, mode,
    editAppCode, editAppName, editTimestamp, event,
    saveCurrentMessages, startNewChat, scroll, voice,
  });

  // Streaming hook (invoke API, onSend, regenerate)
  const streaming = useChatStreaming({
    refs, setters, messages, chatStatus, saveCurrentMessages, scroll,
  });

  // header text and right button click
  React.useLayoutEffect(() => {
    currentMode = mode;
    systemPromptRef.current = systemPrompt;
    const headerOptions: HeaderOptions = {
      // eslint-disable-next-line react/no-unstable-nested-components
      headerTitle: () => (
        <HeaderTitle
          title={
            mode === ChatMode.Text
              ? systemPrompt
                ? systemPrompt.name
                : 'Chat'
              : 'Image'
          }
          usage={usage}
          onDoubleTap={scroll.scrollToTop}
        />
      ),
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={() => {
            chatComponentRef.current?.clearInput();
            setUsage(undefined);
            setSelectedFiles([]);
            if (messagesRef.current.length > 0) {
              if (chatStatusRef.current === ChatStatus.Running) {
                const isAppStreaming =
                  (isAppModeRef.current ||
                    systemPromptRef.current?.name === APP_PROMPT_NAME) &&
                  modeRef.current === ChatMode.Text;
                if (!isAppStreaming) {
                  return;
                }
                backgroundStreamManager.register(sessionIdRef.current, {
                  sessionId: sessionIdRef.current,
                  text:
                    getLatestMessage(messagesRef.current)?.text || '',
                  reasoning:
                    getLatestMessage(messagesRef.current)?.reasoning || '',
                  usage: usageRef.current,
                  cancelFlag: activeCancelFlagRef.current,
                  controller: controllerRef.current!,
                  htmlCode: getLatestHtmlCode(),
                  isComplete: false,
                  needStop: false,
                  messages: [...messagesRef.current],
                  bedrockMessages: [...bedrockMessages.current],
                });
                saveCurrentMessages();
                startBackgroundTaskIfNeeded();
                chatStatusRef.current = ChatStatus.Init;
                setChatStatus(ChatStatus.Init);
                sendEventRef.current('updateHistory');
              }
              startNewChat.current();
            }
          }}
          imageSource={
            isDark
              ? require('../assets/edit_dark.png')
              : require('../assets/edit.png')
          }
        />
      ),
    };
    navigation.setOptions(headerOptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage, navigation, mode, systemPrompt, isDark]);

  // Dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setScreenDimensions(Dimensions.get('window'));
    });
    return () => { subscription?.remove(); };
  }, []);

  // Handle message complete: update bedrockMessages and save
  useEffect(() => {
    if (chatStatus === ChatStatus.Complete) {
      if (messagesRef.current.length <= 1) {
        return;
      }
      const msg = getLatestMessage(messagesRef.current);
      if (msg && isAppModeRef.current && msg.htmlCode) {
        msg.text = replaceHtmlWithPlaceholder(msg.text, msg.htmlCode);
      }
      if (msg && isAppModeRef.current && msg.diffCode && msg.htmlCode) {
        msg.text = replaceDiffWithPlaceholder(msg.text, msg.diffCode);
      }
      saveCurrentMessages();
      backgroundStreamManager.remove(sessionIdRef.current);
      const latestMsg = getLatestMessage(messagesRef.current);
      if (latestMsg) {
        getBedrockMessage(latestMsg).then(currentMsg => {
          bedrockMessages.current.push(currentMsg);
        });
      }
      if (drawerTypeRef.current === 'permanent') {
        sendEventRef.current('updateHistory');
        setTimeout(() => {
          sendEventRef.current('updateHistorySelectedId', {
            id: sessionIdRef.current,
          });
        }, 100);
      }
      setTimeout(() => {
        sendEventRef.current('refreshMermaid');
      }, 150);
      setChatStatus(ChatStatus.Init);
    }
  }, [chatStatus]);

  // App goes to background: save running messages
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (chatStatusRef.current === ChatStatus.Running) {
          saveCurrentMessages();
          if (
            (isAppModeRef.current ||
              systemPromptRef.current?.name === APP_PROMPT_NAME) &&
            modeRef.current === ChatMode.Text
          ) {
            startBackgroundTaskIfNeeded();
          }
        }
      }
      if (nextAppState === 'active') {
        if (!isTokenValid()) {
          requestToken().then();
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => { subscription.remove(); };
  }, []);

  const { width: screenWidth, height: screenHeight } = screenDimensions;
  const chatScreenWidth =
    isMac && drawerType === 'permanent' ? screenWidth - 300 : screenWidth;

  const scrollStyle = StyleSheet.create({
    scrollToBottomContainerStyle: {
      width: 30,
      height: 30,
      left:
        Platform.OS === 'ios' &&
        screenHeight < screenWidth &&
        screenHeight < 500
          ? screenWidth / 2 - 75
          : chatScreenWidth / 2 - 15,
      bottom: screenHeight > screenWidth ? '1.5%' : '2%',
    },
  });

  const styles = createStyles(colors, isNovaSonic);

  const renderMessage = useCallback(
    (props: MessageRenderProps) => {
      const { currentMessage, key } = props;
      const messageIndex = messages.findIndex(
        msg => msg._id === currentMessage?._id
      );
      const latestMsg = getLatestMessage(messages);
      const isLastAIMessage =
        currentMessage?._id === latestMsg?._id &&
        currentMessage?.user._id !== 1;

      return (
        <CustomMessageComponent
          key={key}
          currentMessage={currentMessage}
          position={currentMessage.user._id === 1 ? 'right' : 'left'}
          chatStatus={chatStatus}
          isLastAIMessage={isLastAIMessage}
          searchPhase={isLastAIMessage ? searchPhase : ''}
          onReasoningToggle={scroll.handleReasoningToggle}
          messageIndex={messageIndex}
          regenerateFromUserMessage={streaming.regenerateFromUserMessage}
          isAppMode={isAppModeRef.current}
        />
      );
    },
    [messages, chatStatus, searchPhase, scroll.handleReasoningToggle, streaming.regenerateFromUserMessage]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CustomChatComponent
        ref={chatComponentRef}
        messages={messages}
        onSend={streaming.onSend}
        user={{ _id: 1 }}
        renderMessage={renderMessage}
        renderChatEmpty={() => (
          <EmptyChatComponent
            chatMode={modeRef.current}
            isLoadingMessages={isLoadingMessages}
          />
        )}
        renderChatFooter={() => (
          <CustomChatFooter
            files={selectedFiles}
            onFileUpdated={(files, isUpdate) => {
              if (isUpdate) {
                setSelectedFiles(files);
              } else {
                streaming.handleNewFileSelected(files);
              }
            }}
            onSystemPromptUpdated={prompt => {
              const lastPromptIsVirtualTryOn = systemPrompt?.id === -7;
              setSystemPrompt(prompt);
              const isAppMode = prompt?.name === APP_PROMPT_NAME;
              isAppModeRef.current = isAppMode;
              if (isAppMode) {
                if (!getLatestHtmlCode()) {
                  setLatestHtmlCode(findLatestHtmlCode(messages));
                }
              } else {
                clearLatestHtmlCode();
              }
              if (modeRef.current === ChatMode.Image) {
                saveCurrentImageSystemPrompt(prompt);
                if (prompt?.id === -7) {
                  const lastVirtualTryOnImgFile = getLastVirtualTryOnImgFile();
                  if (lastVirtualTryOnImgFile) {
                    setSelectedFiles([lastVirtualTryOnImgFile]);
                  }
                } else {
                  if (selectedFiles.length > 0 && lastPromptIsVirtualTryOn) {
                    setSelectedFiles([]);
                  }
                }
              } else if (isNovaSonic) {
                saveCurrentVoiceSystemPrompt(prompt);
                if (chatStatus === ChatStatus.Running) {
                  voice.endVoiceConversationRef.current?.();
                }
              } else {
                saveCurrentSystemPrompt(prompt);
              }
            }}
            onSwitchedToTextModel={() => {
              voice.endVoiceConversationRef.current?.();
            }}
            chatMode={modeRef.current}
            hasInputText={hasInputText}
            chatStatus={chatStatus}
            systemPrompt={systemPrompt}
          />
        )}
        renderComposer={
          isNovaSonic && mode === ChatMode.Text
            ? () => <AudioWaveformComponent ref={voice.audioWaveformRef} />
            : undefined
        }
        renderSend={({ hasText, onPress }) => (
          <CustomSendComponent
            text={hasText ? 'has-text' : ''}
            onSend={(_msg, shouldReset) => {
              onPress();
              if (shouldReset) {
                chatComponentRef.current?.clearInput();
              }
            }}
            chatStatus={chatStatus}
            chatMode={mode}
            selectedFiles={selectedFiles}
            isShowLoading={voice.isShowVoiceLoading}
            onStopPress={() => {
              trigger(HapticFeedbackTypes.notificationWarning);
              if (isNovaSonic) {
                voice.endVoiceConversation().then(success => {
                  if (success) {
                    trigger(HapticFeedbackTypes.impactMedium);
                  }
                });
                saveCurrentMessages();
              } else {
                activeCancelFlagRef.current.current = true;
                controllerRef.current?.abort();
              }
            }}
            onFileSelected={files => {
              streaming.handleNewFileSelected(files);
            }}
            onVoiceChatToggle={() => {
              voice.onVoiceChatToggle();
              trigger(HapticFeedbackTypes.impactMedium);
            }}
            systemPrompt={systemPrompt}
          />
        )}
        disabled={isMac && chatStatus === ChatStatus.Running}
        maxComposerHeight={isMac ? 360 : 200}
        inputToolbarContainerStyle={styles.inputToolbarContainer}
        inputToolbarPrimaryStyle={styles.inputToolbarPrimary}
        textInputStyle={styles.textInputStyle}
        onHasTextChange={setHasInputText}
        onTextChange={text => {
          inputTextRef.current = text;
        }}
        scrollToBottomOffset={50}
        scrollToBottomStyle={scrollStyle.scrollToBottomContainerStyle}
        contentContainerStyle={styles.contentContainer}
        onScrollEvent={scroll.handleScroll}
        onScrollBeginDrag={scroll.handleUserScroll}
        onMomentumScrollEnd={scroll.handleMomentumScrollEnd}
        onLayout={(layoutEvent: LayoutChangeEvent) => {
          scroll.containerHeightRef.current = layoutEvent.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_width: number, height: number) => {
          scroll.contentHeightRef.current = height;
        }}
        onScrollToBottomPress={() => scroll.setUserScrolled(false)}
        maintainVisibleContentPosition={
          scroll.userScrolled &&
          chatStatus === ChatStatus.Running &&
          scroll.contentHeightRef.current > scroll.containerHeightRef.current
            ? { minIndexForVisible: 0, autoscrollToTopThreshold: 0 }
            : null
        }
        bottomOffset={
          Platform.OS === 'android'
            ? 0
            : screenHeight > screenWidth && screenWidth < 500
            ? 24
            : 12
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorScheme, isNovaSonic: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingTop: 15,
      paddingBottom: 15,
      flexGrow: 1,
    },
    textInputStyle: {
      marginLeft: 10,
      lineHeight: 22,
      fontWeight: isMac ? '300' : 'normal',
      color: colors.text,
    },
    inputToolbarContainer: {
      backgroundColor: colors.background,
      borderTopWidth: 0,
      paddingHorizontal: 10,
      paddingTop: 0,
      paddingBottom: isMac ? 10 : Platform.OS === 'android' ? 8 : 2,
    },
    inputToolbarPrimary: {
      backgroundColor: isNovaSonic ? 'transparent' : colors.chatInputBackground,
      borderRadius: 12,
      paddingHorizontal: 0,
    },
  });

export default ChatScreen;
