// packages/models/lib/src/analytics_event.dart
// 📊 Analytics Event Model for tracking product views, clicks, orders, and ads

import 'package:cloud_firestore/cloud_firestore.dart';

/// Types of product events that can be tracked
enum ProductEventType {
  view,       // Product page viewed
  click,      // Product clicked (from list)
  cartAdd,    // Added to cart
  cartRemove, // Removed from cart
  wishlist,   // Added to wishlist
  order,      // Order placed
}

/// Traffic sources for attribution
enum TrafficSource {
  organic,        // Direct navigation / home page
  search,         // From search results
  category,       // From category browsing
  ads,            // From sponsored ads
  recommendation, // From "You may also like" / "Similar products"
  external,       // External link / social media
  notification,   // From push notification
  deepLink,       // From deep link
}

/// Analytics event model for tracking all product interactions
class AnalyticsEvent {
  final String? id;
  final String sellerId;
  final String productId;
  final ProductEventType eventType;
  final TrafficSource source;
  final String? adCampaignId;
  final String? userId;
  final int quantity;
  final double? revenue;
  final DateTime timestamp;
  final Map<String, dynamic>? metadata;

  AnalyticsEvent({
    this.id,
    required this.sellerId,
    required this.productId,
    required this.eventType,
    required this.source,
    this.adCampaignId,
    this.userId,
    this.quantity = 1,
    this.revenue,
    DateTime? timestamp,
    this.metadata,
  }) : timestamp = timestamp ?? DateTime.now();

  /// Convert event type to string for Firestore
  static String eventTypeToString(ProductEventType type) {
    switch (type) {
      case ProductEventType.view:
        return 'view';
      case ProductEventType.click:
        return 'click';
      case ProductEventType.cartAdd:
        return 'cart_add';
      case ProductEventType.cartRemove:
        return 'cart_remove';
      case ProductEventType.wishlist:
        return 'wishlist';
      case ProductEventType.order:
        return 'order';
    }
  }

  /// Parse event type from string
  static ProductEventType eventTypeFromString(String type) {
    switch (type) {
      case 'view':
        return ProductEventType.view;
      case 'click':
        return ProductEventType.click;
      case 'cart_add':
        return ProductEventType.cartAdd;
      case 'cart_remove':
        return ProductEventType.cartRemove;
      case 'wishlist':
        return ProductEventType.wishlist;
      case 'order':
        return ProductEventType.order;
      default:
        return ProductEventType.view;
    }
  }

  /// Convert source to string for Firestore
  static String sourceToString(TrafficSource source) {
    switch (source) {
      case TrafficSource.organic:
        return 'organic';
      case TrafficSource.search:
        return 'search';
      case TrafficSource.category:
        return 'category';
      case TrafficSource.ads:
        return 'ads';
      case TrafficSource.recommendation:
        return 'recommendation';
      case TrafficSource.external:
        return 'external';
      case TrafficSource.notification:
        return 'notification';
      case TrafficSource.deepLink:
        return 'deep_link';
    }
  }

  /// Parse source from string
  static TrafficSource sourceFromString(String? source) {
    switch (source) {
      case 'organic':
        return TrafficSource.organic;
      case 'search':
        return TrafficSource.search;
      case 'category':
        return TrafficSource.category;
      case 'ads':
        return TrafficSource.ads;
      case 'recommendation':
        return TrafficSource.recommendation;
      case 'external':
        return TrafficSource.external;
      case 'notification':
        return TrafficSource.notification;
      case 'deep_link':
        return TrafficSource.deepLink;
      default:
        return TrafficSource.organic;
    }
  }

  /// Convert to Firestore document
  Map<String, dynamic> toFirestore() {
    return {
      'sellerId': sellerId,
      'productId': productId,
      'eventType': eventTypeToString(eventType),
      'source': sourceToString(source),
      'adCampaignId': adCampaignId,
      'userId': userId,
      'quantity': quantity,
      'revenue': revenue,
      'timestamp': Timestamp.fromDate(timestamp),
      'metadata': metadata,
      // For aggregation queries
      'date': '${timestamp.year}-${timestamp.month.toString().padLeft(2, '0')}-${timestamp.day.toString().padLeft(2, '0')}',
      'hour': timestamp.hour,
      'dayOfWeek': timestamp.weekday,
    };
  }

