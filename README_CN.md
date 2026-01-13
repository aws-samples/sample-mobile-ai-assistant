# SwiftChat — 跨平台 AI 助手

> 🚀 您的个人 AI 工作空间 — 聊天、创建应用等

[![GitHub Release](https://img.shields.io/github/v/release/aws-samples/swift-chat)](https://github.com/aws-samples/swift-chat/releases)
[![License](https://img.shields.io/badge/license-MIT--0-green)](LICENSE)

[English](/README.md)

SwiftChat 是一款快速响应的 AI 助手，采用 [React Native](https://reactnative.dev/)
开发，并依托 [Amazon Bedrock](https://aws.amazon.com/bedrock/) 提供强大支持，同时兼容 Ollama、DeepSeek、OpenAI 和 OpenAI
兼容的其他模型供应商。凭借其极简设计理念与坚实的隐私保护措施，该应用在 Android、iOS 和 macOS 平台上实现了实时流式对话、AI
图像生成、极速 Web 应用创建和语音对话功能。

![](assets/promo.avif)

### 新功能 🔥
- 🚀 支持一句话创建或编辑极速 Web 应用（自 v2.7.0 起）。
- 🚀 支持网络搜索，获取实时信息（自 v2.7.0 起）。
- 🚀 更新 SwiftChat 服务器，支持 API Gateway + Lambda 部署，最长支持 15 分钟流式输出（自 v2.7.0 起）。
- 🚀 支持图片画廊，浏览和管理生成的图片（自 v2.7.0 起）。
- 🚀 支持流式渲染 Mermaid 图表（自 v2.6.0 起）。
- 🚀 支持使用 Bedrock API Key 连接 Amazon Bedrock 模型（自 v2.5.0 起）。

**创建应用**：生成、编辑、分享和预览极速 Web 应用

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/create_app.avif" width=24%>
<img src="assets/animations/edit_and_save.avif" width=24%>
<img src="assets/animations/gallery_edit_app.avif" width=24%>
<img src="assets/animations/share_and_import.avif" width=24%>
</div>

**应用示例**：2048 游戏、五子棋、俄罗斯方块和新闻阅读器

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/app_2048.avif" width=24%>
<img src="assets/animations/app_gomoku.avif" width=24%>
<img src="assets/animations/app_tetris.avif" width=24%>
<img src="assets/animations/app_news.avif" width=24%>
</div>

**网络搜索 & Mermaid**：实时信息检索和流式图表渲染

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/websearch_tavily.avif" width=24%>
<img src="assets/animations/websearch_google.avif" width=24%>
<img src="assets/animations/mermaid.avif" width=24%>
<img src="assets/animations/mermaid_save.avif" width=24%>
</div>

> 注意：推荐使用 Tavily 以获得最佳效果。Google 搜索首次使用需要手动验证。百度和必应目前处于测试版本，搜索结果可能不准确。

## 📱 快速下载

- [下载 Android 版本](https://github.com/aws-samples/swift-chat/releases/download/2.7.0/SwiftChat.apk)
- [下载 macOS 版本](https://github.com/aws-samples/swift-chat/releases/download/2.7.0/SwiftChat.dmg)
- iOS 版本：目前可通过 Xcode 本地构建使用

## Amazon Bedrock 入门指南

### 配置

您可以选择以下两种配置方法中的一种

<details>
<summary><b>🔧 配置 Bedrock API Key（点击展开）</b></summary>

1. 点击 [Amazon Bedrock 控制台](https://console.aws.amazon.com/bedrock/home#/api-keys/long-term/create) 创建长期 API 密钥。

2. 复制并粘贴 API 密钥到 SwiftChat 设置页面的（Amazon Bedrock -> Bedrock API Key）中。

3. 应用程序将根据您当前选择的区域自动获取最新的模型列表。如果列表中出现多个模型，说明配置成功。

</details>

<details>
<summary><b>🔧 配置 SwiftChat 服务器（点击展开）</b></summary>

### 架构

![](/assets/architecture.png)

我们使用 **API Gateway** 与 **AWS Lambda** 结合的方式，实现最长 15 分钟的流式传输。所有请求通过 API Gateway 的 API Key 验证后才会转发到 Lambda，确保后端服务的安全访问。

### 步骤 1：构建并推送容器镜像到 ECR

1. 克隆此仓库：
   ```bash
   git clone https://github.com/aws-samples/swift-chat.git
   cd swift-chat
   ```

2. 运行构建和推送脚本：
   ```bash
   cd server/scripts
   bash ./push-to-ecr.sh
   ```

3. 按照提示进行配置：
   - ECR 仓库名称（或使用默认值：`swift-chat-api`）
   - 镜像标签（请使用默认值：`latest`）
   - AWS 区域（填写你希望部署的区域，例如：`us-east-1`）

4. 脚本将构建并推送 Docker 镜像到您的 ECR 仓库。

5. **重要**：复制脚本输出末尾显示的镜像 URI。您将在下一步中需要它。

### 步骤 2：部署堆栈并获取 API URL 和 API Key

1. 下载 CloudFormation 模板：
   - Lambda：[SwiftChatLambda.template](https://github.com/aws-samples/swift-chat/blob/main/server/template/SwiftChatLambda.template)

2. 前往 [CloudFormation 控制台](https://console.aws.amazon.com/cloudformation/home#/stacks/create/template?stackName=SwiftChat)，在**指定模板**下选择**上传模板文件**，然后上传您下载的模板文件。

3. 点击 **下一步**，在"指定堆栈详细信息"页面，提供以下信息：
    - **ContainerImageUri**：输入步骤 1 输出的 ECR 镜像 URI

4. 点击 **下一步**，保持"配置堆栈选项"页面为默认，阅读功能并勾选底部的"我确认 AWS CloudFormation 可能会创建 IAM 资源"复选框。
5. 点击 **下一步**，在"审核并创建"中检查您的配置并点击 **提交**。

6. 等待约 1-2 分钟完成部署，然后点击 CloudFormation 堆栈并转到 **输出** 选项卡：
   - **APIURL**：您的 API URL（例如：`https://xxx.execute-api.us-east-1.amazonaws.com/v1`）
   - **ApiKeyConsole**：点击此 URL 打开 API Gateway API Keys 控制台，找到名为 `<StackName>-api-key` 的密钥并复制 API Key 值

### 步骤 3：打开应用并使用 API URL 和 API Key 进行设置

1. 启动应用，打开抽屉菜单，点击 **设置**。
2. 粘贴 `API URL` 和 `API Key` 到 Amazon Bedrock -> SwiftChat Server 下，然后选择您的区域。
3. 点击右上角 ✓ 图标保存配置并开始聊天。

恭喜 🎉 您的 SwiftChat 应用已准备就绪！

</details>

## 其他模型提供商入门指南

### Ollama

<details>
<summary><b>🔧 配置 Ollama（点击展开）</b></summary>

1. 导航到 **设置页面** 并选择 **Ollama** 选项卡。
2. 输入您的 Ollama 服务器 URL。例如：
    ```bash
    http://localhost:11434
    ```
3. 输入您的 Ollama 服务器 API 密钥（可选）。

4. 输入正确的服务器 URL 后，您可以从 **Chat Model** 下拉列表中选择所需的 Ollama 模型。

</details>

### DeepSeek

<details>
<summary><b>🔧 配置 DeepSeek（点击展开）</b></summary>

1. 前往 **设置页面** 并选择 **DeepSeek** 选项卡。
2. 输入您的 DeepSeek API 密钥。
3. 从 **Chat Model** 下拉列表中选择 DeepSeek 模型。目前支持以下 DeepSeek 模型：
    - `DeepSeek-V3`
    - `DeepSeek-R1`

</details>

### OpenAI

<details>
<summary><b>🔧 配置 OpenAI（点击展开）</b></summary>

1. 导航到 **设置页面** 并选择 **OpenAI** 选项卡。
2. 输入您的 OpenAI API 密钥。
3. 从 **Chat Model** 下拉列表中选择 OpenAI 模型。目前支持以下 OpenAI 模型：
    - `GPT-4o`
    - `GPT-4o mini`
    - `GPT-4.1`
    - `GPT-4.1 mini`
    - `GPT-4.1 nano`
    - `GPT-5`
    - `GPT-5 chat`
    - `GPT-5 mini`
    - `GPT-5 nano`

此外，如果您已部署并配置了 [SwiftChat 服务器](#amazon-bedrock-入门指南)，可以启用 **Use Proxy** 选项来转发您的请求。

</details>

### OpenAI Compatible

<details>
<summary><b>🔧 配置 OpenAI Compatible 模型（点击展开）</b></summary>

1. 导航到 **设置页面** 并选择 **OpenAI** 选项卡。
2. 在 **OpenAI Compatible** 下，输入以下信息：
    - 您的模型提供商的 `Base URL`
    - 您的模型提供商的 `API Key`
    - 您想使用的模型的 `Model ID`（用逗号分隔多个模型）
3. 从 **Chat Model** 下拉列表中选择您的一个模型。
4. 点击右侧的加号按钮添加另一个 OpenAI 兼容的模型提供商。您最多可以添加 10 个 OpenAI 兼容的模型提供商。

</details>

## 主要功能

- 与 AI 进行实时流式聊天
- 极速 Web 应用创建、编辑和分享
- 网络搜索实时信息检索
- 丰富的 Markdown 支持：表格、代码块、LaTeX、Mermaid 图表等
- 带进度显示的 AI 图像生成
- 多模态支持（图像、视频和文档）
- 对话历史列表查看和管理
- 跨平台支持（Android、iOS、macOS）
- 针对 iPad 和 Android 平板电脑优化
- 快速启动和响应性能
- 支持多种 AI
  模型（[Amazon Bedrock](https://aws.amazon.com/bedrock/)、[Ollama](https://github.com/ollama/ollama)、[DeepSeek](https://www.deepseek.com/)、[OpenAI](https://openai.com/)
  和 [OpenAI Compatible](#openai-compatible) 模型）
- 完全可自定义的系统提示词助手

### 功能展示

**全面的多模态分析**：文本、图像、文档和视频

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/text_streaming.avif" width=24%>
<img src="assets/animations/image_summary.avif" width=24%>
<img src="assets/animations/doc_summary.avif" width=24%>
<img src="assets/animations/video_summary.avif" width=24%>
</div>

**创意图像套件**：生成、虚拟试衣、背景移除和图片画廊，由 Nova Canvas 提供支持

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/gen_image.avif" width=24%>
<img src="assets/animations/virtual_try_on_demo.avif" width=24%>
<img src="assets/animations/remove_background.avif" width=24%>
<img src="assets/animations/image_gallery.avif" width=24%>
</div>

**系统提示词助手**：有用的预设系统提示词，具备完整管理功能（添加/编辑/排序/删除）

![](assets/animations/english_teacher.avif)

**丰富的 Markdown 支持**：段落、代码块、表格、LaTeX、Mermaid 等

![](assets/markdown.avif)

我们重新设计了 UI，优化了字体大小和行间距，提供更优雅、清洁的展示效果。
所有这些功能也在 Android 和 macOS 上以原生 UI 无缝显示

#### 暗黑模式

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/dark_markdown.avif" width=24%>
<img src="assets/animations/dark_voice.avif" width=24%>
<img src="assets/animations/dark_gen_image.avif" width=24%>
<img src="assets/animations/dark_settings.avif" width=24%>
</div>

> 注意：为了演示效果，一些动图已加速。如果您遇到卡顿，请在电脑上使用 Chrome、Firefox 或 Edge 浏览器查看。

### Amazon Nova 系列功能

#### Nova Canvas 简易虚拟试衣功能

1. 支持自动设置主图像，默认为之前使用的主图像。
2. 支持上传或拍摄第二张图像并直接发送，无需任何提示词。
3. 支持自动识别衣服、裤子、鞋子并进行试穿

#### Amazon Nova Sonic 语音对语音模型

1. 内置单词和句子的口语练习，以及讲故事场景。您也可以添加 **自定义系统提示词** 用于不同场景的语音聊天。
2. 默认支持 **插话功能**，您也可以在系统提示词中禁用。
3. 支持在设置页面中选择语音，包括美式/英式英语、西班牙语以及男性和女性语音选项。
4. 支持 **回声消除**，您可以直接对着设备说话而无需佩戴耳机。
5. 支持 **语音波形** 显示音量级别。

**学习句子**

https://github.com/user-attachments/assets/ebf21b12-9c93-4d2e-a109-1d6484019838

**Mac 上讲故事（带插话功能）**

https://github.com/user-attachments/assets/c70fc2b4-8960-4a5e-b4f8-420fcd5eafd4

> 注意：Amazon Nova Sonic 目前仅在 SwiftChat 服务器中可用。

#### 其他功能

- 直接在 Android 和 iOS 上录制 30 秒视频供 Nova 分析
- 上传超过 8MB 的大视频（1080p/4K）并自动压缩
- 支持使用默认模板让 Nova Canvas 生成图像、移除背景和创建相似风格的图像。

## 详细功能

**快速访问工具**：代码和内容复制、选择模式、模型切换、重新生成、滚动控制和令牌计数器

<div style="display: flex; flex-direction: 'row'; background-color: #888888;">
<img src="assets/animations/copy.avif" width=32%>
<img src="assets/animations/regenerate.avif" width=32%>
<img src="assets/animations/scroll_token.avif" width=32%>
</div>

我们拥有简洁的聊天历史、设置页面和直观的使用统计页面：

![](assets/history_settings_zh.avif)

### 消息处理

- [x] 文本复制支持：
    - 消息底部的复制按钮，或直接点击模型名称或用户标题部分。
    - 代码块中的复制按钮
    - 推理块中的复制按钮
    - macOS 上直接选择并复制代码（iOS 上双击或长按）
    - 长按文本复制整个句子（macOS 上右击）
- [x] 点击选择按钮启用文本选择模式。
- [x] 历史记录中的消息时间线视图
- [x] 在历史记录中长按删除消息
- [x] 点击预览文档、视频和图像
- [x] 支持折叠和展开推理部分并记住最近状态

### 图像功能

- [x] 支持使用中文提示生成图像（确保在您选择的区域启用了 `Amazon Nova Lite`）
- [x] 长按图像保存或分享
- [x] 自动图像压缩以提高响应速度
- [x] 图片画廊，浏览和管理所有生成的图片

### 用户体验

- [x] Android 和 iOS 触觉反馈（可在设置中禁用）
- [x] 支持 Android/iOS 设备横屏模式
- [x] 双击标题栏滚动到顶部
- [x] 点击底部箭头查看最新消息
- [x] 点击聊天标题再次显示系统提示词和模型切换图标
- [x] 双击聊天标题查看当前会话令牌使用情况
- [x] 在设置中查看详细令牌使用情况和图像生成计数
- [x] 应用内升级通知（Android 和 macOS）

我们针对横屏模式优化了布局。如下所示，您可以在横屏方向舒适地查看表格/代码内容。

![](assets/animations/landscape.avif)

### YouTube 视频

[<img src="./assets/youtube.avif">](https://www.youtube.com/watch?v=rey05WzfEbM)
> 视频中的内容是早期版本。对于 UI、架构和不一致之处，请参考当前文档。

## 什么让 SwiftChat 真正"Swift"？

🚀 **快速启动速度**

- 得益于 RN Hermes 引擎的 **AOT**（提前编译）
- 添加了复杂组件的 **延迟加载**
- 应用瞬间启动，立即可输入

🌐 **快速请求速度**

- 通过 **图像压缩** 加速端到端 API 请求
- 在与 Bedrock **相同区域** 部署 API 提供更低延迟

📱 **快速渲染速度**

- 使用 `useMemo` 和自定义缓存为会话内容创建二级缓存
- 减少不必要的重新渲染并加速流式消息显示
- 所有 UI 组件都渲染为 **原生组件**

📦 **快速存储速度**

- 通过使用 **react-native-mmkv** 消息可以比 AsyncStorage **快 10 倍** 读取、存储和更新
- 优化会话内容和会话列表存储结构以加速历史列表显示

## 应用隐私与安全

- 加密的 API 密钥存储
- 最小权限要求
- 仅本地数据存储
- 无用户行为跟踪
- 无数据收集
- 隐私优先方针

## 应用构建和开发

首先，克隆此存储库。所有应用代码位于 `react-native` 文件夹中。在继续之前，执行以下命令下载依赖项。

```bash
cd react-native && npm i && npm start
```

### 构建 Android

打开新终端并执行：

```bash
npm run android
```

### 构建 iOS

同样打开新终端。首次运行需要执行 `cd ios && pod install && cd ..` 安装原生依赖，然后执行以下命令：

```bash
npm run ios
```

### 构建 macOS

1. 执行 `npm start`。
2. 双击 `ios/SwiftChat.xcworkspace` 在 Xcode 中打开项目。
3. 将构建目标更改为 `My Mac (Mac Catalyst)` 然后点击 ▶ 运行按钮。

## API 参考

请参考 [API 参考](server/README.md)

## 如何升级？

### 升级应用

- **Android** 和 **macOS**：导航到 **设置** 页面，如果有新版本，您将在此页面底部找到它，然后点击应用版本下载并安装。
- **iOS**：如果在 [发布页面](https://github.com/aws-samples/swift-chat/releases) 发布了新版本，请更新您的本地代码，通过
  Xcode 重新构建并安装您的应用。

**注意**：下载新版本后，请查看 [发布说明](https://github.com/aws-samples/swift-chat/releases) 确认是否需要 API 版本更新。

### 升级 API

1. 首先重新运行构建脚本以更新镜像：
   ```bash
   cd server/scripts
   bash ./push-to-ecr.sh
   ```

2. 点击打开 [Lambda 服务](https://console.aws.amazon.com/lambda/home#/functions) 页面，找到并打开以stack名和`APIHandlerxxxxxxxx`开头的 Lambda 函数，例如`SwiftChatAPI-APIHandler38F11976-ktGBZmQtp0D8`，点击 **部署新镜像** 按钮并点击保存。

## 安全

更多信息请参见 [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications)。

## 许可证

此库使用 MIT-0 许可证。详见 [LICENSE](LICENSE) 文件。
