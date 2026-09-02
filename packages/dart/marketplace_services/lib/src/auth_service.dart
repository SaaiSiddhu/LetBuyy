import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();

  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  factory AuthService() => _instance;
  AuthService._internal();

  // ✅ Initialize with persistent authentication
  Future<void> initializePersistence() async {
    try {
      if (kIsWeb) {
        await _auth.setPersistence(Persistence.LOCAL);
        print('✅ Firebase Auth persistence set to LOCAL for web');
      } else {
        print('✅ Using default LOCAL persistence for native platforms');
      }
    } catch (e) {
      print('⚠️ Could not set persistence: $e');
    }
  }

  // Getters
  Stream<User?> get authStateChanges => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;
  String? get currentUserId => _auth.currentUser?.uid;
  bool get isLoggedIn => _auth.currentUser != null;
  bool get isGuestMode => !isLoggedIn;

  // ✅ Get current user ID as method
  String? getCurrentUserId() {
    return _auth.currentUser?.uid;
  }

  // ✅ Get current user as UserModel
  UserModel? getCurrentUser() {
    final firebaseUser = _auth.currentUser;
    if (firebaseUser == null) return null;

    return UserModel(
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? '',
      name: firebaseUser.displayName ?? 'Anonymous',
      phone: firebaseUser.phoneNumber,
      photoUrl: firebaseUser.photoURL,
      role: 'user',
      createdAt: DateTime.now(),
      lastLogin: DateTime.now(),
    );
  }

  // Helper: email_index document path (lowercased email)
  DocumentReference _emailIndexDoc(String email) {
    return _firestore.collection('email_index').doc(email.trim().toLowerCase());
  }

  // Helper: upsert email_index for a user registration
  Future<void> _upsertEmailIndexForUser(String email, String uid) async {
    final docRef = _emailIndexDoc(email);
    try {
      final snap = await docRef.get();
      if (!snap.exists) {
        await docRef.set({
          'email': email.trim().toLowerCase(),
          'type': 'user',
          'uid': uid,
          'updatedAt': FieldValue.serverTimestamp(),
        });
        print('✅ email_index created as "user"');
      } else {
        final snapData = snap.data() as Map<String, dynamic>?;
        final curType = snapData?['type'];
        if (curType == 'seller' || curType == 'both') {
          // If seller exists, mark as both
          await docRef.update({'type': 'both', 'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          print('✅ email_index updated to "both"');
        } else if (curType == 'user') {
          await docRef.update({'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          print('✅ email_index refreshed as "user"');
        } else {
          await docRef.update({'type': 'user', 'uid': uid, 'updatedAt': FieldValue.serverTimestamp()});
          print('✅ email_index set to "user" (fallback)');
        }
      }
    } catch (e) {
      print('⚠️ Could not update email_index for user: $e');
    }
  }

  // Helper: remove or downgrade email_index when a user account is deleted
  Future<void> _cleanupEmailIndexAfterUserDeletion(String email) async {
    final docRef = _emailIndexDoc(email);
    try {
      final snap = await docRef.get();
      if (!snap.exists) return;

      final snapData = snap.data() as Map<String, dynamic>?;
      final curType = snapData?['type'];
      if (curType == 'user') {
        await docRef.delete();
        print('✅ email_index deleted (was user)');
      } else if (curType == 'both') {
        // downgrade to seller only (per your choice sellers are "both" but here we remove user flag)
        await docRef.update({'type': 'seller', 'updatedAt': FieldValue.serverTimestamp()});
        print('✅ email_index downgraded to "seller"');
      } else {
        // leave as-is
        print('ℹ️ email_index left unchanged: $curType');
      }
    } catch (e) {
      print('⚠️ Could not cleanup email_index after user deletion: $e');
    }
  }

  // ===========================
  // REGISTER WITH EMAIL
  // ===========================
  Future<UserModel> registerWithEmail({
    required String email,
    required String password,
    required String name,
    String? phone,
  }) async {
    try {
      print('🔥 Starting registration for: $email');

      final UserCredential result = await _auth.createUserWithEmailAndPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );

      final User? user = result.user;
      if (user == null) throw AuthException('Registration failed');

      print('✅ Firebase Auth user created: ${user.uid}');

      final userModel = UserModel(
        uid: user.uid,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone?.trim(),
        role: 'user',
        createdAt: DateTime.now(),
        lastLogin: DateTime.now(),
      );

      print('🔥 Attempting to save user to Firestore...');

      try {
        await _firestore.collection('users').doc(user.uid).set(userModel.toMap());
        print('✅ User saved to Firestore successfully!');
      } catch (firestoreError) {
        print('❌ Firestore error: $firestoreError');
        // attempt to cleanup auth account if Firestore save fails
        try {
          await user.delete();
        } catch (_) {}
        throw AuthException(
            'Failed to save user data: ${firestoreError.toString()}');
      }

      // Update public email_index (Option C behaviour: seller emails become "both", users set 'user')
      await _upsertEmailIndexForUser(email.trim().toLowerCase(), user.uid);

      await _savePersistentSession(userModel);

      print('✅ Registration complete!');
      return userModel;
    } on FirebaseAuthException catch (e) {
      print('❌ Firebase Auth error: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    } catch (e) {
      print('❌ General error: $e');
      throw AuthException('Registration failed: ${e.toString()}');
    }
  }

  // ===========================
  // SIGN IN WITH EMAIL
  // ===========================
  Future<UserModel> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      print('🔥 Attempting login for: $email');

      final UserCredential result = await _auth.signInWithEmailAndPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );

      final User? user = result.user;
      if (user == null) throw AuthException('Sign in failed');

      print('✅ Firebase Auth login successful: ${user.uid}');

      try {
        await _firestore.collection('users').doc(user.uid).update({
          'lastLogin': FieldValue.serverTimestamp(),
          'loginCount': FieldValue.increment(1),
        });
        print('✅ Last login updated');
      } catch (e) {
        print('⚠️ Could not update last login: $e');
      }

      print('🔥 Fetching user data from Firestore...');
      final userModel = await getUserData(user.uid);
      print('✅ User data fetched: ${userModel.email}');

      await _savePersistentSession(userModel);

      print('✅ Login complete!');
      return userModel;
    } on FirebaseAuthException catch (e) {
      print('❌ Firebase Auth error: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    } catch (e) {
      print('❌ Login error: $e');
      throw AuthException('Sign in failed: ${e.toString()}');
    }
  }

  // ===========================
  // SIGN IN WITH GOOGLE
  // ===========================
  Future<UserModel> signInWithGoogle() async {
    try {
      print('🔥 Starting Google sign in...');

      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) throw AuthException('Google sign in cancelled');

      print('✅ Google user selected: ${googleUser.email}');

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final UserCredential result = await _auth.signInWithCredential(credential);

      final User? user = result.user;
      if (user == null) throw AuthException('Google sign in failed');

      print('✅ Firebase Auth successful: ${user.uid}');

      final userDoc =
          await _firestore.collection('users').doc(user.uid).get();

      UserModel userModel;

      if (!userDoc.exists) {
        print('📝 Creating new user document...');

        userModel = UserModel(
          uid: user.uid,
          email: user.email!,
          name: user.displayName ?? 'User',
          phone: user.phoneNumber,
          photoUrl: user.photoURL,
          role: 'user',
          createdAt: DateTime.now(),
          lastLogin: DateTime.now(),
        );

        try {
          await _firestore.collection('users').doc(user.uid).set(userModel.toMap());
          print('✅ User document created!');
        } catch (e) {
          print('❌ Firestore error: $e');
          throw AuthException('Failed to save user data: ${e.toString()}');
        }
      } else {
        print('✅ User document exists, updating last login...');

        await _firestore.collection('users').doc(user.uid).update({
          'lastLogin': FieldValue.serverTimestamp(),
          'loginCount': FieldValue.increment(1),
        });

        userModel = await getUserData(user.uid);
      }

      // ensure email_index is updated
      if (user.email != null) {
        await _upsertEmailIndexForUser(user.email!.toLowerCase(), user.uid);
      }

      await _savePersistentSession(userModel);

      print('✅ Google sign in complete!');
      return userModel;
    } on FirebaseAuthException catch (e) {
      print('❌ Firebase Auth error: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    } catch (e) {
      print('❌ Google sign in error: $e');
      throw AuthException('Google sign in failed: ${e.toString()}');
    }
  }

  // ===========================
  // PERSISTENT SESSION SAVE
  // ===========================
  Future<void> _savePersistentSession(UserModel userModel) async {
    try {
      await SharedPreferencesService.saveUserSession(
        userId: userModel.uid,
        email: userModel.email,
        name: userModel.name,
        role: userModel.role,
      );
      print('✅ Persistent session saved');
    } catch (e) {
      print('⚠️ Could not save session: $e');
    }
  }

  // ===========================
  // GET USER DATA
  // ===========================
  Future<UserModel> getUserData(String uid) async {
    try {
      print('🔥 Getting user data for: $uid');

      final doc = await _firestore.collection('users').doc(uid).get();

      if (!doc.exists) {
        print('❌ User document does not exist!');
        throw UserNotFoundException('User not found');
      }

      print('✅ User document found');
      return UserModel.fromMap(doc.data()!, doc.id);
    } catch (e) {
      print('❌ Error getting user data: $e');
      throw DatabaseException('Failed to get user: ${e.toString()}');
    }
  }

  // ===========================
  // CHECK IF USER EXISTS (uses email_index)
  // ===========================
  Future<bool> checkUserExists(String email) async {
    try {
      final doc = await _emailIndexDoc(email.trim().toLowerCase()).get();
      if (!doc.exists) return false;
      final d = doc.data() as Map<String, dynamic>?;
      final type = d?['type'];
      return type == 'user' || type == 'both';
    } catch (e) {
      print('⚠️ Error checking user in email_index: $e');
      return false;
    }
  }

  // ===========================
  // UPDATE PROFILE
  // ===========================
  Future<void> updateProfile({
    String? name,
    String? phone,
    String? photoUrl,
  }) async {
    try {
      final user = currentUser;
      if (user == null) throw UnauthorizedException();

      final Map<String, dynamic> updates = {};

      if (name != null) updates['name'] = name;
      if (phone != null) updates['phone'] = phone;
      if (photoUrl != null) updates['photoUrl'] = photoUrl;

      if (updates.isNotEmpty) {
        await _firestore.collection('users').doc(user.uid).update(updates);

        final userData = await getUserData(user.uid);
        await _savePersistentSession(userData);

        print('✅ Profile updated successfully');
      }
    } catch (e) {
      print('❌ Error updating profile: $e');
      throw AuthException('Failed to update profile: ${e.toString()}');
    }
  }

  // ===========================
  // CHANGE PASSWORD
  // ===========================
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final user = currentUser;
      if (user == null || user.email == null) throw UnauthorizedException();

      final credential = EmailAuthProvider.credential(
        email: user.email!,
        password: currentPassword,
      );

      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);

      print('✅ Password changed successfully');
    } on FirebaseAuthException catch (e) {
      print('❌ Error changing password: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    } catch (e) {
      print('❌ Error changing password: $e');
      throw AuthException('Failed to change password: ${e.toString()}');
    }
  }

  // ===========================
  // SEND PASSWORD RESET
  // ===========================
  Future<void> sendPasswordResetEmail(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim().toLowerCase());
      print('✅ Password reset email sent to $email');
    } on FirebaseAuthException catch (e) {
      print('❌ Error sending reset email: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    } catch (e) {
      print('❌ Error sending reset email: $e');
      throw AuthException('Failed to send reset email: ${e.toString()}');
    }
  }

  // ===========================
  // ROLE CHECKS
  // ===========================
  Future<bool> isAdmin() async {
    try {
      if (currentUser == null) return false;
      final userModel = await getUserData(currentUser!.uid);
      return userModel.isAdmin;
    } catch (e) {
      print('⚠️ Error checking admin status: $e');
      return false;
    }
  }

  Future<bool> isSeller() async {
    try {
      if (currentUser == null) return false;
      final userModel = await getUserData(currentUser!.uid);
      return userModel.isSeller;
    } catch (e) {
      print('⚠️ Error checking seller status: $e');
      return false;
    }
  }

  // ===========================
  // SIGN OUT
  // ===========================
  Future<void> signOut() async {
    try {
      print('🔥 Signing out...');

      await _googleSignIn.signOut();
      await _auth.signOut();
      await SharedPreferencesService.clearUserSession();

      print('✅ Sign out successful');
    } catch (e) {
      print('❌ Error signing out: $e');
      throw AuthException('Sign out failed: ${e.toString()}');
    }
  }

  // ===========================
  // DELETE ACCOUNT (maintain email_index)
  // ===========================
  Future<void> deleteAccount() async {
    try {
      final user = currentUser;
      if (user == null) throw UnauthorizedException();

      final email = user.email?.toLowerCase() ?? '';

      print('🔥 Deleting account for: ${user.uid}');

      // Delete Firestore user doc
      await _firestore.collection('users').doc(user.uid).delete();

      // Update email_index: remove user flag / delete doc if only 'user'
      await _cleanupEmailIndexAfterUserDeletion(email);

      // Delete auth account
      await user.delete();
      await SharedPreferencesService.clearUserSession();

      print('✅ Account deleted successfully');
    } on FirebaseAuthException catch (e) {
      print('❌ Error deleting account: ${e.code} - ${e.message}');
      throw _handleAuthException(e);
    } catch (e) {
      print('❌ Error deleting account: $e');
      throw AuthException('Failed to delete account: ${e.toString()}');
    }
  }

  // ===========================
  // RELOAD
  // ===========================
  Future<void> reloadUser() async {
    try {
      await currentUser?.reload();
      print('✅ User reloaded successfully');
    } catch (e) {
      print('⚠️ Error reloading user: $e');
    }
  }

  // ===========================
  // RESTORE SESSION
  // ===========================
  Future<UserModel?> restoreSession() async {
    try {
      print('🔥 Restoring session...');

      if (currentUser != null) {
        print('✅ Firebase has current user: ${currentUser!.uid}');

        try {
          await currentUser!.reload();

          final userModel = await getUserData(currentUser!.uid);

          await _savePersistentSession(userModel);

          print('✅ Session restored successfully');
          return userModel;
        } catch (e) {
          print(
              '⚠️ Could not fetch user data, but user is authenticated: $e');
          return UserModel(
            uid: currentUser!.uid,
            email: currentUser!.email ?? '',
            name: currentUser!.displayName ?? 'User',
            role: 'user',
            createdAt: DateTime.now(),
            lastLogin: DateTime.now(),
          );
        }
      }

      print('⚠️ No Firebase user found - Guest mode');
      return null;
    } catch (e) {
      print('❌ Error restoring session: $e');
      return null;
    }
  }

  // ===========================
  // requireAuth / error mapping
  // ===========================
  void requireAuth(String action) {
    if (!isLoggedIn) {
      throw UnauthorizedException('Please login to $action');
    }
  }

  // ===========================
  // 🔥 EMAIL OTP AUTHENTICATION
  // ===========================

  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  /// Send OTP to email using Firebase Function
  Future<void> sendEmailOTP(String email) async {
    try {
      print('📧 Sending OTP to: $email');
      
      final callable = _functions.httpsCallable('sendEmailVerificationOTP');
      await callable.call({'email': email.trim().toLowerCase()});
      
      print('✅ OTP sent successfully');
    } catch (e) {
      print('❌ Error sending OTP: $e');
      throw AuthException('Failed to send OTP: ${e.toString()}');
    }
  }

  /// Verify OTP and login existing user
  Future<Map<String, dynamic>> verifyEmailOTPAndLogin({
    required String email,
    required String otp,
  }) async {
    try {
      print('🔐 Verifying OTP for login: $email');
      
      final callable = _functions.httpsCallable('verifyEmailOTPAndLogin');
      final response = await callable.call({
        'email': email.trim().toLowerCase(),
        'otp': otp.trim(),
      });
      
      final result = Map<String, dynamic>.from(response.data);
      
      // Sign in with custom token
      final customToken = result['customToken'] as String?;
      if (customToken != null) {
        await _auth.signInWithCustomToken(customToken);
      }
      
      print('✅ OTP verification successful');
      return result;
    } catch (e) {
      print('❌ OTP verification failed: $e');
      throw AuthException('Invalid OTP or verification failed');
    }
  }

  /// Verify OTP and signup new user
  Future<Map<String, dynamic>> verifyEmailOTPAndSignup({
    required String email,
    required String otp,
    required String name,
  }) async {
    try {
      print('🔐 Verifying OTP for signup: $email');
      
      final callable = _functions.httpsCallable('verifyEmailOTPAndSignup');
      final response = await callable.call({
        'email': email.trim().toLowerCase(),
        'otp': otp.trim(),
        'name': name.trim(),
      });
      
      final result = Map<String, dynamic>.from(response.data);
      
      // Sign in with custom token
      final customToken = result['customToken'] as String?;
      if (customToken != null) {
        await _auth.signInWithCustomToken(customToken);
      }
      
      // Create user document if new
      final uid = result['uid'] as String;
      final isNewUser = result['isNewUser'] as bool? ?? true;
      
      if (isNewUser) {
        final userModel = UserModel(
          uid: uid,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          role: 'user',
          createdAt: DateTime.now(),
          lastLogin: DateTime.now(),
        );
        
        await _firestore.collection('users').doc(uid).set(userModel.toMap());
        await _upsertEmailIndexForUser(email.trim().toLowerCase(), uid);
        await _savePersistentSession(userModel);
      }
      
      print('✅ OTP signup successful');
      return result;
    } catch (e) {
      print('❌ OTP signup failed: $e');
      throw AuthException('Invalid OTP or signup failed');
    }
  }

  AuthException _handleAuthException(FirebaseAuthException e) {
    switch (e.code) {
      case 'weak-password':
        return WeakPasswordException(
            'Password is too weak (min 8 chars, uppercase, lowercase, number)');
      case 'email-already-in-use':
        return EmailAlreadyExistsException('Email already registered');
      case 'user-not-found':
        return UserNotFoundException('User not found');
      case 'wrong-password':
        return InvalidCredentialsException('Incorrect password');
      case 'invalid-email':
        return AuthException('Invalid email address');
      case 'user-disabled':
        return AuthException('Account disabled by administrator');
      case 'too-many-requests':
        return AuthException('Too many attempts. Try again later');
      case 'operation-not-allowed':
        return AuthException('Operation not allowed');
      case 'requires-recent-login':
        return AuthException('Please re-authenticate to continue');
      case 'invalid-credential':
        return InvalidCredentialsException('Invalid credentials');
      case 'account-exists-with-different-credential':
        return AuthException('Account exists with different sign-in method');
      case 'network-request-failed':
        return AuthException('Network error. Check connection');
      default:
        return AuthException(e.message ?? 'Authentication failed');
    }
  }
}