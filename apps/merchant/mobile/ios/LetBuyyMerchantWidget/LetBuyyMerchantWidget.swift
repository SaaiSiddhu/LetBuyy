import SwiftUI
import WidgetKit

private let suiteName = "group.com.letbuyy.store"

private enum WidgetKeys {
  static let storeName = "letbuyy.widget.store_name"
  static let revenue = "letbuyy.widget.revenue"
  static let orders = "letbuyy.widget.orders"
  static let products = "letbuyy.widget.products"
  static let openOrders = "letbuyy.widget.open_orders"
  static let updatedAt = "letbuyy.widget.updated_at"
}

struct MerchantMetricsSnapshot {
  let storeName: String
  let revenue: Double?
  let orders: Int?
  let products: Int?
  let openOrders: Int?
  let updatedAt: Date?

  var hasMetrics: Bool {
    revenue != nil || orders != nil || products != nil || openOrders != nil
  }

  static let empty = MerchantMetricsSnapshot(
    storeName: "LetBuyy",
    revenue: nil,
    orders: nil,
    products: nil,
    openOrders: nil,
    updatedAt: nil
  )

  static func load() -> MerchantMetricsSnapshot {
    guard let defaults = UserDefaults(suiteName: suiteName) else {
      return .empty
    }

    let storeName = defaults.string(forKey: WidgetKeys.storeName) ?? "LetBuyy"
    let updatedAt = defaults
      .string(forKey: WidgetKeys.updatedAt)
      .flatMap { ISO8601DateFormatter().date(from: $0) }

    return MerchantMetricsSnapshot(
      storeName: storeName.isEmpty ? "LetBuyy" : storeName,
      revenue: defaults.object(forKey: WidgetKeys.revenue) as? Double,
      orders: defaults.object(forKey: WidgetKeys.orders) as? Int,
      products: defaults.object(forKey: WidgetKeys.products) as? Int,
      openOrders: defaults.object(forKey: WidgetKeys.openOrders) as? Int,
      updatedAt: updatedAt
    )
  }
}

struct MerchantMetricsEntry: TimelineEntry {
  let date: Date
  let snapshot: MerchantMetricsSnapshot
}

struct MerchantMetricsProvider: TimelineProvider {
  func placeholder(in context: Context) -> MerchantMetricsEntry {
    MerchantMetricsEntry(date: Date(), snapshot: .empty)
  }

  func getSnapshot(
    in context: Context,
    completion: @escaping (MerchantMetricsEntry) -> Void
  ) {
    completion(MerchantMetricsEntry(date: Date(), snapshot: MerchantMetricsSnapshot.load()))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<MerchantMetricsEntry>) -> Void
  ) {
    let entry = MerchantMetricsEntry(date: Date(), snapshot: MerchantMetricsSnapshot.load())
    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
  }
}

struct LetBuyyMerchantWidgetEntryView: View {
  var entry: MerchantMetricsEntry

  var body: some View {
    let snapshot = entry.snapshot

    ZStack {
      Color(red: 0.07, green: 0.09, blue: 0.14)
      VStack(alignment: .leading, spacing: 8) {
        Text(snapshot.storeName)
          .font(.headline)
          .foregroundColor(.white)
          .lineLimit(1)
        Text(snapshot.hasMetrics ? "Last synced from merchant dashboard" : "Open LetBuyy to sync metrics")
          .font(.caption2)
          .foregroundColor(Color(red: 0.58, green: 0.64, blue: 0.72))
          .lineLimit(1)
        Spacer(minLength: 4)
        Text(snapshot.revenue.map { formatInr($0) } ?? "--")
          .font(.title2.bold())
          .foregroundColor(.white)
          .lineLimit(1)
        HStack {
          metric("Open", snapshot.openOrders)
          metric("Orders", snapshot.orders)
          metric("Products", snapshot.products)
        }
      }
      .padding(14)
    }
  }

  private func metric(_ label: String, _ value: Int?) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.caption2)
        .foregroundColor(Color(red: 0.58, green: 0.64, blue: 0.72))
      Text(value.map { String($0) } ?? "--")
        .font(.subheadline.bold())
        .foregroundColor(.white)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func formatInr(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "INR"
    formatter.locale = Locale(identifier: "en_IN")
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: amount)) ?? "INR \(Int(amount))"
  }
}

@main
struct LetBuyyMerchantWidget: Widget {
  let kind: String = "LetBuyyMerchantWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: MerchantMetricsProvider()) { entry in
      LetBuyyMerchantWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("LetBuyy Metrics")
    .description("Track revenue and open orders from your merchant dashboard.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
