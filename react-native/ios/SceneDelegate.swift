import UIKit
import React

@available(iOS 13.0, *)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        #if targetEnvironment(macCatalyst)
        // Hide the title text in the title bar for Mac Catalyst
        windowScene.titlebar?.titleVisibility = .hidden
        #endif

        // Get the shared AppDelegate instance
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
            fatalError("AppDelegate not found")
        }

        // Create the window for this scene
        window = UIWindow(windowScene: windowScene)

        // Use RCTAppDelegate's rootViewFactory to create the root view with New Architecture
      let rootView = appDelegate.rootViewFactory().view(
            withModuleName: appDelegate.moduleName ?? "SwiftChat",
            initialProperties: appDelegate.initialProps as? [String: Any],
            launchOptions: nil
        )

        // Configure root view appearance
        rootView.backgroundColor = UIColor.systemBackground

        // Create and configure view controller
        let rootViewController = UIViewController()
        rootViewController.view = rootView

        // Set the root view controller and make the window visible
        window?.rootViewController = rootViewController
        window?.makeKeyAndVisible()
    }

    func sceneDidDisconnect(_ scene: UIScene) {
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
    }

    func sceneWillResignActive(_ scene: UIScene) {
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
    }
}
