//
//  BackgroundKeepAliveModule.swift
//  SwiftChat
//

#if !targetEnvironment(macCatalyst)
import ActivityKit
#endif
import Foundation
import React

@objc(BackgroundKeepAliveModule)
final class BackgroundKeepAliveModule: NSObject, @unchecked Sendable {

    private let service = BackgroundAudioService.shared
    private var currentActivity: Any? = nil

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(start:withRejecter:)
    func start(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        service.start()
        resolve(nil)
    }

    @objc(stop:withRejecter:)
    func stop(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        service.stop()
        resolve(nil)
    }

    @objc(isRunning:withRejecter:)
    func isRunning(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(service.running)
    }

    // MARK: - Live Activity

    @objc(startLiveActivity:withResolver:withRejecter:)
    func startLiveActivity(
        totalCount: Int,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.2, *) {
            // If already active, update the task count (user is in foreground adding new tasks)
            if let existing = Activity<ChatActivityAttributes>.activities.first(where: { $0.activityState == .active }) {
                let updatedState = ChatActivityAttributes.ContentState(
                    totalTasks: totalCount,
                    isFinished: false
                )
                Task {
                    await existing.update(ActivityContent(state: updatedState, staleDate: Date().addingTimeInterval(30 * 60)))
                }
                resolve(true)
                return
            }

            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                resolve(false)
                return
            }

            let attributes = ChatActivityAttributes(startTimestamp: Date().timeIntervalSince1970)
            let state = ChatActivityAttributes.ContentState(
                totalTasks: totalCount,
                isFinished: false
            )
            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: Date().addingTimeInterval(30 * 60))
                )
                currentActivity = activity
                resolve(true)
            } catch {
                resolve(false)
            }
        } else {
            resolve(false)
        }
        #else
        resolve(false)
        #endif
    }

    @objc(endLiveActivity:withRejecter:)
    func endLiveActivity(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        #if !targetEnvironment(macCatalyst)
        if #available(iOS 16.2, *) {
            self.currentActivity = nil
            resolve(true)
            let finalState = ChatActivityAttributes.ContentState(
                totalTasks: 0,
                isFinished: true
            )
            let finalContent = ActivityContent(state: finalState, staleDate: nil)
            let allActivities = Activity<ChatActivityAttributes>.activities
            Task {
                for activity in allActivities {
                    await activity.end(finalContent, dismissalPolicy: .after(Date().addingTimeInterval(30)))
                }

            }
        } else {
            resolve(false)
        }
        #else
        resolve(false)
        #endif
    }
}
