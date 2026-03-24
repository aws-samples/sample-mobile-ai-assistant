import React from 'react';
import {
  ChatMode,
  ChatStatus,
  FileInfo,
  SwiftChatMessage,
  SystemPrompt,
  Usage,
} from '../../types/Chat.ts';
import { BedrockMessage } from '../../api/BedrockMessageConvertor.ts';
import { CustomChatComponentRef } from '../component/message/CustomChatComponent.tsx';
import { EventData } from '../../types/Chat.ts';

export type ChatRefs = {
  messagesRef: React.MutableRefObject<SwiftChatMessage[]>;
  chatStatusRef: React.MutableRefObject<ChatStatus>;
  bedrockMessages: React.MutableRefObject<BedrockMessage[]>;
  sessionIdRef: React.MutableRefObject<number>;
  activeCancelFlagRef: React.MutableRefObject<{ current: boolean }>;
  controllerRef: React.MutableRefObject<AbortController | null>;
  sendEventRef: React.MutableRefObject<
    (event: string, params?: EventData) => void
  >;
  usageRef: React.MutableRefObject<Usage | undefined>;
  systemPromptRef: React.MutableRefObject<SystemPrompt | null>;
  modeRef: React.MutableRefObject<ChatMode | string>;
  isAppModeRef: React.MutableRefObject<boolean>;
  isNewChatRef: React.MutableRefObject<boolean>;
  drawerTypeRef: React.MutableRefObject<string>;
  chatComponentRef: React.RefObject<CustomChatComponentRef | null>;
  inputTextRef: React.MutableRefObject<string>;
  selectedFilesRef: React.MutableRefObject<FileInfo[]>;
};

export type ChatSetters = {
  setMessages: React.Dispatch<React.SetStateAction<SwiftChatMessage[]>>;
  setChatStatus: React.Dispatch<React.SetStateAction<ChatStatus>>;
  setUsage: React.Dispatch<React.SetStateAction<Usage | undefined>>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<FileInfo[]>>;
  setSystemPrompt: React.Dispatch<React.SetStateAction<SystemPrompt | null>>;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  setHasInputText: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchPhase: React.Dispatch<React.SetStateAction<string>>;
};
