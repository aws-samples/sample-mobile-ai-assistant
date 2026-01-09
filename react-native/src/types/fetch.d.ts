// Extend RequestInit to support React Native specific options
declare global {
  interface RequestInit {
    reactNative?: {
      textStreaming: boolean;
    };
  }
}

export {};
