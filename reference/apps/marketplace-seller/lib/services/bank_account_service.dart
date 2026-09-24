// lib/services/bank_account_service.dart
// 🏦 Bank Account Service for Seller Withdrawals

import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/bank_account_model.dart';

class BankAccountService {
  static final _firestore = FirebaseFirestore.instance;
  static const _collection = 'bank_accounts';

  /// Get all bank accounts for seller
  static Stream<List<BankAccountModel>> getBankAccounts(String sellerId) {
    return _firestore
        .collection(_collection)
        .where('sellerId', isEqualTo: sellerId)
        .orderBy('isPrimary', descending: true)
        .snapshots()
        .map((snap) => snap.docs
            .map((doc) => BankAccountModel.fromMap(doc.data(), doc.id))
            .toList());
  }

  /// Get primary bank account
  static Future<BankAccountModel?> getPrimaryAccount(String sellerId) async {
    final snap = await _firestore
        .collection(_collection)
        .where('sellerId', isEqualTo: sellerId)
        .where('isPrimary', isEqualTo: true)
        .limit(1)
        .get();
    
    if (snap.docs.isEmpty) return null;
    return BankAccountModel.fromMap(snap.docs.first.data(), snap.docs.first.id);
  }

  /// Add new bank account
  static Future<String> addBankAccount({
    required String sellerId,
    required String accountHolderName,
    required String accountNumber,
    required String ifscCode,
    required String bankName,
    String branchName = '',
  }) async {
    // Check if first account (make it primary)
    final existing = await _firestore
        .collection(_collection)
        .where('sellerId', isEqualTo: sellerId)
        .limit(1)
        .get();
    
    final isPrimary = existing.docs.isEmpty;

    final doc = await _firestore.collection(_collection).add({
      'sellerId': sellerId,
      'accountHolderName': accountHolderName,
      'accountNumber': accountNumber,
      'ifscCode': ifscCode.toUpperCase(),
      'bankName': bankName,
      'branchName': branchName,
      'isPrimary': isPrimary,
      'isVerified': false,
      'createdAt': FieldValue.serverTimestamp(),
    });

    return doc.id;
  }

  /// Set as primary account
  static Future<void> setPrimaryAccount(String sellerId, String accountId) async {
    final batch = _firestore.batch();
    
    // Remove primary from all
    final existing = await _firestore
        .collection(_collection)
        .where('sellerId', isEqualTo: sellerId)
        .where('isPrimary', isEqualTo: true)
        .get();
    
    for (final doc in existing.docs) {
      batch.update(doc.reference, {'isPrimary': false});
    }
    
    // Set new primary
    batch.update(_firestore.collection(_collection).doc(accountId), {
      'isPrimary': true,
    });
    
    await batch.commit();
  }

  /// Delete bank account
  static Future<void> deleteBankAccount(String accountId) async {
    await _firestore.collection(_collection).doc(accountId).delete();
  }

  /// Verify bank account (Admin action)
  static Future<void> verifyAccount(String accountId) async {
    await _firestore.collection(_collection).doc(accountId).update({
      'isVerified': true,
      'verifiedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Lookup IFSC code (mock - use actual API in production)
  static Future<Map<String, String>?> lookupIfsc(String ifsc) async {
    // Common Indian bank IFSC prefixes
    final banks = {
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'SBIN': 'State Bank of India',
      'UTIB': 'Axis Bank',
      'KKBK': 'Kotak Mahindra Bank',
      'PUNB': 'Punjab National Bank',
      'BARB': 'Bank of Baroda',
      'IOBA': 'Indian Overseas Bank',
      'CNRB': 'Canara Bank',
      'UBIN': 'Union Bank of India',
      'IDIB': 'Indian Bank',
      'BKID': 'Bank of India',
      'CBIN': 'Central Bank of India',
      'YESB': 'Yes Bank',
      'FDRL': 'Federal Bank',
      'INDB': 'IndusInd Bank',
      'RATN': 'RBL Bank',
      'MAHB': 'Bank of Maharashtra',
    };

    if (ifsc.length < 4) return null;
    final prefix = ifsc.substring(0, 4).toUpperCase();
    final bankName = banks[prefix];
    
    if (bankName == null) return null;
    
    return {
      'bankName': bankName,
      'ifsc': ifsc.toUpperCase(),
    };
  }
}
