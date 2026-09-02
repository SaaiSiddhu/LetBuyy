// packages/services/lib/src/seller_analytics_service.dart
// 📊 Seller Analytics Service for tracking product events, views, and conversions
// Stores data in Firestore for seller dashboard heatmaps

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

/// Service for tracking seller-specific analytics events across the LetBuyy platform
class SellerAnalyticsService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  // Collection references
  static CollectionReference get _eventsCollection => 
      _firestore.collection('seller_analytics').doc('events').collection('raw');
  
  static CollectionReference get _hourlyCollection => 
      _firestore.collection('seller_analytics').doc('aggregates').collection('hourly');
  
  static CollectionReference get _dailyCollection => 
      _firestore.collection('seller_analytics').doc('aggregates').collection('daily');

  /// Track a product event (view, click, cart, order, etc.)
  static Future<void> trackProductEvent({
    required String sellerId,
    required String productId,
    required ProductEventType eventType,
    TrafficSource source = TrafficSource.organic,
    String? adCampaignId,
    String? userId,
    int quantity = 1,
    double? revenue,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final event = AnalyticsEvent(
        sellerId: sellerId,
        productId: productId,
        eventType: eventType,
        source: source,
        adCampaignId: adCampaignId,
        userId: userId,
        quantity: quantity,
        revenue: revenue,
        metadata: metadata,
      );
      
      // Save raw event
      await _eventsCollection.add(event.toFirestore());
      
      // Update real-time counters (for immediate dashboard updates)
    await _updateRealtimeCounters(event);
    
    // Log with source info for debugging
    final sourceInfo = source != TrafficSource.organic 
        ? ' (source: ${source.name}${adCampaignId != null ? ', campaign: $adCampaignId' : ''})'
        : '';
    print('📊 SellerAnalytics: Tracked ${eventType.name} for product $productId$sourceInfo');
    } catch (e) {
      print('❌ SellerAnalytics Error: $e');
      // Don't throw - analytics should never break the app
    }
  }

  /// Track product view - convenience method
  static Future<void> trackProductView({
    required String sellerId,
    required String productId,
    TrafficSource source = TrafficSource.organic,
    String? adCampaignId,
    String? userId,
  }) async {
    await trackProductEvent(
      sellerId: sellerId,
      productId: productId,
      eventType: ProductEventType.view,
      source: source,
      adCampaignId: adCampaignId,
      userId: userId,
    );
  }

  /// Track add to cart - convenience method
  static Future<void> trackAddToCart({
    required String sellerId,
    required String productId,
    TrafficSource source = TrafficSource.organic,
    String? userId,
    int quantity = 1,
  }) async {
    await trackProductEvent(
      sellerId: sellerId,
      productId: productId,
      eventType: ProductEventType.cartAdd,
      source: source,
      userId: userId,
      quantity: quantity,
    );
  }

  /// Track order placed - convenience method
  static Future<void> trackOrder({
    required String sellerId,
    required String productId,
    TrafficSource source = TrafficSource.organic,
    String? adCampaignId,
    String? userId,
    int quantity = 1,
    required double revenue,
  }) async {
    await trackProductEvent(
      sellerId: sellerId,
      productId: productId,
      eventType: ProductEventType.order,
      source: source,
      adCampaignId: adCampaignId,
      userId: userId,
      quantity: quantity,
      revenue: revenue,
    );
  }

  /// Track ad impression
  static Future<void> trackAdImpression({
    required String sellerId,
    required String productId,
    required String adCampaignId,
  }) async {
    try {
      final now = DateTime.now();
      final docId = '${sellerId}_${_formatDate(now)}_${now.hour}';
      
      await _hourlyCollection.doc(docId).set({
        'sellerId': sellerId,
        'date': _formatDate(now),
        'hour': now.hour,
        'adImpressions': FieldValue.increment(1),
      }, SetOptions(merge: true));
      
      // Also update campaign stats
      await _firestore
          .collection('ad_campaigns')
          .doc(adCampaignId)
          .update({
        'impressions': FieldValue.increment(1),
        'lastImpression': Timestamp.now(),
      });
      
      print('📊 SellerAnalytics: Ad impression for product $productId');
    } catch (e) {
      print('❌ SellerAnalytics Error (ad impression): $e');
    }
  }

  /// Track ad click
  static Future<void> trackAdClick({
    required String sellerId,
    required String productId,
    required String adCampaignId,
  }) async {
    try {
      final now = DateTime.now();
      final docId = '${sellerId}_${_formatDate(now)}_${now.hour}';
      
      await _hourlyCollection.doc(docId).set({
        'sellerId': sellerId,
        'date': _formatDate(now),
        'hour': now.hour,
        'adClicks': FieldValue.increment(1),
      }, SetOptions(merge: true));
      
      // Also update campaign stats
      await _firestore
          .collection('ad_campaigns')
          .doc(adCampaignId)
          .update({
        'clicks': FieldValue.increment(1),
        'lastClick': Timestamp.now(),
      });
      
      print('📊 SellerAnalytics: Ad click for product $productId');
    } catch (e) {
      print('❌ SellerAnalytics Error (ad click): $e');
    }
  }

  /// Update real-time counters for immediate dashboard updates
  static Future<void> _updateRealtimeCounters(AnalyticsEvent event) async {
    final now = event.timestamp;
    final docId = '${event.sellerId}_${_formatDate(now)}_${now.hour}';
    
    // Determine which counter to increment
    Map<String, dynamic> updates = {
      'sellerId': event.sellerId,
      'date': _formatDate(now),
      'hour': now.hour,
    };
    
    switch (event.eventType) {
      case ProductEventType.view:
        updates['views'] = FieldValue.increment(1);
        break;
      case ProductEventType.click:
        updates['clicks'] = FieldValue.increment(1);
        break;
      case ProductEventType.cartAdd:
        updates['cartAdds'] = FieldValue.increment(1);
        break;
      case ProductEventType.order:
        updates['orders'] = FieldValue.increment(1);
        updates['revenue'] = FieldValue.increment(event.revenue ?? 0);
        if (event.source == TrafficSource.ads) {
          updates['adOrders'] = FieldValue.increment(1);
        }
        break;
      default:
        break;
    }
    
    await _hourlyCollection.doc(docId).set(updates, SetOptions(merge: true));
    
    // Also update daily counters
    final dailyDocId = '${event.sellerId}_${_formatDate(now)}';
    Map<String, dynamic> dailyUpdates = {
      'sellerId': event.sellerId,
      'date': _formatDate(now),
      'dayOfWeek': now.weekday,
    };
    
    switch (event.eventType) {
      case ProductEventType.view:
        dailyUpdates['totalViews'] = FieldValue.increment(1);
        dailyUpdates['sourceBreakdown.${AnalyticsEvent.sourceToString(event.source)}'] = 
            FieldValue.increment(1);
        break;
      case ProductEventType.order:
        dailyUpdates['totalOrders'] = FieldValue.increment(1);
        dailyUpdates['totalRevenue'] = FieldValue.increment(event.revenue ?? 0);
        break;
      default:
        break;
    }
    
    await _dailyCollection.doc(dailyDocId).set(dailyUpdates, SetOptions(merge: true));
  }

  /// Get hourly analytics for a seller
  static Future<List<HourlyAnalytics>> getHourlyAnalytics({
    required String sellerId,
    required int days,
  }) async {
    final startDate = DateTime.now().subtract(Duration(days: days));
    final startDateStr = _formatDate(startDate);
    
    final query = await _hourlyCollection
        .where('sellerId', isEqualTo: sellerId)
        .where('date', isGreaterThanOrEqualTo: startDateStr)
        .orderBy('date')
        .orderBy('hour')
        .get();
    
    return query.docs
        .map((doc) => HourlyAnalytics.fromFirestore(doc))
        .toList();
  }

  /// Get daily analytics for a seller
  static Future<List<DailyAnalytics>> getDailyAnalytics({
    required String sellerId,
    required int days,
  }) async {
    final startDate = DateTime.now().subtract(Duration(days: days));
    final startDateStr = _formatDate(startDate);
    
    final query = await _dailyCollection
        .where('sellerId', isEqualTo: sellerId)
        .where('date', isGreaterThanOrEqualTo: startDateStr)
        .orderBy('date')
        .get();
    
    return query.docs
        .map((doc) => DailyAnalytics.fromFirestore(doc))
        .toList();
  }

  /// Format date for document IDs
  static String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
