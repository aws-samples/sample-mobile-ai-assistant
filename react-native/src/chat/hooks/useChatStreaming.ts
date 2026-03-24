import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMode,
  ChatStatus,
  Citation,
  FileInfo,
  Metrics,
  SwiftChatMessage,
  Usage,
} from '../../types/Chat.ts';
import {
  getImageModel,
  getTextModel,
  updateTotalUsage,
} from '../../storage/StorageUtils.ts';
import {
  getBedrockMessage,
  getBedrockMessagesFromChatMessages,
} from '../../api/BedrockMessageConvertor.ts';
import { invokeBedrockWithCallBack } from '../../api/bedrock-api';
import { webSearchOrchestrator } from '../../websearch/services/WebSearchOrchestrator.ts';
import {
  getLatestHtmlCode,
  setLatestHtmlCode,
  clearLatestHtmlCode,
} from '../../appgen/util/DiffUtils.ts';
import { backgroundStreamManager } from '../../appgen/service/BackgroundStreamManager.ts';
import {
  appendMessages,
  getLatestMessage,
  updateLatestMessage,
} from '../util/messageUtils.ts';
import { trigger } from '../../core/HapticUtils';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback/src/types.ts';
import {
  checkFileNumberLimit,
  getFileTypeSummary,
  isAllFileReady,
} from '../util/FileUtils.ts';
import { showInfo } from '../../core/ToastUtils';
import type { ChatRefs, ChatSetters } from './ChatSharedState.ts';

const BOT_ID = 2;
const APP_PROMPT_NAME = 'App';
const imagePlaceholder = '![](bedrock://imgProgress)';
const textPlaceholder = '...';

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

const findLatestHtmlCode = (messages: SwiftChatMessage[]): string => {
  for (const msg of messages) {
    if (msg.user._id === BOT_ID && msg.htmlCode) {
      return msg.htmlCode;
    }
  }
  return '';
};

type UseChatStreamingParams = {
  refs: ChatRefs;
  setters: ChatSetters;
  messages: SwiftChatMessage[];
  chatStatus: ChatStatus;
  saveCurrentMessages: () => void;
  scroll: {
    scrollToBottom: (animated?: boolean) => void;
    setUserScrolled: React.Dispatch<React.SetStateAction<boolean>>;
  };
};

