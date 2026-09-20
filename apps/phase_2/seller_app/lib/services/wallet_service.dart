// lib/services/wallet_service.dart
// 💰 Wallet Service for Seller Payout System

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import '../models/wallet_transaction_model.dart';
import '../models/payout_request_model.dart';

class WalletService {
  static final WalletService _instance = WalletService._internal();
  factory WalletService() => _instance;
  WalletService._internal();

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  // ═══════════════════════════════════════════════════════════════════════
  // WALLET STATS
  // ═══════════════════════════════════════════════════════════════════════
  
  Future<Map<String, dynamic>> getWalletStats(String sellerId) async {
    try {
      final callable = _functions.httpsCallable('getSellerWalletStats');
      final result = await callable.call({'sellerId': sellerId});
      
      final data = result.data;
      if (data['success'] == true && data['stats'] != null) {
        // Convert the response to proper Map<String, dynamic>
        final stats = Map<String, dynamic>.from(data['stats'] as Map);
        return _normalizeStats(stats);
      }
      
      throw Exception(data['message'] ?? 'Failed to get wallet stats');
    } catch (e) {
      debugPrint('❌ getWalletStats error: $e');
      
      // Fallback to direct Firestore read
      final doc = await _firestore.collection('sellers').doc(sellerId).get();
      if (!doc.exists) throw Exception('Seller not found');
      
      final data = doc.data()!;
      return _normalizeStats(data);
    }
  }

  // Helper to ensure all numeric values are doubles
  Map<String, dynamic> _normalizeStats(Map<String, dynamic> data) {
    final weeklyWithdrawn = _toDouble(data['weeklyWithdrawn']);
    return {
      'walletBalance': _toDouble(data['walletBalance']),
      'pendingAmount': _toDouble(data['pendingAmount']),
      'inTransitAmount': _toDouble(data['inTransitAmount']),
      'lifetimeEarnings': _toDouble(data['lifetimeEarnings']),
      'lifetimeFees': _toDouble(data['lifetimeFees']),
      'netLifetimeEarnings': _toDouble(data['netLifetimeEarnings']),
      'weeklyWithdrawn': weeklyWithdrawn,
      'weeklyRemaining': 2000.0 - weeklyWithdrawn,
      'totalWithdrawn': _toDouble(data['totalWithdrawn']),
      'payoutEnabled': data['payoutEnabled'] ?? true,
      'minWithdrawal': 500.0,
      'weeklyLimit': 2000.0,
    };
  }

  double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WITHDRAWAL
  // ═══════════════════════════════════════════════════════════════════════
  
