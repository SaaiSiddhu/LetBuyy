// lib/services/seller_service.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

class SellerService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // Collection references
  CollectionReference get _sellersCollection => _firestore.collection('sellers');
  CollectionReference get _usersCollection => _firestore.collection('users');
  DocumentReference _emailIndexDoc(String email) =>
      _firestore.collection('email_index').doc(email.trim().toLowerCase());

  // ============================================
  // CHECK IF SELLER EXISTS BY EMAIL (uses email_index)
  // ============================================
  Future<bool> checkSellerExists(String email) async {
    try {
      debugPrint('🔍 Checking email_index for seller: $email');

      final doc = await _emailIndexDoc(email.trim().toLowerCase()).get();

      if (!doc.exists) {
        debugPrint('❌ No email_index doc → Seller does not exist');
        return false;
      }

      final data = doc.data() as Map<String, dynamic>?;
      final type = data?['type'];
      final exists = type == 'seller' || type == 'both';

      debugPrint(exists
          ? '✅ Seller exists in email_index'
          : '❌ Seller not found in email_index');

      return exists;
    } catch (e) {
      debugPrint('❌ Error checking seller via email_index: $e');
      return false;
    }
  }

  // Helper: mark email_index as seller (Option C: always set 'both' when seller registers)
  Future<void> _markEmailIndexAsSeller(String email, String uid) async {
    final docRef = _emailIndexDoc(email);
    try {
      final snap = await docRef.get();
      if (!snap.exists) {
        await docRef.set({
          'email': email.trim().toLowerCase(),
          'type': 'seller', // initially seller
          'uid': uid,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        debugPrint('✅ email_index created as "seller"');
      } else {
        final snapData = snap.data() as Map<String, dynamic>?;
        final curType = snapData?['type'];
        // According to Option C, if seller registers we want to ensure seller can be recognized as seller
        // and we choose to set 'both' so that seller may also be used as user if needed.
        if (curType == 'user') {
          await docRef.update({'type': 'both', 'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          debugPrint('✅ email_index updated to "both" (seller added)');
        } else if (curType == 'seller' || curType == 'both') {
          await docRef.update({'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          debugPrint('✅ email_index refreshed for seller');
        } else {
          await docRef.update({'type': 'seller', 'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          debugPrint('✅ email_index set to "seller" (fallback)');
        }
      }
    } catch (e) {
      debugPrint('⚠️ Could not update email_index for seller: $e');
    }
  }

  // ============================================
  // REGISTER SELLER (with robust cleanup)
  // ============================================
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
    UserCredential? userCredential;
    String? createdUid;

    try {
      debugPrint('🔐 Registering seller: $email');

      final normalizedEmail = email.trim().toLowerCase();

      // Step 1: Check if seller already exists via email_index
      final exists = await checkSellerExists(normalizedEmail);
      if (exists) {
        throw AuthException('Seller with this email already exists');
      }

      // Step 2: Create Firebase Auth account
      debugPrint('📝 Creating Firebase Auth account...');
      try {
        userCredential = await _auth.createUserWithEmailAndPassword(
          email: normalizedEmail,
          password: password,
        );
        createdUid = userCredential.user!.uid;
        debugPrint('✅ Auth account created: $createdUid');
      } on FirebaseAuthException catch (e) {
        if (e.code == 'email-already-in-use') {
          debugPrint('⚠️ Auth account exists but no Firestore doc. Attempting recovery...');

          try {
            final signInResult = await _auth.signInWithEmailAndPassword(
              email: normalizedEmail,
              password: password,
            );

            createdUid = signInResult.user!.uid;
            debugPrint('✅ Signed in to existing auth account: $createdUid');

            final sellerDoc = await _sellersCollection.doc(createdUid).get();
            if (sellerDoc.exists) {
              throw AuthException('Seller already registered. Please login instead.');
            }

            debugPrint('🔄 Recovering orphaned account, creating Firestore documents...');
            userCredential = signInResult;
          } catch (signInError) {
            if (signInError is FirebaseAuthException && signInError.code == 'wrong-password') {
              throw AuthException('Email already registered with different password. Please use forgot password.');
            }
            rethrow;
          }
        } else {
          rethrow;
        }
      }

      final uid = userCredential.user!.uid;

      // Step 3: Create user document in 'users' collection (role: seller)
      debugPrint('📝 Creating user document...');
      try {
        await _usersCollection.doc(uid).set({
          'uid': uid,
          'email': normalizedEmail,
          'name': name.trim(),
          'phone': phone.trim(),
          'role': 'seller',
          'createdAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
        debugPrint('✅ User document created');
      } catch (e) {
        debugPrint('❌ Failed to create user document: $e');
        if (createdUid == uid) {
          await _cleanupFailedRegistration(uid);
        }
        throw AuthException('Failed to create user profile');
      }

      // Step 4: Create seller model
      final seller = SellerModel(
        sellerId: uid,
        email: normalizedEmail,
        name: name.trim(),
        phone: phone.trim(),
        createdAt: DateTime.now(),
        lastLogin: DateTime.now(),
        businessType: businessType,
        businessLegalName: businessLegalName.trim(),
        storeName: storeName.trim(),
        businessAddress: businessAddress.trim(),
        businessContact: businessContact.trim(),
        businessCity: businessCity.trim(),
        businessPincode: businessPincode.trim(),
        businessState: businessState.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        gstNumber: gstExempt ? 'EXEMPT' : gstNumber.trim().toUpperCase(),
        gstExempt: gstExempt,
        verificationStatus: VerificationStatus.pending,
      );

      // Step 5: Save seller to Firestore
      debugPrint('📝 Creating seller document...');
      try {
        await _sellersCollection.doc(uid).set(seller.toMap());
        debugPrint('✅ Seller document created');
      } catch (e) {
        debugPrint('❌ Failed to create seller document: $e');
        await _cleanupFailedRegistration(uid);
        throw AuthException('Failed to create seller profile');
      }

      // Step 6: Create seller log (non-critical)
      try {
        await _firestore.collection('seller_logs').add({
          'sellerId': uid,
          'event': 'registration',
          'success': true,
          'email': normalizedEmail,
          'timestamp': FieldValue.serverTimestamp(),
          'platform': 'flutter',
        });
        debugPrint('✅ Seller log created');
      } catch (e) {
        debugPrint('⚠️ Failed to create seller log (non-critical): $e');
      }

      // Step 7: Update public email_index
      // Option C: Always mark seller email as 'both' (so sellers are discoverable as seller and also flagged both)
      try {
        final docRef = _emailIndexDoc(normalizedEmail);
        final snap = await docRef.get();
        if (!snap.exists) {
          await docRef.set({
            'email': normalizedEmail,
            'type': 'both', // per option C: seller => both
            'uid': uid,
            'updatedAt': FieldValue.serverTimestamp(),
          });
          debugPrint('✅ email_index created as "both" for seller');
        } else {
          // If email_index exists, set to 'both' unconditionally for sellers per Option C
          await docRef.update({'type': 'both', 'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          debugPrint('✅ email_index updated to "both" for seller');
        }
      } catch (e) {
        debugPrint('⚠️ Could not update email_index for seller: $e');
      }

      debugPrint('✅ Seller registered successfully: $uid');

      await _auth.signOut();
      debugPrint('✅ Signed out - awaiting admin approval');

      return seller;

    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Firebase Auth error: ${e.code} - ${e.message}');
      throw AuthException(_getFirebaseErrorMessage(e.code));
    } catch (e) {
      debugPrint('❌ Registration error: $e');
      if (e is AuthException) rethrow;
      throw AuthException('Seller registration failed: ${e.toString()}');
    }
  }

  // ============================================
  // CLEANUP FAILED REGISTRATION
  // ============================================
  Future<void> _cleanupFailedRegistration(String uid) async {
    try {
      debugPrint('🧹 Cleaning up failed registration for: $uid');

      try {
        await _usersCollection.doc(uid).delete();
        debugPrint('✅ Deleted user document');
      } catch (e) {
        debugPrint('⚠️ Could not delete user document: $e');
      }

      try {
        await _sellersCollection.doc(uid).delete();
        debugPrint('✅ Deleted seller document');
      } catch (e) {
        debugPrint('⚠️ Could not delete seller document: $e');
      }

      try {
        final user = _auth.currentUser;
        if (user != null && user.uid == uid) {
          await user.delete();
          debugPrint('✅ Deleted auth account');
        }
      } catch (e) {
        debugPrint('⚠️ Could not delete auth account: $e');
      }

    } catch (e) {
      debugPrint('❌ Cleanup error: $e');
    }
  }

  // ============================================
  // SIGN IN SELLER
  // ============================================
  Future<SellerModel> signInSeller({
    required String email,
    required String password,
  }) async {
    try {
      debugPrint('🔐 Signing in seller: $email');

      final normalizedEmail = email.trim().toLowerCase();

      final exists = await checkSellerExists(normalizedEmail);
      if (!exists) {
        throw AuthException('No seller account found with this email');
      }

      final userCredential = await _auth.signInWithEmailAndPassword(
        email: normalizedEmail,
        password: password,
      );

      final uid = userCredential.user!.uid;

      final seller = await getSellerData(uid);

      await _sellersCollection.doc(uid).update({
        'lastLogin': FieldValue.serverTimestamp(),
      });

      debugPrint('✅ Seller signed in successfully: $uid');
      return seller;
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Firebase Auth error: ${e.code}');
      throw AuthException(_getFirebaseErrorMessage(e.code));
    } catch (e) {
      debugPrint('❌ Sign in error: $e');
      if (e is AuthException) rethrow;
      throw AuthException('Seller sign in failed: ${e.toString()}');
    }
  }

  // ============================================
  // GET SELLER DATA
  // ============================================
  Future<SellerModel> getSellerData(String sellerId) async {
    try {
      // First try direct document lookup (document ID = auth UID)
      final doc = await _sellersCollection.doc(sellerId).get();

      if (doc.exists) {
        return SellerModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
      }
      
      // Fallback: Query by 'uid' field (handles mismatched doc IDs)
      // This is needed when Cloud Functions create docs with different IDs
      debugPrint('🔍 Document not found by ID, querying by uid field...');
      final querySnapshot = await _sellersCollection
          .where('uid', isEqualTo: sellerId)
          .limit(1)
          .get();
      
      if (querySnapshot.docs.isNotEmpty) {
        final queryDoc = querySnapshot.docs.first;
        debugPrint('✅ Found seller by uid query: ${queryDoc.id}');
        return SellerModel.fromMap(queryDoc.data() as Map<String, dynamic>, queryDoc.id);
      }
      
      throw AuthException('Seller data not found');
    } catch (e) {
      debugPrint('❌ Error getting seller data: $e');
      if (e is AuthException) rethrow;
      throw AuthException('Failed to load seller data');
    }
  }

  // ============================================
  // UPDATE SELLER PROFILE
  // ============================================
  Future<void> updateSellerProfile({
    required String sellerId,
    String? name,
    String? phone,
    String? photoUrl,
    String? storeName,
    String? businessAddress,
    String? businessAddress2,      // ✅ NEW FIELD
    String? businessLandmark,      // ✅ NEW FIELD
    String? businessContact,
    String? businessCity,
    String? businessPincode,
    String? businessState,
    String? businessDistrict,      // ✅ NEW FIELD
  }) async {
    try {
      final updates = <String, dynamic>{};

      if (name != null) updates['name'] = name.trim();
      if (phone != null) updates['phone'] = phone.trim();
      if (photoUrl != null) updates['photoUrl'] = photoUrl;
      if (storeName != null) updates['storeName'] = storeName.trim();
      if (businessAddress != null) updates['businessAddress'] = businessAddress.trim();
      if (businessAddress2 != null) updates['businessAddress2'] = businessAddress2.trim();        // ✅ NEW FIELD
      if (businessLandmark != null) updates['businessLandmark'] = businessLandmark.trim();        // ✅ NEW FIELD
      if (businessContact != null) updates['businessContact'] = businessContact.trim();
      if (businessCity != null) updates['businessCity'] = businessCity.trim();
      if (businessPincode != null) updates['businessPincode'] = businessPincode.trim();
      if (businessState != null) updates['businessState'] = businessState.trim();
      if (businessDistrict != null) updates['businessDistrict'] = businessDistrict.trim();        // ✅ NEW FIELD

      updates['updatedAt'] = FieldValue.serverTimestamp();

      await _sellersCollection.doc(sellerId).update(updates);

      debugPrint('✅ Seller profile updated: $sellerId');
    } catch (e) {
      debugPrint('❌ Error updating seller profile: $e');
      throw AuthException('Failed to update profile');
    }
  }

  // ============================================
  // UPDATE BANK DETAILS
  // ============================================
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

      debugPrint('✅ Bank details updated: $sellerId');
    } catch (e) {
      debugPrint('❌ Error updating bank details: $e');
      throw AuthException('Failed to update bank details');
    }
  }

  // ============================================
  // CHANGE PASSWORD
  // ============================================
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final user = _auth.currentUser;
      if (user == null) throw AuthException('No seller logged in');

      final credential = EmailAuthProvider.credential(
        email: user.email!,
        password: currentPassword,
      );
      await user.reauthenticateWithCredential(credential);

      await user.updatePassword(newPassword);

      debugPrint('✅ Password changed successfully');
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Password change error: ${e.code}');
      throw AuthException(_getFirebaseErrorMessage(e.code));
    } catch (e) {
      debugPrint('❌ Password change error: $e');
      throw AuthException('Failed to change password');
    }
  }

  // ============================================
  // SEND PASSWORD RESET EMAIL
  // ============================================
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim().toLowerCase());
      debugPrint('✅ Password reset email sent to: $email');
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ Password reset error: ${e.code}');
      throw AuthException(_getFirebaseErrorMessage(e.code));
    } catch (e) {
      debugPrint('❌ Password reset error: $e');
      throw AuthException('Failed to send reset email');
    }
  }

  // ============================================
  // SIGN OUT
  // ============================================
  Future<void> signOut() async {
    try {
      await _auth.signOut();
      debugPrint('✅ Seller signed out');
    } catch (e) {
      debugPrint('❌ Sign out error: $e');
      throw AuthException('Sign out failed');
    }
  }

  // ============================================
  // DELETE ACCOUNT
  // ============================================
  Future<void> deleteAccount() async {
    try {
      final user = _auth.currentUser;
      if (user == null) throw AuthException('No seller logged in');

      final uid = user.uid;
      final email = user.email?.toLowerCase() ?? '';

      await _usersCollection.doc(uid).delete();
      await _sellersCollection.doc(uid).delete();

      // Update email_index: if 'both' -> downgrade to 'user' OR remove
      try {
        final docRef = _emailIndexDoc(email);
        final snap = await docRef.get();
        if (snap.exists) {
          final snapData = snap.data() as Map<String, dynamic>?;
          final curType = snapData?['type'];
          if (curType == 'both') {
            // downgrade to 'user' (because seller removed)
            await docRef.update({'type': 'user', 'updatedAt': FieldValue.serverTimestamp()});
            debugPrint('✅ email_index downgraded to "user" after seller deletion');
          } else if (curType == 'seller') {
            await docRef.delete();
            debugPrint('✅ email_index deleted (was seller)');
          } else {
            debugPrint('ℹ️ email_index left unchanged: $curType');
          }
        }
      } catch (e) {
        debugPrint('⚠️ Could not update email_index during seller deletion: $e');
      }

      await user.delete();

      debugPrint('✅ Seller account deleted');
    } catch (e) {
      debugPrint('❌ Account deletion error: $e');
      throw AuthException('Failed to delete account');
    }
  }

  // ============================================
  // RESTORE SESSION
  // ============================================
  Future<SellerModel?> restoreSession() async {
    try {
      final user = _auth.currentUser;
      if (user == null) return null;

      // First try direct document lookup
      final doc = await _sellersCollection.doc(user.uid).get();
      if (doc.exists) {
        debugPrint('✅ Seller session restored: ${user.uid}');
        return SellerModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
      }
      
      // Fallback: Query by 'uid' field
      debugPrint('🔍 Session restore: querying by uid field...');
      final querySnapshot = await _sellersCollection
          .where('uid', isEqualTo: user.uid)
          .limit(1)
          .get();
      
      if (querySnapshot.docs.isNotEmpty) {
        final queryDoc = querySnapshot.docs.first;
        debugPrint('✅ Seller session restored via uid query: ${queryDoc.id}');
        return SellerModel.fromMap(queryDoc.data() as Map<String, dynamic>, queryDoc.id);
      }
      
      return null;
    } catch (e) {
      debugPrint('❌ Session restore error: $e');
      return null;
    }
  }

  // ============================================
  // AUTH STATE STREAM
  // ============================================
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  // ============================================
  // GET CURRENT USER
  // ============================================
  User? get currentUser => _auth.currentUser;

  // ============================================
  // HELPER: Firebase Error Messages
  // ============================================
  String _getFirebaseErrorMessage(String code) {
    switch (code) {
      case 'email-already-in-use':
        return 'Email already registered. Please login instead.';
      case 'weak-password':
        return 'Password too weak. Use 8+ chars with uppercase, lowercase, and numbers.';
      case 'user-not-found':
        return 'No seller account found with this email.';
      case 'wrong-password':
        return 'Wrong password. Please try again.';
      case 'invalid-email':
        return 'Invalid email address.';
      case 'too-many-requests':
        return 'Too many login attempts. Try again later.';
      case 'network-request-failed':
        return 'Network error. Check your internet connection.';
      case 'user-disabled':
        return 'This seller account has been disabled.';
      case 'requires-recent-login':
        return 'Please re-authenticate to continue.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }
}