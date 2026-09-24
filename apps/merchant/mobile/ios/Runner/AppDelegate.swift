import Flutter
import UIKit
import WatchConnectivity
import WidgetKit

private let homeWidgetChannelName = "com.letbuyy.store/home_widgets"
private let appBadgeChannelName = "com.letbuyy.store/app_badge"
private let merchantWidgetSuiteName = "group.com.letbuyy.store"

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, WCSessionDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    if let controller = window?.rootViewController as? FlutterViewController {
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
