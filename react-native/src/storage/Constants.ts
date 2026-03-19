import { Model, ModelTag, SystemPrompt } from '../types/Chat.ts';
import {
  getDeepSeekApiKey,
  getOpenAIApiKey,
  getTavilyApiKey,
} from './StorageUtils.ts';
import { isMac } from '../App.tsx';

// AWS credentials - empty by default, to be filled by user
const RegionList = [
  'us-west-2',
  'us-east-1',
  'us-east-2',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ca-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'eu-south-1',
  'eu-south-2',
  'sa-east-1',
];

export const DefaultRegion = 'us-west-2';

export const GPTModels = [
  { modelName: 'GPT-5.4', modelId: 'gpt-5.4', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-5.4 Pro',
    modelId: 'gpt-5.4-pro',
    modelTag: ModelTag.OpenAI,
  },
  {
    modelName: 'GPT-5.4 mini',
    modelId: 'gpt-5.4-mini',
    modelTag: ModelTag.OpenAI,
  },
  {
    modelName: 'GPT-5.4 nano',
    modelId: 'gpt-5.4-nano',
    modelTag: ModelTag.OpenAI,
  },
  {
    modelName: 'GPT-5.3 Chat',
    modelId: 'gpt-5.3-chat-latest',
    modelTag: ModelTag.OpenAI,
  },
  { modelName: 'GPT-5.2', modelId: 'gpt-5.2', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-5.2 Pro',
    modelId: 'gpt-5.2-pro',
    modelTag: ModelTag.OpenAI,
  },
  { modelName: 'GPT-5.1', modelId: 'gpt-5.1', modelTag: ModelTag.OpenAI },
  { modelName: 'GPT-5', modelId: 'gpt-5', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-5 Pro',
    modelId: 'gpt-5-pro',
    modelTag: ModelTag.OpenAI,
  },
  { modelName: 'GPT-5 mini', modelId: 'gpt-5-mini', modelTag: ModelTag.OpenAI },
  { modelName: 'GPT-5 nano', modelId: 'gpt-5-nano', modelTag: ModelTag.OpenAI },
  { modelName: 'GPT-4.1', modelId: 'gpt-4.1', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-4.1 mini',
    modelId: 'gpt-4.1-mini',
    modelTag: ModelTag.OpenAI,
  },
  {
    modelName: 'GPT-4.1 nano',
    modelId: 'gpt-4.1-nano',
    modelTag: ModelTag.OpenAI,
  },
  { modelName: 'GPT-4o', modelId: 'gpt-4o', modelTag: ModelTag.OpenAI },
  {
    modelName: 'GPT-4o mini',
    modelId: 'gpt-4o-mini',
    modelTag: ModelTag.OpenAI,
  },
];

export const DeepSeekModels = [
  {
    modelName: 'DeepSeek-Chat',
    modelId: 'deepseek-chat',
    modelTag: ModelTag.DeepSeek,
  },
  {
    modelName: 'DeepSeek-Reasoner',
    modelId: 'deepseek-reasoner',
    modelTag: ModelTag.DeepSeek,
  },
];

export const BedrockThinkingModels = [
  'Claude 3.7 Sonnet',
  'Claude Sonnet 4',
  'Claude Sonnet 4.5',
  'Claude Sonnet 4.6',
  'Claude Opus 4',
  'Claude Opus 4.1',
  'Claude Opus 4.5',
  'Claude Opus 4.6',
];
export const BedrockVoiceModels = ['Nova Sonic'];

export const DefaultTextModel = [
  {
    modelName: 'Nova Pro',
    modelId: 'us.amazon.nova-pro-v1:0',
    modelTag: ModelTag.Bedrock,
  },
];

const DefaultImageModel = {
  modelName: 'Stable Diffusion 3.5 Large',
  modelId: 'stability.sd3-5-large-v1:0',
  modelTag: ModelTag.Bedrock,
};

export const VoiceIDList = [
  {
    voiceName: 'Matthew (American English)',
    voiceId: 'matthew',
  },
  {
    voiceName: 'Tiffany (American English)',
    voiceId: 'tiffany',
  },
  {
    voiceName: 'Amy (British English)',
    voiceId: 'amy',
  },
  {
    voiceName: 'Ambre (French)',
    voiceId: 'ambre',
  },
  {
    voiceName: 'Florian (French)',
    voiceId: 'florian',
  },
  {
    voiceName: 'Beatrice (Italian)',
    voiceId: 'beatrice',
  },
  {
    voiceName: 'Lorenzo (Italian)',
    voiceId: 'lorenzo',
  },
  {
    voiceName: 'Greta (German)',
    voiceId: 'greta',
  },
  {
    voiceName: 'Lennart (German)',
    voiceId: 'lennart',
  },
  {
    voiceName: 'Lupe (Spanish)',
    voiceId: 'lupe',
  },
  {
    voiceName: 'Carlos (Spanish)',
    voiceId: 'carlos',
  },
];

