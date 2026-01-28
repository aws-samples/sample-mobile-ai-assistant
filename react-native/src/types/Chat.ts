import React from 'react';

export interface Citation {
  number: number; // 引用编号 [1], [2], [3]...
  title: string; // 链接标题
  url: string; // 链接地址
  excerpt?: string; // 简介/摘要
}

export type Chat = {
  id: number;
  title: string;
  mode: string;
  timestamp: number;
};

export enum ChatStatus {
  Init = 'Init',
  Running = 'Running',
  Complete = 'Complete',
}

export interface EventData {
  id?: number;
  prompt?: SystemPrompt;
  // WebView search events
  url?: string;
  script?: string;
  data?: string;
  error?: string;
  code?: number;
  // App mode events
  htmlCode?: string;
  diffCode?: string;
}

export type Model = {
  modelId: string;
  modelName: string;
  modelTag?: string;
  uniqueId?: string;
  apiKey?: string;
  apiUrl?: string;
};

export enum ModelTag {
  Bedrock = 'Bedrock',
  OpenAI = 'OpenAI',
  OpenAICompatible = 'OpenAICompatible',
  DeepSeek = 'DeepSeek',
  Ollama = 'Ollama',
}

export type OllamaModel = {
  name: string;
};

export type OpenAICompatConfig = {
  id: string;
  baseUrl: string;
  apiKey: string;
  modelIds: string;
  name?: string;
};

export type AllModel = {
  textModel: Model[];
  imageModel: Model[];
};

export enum ChatMode {
  Text = 'Text',
  Image = 'Image',
}

export type ImageRes = {
  image: string;
  error: string;
};

export enum PressMode {
  Click = 'Click',
  LongPress = 'LongPress',
}

export interface DropdownItem {
  label: string;
  value: string;
}

export type UpgradeInfo = {
  needUpgrade: boolean;
  version: string;
  url: string;
};

export enum FileType {
  document = 'document',
  image = 'image',
  video = 'video',
  unSupported = 'unSupported',
}

export type FileInfo = {
  fileName: string;
  url: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  fileSize: number;
  format: string;
  type: FileType;
  width?: number;
  height?: number;
};

export type Usage = {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  imageCount?: number;
  smallImageCount?: number;
  largeImageCount?: number;
};

export type UsagePrice = {
  modelName: string;
  inputPrice: number;
  outputPrice: number;
  totalPrice: number;
  smallImagePrice: number;
  mediumImagePrice: number;
  largeImagePrice: number;
};

export interface SwiftChatUser {
  _id: string | number;
  name?: string;
  avatar?: string | number | (() => React.ReactNode);
  modelTag?: string;
}

export interface SwiftChatMessage {
  _id: string | number;
  text: string;
  createdAt: Date | number;
  user: SwiftChatUser;
  image?: string;
  video?: string;
  audio?: string;
  system?: boolean;
  sent?: boolean;
  received?: boolean;
  pending?: boolean;
  quickReplies?: {
    type: 'radio' | 'checkbox';
    values: Array<{
      title: string;
      value: string;
      messageId?: string | number;
    }>;
    keepIt?: boolean;
  };
  // Swift Chat custom fields
  usage?: Usage;
  reasoning?: string;
  metrics?: Metrics;
  citations?: Citation[];
  htmlCode?: string;
  diffCode?: string;
  isLastHtml?: boolean;
}

export interface SystemPrompt {
  id: number;
  name: string;
  prompt: string;
  includeHistory: boolean;
  promptType?: string; // 'image' 'voice' or undefined
  allowInterruption?: boolean;
}

export interface BedrockChunk {
  contentBlockDelta: {
    delta: Delta;
  };
  metadata: {
    usage: Usage;
  };
  detail: string;
}

export interface BedrockAPIChunk {
  delta: Delta;
  usage: Usage;
  stopReason: string;
  Message: string;
  message: string;
}

export interface Delta {
  text: string;
  reasoningContent: ReasoningContent;
}

export interface ReasoningContent {
  text: string;
}

export type TokenResponse = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  error: string;
  apiKey?: string;
};

export interface Metrics {
  latencyMs: string;
  speed: string;
}

export interface SavedApp {
  id: string;
  name: string;
  htmlCode: string;
  screenshotPath?: string;
  createdAt: number;
}
