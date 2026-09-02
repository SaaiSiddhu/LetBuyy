import 'dart:convert';

import 'package:agrimore_api/agrimore_api.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_realtime/agrimore_realtime.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class RiderSessionStore
    implements ApiAuthTokenProvider, RealtimeAuthTokenProvider {
  Future<AuthSession?> readSession();
  Future<void> writeSession(AuthSession session);
  Future<void> clear();
}

final class SecureRiderSessionStore implements RiderSessionStore {
  const SecureRiderSessionStore(this._storage);

  static const _sessionKey = 'agrimore.rider.session.v1';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> accessToken() async => (await readSession())?.accessToken;

  @override
  Future<AuthSession?> readSession() async {
    final encoded = await _storage.read(key: _sessionKey);
    if (encoded == null || encoded.isEmpty) return null;
    final json = (jsonDecode(encoded) as Map).cast<String, Object?>();
    return AuthSession(
      userId: EntityId(json['userId'] as String),
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      roles: ((json['roles'] as List?) ?? const ['rider'])
          .cast<String>()
          .map(UserRole.fromJson)
          .toList(growable: false),
    );
  }

  @override
  Future<void> writeSession(AuthSession session) {
    return _storage.write(
      key: _sessionKey,
      value: jsonEncode({
        'userId': session.userId.value,
        'accessToken': session.accessToken,
        'refreshToken': session.refreshToken,
        'expiresAt': session.expiresAt.toUtc().toIso8601String(),
        'roles': session.roles.map((role) => role.toJson()).toList(),
      }),
    );
  }

  @override
  Future<void> clear() => _storage.delete(key: _sessionKey);
}
