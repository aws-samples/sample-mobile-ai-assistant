import { SwiftChatMessage, Usage, Metrics, Citation } from '../../types/Chat';
import { BedrockMessage } from '../util/BedrockMessageConvertor';
import {
  saveMessages,
  updateTotalUsage,
} from '../../storage/StorageUtils';
import {
  replaceHtmlWithPlaceholder,
  replaceDiffWithPlaceholder,
} from '../util/DiffUtils';
import { applyDiff } from '../util/ApplyDiff';

export interface BackgroundStream {
  sessionId: number;
  text: string;
  reasoning: string;
  usage?: Usage;
  metrics?: Metrics;
  citations?: Citation[];
  cancelFlag: { current: boolean };
  controller: AbortController;
  htmlCode: string;
  isComplete: boolean;
  needStop: boolean;
  messages: SwiftChatMessage[];
  bedrockMessages: BedrockMessage[];
}

type ActiveIdsListener = (activeIds: Set<number>) => void;

class BackgroundStreamManager {
  private static instance: BackgroundStreamManager;
  private streams = new Map<number, BackgroundStream>();
  private listeners = new Set<ActiveIdsListener>();

  static getInstance(): BackgroundStreamManager {
    if (!this.instance) {
      this.instance = new BackgroundStreamManager();
    }
    return this.instance;
  }

  onActiveIdsChanged(listener: ActiveIdsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const ids = new Set(this.getActiveSessionIds());
    this.listeners.forEach(l => l(ids));
  }

  register(sessionId: number, stream: BackgroundStream): void {
    this.streams.set(sessionId, stream);
    this.notifyListeners();
  }

  get(sessionId: number): BackgroundStream | undefined {
    return this.streams.get(sessionId);
  }

  has(sessionId: number): boolean {
    return this.streams.has(sessionId);
  }

  remove(sessionId: number): void {
    this.streams.delete(sessionId);
    this.notifyListeners();
  }

  removeCompleted(): void {
    let removed = false;
    this.streams.forEach((s, id) => {
      if (s.isComplete) {
        this.streams.delete(id);
        removed = true;
      }
    });
    if (removed) {
      this.notifyListeners();
    }
  }

  isStreaming(sessionId: number): boolean {
    const s = this.streams.get(sessionId);
    return s !== undefined && !s.isComplete;
  }

  getTotalCount(): number {
    return this.streams.size;
  }

  getActiveCount(): number {
    let count = 0;
    this.streams.forEach(s => {
      if (!s.isComplete) {
        count++;
      }
    });
    return count;
  }

  getActiveSessionIds(): number[] {
    const ids: number[] = [];
    this.streams.forEach((s, id) => {
      if (!s.isComplete) {
        ids.push(id);
      }
    });
    return ids;
  }

  stop(sessionId: number): void {
    const s = this.streams.get(sessionId);
    if (s) {
      s.cancelFlag.current = true;
      s.controller.abort();
    }
  }

  update(
    sessionId: number,
    data: {
      text?: string;
      reasoning?: string;
      usage?: Usage;
      metrics?: Metrics;
      citations?: Citation[];
    }
  ): void {
    const s = this.streams.get(sessionId);
    if (!s) {
      return;
    }
    if (data.text !== undefined) {
      s.text = data.text;
    }
    if (data.reasoning !== undefined) {
      s.reasoning = data.reasoning;
    }
    if (data.usage) {
      s.usage = data.usage;
    }
    if (data.metrics) {
      s.metrics = data.metrics;
    }
    if (data.citations) {
      s.citations = data.citations;
    }
  }

  markComplete(sessionId: number, needStop: boolean): void {
    const stream = this.streams.get(sessionId);
    if (!stream) {
      return;
    }
    stream.isComplete = true;
    stream.needStop = needStop;
    this.notifyListeners();

    // Update the latest bot message in the snapshot
    if (stream.messages.length > 0) {
      const latestMsg = stream.messages[0]; // inverted: index 0 is newest
      latestMsg.text =
        stream.text || (needStop ? 'Canceled...' : '...');
      latestMsg.reasoning = stream.reasoning || undefined;
      latestMsg.metrics = stream.metrics;
      latestMsg.citations = stream.citations;
      if (stream.usage) {
        latestMsg.usage = stream.usage;
      }

      // Extract HTML/diff from completed text and handle htmlCode
      this.processAppCode(stream, latestMsg);

      // Replace HTML/diff with placeholders to save context tokens
      if (latestMsg.htmlCode) {
        latestMsg.text = replaceHtmlWithPlaceholder(
          latestMsg.text,
          latestMsg.htmlCode
        );
      }
      if (latestMsg.diffCode && latestMsg.htmlCode) {
        latestMsg.text = replaceDiffWithPlaceholder(
          latestMsg.text,
          latestMsg.diffCode
        );
      }
    }

    // Save to storage
    if (stream.usage) {
      saveMessages(sessionId, stream.messages, stream.usage);
      updateTotalUsage(stream.usage);
    }
  }

  private processAppCode(
    stream: BackgroundStream,
    latestMsg: SwiftChatMessage
  ): void {
    const text = stream.text;

    // Check for full HTML code block
    // Use \n before closing ``` to exclude trailing newline from capture,
    // matching markdown parser behavior (code block content excludes fence newlines)
    const htmlMatch = text.match(/```html\n([\s\S]*?)\n```/);
    if (htmlMatch) {
      const htmlCode = htmlMatch[1];
      stream.htmlCode = htmlCode;
      latestMsg.htmlCode = htmlCode;
      latestMsg.isLastHtml = true;
      // Clear isLastHtml on older messages
      for (let i = 1; i < stream.messages.length; i++) {
        if (stream.messages[i].isLastHtml) {
          stream.messages[i].isLastHtml = false;
        }
      }
      return;
    }

    // Check for diff code block
    const diffMatch = text.match(/```diff\n([\s\S]*?)\n```/);
    if (diffMatch && stream.htmlCode) {
      const diffCode = diffMatch[1];
      const { success, result } = applyDiff(stream.htmlCode, diffCode);
      if (success) {
        stream.htmlCode = result;
        latestMsg.htmlCode = result;
        latestMsg.diffCode = diffCode;
        latestMsg.isLastHtml = true;
        for (let i = 1; i < stream.messages.length; i++) {
          if (stream.messages[i].isLastHtml) {
            stream.messages[i].isLastHtml = false;
          }
        }
      }
    }
  }
}

export const backgroundStreamManager = BackgroundStreamManager.getInstance();
