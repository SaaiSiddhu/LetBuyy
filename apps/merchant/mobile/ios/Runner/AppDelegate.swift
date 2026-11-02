import Flutter
import UIKit
import WatchConnectivity
import WidgetKit
import AuthenticationServices

private let homeWidgetChannelName = "com.letbuyy.store/home_widgets"
private let appBadgeChannelName = "com.letbuyy.store/app_badge"
private let merchantWidgetSuiteName = "group.com.letbuyy.store"

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, WCSessionDelegate {
  private var accountsChannel: FlutterMethodChannel?
  private var accountsSession: ASWebAuthenticationSession?
  private var accountsGeneration = 0
  private var initialAccountCallback: String?
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    if let controller = window?.rootViewController as? FlutterViewController {
      configureAccounts(messenger: controller.binaryMessenger)
      FlutterMethodChannel(
        name: homeWidgetChannelName,
        binaryMessenger: controller.binaryMessenger
      ).setMethodCallHandler { call, result in
        guard call.method == "publishMetricsSnapshot" else {
          result(FlutterMethodNotImplemented)
          return
        }

        guard let payload = call.arguments as? [String: Any] else {
          result(FlutterError(
            code: "INVALID_WIDGET_PAYLOAD",
            message: "Widget metrics payload was not a dictionary.",
            details: nil
          ))
          return
        }

        Self.saveMerchantWidgetPayload(payload)
        if #available(iOS 14.0, *) {
          WidgetCenter.shared.reloadAllTimelines()
        }
        result(nil)
      }

      FlutterMethodChannel(
        name: appBadgeChannelName,
        binaryMessenger: controller.binaryMessenger
      ).setMethodCallHandler { call, result in
        switch call.method {
        case "setBadgeCount":
          guard let count = Self.badgeCount(from: call.arguments) else {
            result(FlutterError(
              code: "INVALID_BADGE_COUNT",
              message: "Badge count payload was invalid.",
              details: nil
            ))
            return
          }
          Self.setApplicationBadgeCount(count)
          result(nil)
        case "clearBadge":
          Self.setApplicationBadgeCount(0)
          result(nil)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "MerchantAccountsBrowser") {
      configureAccounts(messenger: registrar.messenger())
    }
  }

  private func configureAccounts(messenger: FlutterBinaryMessenger) {
    guard accountsChannel == nil else { return }
    let channel = FlutterMethodChannel(name: "com.letbuyy.store/accounts", binaryMessenger: messenger)
    accountsChannel = channel
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self = self else { return }
      switch call.method {
      case "takeInitialCallback":
        result(self.initialAccountCallback); self.initialAccountCallback = nil
      case "close":
        self.accountsGeneration += 1
        self.accountsSession?.cancel(); self.accountsSession = nil
        result(nil)
      case "open":
        guard let args = call.arguments as? [String: String], let raw = args["url"],
          let url = URL(string: raw), let host = url.host, url.path == "/mobile/authorize",
          url.user == nil, url.password == nil,
          let callbackScheme = args["callbackScheme"],
          ["com.letbuyy.store.accounts", "com.letbuyy.store.accounts.staging", "com.letbuyy.store.accounts.development"].contains(callbackScheme),
          (url.scheme == "https" && ["accounts.letbuyy.com", "accounts.staging.letbuyy.com"].contains(host)) ||
            (url.scheme == "http" && ["localhost", "127.0.0.1"].contains(host)) else {
          result(FlutterError(code: "INVALID_ACCOUNTS_ORIGIN", message: "Invalid secure sign-in destination.", details: nil)); return
        }
        self.accountsGeneration += 1
        let generation = self.accountsGeneration
        self.accountsSession?.cancel()
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { [weak self] callback, error in
          guard let self = self, generation == self.accountsGeneration else { return }
          self.accountsSession = nil
          if let callback = callback { self.acceptAccountCallback(callback) }
          else { self.accountsChannel?.invokeMethod("cancelled", arguments: nil) }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        self.accountsSession = session
        if session.start() { result(nil) }
        else { self.accountsSession = nil; result(FlutterError(code: "BROWSER_UNAVAILABLE", message: "Secure sign-in could not open.", details: nil)) }
      default: result(FlutterMethodNotImplemented)
      }
    }
  }

  func acceptAccountCallback(_ url: URL) {
    guard let scheme = url.scheme,
      ["com.letbuyy.store.accounts", "com.letbuyy.store.accounts.staging", "com.letbuyy.store.accounts.development"].contains(scheme),
      url.host == "auth", url.path == "/callback", url.user == nil, url.password == nil, url.fragment == nil else { return }
    initialAccountCallback = url.absoluteString
    accountsChannel?.invokeMethod("callback", arguments: url.absoluteString)
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  private static func saveMerchantWidgetPayload(_ payload: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: merchantWidgetSuiteName) else {
      return
    }

    for (key, value) in payload {
      switch value {
      case let stringValue as String:
        defaults.set(stringValue, forKey: key)
      case let intValue as Int:
        defaults.set(intValue, forKey: key)
      case let doubleValue as Double:
        defaults.set(doubleValue, forKey: key)
      case let numberValue as NSNumber:
        defaults.set(numberValue, forKey: key)
      default:
        continue
      }
    }
    defaults.synchronize()
    Self.syncWatchMetricsPayload(payload)
  }

  private static func syncWatchMetricsPayload(_ payload: [String: Any]) {
    guard WCSession.isSupported() else {
      return
    }

    let session = WCSession.default
    guard session.activationState == .activated,
          session.isPaired,
          session.isWatchAppInstalled else {
      return
    }

    let context = payload.filter { key, value in
      key.hasPrefix("letbuyy.widget.") && isPropertyListValue(value)
    }
    guard !context.isEmpty else {
      return
    }

    try? session.updateApplicationContext(context)
  }

  private static func isPropertyListValue(_ value: Any) -> Bool {
    switch value {
    case is String, is Int, is Double, is NSNumber:
      return true
    default:
      return false
    }
  }

  private static func badgeCount(from arguments: Any?) -> Int? {
    guard let payload = arguments as? [String: Any] else {
      return nil
    }
    let value = payload["count"]
    if let intValue = value as? Int {
      return max(0, intValue)
    }
    if let numberValue = value as? NSNumber {
      return max(0, numberValue.intValue)
    }
    if let stringValue = value as? String, let parsed = Int(stringValue) {
      return max(0, parsed)
    }
    return nil
  }

  private static func setApplicationBadgeCount(_ count: Int) {
    DispatchQueue.main.async {
      UIApplication.shared.applicationIconBadgeNumber = max(0, count)
    }
  }
}

extension AppDelegate: ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    return window ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }.first(where: { $0.isKeyWindow }) ?? ASPresentationAnchor()
  }
}

/// Routes cold-start and warm links through the same coordinator as ASWebAuthenticationSession.
@objc class MerchantSceneDelegate: FlutterSceneDelegate {
  override func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    for context in connectionOptions.urlContexts { (UIApplication.shared.delegate as? AppDelegate)?.acceptAccountCallback(context.url) }
    super.scene(scene, willConnectTo: session, options: connectionOptions)
  }
  override func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts { (UIApplication.shared.delegate as? AppDelegate)?.acceptAccountCallback(context.url) }
    super.scene(scene, openURLContexts: URLContexts)
  }
}
