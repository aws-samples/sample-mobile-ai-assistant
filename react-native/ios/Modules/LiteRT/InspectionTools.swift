import Foundation
import LiteRTLM

// Generic step recorder used by agent system prompts.
// The stepName is defined by the prompt, so new scenarios need no code changes.
struct RecordFindingTool: Tool {
  static let name = "recordFinding"
  static let description = "Record a finding for a specific step. Call this for each step defined in the instructions."

  @ToolParam(description: "The step name as defined in the instructions")
  var stepName: String

  @ToolParam(description: "Pass or Fail")
  var status: String

  @ToolParam(description: "Detailed description of findings")
  var details: String

  func run() async throws -> Any {
    NotificationCenter.default.post(
      name: .liteRTToolCall,
      object: nil,
      userInfo: [
        "stepName": stepName,
        "status": status,
        "details": details,
      ]
    )
    return ["recorded": true, "stepName": stepName, "status": status]
  }
}

extension Notification.Name {
  static let liteRTToolCall = Notification.Name("LiteRTToolCall")
}
