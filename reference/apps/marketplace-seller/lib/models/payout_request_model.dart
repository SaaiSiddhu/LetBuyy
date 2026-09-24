// lib/models/payout_request_model.dart
// 💸 Payout Request Model for Seller Payout System

import 'package:cloud_firestore/cloud_firestore.dart';

enum PayoutType {
  manual,   // User-requested withdrawal
  auto,     // Automatic weekly payout
}

enum PayoutStatus {
  pending,      // Awaiting processing
  processing,   // Being processed
  completed,    // Successfully sent to bank
  failed,       // Bank transfer failed
  onHold,       // On hold by admin
}

enum PayoutPriority {
  normal,   // Regular processing
  high,     // Priority (manual requests)
}

class BankDetails {
  final String accountNumber;
  final String ifscCode;
  final String accountHolderName;
  final String bankName;

  const BankDetails({
    required this.accountNumber,
    required this.ifscCode,
    required this.accountHolderName,
    required this.bankName,
  });

  factory BankDetails.fromMap(Map<String, dynamic>? map) {
    if (map == null) {
      return const BankDetails(
        accountNumber: '',
        ifscCode: '',
        accountHolderName: '',
        bankName: '',
      );
    }
    return BankDetails(
      accountNumber: map['accountNumber'] ?? '',
      ifscCode: map['ifscCode'] ?? '',
      accountHolderName: map['accountHolderName'] ?? '',
      bankName: map['bankName'] ?? '',
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'accountNumber': accountNumber,
      'ifscCode': ifscCode,
      'accountHolderName': accountHolderName,
      'bankName': bankName,
    };
  }

  String get maskedAccountNumber {
    if (accountNumber.length < 4) return accountNumber;
    return 'XXXX${accountNumber.substring(accountNumber.length - 4)}';
  }

  bool get isValid {
    return accountNumber.isNotEmpty && 
           ifscCode.isNotEmpty && 
           accountHolderName.isNotEmpty &&
           bankName.isNotEmpty;
  }
}

class PayoutRequestModel {
  final String requestId;
  final String sellerId;
  final String sellerName;
  final String storeName;
  
  final PayoutType type;
  final double amount;
  final PayoutStatus status;
  final PayoutPriority priority;
  
  final BankDetails bankDetails;
  
  // Tracking
  final DateTime createdAt;
  final DateTime? scheduledFor;
  final DateTime? processedAt;
  final DateTime? completedAt;
  
  // Bank Transfer Details
  final String? utrNumber;
  final String? bankResponseCode;
  
  // Admin Actions
  final String? processedBy;
  final String? notes;
  final String? failureReason;
  final int retryCount;
  
  // Notifications
  final bool pushSent;
  final bool emailSent;
  final bool inAppSent;

  const PayoutRequestModel({
    required this.requestId,
    required this.sellerId,
    required this.sellerName,
    required this.storeName,
    required this.type,
    required this.amount,
    required this.status,
    this.priority = PayoutPriority.normal,
    required this.bankDetails,
    required this.createdAt,
    this.scheduledFor,
    this.processedAt,
    this.completedAt,
    this.utrNumber,
    this.bankResponseCode,
    this.processedBy,
    this.notes,
    this.failureReason,
    this.retryCount = 0,
    this.pushSent = false,
    this.emailSent = false,
    this.inAppSent = false,
  });

  // From Firestore
  factory PayoutRequestModel.fromMap(Map<String, dynamic> map, String id) {
    return PayoutRequestModel(
      requestId: id,
      sellerId: map['sellerId'] ?? '',
      sellerName: map['sellerName'] ?? '',
      storeName: map['storeName'] ?? '',
      type: map['type'] == 'manual' ? PayoutType.manual : PayoutType.auto,
      amount: (map['amount'] ?? 0).toDouble(),
      status: _parsePayoutStatus(map['status']),
      priority: map['priority'] == 'high' ? PayoutPriority.high : PayoutPriority.normal,
      bankDetails: BankDetails.fromMap(map['bankDetails']),
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      scheduledFor: (map['scheduledFor'] as Timestamp?)?.toDate(),
      processedAt: (map['processedAt'] as Timestamp?)?.toDate(),
      completedAt: (map['completedAt'] as Timestamp?)?.toDate(),
      utrNumber: map['utrNumber'],
      bankResponseCode: map['bankResponseCode'],
      processedBy: map['processedBy'],
      notes: map['notes'],
      failureReason: map['failureReason'],
      retryCount: map['retryCount'] ?? 0,
      pushSent: map['notificationsSent']?['push'] ?? false,
      emailSent: map['notificationsSent']?['email'] ?? false,
      inAppSent: map['notificationsSent']?['inApp'] ?? false,
    );
  }