  Future<Map<String, dynamic>> requestWithdrawal({
    required String sellerId,
    required double amount,
  }) async {
    try {
      // Validate locally first
      if (amount < 500) {
        throw Exception('Minimum withdrawal amount is ₹500');
      }
      
      final callable = _functions.httpsCallable('requestWithdrawal');
      final result = await callable.call({
        'sellerId': sellerId,
        'amount': amount,
      });
      
      if (result.data['success'] == true) {
        return {
          'success': true,
          'payoutRequestId': result.data['payoutRequestId'],
          'transactionId': result.data['transactionId'],
          'amount': result.data['amount'],
          'message': result.data['message'],
        };
      }
      
      throw Exception(result.data['message'] ?? 'Withdrawal request failed');
    } catch (e) {
      debugPrint('❌ requestWithdrawal error: $e');
      rethrow;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSACTION HISTORY
  // ═══════════════════════════════════════════════════════════════════════
  
  Stream<List<WalletTransactionModel>> getTransactionHistory({
    required String sellerId,
    String? filterType,
    int limit = 20,
  }) {
    Query<Map<String, dynamic>> query = _firestore
        .collection('wallet_transactions')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .limit(limit);
    
    if (filterType != null && filterType.isNotEmpty) {
      query = query.where('type', isEqualTo: filterType);
    }
    
    return query.snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        return WalletTransactionModel.fromMap(
          doc.data(),
          doc.id,
        );
      }).toList();
    });
  }

  Future<List<WalletTransactionModel>> getTransactionHistoryOnce({
    required String sellerId,
    String? filterType,
    int limit = 50,
  }) async {
    Query<Map<String, dynamic>> query = _firestore
        .collection('wallet_transactions')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .limit(limit);
    
    if (filterType != null && filterType.isNotEmpty) {
      query = query.where('type', isEqualTo: filterType);
    }
    
    final snapshot = await query.get();
    return snapshot.docs.map((doc) {
      return WalletTransactionModel.fromMap(doc.data(), doc.id);
    }).toList();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYOUT REQUESTS
  // ═══════════════════════════════════════════════════════════════════════
  
  Stream<List<PayoutRequestModel>> getPayoutRequests({
    required String sellerId,
    String? status,
    int limit = 20,
  }) {
    Query<Map<String, dynamic>> query = _firestore
        .collection('payout_requests')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .limit(limit);
    
    if (status != null && status.isNotEmpty) {
      query = query.where('status', isEqualTo: status);
    }
    
    return query.snapshots().map((snapshot) {
      return snapshot.docs.map((doc) {
        return PayoutRequestModel.fromMap(doc.data(), doc.id);
      }).toList();
    });
  }

  Future<List<PayoutRequestModel>> getPayoutRequestsOnce({
    required String sellerId,
    String? status,
    int limit = 20,
  }) async {
    Query<Map<String, dynamic>> query = _firestore
        .collection('payout_requests')
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('createdAt', descending: true)
        .limit(limit);
    
    if (status != null && status.isNotEmpty) {
      query = query.where('status', isEqualTo: status);
    }
    
    final snapshot = await query.get();
    return snapshot.docs.map((doc) {
      return PayoutRequestModel.fromMap(doc.data(), doc.id);
    }).toList();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FEE CALCULATION (Local)
  // ═══════════════════════════════════════════════════════════════════════
  
  static Map<String, double> calculateFees(double grossAmount) {
    const gatewayRate = 0.03;  // 3%
    const platformRate = 0.01; // 1%
    const gstRate = 0.18;      // 18%
    
    final gatewayFee = grossAmount * gatewayRate;
    final platformFee = grossAmount * platformRate;
    final gstOnFees = (gatewayFee + platformFee) * gstRate;
    final totalFees = gatewayFee + platformFee + gstOnFees;
    final netAmount = grossAmount - totalFees;
    
    return {
      'gatewayFee': double.parse(gatewayFee.toStringAsFixed(2)),
      'platformFee': double.parse(platformFee.toStringAsFixed(2)),
      'gstOnFees': double.parse(gstOnFees.toStringAsFixed(2)),
      'totalFees': double.parse(totalFees.toStringAsFixed(2)),
      'netAmount': double.parse(netAmount.toStringAsFixed(2)),
    };
  }

  static double calculateNetAmount(double grossAmount) {
    final fees = calculateFees(grossAmount);
    return fees['netAmount'] ?? grossAmount;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // WEEKLY STATS
  // ═══════════════════════════════════════════════════════════════════════
  
  Future<Map<String, dynamic>> getWeeklyStats(String sellerId) async {
    final now = DateTime.now();
    // Get Monday of this week
    final monday = now.subtract(Duration(days: now.weekday - 1));
    final weekStart = DateTime(monday.year, monday.month, monday.day);
    
    // Query transactions from this week
    final snapshot = await _firestore
        .collection('wallet_transactions')
        .where('sellerId', isEqualTo: sellerId)
        .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(weekStart))
        .where('type', isEqualTo: 'order_credit')
        .get();
    
    double weeklyEarnings = 0;
    int ordersCompleted = 0;
    
    for (final doc in snapshot.docs) {
      weeklyEarnings += (doc.data()['netAmount'] ?? 0).toDouble();
      ordersCompleted++;
    }
    
    return {
      'weeklyEarnings': weeklyEarnings,
      'ordersCompleted': ordersCompleted,
      'weekStart': weekStart,
      'weekEnd': weekStart.add(const Duration(days: 7)),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NEXT PAYOUT INFO
  // ═══════════════════════════════════════════════════════════════════════
  
  DateTime getNextPayoutDate() {
    final now = DateTime.now();
    int daysUntilMonday = (DateTime.monday - now.weekday) % 7;
    
    if (daysUntilMonday == 0) {
      // If today is Monday and before 6 AM, payout is today
      if (now.hour < 6) {
        return DateTime(now.year, now.month, now.day, 6);
      }
      // Otherwise next Monday
      daysUntilMonday = 7;
    }
    
    final nextMonday = now.add(Duration(days: daysUntilMonday));
    return DateTime(nextMonday.year, nextMonday.month, nextMonday.day, 6);
  }

  Duration getTimeUntilNextPayout() {
    return getNextPayoutDate().difference(DateTime.now());
  }

  String getNextPayoutLabel() {
    final duration = getTimeUntilNextPayout();
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else {
      return '${duration.inMinutes}m';
    }
  }
}