export const DefaultImageSystemPrompts = [
  {
    id: -7,
    name: 'Virtual try-on',
    prompt: 'Virtual try-on',
    includeHistory: false,
    promptType: 'image',
  },
  {
    id: -8,
    name: 'Variations',
    prompt: 'Generate similar style of the image',
    includeHistory: false,
    promptType: 'image',
  },
  {
    id: -9,
    name: 'RemoveBG',
    prompt: 'Remove background of the image',
    includeHistory: false,
    promptType: 'image',
  },
];

export const DefaultVoiceSystemPrompts = [
  {
    id: -4,
    name: 'LearnWords',
    prompt: `Please act as an English vocabulary coach. In each response, follow this exact format:

1. If the user has spoken: Score their speaking from 1-10
2. If score < 7: Provide brief correction tips and ask them to repeat the same word
3. If score ≥ 7: ask user to read a new English word

Keep all responses under 5 sentences. Begin by introducing yourself and providing the first practice word.

Remember: ALWAYS start with a score after the user speaks`,
    includeHistory: true,
    promptType: 'voice',
    allowInterruption: false,
  },
  {
    id: -5,
    name: 'LearnSentences',
    prompt: `Please act as an English pronunciation coach. In each response, follow this exact format:

1. If the user has spoken: Score their pronunciation from 1-10
2. If score < 7: Provide brief correction tips and ask them to repeat the same sentence
3. If score ≥ 7: Introduce a new common English phrase for practice

Keep all responses under 5 sentences. Begin by introducing yourself and providing the first practice sentence.

Remember: ALWAYS start with a score after the user speaks`,
    includeHistory: true,
    promptType: 'voice',
    allowInterruption: false,
  },
  {
    id: -6,
    name: 'Story',
    prompt:
      'You are a storytelling expert. Please first ask the user what type of story they would like to hear, and then tell that story with emotion and expressiveness.',
    includeHistory: true,
    promptType: 'voice',
    allowInterruption: true,
  },
];

const DefaultSystemPrompts = [
  {
    id: -1,
    name: 'Translate',
    prompt: `You are a professional translator specialized in Chinese-English translation.
If the user input is in Chinese, please translate it into English; if the user input is in English, please translate it into Chinese. 
Return single best translation only.
No explanation or alternatives.`,
    includeHistory: false,
  },
  {
    id: -10,
    name: 'App',
    prompt: '', // Dynamic prompt, will be set in getDefaultSystemPrompts()
    includeHistory: true,
  },
  ...DefaultVoiceSystemPrompts,
  ...DefaultImageSystemPrompts,
];

export const DefaultVoicePrompt =
  'You are a friendly assistant. The user and you will engage in a spoken dialog exchanging the transcripts of a natural real-time conversation. Keep your responses short, generally within five sentences for chatty scenarios.';

export function getAllRegions() {
  return RegionList;
}

export function getDefaultTextModels() {
  return [...DefaultTextModel, ...getDefaultApiKeyModels()] as Model[];
}

export function getDefaultApiKeyModels() {
  return [
    ...(getDeepSeekApiKey().length > 0 ? DeepSeekModels : []),
    ...(getOpenAIApiKey().length > 0 ? GPTModels : []),
  ] as Model[];
}

export function getDefaultImageModels() {
  return [DefaultImageModel] as Model[];
}

