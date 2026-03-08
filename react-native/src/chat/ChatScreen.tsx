import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  activateKeepAwake,
  deactivateKeepAwake,
} from '@sayem314/react-native-keep-awake';
import { voiceChatService } from './service/VoiceChatService';
import AudioWaveformComponent, {
  AudioWaveformRef,
} from './component/AudioWaveformComponent';
import { ColorScheme, useTheme } from '../theme';
import { invokeBedrockWithCallBack, requestToken } from '../api/bedrock-api';
import CustomMessageComponent from './component/CustomMessageComponent.tsx';
import { EmptyChatComponent } from './component/EmptyChatComponent.tsx';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { RouteParamList } from '../types/RouteTypes.ts';
import {
  getCurrentSystemPrompt,
  getCurrentVoiceSystemPrompt,
  getImageModel,
  getLastVirtualTryOnImgFile,
  getMessagesBySessionId,
  getSessionId,
  getTextModel,
  isTokenValid,
  saveCurrentImageSystemPrompt,
  saveCurrentSystemPrompt,
  saveCurrentVoiceSystemPrompt,
  saveLastVirtualTryOnImgFile,
  saveMessageList,
  saveMessages,
  updateTotalUsage,
} from '../storage/StorageUtils.ts';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  Metrics,
  SwiftChatMessage,
  SystemPrompt,
  Usage,
} from '../types/Chat.ts';
import { useAppContext } from '../history/AppProvider.tsx';
import { CustomHeaderRightButton } from './component/CustomHeaderRightButton.tsx';
import CustomSendComponent from './component/CustomSendComponent.tsx';
import {
  BedrockMessage,
  getBedrockMessage,
  getBedrockMessagesFromChatMessages,
} from './util/BedrockMessageConvertor.ts';
import { trigger } from './util/HapticUtils.ts';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import { isMac } from '../App.tsx';
import { CustomChatFooter } from './component/CustomChatFooter.tsx';
import {
  checkFileNumberLimit,
  getFileTypeSummary,
  isAllFileReady,
} from './util/FileUtils.ts';
import HeaderTitle from './component/HeaderTitle.tsx';
import { showInfo } from './util/ToastUtils.ts';
import { HeaderOptions } from '@react-navigation/elements';
import { webSearchOrchestrator } from '../websearch/services/WebSearchOrchestrator.ts';
import { Citation } from '../types/Chat.ts';
import {
  setLatestHtmlCode,
  clearLatestHtmlCode,
  getLatestHtmlCode,
  replaceHtmlWithPlaceholder,
  replaceDiffWithPlaceholder,
} from './util/DiffUtils.ts';
import {
  CustomChatComponent,
  CustomChatComponentRef,
} from './component/CustomChatComponent.tsx';
import { MessageRenderProps } from './component/MessageList.tsx';
import {
  appendMessages,
  getLatestMessage,
  updateLatestMessage,
} from './utils/messageUtils.ts';
import { backgroundStreamManager } from './service/BackgroundStreamManager.ts';
import { startBackgroundTaskIfNeeded } from './service/BackgroundTaskService.ts';

const BOT_ID = 2;
const APP_PROMPT_NAME = 'App';

/**
 * Find the latest htmlCode from AI messages
 * For inverted order [newest...oldest], traverse from start to find latest
 */
const findLatestHtmlCode = (messages: SwiftChatMessage[]): string => {
  // For inverted: newest is at index 0, traverse from start
  for (const msg of messages) {
    if (msg.user._id === BOT_ID && msg.htmlCode) {
      return msg.htmlCode;
    }
  }
  return '';
};

/**
 * Check if session contains App mode content (htmlCode, diffCode, or html code block in text)
 */
const isAppModeSession = (messages: SwiftChatMessage[]): boolean => {
  return messages.some(
    msg =>
      msg.user._id === BOT_ID &&
      (msg.htmlCode ||
        msg.diffCode ||
        msg.text.includes('```html\n') ||
        msg.text.includes('[HTML_OUTPUT_OMITTED]'))
  );
};

