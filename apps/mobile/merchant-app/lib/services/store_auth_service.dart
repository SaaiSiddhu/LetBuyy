import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';

enum AuthChangeEvent { initialSession, signedIn, signedOut, tokenRefreshed }

class AuthState {
  const AuthState({required this.event, this.session});

  final AuthChangeEvent event;
  final MerchantSession? session;
}

class MerchantSessionUser {
  const MerchantSessionUser({
    required this.id,
    required this.email,
    this.fullName,
    this.avatarUrl,
  });

  final String id;
  final String email;
  final String? fullName;
  final String? avatarUrl;

  Map<String, Object?> get userMetadata => {
    'full_name': fullName,
    'avatar_url': avatarUrl,
  };

  Map<String, Object?> toJson() => {
    'id': id,
    'email': email,
    'fullName': fullName,
    'avatarUrl': avatarUrl,
  };

  factory MerchantSessionUser.fromJson(Map<String, dynamic> json) {
    return MerchantSessionUser(
      id: _stringValue(json['id']),
      email: _stringValue(json['email']),
      fullName: _nullableString(json['fullName'] ?? json['full_name']),
      avatarUrl: _nullableString(json['avatarUrl'] ?? json['avatar_url']),
    );
  }
}

class MerchantSession {
  const MerchantSession({
    required this.token,
    required this.user,
    this.expiresAt,
  });

  final String token;
  final MerchantSessionUser user;
  final DateTime? expiresAt;

  Map<String, Object?> toJson() => {
    'token': token,
    'user': user.toJson(),
    'expiresAt': expiresAt?.toIso8601String(),
  };
}

class StoreAuthService extends ChangeNotifier {
  StoreAuthService({
    required ApiClient api,
    required String identityBaseUrl,
    FlutterSecureStorage? secureStorage,
    http.Client? httpClient,
  }) : _api = api,
       _identityBaseUrl = _trimTrailingSlash(identityBaseUrl),
       _secureStorage = secureStorage ?? const FlutterSecureStorage(),
       _http = httpClient ?? http.Client();

  static const _sessionTokenKey = 'lb_session';
  static const _sessionUserKey = 'lb_session_user';
  static const _sessionExpiresAtKey = 'lb_session_expires_at';
  static const _csrfCookieName = 'lb_csrf';
  static const _sessionCookieName = 'lb_session';

  final ApiClient _api;
  final String _identityBaseUrl;
  final FlutterSecureStorage _secureStorage;
  final http.Client _http;
  final StreamController<AuthState> _authEvents =
      StreamController<AuthState>.broadcast();

  MerchantSession? _session;

  MerchantSessionUser? get currentUser => _session?.user;
  bool get isSignedIn => _session != null;
  String? get accessToken => _session?.token;
  Stream<AuthState> get authStateChanges => _authEvents.stream;

  Future<void> restoreSession() async {
    final token = await _secureStorage.read(key: _sessionTokenKey);
    if (token == null || token.isEmpty) {
      _emit(AuthChangeEvent.signedOut);
      return;
    }

    final restoredUser = await _readStoredUser();
    if (restoredUser != null) {
      _session = MerchantSession(token: token, user: restoredUser);
      notifyListeners();
    }

    final validatedSession = await _validateIdentitySession(token);
    if (validatedSession != null) {
      await _persistSession(validatedSession);
      _session = validatedSession;
      _emit(AuthChangeEvent.initialSession);
      notifyListeners();
      return;
    }

    await _clearSession();
    _emit(AuthChangeEvent.signedOut);
  }

  Future<MerchantSessionUser?> signInWithPassword(
    String email,
    String password,
  ) async {
    final normalizedEmail = email.trim().toLowerCase();
    final csrf = await _fetchCsrfCookie();
    final response = await _postIdentityJson(
      '/api/auth/login',
      csrf: csrf,
      body: {
        'email': normalizedEmail,
        'password': password,
        'turnstileToken': 'dev-bypass-token',
      },
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_errorMessage(response, 'Invalid email or password'));
    }

