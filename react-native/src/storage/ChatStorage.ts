import { Chat, ChatMode, SwiftChatMessage, Usage } from '../types/Chat.ts';
import { storage } from './StorageUtils.ts';
import { clearSavedApps } from './AppStorage.ts';

const keyPrefix = 'bedrock/';
const messageListKey = keyPrefix + 'messageList';
const sessionIdPrefix = keyPrefix + 'sessionId/';
const currentSessionIdKey = keyPrefix + 'currentSessionId';
const modelUsageKey = keyPrefix + 'modelUsageKey';

export function saveMessages(
  sessionId: number,
  messages: SwiftChatMessage[],
  usage: Usage
) {
  messages[0].usage = usage;
  messages.forEach((message, index) => {
    if (index !== 0 && 'usage' in message) {
      delete message.usage;
    }
  });
  storage.set(sessionIdPrefix + sessionId, JSON.stringify(messages));
}

export function saveMessageList(
  sessionId: number,
  fistMessage: SwiftChatMessage,
  chatMode: ChatMode
) {
  let allMessageStr = getMessageListStr();
  const currentMessageStr = JSON.stringify({
    id: sessionId,
    title: fistMessage.text.substring(0, 50).replaceAll('\n', ' '),
    mode: chatMode.toString(),
    timestamp: (fistMessage.createdAt as Date).getTime(),
  });
  if (allMessageStr.length === 1) {
    allMessageStr = currentMessageStr + allMessageStr;
  } else {
    allMessageStr = currentMessageStr + ',' + allMessageStr;
  }
  storage.set(messageListKey, allMessageStr);
  storage.set(currentSessionIdKey, sessionId);
}

export function getMessageList(): Chat[] {
  return JSON.parse('[' + getMessageListStr()) as Chat[];
}

export function updateMessageList(chatList: Chat[]) {
  if (chatList.length > 0) {
    storage.set(messageListKey, JSON.stringify(chatList).substring(1));
  } else {
    storage.delete(messageListKey);
  }
}

function getMessageListStr() {
  return storage.getString(messageListKey) ?? ']';
}

export function getMessagesBySessionId(sessionId: number): SwiftChatMessage[] {
  const messageStr = storage.getString(sessionIdPrefix + sessionId);
  if (messageStr) {
    return JSON.parse(messageStr) as SwiftChatMessage[];
  }
  return [];
}

export function deleteMessagesBySessionId(sessionId: number) {
  storage.delete(sessionIdPrefix + sessionId);
}

export function getSessionId() {
  return storage.getNumber(currentSessionIdKey) ?? 0;
}

export function getModelUsage(): Usage[] {
  const usage = storage.getString(modelUsageKey);
  return usage ? JSON.parse(usage) : [];
}

export function updateTotalUsage(usage: Usage) {
  const currentUsage = getModelUsage();
  const modelIndex = currentUsage.findIndex(
    m => m.modelName === usage.modelName
  );
  if (modelIndex >= 0) {
    if (usage.imageCount) {
      currentUsage[modelIndex].imageCount! += usage.imageCount;
    } else if (usage.smallImageCount) {
      currentUsage[modelIndex].smallImageCount! += usage.smallImageCount;
    } else if (usage.largeImageCount) {
      currentUsage[modelIndex].largeImageCount! += usage.largeImageCount;
    } else {
      currentUsage[modelIndex].inputTokens += usage.inputTokens;
      currentUsage[modelIndex].outputTokens += usage.outputTokens;
    }
  } else {
    currentUsage.push(usage);
  }
  storage.set(modelUsageKey, JSON.stringify(currentUsage));
}

// Clear all chat history and related data
export function clearAllChatHistory(): void {
  const chatList = getMessageList();
  chatList.forEach(chat => {
    storage.delete(sessionIdPrefix + chat.id);
  });
  storage.delete(messageListKey);
  storage.delete(currentSessionIdKey);
  clearSavedApps();
}
