import {
  NativeModules,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';

const { LiteRTModule } = NativeModules;
const liteRTEmitter = LiteRTModule
  ? new NativeEventEmitter(LiteRTModule)
  : null;

const LITERT_MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm';
const LITERT_MODEL_DIR = `${RNFS.LibraryDirectoryPath}/Application Support/LiteRT/Models`;
const LITERT_MODEL_PATH = `${LITERT_MODEL_DIR}/gemma-4-E2B-it.litertlm`;

export { LITERT_MODEL_PATH };

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
        imagePaths && imagePaths.length > 0 ? imagePaths : []
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

  // Download state
  private downloadJobId: number | null = null;
  private _downloading = false;
  private _downloadProgress = 0;
  private _downloadSpeed = '';
  private lastBytes = 0;
  private lastTime = Date.now();
  private onProgressCallback?: (progress: number, speed: string) => void;
  private onDownloadCompleteCallback?: () => void;
  private onDownloadErrorCallback?: (error: string) => void;

  public get downloading() { return this._downloading; }
  public get downloadProgress() { return this._downloadProgress; }
  public get downloadSpeedText() { return this._downloadSpeed; }

  public setDownloadCallbacks(
    onProgress?: (progress: number, speed: string) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ) {
    this.onProgressCallback = onProgress;
    this.onDownloadCompleteCallback = onComplete;
    this.onDownloadErrorCallback = onError;
    if (this._downloading && onProgress) {
      onProgress(this._downloadProgress, this._downloadSpeed);
    }
  }

  public async startDownload(): Promise<void> {
    if (this._downloading) { return; }
    await RNFS.mkdir(LITERT_MODEL_DIR);

    // Already complete
    const fileExists = await RNFS.exists(LITERT_MODEL_PATH);
    if (fileExists) {
      const stat = await RNFS.stat(LITERT_MODEL_PATH);
      if (Number(stat.size) > 2500000000) {
        this.onDownloadCompleteCallback?.();
        return;
      }
      // Incomplete file from previous attempt — remove and restart
      await RNFS.unlink(LITERT_MODEL_PATH).catch(() => {});
    }

    this._downloading = true;
    this._downloadProgress = 0;
    this._downloadSpeed = '';
    this.lastBytes = 0;
    this.lastTime = Date.now();

    const { jobId, promise } = RNFS.downloadFile({
      fromUrl: LITERT_MODEL_URL,
      toFile: LITERT_MODEL_PATH,
      connectionTimeout: 30000,
      readTimeout: 60000,
      begin: () => {
        this._downloadSpeed = 'Connected';
        this.onProgressCallback?.(0, this._downloadSpeed);
      },
      progressInterval: 500,
      progress: res => {
        const total = res.contentLength > 0 ? res.contentLength : 2780000000;
        this._downloadProgress = Math.min(res.bytesWritten / total, 1);

        const now = Date.now();
        const elapsed = (now - this.lastTime) / 1000;
        if (elapsed >= 0.5) {
          const bytes = res.bytesWritten - this.lastBytes;
          const speed = bytes / elapsed;
          if (speed > 1024 * 1024) {
            this._downloadSpeed = `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
          } else if (speed > 0) {
            this._downloadSpeed = `${(speed / 1024).toFixed(0)} KB/s`;
          }
          this.lastBytes = res.bytesWritten;
          this.lastTime = now;
        }
        this.onProgressCallback?.(this._downloadProgress, this._downloadSpeed);
      },
    });
    this.downloadJobId = jobId;

    try {
      const result = await promise;
      this._downloading = false;
      if (result.statusCode === 200) {
        this.onDownloadCompleteCallback?.();
      } else {
        await RNFS.unlink(LITERT_MODEL_PATH).catch(() => {});
        this.onDownloadErrorCallback?.(`HTTP ${result.statusCode}`);
      }
    } catch {
      this._downloading = false;
      this.onDownloadErrorCallback?.('Download interrupted');
    }
  }

  public cancelDownload() {
    if (this.downloadJobId) {
      RNFS.stopDownload(this.downloadJobId);
      this.downloadJobId = null;
    }
    this._downloading = false;
    this._downloadProgress = 0;
    this._downloadSpeed = '';
    // Remove incomplete file
    RNFS.unlink(LITERT_MODEL_PATH).catch(() => {});
  }
}

export const liteRTService = new LiteRTService();
