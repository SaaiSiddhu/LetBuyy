// Deal Service - CRUD operations for seller promotional deals
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

/// Service for managing seller promotional deals
class DealService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  static const String _collection = 'deals';

  // ============ SELLER OPERATIONS ============

  /// Create a new deal (status: pending)
  /// Returns the created deal ID
  Future<String> createDeal({
    required String sellerId,
    required String productId,
    required String title,
    String? description,
    required DealDiscountType discountType,
    required double discountValue,
    double? maxDiscountAmount,
    required double originalPrice,
    required double dealPrice,
    required DateTime startDate,
    required DateTime endDate,
    int? stockLimit,
    required String productName,
    required String productImage,
    required String sellerName,
  }) async {
    try {
      final docRef = _firestore.collection(_collection).doc();
      
      final deal = DealModel(
        id: docRef.id,
        sellerId: sellerId,
        productId: productId,
        title: title,
        description: description,
        discountType: discountType,
        discountValue: discountValue,
        maxDiscountAmount: maxDiscountAmount,
        originalPrice: originalPrice,
        dealPrice: dealPrice,
        startDate: startDate,
        endDate: endDate,
        stockLimit: stockLimit,
        stockSold: 0,
        status: DealStatus.pending,
        productName: productName,
        productImage: productImage,
        sellerName: sellerName,
        createdAt: DateTime.now(),
      );

      await docRef.set(deal.toMap());
      debugPrint('✅ Deal created: ${docRef.id}');
      return docRef.id;
    } catch (e) {
      debugPrint('❌ Error creating deal: $e');
      rethrow;
    }
  }

  /// Get all deals for a specific seller
  Stream<List<DealModel>> getSellerDeals(String sellerId) {
    return _firestore
        .collection(_collection)
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => DealModel.fromFirestore(doc))
            .toList());
  }

  /// Cancel a deal (seller can cancel their own deals)
  Future<void> cancelDeal(String dealId, String sellerId) async {
    try {
      final doc = await _firestore.collection(_collection).doc(dealId).get();
      if (!doc.exists) throw Exception('Deal not found');
      
      final deal = DealModel.fromFirestore(doc);
      if (deal.sellerId != sellerId) throw Exception('Not authorized');
      
      await _firestore.collection(_collection).doc(dealId).update({
        'status': DealStatus.cancelled.name,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Deal cancelled: $dealId');
    } catch (e) {
      debugPrint('❌ Error cancelling deal: $e');
      rethrow;
    }
  }

  // ============ ADMIN OPERATIONS ============

  /// Get all pending deals for admin review
  Stream<List<DealModel>> getPendingDeals() {
    return _firestore
        .collection(_collection)
        .where('status', isEqualTo: DealStatus.pending.name)
        .orderBy('createdAt', descending: false) // Oldest first
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => DealModel.fromFirestore(doc))
            .toList());
  }

  /// Approve a deal (admin only)
  Future<void> approveDeal(String dealId, String adminId) async {
    try {
      final now = DateTime.now();
      final doc = await _firestore.collection(_collection).doc(dealId).get();
      if (!doc.exists) throw Exception('Deal not found');
      
      final deal = DealModel.fromFirestore(doc);
      
      // Determine status based on start date
      DealStatus newStatus;
      if (now.isAfter(deal.startDate)) {
        newStatus = DealStatus.active;
      } else {
        newStatus = DealStatus.approved;
      }

      await _firestore.collection(_collection).doc(dealId).update({
        'status': newStatus.name,
        'approvedAt': FieldValue.serverTimestamp(),
        'approvedBy': adminId,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Deal approved: $dealId');
    } catch (e) {
      debugPrint('❌ Error approving deal: $e');
      rethrow;
    }
  }

  /// Reject a deal (admin only)
  Future<void> rejectDeal(String dealId, String adminId, String reason) async {
    try {
      await _firestore.collection(_collection).doc(dealId).update({
        'status': DealStatus.rejected.name,
        'rejectionReason': reason,
        'approvedBy': adminId, // Track who rejected
        'updatedAt': FieldValue.serverTimestamp(),
      });
      debugPrint('✅ Deal rejected: $dealId');
    } catch (e) {
      debugPrint('❌ Error rejecting deal: $e');
      rethrow;
    }
  }

  // ============ MARKETPLACE OPERATIONS ============

  /// Get all active deals for marketplace display
  Stream<List<DealModel>> getActiveDeals({int limit = 20}) {
    final now = Timestamp.now();
    return _firestore
        .collection(_collection)
        .where('status', isEqualTo: DealStatus.active.name)
        .where('endDate', isGreaterThan: now)
        .orderBy('endDate') // Ending soonest first
        .limit(limit)
        .snapshots()
        .map((snapshot) => snapshot.docs
            .map((doc) => DealModel.fromFirestore(doc))
            .where((deal) => deal.hasStock) // Filter out sold-out deals
            .toList());
  }

  /// Check if a product has an active deal
  Future<DealModel?> getActiveDealForProduct(String productId) async {
    try {
      final now = Timestamp.now();
      final snapshot = await _firestore
          .collection(_collection)
          .where('productId', isEqualTo: productId)
          .where('status', isEqualTo: DealStatus.active.name)
          .where('endDate', isGreaterThan: now)
          .limit(1)
          .get();

      if (snapshot.docs.isEmpty) return null;
      
      final deal = DealModel.fromFirestore(snapshot.docs.first);
      return deal.hasStock ? deal : null;
    } catch (e) {
      debugPrint('⚠️ Error checking deal for product: $e');
      return null;
    }
  }

  /// Increment stock sold when a deal item is purchased
  Future<void> incrementStockSold(String dealId, int quantity) async {
    try {
      await _firestore.collection(_collection).doc(dealId).update({
        'stockSold': FieldValue.increment(quantity),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      // Check if sold out
      final doc = await _firestore.collection(_collection).doc(dealId).get();
      final deal = DealModel.fromFirestore(doc);
      
      if (deal.stockLimit != null && deal.stockSold >= deal.stockLimit!) {
        await _firestore.collection(_collection).doc(dealId).update({
          'status': DealStatus.soldOut.name,
        });
        debugPrint('⚡ Deal sold out: $dealId');
      }
    } catch (e) {
      debugPrint('⚠️ Error incrementing stock sold: $e');
    }
  }

  /// Get a single deal by ID
  Future<DealModel?> getDeal(String dealId) async {
    try {
      final doc = await _firestore.collection(_collection).doc(dealId).get();
      if (!doc.exists) return null;
      return DealModel.fromFirestore(doc);
    } catch (e) {
      debugPrint('⚠️ Error getting deal: $e');
      return null;
    }
  }

  /// Update approved deals to active when start time is reached
  /// Call this periodically or with a cloud function
  Future<void> activateScheduledDeals() async {
    try {
      final now = Timestamp.now();
      final snapshot = await _firestore
          .collection(_collection)
          .where('status', isEqualTo: DealStatus.approved.name)
          .where('startDate', isLessThanOrEqualTo: now)
          .get();

      for (final doc in snapshot.docs) {
        await doc.reference.update({
          'status': DealStatus.active.name,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        debugPrint('⚡ Deal activated: ${doc.id}');
      }
    } catch (e) {
      debugPrint('⚠️ Error activating scheduled deals: $e');
    }
  }

  /// Mark expired deals
  Future<void> expireEndedDeals() async {
    try {
      final now = Timestamp.now();
      final snapshot = await _firestore
          .collection(_collection)
          .where('status', isEqualTo: DealStatus.active.name)
          .where('endDate', isLessThan: now)
          .get();

      for (final doc in snapshot.docs) {
        await doc.reference.update({
          'status': DealStatus.expired.name,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        debugPrint('⏰ Deal expired: ${doc.id}');
      }
    } catch (e) {
      debugPrint('⚠️ Error expiring deals: $e');
    }
  }
}
