import Foundation
import LiteRTLM

struct RecordFindingTool: Tool {
  static let name = "recordFinding"
  static let description = "Record an inspection finding for a specific check dimension. You must call this tool for each inspection step."

  @ToolParam(description: "The check type: textCheck, damageCheck, or alignmentCheck")
  var checkType: String

  @ToolParam(description: "Pass or Fail")
  var status: String

  @ToolParam(description: "Detailed description of findings")
  var details: String

  func run() async throws -> Any {
    print("[LiteRT-Tool] recordFinding called: checkType=\(checkType), status=\(status), details=\(details)")
    NotificationCenter.default.post(
      name: .liteRTToolCall,
      object: nil,
      userInfo: ["check_type": checkType, "status": status, "details": details]
    )
    return ["recorded": true, "check_type": checkType, "status": status]
  }
}

extension Notification.Name {
  static let liteRTToolCall = Notification.Name("LiteRTToolCall")
}
