// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "LiteRTLM",
  platforms: [
    .iOS(.v15),
    .macOS(.v12),
  ],
  products: [
    .library(
      name: "LiteRTLM",
      targets: ["LiteRTLM"]
    )
  ],
  targets: [
    .binaryTarget(
      name: "CLiteRTLM",
      url: "https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.12.0/CLiteRTLM.xcframework.zip",
      checksum: "3c2a11ecc8511d1e74efa7ca308dc7130c95223325c33212337ffb0563b79cde"
    ),
    .target(
      name: "LiteRTLM",
      dependencies: ["CLiteRTLM"],
      path: "swift",
      exclude: [
        "CapabilitiesTests.swift",
        "EngineTests.swift",
        "ConversationTests.swift",
        "ToolTests.swift",
        "MessageTests.swift",
        "BUILD",
        "Info.plist",
      ]
    ),
  ]
)
