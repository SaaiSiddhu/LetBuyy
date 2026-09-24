// lib/models/bank_account_model.dart
// 🏦 Bank Account Model for Seller Withdrawals

import 'package:cloud_firestore/cloud_firestore.dart';

class BankAccountModel {
  final String id;
  final String sellerId;
  final String accountHolderName;
  final String accountNumber;
  final String accountNumberMasked; // ****2341
  final String ifscCode;
  final String bankName;
  final String branchName;
  final bool isPrimary;
  final bool isVerified;
  final DateTime createdAt;
  final DateTime? verifiedAt;

  const BankAccountModel({
    required this.id,
    required this.sellerId,
    required this.accountHolderName,
    required this.accountNumber,
    required this.accountNumberMasked,
    required this.ifscCode,
    required this.bankName,
    this.branchName = '',
    this.isPrimary = false,
    this.isVerified = false,
    required this.createdAt,
    this.verifiedAt,
  });

  factory BankAccountModel.fromMap(Map<String, dynamic> map, String id) {
    final accNum = map['accountNumber'] ?? '';
    return BankAccountModel(
      id: id,
      sellerId: map['sellerId'] ?? '',
      accountHolderName: map['accountHolderName'] ?? '',
      accountNumber: accNum,
      accountNumberMasked: accNum.length > 4 
          ? '****${accNum.substring(accNum.length - 4)}' 
          : accNum,
      ifscCode: map['ifscCode'] ?? '',
      bankName: map['bankName'] ?? '',
      branchName: map['branchName'] ?? '',
      isPrimary: map['isPrimary'] ?? false,
      isVerified: map['isVerified'] ?? false,
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      verifiedAt: (map['verifiedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toMap() => {
    'sellerId': sellerId,
    'accountHolderName': accountHolderName,
    'accountNumber': accountNumber,
    'ifscCode': ifscCode,
    'bankName': bankName,
    'branchName': branchName,
    'isPrimary': isPrimary,
    'isVerified': isVerified,
    'createdAt': Timestamp.fromDate(createdAt),
    'verifiedAt': verifiedAt != null ? Timestamp.fromDate(verifiedAt!) : null,
  };

  BankAccountModel copyWith({bool? isPrimary, bool? isVerified}) {
    return BankAccountModel(
      id: id,
      sellerId: sellerId,
      accountHolderName: accountHolderName,
      accountNumber: accountNumber,
      accountNumberMasked: accountNumberMasked,
      ifscCode: ifscCode,
      bankName: bankName,
      branchName: branchName,
      isPrimary: isPrimary ?? this.isPrimary,
      isVerified: isVerified ?? this.isVerified,
      createdAt: createdAt,
      verifiedAt: verifiedAt,
    );
  }
}
