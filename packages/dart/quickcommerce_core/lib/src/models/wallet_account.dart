import 'json_helpers.dart';

class WalletAccount {
  const WalletAccount({
    required this.userId,
    this.balance = 0,
    this.lockedBalance = 0,
    this.updatedAt,
    this.version = 1,
  });

  final String userId;
  final double balance;
  final double lockedBalance;
  final DateTime? updatedAt;
  final int version;

  factory WalletAccount.fromJson(Map<String, dynamic> json) {
    return WalletAccount(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      balance: parseDouble(json['balance']),
      lockedBalance: parseDouble(json['locked_balance'] ?? json['lockedBalance']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
      version: parseInt(json['version'], 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'balance': balance,
      'locked_balance': lockedBalance,
      'updated_at': updatedAt?.toIso8601String(),
      'version': version,
    };
  }

  WalletAccount copyWith({
    String? userId,
    double? balance,
    double? lockedBalance,
    DateTime? updatedAt,
    int? version,
  }) {
    return WalletAccount(
      userId: userId ?? this.userId,
      balance: balance ?? this.balance,
      lockedBalance: lockedBalance ?? this.lockedBalance,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is WalletAccount &&
        other.userId == userId &&
        other.balance == balance &&
        other.lockedBalance == lockedBalance &&
        other.updatedAt == updatedAt &&
        other.version == version;
  }

  @override
  int get hashCode => Object.hash(userId, balance, lockedBalance, updatedAt, version);

  @override
  String toString() => 'WalletAccount(${toJson()})';
}
