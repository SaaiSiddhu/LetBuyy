// lib/services/penalty_service.dart
// ⚠️ Auto Penalty System for Order Violations

import 'package:cloud_firestore/cloud_firestore.dart';

/// Penalty Types
enum PenaltyType {
  lateDispatch24h,   // >24h delay
  lateDispatch48h,   // >48h delay
  cancellation,      // Seller cancellation
  rto,               // Return to Origin
  qualityIssue,      // Product quality
  custom,            // Admin manual
}

/// Penalty Configuration
class PenaltyConfig {
  static const Map<PenaltyType, Map<String, dynamic>> rules = {
    PenaltyType.lateDispatch24h: {
      'amount': 50.0,
      'isFixed': true,
      'description': 'Late Dispatch (>24h)',
    },
    PenaltyType.lateDispatch48h: {
      'amount': 150.0,
      'isFixed': true,
      'description': 'Late Dispatch (>48h)',
    },
    PenaltyType.cancellation: {
      'amount': 0.05, // 5% of order value
      'isFixed': false,
      'description': 'Seller Cancellation',
    },
    PenaltyType.rto: {
      'amount': 0.0, // Shipping cost
      'isFixed': false,
      'description': 'Return to Origin (RTO)',
    },
  };
}

/// Penalty Service
class PenaltyService {
  static final _firestore = FirebaseFirestore.instance;

  /// Apply penalty to seller wallet
  static Future<void> applyPenalty({
    required String sellerId,
    required String orderId,
    required PenaltyType type,
    required double orderValue,
    double? shippingCost,
    String? customReason,
  }) async {
    final config = PenaltyConfig.rules[type];
    if (config == null && type != PenaltyType.custom) return;

    double penaltyAmount;
    String description;

    switch (type) {
      case PenaltyType.cancellation:
        penaltyAmount = orderValue * 0.05; // 5%
        description = 'Seller Cancellation Penalty';
        break;
      case PenaltyType.rto:
        penaltyAmount = shippingCost ?? 0;
        description = 'RTO Shipping Cost';
        break;
      case PenaltyType.custom:
        penaltyAmount = orderValue;
        description = customReason ?? 'Admin Penalty';
        break;
      default:
        penaltyAmount = (config!['amount'] as num).toDouble();
        description = config['description'] as String;
    }

    if (penaltyAmount <= 0) return;

    // Create penalty transaction
    await _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('wallet_transactions')
        .add({
      'type': 'penalty',
      'penaltyType': type.name,
      'orderId': orderId,
      'amount': -penaltyAmount,
      'description': description,
      'status': 'completed',
      'createdAt': FieldValue.serverTimestamp(),
    });

    // Update wallet balance
    await _firestore.collection('sellers').doc(sellerId).update({
      'walletBalance': FieldValue.increment(-penaltyAmount),
    });

    // Create notification
    await _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('notifications')
        .add({
      'title': '⚠️ Penalty Applied',
      'message': '$description: -₹${penaltyAmount.toStringAsFixed(0)}',
      'type': 'penalty',
      'orderId': orderId,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  /// Check order for late dispatch penalty (call from order status change)
  static Future<void> checkLateDispatch({
    required String sellerId,
    required String orderId,
    required DateTime orderCreatedAt,
    required DateTime dispatchedAt,
  }) async {
    final delay = dispatchedAt.difference(orderCreatedAt);

    if (delay.inHours >= 48) {
      await applyPenalty(
        sellerId: sellerId,
        orderId: orderId,
        type: PenaltyType.lateDispatch48h,
        orderValue: 0,
      );
    } else if (delay.inHours >= 24) {
      await applyPenalty(
        sellerId: sellerId,
        orderId: orderId,
        type: PenaltyType.lateDispatch24h,
        orderValue: 0,
      );
    }
  }

  /// Get penalty history for seller
  static Stream<QuerySnapshot> getPenaltyHistory(String sellerId) {
    return _firestore
        .collection('sellers')
        .doc(sellerId)
        .collection('wallet_transactions')
        .where('type', isEqualTo: 'penalty')
        .orderBy('createdAt', descending: true)
        .snapshots();
  }
}
