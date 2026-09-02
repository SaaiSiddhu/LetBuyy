import 'json_helpers.dart';

class WalletEntry {
  const WalletEntry({
    required this.id,
    required this.entryType,
    required this.amount,
    this.userId,
    this.orderId,
    this.balanceAfter,
    this.referenceType,
    this.referenceId,
    this.metadata = const {},
    this.createdAt,
  });

  final String id;
  final String? userId;
  final String? orderId;
  final String entryType;
  final double amount;
  final double? balanceAfter;
  final String? referenceType;
  final String? referenceId;
  final Map<String, dynamic> metadata;
  final DateTime? createdAt;

  factory WalletEntry.fromJson(Map<String, dynamic> json) {
    return WalletEntry(
      id: json['id'].toString(),
      userId: json['user_id']?.toString() ?? json['userId']?.toString(),
      orderId: json['order_id']?.toString() ?? json['orderId']?.toString(),
      entryType: json['entry_type']?.toString() ?? json['entryType']?.toString() ?? '',
      amount: parseDouble(json['amount']),
      balanceAfter: json['balance_after'] == null && json['balanceAfter'] == null
          ? null
          : parseDouble(json['balance_after'] ?? json['balanceAfter']),
      referenceType: json['reference_type']?.toString() ?? json['referenceType']?.toString(),
      referenceId: json['reference_id']?.toString() ?? json['referenceId']?.toString(),
      metadata: parseMap(json['metadata']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'order_id': orderId,
      'entry_type': entryType,
      'amount': amount,
      'balance_after': balanceAfter,
      'reference_type': referenceType,
      'reference_id': referenceId,
      'metadata': metadata,
      'created_at': createdAt?.toIso8601String(),
    };
  }

  WalletEntry copyWith({
    String? id,
    String? userId,
    String? orderId,
    String? entryType,
    double? amount,
    double? balanceAfter,
    String? referenceType,
    String? referenceId,
    Map<String, dynamic>? metadata,
    DateTime? createdAt,
  }) {
    return WalletEntry(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      orderId: orderId ?? this.orderId,
      entryType: entryType ?? this.entryType,
      amount: amount ?? this.amount,
      balanceAfter: balanceAfter ?? this.balanceAfter,
      referenceType: referenceType ?? this.referenceType,
      referenceId: referenceId ?? this.referenceId,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is WalletEntry &&
        other.id == id &&
        other.userId == userId &&
        other.orderId == orderId &&
        other.entryType == entryType &&
        other.amount == amount &&
        other.balanceAfter == balanceAfter &&
        other.referenceType == referenceType &&
        other.referenceId == referenceId &&
        mapEquals(other.metadata, metadata) &&
        other.createdAt == createdAt;
  }

  @override
  int get hashCode => Object.hash(
        id,
        userId,
        orderId,
        entryType,
        amount,
        balanceAfter,
        referenceType,
        referenceId,
        mapHash(metadata),
        createdAt,
      );

  @override
  String toString() => 'WalletEntry(${toJson()})';
}
