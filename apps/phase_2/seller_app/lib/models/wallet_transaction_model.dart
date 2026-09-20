// lib/models/wallet_transaction_model.dart
// 💰 Wallet Transaction Model for Seller Payout System

import 'package:cloud_firestore/cloud_firestore.dart';

enum TransactionType {
  orderCredit,    // Credit from delivered order
  withdrawal,     // Manual withdrawal request
  autoPayout,     // Automatic weekly payout
  refund,         // Refund adjustment
  adjustment,     // Manual adjustment by admin
  adTransfer,     // Transfer to Ad Wallet
}

enum TransactionStatus {
  pending,        // Awaiting processing
  processing,     // Being processed
  completed,      // Successfully completed
  failed,         // Failed transaction
  cancelled,      // Cancelled by user/admin
}

enum BalanceType {
  pending,        // Affects pending amount
  withdrawable,   // Affects withdrawable balance
}

class WalletTransactionModel {
  final String transactionId;
  final String sellerId;
  final String? orderId;
  final TransactionType type;
  final TransactionStatus status;
  
  // Amounts
  final double grossAmount;      // Original amount
  final double gatewayFee;       // 3% payment gateway fee
  final double platformFee;      // 1% platform fee
  final double gstOnFees;        // 18% GST on fees
  final double totalFees;        // Total deducted
  final double netAmount;        // Amount after fees
  
  final String description;
  final BalanceType balanceType;
  final double balanceBefore;    // Balance before transaction
  final double balanceAfter;     // Balance after transaction
  
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? completedAt;
  
  // Metadata
  final String? orderNumber;
  final String? productName;
  final String? bankReference;   // UTR for bank transfers
  final String? failureReason;
  final String? processedBy;     // Admin ID if manual

  const WalletTransactionModel({
    required this.transactionId,
    required this.sellerId,
    this.orderId,
    required this.type,
    required this.status,
    required this.grossAmount,
    this.gatewayFee = 0.0,
    this.platformFee = 0.0,
    this.gstOnFees = 0.0,
    this.totalFees = 0.0,
    required this.netAmount,
    required this.description,
    required this.balanceType,
    this.balanceBefore = 0.0,
    this.balanceAfter = 0.0,
    required this.createdAt,
    required this.updatedAt,
    this.completedAt,
    this.orderNumber,
    this.productName,
    this.bankReference,
    this.failureReason,
    this.processedBy,
  });

  // Calculate fees for an order amount
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
      'gatewayFee': gatewayFee,
      'platformFee': platformFee,
      'gstOnFees': gstOnFees,
      'totalFees': totalFees,
      'netAmount': netAmount,
    };
  }

  // From Firestore
  factory WalletTransactionModel.fromMap(Map<String, dynamic> map, String id) {
    // Try multiple field names for amounts (some transactions use 'amount' instead)
    final grossAmt = (map['grossAmount'] ?? map['amount'] ?? map['total'] ?? 0).toDouble();
    final netAmt = (map['netAmount'] ?? map['amount'] ?? map['total'] ?? 0).toDouble();
    
    return WalletTransactionModel(
      transactionId: id,
      sellerId: map['sellerId'] ?? '',
      orderId: map['orderId'],
      type: _parseTransactionType(map['type']),
      status: _parseTransactionStatus(map['status']),
      grossAmount: grossAmt,
      gatewayFee: (map['gatewayFee'] ?? 0).toDouble(),
      platformFee: (map['platformFee'] ?? 0).toDouble(),
      gstOnFees: (map['gstOnFees'] ?? 0).toDouble(),
      totalFees: (map['totalFees'] ?? 0).toDouble(),
      netAmount: netAmt,
      description: map['description'] ?? '',
      balanceType: map['balanceType'] == 'pending' ? BalanceType.pending : BalanceType.withdrawable,
      balanceBefore: (map['balanceBefore'] ?? 0).toDouble(),
      balanceAfter: (map['balanceAfter'] ?? 0).toDouble(),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      completedAt: (map['completedAt'] as Timestamp?)?.toDate(),
      orderNumber: map['metadata']?['orderNumber'] ?? map['orderNumber'],
      productName: map['metadata']?['productName'] ?? map['productName'],
      bankReference: map['metadata']?['bankReference'] ?? map['bankReference'],
      failureReason: map['metadata']?['failureReason'] ?? map['failureReason'],
      processedBy: map['metadata']?['processedBy'] ?? map['processedBy'],
    );
  }

  // To Firestore
  Map<String, dynamic> toMap() {
    return {
      'sellerId': sellerId,
      'orderId': orderId,
      'type': type.toString().split('.').last,
      'status': status.toString().split('.').last,
      'grossAmount': grossAmount,
      'gatewayFee': gatewayFee,
      'platformFee': platformFee,
      'gstOnFees': gstOnFees,
      'totalFees': totalFees,
      'netAmount': netAmount,
      'description': description,
      'balanceType': balanceType.toString().split('.').last,
      'balanceBefore': balanceBefore,
      'balanceAfter': balanceAfter,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': Timestamp.fromDate(updatedAt),
      'completedAt': completedAt != null ? Timestamp.fromDate(completedAt!) : null,
      'metadata': {
        'orderNumber': orderNumber,
        'productName': productName,
        'bankReference': bankReference,
        'failureReason': failureReason,
        'processedBy': processedBy,
      },
    };
  }

  // Parse helpers
  static TransactionType _parseTransactionType(String? type) {
    switch (type?.toLowerCase()) {
      case 'ordercredit':
      case 'order_credit':
        return TransactionType.orderCredit;
      case 'withdrawal':
        return TransactionType.withdrawal;
      case 'autopayout':
      case 'auto_payout':
        return TransactionType.autoPayout;
      case 'refund':
        return TransactionType.refund;
      case 'adjustment':
        return TransactionType.adjustment;
      case 'adtransfer':
      case 'ad_transfer':
        return TransactionType.adTransfer;
      default:
        return TransactionType.orderCredit;
    }
  }

  static TransactionStatus _parseTransactionStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return TransactionStatus.pending;
      case 'processing':
        return TransactionStatus.processing;
      case 'completed':
        return TransactionStatus.completed;
      case 'failed':
        return TransactionStatus.failed;
      case 'cancelled':
        return TransactionStatus.cancelled;
      default:
        return TransactionStatus.pending;
    }
  }

  // Getters
  bool get isCredit => type == TransactionType.orderCredit || type == TransactionType.refund;
  bool get isDebit => type == TransactionType.withdrawal || type == TransactionType.autoPayout || type == TransactionType.adTransfer;
  bool get isPending => status == TransactionStatus.pending;
  bool get isCompleted => status == TransactionStatus.completed;
  bool get isFailed => status == TransactionStatus.failed;

  String get typeLabel {
    switch (type) {
      case TransactionType.orderCredit:
        return 'Order Payment';
      case TransactionType.withdrawal:
        return 'Withdrawal';
      case TransactionType.autoPayout:
        return 'Auto Payout';
      case TransactionType.refund:
        return 'Refund';
      case TransactionType.adjustment:
        return 'Adjustment';
      case TransactionType.adTransfer:
        return 'Ad Wallet Transfer';
    }
  }

  String get statusLabel {
    switch (status) {
      case TransactionStatus.pending:
        return 'Pending';
      case TransactionStatus.processing:
        return 'Processing';
      case TransactionStatus.completed:
        return 'Completed';
      case TransactionStatus.failed:
        return 'Failed';
      case TransactionStatus.cancelled:
        return 'Cancelled';
    }
  }
}