export function useChatStreaming(params: UseChatStreamingParams) {
  const { refs, setters, messages, saveCurrentMessages, scroll } =
    params;

  // invoke bedrock api
  useEffect(() => {
    const lastMessage = getLatestMessage(messages);
    if (
      lastMessage &&
      lastMessage.user &&
      lastMessage.user._id === BOT_ID &&
      lastMessage.text ===
        (refs.modeRef.current === ChatMode.Text
          ? textPlaceholder
          : imagePlaceholder) &&
      refs.chatStatusRef.current === ChatStatus.Running
    ) {
      if (refs.modeRef.current === ChatMode.Image) {
        refs.sendEventRef.current('onImageStart');
      }

      (async () => {
        const streamingSessionId = refs.sessionIdRef.current;
        const localCancelFlag = { current: false };
        refs.activeCancelFlagRef.current = localCancelFlag;
        refs.controllerRef.current = new AbortController();

        if (
          refs.isAppModeRef.current ||
          refs.systemPromptRef.current?.name === APP_PROMPT_NAME
        ) {
          backgroundStreamManager.register(streamingSessionId, {
            sessionId: streamingSessionId,
            text: '',
            reasoning: '',
            usage: refs.usageRef.current,
            cancelFlag: localCancelFlag,
            controller: refs.controllerRef.current,
            htmlCode: getLatestHtmlCode(),
            isComplete: false,
            needStop: false,
            messages: [...refs.messagesRef.current],
            bedrockMessages: [...refs.bedrockMessages.current],
          });
          if (refs.isNewChatRef.current) {
            saveCurrentMessages();
            refs.sendEventRef.current('updateHistory');
          }
        }

        const userMessage =
          messages.length > 1 ? messages[1]?.text : null;

        let webSearchSystemPrompt;
        let webSearchCitations: Citation[] | undefined;
        if (userMessage && refs.modeRef.current === ChatMode.Text) {
          try {
            const webSearchResult = await webSearchOrchestrator.execute(
              userMessage,
              refs.bedrockMessages.current,
              (phase: string) => {
                setters.setSearchPhase(phase);
              },
              undefined,
              refs.controllerRef.current
            );
            if (webSearchResult) {
              webSearchSystemPrompt = webSearchResult.systemPrompt;
              webSearchCitations = webSearchResult.citations;
            }
          } catch (error) {
            console.log('❌ Web search error in ChatScreen:', error);
          }
        }

        if (localCancelFlag.current) {
          setters.setChatStatus(ChatStatus.Init);
          setters.setSearchPhase('');
          return;
        }

        setters.setSearchPhase('');
        const startRequestTime = new Date().getTime();
        let latencyMs = 0;
        let metrics: Metrics | undefined;

        const effectiveSystemPrompt =
          webSearchSystemPrompt || refs.systemPromptRef.current;

        const currentHtmlCode = getLatestHtmlCode();
        const lastMsgContent = refs.bedrockMessages.current[
          refs.bedrockMessages.current.length - 1
        ]?.content[0] as { text?: string };
        const originalText = lastMsgContent?.text;
        if (refs.isAppModeRef.current && currentHtmlCode && originalText) {
          lastMsgContent.text = `Current app code:\n\`\`\`html\n${currentHtmlCode}\n\`\`\`\n\nUser request: ${originalText}`;
        }

        invokeBedrockWithCallBack(
          refs.bedrockMessages.current,
          refs.modeRef.current as ChatMode,
          effectiveSystemPrompt,
          () => localCancelFlag.current,
          refs.controllerRef.current,
          (
            msg: string,
            complete: boolean,
            needStop: boolean,
            usageInfo?: Usage,
            reasoning?: string
          ) => {
            const isBackground =
              streamingSessionId !== refs.sessionIdRef.current;
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

            if (refs.chatStatusRef.current !== ChatStatus.Running) {
              return;
            }
            if (latencyMs === 0) {
              latencyMs = new Date().getTime() - startRequestTime;
            }
            const updateMessage = () => {
              if (usageInfo) {
                setters.setUsage(prevUsage => ({
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
                if (!metrics && refs.modeRef.current === ChatMode.Text) {
                  metrics = {
                    latencyMs: (latencyMs / 1000).toFixed(2),
                    speed: speed.toFixed(speed > 100 ? 1 : 2),
                  };
                }
              }
              const previousMessage = getLatestMessage(refs.messagesRef.current);
              if (
                previousMessage &&
                (previousMessage.text !== msg ||
                  previousMessage.reasoning !== reasoning ||
                  (!previousMessage.metrics && metrics))
              ) {
                setters.setMessages(prevMessages =>
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
              setters.setChatStatus(ChatStatus.Complete);
            };
            if (refs.modeRef.current === ChatMode.Text) {
              trigger(HapticFeedbackTypes.selection);
              updateMessage();
              if (complete) {
                setComplete();
              }
            } else {
              if (needStop) {
                refs.sendEventRef.current('onImageStop');
              } else {
                refs.sendEventRef.current('onImageComplete');
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

        if (originalText && lastMsgContent) {
          lastMsgContent.text = originalText;
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Shared function for regenerate and edit-submit
  const regenerateFromUserMessage = useCallback(
    (userMessageIndex: number, newText?: string) => {
      scroll.setUserScrolled(false);
      trigger(HapticFeedbackTypes.impactMedium);

      const historyMessages =
        refs.messagesRef.current.slice(userMessageIndex + 1);

      if (refs.isAppModeRef.current) {
        const foundHtmlCode = findLatestHtmlCode(historyMessages);
        if (foundHtmlCode) {
          setLatestHtmlCode(foundHtmlCode);
        } else if (!newText) {
          clearLatestHtmlCode();
        }
      }

      const userMessage: SwiftChatMessage = newText
        ? { ...refs.messagesRef.current[userMessageIndex], text: newText }
        : refs.messagesRef.current[userMessageIndex];

      getBedrockMessagesFromChatMessages([
        userMessage,
        ...historyMessages,
      ]).then(historyBedrockMessages => {
        refs.bedrockMessages.current = historyBedrockMessages;
        setters.setChatStatus(ChatStatus.Running);
        setters.setMessages(_previousMessages => [
          createBotMessage(refs.modeRef.current as string),
          userMessage,
          ...historyMessages,
        ]);
        scroll.scrollToBottom();
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // handle onSend
  const onSend = useCallback(async (message: SwiftChatMessage[] = []) => {
    scroll.setUserScrolled(false);
    const files = refs.selectedFilesRef.current;
    if (!isAllFileReady(files)) {
      showInfo('please wait for all videos to be ready');
      return;
    }

    if (message[0]?.text || files.length > 0) {
      if (!message[0]?.text) {
        if (refs.modeRef.current === ChatMode.Text) {
          if (refs.systemPromptRef.current) {
            message[0].text = refs.systemPromptRef.current.name;
          } else {
            message[0].text = getFileTypeSummary(files);
          }
        } else {
          message[0].text =
            refs.systemPromptRef.current?.prompt ?? 'Empty Message';
          if (refs.systemPromptRef.current?.id === -7) {
            const { saveLastVirtualTryOnImgFile, saveCurrentImageSystemPrompt } =
              require('../../storage/StorageUtils.ts');
            saveLastVirtualTryOnImgFile(files[0]);
            saveCurrentImageSystemPrompt(null);
            refs.sendEventRef.current('unSelectSystemPrompt');
          }
        }
      } else {
        if (
          refs.modeRef.current === ChatMode.Image &&
          refs.systemPromptRef.current
        ) {
          message[0].text =
            refs.systemPromptRef.current?.prompt + '\n' + message[0].text;
        }
      }

      if (refs.selectedFilesRef.current.length > 0) {
        message[0].image = JSON.stringify(refs.selectedFilesRef.current);
        setters.setSelectedFiles([]);
      }
      trigger(HapticFeedbackTypes.impactMedium);
      scroll.scrollToBottom();

      getBedrockMessage(message[0]).then(currentMsg => {
        refs.bedrockMessages.current.push(currentMsg);
        setters.setChatStatus(ChatStatus.Running);
        setters.setMessages(previousMessages => [
          createBotMessage(refs.modeRef.current as string),
          ...appendMessages(previousMessages, message),
        ]);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewFileSelected = useCallback(
    (files: FileInfo[]) => {
      setters.setSelectedFiles(prevFiles => {
        const isVirtualTryOn =
          refs.modeRef.current === ChatMode.Image &&
          refs.systemPromptRef.current?.id === -7;
        return checkFileNumberLimit(
          prevFiles,
          files,
          refs.modeRef.current as ChatMode,
          isVirtualTryOn
        );
      });
    },
    [refs, setters]
  );

  return {
    onSend,
    regenerateFromUserMessage,
    handleNewFileSelected,
    createBotMessage,
  };
}
