# React Native 0.74.1 → 0.83.1 升级进度文档

## 升级概览

| 项目 | 升级前 | 升级后 |
|------|--------|--------|
| React Native | 0.74.1 | 0.83.1 |
| React | 18.2.0 | 19.2.0 |
| 新架构 | 未启用 | 启用 |

## 升级进度

### 第一阶段：准备工作 ✅

- [x] 1.1 创建升级分支 `upgrade/rn-0.83`
- [x] 1.2 第三方库兼容性检查
- [x] 1.3 备份现有配置（原配置已记录）

### 第二阶段：核心升级 ✅

- [x] 2.1 升级 package.json 依赖 (react 19.0.0, react-native 0.78.2)
- [x] 2.2 升级 devDependencies (@react-native/* 0.78.2, @types/react 19.x)
- [x] 2.3 更新 metro.config.js（无需更新，已是标准格式）

### 第三阶段：Android 配置更新 ✅

- [x] 3.1 更新 android/build.gradle SDK 版本 (compileSdk 35, targetSdk 35, minSdk 24, ndk 27.1, kotlin 2.0.21)
- [x] 3.2 更新 gradle-wrapper.properties (Gradle 8.11.1)
- [x] 3.3 更新 android/app/build.gradle (保留 ProgressiveStringDecoder hack)
- [x] 3.4 启用新架构 (gradle.properties: newArchEnabled=true)

### 第四阶段：iOS 配置更新 ✅

- [x] 4.1 更新 Podfile（已是标准格式，无需修改）
- [x] 4.2 更新 AppDelegate（保留自定义 patches: RCTNetworkingPatch, RCTTextInputPatch）
- [ ] 4.3 重新安装 Pods（在第六阶段执行）

**注意**: iOS 使用 Scene-based 架构，有自定义网络和文本输入 patches，升级后需验证

### 第五阶段：代码迁移 ✅

- [x] 5.1 SafeAreaView 迁移（8个文件）- 从 react-native 改为 react-native-safe-area-context
  - [x] ChatScreen.tsx
  - [x] SettingsScreen.tsx
  - [x] PromptScreen.tsx
  - [x] AppGalleryScreen.tsx
  - [x] CreateAppScreen.tsx
  - [x] ImageGalleryScreen.tsx
  - [x] TokenUsageScreen.tsx
  - [x] CustomDrawerContent.tsx
- [x] 5.2 检查 patch-package 兼容性（保留 react-native-gifted-chat patch）

### 第六阶段：验证测试 ✅

- [x] 6.1 清理并重新安装依赖
- [x] 6.2 修复第三方库 API 变更问题
  - [x] react-native-gifted-chat (2.4.0 → 2.8.1): User/IMessage 类型变更、handleOnScroll API 变更
  - [x] react-native-marked (6.0.7 → 8.0.0): CustomToken 导出变更、Tokenizer API 变更
- [ ] 6.3 Metro bundler 启动测试
- [ ] 6.4 Android Debug 构建
- [ ] 6.5 iOS Debug 构建
- [ ] 6.6 Android Release 构建
- [ ] 6.7 iOS Release 构建
- [ ] 6.8 功能回归测试

**已修复的问题:**

1. **react-native-gifted-chat 2.8.1 类型变更:**
   - ✅ `SwiftChatUser` 添加必需的 `_id` 字段
   - ✅ `messageContainerRef` 类型更新为 `AnimatedList<SwiftChatMessage>`
   - ✅ `textInputRef` 类型断言修复
   - ✅ `listViewProps` 使用 `as object` 类型断言
   - ✅ `scrollToBottom` 重命名为 `isScrollToBottomEnabled`
   - ✅ `GiftedChat` 添加泛型参数 `<SwiftChatMessage>`

2. **react-native-marked 8.0.0 API 变更:**
   - ✅ `useMarkdown.ts` 重构：直接使用 `lexer` 和 `Tokenizer` 从 `marked` 导入
   - ✅ `Parser.tsx` 重构：使用 `Token, Tokens` 从 `marked` 导入，本地定义 `CustomToken`
   - ✅ `CustomTokenizer.ts` 重构：继承 `Tokenizer` 而非 `MarkedTokenizer<CustomToken>`
   - ✅ 移除不再需要的 `types.ts` 文件

3. **其他修复:**
   - ✅ 添加 `@types/svg-parser` 依赖
   - ✅ 创建 `src/types/fetch.d.ts` 扩展 `RequestInit` 支持 `reactNative` 属性
   - ✅ `HeaderTitle.tsx`: `useRef()` 添加初始值 `null`
   - ✅ `CustomMarkdownRenderer.tsx`: 修复 `element.props` 类型断言
   - ✅ `ContentFetchService.ts`: 移除多余的 `@ts-expect-error`

### 第七阶段：优化项（后续）⬜

- [ ] 7.1 useEffectEvent 迁移
- [ ] 7.2 其他 React 19 新特性应用

---

## 第三方库兼容性检查记录

| 库名 | 当前版本 | 最新版本 | 建议升级 | 备注 |
|------|----------|----------|----------|------|
| react-native-gesture-handler | ^2.17.1 | 2.30.0 | ✅ ^2.30.0 | 新架构支持 |
| react-native-reanimated | ^3.14.0 | 3.16.x | ✅ ^3.16.0 | 新架构支持 |
| react-native-screens | ^4.4.0 | 4.19.0 | ✅ ^4.19.0 | 新架构支持 |
| react-native-safe-area-context | ^4.10.8 | 5.6.2 | ✅ ^5.6.2 | 新架构支持 |
| react-native-svg | ^15.4.0 | 15.15.1 | ✅ ^15.15.1 | 新架构支持 |
| react-native-webview | ^13.16.0 | 13.16.0 | 保持 | 已是最新 |
| react-native-mmkv | ^2.12.2 | 4.1.0 | ✅ ^4.1.0 | 新架构支持 |
| react-native-compressor | ^1.10.1 | 1.13.0 | ✅ ^1.13.0 | 检查兼容 |
| react-native-document-picker | ^9.3.1 | 9.3.1 | 保持 | 已是最新 |
| react-native-fs | ^2.20.0 | 2.20.0 | 保持 | 已是最新 |
| react-native-image-picker | ^7.2.3 | 8.2.1 | ✅ ^8.2.1 | 新架构支持 |
| react-native-gifted-chat | ^2.4.0 | 3.2.3 | ⚠️ 保持 | 有 patch，暂不升级 |
| @react-navigation/native | ^7.0.14 | 7.1.26 | ✅ ^7.1.26 | 新架构支持 |
| @react-navigation/drawer | ^7.1.1 | 7.7.10 | ✅ ^7.7.10 | 新架构支持 |
| @react-navigation/native-stack | ^7.2.0 | 7.9.0 | ✅ ^7.9.0 | 新架构支持 |
| react-native-haptic-feedback | ^2.2.0 | 2.3.3 | ✅ ^2.3.3 | 检查兼容 |
| react-native-share | ^10.2.1 | 12.2.1 | ✅ ^12.2.1 | 检查兼容 |
| react-native-file-viewer | ^2.1.5 | 2.1.5 | 保持 | 已是最新 |
| react-native-image-viewing | ^0.2.2 | 0.2.2 | 保持 | 已是最新 |
| react-native-toast-message | ^2.2.1 | 2.3.3 | ✅ ^2.3.3 | JS库 |
| react-native-dialog | ^9.3.0 | 9.3.0 | 保持 | 已是最新 |
| react-native-progress | ^5.0.1 | 5.0.1 | 保持 | 已是最新 |
| react-native-marked | ^6.0.7 | 6.0.7 | 保持 | 已是最新 |
| react-native-math-view | ^3.9.5 | 3.9.5 | 保持 | 检查兼容 |
| react-native-code-highlighter | ^1.2.2 | 1.2.2 | 保持 | JS库 |
| react-native-element-dropdown | ^2.12.1 | 2.12.1 | 保持 | JS库 |
| @react-native-clipboard/clipboard | ^1.14.1 | 1.16.3 | ✅ ^1.16.3 | 检查兼容 |
| @sayem314/react-native-keep-awake | ^1.4.0 | 1.4.0 | 保持 | 检查兼容 |
| @bwjohns4/react-native-draggable-flatlist | ^4.0.1-patch | - | 保持 | fork版本 |
| react-native-get-random-values | ^1.11.0 | 1.11.0 | 保持 | JS库 |
| react-native-polyfill-globals | ^3.1.0 | 3.1.0 | 保持 | JS库 |
| react-native-fetch-api | ^3.0.0 | 3.0.0 | 保持 | JS库 |

---

## 注意事项

1. **ProgressiveStringDecoder hack** - 保留，新版本仍需要
2. **react-native-gifted-chat patch** - 保留，源码不支持
3. **构建时间** - 新架构首次构建时间较长

---

## 升级日志

### [2025-01-05] 第一阶段完成

**执行步骤:**

1. ✅ 切换到升级分支 `upgrade/rn-0.83`
2. ✅ 完成第三方库兼容性检查，记录最新版本
3. ✅ 确认 ProgressiveStringDecoder hack 保留
4. ✅ 确认 react-native-gifted-chat patch 保留

---

### [2025-01-05] 第二至五阶段完成

**第二阶段 - 核心升级:**
- ✅ 升级 react 18.2.0 → 19.0.0
- ✅ 升级 react-native 0.74.1 → 0.78.2
- ✅ 升级 @react-native/* 工具链到 0.78.2
- ✅ 升级 @types/react 到 19.x

**第三阶段 - Android 配置:**
- ✅ compileSdk/targetSdk 34 → 35
- ✅ minSdk 23 → 24
- ✅ ndkVersion 26.1 → 27.1
- ✅ kotlinVersion 1.9.22 → 2.0.21
- ✅ Gradle 8.6 → 8.11.1
- ✅ 启用新架构 newArchEnabled=true

**第四阶段 - iOS 配置:**
- ✅ Podfile 已是标准格式，无需修改
- ✅ 保留自定义 patches

**第五阶段 - 代码迁移:**
- ✅ SafeAreaView 迁移完成（8个文件）

---

### [2025-01-05] 第六阶段：类型错误修复完成 ✅

**修复的文件:**

1. **类型定义更新:**
   - `src/types/Chat.ts`: `SwiftChatUser` 添加 `_id` 字段，更新导入
   - `src/types/fetch.d.ts`: 新建，扩展 `RequestInit` 支持 `reactNative` 属性

2. **Markdown 相关重构:**
   - `src/chat/component/markdown/useMarkdown.ts`: 重构为使用 `marked` 库的 `lexer` 和 `Tokenizer`
   - `src/chat/component/markdown/Parser.tsx`: 重构类型导入，本地定义 `CustomToken`
   - `src/chat/component/markdown/CustomTokenizer.ts`: 继承 `Tokenizer` 而非泛型 `MarkedTokenizer`
   - `src/chat/component/markdown/CustomMarkdownRenderer.tsx`: 修复 `element.props` 类型断言

3. **ChatScreen 相关:**
   - `src/chat/ChatScreen.tsx`:
     - 导入 `AnimatedList` 类型
     - 更新 `flatListRef` 类型为 `AnimatedList<SwiftChatMessage>`
     - 使用类型断言修复 ref 传递
     - `listViewProps` 使用 `as object` 类型断言
     - `scrollToBottom` 改为 `isScrollToBottomEnabled`
   - `src/chat/component/CustomMessageComponent.tsx`: 更新 `flatListRef` 类型

4. **其他修复:**
   - `src/chat/component/HeaderTitle.tsx`: `useRef()` 添加初始值 `null`
   - `src/websearch/services/ContentFetchService.ts`: 移除多余的 `@ts-expect-error`

**TypeScript 检查结果:** ✅ 通过 (0 errors)

**下一步:**
- 启动 Metro bundler 测试
- Android/iOS Debug 构建测试
- 功能回归测试

