// lib/services/seller_service.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'auth_service.dart';

class SellerService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final AuthService _authService = AuthService();

  CollectionReference get _sellersCollection =>
      _firestore.collection('sellers');
  CollectionReference get _usersCollection => _firestore.collection('users');
  DocumentReference _emailIndexDoc(String email) =>
      _firestore.collection('email_index').doc(email.trim().toLowerCase());

  Future<bool> checkSellerExists(String email) async {
    try {
      final doc = await _emailIndexDoc(email.trim().toLowerCase()).get();
      if (!doc.exists) return false;

      final data = doc.data() as Map<String, dynamic>?;
      final type = data?['type'];
      return type == 'seller' || type == 'both';
    } catch (error) {
      debugPrint('Error checking seller email index: $error');
      return false;
    }
  }

  Future<SellerModel> registerSeller({
    required String email,
    required String password,
    required String name,
    required String phone,
    required String businessType,
    required String businessLegalName,
    required String storeName,
    required String businessAddress,
    required String businessContact,
    required String businessCity,
    required String businessPincode,
    required String businessState,
    required String panNumber,
    required String gstNumber,
    bool gstExempt = false,
  }) async {
    throw AuthException(
      'Seller registration must use the LetBuyy identity platform and API gateway.',
    );
  }

  Future<SellerModel> signInSeller({
    required String email,
    required String password,
  }) async {
    throw AuthException(
      'Seller sign-in must use the LetBuyy identity platform lb_session flow.',
    );
  }

  Future<SellerModel> getSellerData(String sellerId) async {
    try {
      final doc = await _sellersCollection.doc(sellerId).get();
      if (doc.exists) {
        return SellerModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
      }

      final querySnapshot = await _sellersCollection
          .where('uid', isEqualTo: sellerId)
          .limit(1)
          .get();

      if (querySnapshot.docs.isNotEmpty) {
        final queryDoc = querySnapshot.docs.first;
        return SellerModel.fromMap(
          queryDoc.data() as Map<String, dynamic>,
          queryDoc.id,
        );
      }

      throw AuthException('Seller data not found');
    } catch (error) {
      debugPrint('Error getting seller data: $error');
      if (error is AuthException) rethrow;
      throw AuthException('Failed to load seller data');
    }
  }

  Future<void> updateSellerProfile({
    required String sellerId,
    String? name,
    String? phone,
    String? photoUrl,
    String? storeName,
    String? businessAddress,
    String? businessAddress2,
    String? businessLandmark,
    String? businessContact,
    String? businessCity,
    String? businessPincode,
    String? businessState,
    String? businessDistrict,
  }) async {
    try {
      final updates = <String, dynamic>{};

      if (name != null) updates['name'] = name.trim();
      if (phone != null) updates['phone'] = phone.trim();
      if (photoUrl != null) updates['photoUrl'] = photoUrl;
      if (storeName != null) updates['storeName'] = storeName.trim();
      if (businessAddress != null) {
        updates['businessAddress'] = businessAddress.trim();
      }
      if (businessAddress2 != null) {
        updates['businessAddress2'] = businessAddress2.trim();
      }
      if (businessLandmark != null) {
        updates['businessLandmark'] = businessLandmark.trim();
      }
      if (businessContact != null) {
        updates['businessContact'] = businessContact.trim();
      }
      if (businessCity != null) updates['businessCity'] = businessCity.trim();
      if (businessPincode != null) {
        updates['businessPincode'] = businessPincode.trim();
      }
      if (businessState != null) {
        updates['businessState'] = businessState.trim();
      }
      if (businessDistrict != null) {
        updates['businessDistrict'] = businessDistrict.trim();
      }

      updates['updatedAt'] = FieldValue.serverTimestamp();

      await _sellersCollection.doc(sellerId).update(updates);
    } catch (error) {
      debugPrint('Error updating seller profile: $error');
      throw AuthException('Failed to update profile');
    }
  }

  Future<void> updateBankDetails({
    required String sellerId,
    required String accountNumber,
    required String ifscCode,
    required String accountHolderName,
    required String bankName,
  }) async {
    try {
      await _sellersCollection.doc(sellerId).update({
        'bankAccountNumber': accountNumber.trim(),
        'bankIfscCode': ifscCode.trim().toUpperCase(),
        'bankAccountHolderName': accountHolderName.trim(),
        'bankName': bankName.trim(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } catch (error) {
      debugPrint('Error updating bank details: $error');
      throw AuthException('Failed to update bank details');
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    throw AuthException('Password changes must use the identity platform.');
  }

  Future<void> sendPasswordResetEmail(String email) async {
    throw AuthException('Password reset must use the identity platform.');
  }

  Future<void> signOut() => _authService.signOut();

  Future<void> deleteAccount() async {
    final user = _authService.currentUser;
    if (user == null) throw AuthException('No seller logged in');

    final uid = user.uid;
    final email = user.email.toLowerCase();

    await _usersCollection.doc(uid).delete();
    await _sellersCollection.doc(uid).delete();

    try {
      final docRef = _emailIndexDoc(email);
      final snap = await docRef.get();
      if (snap.exists) {
        final snapData = snap.data() as Map<String, dynamic>?;
        final curType = snapData?['type'];
        if (curType == 'both') {
          await docRef.update({
            'type': 'user',
            'updatedAt': FieldValue.serverTimestamp(),
          });
        } else if (curType == 'seller') {
          await docRef.delete();
        }
      }
    } catch (error) {
      debugPrint('Could not update email index during seller deletion: $error');
    }
  }

  Future<SellerModel?> restoreSession() async {
    try {
      final userId = _authService.currentUserId;
      if (userId == null) return null;
      return getSellerData(userId);
    } catch (error) {
      debugPrint('Seller session restore error: $error');
      return null;
    }
  }

  Stream<UserModel?> get authStateChanges => _authService.authStateChanges;

  UserModel? get currentUser => _authService.currentUser;
}
