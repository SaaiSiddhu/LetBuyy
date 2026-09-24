// APPID-P4d — where the app keeps the buyer's LetBuyy session, and a sign-in attempt that is open in
// the browser: the platform's protected storage (the Android Keystore, the iOS Keychain) through
// flutter_secure_storage. Never shared preferences, a file, or a log line.
//
// Android backups: the stored values are encrypted with a Keystore key that never leaves the device,
// so a backup restored elsewhere cannot be read. resetOnError makes such a restore read as nothing
// (signed out) instead of failing, and the buyer signs in again.

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';

/// A platform buyer session identity-platform minted for this app.
class StoredBuyerSession {
  const StoredBuyerSession({required this.token, required this.expiresAt, this.email});

  final String token;
  final DateTime expiresAt;

  /// Shown while the app cannot reach the gateway; never used to decide anything.
  final String? email;

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);

  StoredBuyerSession withEmail(String? value) => StoredBuyerSession(token: token, expiresAt: expiresAt, email: value);

  Map<String, Object?> toJson() => {'v': 1, 'token': token, 'expires_at': expiresAt.toUtc().toIso8601String(), 'email': email};

  static StoredBuyerSession? fromJson(Object? json) {
    if (json is! Map || json['v'] != 1) return null;
    final token = json['token'];
    final expiresAt = json['expires_at'] is String ? DateTime.tryParse(json['expires_at'] as String) : null;
    if (token is! String || token.isEmpty || expiresAt == null) return null;
    final email = json['email'];
    return StoredBuyerSession(token: token, expiresAt: expiresAt, email: email is String ? email : null);
  }
}

abstract interface class BuyerSessionStore {
  Future<StoredBuyerSession?> readSession();
  Future<void> writeSession(StoredBuyerSession session);
  Future<void> deleteSession();
  Future<PendingBuyerSignIn?> readPending();
  Future<void> writePending(PendingBuyerSignIn pending);
  Future<void> deletePending();
}

class SecureBuyerSessionStore implements BuyerSessionStore {
  SecureBuyerSessionStore([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true, resetOnError: true),
              // Readable once the device has been unlocked after a restart, and never synced or
              // migrated to another device.
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _storage;

  static const String _sessionKey = 'letbuyy.buyer_session.v1';
  static const String _pendingKey = 'letbuyy.buyer_sign_in_pending.v1';

  Future<Object?> _readJson(String key) async {
    try {
      final raw = await _storage.read(key: key);
      return raw == null ? null : jsonDecode(raw);
    } on Exception {
      // Unreadable (a restored backup, a corrupted entry): the same as absent.
      await _storage.delete(key: key).catchError((Object _) {});
      return null;
    }
  }

  @override
  Future<StoredBuyerSession?> readSession() async => StoredBuyerSession.fromJson(await _readJson(_sessionKey));

  @override
  Future<void> writeSession(StoredBuyerSession session) => _storage.write(key: _sessionKey, value: jsonEncode(session.toJson()));

  @override
  Future<void> deleteSession() => _storage.delete(key: _sessionKey);

  @override
  Future<PendingBuyerSignIn?> readPending() async => PendingBuyerSignIn.fromJson(await _readJson(_pendingKey));

  @override
  Future<void> writePending(PendingBuyerSignIn pending) => _storage.write(key: _pendingKey, value: jsonEncode(pending.toJson()));

  @override
  Future<void> deletePending() => _storage.delete(key: _pendingKey);
}
