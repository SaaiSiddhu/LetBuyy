import SwiftUI
import WatchConnectivity

private let watchSuiteName = "group.com.letbuyy.store"

private enum WatchMetricKeys {
  static let storeName = "letbuyy.widget.store_name"
  static let revenue = "letbuyy.widget.revenue"
  static let orders = "letbuyy.widget.orders"
  static let products = "letbuyy.widget.products"
  static let visitors = "letbuyy.widget.visitors"
  static let averageOrderValue = "letbuyy.widget.average_order_value"
  static let openOrders = "letbuyy.widget.open_orders"
  static let updatedAt = "letbuyy.widget.updated_at"
}

struct WatchMetricsSnapshot {
  let storeName: String
  let revenue: Double?
  let orders: Int?
  let products: Int?
  let visitors: Int?
  let averageOrderValue: Double?
  let openOrders: Int?
  let updatedAt: Date?

  var hasMetrics: Bool {
    revenue != nil || orders != nil || visitors != nil || openOrders != nil
  }

  static let empty = WatchMetricsSnapshot(
    storeName: "LetBuyy",
    revenue: nil,
    orders: nil,
    products: nil,
    visitors: nil,
    averageOrderValue: nil,
    openOrders: nil,
    updatedAt: nil
  )

  static func load() -> WatchMetricsSnapshot {
    guard let defaults = UserDefaults(suiteName: watchSuiteName) else {
      return .empty
    }

    let storeName = defaults.string(forKey: WatchMetricKeys.storeName) ?? "LetBuyy"
    let updatedAt = defaults
      .string(forKey: WatchMetricKeys.updatedAt)
      .flatMap { ISO8601DateFormatter().date(from: $0) }

    return WatchMetricsSnapshot(
      storeName: storeName.isEmpty ? "LetBuyy" : storeName,
      revenue: defaults.object(forKey: WatchMetricKeys.revenue) as? Double,
      orders: defaults.object(forKey: WatchMetricKeys.orders) as? Int,
      products: defaults.object(forKey: WatchMetricKeys.products) as? Int,
      visitors: defaults.object(forKey: WatchMetricKeys.visitors) as? Int,
      averageOrderValue: defaults.object(forKey: WatchMetricKeys.averageOrderValue) as? Double,
      openOrders: defaults.object(forKey: WatchMetricKeys.openOrders) as? Int,
      updatedAt: updatedAt
    )
  }

  static func save(_ payload: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: watchSuiteName) else {
      return
    }

    for (key, value) in payload where key.hasPrefix("letbuyy.widget.") {
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
  }
}

final class WatchMetricsStore: NSObject, ObservableObject, WCSessionDelegate {
  @Published private(set) var snapshot: WatchMetricsSnapshot = .load()

  override init() {
    super.init()
    activateSession()
  }

  private func activateSession() {
    guard WCSession.isSupported() else {
      return
    }

    let session = WCSession.default
    session.delegate = self
    session.activate()
    if !session.applicationContext.isEmpty {
      apply(session.applicationContext)
    }
  }

  private func apply(_ context: [String: Any]) {
    WatchMetricsSnapshot.save(context)
    DispatchQueue.main.async {
      self.snapshot = .load()
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated, !session.applicationContext.isEmpty {
      apply(session.applicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    apply(applicationContext)
  }
}

struct LetBuyyMerchantWatchView: View {
  @ObservedObject var metrics: WatchMetricsStore

  var body: some View {
    let snapshot = metrics.snapshot

    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text(snapshot.storeName)
          .font(.headline)
          .lineLimit(1)
        Text(snapshot.hasMetrics ? syncText(snapshot.updatedAt) : "Open LetBuyy on iPhone to sync metrics")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(2)

        Text(snapshot.revenue.map { formatInr($0) } ?? "--")
          .font(.title2.bold())
          .lineLimit(1)
          .padding(.top, 4)

        metricRow("Open", snapshot.openOrders)
        metricRow("Orders", snapshot.orders)
        metricRow("Sessions", snapshot.visitors)
        metricRow("Products", snapshot.products)
        metricRow("AOV", snapshot.averageOrderValue.map { formatInr($0) })
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.vertical, 4)
    }
  }

  private func metricRow(_ label: String, _ value: Int?) -> some View {
    metricRow(label, value.map { String($0) })
  }

  private func metricRow(_ label: String, _ value: String?) -> some View {
    HStack {
      Text(label)
        .foregroundStyle(.secondary)
      Spacer()
      Text(value ?? "--")
        .bold()
    }
    .font(.caption)
  }

  private func formatInr(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "INR"
    formatter.locale = Locale(identifier: "en_IN")
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: amount)) ?? "INR \(Int(amount))"
  }

  private func syncText(_ date: Date?) -> String {
    guard let date else {
      return "Synced from merchant dashboard"
    }
    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .abbreviated
    return "Synced \(formatter.localizedString(for: date, relativeTo: Date()))"
  }
}

@main
struct LetBuyyMerchantWatchApp: App {
  @StateObject private var metrics = WatchMetricsStore()

  var body: some Scene {
    WindowGroup {
      LetBuyyMerchantWatchView(metrics: metrics)
    }
  }
}