    final token = _extractCookie(response, _sessionCookieName);
    if (token == null || token.isEmpty) {
      throw Exception('Identity platform did not return lb_session');
    }

    final session =
        await _validateIdentitySession(token) ??
        MerchantSession(
          token: token,
          user: MerchantSessionUser(id: '', email: normalizedEmail),
        );
    await _persistSession(session);
    _session = session;
    _emit(AuthChangeEvent.signedIn);
    notifyListeners();
    return session.user;
  }

  Future<MerchantSessionUser?> signUp(
    String email,
    String password, {
    String? name,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final csrf = await _fetchCsrfCookie();
    final signupResponse = await _postIdentityJson(
      '/api/auth/signup',
      csrf: csrf,
      body: {'email': normalizedEmail, 'turnstileToken': 'dev-bypass-token'},
    );

    if (signupResponse.statusCode < 200 || signupResponse.statusCode >= 300) {
      throw Exception(
        _errorMessage(signupResponse, 'Unable to create account'),
      );
    }

    final signupBody = _decodeBody(signupResponse);
    final devOtp = _nullableString(signupBody['devOtp']);
    if (devOtp == null) {
      throw Exception(
        'Verification code sent. Complete the OTP step in the web identity platform until the mobile OTP endpoint is available.',
      );
    }

    final verifyResponse = await _postIdentityJson(
      '/api/auth/verify-otp',
      csrf: csrf,
      body: {'email': normalizedEmail, 'otp': devOtp},
    );
    if (verifyResponse.statusCode < 200 || verifyResponse.statusCode >= 300) {
      throw Exception(_errorMessage(verifyResponse, 'OTP verification failed'));
    }

    final verifyBody = _decodeBody(verifyResponse);
    final userId = _nullableString(verifyBody['userId']);
    if (userId == null) {
      throw Exception('Identity platform did not return a verified user id');
    }

    final passwordResponse = await _postIdentityJson(
      '/api/auth/set-password',
      csrf: csrf,
      body: {'email': normalizedEmail, 'userId': userId, 'password': password},
    );
    if (passwordResponse.statusCode < 200 ||
        passwordResponse.statusCode >= 300) {
      throw Exception(
        _errorMessage(passwordResponse, 'Unable to set password'),
      );
    }

    final token = _extractCookie(passwordResponse, _sessionCookieName);
    if (token == null || token.isEmpty) {
      throw Exception('Identity platform did not return lb_session');
    }

    final session =
        await _validateIdentitySession(token) ??
        MerchantSession(
          token: token,
          user: MerchantSessionUser(
            id: userId,
            email: normalizedEmail,
            fullName: name,
          ),
        );
    await _persistSession(session);
    _session = session;
    _emit(AuthChangeEvent.signedIn);
    notifyListeners();
    return session.user;
  }

  Future<void> resetPassword(String email) async {
    final csrf = await _fetchCsrfCookie();
    final response = await _postIdentityJson(
      '/api/auth/send-reset',
      csrf: csrf,
      body: {'email': email.trim().toLowerCase()},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_errorMessage(response, 'Unable to send reset email'));
    }
  }

  Future<void> updatePassword(String newPassword) async {
    throw Exception(
      'Password updates must use the identity platform reset flow',
    );
  }

  Future<void> signOut() async {
    final token = _session?.token;
    if (token != null && token.isNotEmpty) {
      try {
        await _http.post(
          _identityUri('/api/auth/logout'),
          headers: {'Cookie': '$_sessionCookieName=$token'},
        );
      } catch (error) {
        debugPrint('Sign-out request failed: $error');
      }
    }

    await _clearSession();
    _emit(AuthChangeEvent.signedOut);
    notifyListeners();
  }

  Future<void> refreshSession() => restoreSession();

  Future<Map<String, dynamic>?> getFirstStore() async {
    try {
      final res = await _api.get('stores', query: {'limit': '1'});
      final items = res['data'] as List? ?? [];
      return items.isNotEmpty ? items.first as Map<String, dynamic> : null;
    } catch (error) {
      debugPrint('Error fetching stores: $error');
      return null;
    }
  }

  Future<String> _fetchCsrfCookie() async {
    final response = await _http.get(_identityUri('/login'));
    final csrf = _extractCookie(response, _csrfCookieName);
    if (csrf == null || csrf.isEmpty) {
      throw Exception('Identity platform did not return CSRF cookie');
    }
    return csrf;
  }

  Future<http.Response> _postIdentityJson(
    String path, {
    required String csrf,
    required Map<String, Object?> body,
  }) {
    return _http.post(
      _identityUri(path),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        'Cookie': '$_csrfCookieName=$csrf',
      },
      body: jsonEncode(body),
    );
  }

  Future<MerchantSession?> _validateIdentitySession(String token) async {
    try {
      final response = await _http.get(
        _identityUri('/api/auth/session'),
        headers: {'Cookie': '$_sessionCookieName=$token'},
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }

      final body = _decodeBody(response);
      if (body['authenticated'] != true || body['user'] is! Map) return null;

      final user = MerchantSessionUser.fromJson(
        Map<String, dynamic>.from(body['user'] as Map),
      );
      return MerchantSession(token: token, user: user);
    } catch (error) {
      debugPrint('Identity session validation failed: $error');
      return null;
    }
  }

  Future<void> _persistSession(MerchantSession session) async {
    await _secureStorage.write(key: _sessionTokenKey, value: session.token);
    await _secureStorage.write(
      key: _sessionUserKey,
      value: jsonEncode(session.user.toJson()),
    );
    if (session.expiresAt != null) {
      await _secureStorage.write(
        key: _sessionExpiresAtKey,
        value: session.expiresAt!.toIso8601String(),
      );
    }
  }

  Future<MerchantSessionUser?> _readStoredUser() async {
    final raw = await _secureStorage.read(key: _sessionUserKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return MerchantSessionUser.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _clearSession() async {
    _session = null;
    await _secureStorage.delete(key: _sessionTokenKey);
    await _secureStorage.delete(key: _sessionUserKey);
    await _secureStorage.delete(key: _sessionExpiresAtKey);
  }

  Uri _identityUri(String path) => Uri.parse('$_identityBaseUrl$path');

  void _emit(AuthChangeEvent event) {
    if (!_authEvents.isClosed) {
      _authEvents.add(AuthState(event: event, session: _session));
    }
  }

  @override
  void dispose() {
    _authEvents.close();
    _http.close();
    super.dispose();
  }
}

Map<String, dynamic> _decodeBody(http.Response response) {
  if (response.body.isEmpty) return <String, dynamic>{};
  final decoded = jsonDecode(response.body);
  return decoded is Map ? Map<String, dynamic>.from(decoded) : {};
}

String _errorMessage(http.Response response, String fallback) {
  try {
    final body = _decodeBody(response);
    final error = body['error'];
    if (error is String && error.isNotEmpty) return error;
    if (error is Map && error['message'] is String) {
      return error['message'] as String;
    }
  } catch (_) {
    // Fall through to fallback.
  }
  return fallback;
}

String? _extractCookie(http.Response response, String name) {
  final header = response.headers['set-cookie'];
  if (header == null || header.isEmpty) return null;
  final match = RegExp('(?:^|[,;]\\s*)$name=([^;]+)').firstMatch(header);
  return match?.group(1);
}

String _trimTrailingSlash(String value) {
  var trimmed = value.trim();
  while (trimmed.endsWith('/')) {
    trimmed = trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed;
}

String _stringValue(Object? value) => value is String ? value : '';

String? _nullableString(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return value;
}
