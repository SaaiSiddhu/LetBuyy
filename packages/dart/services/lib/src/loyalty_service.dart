// Loyalty Points Service
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Service for managing loyalty points, tiers, and transactions
class LoyaltyService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Collection references
  CollectionReference get _loyaltyRef => _firestore.collection('loyalty');
  
  CollectionReference _transactionsRef(String userId) =>
      _loyaltyRef.doc(userId).collection('transactions');

  // ============================================================
  // LOYALTY DATA ACCESS
  // ============================================================

  /// Get user's loyalty data (creates if not exist)
  Future<LoyaltyModel> getOrCreateLoyalty(String userId) async {
    final doc = await _loyaltyRef.doc(userId).get();
    
    if (doc.exists) {
      return LoyaltyModel.fromFirestore(doc);
    }
    
    // Create initial loyalty record for new user
    final initial = LoyaltyModel.initial(userId);
    await _loyaltyRef.doc(userId).set(initial.toMap());
    return initial;
  }

  /// Stream user's loyalty data
  Stream<LoyaltyModel> getLoyaltyStream(String userId) {
    return _loyaltyRef.doc(userId).snapshots().map((doc) {
      if (!doc.exists) {
        return LoyaltyModel.initial(userId);
      }
      return LoyaltyModel.fromFirestore(doc);
    });
  }

  /// Get transaction history
  Stream<List<LoyaltyTransaction>> getTransactionHistory(String userId, {int limit = 50}) {
    return _transactionsRef(userId)
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .snapshots()
        .map((snap) => snap.docs
            .map((doc) => LoyaltyTransaction.fromFirestore(doc))
            .toList());
  }

  // ============================================================
  // TIER CALCULATION
  // ============================================================

  /// Calculate the appropriate tier based on order history
  Future<LoyaltyTier> calculateUserTier(String userId) async {
    final now = DateTime.now();
    
    // Get orders from Firestore with different time windows
    final orders3Months = await _getOrdersInPeriod(userId, now.subtract(const Duration(days: 90)));
    final orders6Months = await _getOrdersInPeriod(userId, now.subtract(const Duration(days: 180)));
    final ordersYear = await _getOrdersInPeriod(userId, DateTime(now.year, 1, 1));

    // Calculate totals for each period
    final spend3Months = _calculateTotalSpend(orders3Months);
    final spend6Months = _calculateTotalSpend(orders6Months);
    final spendYear = _calculateTotalSpend(ordersYear);
    
    final orderCount6Months = orders6Months.length;
    final orderCountYear = ordersYear.length;

    // Check tiers from highest to lowest
    // Using SPEND-BASED thresholds (simplified for better UX)
    
    // Diamond: >₹75,000 in 3 months OR >₹1,00,000 in 6 months
    if (spend3Months >= 75000 || spend6Months >= 100000) {
      return LoyaltyTier.diamond;
    }

    // Platinum: ₹35,000-75,000 in 6 months OR ≥30 orders
    if (spend6Months >= 35000 || orderCount6Months >= 30) {
      return LoyaltyTier.platinum;
    }

    // Gold: ₹15,000-35,000 in 6 months OR ≥20 orders
    if (spend6Months >= 15000 || orderCount6Months >= 20) {
      return LoyaltyTier.gold;
    }

    // Silver: ₹5,000-15,000 in 6 months OR ≥10 orders
    if (spend6Months >= 5000 || orderCount6Months >= 10) {
      return LoyaltyTier.silver;
    }

    // Bronze: Default (under ₹5,000 in 6 months AND <10 orders)
    return LoyaltyTier.bronze;
  }

  Future<List<Map<String, dynamic>>> _getOrdersInPeriod(String userId, DateTime since) async {
    final snap = await _firestore
        .collection('orders')
        .where('userId', isEqualTo: userId)
        .where('orderStatus', isEqualTo: 'delivered')
        .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(since))
        .get();
    
    return snap.docs.map((d) => d.data()).toList();
  }

  double _calculateTotalSpend(List<Map<String, dynamic>> orders) {
    return orders.fold(0.0, (sum, order) => sum + ((order['total'] as num?)?.toDouble() ?? 0));
  }

  // ============================================================
  // POINTS MANAGEMENT
  // ============================================================

  /// Award points when order is delivered
  Future<void> awardPointsForOrder({
    required String userId,
    required String orderId,
    required double orderTotal,
  }) async {
    try {
      // Get current loyalty data
      final loyalty = await getOrCreateLoyalty(userId);
      
      // Check if points already awarded for this order
      final existingTx = await _transactionsRef(userId)
          .where('orderId', isEqualTo: orderId)
          .where('type', isEqualTo: 'earned')
          .limit(1)
          .get();
      
      if (existingTx.docs.isNotEmpty) {
        debugPrint('⚠️ Points already awarded for order $orderId');
        return;
      }

      // Use the stored tier from loyalty document to get cashback percentage
      // (We don't recalculate tier here because this may be called by seller 
      // who doesn't have permission to query buyer's orders)
      final tier = loyalty.currentTier;
      final cashbackPercent = tier.cashbackPercentage;
      final pointsEarned = (orderTotal * cashbackPercent / 100).round();

      if (pointsEarned <= 0) return;

      final newBalance = loyalty.points + pointsEarned;
      final now = DateTime.now();

      // Update loyalty balance and stats
      await _loyaltyRef.doc(userId).update({
        'points': newBalance,
        'totalOrderCount': FieldValue.increment(1),
        'totalSpentAmount': FieldValue.increment(orderTotal),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Record transaction
      await _transactionsRef(userId).add({
        'userId': userId,
        'type': 'earned',
        'points': pointsEarned,
        'balanceAfter': newBalance,
        'orderId': orderId,
        'description': '${cashbackPercent.toStringAsFixed(1)}% cashback on order',
        'createdAt': Timestamp.fromDate(now),
      });

      debugPrint('✅ Awarded $pointsEarned points to $userId for order $orderId');
      
      // Check for tier upgrade after awarding points
      await _checkAndUpgradeTier(userId);
    } catch (e) {
      debugPrint('❌ Error awarding loyalty points: $e');
    }
  }
  
  /// Check if user qualifies for higher tier and upgrade if so
  /// Note: This may fail if called from seller context (can't query buyer's orders)
  /// In that case, tier upgrade will happen when buyer opens their Marketplace app
  Future<void> _checkAndUpgradeTier(String userId) async {
    try {
      final loyalty = await getOrCreateLoyalty(userId);
      
      // Try to calculate new tier - may fail due to permission if called by seller
      LoyaltyTier newTier;
      try {
        newTier = await calculateUserTier(userId);
      } catch (e) {
        // Seller can't query buyer's orders - skip tier upgrade
        // Tier will be recalculated when buyer opens their app
        debugPrint('⚠️ Skipping tier calculation (likely called from seller context): $e');
        return;
      }
      
      // Only upgrade, never downgrade during period (downgrade happens at period reset)
      if (newTier.index > loyalty.currentTier.index) {
        await _loyaltyRef.doc(userId).update({
          'currentTier': newTier.name,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        debugPrint('🎉 Upgraded $userId from ${loyalty.currentTier.displayName} to ${newTier.displayName}!');
      }
    } catch (e) {
      debugPrint('❌ Error checking tier upgrade: $e');
    }
  }

  /// Redeem points at checkout
  /// Returns true if successful, false otherwise
  Future<bool> redeemPoints({
    required String userId,
    required int pointsToRedeem,
    required String orderId,
  }) async {
    try {
      if (pointsToRedeem <= 0) return false;

      final loyalty = await getOrCreateLoyalty(userId);
      
      if (loyalty.points < pointsToRedeem) {
        debugPrint('❌ Insufficient points: has ${loyalty.points}, wants $pointsToRedeem');
        return false;
      }

      final newBalance = loyalty.points - pointsToRedeem;
      final now = DateTime.now();

      // Deduct points
      await _loyaltyRef.doc(userId).update({
        'points': newBalance,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Record transaction
      await _transactionsRef(userId).add({
        'userId': userId,
        'type': 'redeemed',
        'points': -pointsToRedeem,
        'balanceAfter': newBalance,
        'orderId': orderId,
        'description': 'Redeemed ₹$pointsToRedeem at checkout',
        'createdAt': Timestamp.fromDate(now),
      });

      debugPrint('✅ Redeemed $pointsToRedeem points for order $orderId');
      return true;
    } catch (e) {
      debugPrint('❌ Error redeeming points: $e');
      return false;
    }
  }

  /// Refund points when order is cancelled/returned
  Future<void> refundPoints({
    required String userId,
    required String orderId,
    required int pointsToRefund,
  }) async {
    try {
      if (pointsToRefund <= 0) return;

      final loyalty = await getOrCreateLoyalty(userId);
      final newBalance = loyalty.points + pointsToRefund;

      await _loyaltyRef.doc(userId).update({
        'points': newBalance,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      await _transactionsRef(userId).add({
        'userId': userId,
        'type': 'refund',
        'points': pointsToRefund,
        'balanceAfter': newBalance,
        'orderId': orderId,
        'description': 'Refund for cancelled/returned order',
        'createdAt': Timestamp.fromDate(DateTime.now()),
      });

      debugPrint('✅ Refunded $pointsToRefund points for order $orderId');
    } catch (e) {
      debugPrint('❌ Error refunding points: $e');
    }
  }

  // ============================================================
  // TIER RESET (called periodically or on app open)
  // ============================================================

  /// Check if tier period has expired and reset if needed
  Future<void> checkAndResetTierIfNeeded(String userId) async {
    try {
      final loyalty = await getOrCreateLoyalty(userId);
      final now = DateTime.now();

      if (now.isAfter(loyalty.tierExpiresAt)) {
        // Recalculate tier
        final newTier = await calculateUserTier(userId);
        
        // Reset period stats but keep points
        final yearStart = DateTime(now.year, 1, 1);
        final yearEnd = DateTime(now.year, 12, 31);

        await _loyaltyRef.doc(userId).update({
          'currentTier': newTier.name,
          'totalOrderCount': 0,
          'totalSpentAmount': 0.0,
          'periodStartDate': Timestamp.fromDate(yearStart),
          'tierExpiresAt': Timestamp.fromDate(yearEnd),
          'updatedAt': FieldValue.serverTimestamp(),
        });

        debugPrint('🔄 Reset loyalty tier for $userId to ${newTier.displayName}');
      }
    } catch (e) {
      debugPrint('❌ Error checking tier reset: $e');
    }
  }
}
