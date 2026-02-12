import 'package:cloud_firestore/cloud_firestore.dart';

/// Transaction type for ad wallet
enum AdWalletTransactionType {
  topUp,           // Direct payment to ads wallet
  transferIn,      // Transfer from main seller wallet
  adSpend,         // Deduction for ad click
  refund,          // Refund for invalid clicks
  adjustment,      // Admin adjustment
}

/// Ad Wallet Transaction Record
class AdWalletTransaction {
  final String id;
  final String sellerId;
  final AdWalletTransactionType type;
  final double amount;
  final double balanceBefore;
  final double balanceAfter;
  final String? description;
  final String? referenceId; // paymentId, campaignId, or clickId
  final DateTime createdAt;

  AdWalletTransaction({
    required this.id,
    required this.sellerId,
    required this.type,
    required this.amount,
    required this.balanceBefore,
    required this.balanceAfter,
    this.description,
    this.referenceId,
    required this.createdAt,
  });

  bool get isCredit => type == AdWalletTransactionType.topUp || 
                       type == AdWalletTransactionType.transferIn ||
                       type == AdWalletTransactionType.refund;

  factory AdWalletTransaction.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return AdWalletTransaction.fromMap(data, doc.id);
  }

  factory AdWalletTransaction.fromMap(Map<String, dynamic> data, String id) {
    return AdWalletTransaction(
      id: id,
      sellerId: (data['sellerId'] ?? '').toString(),
      type: _parseType(data['type']),
      amount: _parseDouble(data['amount']),
      balanceBefore: _parseDouble(data['balanceBefore']),
      balanceAfter: _parseDouble(data['balanceAfter']),
      description: data['description']?.toString(),
      referenceId: data['referenceId']?.toString(),
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'sellerId': sellerId,
      'type': type.name,
      'amount': amount,
      'balanceBefore': balanceBefore,
      'balanceAfter': balanceAfter,
      'description': description,
      'referenceId': referenceId,
      'createdAt': Timestamp.fromDate(createdAt),
    };
  }

  static AdWalletTransactionType _parseType(dynamic value) {
    if (value == null) return AdWalletTransactionType.adjustment;
    final str = value.toString().toLowerCase();
    return AdWalletTransactionType.values.firstWhere(
      (t) => t.name.toLowerCase() == str,
      orElse: () => AdWalletTransactionType.adjustment,
    );
  }

  static double _parseDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}

/// Ad Wallet Model - Separate wallet for advertising spend
class AdWalletModel {
  final String sellerId;
  final double balance;
  final double totalTopUp;
  final double totalSpent;
  final double totalTransferredIn;
  final bool lowBalanceAlert;
  final double lowBalanceThreshold;
  final DateTime? lastTopUpAt;
  final DateTime? lastSpendAt;
  final DateTime createdAt;
  final DateTime? updatedAt;

  AdWalletModel({
    required this.sellerId,
    this.balance = 0.0,
    this.totalTopUp = 0.0,
    this.totalSpent = 0.0,
    this.totalTransferredIn = 0.0,
    this.lowBalanceAlert = true,
    this.lowBalanceThreshold = 100.0,
    this.lastTopUpAt,
    this.lastSpendAt,
    required this.createdAt,
    this.updatedAt,
  });

  /// Check if balance is low
  bool get isLowBalance => balance < lowBalanceThreshold;

  /// Check if can afford a click at minimum CPC
  bool get canAffordClick => balance >= 0.5;

  factory AdWalletModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() ?? {}) as Map<String, dynamic>;
    return AdWalletModel.fromMap(data, doc.id);
  }

  factory AdWalletModel.fromMap(Map<String, dynamic> data, String sellerId) {
    return AdWalletModel(
      sellerId: sellerId,
      balance: _parseDouble(data['balance']),
      totalTopUp: _parseDouble(data['totalTopUp']),
      totalSpent: _parseDouble(data['totalSpent']),
      totalTransferredIn: _parseDouble(data['totalTransferredIn']),
      lowBalanceAlert: data['lowBalanceAlert'] as bool? ?? true,
      lowBalanceThreshold: _parseDouble(data['lowBalanceThreshold'], 100.0),
      lastTopUpAt: _parseDateTime(data['lastTopUpAt']),
      lastSpendAt: _parseDateTime(data['lastSpendAt']),
      createdAt: _parseDateTime(data['createdAt']) ?? DateTime.now(),
      updatedAt: _parseDateTime(data['updatedAt']),
    );
  }

  /// Create empty wallet for new seller
  factory AdWalletModel.empty(String sellerId) {
    return AdWalletModel(
      sellerId: sellerId,
      createdAt: DateTime.now(),
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'balance': balance,
      'totalTopUp': totalTopUp,
      'totalSpent': totalSpent,
      'totalTransferredIn': totalTransferredIn,
      'lowBalanceAlert': lowBalanceAlert,
      'lowBalanceThreshold': lowBalanceThreshold,
      'lastTopUpAt': lastTopUpAt != null ? Timestamp.fromDate(lastTopUpAt!) : null,
      'lastSpendAt': lastSpendAt != null ? Timestamp.fromDate(lastSpendAt!) : null,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  AdWalletModel copyWith({
    String? sellerId,
    double? balance,
    double? totalTopUp,
    double? totalSpent,
    double? totalTransferredIn,
    bool? lowBalanceAlert,
    double? lowBalanceThreshold,
    DateTime? lastTopUpAt,
    DateTime? lastSpendAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return AdWalletModel(
      sellerId: sellerId ?? this.sellerId,
      balance: balance ?? this.balance,
      totalTopUp: totalTopUp ?? this.totalTopUp,
      totalSpent: totalSpent ?? this.totalSpent,
      totalTransferredIn: totalTransferredIn ?? this.totalTransferredIn,
      lowBalanceAlert: lowBalanceAlert ?? this.lowBalanceAlert,
      lowBalanceThreshold: lowBalanceThreshold ?? this.lowBalanceThreshold,
      lastTopUpAt: lastTopUpAt ?? this.lastTopUpAt,
      lastSpendAt: lastSpendAt ?? this.lastSpendAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  static double _parseDouble(dynamic value, [double defaultValue = 0.0]) {
    if (value == null) return defaultValue;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    return double.tryParse(value.toString()) ?? defaultValue;
  }

  static DateTime? _parseDateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    return null;
  }
}
