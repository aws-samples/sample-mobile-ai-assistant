import { useEffect } from 'react';
import {
  ChatMode,
  ChatStatus,
  SwiftChatMessage,
  EventData,
} from '../../types/Chat.ts';
import {
  getMessagesBySessionId,
  getSessionId,
  saveCurrentSystemPrompt,
  saveCurrentVoiceSystemPrompt,
  saveCurrentImageSystemPrompt,
} from '../../storage/StorageUtils.ts';
import { getBedrockMessagesFromChatMessages } from '../../api/BedrockMessageConvertor.ts';
import {
  setLatestHtmlCode,
  getLatestHtmlCode,
} from '../../appgen/util/DiffUtils.ts';
import { backgroundStreamManager } from '../../appgen/service/BackgroundStreamManager.ts';
import { startBackgroundTaskIfNeeded } from '../service/BackgroundTaskService.ts';
import { getLatestMessage, updateLatestMessage } from '../util/messageUtils.ts';
import { isMac } from '../../App.tsx';
import type { ChatRefs, ChatSetters } from './ChatSharedState.ts';

const BOT_ID = 2;
const APP_PROMPT_NAME = 'App';
const imagePlaceholder = '![](bedrock://imgProgress)';

const findLatestHtmlCode = (messages: SwiftChatMessage[]): string => {
  for (const msg of messages) {
    if (msg.user._id === BOT_ID && msg.htmlCode) {
      return msg.htmlCode;
    }
  }
  return '';
};

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

export { findLatestHtmlCode, isAppModeSession };

type UseChatSessionParams = {
  refs: ChatRefs;
  setters: ChatSetters;
  initialSessionId: number | undefined;
  tapIndex: number | undefined;
  mode: string;
  editAppCode: string | undefined;
  editAppName: string | undefined;
  editTimestamp: number | undefined;
  event: { event: string; params?: EventData } | null;
  saveCurrentMessages: () => void;
  startNewChat: React.MutableRefObject<() => void>;
  scroll: {
    scrollToBottom: (animated?: boolean) => void;
    showKeyboard: () => void;
  };
  voice: {
    endVoiceConversationRef: React.MutableRefObject<
      (() => Promise<boolean>) | null
    >;
  };
};

