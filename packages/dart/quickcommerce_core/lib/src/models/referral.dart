import 'json_helpers.dart';

class Referral {
  const Referral({
    required this.id,
    required this.referrerUserId,
    required this.referralCode,
    this.refereeUserId,
    this.status = 'pending',
    this.referrerRewardAmount = 50,
    this.refereeRewardAmount = 30,
    this.firstOrderId,
    this.creditedAt,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String referrerUserId;
  final String? refereeUserId;
  final String referralCode;
  final String status;
  final double referrerRewardAmount;
  final double refereeRewardAmount;
  final String? firstOrderId;
  final DateTime? creditedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory Referral.fromJson(Map<String, dynamic> json) {
    return Referral(
      id: json['id']?.toString() ?? '',
      referrerUserId: json['referrer_user_id']?.toString() ??
          json['referrerUserId']?.toString() ??
          '',
      refereeUserId: json['referee_user_id']?.toString() ??
          json['refereeUserId']?.toString(),
      referralCode: json['referral_code']?.toString() ??
          json['referralCode']?.toString() ??
          '',
      status: json['status']?.toString() ?? 'pending',
      referrerRewardAmount: parseDouble(
          json['referrer_reward_amount'] ?? json['referrerRewardAmount'], 50),
      refereeRewardAmount: parseDouble(
          json['referee_reward_amount'] ?? json['refereeRewardAmount'], 30),
      firstOrderId: json['first_order_id']?.toString() ??
          json['firstOrderId']?.toString(),
      creditedAt: parseDateTime(json['credited_at'] ?? json['creditedAt']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
      updatedAt: parseDateTime(json['updated_at'] ?? json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'referrer_user_id': referrerUserId,
      'referee_user_id': refereeUserId,
      'referral_code': referralCode,
      'status': status,
      'referrer_reward_amount': referrerRewardAmount,
      'referee_reward_amount': refereeRewardAmount,
      'first_order_id': firstOrderId,
      'credited_at': creditedAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  Referral copyWith({
    String? id,
    String? referrerUserId,
    String? refereeUserId,
    String? referralCode,
    String? status,
    double? referrerRewardAmount,
    double? refereeRewardAmount,
    String? firstOrderId,
    DateTime? creditedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Referral(
      id: id ?? this.id,
      referrerUserId: referrerUserId ?? this.referrerUserId,
      refereeUserId: refereeUserId ?? this.refereeUserId,
      referralCode: referralCode ?? this.referralCode,
      status: status ?? this.status,
      referrerRewardAmount: referrerRewardAmount ?? this.referrerRewardAmount,
      refereeRewardAmount: refereeRewardAmount ?? this.refereeRewardAmount,
      firstOrderId: firstOrderId ?? this.firstOrderId,
      creditedAt: creditedAt ?? this.creditedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is Referral &&
        other.id == id &&
        other.referrerUserId == referrerUserId &&
        other.refereeUserId == refereeUserId &&
        other.referralCode == referralCode &&
        other.status == status &&
        other.referrerRewardAmount == referrerRewardAmount &&
        other.refereeRewardAmount == refereeRewardAmount &&
        other.firstOrderId == firstOrderId &&
        other.creditedAt == creditedAt &&
        other.createdAt == createdAt &&
        other.updatedAt == updatedAt;
  }

  @override
  int get hashCode => Object.hash(
        id,
        referrerUserId,
        refereeUserId,
        referralCode,
        status,
        referrerRewardAmount,
        refereeRewardAmount,
        firstOrderId,
        creditedAt,
        createdAt,
        updatedAt,
      );

  @override
  String toString() => 'Referral(${toJson()})';
}
