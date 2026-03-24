import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { voiceChatService } from '../service/VoiceChatService';
import { ChatStatus, SwiftChatMessage } from '../../types/Chat.ts';
import { getTextModel } from '../../storage/StorageUtils.ts';
import { AudioWaveformRef } from '../component/input/AudioWaveformComponent';
import { getLatestMessage, updateLatestMessage } from '../util/messageUtils.ts';

const BOT_ID = 2;

export function useChatVoice(
  setChatStatus: React.Dispatch<React.SetStateAction<ChatStatus>>,
  messagesRef: React.MutableRefObject<SwiftChatMessage[]>,
  setMessages: React.Dispatch<React.SetStateAction<SwiftChatMessage[]>>,
  saveCurrentMessagesRef: React.MutableRefObject<() => void>
) {
  const isVoiceLoading = useRef(false);
  const [isShowVoiceLoading, setIsShowVoiceLoading] = useState(false);
  const audioWaveformRef = useRef<AudioWaveformRef>(null);
  const endVoiceConversationRef = useRef<(() => Promise<boolean>) | null>(null);

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
  }, [setChatStatus]);

  useEffect(() => {
    endVoiceConversationRef.current = endVoiceConversation;
  }, [endVoiceConversation]);

  const handleVoiceChatTranscript = useCallback(
    (role: string, text: string) => {
      const userId = role === 'USER' ? 1 : BOT_ID;
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
        setMessages(previousMessages => [newMessage, ...previousMessages]);
      }
    },
    [messagesRef, setMessages]
  );

  // Initialize voice chat service
  useEffect(() => {
    voiceChatService.setCallbacks(
      (role, text) => {
        handleVoiceChatTranscript(role, text);
      },
      message => {
        if (getTextModel().modelId.includes('sonic')) {
          handleVoiceChatTranscript('ASSISTANT', message);
          endVoiceConversationRef.current?.();
          saveCurrentMessagesRef.current();
          console.log('Voice chat error:', message);
        }
      }
    );

    return () => {
      voiceChatService.cleanup();
    };
  }, [handleVoiceChatTranscript, saveCurrentMessagesRef]);

  const onVoiceChatToggle = useCallback(() => {
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
    });
  }, [setChatStatus]);

  return {
    isShowVoiceLoading,
    audioWaveformRef,
    endVoiceConversation,
    endVoiceConversationRef,
    onVoiceChatToggle,
  };
}
