//
//  SwiftChatLiveActivity.swift
//  SwiftChatLiveActivity
//

#if !targetEnvironment(macCatalyst)
import ActivityKit
import SwiftUI
import WidgetKit

@available(macCatalyst, unavailable)
struct SwiftChatLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ChatActivityAttributes.self) { context in
            // Lock Screen / notification banner
            HStack(spacing: 12) {
                if context.isStale {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.title2)
                    Text("Task interrupted")
                        .font(.headline)
                        .foregroundColor(.orange)
                } else if context.state.isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.title2)
                    Text("SwiftChat · All Completed")
                        .font(.headline)
                        .foregroundColor(.green)
                } else {
                    Image(systemName: "hammer.fill")
                        .foregroundColor(.cyan)
                        .font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Creating \(context.state.totalTasks) app\(context.state.totalTasks == 1 ? "" : "s")")
                            .font(.headline)
                            .foregroundColor(.white)
                        Text(timerInterval: Date(timeIntervalSince1970: context.attributes.startTimestamp)...Date.distantFuture, countsDown: false)
                            .font(.subheadline).monospacedDigit()
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                Spacer()
            }
            .padding()
            .activityBackgroundTint(.black.opacity(0.8))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.bottom) {
                    if context.isStale {
                        Text("Task interrupted")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.orange)
                            .frame(maxWidth: .infinity)
                    } else if context.state.isFinished {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.green)
                            Text("SwiftChat · All Completed")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(.green)
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("Creating \(context.state.totalTasks) app\(context.state.totalTasks == 1 ? "" : "s")")
                                .font(.system(size: 15, weight: .semibold))
                            Text(timerInterval: Date(timeIntervalSince1970: context.attributes.startTimestamp)...Date.distantFuture, countsDown: false)
                                .font(.system(size: 13).monospacedDigit())
                                .foregroundColor(.white.opacity(0.7))
                                .frame(width: 46)
                                .contentTransition(.identity)
                        }
                    }
                }
            } compactLeading: {
                if context.state.isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                } else {
                    Image(systemName: "hammer.fill")
                        .foregroundColor(.cyan)
                }
            } compactTrailing: {
                if context.state.isFinished {
                    Image(systemName: "checkmark")
                        .foregroundColor(.green)
                } else {
                    Text(timerInterval: Date(timeIntervalSince1970: context.attributes.startTimestamp)...Date.distantFuture, countsDown: false)
                        .monospacedDigit()
                        .font(.caption2)
                        .frame(width: 36)
                        .contentTransition(.identity)
                }
            } minimal: {
                if context.state.isFinished {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                } else {
                    Image(systemName: "hammer.fill")
                        .foregroundColor(.cyan)
                }
            }
        }
    }
}
#endif