const createBotMessage = (mode: string, isAppMode: boolean = false) => {
  return {
    _id: uuidv4(),
    text: mode === ChatMode.Text ? textPlaceholder : imagePlaceholder,
    createdAt: new Date(),
    user: {
      _id: BOT_ID,
      name:
        mode === ChatMode.Text
          ? getTextModel().modelName
          : getImageModel().modelName,
      modelTag: mode === ChatMode.Text ? getTextModel().modelTag : undefined,
    },
    isLastHtml: isAppMode ? true : undefined,
  };
};
const imagePlaceholder = '![](bedrock://imgProgress)';
const textPlaceholder = '...';
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
  const [userScrolled, setUserScrolled] = useState(false);
  const chatStatusRef = useRef(chatStatus);
  const messagesRef = useRef(messages);
  const bedrockMessages = useRef<BedrockMessage[]>([]);
  const chatComponentRef = useRef<CustomChatComponentRef>(null);
  const sessionIdRef = useRef(initialSessionId || getSessionId() + 1);
  const activeCancelFlagRef = useRef<{ current: boolean }>({ current: false });
  const { sendEvent, event, drawerType } = useAppContext();
  const sendEventRef = useRef(sendEvent);
  const inputTextRef = useRef('');
  const [hasInputText, setHasInputText] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const selectedFilesRef = useRef(selectedFiles);
  const usageRef = useRef(usage);
  const systemPromptRef = useRef(systemPrompt);
  const drawerTypeRef = useRef(drawerType);
  const isVoiceLoading = useRef(false);
  const contentHeightRef = useRef(0);
  const containerHeightRef = useRef(0);
  const [isShowVoiceLoading, setIsShowVoiceLoading] = useState(false);
  const audioWaveformRef = useRef<AudioWaveformRef>(null);
  const [searchPhase, setSearchPhase] = useState<string>('');

  // App mode state
  const isAppModeRef = useRef(false);
  const endVoiceConversationRef = useRef<(() => Promise<boolean>) | null>(null);
  const isNewChatRef = useRef(!initialSessionId);

  const endVoiceConversation = useCallback(async () => {
    audioWaveformRef.current?.resetAudioLevels();
    if (isVoiceLoading.current) {
      return Promise.resolve(false);
    }
    isVoiceLoading.current = true;
    setIsShowVoiceLoading(true);
    await voiceChatService.endConversation();
    setChatStatus(ChatStatus.Init);
    isVoiceLoading.current = false;
    setIsShowVoiceLoading(false);
    return true;
  }, []);

  useEffect(() => {
    endVoiceConversationRef.current = endVoiceConversation;
  }, [endVoiceConversation]);

  // update refs value with state
  useEffect(() => {
    messagesRef.current = messages;
    chatStatusRef.current = chatStatus;
    usageRef.current = usage;
  }, [chatStatus, messages, usage]);

  // Keep screen awake during streaming output
  useEffect(() => {
    if (chatStatus === ChatStatus.Running) {
      activateKeepAwake();
    } else {
      deactivateKeepAwake();
    }
    return () => {
      deactivateKeepAwake();
    };
  }, [chatStatus]);

  useEffect(() => {
    drawerTypeRef.current = drawerType;
  }, [drawerType]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  // Initialize voice chat service
  useEffect(() => {
    // Set up voice chat service callbacks
    voiceChatService.setCallbacks(
      // Handle transcript received
      (role, text) => {
        handleVoiceChatTranscript(role, text);
      },
      // Handle error
      message => {
        if (getTextModel().modelId.includes('sonic')) {
          handleVoiceChatTranscript('ASSISTANT', message);
          endVoiceConversationRef.current?.();
          saveCurrentMessages();
          console.log('Voice chat error:', message);
        }
      }
    );

    // Clean up on unmounting
    return () => {
      voiceChatService.cleanup();
    };
  }, []);

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
      showKeyboard();
    }, [])
  );

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
          onDoubleTap={scrollToTop}
        />
      ),
      // eslint-disable-next-line react/no-unstable-nested-components
      headerRight: () => (
        <CustomHeaderRightButton
          onPress={() => {
            //clear input content and selected files
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
  }, [usage, navigation, mode, systemPrompt, isDark]);

  // sessionId changes (start new chat or click another session)
  useEffect(() => {
    if (tapIndex && initialSessionId) {
      if (sessionIdRef.current === initialSessionId) {
        return;
      }
      if (chatStatusRef.current === ChatStatus.Running) {
        const isAppStreaming =
          (isAppModeRef.current ||
            systemPromptRef.current?.name === APP_PROMPT_NAME) &&
          modeRef.current === ChatMode.Text;
        if (isAppStreaming) {
          // App mode: register background stream instead of aborting
          backgroundStreamManager.register(sessionIdRef.current, {
            sessionId: sessionIdRef.current,
            text: getLatestMessage(messagesRef.current)?.text || '',
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
          sendEventRef.current('updateHistory');
        } else {
          // Non-App mode: abort as before
          controllerRef.current?.abort();
          activeCancelFlagRef.current.current = true;
          if (modeRef.current === ChatMode.Image) {
            const lastMsg = getLatestMessage(messagesRef.current);
            if (lastMsg && lastMsg.text === imagePlaceholder) {
              setMessages(
                updateLatestMessage(messagesRef.current, msg => ({
                  ...msg,
                  text: 'Request interrupted',
                }))
              );
            }
          }
          saveCurrentMessages();
        }
        chatStatusRef.current = ChatStatus.Init;
      }
      if (modeRef.current !== mode) {
        // when change chat mode, clear system prompt and files
        modeRef.current = mode;
        setTimeout(() => {
          sendEventRef.current?.('unSelectSystemPrompt');
        }, 50);
        setSelectedFiles([]);
      }
      setChatStatus(ChatStatus.Init);
      sendEventRef.current('');
      setUsage(undefined);
      if (initialSessionId === 0 || initialSessionId === -1) {
        startNewChat.current();
        return;
      }
      // click from history
      setMessages([]);
      isNewChatRef.current = false;
      setIsLoadingMessages(true);
      sessionIdRef.current = initialSessionId;

      // Check for active background streaming
      const bgStream = backgroundStreamManager.get(initialSessionId);
      if (bgStream) {
        setLatestHtmlCode(bgStream.htmlCode);
        isAppModeRef.current = true;
        if (bgStream.isComplete) {
          // Background streaming finished - load completed messages
          setMessages(bgStream.messages);
          setUsage(bgStream.messages[0]?.usage);
          getBedrockMessagesFromChatMessages(bgStream.messages).then(m => {
            bedrockMessages.current = m;
          });
        } else {
          // Still streaming - reconnect UI
          const restoredMessages = [...bgStream.messages];
          restoredMessages[0] = {
            ...restoredMessages[0],
            text: bgStream.text,
            reasoning: bgStream.reasoning,
          };
          setMessages(restoredMessages);
          messagesRef.current = restoredMessages;
          activeCancelFlagRef.current = bgStream.cancelFlag;
          controllerRef.current = bgStream.controller;
          bedrockMessages.current = bgStream.bedrockMessages;
          // Don't restore isNewChat - saveCurrentMessages already saved it during registration
          // Set both ref and state to Running so callback doesn't skip
          chatStatusRef.current = ChatStatus.Running;
          setChatStatus(ChatStatus.Running);
        }
        // Only remove completed streams; keep active ones so drawer shows green dot
        if (bgStream.isComplete) {
          backgroundStreamManager.remove(initialSessionId);
        }
        sendEventRef.current?.('selectAppPrompt');
        setIsLoadingMessages(false);
        scrollToBottom();
        showKeyboard();
        return;
      }

      // Only end voice conversation for non-background-stream sessions
      endVoiceConversationRef.current?.();

      const msg = getMessagesBySessionId(initialSessionId);
      // Get usage from the latest message (first element in inverted array)
      const latestMsg = getLatestMessage(msg);
      setUsage(latestMsg?.usage);
      // restore htmlCode from history
      const restoredHtmlCode = findLatestHtmlCode(msg as SwiftChatMessage[]);
      setLatestHtmlCode(restoredHtmlCode);

      if (isAppModeSession(msg as SwiftChatMessage[])) {
        isAppModeRef.current = true;
        sendEventRef.current?.('selectAppPrompt');
      } else {
        setSystemPrompt(null);
        saveCurrentSystemPrompt(null);
        saveCurrentVoiceSystemPrompt(null);
        saveCurrentImageSystemPrompt(null);
        //notify to unselect prompt
        sendEventRef.current?.('unSelectSystemPrompt');
      }
      getBedrockMessagesFromChatMessages(msg).then(currentMessage => {
        bedrockMessages.current = currentMessage;
      });
      if (isMac) {
        setMessages(msg);
        setIsLoadingMessages(false);
        scrollToBottom();
        showKeyboard();
      } else {
        setTimeout(() => {
          setMessages(msg);
          setIsLoadingMessages(false);
          scrollToBottom();
        }, 200);
      }
    }
  }, [initialSessionId, mode, tapIndex]);

  // editAppCode handler - for editing saved apps from AppGallery
  useEffect(() => {
    if (editAppCode && editTimestamp) {
      startNewChat.current();
      setUsage(undefined);
      setLatestHtmlCode(editAppCode);
      isAppModeRef.current = true;
      setTimeout(() => {
        sendEventRef.current?.('selectAppPrompt');
        // Pre-fill the input with app name hint
        if (editAppName) {
          const hintText = `Edit [${editAppName}]: `;
          chatComponentRef.current?.setInputText(hintText);
          inputTextRef.current = hintText;
          setHasInputText(true);
        }
      }, 100);
    }
  }, [editAppCode, editAppName, editTimestamp]);

  // deleteChat listener
  useEffect(() => {
    if (event?.event === 'deleteChat' && event.params) {
      const { id } = event.params;
      // Stop and clean up any background streaming for this session
      if (id && backgroundStreamManager.has(id)) {
        backgroundStreamManager.stop(id);
        backgroundStreamManager.remove(id);
      }
      if (sessionIdRef.current === id) {
        sessionIdRef.current = getSessionId() + 1;
        sendEventRef.current('updateHistorySelectedId', {
          id: sessionIdRef.current,
        });
        setUsage(undefined);
        bedrockMessages.current = [];
        setMessages([]);
      }
    }
  }, [event]);

  // htmlCodeGenerated listener for App mode - update message.htmlCode for persistence
  useEffect(() => {
    if (event?.event === 'htmlCodeGenerated' && event.params?.htmlCode) {
      const { htmlCode } = event.params;
      setMessages(prevMessages => {
        // update isLastHtml for all messages
        // For inverted: first element (index 0) is the latest message
        const newMessages = prevMessages.map((msg, index) => {
          if (index === 0) {
            return { ...msg, htmlCode: htmlCode, isLastHtml: true };
          } else if (msg.isLastHtml) {
            return { ...msg, isLastHtml: false };
          }
          return msg;
        });
        return newMessages;
      });
    }
  }, [event]);

  // diffApplied listener for App mode - update message.htmlCode and save diffCode
  // Note: placeholder replacement is done in ChatStatus.Complete handler
  useEffect(() => {
    if (event?.event === 'diffApplied' && event.params?.diffCode) {
      const { htmlCode, diffCode } = event.params;
      setMessages(prevMessages => {
        // update isLastHtml for all messages
        // For inverted: first element (index 0) is the latest message
        const newMessages = prevMessages.map((msg, index) => {
          if (index === 0) {
            return {
              ...msg,
              htmlCode: htmlCode,
              diffCode: diffCode,
              isLastHtml: true,
            };
          } else if (msg.isLastHtml) {
            return { ...msg, isLastHtml: false };
          }
          return msg;
        });
        return newMessages;
      });
    }
  }, [event]);

  // keyboard show listener for scroll to bottom
  useEffect(() => {
    const handleKeyboardShow = () => {
      // Only scroll to bottom if the chat input is focused
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
  }, []);

  // show keyboard for open the app
  useEffect(() => {
    showKeyboard();
  }, []);

  const showKeyboard = () => {
    setTimeout(() => {
      chatComponentRef.current?.focusInput();
    }, 100);
  };

  // update screenWith and height when screen rotate
  useEffect(() => {
    const updateDimensions = () => {
      setScreenDimensions(Dimensions.get('window'));
    };

    const subscription = Dimensions.addEventListener(
      'change',
      updateDimensions
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  // handle message complete update bedrockMessage and saveMessage
  useEffect(() => {
    if (chatStatus === ChatStatus.Complete) {
      if (messagesRef.current.length <= 1) {
        return;
      }
      // In App mode, replace HTML/diff with placeholder to save context tokens
      // For inverted: latest message is at index 0
      const msg = getLatestMessage(messagesRef.current);
      if (msg && isAppModeRef.current && msg.htmlCode) {
        msg.text = replaceHtmlWithPlaceholder(msg.text, msg.htmlCode);
      }
      if (msg && isAppModeRef.current && msg.diffCode && msg.htmlCode) {
        msg.text = replaceDiffWithPlaceholder(msg.text, msg.diffCode);
      }
      saveCurrentMessages();
      // Clean up background stream manager entry when streaming completes in foreground
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
      // Notify Mermaid renderers to refresh after streaming completes
      setTimeout(() => {
        sendEventRef.current('refreshMermaid');
      }, 150);
      setChatStatus(ChatStatus.Init);
    }
  }, [chatStatus]);

  // app goes to background and save running messages.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (chatStatusRef.current === ChatStatus.Running) {
          saveCurrentMessages();
          // Start background task to keep streaming alive in App mode
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
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => {
      subscription.remove();
    };
  }, []);

  // save the current message
  const saveCurrentMessages = () => {
    if (messagesRef.current.length === 0) {
      return;
    }
    const currentSessionId = getSessionId();
    if (isNewChatRef.current) {
      if (sessionIdRef.current <= currentSessionId) {
        //update sessionID
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
      // For inverted: first user message is at the end (oldest)
      saveMessageList(
        sessionIdRef.current,
        messagesRef.current[messagesRef.current.length - 1],
        modeRef.current
      );
      isNewChatRef.current = false;
    }
  };

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
          ? screenWidth / 2 - 75 // iphone landscape
          : chatScreenWidth / 2 - 15,
      bottom: screenHeight > screenWidth ? '1.5%' : '2%',
    },
  });

  // For inverted list: scroll to top means scroll to the oldest message (end of array)
  const scrollToTop = () => {
    setUserScrolled(true);
    if (messagesRef.current.length > 0) {
      chatComponentRef.current?.scrollToIndex({
        index: messagesRef.current.length - 1,
        animated: true,
      });
    }
  };

  // For inverted list: scrollToEnd scrolls to bottom (newest messages)
  const scrollToBottom = (animated = true) => {
    chatComponentRef.current?.scrollToEnd({ animated });
  };

  const scrollOffsetRef = useRef(0);

  const handleScroll = (
    scrollEvent: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    scrollOffsetRef.current = scrollEvent.nativeEvent.contentOffset.y;
  };

  const handleUserScroll = (_: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (chatStatusRef.current === ChatStatus.Running) {
      setUserScrolled(true);
    }
  };

  const handleMomentumScrollEnd = (
    endEvent: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (chatStatusRef.current === ChatStatus.Running && userScrolled) {
      const { contentOffset } = endEvent.nativeEvent;
      // For inverted list: offset 0 means at bottom, check if near bottom
      // When user scrolls near bottom during streaming, snap to bottom and resume auto-scroll
      if (contentOffset.y > 0 && contentOffset.y < 100) {
        scrollToBottom();
      }
    }
  };

  // Reasoning/preview toggle callback for inverted list
  // Need scroll compensation when content expands or collapses
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
    []
  );

  // invoke bedrock api
  useEffect(() => {
    // For inverted: latest message is at index 0
    const lastMessage = getLatestMessage(messages);
    if (
      lastMessage &&
      lastMessage.user &&
      lastMessage.user._id === BOT_ID &&
      lastMessage.text ===
        (modeRef.current === ChatMode.Text
          ? textPlaceholder
          : imagePlaceholder) &&
      chatStatusRef.current === ChatStatus.Running
    ) {
      if (modeRef.current === ChatMode.Image) {
        sendEventRef.current('onImageStart');
      }

      // Wrap in async function to support await
      (async () => {
        // Per-streaming cancel flag and session ID capture
        const streamingSessionId = sessionIdRef.current;
        const localCancelFlag = { current: false };
        activeCancelFlagRef.current = localCancelFlag;
        controllerRef.current = new AbortController();

        // Register in background manager at streaming start for App mode
        // so the drawer green dot shows immediately
        if (
          isAppModeRef.current ||
          systemPromptRef.current?.name === APP_PROMPT_NAME
        ) {
          backgroundStreamManager.register(streamingSessionId, {
            sessionId: streamingSessionId,
            text: '',
            reasoning: '',
            usage: usageRef.current,
            cancelFlag: localCancelFlag,
            controller: controllerRef.current,
            htmlCode: getLatestHtmlCode(),
            isComplete: false,
            needStop: false,
            messages: [...messagesRef.current],
            bedrockMessages: [...bedrockMessages.current],
          });
          if (isNewChatRef.current) {
            saveCurrentMessages();
          }
        }

        // Get the last user message (for inverted: index 1, after bot message at 0)
        const userMessage = messages.length > 1 ? messages[1]?.text : null;

        let webSearchSystemPrompt;
        let webSearchCitations: Citation[] | undefined;
        // Execute web search only in text mode with user message
        if (userMessage && modeRef.current === ChatMode.Text) {
          try {
            const webSearchResult = await webSearchOrchestrator.execute(
              userMessage,
              bedrockMessages.current,
              (phase: string) => {
                setSearchPhase(phase);
              },
              undefined,
              controllerRef.current
            );
            if (webSearchResult) {
              webSearchSystemPrompt = webSearchResult.systemPrompt;
              webSearchCitations = webSearchResult.citations;
            }
          } catch (error) {
            // For errors, log and continue without web search
            console.log('❌ Web search error in ChatScreen:', error);
          }
        }

        // Check if aborted after web search completes
        if (localCancelFlag.current) {
          setChatStatus(ChatStatus.Init);
          setSearchPhase('');
          return;
        }

        // Clear searchPhase before starting AI response
        setSearchPhase('');
        const startRequestTime = new Date().getTime();
        let latencyMs = 0;
        let metrics: Metrics | undefined;

        // Prioritize web search system prompt, otherwise use user-selected system prompt
        const effectiveSystemPrompt =
          webSearchSystemPrompt || systemPromptRef.current;

        // In App mode, temporarily prepend htmlCode to last user message
        const currentHtmlCode = getLatestHtmlCode();
        const lastMsgContent = bedrockMessages.current[
          bedrockMessages.current.length - 1
        ]?.content[0] as { text?: string };
        const originalText = lastMsgContent?.text;
        if (isAppModeRef.current && currentHtmlCode && originalText) {
          lastMsgContent.text = `Current app code:\n\`\`\`html\n${currentHtmlCode}\n\`\`\`\n\nUser request: ${originalText}`;
        }

        invokeBedrockWithCallBack(
          bedrockMessages.current,
          modeRef.current,
          effectiveSystemPrompt,
          () => localCancelFlag.current,
          controllerRef.current,
          (
            msg: string,
            complete: boolean,
            needStop: boolean,
            usageInfo?: Usage,
            reasoning?: string
          ) => {
            // Background stream detection: session switched away
            const isBackground =
              streamingSessionId !== sessionIdRef.current;
            if (isBackground) {
              if (
                !backgroundStreamManager.isStreaming(streamingSessionId)
              ) {
                return;
              }
              if (latencyMs === 0) {
                latencyMs = new Date().getTime() - startRequestTime;
              }
              let bgMetrics = metrics;
              if (usageInfo && !bgMetrics) {
                const renderSec =
                  (new Date().getTime() - startRequestTime - latencyMs) /
                  1000;
                const speed = usageInfo.outputTokens / renderSec;
                bgMetrics = {
                  latencyMs: (latencyMs / 1000).toFixed(2),
                  speed: speed.toFixed(speed > 100 ? 1 : 2),
                };
                metrics = bgMetrics;
              }
              backgroundStreamManager.update(streamingSessionId, {
                text: msg,
                reasoning,
                usage: usageInfo,
                metrics: bgMetrics,
                citations: webSearchCitations,
              });
              if (complete || needStop) {
                backgroundStreamManager.markComplete(
                  streamingSessionId,
                  needStop
                );
              }
              return;
            }

            if (chatStatusRef.current !== ChatStatus.Running) {
              return;
            }
            if (latencyMs === 0) {
              latencyMs = new Date().getTime() - startRequestTime;
            }
            const updateMessage = () => {
              if (usageInfo) {
                setUsage(prevUsage => ({
                  modelName: usageInfo.modelName,
                  inputTokens:
                    (prevUsage?.inputTokens || 0) + usageInfo.inputTokens,
                  outputTokens:
                    (prevUsage?.outputTokens || 0) + usageInfo.outputTokens,
                  totalTokens:
                    (prevUsage?.totalTokens || 0) + usageInfo.totalTokens,
                }));
                updateTotalUsage(usageInfo);
                const renderSec =
                  (new Date().getTime() - startRequestTime - latencyMs) / 1000;
                const speed = usageInfo.outputTokens / renderSec;
                if (!metrics && modeRef.current === ChatMode.Text) {
                  metrics = {
                    latencyMs: (latencyMs / 1000).toFixed(2),
                    speed: speed.toFixed(speed > 100 ? 1 : 2),
                  };
                }
              }
              // For inverted: latest message is at index 0
              const previousMessage = getLatestMessage(messagesRef.current);
              if (
                previousMessage &&
                (previousMessage.text !== msg ||
                  previousMessage.reasoning !== reasoning ||
                  (!previousMessage.metrics && metrics))
              ) {
                setMessages(prevMessages =>
                  updateLatestMessage(prevMessages, prevMsg => ({
                    ...prevMsg,
                    text:
                      localCancelFlag.current &&
                      (previousMessage.text === textPlaceholder ||
                        previousMessage.text === '')
                        ? 'Canceled...'
                        : msg,
                    reasoning: reasoning,
                    metrics: metrics,
                    citations: webSearchCitations,
                  }))
                );
              }
            };
            const setComplete = () => {
              trigger(HapticFeedbackTypes.notificationSuccess);
              setChatStatus(ChatStatus.Complete);
            };
            if (modeRef.current === ChatMode.Text) {
              trigger(HapticFeedbackTypes.selection);
              updateMessage();
              if (complete) {
                setComplete();
              }
            } else {
              if (needStop) {
                sendEventRef.current('onImageStop');
              } else {
                sendEventRef.current('onImageComplete');
              }
              setTimeout(() => {
                updateMessage();
                setComplete();
              }, 1000);
            }
            if (needStop) {
              localCancelFlag.current = true;
            }
          }
        ).then();

        // Restore original text after sending
        if (originalText && lastMsgContent) {
          lastMsgContent.text = originalText;
        }
      })(); // Close async IIFE
    }
  }, [messages]);

  // Shared function for regenerate and edit-submit
  const regenerateFromUserMessage = useCallback(
    (userMessageIndex: number, newText?: string) => {
      setUserScrolled(false);
      trigger(HapticFeedbackTypes.impactMedium);

      // Get all history messages after the user message
      const historyMessages = messagesRef.current.slice(userMessageIndex + 1);

      // Update latestHtmlCode for app mode
      if (isAppModeRef.current) {
        const foundHtmlCode = findLatestHtmlCode(historyMessages);
        if (foundHtmlCode) {
          setLatestHtmlCode(foundHtmlCode);
        } else if (!newText) {
          clearLatestHtmlCode();
        }
      }

      // Create the user message (updated if newText provided)
      const userMessage: SwiftChatMessage = newText
        ? { ...messagesRef.current[userMessageIndex], text: newText }
        : messagesRef.current[userMessageIndex];

      getBedrockMessagesFromChatMessages([
        userMessage,
        ...historyMessages,
      ]).then(historyBedrockMessages => {
        bedrockMessages.current = historyBedrockMessages;
        setChatStatus(ChatStatus.Running);
        setMessages(_previousMessages => [
          createBotMessage(modeRef.current),
          userMessage,
          ...historyMessages,
        ]);
        scrollToBottom();
      });
    },
    []
  );

  // handle onSend
  const onSend = useCallback(async (message: SwiftChatMessage[] = []) => {
    // Reset user scroll state when sending a new message
    setUserScrolled(false);
    const files = selectedFilesRef.current;
    if (!isAllFileReady(files)) {
      showInfo('please wait for all videos to be ready');
      return;
    }

    if (message[0]?.text || files.length > 0) {
      if (!message[0]?.text) {
        if (modeRef.current === ChatMode.Text) {
          // use system prompt name as user prompt
          if (systemPromptRef.current) {
            message[0].text = systemPromptRef.current.name;
          } else {
            message[0].text = getFileTypeSummary(files);
          }
        } else {
          // use selected system prompt as user prompt
          message[0].text = systemPromptRef.current?.prompt ?? 'Empty Message';
          if (systemPromptRef.current?.id === -7) {
            saveLastVirtualTryOnImgFile(files[0]);
            saveCurrentImageSystemPrompt(null);
            sendEventRef.current('unSelectSystemPrompt');
          }
        }
      } else {
        // append user prompt after system prompt in image mode
        if (modeRef.current === ChatMode.Image && systemPromptRef.current) {
          message[0].text =
            systemPromptRef.current?.prompt + '\n' + message[0].text;
        }
      }

      if (selectedFilesRef.current.length > 0) {
        message[0].image = JSON.stringify(selectedFilesRef.current);
        setSelectedFiles([]);
      }
      trigger(HapticFeedbackTypes.impactMedium);
      scrollToBottom();

      getBedrockMessage(message[0]).then(currentMsg => {
        bedrockMessages.current.push(currentMsg);
        setChatStatus(ChatStatus.Running);
        // For inverted: [botMessage, userMessage, ...previousMessages]
        setMessages(previousMessages => [
          createBotMessage(modeRef.current),
          ...appendMessages(previousMessages, message),
        ]);
      });
    }
  }, []);

  const handleNewFileSelected = (files: FileInfo[]) => {
    setSelectedFiles(prevFiles => {
      const isVirtualTryOn =
        modeRef.current === ChatMode.Image &&
        systemPromptRef.current?.id === -7;
      return checkFileNumberLimit(
        prevFiles,
        files,
        modeRef.current,
        isVirtualTryOn
      );
    });
  };

  const handleVoiceChatTranscript = (role: string, text: string) => {
    const userId = role === 'USER' ? 1 : BOT_ID;
    // For inverted: latest message is at index 0
    const latestMsg = getLatestMessage(messagesRef.current);
    if (
      messagesRef.current.length > 0 &&
      latestMsg &&
      latestMsg.user._id === userId
    ) {
      if (userId === 1) {
        text = ' ' + text;
      }
      setMessages(previousMessages =>
        updateLatestMessage(previousMessages, msg => {
          if (!msg.text.includes(text)) {
            return { ...msg, text: msg.text + text };
          }
          return msg;
        })
      );
    } else {
      const newMessage: SwiftChatMessage = {
        _id: uuidv4(),
        text: text,
        createdAt: new Date(),
        user: {
          _id: userId,
          name: role === 'USER' ? 'You' : getTextModel().modelName,
          modelTag: role === 'USER' ? undefined : getTextModel().modelTag,
        },
      };

      // For inverted: prepend new message at the beginning
      setMessages(previousMessages => [newMessage, ...previousMessages]);
    }
  };

  const styles = createStyles(colors, isNovaSonic);

  // Render message function for CustomChatComponent
  const renderMessage = useCallback(
    (props: MessageRenderProps) => {
      const { currentMessage, key } = props;
      const messageIndex = messages.findIndex(
        msg => msg._id === currentMessage?._id
      );

      // For inverted: latest message is at index 0
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
          onReasoningToggle={handleReasoningToggle}
          messageIndex={messageIndex}
          regenerateFromUserMessage={regenerateFromUserMessage}
          isAppMode={isAppModeRef.current}
        />
      );
    },
    [
      messages,
      chatStatus,
      searchPhase,
      handleReasoningToggle,
      regenerateFromUserMessage,
    ]
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CustomChatComponent
        ref={chatComponentRef}
        messages={messages}
        onSend={onSend}
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
                handleNewFileSelected(files);
              }
            }}
            onSystemPromptUpdated={prompt => {
              const lastPromptIsVirtualTryOn = systemPrompt?.id === -7;
              setSystemPrompt(prompt);

              // Update App mode state
              const isAppMode = prompt?.name === APP_PROMPT_NAME;
              isAppModeRef.current = isAppMode;
              if (isAppMode) {
                // Restore htmlCode from latest AI message when switching to App mode
                // Only update if not already set (e.g., from history load)
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
                  endVoiceConversationRef.current?.();
                }
              } else {
                saveCurrentSystemPrompt(prompt);
              }
            }}
            onSwitchedToTextModel={() => {
              endVoiceConversationRef.current?.();
            }}
            chatMode={modeRef.current}
            hasInputText={hasInputText}
            chatStatus={chatStatus}
            systemPrompt={systemPrompt}
          />
        )}
        renderComposer={
          isNovaSonic && mode === ChatMode.Text
            ? () => <AudioWaveformComponent ref={audioWaveformRef} />
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
            isShowLoading={isShowVoiceLoading}
            onStopPress={() => {
              trigger(HapticFeedbackTypes.notificationWarning);
              if (isNovaSonic) {
                // End voice chat conversation
                endVoiceConversation().then(success => {
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
              handleNewFileSelected(files);
            }}
            onVoiceChatToggle={() => {
              if (isVoiceLoading.current) {
                return;
              }
              isVoiceLoading.current = true;
              setIsShowVoiceLoading(true);
              voiceChatService.startConversation().then(success => {
                if (!success) {
                  setChatStatus(ChatStatus.Init);
                } else {
                  setChatStatus(ChatStatus.Running);
                }
                isVoiceLoading.current = false;
                setIsShowVoiceLoading(false);
                trigger(HapticFeedbackTypes.impactMedium);
              });
            }}
            systemPrompt={systemPrompt}
          />
        )}
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
        onScrollEvent={handleScroll}
        onScrollBeginDrag={handleUserScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onLayout={(layoutEvent: LayoutChangeEvent) => {
          containerHeightRef.current = layoutEvent.nativeEvent.layout.height;
        }}
        onContentSizeChange={(_width: number, height: number) => {
          contentHeightRef.current = height;
        }}
        onScrollToBottomPress={() => setUserScrolled(false)}
        maintainVisibleContentPosition={
          userScrolled &&
          chatStatus === ChatStatus.Running &&
          contentHeightRef.current > containerHeightRef.current
            ? { minIndexForVisible: 0, autoscrollToTopThreshold: 0 }
            : null
        }
        bottomOffset={
          Platform.OS === 'android'
            ? 0
            : screenHeight > screenWidth && screenWidth < 500
            ? 24 // iphone in portrait
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
