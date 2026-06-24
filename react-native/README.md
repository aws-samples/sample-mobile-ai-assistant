# AI Assistant React Native

## Tech Stack

- **Framework**: React Native 0.83 (New Architecture)
- **Language**: TypeScript
- **Navigation**: React Navigation (Drawer + Stack)
- **Storage**: MMKV (encrypted)
- **Streaming**: SSE via `fetch` + `ReadableStream`
- **Markdown**: Custom renderer with Mermaid, code highlighting, HTML live preview
- **Voice**: Nova Sonic via native module
- **Platform**: iOS, Android, macOS (Catalyst)

## Project Structure

```
src/
├── api/                            # API layer
│   ├── BedrockMessageConvertor.ts  #   Message format types & conversion
│   ├── ChatProviderRouter.ts       #   Routes to correct provider by ModelTag
│   ├── bedrock-api.ts              #   Bedrock Server SSE + image entry
│   ├── types.ts                    #   ChatProvider interface
│   └── providers/                  #   Provider implementations (bedrock, openai, ollama, deepseek)
│
├── chat/                           # Core chat
│   ├── ChatScreen.tsx              #   Main screen (~590 lines)
│   ├── hooks/                      #   Extracted logic (session, streaming, scroll, voice)
│   ├── service/                    #   BackgroundTask, VoiceChat
│   ├── util/                       #   FileUtils, messageUtils
│   └── component/
│       ├── input/                  #     InputArea, Send, AddFile, FileList, AudioWaveform
│       ├── message/                #     ChatComponent, MessageList, MessageComponent
│       └── toolbar/                #     Footer, ModelSelection, PromptList, WebSearch
│
├── core/                           # Cross-module shared
│   ├── HapticUtils.ts
│   ├── ToastUtils.ts
│   └── markdown/                   #   Markdown/Mermaid/HTML rendering (15 files)
│
├── appgen/                         # HTML app generation
│   ├── components/                 #   AIWebView, WebViewBridge
│   ├── screens/                    #   Gallery, Viewer, Create
│   ├── service/                    #   BackgroundStreamManager
│   └── util/                       #   ApplyDiff, DiffUtils
│
├── imagegen/                       # Image generation
│   ├── ImageGalleryScreen.tsx
│   └── components/                 #   ImageSpinner, ImageProgressBar
│
├── websearch/                      # Web search
│   ├── components/citation/        #   CitationBadge, CitationList, CitationModal
│   ├── providers/                  #   Google, Bing, Baidu, Tavily
│   └── services/                   #   Orchestrator, IntentAnalysis, ContentFetch
│
├── storage/                        # MMKV persistent storage (domain-split)
│   ├── StorageUtils.ts             #   Core instances + re-export hub
│   ├── ChatStorage.ts              #   Messages, sessions, history
│   ├── ModelStorage.ts             #   Models, API keys, tokens
│   ├── PromptStorage.ts            #   System prompts
│   ├── PreferenceStorage.ts        #   UI preferences
│   ├── SearchStorage.ts            #   Search config
│   ├── AppStorage.ts               #   Saved HTML apps
│   └── Constants.ts                #   Default models, prompts, regions
│
├── settings/                       # Settings screens
├── history/                        # Chat history sidebar & event context
├── prompt/                         # Prompt management screen
├── theme/                          # Theme context & colors
├── types/                          # Shared type definitions (Chat.ts, RouteTypes.ts)
└── utils/                          # ModelUtils, PlatformUtils, ErrorUtils
```

## Key Patterns

- **New provider**: Add `api/providers/xxx.ts` + register in `ChatProviderRouter.ts`
- **ChatScreen hooks**: Logic split into `useChatSession`, `useChatStreaming`, `useChatScroll`, `useChatVoice`
- **Storage**: Domain modules re-exported from `StorageUtils.ts` for backward compatibility
- **Markdown**: `core/markdown/` is provider-agnostic, reusable by any chat-like feature
