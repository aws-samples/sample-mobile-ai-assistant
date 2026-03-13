package com.aws.swiftchat

import android.graphics.Color
import android.os.Build
import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NavigationBarModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NavigationBarModule"

    @ReactMethod
    fun setImmersiveMode(enabled: Boolean) {
        val activity = reactApplicationContext.currentActivity ?: return

        activity.runOnUiThread {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (enabled) {
                    // Make navigation bar transparent and content extend behind it
                    activity.window.setDecorFitsSystemWindows(false)
                    activity.window.navigationBarColor = Color.TRANSPARENT
                } else {
                    activity.window.setDecorFitsSystemWindows(true)
                }
            } else {
                @Suppress("DEPRECATION")
                if (enabled) {
                    activity.window.decorView.systemUiVisibility =
                        activity.window.decorView.systemUiVisibility
                            .or(View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
                            .or(View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
                    activity.window.navigationBarColor = Color.TRANSPARENT
                } else {
                    activity.window.decorView.systemUiVisibility =
                        activity.window.decorView.systemUiVisibility
                            .and(View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION.inv())
                            .and(View.SYSTEM_UI_FLAG_LAYOUT_STABLE.inv())
                }
            }
        }
    }

    @ReactMethod
    fun resetToDefault() {
        val activity = reactApplicationContext.currentActivity ?: return

        activity.runOnUiThread {
            // Trigger MainActivity's updateNavigationBarColor
            if (activity is MainActivity) {
                // Reset immersive mode first
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    activity.window.setDecorFitsSystemWindows(true)
                } else {
                    @Suppress("DEPRECATION")
                    activity.window.decorView.systemUiVisibility =
                        activity.window.decorView.systemUiVisibility
                            .and(View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION.inv())
                            .and(View.SYSTEM_UI_FLAG_LAYOUT_STABLE.inv())
                }
            }

            // Restore default navigation bar color based on theme
            val isDarkMode = activity.resources.configuration.uiMode
                    .and(android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
                    android.content.res.Configuration.UI_MODE_NIGHT_YES

            activity.window.navigationBarColor = if (isDarkMode) Color.BLACK else Color.WHITE
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                activity.window.isNavigationBarContrastEnforced = false
                activity.window.isStatusBarContrastEnforced = false
            }
        }
    }
}