  /// Create from Firestore document
  factory AnalyticsEvent.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return AnalyticsEvent(
      id: doc.id,
      sellerId: data['sellerId'] ?? '',
      productId: data['productId'] ?? '',
      eventType: eventTypeFromString(data['eventType'] ?? 'view'),
      source: sourceFromString(data['source']),
      adCampaignId: data['adCampaignId'],
      userId: data['userId'],
      quantity: data['quantity'] ?? 1,
      revenue: (data['revenue'] as num?)?.toDouble(),
      timestamp: (data['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
      metadata: data['metadata'] as Map<String, dynamic>?,
    );
  }

  @override
  String toString() {
    return 'AnalyticsEvent(sellerId: $sellerId, productId: $productId, type: $eventType, source: $source)';
  }
}

/// Hourly aggregated stats for a seller
class HourlyAnalytics {
  final String sellerId;
  final String date;
  final int hour;
  final int views;
  final int clicks;
  final int cartAdds;
  final int orders;
  final double revenue;
  final int adImpressions;
  final int adClicks;
  final int adOrders;

  HourlyAnalytics({
    required this.sellerId,
    required this.date,
    required this.hour,
    this.views = 0,
    this.clicks = 0,
    this.cartAdds = 0,
    this.orders = 0,
    this.revenue = 0.0,
    this.adImpressions = 0,
    this.adClicks = 0,
    this.adOrders = 0,
  });

  Map<String, dynamic> toFirestore() {
    return {
      'sellerId': sellerId,
      'date': date,
      'hour': hour,
      'views': views,
      'clicks': clicks,
      'cartAdds': cartAdds,
      'orders': orders,
      'revenue': revenue,
      'adImpressions': adImpressions,
      'adClicks': adClicks,
      'adOrders': adOrders,
    };
  }

  factory HourlyAnalytics.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return HourlyAnalytics(
      sellerId: data['sellerId'] ?? '',
      date: data['date'] ?? '',
      hour: data['hour'] ?? 0,
      views: data['views'] ?? 0,
      clicks: data['clicks'] ?? 0,
      cartAdds: data['cartAdds'] ?? 0,
      orders: data['orders'] ?? 0,
      revenue: (data['revenue'] as num?)?.toDouble() ?? 0.0,
      adImpressions: data['adImpressions'] ?? 0,
      adClicks: data['adClicks'] ?? 0,
      adOrders: data['adOrders'] ?? 0,
    );
  }
}

/// Daily aggregated stats for a seller
class DailyAnalytics {
  final String sellerId;
  final String date;
  final int dayOfWeek;
  final int totalViews;
  final int totalClicks;
  final int totalCartAdds;
  final int totalOrders;
  final double totalRevenue;
  final double conversionRate;
  final int uniqueVisitors;
  final Map<String, int> sourceBreakdown;

  DailyAnalytics({
    required this.sellerId,
    required this.date,
    required this.dayOfWeek,
    this.totalViews = 0,
    this.totalClicks = 0,
    this.totalCartAdds = 0,
    this.totalOrders = 0,
    this.totalRevenue = 0.0,
    this.conversionRate = 0.0,
    this.uniqueVisitors = 0,
    this.sourceBreakdown = const {},
  });

  Map<String, dynamic> toFirestore() {
    return {
      'sellerId': sellerId,
      'date': date,
      'dayOfWeek': dayOfWeek,
      'totalViews': totalViews,
      'totalClicks': totalClicks,
      'totalCartAdds': totalCartAdds,
      'totalOrders': totalOrders,
      'totalRevenue': totalRevenue,
      'conversionRate': conversionRate,
      'uniqueVisitors': uniqueVisitors,
      'sourceBreakdown': sourceBreakdown,
    };
  }

  factory DailyAnalytics.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return DailyAnalytics(
      sellerId: data['sellerId'] ?? '',
      date: data['date'] ?? '',
      dayOfWeek: data['dayOfWeek'] ?? 1,
      totalViews: data['totalViews'] ?? 0,
      totalClicks: data['totalClicks'] ?? 0,
      totalCartAdds: data['totalCartAdds'] ?? 0,
      totalOrders: data['totalOrders'] ?? 0,
      totalRevenue: (data['totalRevenue'] as num?)?.toDouble() ?? 0.0,
      conversionRate: (data['conversionRate'] as num?)?.toDouble() ?? 0.0,
      uniqueVisitors: data['uniqueVisitors'] ?? 0,
      sourceBreakdown: Map<String, int>.from(data['sourceBreakdown'] ?? {}),
    );
  }
}
