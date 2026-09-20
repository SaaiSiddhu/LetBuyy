// lib/services/bonus_service.dart
// 🎁 Bonus Service for Admin-Managed Incentives

import 'package:cloud_firestore/cloud_firestore.dart';

/// Bonus Types
enum BonusType {
  festive,       // Festival bonus
  performance,   // Performance incentive
  referral,      // Referral bonus
  milestone,     // Sales milestone
  custom,        // Admin custom
}

/// Bonus Target Types
enum BonusTarget {
  all,           // All sellers
  tier,          // Tier-based (Bronze/Silver/Gold)
  category,      // Category sellers
  individual,    // Specific seller
}

/// Bonus Service
class BonusService {
  static final _firestore = FirebaseFirestore.instance;

  /// Apply bonus to seller (Admin action)
  static Future<void> applyBonus({
    required String sellerId,
    required double amount,
    required BonusType type,
    String? reason,
    String? adminId,
  }) async {
    final description = reason ?? _getBonusDescription(type);

    // Create bonus transaction
    await _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('wallet_transactions')
        .add({
      'type': 'bonus',
      'bonusType': type.name,
      'amount': amount,
      'description': description,
      'status': 'completed',
      'appliedBy': adminId,
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Update wallet balance
    await _firestore.collection('sellers').doc(sellerId).update({
      'walletBalance': FieldValue.increment(amount),
    });

    // Create notification
    await _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('notifications')
        .add({
      'title': '🎁 Bonus Received!',
      'message': '$description: +₹${amount.toStringAsFixed(0)}',
      'type': 'bonus',
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  /// Apply bonus to multiple sellers (Admin bulk action)
  static Future<int> applyBulkBonus({
    required List<String> sellerIds,
    required double amount,
    required BonusType type,
    String? reason,
    String? adminId,
  }) async {
    int count = 0;
    for (final sellerId in sellerIds) {
      await applyBonus(
        sellerId: sellerId,
        amount: amount,
        type: type,
        reason: reason,
        adminId: adminId,
      );
      count++;
    }
    return count;
  }

  /// Get bonus history for seller
  static Stream<QuerySnapshot> getBonusHistory(String sellerId) {
    return _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('wallet_transactions')
        .where('type', isEqualTo: 'bonus')
        .orderBy('createdAt', descending: true)
        .snapshots();
  }

  /// Get sellers by tier (for tier-based bonus)
  static Future<List<String>> getSellersByTier(String tier) async {
    final snap = await _firestore
        .collection('sellers')
        .where('tier', isEqualTo: tier)
        .get();
    return snap.docs.map((d) => d.id).toList();
  }

  static String _getBonusDescription(BonusType type) {
    switch (type) {
      case BonusType.festive: return 'Festive Bonus';
      case BonusType.performance: return 'Performance Incentive';
      case BonusType.referral: return 'Referral Bonus';
      case BonusType.milestone: return 'Sales Milestone Bonus';
      case BonusType.custom: return 'Bonus';
    }
  }
}
