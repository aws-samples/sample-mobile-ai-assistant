import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
} from 'react-native';

const { LiteRTModule } = NativeModules;
const liteRTEmitter = LiteRTModule
  ? new NativeEventEmitter(LiteRTModule)
  : null;

export class LiteRTService {
  private isInitialized = false;
  private subscriptions: EmitterSubscription[] = [];
  private onTokenCallback?: (text: string) => void;
  private onCompleteCallback?: (text: string) => void;
  private onErrorCallback?: (message: string) => void;

  public setCallbacks(
    onToken?: (text: string) => void,
    onComplete?: (text: string) => void,
    onError?: (message: string) => void
  ) {
    this.onTokenCallback = onToken;
    this.onCompleteCallback = onComplete;
    this.onErrorCallback = onError;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.cleanup();
    if (liteRTEmitter) {
      const tokenSub = liteRTEmitter.addListener('onLiteRTToken', event => {
        if (this.onTokenCallback) {
          this.onTokenCallback(event.text);
        }
      });

      const completeSub = liteRTEmitter.addListener(
        'onLiteRTComplete',
        event => {
          if (this.onCompleteCallback) {
            this.onCompleteCallback(event.text);
          }
        }
      );

      const errorSub = liteRTEmitter.addListener('onLiteRTError', event => {
        if (this.onErrorCallback) {
          this.onErrorCallback(event.message);
        }
      });

      this.subscriptions = [tokenSub, completeSub, errorSub];
    }
  }

  public async initialize(maxTokens: number = 4096): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      this.onErrorCallback?.('LiteRT is only available on iOS');
      return false;
    }
    if (!LiteRTModule) {
      this.onErrorCallback?.('LiteRT module not available');
      return false;
    }
    if (this.isInitialized) {
      return true;
    }

    try {
      await LiteRTModule.initialize({ maxTokens });
      this.isInitialized = true;
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.onErrorCallback?.(`LiteRT initialization failed: ${errorMessage}`);
      return false;
    }
  }

  public async sendMessage(
    text: string,
    systemPrompt?: string,
    imagePaths?: string[]
  ): Promise<string | null> {
    if (!LiteRTModule || !this.isInitialized) {
      this.onErrorCallback?.('LiteRT engine not ready');
      return null;
    }

    try {
      const result = await LiteRTModule.sendMessage(
        text,
        systemPrompt || null,
        imagePaths || null
      );
      return result.text;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.onErrorCallback?.(`Send message failed: ${errorMessage}`);
      return null;
    }
  }

  public async stopGeneration(): Promise<void> {
    if (LiteRTModule) {
      await LiteRTModule.stopGeneration();
    }
  }

  public async resetConversation(): Promise<void> {
    if (LiteRTModule) {
      await LiteRTModule.resetConversation();
    }
  }

  public async getModelStatus(): Promise<{
    modelExists: boolean;
    engineReady: boolean;
    modelPath: string;
  } | null> {
    if (!LiteRTModule) {
      return null;
    }
    try {
      return await LiteRTModule.getModelStatus();
    } catch {
      return null;
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public cleanup() {
    this.subscriptions.forEach(sub => sub.remove());
    this.subscriptions = [];
  }
}

export const liteRTService = new LiteRTService();
