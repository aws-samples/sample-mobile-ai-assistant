//
//  SwiftChatLiveActivityBundle.swift
//  SwiftChatLiveActivity
//

import SwiftUI
import WidgetKit

@main
struct SwiftChatLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        #if !targetEnvironment(macCatalyst)
        SwiftChatLiveActivity()
        #endif
    }
}
