import { SwiftChatMessage } from '../../types/Chat';

// Data structure: [newest, ..., oldest] for inverted FlatList

// Prepend new messages to array beginning
export const appendMessages = (
  currentMessages: SwiftChatMessage[],
  newMessages: SwiftChatMessage[]
): SwiftChatMessage[] => [...newMessages, ...currentMessages];

// Get the newest message (index 0)
export const getLatestMessage = (
  messages: SwiftChatMessage[]
): SwiftChatMessage | undefined => messages[0];

// Get message at position n (0=newest, 1=second newest, etc.)
export const getMessageFromEnd = (
  messages: SwiftChatMessage[],
  n: number
): SwiftChatMessage | undefined => messages[n];

// Update the newest message (index 0)
export const updateLatestMessage = (
  messages: SwiftChatMessage[],
  updater: (msg: SwiftChatMessage) => SwiftChatMessage
): SwiftChatMessage[] => {
  if (messages.length === 0) {
    return messages;
  }
  const newMessages = [...messages];
  newMessages[0] = updater(messages[0]);
  return newMessages;
};
