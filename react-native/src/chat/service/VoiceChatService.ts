import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
} from 'react-native';
import { DefaultVoicePrompt } from '../../storage/Constants';
import {
  getCurrentVoiceSystemPrompt,
  getVoiceId,
  isTokenValid,
  getTokenInfo,
  getRegion,
  getBedrockConfigMode,
  getBedrockApiKey,
} from '../../storage/StorageUtils.ts';
import { requestToken } from '../../api/bedrock-api.ts';
import { TokenResponse } from '../../types/Chat.ts';

const { VoiceChatModule } = NativeModules;
const voiceChatEmitter = VoiceChatModule
  ? new NativeEventEmitter(VoiceChatModule)
  : null;

export class VoiceChatService {
  private isInitialized = false;
  private subscriptions: EmitterSubscription[] = [];
  private onTranscriptReceivedCallback?: (role: string, text: string) => void;
  private onErrorCallback?: (message: string) => void;
  private onAudioLevelChangedCallback?: (source: string, level: number) => void;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Set callbacks for voice chat events
   * @param onTranscriptReceived Callback when transcript is received
   * @param onError Callback when error occurs
   */
  public setCallbacks(
    onTranscriptReceived?: (role: string, text: string) => void,
    onError?: (message: string) => void
  ) {
    this.onTranscriptReceivedCallback = onTranscriptReceived;
    this.onErrorCallback = onError;
  }

  /**
   * Set OnAudioLevelCallback for voice chat events
   * @param onAudioLevelChanged Callback when audio level changes
   */
  public setOnAudioLevelCallbacks(
    onAudioLevelChanged?: (source: string, level: number) => void
  ) {
    this.onAudioLevelChangedCallback = onAudioLevelChanged;
  }

  /**
   * Setup event listeners for voice chat events
   */
  private setupEventListeners() {
    if (voiceChatEmitter) {
      const transcriptSubscription = voiceChatEmitter.addListener(
        'onTranscriptReceived',
        event => {
          if (this.onTranscriptReceivedCallback) {
            this.onTranscriptReceivedCallback(event.role, event.text);
          }
        }
      );

      const errorSubscription = voiceChatEmitter.addListener(
        'onError',
        event => {
          if (this.onErrorCallback) {
            let errorMsg = event.message ?? '';
            if (errorMsg.includes('The network connection was lost')) {
              errorMsg = '\n**The network connection was lost**';
            } else if (errorMsg.includes('The request timed out')) {
              errorMsg = '\n**The request timed out**';
            } else if (errorMsg.includes('messages cannot be null or empty')) {
              errorMsg = '\n**Messages cannot be null or empty**';
            } else if (
              errorMsg.includes('Timed out waiting for input events')
            ) {
              errorMsg = '\n**Timed out waiting for input events**';
            } else if (
              errorMsg.includes('The operation couldn’t be completed')
            ) {
              errorMsg = '\n**The operation couldn’t be completed**';
            } else if (
              errorMsg.includes(
                'The system encountered an unexpected error during processing. Try your request again.'
              )
            ) {
              errorMsg =
                '\n**The system encountered an unexpected error during processing. Try your request again.**';
            } else if (
              errorMsg.includes('closed stream. HTTP/2 error code: NO_ERROR')
            ) {
              errorMsg = '\n**Stream Closed With NO_ERROR**';
            } else if (
              errorMsg.includes('This operation does not support API Keys')
            ) {
              errorMsg =
                '\nThis operation does not support API Keys, Please switch to [App Server](https://github.com/aws-samples/sample-mobile-ai-assistant?tab=readme-ov-file#getting-started-with-amazon-bedrock) to use Nova Sonic';
            }
            this.onErrorCallback(errorMsg);
          }
        }
      );

      const audioLevelSubscription = voiceChatEmitter.addListener(
        'onAudioLevelChanged',
        event => {
          if (this.onAudioLevelChangedCallback) {
            this.onAudioLevelChangedCallback(event.source, event.level);
          }
        }
      );

      this.subscriptions = [
        transcriptSubscription,
        errorSubscription,
        audioLevelSubscription,
      ];
    }
  }