export function useChatSession(params: UseChatSessionParams) {
  const {
    refs,
    setters,
    initialSessionId,
    tapIndex,
    mode,
    editAppCode,
    editAppName,
    editTimestamp,
    event,
    saveCurrentMessages,
    startNewChat,
    scroll,
    voice,
  } = params;

  // sessionId changes (start new chat or click another session)
  useEffect(() => {
    if (tapIndex && initialSessionId) {
      if (refs.sessionIdRef.current === initialSessionId) {
        return;
      }
      if (refs.chatStatusRef.current === ChatStatus.Running) {
        const isAppStreaming =
          (refs.isAppModeRef.current ||
            refs.systemPromptRef.current?.name === APP_PROMPT_NAME) &&
          refs.modeRef.current === ChatMode.Text;
        if (isAppStreaming) {
          backgroundStreamManager.register(refs.sessionIdRef.current, {
            sessionId: refs.sessionIdRef.current,
            text: getLatestMessage(refs.messagesRef.current)?.text || '',
            reasoning:
              getLatestMessage(refs.messagesRef.current)?.reasoning || '',
            usage: refs.usageRef.current,
            cancelFlag: refs.activeCancelFlagRef.current,
            controller: refs.controllerRef.current!,
            htmlCode: getLatestHtmlCode(),
            isComplete: false,
            needStop: false,
            messages: [...refs.messagesRef.current],
            bedrockMessages: [...refs.bedrockMessages.current],
          });
          saveCurrentMessages();
          startBackgroundTaskIfNeeded();
          refs.sendEventRef.current('updateHistory');
        } else {
          refs.controllerRef.current?.abort();
          refs.activeCancelFlagRef.current.current = true;
          if (refs.modeRef.current === ChatMode.Image) {
            const lastMsg = getLatestMessage(refs.messagesRef.current);
            if (lastMsg && lastMsg.text === imagePlaceholder) {
              setters.setMessages(
                updateLatestMessage(refs.messagesRef.current, msg => ({
                  ...msg,
                  text: 'Request interrupted',
                }))
              );
            }
          }
          saveCurrentMessages();
        }
        refs.chatStatusRef.current = ChatStatus.Init;
      }
      if (refs.modeRef.current !== mode) {
        refs.modeRef.current = mode;
        setTimeout(() => {
          refs.sendEventRef.current?.('unSelectSystemPrompt');
        }, 50);
        setters.setSelectedFiles([]);
      }
      setters.setChatStatus(ChatStatus.Init);
      refs.sendEventRef.current('');
      setters.setUsage(undefined);
      if (initialSessionId === 0 || initialSessionId === -1) {
        startNewChat.current();
        return;
      }
      setters.setMessages([]);
      refs.isNewChatRef.current = false;
      setters.setIsLoadingMessages(true);
      refs.sessionIdRef.current = initialSessionId;

      const bgStream = backgroundStreamManager.get(initialSessionId);
      if (bgStream) {
        setLatestHtmlCode(bgStream.htmlCode);
        refs.isAppModeRef.current = true;
        if (bgStream.isComplete) {
          setters.setMessages(bgStream.messages);
          setters.setUsage(bgStream.messages[0]?.usage);
          getBedrockMessagesFromChatMessages(bgStream.messages).then(m => {
            refs.bedrockMessages.current = m;
          });
        } else {
          const restoredMessages = [...bgStream.messages];
          restoredMessages[0] = {
            ...restoredMessages[0],
            text: bgStream.text,
            reasoning: bgStream.reasoning,
          };
          setters.setMessages(restoredMessages);
          refs.messagesRef.current = restoredMessages;
          refs.activeCancelFlagRef.current = bgStream.cancelFlag;
          refs.controllerRef.current = bgStream.controller;
          refs.bedrockMessages.current = bgStream.bedrockMessages;
          refs.chatStatusRef.current = ChatStatus.Running;
          setters.setChatStatus(ChatStatus.Running);
        }
        if (bgStream.isComplete) {
          backgroundStreamManager.remove(initialSessionId);
        }
        refs.sendEventRef.current?.('selectAppPrompt');
        setters.setIsLoadingMessages(false);
        scroll.scrollToBottom();
        scroll.showKeyboard();
        return;
      }

      voice.endVoiceConversationRef.current?.();

      const msg = getMessagesBySessionId(initialSessionId);
      const latestMsg = getLatestMessage(msg);
      setters.setUsage(latestMsg?.usage);
      const restoredHtmlCode = findLatestHtmlCode(msg as SwiftChatMessage[]);
      setLatestHtmlCode(restoredHtmlCode);

      if (isAppModeSession(msg as SwiftChatMessage[])) {
        refs.isAppModeRef.current = true;
        refs.sendEventRef.current?.('selectAppPrompt');
      } else {
        setters.setSystemPrompt(null);
        saveCurrentSystemPrompt(null);
        saveCurrentVoiceSystemPrompt(null);
        saveCurrentImageSystemPrompt(null);
        refs.sendEventRef.current?.('unSelectSystemPrompt');
      }
      getBedrockMessagesFromChatMessages(msg).then(currentMessage => {
        refs.bedrockMessages.current = currentMessage;
      });
      if (isMac) {
        setters.setMessages(msg);
        setters.setIsLoadingMessages(false);
        scroll.scrollToBottom();
        scroll.showKeyboard();
      } else {
        setTimeout(() => {
          setters.setMessages(msg);
          setters.setIsLoadingMessages(false);
          scroll.scrollToBottom();
        }, 200);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, mode, tapIndex]);

  // editAppCode handler
  useEffect(() => {
    if (editAppCode && editTimestamp) {
      startNewChat.current();
      setters.setUsage(undefined);
      setLatestHtmlCode(editAppCode);
      refs.isAppModeRef.current = true;
      setTimeout(() => {
        refs.sendEventRef.current?.('selectAppPrompt');
        if (editAppName) {
          const hintText = `Edit [${editAppName}]: `;
          refs.chatComponentRef.current?.setInputText(hintText);
          refs.inputTextRef.current = hintText;
          setters.setHasInputText(true);
        }
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editAppCode, editAppName, editTimestamp]);

  // deleteChat listener
  useEffect(() => {
    if (event?.event === 'deleteChat' && event.params) {
      const { id } = event.params;
      if (id && backgroundStreamManager.has(id)) {
        backgroundStreamManager.stop(id);
        backgroundStreamManager.remove(id);
      }
      if (refs.sessionIdRef.current === id) {
        refs.sessionIdRef.current =
          getSessionId() + 1;
        refs.sendEventRef.current('updateHistorySelectedId', {
          id: refs.sessionIdRef.current,
        });
        setters.setUsage(undefined);
        refs.bedrockMessages.current = [];
        setters.setMessages([]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // htmlCodeGenerated listener
  useEffect(() => {
    if (event?.event === 'htmlCodeGenerated' && event.params?.htmlCode) {
      const { htmlCode } = event.params;
      setters.setMessages(prevMessages => {
        return prevMessages.map((msg, index) => {
          if (index === 0) {
            return { ...msg, htmlCode: htmlCode, isLastHtml: true };
          } else if (msg.isLastHtml) {
            return { ...msg, isLastHtml: false };
          }
          return msg;
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  // diffApplied listener
  useEffect(() => {
    if (event?.event === 'diffApplied' && event.params?.diffCode) {
      const { htmlCode, diffCode } = event.params;
      setters.setMessages(prevMessages => {
        return prevMessages.map((msg, index) => {
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
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