  // To Firestore
  Map<String, dynamic> toMap() {
    return {
      'sellerId': sellerId,
      'sellerName': sellerName,
      'storeName': storeName,
      'type': type.toString().split('.').last,
      'amount': amount,
      'status': status.toString().split('.').last,
      'priority': priority.toString().split('.').last,
      'bankDetails': bankDetails.toMap(),
      'createdAt': Timestamp.fromDate(createdAt),
      'scheduledFor': scheduledFor != null ? Timestamp.fromDate(scheduledFor!) : null,
      'processedAt': processedAt != null ? Timestamp.fromDate(processedAt!) : null,
      'completedAt': completedAt != null ? Timestamp.fromDate(completedAt!) : null,
      'utrNumber': utrNumber,
      'bankResponseCode': bankResponseCode,
      'processedBy': processedBy,
      'notes': notes,
      'failureReason': failureReason,
      'retryCount': retryCount,
      'notificationsSent': {
        'push': pushSent,
        'email': emailSent,
        'inApp': inAppSent,
      },
    };
  }

  // Parse helper
  static PayoutStatus _parsePayoutStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return PayoutStatus.pending;
      case 'processing':
        return PayoutStatus.processing;
      case 'completed':
        return PayoutStatus.completed;
      case 'failed':
        return PayoutStatus.failed;
      case 'onhold':
      case 'on_hold':
        return PayoutStatus.onHold;
      default:
        return PayoutStatus.pending;
    }
  }

  // Getters
  bool get isPending => status == PayoutStatus.pending;
  bool get isProcessing => status == PayoutStatus.processing;
  bool get isCompleted => status == PayoutStatus.completed;
  bool get isFailed => status == PayoutStatus.failed;
  bool get isOnHold => status == PayoutStatus.onHold;
  bool get isManual => type == PayoutType.manual;
  bool get isAuto => type == PayoutType.auto;

  String get statusLabel {
    switch (status) {
      case PayoutStatus.pending:
        return 'Pending';
      case PayoutStatus.processing:
        return 'Processing';
      case PayoutStatus.completed:
        return 'Completed';
      case PayoutStatus.failed:
        return 'Failed';
      case PayoutStatus.onHold:
        return 'On Hold';
    }
  }

  String get typeLabel => isManual ? 'Manual Withdrawal' : 'Auto Payout';

  // Copy with
  PayoutRequestModel copyWith({
    PayoutStatus? status,
    DateTime? processedAt,
    DateTime? completedAt,
    String? utrNumber,
    String? bankResponseCode,
    String? processedBy,
    String? notes,
    String? failureReason,
    int? retryCount,
    bool? pushSent,
    bool? emailSent,
    bool? inAppSent,
  }) {
    return PayoutRequestModel(
      requestId: requestId,
      sellerId: sellerId,
      sellerName: sellerName,
      storeName: storeName,
      type: type,
      amount: amount,
      status: status ?? this.status,
      priority: priority,
      bankDetails: bankDetails,
      createdAt: createdAt,
      scheduledFor: scheduledFor,
      processedAt: processedAt ?? this.processedAt,
      completedAt: completedAt ?? this.completedAt,
      utrNumber: utrNumber ?? this.utrNumber,
      bankResponseCode: bankResponseCode ?? this.bankResponseCode,
      processedBy: processedBy ?? this.processedBy,
      notes: notes ?? this.notes,
      failureReason: failureReason ?? this.failureReason,
      retryCount: retryCount ?? this.retryCount,
      pushSent: pushSent ?? this.pushSent,
      emailSent: emailSent ?? this.emailSent,
      inAppSent: inAppSent ?? this.inAppSent,
    );
  }
}
