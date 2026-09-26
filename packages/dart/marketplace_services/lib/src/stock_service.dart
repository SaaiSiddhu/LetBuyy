// packages/services/lib/src/stock_service.dart
// 📦 Stock Service - Atomic stock management operations
// Handles stock reduction on order, restoration on cancellation/RTO

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

/// Result of stock validation
class StockValidationResult {
  final bool isValid;
  final List<StockIssue> issues;

  StockValidationResult({
    required this.isValid,
    this.issues = const [],
  });

  factory StockValidationResult.valid() => StockValidationResult(isValid: true);

  factory StockValidationResult.invalid(List<StockIssue> issues) =>
      StockValidationResult(isValid: false, issues: issues);
}

/// Details of a stock issue
class StockIssue {
  final String productId;
  final String productName;
  final int requestedQuantity;
  final int availableStock;

  StockIssue({
    required this.productId,
    required this.productName,
    required this.requestedQuantity,
    required this.availableStock,
  });

  bool get isOutOfStock => availableStock == 0;
  bool get isInsufficientStock => availableStock < requestedQuantity && availableStock > 0;

  String get message {
    if (isOutOfStock) {
      return '$productName is out of stock';
    } else {
      return '$productName: Only $availableStock available (requested $requestedQuantity)';
    }
  }
}

/// Result of stock reduction operation
class StockReduceResult {
  final bool success;
  final String? error;
  final List<StockIssue> failedItems;

  StockReduceResult({
    required this.success,
    this.error,
    this.failedItems = const [],
  });

  factory StockReduceResult.succeeded() => StockReduceResult(success: true);

  factory StockReduceResult.failed(String error, [List<StockIssue>? items]) =>
      StockReduceResult(success: false, error: error, failedItems: items ?? []);
}

/// Service for atomic stock management operations
class StockService {
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;

  /// Validate if stock is available for all items in the cart
  /// Returns validation result with details of any issues
  Future<StockValidationResult> validateStock(List<CartItemModel> items) async {
    if (items.isEmpty) {
      return StockValidationResult.valid();
    }

    try {
      final List<StockIssue> issues = [];

      // Group items by product ID to handle multiple quantities
      final Map<String, int> requiredQuantities = {};
      final Map<String, String> productNames = {};

      for (final item in items) {
        final currentQty = requiredQuantities[item.productId] ?? 0;
        requiredQuantities[item.productId] = currentQty + item.quantity;
        productNames[item.productId] = item.productName;
      }

      // Check stock for each product
      for (final entry in requiredQuantities.entries) {
        final productId = entry.key;
        final requiredQty = entry.value;

        final doc = await _firestore.collection('products').doc(productId).get();

        if (!doc.exists) {
          issues.add(StockIssue(
            productId: productId,
            productName: productNames[productId] ?? 'Unknown Product',
            requestedQuantity: requiredQty,
            availableStock: 0,
          ));
          continue;
        }

        final data = doc.data()!;
        final availableStock = (data['stock'] as num?)?.toInt() ?? 0;

        if (availableStock < requiredQty) {
          issues.add(StockIssue(
            productId: productId,
            productName: productNames[productId] ?? data['name'] ?? 'Unknown Product',
            requestedQuantity: requiredQty,
            availableStock: availableStock,
          ));
        }
      }

      if (issues.isNotEmpty) {
        debugPrint('⚠️ Stock validation failed: ${issues.length} issues found');
        for (final issue in issues) {
          debugPrint('   - ${issue.message}');
        }
        return StockValidationResult.invalid(issues);
      }

      debugPrint('✅ Stock validation passed for ${items.length} items');
      return StockValidationResult.valid();
    } catch (e) {
      debugPrint('❌ Error validating stock: $e');
      return StockValidationResult.invalid([
        StockIssue(
          productId: 'unknown',
          productName: 'Validation Error',
          requestedQuantity: 0,
          availableStock: 0,
        ),
      ]);
    }
  }