  /**
   * Get new AWS credentials configuration, requesting a new token if needed
   * @returns Promise<object | null> Configuration object with AWS credentials or null if not available
   */
  private async getValidConfig(): Promise<object | null> {
    // Request new token
    let tokenInfo: TokenResponse | null = null;
    if (getBedrockConfigMode() === 'swiftchat') {
      if (!isTokenValid()) {
        tokenInfo = await requestToken();
        if (!tokenInfo) {
          if (this.onErrorCallback) {
            this.onErrorCallback('Failed to get credentials');
          }
        }
        if (tokenInfo?.error) {
          if (this.onErrorCallback) {
            this.onErrorCallback(tokenInfo.error);
          }
        }
      } else {
        tokenInfo = getTokenInfo();
        if (!tokenInfo) {
          if (this.onErrorCallback) {
            this.onErrorCallback('AWS credentials not available');
          }
        }
      }
    }
    if (getBedrockConfigMode() === 'bedrock') {
      const apiKey = getBedrockApiKey();
      if (apiKey.length > 0) {
        tokenInfo = {
          accessKeyId: '',
          secretAccessKey: '',
          sessionToken: '',
          apiKey: apiKey,
          expiration: '',
          error: '',
        };
      }
    }
    if (!tokenInfo) {
      return null;
    }
    // Create and return config
    return {
      region: getRegion(),
      accessKey: tokenInfo.accessKeyId,
      secretKey: tokenInfo.secretAccessKey,
      sessionToken: tokenInfo.sessionToken,
      apiKey: tokenInfo.apiKey ?? '',
    };
  }

  /**
   * Initialize voice chat module with AWS credentials
   * @returns Promise<boolean> True if initialization is successful
   */
  public async initialize(): Promise<boolean> {
    if (!VoiceChatModule) {
      if (this.onErrorCallback) {
        this.onErrorCallback('Voice chat module not available');
      }
      return false;
    }
    if (this.isInitialized) {
      return true;
    }

    try {
      // Get credentials config (will request new token if needed)
      const config = await this.getValidConfig();
      if (!config) {
        return false;
      }
      await VoiceChatModule.initialize(config);
      this.isInitialized = true;
      return true;
    } catch (err: unknown) {
      if (this.onErrorCallback) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.onErrorCallback(`Initialization failed: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * Start a new conversation
   * @returns Promise<boolean> True if starting conversation is successful
   */
  public async startConversation(): Promise<boolean> {
    if (!VoiceChatModule) {
      if (this.onErrorCallback) {
        this.onErrorCallback('Voice chat module not available');
      }
      return false;
    }

    try {
      // Ensure module is initialized
      const voiceSystemPrompt = getCurrentVoiceSystemPrompt();
      if (!this.isInitialized) {
        const initSuccess = await this.initialize();
        if (!initSuccess) {
          return false;
        }
      } else {
        const config = await this.getValidConfig();
        if (!config) {
          return false;
        }
        await VoiceChatModule.updateCredentials(config);
      }

      // Start conversation with system prompt and voice ID
      const systemPrompt = voiceSystemPrompt?.prompt ?? DefaultVoicePrompt;
      const voiceId = getVoiceId();
      await VoiceChatModule.startConversation(
        systemPrompt,
        voiceId,
        voiceSystemPrompt?.allowInterruption ?? true
      );
      return true;
    } catch (err: unknown) {
      if (this.onErrorCallback) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.onErrorCallback(`Operation failed: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * End the current conversation
   * @returns Promise<boolean> True if ending conversation is successful
   */
  public async endConversation(): Promise<boolean> {
    if (!VoiceChatModule || !this.isInitialized) {
      return false;
    }

    try {
      await VoiceChatModule.endConversation();
      return true;
    } catch (err: unknown) {
      if (this.onErrorCallback) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.onErrorCallback(`Failed to end conversation: ${errorMessage}`);
      }
      return false;
    }
  }

  /**
   * Clean up event listeners
   */
  public cleanup() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
  }
}

// Create singleton instance
export const voiceChatService = new VoiceChatService();