const getAppPrompt = () => {
  const deviceHint = isMac
    ? ''
    : `
IMPORTANT: The user is on a mobile device. You MUST:
- Design for mobile-first, responsive layout
- Use viewport meta tag with width=device-width, viewport-fit=cover
- Ensure touch-friendly UI (minimum 44px touch targets)
- Use flexible units (%, vh, vw) instead of fixed pixels
- Use env(safe-area-inset-*) for padding to avoid notch and home indicator`;

  const aiApiHint = `
### AI Chat API

\`AI.chat(options, onChunk?)\` - Call AI from your app

**Parameters:**
- \`options.messages\`: Array of {role: 'user'|'assistant', content: string} (REQUIRED)
- \`options.systemPrompt\`: string (optional) - Set AI persona or instructions
- \`onChunk\`: callback(chunk: string) - For streaming response (optional)
- Returns: Promise<string>

\`\`\`javascript
// Simple
const messages = [{ role: 'user', content: 'Hello' }];
const reply = await AI.chat({ messages });

// Streaming (chunk is incremental, use += to accumulate)
let result = '';
await AI.chat({ messages }, (chunk) => { result += chunk; });

// Multi-turn conversation
const messages = [
  { role: 'user', content: 'Hi' },
  { role: 'assistant', content: 'Hello!' },
  { role: 'user', content: 'How are you?' }
];
const reply = await AI.chat({ messages });

// With system prompt
const reply = await AI.chat({ messages, systemPrompt: '...' });
\`\`\`

### JSON Repair API

\`AI.repairJSON(jsonString)\` - Repair malformed JSON

- Returns: Promise<string> (empty if failed)

When asking AI to return JSON, always repair before parsing:
\`\`\`javascript
const response = await AI.chat({
  messages: [{ role: 'user', content: 'Return JSON: {name, age}' }]
});
const fixed = await AI.repairJSON(response);
if (fixed) {
  const data = JSON.parse(fixed);
}
\`\`\`
`;

  const webSearchHint = getTavilyApiKey()
    ? `
### Web Search API

\`AI.webSearch(query, maxResults?)\` - Search the web for information

**Parameters:**
- \`query\`: string (REQUIRED)
- \`maxResults\`: number (optional, default: 5)
- Returns: Promise<Array<{url, title, content}>>

\`\`\`javascript
const results = await AI.webSearch('your query', 5);
results.forEach(r => console.log(r.title, r.url, r.content));
\`\`\`
`
    : '';

  return `You are an expert HTML/CSS/JavaScript developer. Your task is to create or modify fully functional, interactive single-page web applications based on user requirements.

## Output Format

### When Creating a NEW App (no existing code provided, or user explicitly asks for a new app):
1. Output the complete HTML code in a \`\`\`html code block
2. Then provide a brief introduction and usage instructions

### When MODIFYING an Existing App (existing code is provided in user message):
1. Output ONLY the changes in a \`\`\`diff code block
2. Then provide a brief summary of what was changed

## Diff Format Rules

Use \`@@@@\` as block separator. NO line numbers needed.

**Format:**
- \`@@@@\` - Block separator (start each change block with this)
- Lines without prefix - Context lines (for locating position, must EXACTLY match original)
- \`-\` prefix - Lines to remove (MUST be consecutive lines in the original file)
- \`+\` prefix - Lines to add (will replace the removed lines)

**Critical Rules:**
1. **Order**: List change blocks in the order they appear in the code
2. **Context lines**: Context lines are the unchanged lines BEFORE your removal/addition. Include 2-3 lines to uniquely identify the location
3. **Exact match**: Context lines must exactly match the original code (including indentation)
4. **Consecutive**: All \`-\` lines in a block MUST be consecutive. For non-adjacent changes, use SEPARATE blocks
5. **Complete lines**: Never truncate lines

**Example:**
\`\`\`diff
@@@@
    .container {
-      background: #f5f5f5;
+      background: #e0e0e0;
    }
@@@@
    <div class="wrapper">
-        <a href="..." class="card">
-            <h3>Title</h3>
-        </a>
+        <div class="card" onclick="...">
+            <h2>Title</h2>
+        </div>
    </div>
\`\`\`

## Code Requirements
- Generate a complete, self-contained HTML file with embedded CSS and JavaScript
- Include <!DOCTYPE html>, <html>, <head>, and <body> tags
- All styles must be in <style> tags within <head>
- All scripts must be in <script> tags before </body>
- Code must be production-ready and error-free
- Use localStorage if data persistence is needed
${deviceHint}

## Available APIs
${aiApiHint}
${webSearchHint}

## Design Guidelines
- Modern, clean UI with good visual hierarchy
- Smooth animations and transitions where appropriate
- Clear user feedback for interactions
- Accessible design (proper contrast, semantic HTML)

## Examples of Apps You Can Create
- Calculators, converters, timers, stopwatches
- Todo lists, note-taking apps, kanban boards
- Games (memory, quiz, snake, tetris, etc.)
- Data visualizations, charts, dashboards
- Form builders, surveys, polls
- Drawing/painting tools, image editors
- Music players, sound generators
- Interactive tutorials, flashcards
- AI chatbots, writing assistants, Q&A apps

If the user's request is unclear, ask clarifying questions before generating code.`;
};

export function getDefaultSystemPrompts(): SystemPrompt[] {
  return DefaultSystemPrompts.map(prompt => {
    if (prompt.name === 'App') {
      return { ...prompt, prompt: getAppPrompt() };
    }
    return prompt;
  });
}