  /// Reduce stock for all items atomically using Firestore transaction
  /// This ensures either all stock reductions succeed or none do
  Future<StockReduceResult> reduceStock(List<CartItemModel> items) async {
    if (items.isEmpty) {
      return StockReduceResult.succeeded();
    }

    try {
      debugPrint('📦 Reducing stock for ${items.length} items...');

      // Group items by product ID
      final Map<String, int> reductions = {};
      final Map<String, String> productNames = {};

      for (final item in items) {
        final currentQty = reductions[item.productId] ?? 0;
        reductions[item.productId] = currentQty + item.quantity;
        productNames[item.productId] = item.productName;
      }

      // Use Firestore transaction for atomicity
      final result = await _firestore.runTransaction<StockReduceResult>((transaction) async {
        final List<StockIssue> issues = [];

        // Phase 1: Read all products and validate stock
        final Map<String, DocumentSnapshot> productDocs = {};

        for (final productId in reductions.keys) {
          final docRef = _firestore.collection('products').doc(productId);
          final doc = await transaction.get(docRef);
          productDocs[productId] = doc;

          if (!doc.exists) {
            issues.add(StockIssue(
              productId: productId,
              productName: productNames[productId] ?? 'Unknown',
              requestedQuantity: reductions[productId]!,
              availableStock: 0,
            ));
            continue;
          }

          final data = doc.data() as Map<String, dynamic>;
          final currentStock = (data['stock'] as num?)?.toInt() ?? 0;
          final requiredQty = reductions[productId]!;

          if (currentStock < requiredQty) {
            issues.add(StockIssue(
              productId: productId,
              productName: data['name'] ?? productNames[productId] ?? 'Unknown',
              requestedQuantity: requiredQty,
              availableStock: currentStock,
            ));
          }
        }

        // If any issues, abort transaction
        if (issues.isNotEmpty) {
          return StockReduceResult.failed(
            'Insufficient stock for ${issues.length} item(s)',
            issues,
          );
        }

        // Phase 2: Write all stock reductions
        for (final entry in reductions.entries) {
          final productId = entry.key;
          final reduceBy = entry.value;
          final docRef = _firestore.collection('products').doc(productId);

          transaction.update(docRef, {
            'stock': FieldValue.increment(-reduceBy),
            'updatedAt': FieldValue.serverTimestamp(),
          });

          debugPrint('   📉 $productId: -$reduceBy');
        }

        return StockReduceResult.succeeded();
      });

      if (result.success) {
        debugPrint('✅ Stock reduced successfully for ${reductions.length} products');
      } else {
        debugPrint('❌ Stock reduction failed: ${result.error}');
      }

      return result;
    } catch (e) {
      debugPrint('❌ Error reducing stock: $e');
      return StockReduceResult.failed('Transaction failed: ${e.toString()}');
    }
  }

  /// Restore stock for all items (used when order is cancelled or RTO completed)
  Future<bool> restoreStock(List<CartItemModel> items) async {
    if (items.isEmpty) {
      return true;
    }

    try {
      debugPrint('📦 Restoring stock for ${items.length} items...');

      // Group items by product ID
      final Map<String, int> restorations = {};

      for (final item in items) {
        final currentQty = restorations[item.productId] ?? 0;
        restorations[item.productId] = currentQty + item.quantity;
      }

      // Use batch write for efficiency
      final batch = _firestore.batch();

      for (final entry in restorations.entries) {
        final productId = entry.key;
        final restoreBy = entry.value;
        final docRef = _firestore.collection('products').doc(productId);

        batch.update(docRef, {
          'stock': FieldValue.increment(restoreBy),
          'updatedAt': FieldValue.serverTimestamp(),
        });

        debugPrint('   📈 $productId: +$restoreBy');
      }

      await batch.commit();
      debugPrint('✅ Stock restored successfully for ${restorations.length} products');
      return true;
    } catch (e) {
      debugPrint('❌ Error restoring stock: $e');
      return false;
    }
  }

  /// Restore stock for a return request (after QC pass)
  Future<bool> restoreStockFromReturn({
    required String productId,
    required int quantity,
    String? productName,
  }) async {
    try {
      debugPrint('📦 Restoring stock for return: $productId x$quantity');

      await _firestore.collection('products').doc(productId).update({
        'stock': FieldValue.increment(quantity),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      debugPrint('✅ Stock restored for return: $productId +$quantity');
      return true;
    } catch (e) {
      debugPrint('❌ Error restoring stock from return: $e');
      return false;
    }
  }

  /// Get current stock for a product
  Future<int> getProductStock(String productId) async {
    try {
      final doc = await _firestore.collection('products').doc(productId).get();
      if (!doc.exists) return 0;

      final data = doc.data()!;
      return (data['stock'] as num?)?.toInt() ?? 0;
    } catch (e) {
      debugPrint('❌ Error getting product stock: $e');
      return 0;
    }
  }

  /// Get products with low stock (for seller alerts)
  Stream<List<ProductModel>> getLowStockProducts({
    required String sellerId,
    int threshold = 10,
  }) {
    return _firestore
        .collection('products')
        .where('sellerId', isEqualTo: sellerId)
        .where('stock', isLessThanOrEqualTo: threshold)
        .where('isActive', isEqualTo: true)
        .snapshots()
        .map((snapshot) {
      return snapshot.docs
          .map((doc) {
            try {
              return ProductModel.fromMap(doc.data(), doc.id);
            } catch (e) {
              return null;
            }
          })
          .whereType<ProductModel>()
          .toList();
    });
  }

  /// Update stock directly (for manual adjustments by seller)
  Future<bool> updateStock({
    required String productId,
    required int newStock,
  }) async {
    try {
      if (newStock < 0) {
        debugPrint('❌ Cannot set negative stock');
        return false;
      }

      await _firestore.collection('products').doc(productId).update({
        'stock': newStock,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      debugPrint('✅ Stock updated for $productId: $newStock');
      return true;
    } catch (e) {
      debugPrint('❌ Error updating stock: $e');
      return false;
    }
  }
}
