//
//  LiveActivityAttributes.swift
//  SwiftChat
//

import ActivityKit

struct ChatActivityAttributes: ActivityAttributes, Hashable {
    var startTimestamp: Double

    struct ContentState: Codable, Hashable {
        var totalTasks: Int
        var isFinished: Bool
    }
}
