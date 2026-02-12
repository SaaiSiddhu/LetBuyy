// lib/src/product_stats_service.dart
// Service to aggregate product statistics from orders

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

/// Product statistics aggregated from orders
class ProductStats {
  final int totalOrders;
  final double totalRevenue;
  final int viewCount;

  ProductStats({
    this.totalOrders = 0,
    this.totalRevenue = 0.0,
    this.viewCount = 0,
  });

  @override
  String toString() => 'ProductStats(orders: $totalOrders, revenue: $totalRevenue, views: $viewCount)';
}

/// Service to calculate and update product statistics from orders
class ProductStatsService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  /// Default commission rate (can be fetched from seller profile)
  static const double defaultCommissionRate = 0.10; // 10%

  /// Calculate stats for a single product from all orders
  static Future<ProductStats> calculateStatsForProduct(String productId) async {
    try {
      int totalOrders = 0;
      double totalRevenue = 0.0;

      // Query all orders (we'll filter items client-side since Firestore 
      // doesn't support querying nested array elements directly)
      final ordersSnap = await _firestore
          .collection('orders')
          .where('orderStatus', whereIn: ['delivered', 'completed', 'shipped', 'confirmed', 'processing'])
          .get();

      for (final doc in ordersSnap.docs) {
        final items = doc.data()['items'] as List<dynamic>? ?? [];
        
        for (final item in items) {
          if (item['productId'] == productId) {
            final quantity = (item['quantity'] as num?)?.toInt() ?? 0;
            final price = (item['price'] as num?)?.toDouble() ?? 0.0;
            
            totalOrders += quantity;
            // Revenue = price × quantity × (1 - commission)
            totalRevenue += price * quantity * (1 - defaultCommissionRate);
          }
        }
      }

      debugPrint('📊 Stats for $productId: orders=$totalOrders, revenue=$totalRevenue');
      
      return ProductStats(
        totalOrders: totalOrders,
        totalRevenue: totalRevenue,
      );
    } catch (e) {
      debugPrint('❌ Error calculating stats for $productId: $e');
      return ProductStats();
    }
  }

  /// Calculate stats for ALL products of a seller and update Firestore
  static Future<void> updateStatsForSeller(String sellerId) async {
    try {
      debugPrint('🔄 Updating stats for seller: $sellerId');

      // Get all products for this seller
      final productsSnap = await _firestore
          .collection('products')
          .where('sellerId', isEqualTo: sellerId)
          .get();

      // Get all orders for this seller (for efficiency)
      final ordersSnap = await _firestore
          .collection('orders')
          .where('sellerId', isEqualTo: sellerId)
          .get();

      // Build a map of productId -> stats
      final Map<String, ProductStats> statsMap = {};

      for (final orderDoc in ordersSnap.docs) {
        final orderData = orderDoc.data();
        final orderStatus = orderData['orderStatus'] as String? ?? '';
        
        // Skip cancelled/refunded orders
        if (orderStatus == 'cancelled' || orderStatus == 'refunded') continue;

        final items = orderData['items'] as List<dynamic>? ?? [];
        
        for (final item in items) {
          final productId = item['productId'] as String? ?? '';
          if (productId.isEmpty) continue;

          final quantity = (item['quantity'] as num?)?.toInt() ?? 0;
          final price = (item['price'] as num?)?.toDouble() ?? 0.0;
          final revenue = price * quantity * (1 - defaultCommissionRate);

          if (statsMap.containsKey(productId)) {
            statsMap[productId] = ProductStats(
              totalOrders: statsMap[productId]!.totalOrders + quantity,
              totalRevenue: statsMap[productId]!.totalRevenue + revenue,
            );
          } else {
            statsMap[productId] = ProductStats(
              totalOrders: quantity,
              totalRevenue: revenue,
            );
          }
        }
      }

      // Update each product with its stats
      final batch = _firestore.batch();
      
      for (final productDoc in productsSnap.docs) {
        final productId = productDoc.id;
        final stats = statsMap[productId] ?? ProductStats();
        
        batch.update(productDoc.reference, {
          'totalOrders': stats.totalOrders,
          'totalRevenue': stats.totalRevenue,
        });
        
        debugPrint('  📦 $productId: orders=${stats.totalOrders}, revenue=₹${stats.totalRevenue.toStringAsFixed(0)}');
      }

      await batch.commit();
      debugPrint('✅ Stats updated for ${productsSnap.docs.length} products');
    } catch (e) {
      debugPrint('❌ Error updating seller stats: $e');
      rethrow;
    }
  }

  /// One-time migration: Update stats for ALL products in database
  static Future<void> migrateAllProductStats() async {
    try {
      debugPrint('🔄 Starting full stats migration...');

      // Get all orders
      final ordersSnap = await _firestore.collection('orders').get();
      
      // Build stats map
      final Map<String, ProductStats> statsMap = {};

      for (final orderDoc in ordersSnap.docs) {
        final orderData = orderDoc.data();
        final orderStatus = orderData['orderStatus'] as String? ?? '';
        
        // Skip cancelled/refunded orders
        if (orderStatus == 'cancelled' || orderStatus == 'refunded') continue;

        final items = orderData['items'] as List<dynamic>? ?? [];
        
        for (final item in items) {
          final productId = item['productId'] as String? ?? '';
          if (productId.isEmpty) continue;

          final quantity = (item['quantity'] as num?)?.toInt() ?? 0;
          final price = (item['price'] as num?)?.toDouble() ?? 0.0;
          final revenue = price * quantity * (1 - defaultCommissionRate);

          if (statsMap.containsKey(productId)) {
            statsMap[productId] = ProductStats(
              totalOrders: statsMap[productId]!.totalOrders + quantity,
              totalRevenue: statsMap[productId]!.totalRevenue + revenue,
            );
          } else {
            statsMap[productId] = ProductStats(
              totalOrders: quantity,
              totalRevenue: revenue,
            );
          }
        }
      }

      debugPrint('📊 Found stats for ${statsMap.length} products from ${ordersSnap.docs.length} orders');

      // Update products in batches of 500 (Firestore limit)
      final productIds = statsMap.keys.toList();
      
      for (var i = 0; i < productIds.length; i += 500) {
        final batch = _firestore.batch();
        final end = (i + 500 < productIds.length) ? i + 500 : productIds.length;
        
        for (var j = i; j < end; j++) {
          final productId = productIds[j];
          final stats = statsMap[productId]!;
          
          batch.update(_firestore.collection('products').doc(productId), {
            'totalOrders': stats.totalOrders,
            'totalRevenue': stats.totalRevenue,
          });
        }
        
        await batch.commit();
        debugPrint('  ✅ Updated products ${i + 1} to $end');
      }

      debugPrint('✅ Migration complete!');
    } catch (e) {
      debugPrint('❌ Migration error: $e');
      rethrow;
    }
  }
}
