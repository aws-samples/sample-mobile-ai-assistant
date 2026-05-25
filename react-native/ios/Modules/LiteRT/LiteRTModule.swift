import Foundation
import React
@preconcurrency import LiteRTLM

@objc(LiteRTModule)
final class LiteRTModule: RCTEventEmitter, @unchecked Sendable {
  private nonisolated(unsafe) var engine: Engine?
  private nonisolated(unsafe) var conversation: Conversation?
  private var hasListeners = false
  private var isGenerating = false
  private var isInitializing = false

  override func supportedEvents() -> [String] {
    return ["onLiteRTToken", "onLiteRTComplete", "onLiteRTError"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(initialize:withResolver:withRejecter:)
  func initialize(_ config: [String: Any],
                  resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
    let safeResolve = SendableResolve(block: resolve)
    let safeReject = SendableReject(block: reject)

    let maxTokens = config["maxTokens"] as? Int ?? 4096

    Task {
      do {
        if self.engine != nil {
          await MainActor.run { safeResolve(["success": true]) }
          return
        }
        if self.isInitializing {
          var waitCount = 0
          while self.isInitializing && waitCount < 100 {
            try await Task.sleep(nanoseconds: 200_000_000)
            waitCount += 1
          }
          let success = self.engine != nil
          await MainActor.run {
            if success { safeResolve(["success": true]) }
            else { safeReject("INIT_ERROR", "Engine initialization timed out or failed", nil) }
          }
          return
        }
        self.isInitializing = true

        let modelPath = self.getModelPath()
        guard FileManager.default.fileExists(atPath: modelPath) else {
          self.isInitializing = false
          await MainActor.run {
            safeReject("MODEL_NOT_FOUND", "Model file not found at: \(modelPath)", nil)
          }
          return
        }

        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
          .appendingPathComponent("litert_cache").path

        if !FileManager.default.fileExists(atPath: cacheDir) {
          try FileManager.default.createDirectory(atPath: cacheDir, withIntermediateDirectories: true)
        }

        #if targetEnvironment(simulator)
        let backend: Backend = .cpu()
        #else
        let backend: Backend = .gpu
        #endif

        let engineConfig = try EngineConfig(
          modelPath: modelPath,
          backend: backend,
          maxNumTokens: maxTokens,
          cacheDir: cacheDir
        )

        let newEngine = Engine(engineConfig: engineConfig)
        try await newEngine.initialize()
        self.engine = newEngine
        self.isInitializing = false

        await MainActor.run {
          safeResolve(["success": true])
        }
      } catch {
        self.isInitializing = false
        await MainActor.run {
          safeReject("INIT_ERROR", "Failed to initialize LiteRT engine: \(error.localizedDescription)", error)
        }
      }
    }
  }

  @objc(sendMessage:withSystemPrompt:withResolver:withRejecter:)
  func sendMessage(_ text: String,
                   systemPrompt: String?,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
    let safeResolve = SendableResolve(block: resolve)
    let safeReject = SendableReject(block: reject)

    guard let engine = self.engine else {
      reject("ENGINE_NOT_READY", "Engine is not initialized", nil)
      return
    }

    isGenerating = true

    Task {
      do {
        if self.conversation == nil {
          let samplerConfig = try SamplerConfig(topK: 40, topP: 0.95, temperature: 0.7)
          let config: ConversationConfig
          if let systemPrompt = systemPrompt, !systemPrompt.isEmpty {
            config = ConversationConfig(
              systemMessage: Message(systemPrompt),
              samplerConfig: samplerConfig
            )
          } else {
            config = ConversationConfig(samplerConfig: samplerConfig)
          }
          self.conversation = try await engine.createConversation(with: config)
        }

        guard let conversation = self.conversation else {
          await MainActor.run {
            safeReject("CONVERSATION_ERROR", "Failed to create conversation", nil)
          }
          return
        }

        var fullResponse = ""
        for try await chunk in conversation.sendMessageStream(Message(text)) {
          guard self.isGenerating else { break }
          let tokenText = chunk.toString
          fullResponse += tokenText
          if self.hasListeners {
            let snapshot = fullResponse
            DispatchQueue.main.async { [weak self] in
              self?.sendEvent(withName: "onLiteRTToken", body: ["text": snapshot])
            }
          }
        }

        self.isGenerating = false
        let finalResponse = fullResponse
        if self.hasListeners {
          DispatchQueue.main.async { [weak self] in
            self?.sendEvent(withName: "onLiteRTComplete", body: ["text": finalResponse])
          }
        }

        await MainActor.run {
          safeResolve(["text": finalResponse])
        }
      } catch {
        self.isGenerating = false
        await MainActor.run {
          safeReject("SEND_ERROR", "Failed to send message: \(error.localizedDescription)", error)
        }
      }
    }
  }

  @objc(stopGeneration:withRejecter:)
  func stopGeneration(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    isGenerating = false
    try? conversation?.cancel()
    resolve(["success": true])
  }

  @objc(resetConversation:withRejecter:)
  func resetConversation(_ resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    conversation = nil
    resolve(["success": true])
  }

  @objc(getModelStatus:withRejecter:)
  func getModelStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {
    let modelPath = getModelPath()
    let exists = FileManager.default.fileExists(atPath: modelPath)
    let engineReady = engine != nil
    resolve([
      "modelExists": exists,
      "engineReady": engineReady,
      "modelPath": modelPath
    ])
  }

  private func getModelPath() -> String {
    let modelFileName = "gemma-4-E2B-it.litertlm"

    // Primary: Application Support directory (production path)
    let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let modelDir = appSupport.appendingPathComponent("LiteRT/Models")
    if !FileManager.default.fileExists(atPath: modelDir.path) {
      try? FileManager.default.createDirectory(at: modelDir, withIntermediateDirectories: true)
    }
    let primaryPath = modelDir.appendingPathComponent(modelFileName).path
    if FileManager.default.fileExists(atPath: primaryPath) {
      return primaryPath
    }

    // Fallback: Documents directory
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    let docsPath = docs.appendingPathComponent(modelFileName).path
    if FileManager.default.fileExists(atPath: docsPath) {
      return docsPath
    }

    #if targetEnvironment(macCatalyst) || os(macOS)
    // Dev fallback for Mac: check ~/Downloads
    let home = FileManager.default.homeDirectoryForCurrentUser
    let downloadsPath = home.appendingPathComponent("Downloads/\(modelFileName)").path
    if FileManager.default.fileExists(atPath: downloadsPath) {
      return downloadsPath
    }
    #endif

    return primaryPath
  }
}
