//
//  LiveActivityAttributes.swift
//  SwiftChat
//

#if !targetEnvironment(macCatalyst)
import ActivityKit

@available(macCatalyst, unavailable)
struct ChatActivityAttributes: ActivityAttributes, Hashable {
    var startTimestamp: Double

    struct ContentState: Codable, Hashable {
        var totalTasks: Int
        var isFinished: Bool
    }
}
#endif
