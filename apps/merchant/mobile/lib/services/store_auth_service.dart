import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'api_client.dart';

typedef TurnstileTokenProvider = FutureOr<String> Function();

enum AuthChangeEvent {
  initialSession,
  signedIn,
  signedOut,
  tokenRefreshed,
  sessionExpired,
  verificationUnavailable,
}

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

class PendingMerchantSignUp {
  const PendingMerchantSignUp({
    required this.email,
    required this.message,
    this.needsVerification = true,
  });

  final String email;
  final String message;
  final bool needsVerification;
}

class MerchantMfaRequiredException implements Exception {
  const MerchantMfaRequiredException();
  @override
  String toString() => 'Enter your current authenticator code to sign in.';
}

class SessionVerificationUnavailableException implements Exception {
  const SessionVerificationUnavailableException();
  @override
  String toString() => 'Unable to verify your account. Please retry.';
}

class StoreAuthService extends ChangeNotifier {
  StoreAuthService({
    required ApiClient api,
    required String identityBaseUrl,
    String? mobileBffBaseUrl,
    TurnstileTokenProvider? turnstileTokenProvider,
    FlutterSecureStorage? secureStorage,
    http.Client? httpClient,
  }) : _api = api,
       _identityBaseUrl = _trimTrailingSlash(identityBaseUrl),
       _mobileBffBaseUrl = mobileBffBaseUrl == null
           ? null
           : _trimTrailingSlash(mobileBffBaseUrl),
       _turnstileTokenProvider = turnstileTokenProvider,
       _secureStorage = secureStorage ?? const FlutterSecureStorage(),
       _http = httpClient ?? http.Client();

  static const _sessionTokenKey = 'lb_session';
  static const _sessionUserKey = 'lb_session_user';
  static const _sessionExpiresAtKey = 'lb_session_expires_at';
  static const _csrfCookieName = 'letbuyy_csrf';
  static const _sessionCookieName = 'lb_session';

  final ApiClient _api;
  final String _identityBaseUrl;
  final String? _mobileBffBaseUrl;
  final TurnstileTokenProvider? _turnstileTokenProvider;
  final FlutterSecureStorage _secureStorage;
  final http.Client _http;
  final Map<String, String> _identityCookies = <String, String>{};
  final StreamController<AuthState> _authEvents =
      StreamController<AuthState>.broadcast();

  MerchantSession? _session;
  bool verificationUnavailable = false;
  bool accountTransition = false;
  bool _signingOut = false;
  int _sessionGeneration = 0;
  Future<void> _sessionWrites = Future.value();
  bool? lastLogoutRevocationConfirmed;
  int privateContextVersion = 0;
  String? preferredSiteId;
  bool needsStoreSelection = false;
  String? get accountActionCredential => _session?.token;
  void setAccountTransition(bool value) {
    if (!value && _signingOut) return;
    if (accountTransition == value) return;
    accountTransition = value;
    privateContextVersion++;
    if (!value && _session != null) _emit(AuthChangeEvent.initialSession);
    notifyListeners();
  }

  MerchantSessionUser? get currentUser => _session?.user;
  bool get isSignedIn => _session != null;
  String? get accessToken =>
      accountTransition || _signingOut ? null : _session?.token;
  DateTime? get sessionExpiresAt => _session?.expiresAt;
  Stream<AuthState> get authStateChanges => _authEvents.stream;

  Future<void> restoreSession() async {
    if (_signingOut) return;
    final generation = _sessionGeneration;
    final token = await _secureStorage.read(key: _sessionTokenKey);
    if (token == null || token.isEmpty) {
      verificationUnavailable = false;
      _emit(AuthChangeEvent.signedOut);
      return;
    }

    try {
      final validatedSession = await _validateIdentitySession(token);
      if (generation != _sessionGeneration || _signingOut) return;
      verificationUnavailable = false;
      if (validatedSession != null) {
        await _persistSession(validatedSession, generation: generation);
        if (generation != _sessionGeneration || _signingOut) return;
        _session = validatedSession;
        _emit(AuthChangeEvent.initialSession);
        notifyListeners();
        return;
      }
      await _clearSession();
      _emit(AuthChangeEvent.sessionExpired);
    } on SessionVerificationUnavailableException {
      // Keep the credential sealed, without granting an offline private workspace.
      if (generation != _sessionGeneration || _signingOut) return;
      _session = null;
      verificationUnavailable = true;
      _emit(AuthChangeEvent.verificationUnavailable);
    }
    notifyListeners();
  }

  Future<void> acceptHostedSession({
    required String token,
    required String expectedUserId,
    String? preferredSiteId,
    bool Function()? shouldCommit,
  }) async {
    final generation = _sessionGeneration;
    final candidate = await _validateIdentitySession(token);
    if (candidate == null || candidate.user.id != expectedUserId)
      throw StateError('Sign-in is no longer valid');
    if (_signingOut ||
        generation != _sessionGeneration ||
        (shouldCommit != null && !shouldCommit()))
      return;
    final previous = _session;
    await _persistSession(candidate, generation: generation);
    if (generation != _sessionGeneration) return;
    if (_signingOut || (shouldCommit != null && !shouldCommit())) {
      if (previous != null && !_signingOut) {
        await _persistSession(previous);
      } else {
        await _clearSession();
      }
      return;
    }
    verificationUnavailable = false;
    _sessionGeneration++;
    accountTransition = false;
    privateContextVersion++;
    this.preferredSiteId = preferredSiteId;
    needsStoreSelection = true;
    _session = candidate;
    _emit(AuthChangeEvent.signedIn);
    notifyListeners();
  }

  Future<MerchantSessionUser?> signInWithPassword(
    String email,
    String password, {
    String? turnstileToken,
    String? mfaCode,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final csrf = await _fetchCsrfCookie();
    final response = await _postIdentityJson(
      '/api/auth/login',
      csrf: csrf,
      body: {
        'email': normalizedEmail,
        'password': password,
        if (mfaCode != null && mfaCode.trim().isNotEmpty)
          'mfaCode': mfaCode.trim(),
        'turnstileToken': await _requireTurnstileToken(turnstileToken),
      },
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 403 &&
          _decodeBody(response)['mfaRequired'] == true)
        throw const MerchantMfaRequiredException();
      throw Exception(_errorMessage(response, 'Invalid email or password'));
    }

    final token = _extractCookie(response, _sessionCookieName);
    if (token == null || token.isEmpty) {
      throw Exception('Identity platform did not return lb_session');
    }

    final session = await _validateIdentitySession(token);
    if (session == null) throw StateError('Sign-in is no longer valid');
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
    String? otp,
    String? turnstileToken,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    if (otp == null || otp.trim().isEmpty) {
      await requestSignUpOtp(normalizedEmail, turnstileToken: turnstileToken);
      return null;
    }

    await verifySignUpOtp(normalizedEmail, otp.trim());
    final session = await _setVerifiedPassword(
      normalizedEmail,
      password,
      name: name,
    );
    await _persistSession(session);
    _session = session;
    _emit(AuthChangeEvent.signedIn);
    notifyListeners();
    return session.user;
  }

  Future<PendingMerchantSignUp> requestSignUpOtp(
    String email, {
    String? turnstileToken,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final csrf = await _fetchCsrfCookie();
    final signupResponse = await _postIdentityJson(
      '/api/auth/signup',
      csrf: csrf,
      body: {
        'email': normalizedEmail,
        'turnstileToken': await _requireTurnstileToken(turnstileToken),
      },
    );

    if (signupResponse.statusCode < 200 || signupResponse.statusCode >= 300) {
      throw Exception(
        _errorMessage(signupResponse, 'Unable to create account'),
      );
    }

    final body = _decodeBody(signupResponse);
    return PendingMerchantSignUp(
      email: normalizedEmail,
      message:
          _nullableString(body['message']) ??
          'Verification code sent to your email',
      needsVerification: body['needsVerification'] != false,
    );
  }

  Future<void> verifySignUpOtp(String email, String otp) async {
    final normalizedEmail = email.trim().toLowerCase();
    final csrf = _csrfFromJar() ?? await _fetchCsrfCookie();
    final response = await _postIdentityJson(
      '/api/auth/verify-otp',
      csrf: csrf,
      body: {'email': normalizedEmail, 'otp': otp.trim()},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_errorMessage(response, 'Invalid verification code'));
    }
  }

  Future<MerchantSession> _setVerifiedPassword(
    String email,
    String password, {
    String? name,
  }) async {
    final csrf = _csrfFromJar() ?? await _fetchCsrfCookie();
    final response = await _postIdentityJson(
      '/api/auth/set-password',
      csrf: csrf,
      body: {'password': password, if (name != null) 'name': name},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_errorMessage(response, 'Unable to set password'));
    }

    final token = _extractCookie(response, _sessionCookieName);
    if (token == null || token.isEmpty) {
      throw Exception('Identity platform did not return lb_session');
    }

    final session = await _validateIdentitySession(token);
    if (session == null) throw StateError('Sign-in is no longer valid');
    return session;
  }

  Future<void> resetPassword(String email, {String? turnstileToken}) async {
    final csrf = await _fetchCsrfCookie();
    final response = await _postIdentityJson(
      '/api/auth/send-reset',
      csrf: csrf,
      body: {
        'email': email.trim().toLowerCase(),
        'turnstileToken': await _requireTurnstileToken(turnstileToken),
      },
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

  Future<void> Function()? beforeSignOut;

  Future<void> signOut() async {
    if (_signingOut) return;
    _signingOut = true;
    _sessionGeneration++;
    setAccountTransition(true);
    final token =
        _session?.token ?? await _secureStorage.read(key: _sessionTokenKey);
    try {
      await beforeSignOut?.call();
    } catch (_) {
      debugPrint('Notification cleanup unavailable during sign-out.');
    }
    await _clearSession();
    _emit(AuthChangeEvent.signedOut);
    notifyListeners();
    if (token != null && token.isNotEmpty) {
      try {
        final request = http.Request('POST', _identityUri('/api/auth/logout'))
          ..followRedirects = false
          ..headers['Authorization'] = 'Bearer $token';
        final response = await http.Response.fromStream(await _http.send(request))
            .timeout(const Duration(seconds: 15));
        lastLogoutRevocationConfirmed = response.statusCode == 200;
      } catch (error) {
        lastLogoutRevocationConfirmed = false;
      }
    }

    _signingOut = false;
    notifyListeners();
  }

  Future<bool> refreshSession() async {
    if (_signingOut) return false;
    final generation = _sessionGeneration;
    final token =
        _session?.token ?? await _secureStorage.read(key: _sessionTokenKey);
    if (token == null || token.isEmpty) {
      await _clearSession();
      _emit(AuthChangeEvent.signedOut);
      notifyListeners();
      return false;
    }

    try {
      final validatedSession = await _validateIdentitySession(token);
      if (generation != _sessionGeneration || _signingOut) return false;
      verificationUnavailable = false;
      if (validatedSession != null) {
        await _persistSession(validatedSession, generation: generation);
        if (generation != _sessionGeneration || _signingOut) return false;
        _session = validatedSession;
        _emit(AuthChangeEvent.tokenRefreshed);
        notifyListeners();
        return true;
      }
      await _clearSession();
      _emit(AuthChangeEvent.sessionExpired);
    } on SessionVerificationUnavailableException {
      if (generation != _sessionGeneration || _signingOut) return false;
      _session = null;
      verificationUnavailable = true;
      _emit(AuthChangeEvent.verificationUnavailable);
    }
    notifyListeners();
    return false;
  }

  Future<bool> handleUnauthorized(ApiException exception) async {
    if (exception.statusCode != 401) return false;
    return refreshSession();
  }

  Future<String> _requireTurnstileToken([String? override]) async {
    final token =
        override?.trim() ?? (await _turnstileTokenProvider?.call())?.trim();
    if (token == null ||
        token.isEmpty ||
        token.startsWith('SKIP_NEEDS_HUMAN_')) {
      throw Exception(
        'Verification is temporarily unavailable. Please try again later.',
      );
    }
    return await _exchangeTurnstileWithBff(token) ?? token;
  }

  Future<String?> _exchangeTurnstileWithBff(String token) async {
    final baseUrl = _mobileBffBaseUrl;
    if (baseUrl == null || baseUrl.isEmpty) return null;

    try {
      final response = await _http.post(
        Uri.parse('$baseUrl/auth/mobile/turnstile/verify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'token': token}),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final payload = _decodeBody(response);
        final verification = payload['verification'];
        final proofToken = verification is Map<String, dynamic>
            ? verification['proof_token']?.toString().trim()
            : null;
        if (proofToken != null && proofToken.isNotEmpty) return proofToken;
        throw Exception('Mobile verification proof was not returned');
      }
      throw Exception(_errorMessage(response, 'Mobile verification failed'));
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('SocketException') ||
          msg.contains('Failed host lookup') ||
          msg.contains('ClientException')) {
        throw Exception(
          'Unable to reach server. Please check your internet connection.',
        );
      }
      rethrow;
    }
  }

  Future<String> _fetchCsrfCookie() async {
    final existing = _csrfFromJar();
    if (existing != null && existing.isNotEmpty) return existing;

    try {
      final response = await _http.get(_identityUri('/login'));
      _storeResponseCookies(response);
    } catch (_) {
      // Fall through to cookie extraction / synthetic generation.
    }

    var csrf = _csrfFromJar();
    if (csrf == null || csrf.isEmpty) {
      csrf = _generateClientCsrfToken();
      _identityCookies[_csrfCookieName] = csrf;
    }
    return csrf;
  }

  String _generateClientCsrfToken() {
    final now = DateTime.now().microsecondsSinceEpoch;
    return 'mob_csrf_${now.toRadixString(16)}';
  }

  Future<http.Response> _postIdentityJson(
    String path, {
    required String csrf,
    required Map<String, Object?> body,
  }) async {
    final response = await _http.post(
      _identityUri(path),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        'Cookie': _cookieHeader(extra: {_csrfCookieName: csrf}),
      },
      body: jsonEncode(body),
    );
    _storeResponseCookies(response);
    return response;
  }

  Future<MerchantSession?> _validateIdentitySession(String token) async {
    try {
      final request = http.Request('GET', _identityUri('/api/auth/session'))
        ..headers['Authorization'] = 'Bearer $token'
        ..followRedirects = false;
      final response = await http.Response.fromStream(
        await _http.send(request),
      ).timeout(const Duration(seconds: 15));
      if (response.statusCode == 401 || response.statusCode == 403) return null;
      if (response.statusCode != 200)
        throw const SessionVerificationUnavailableException();
      final body = _decodeBody(response);
      if (body['authenticated'] == false) return null;
      if (body['authenticated'] != true || body['user'] is! Map)
        throw const SessionVerificationUnavailableException();
      final user = MerchantSessionUser.fromJson(
        Map<String, dynamic>.from(body['user'] as Map),
      );
      if (user.id.isEmpty || user.email.isEmpty)
        throw const SessionVerificationUnavailableException();
      return MerchantSession(
        token: body['rotated_session_token'] is String
            ? body['rotated_session_token'] as String
            : token,
        user: user,
        expiresAt: _parseDateTime(body['expires_at'] ?? body['expiresAt']),
      );
    } on SessionVerificationUnavailableException {
      rethrow;
    } catch (_) {
      throw const SessionVerificationUnavailableException();
    }
  }

  String? _csrfFromJar() =>
      _identityCookies[_csrfCookieName] ??
      _identityCookies['__Host-letbuyy_csrf'] ??
      _identityCookies['lb_csrf'];

  String _cookieHeader({Map<String, String> extra = const {}}) {
    final cookies = <String, String>{..._identityCookies, ...extra};
    return cookies.entries
        .where((entry) => entry.value.isNotEmpty)
        .map((entry) => '${entry.key}=${entry.value}')
        .join('; ');
  }

  void _storeResponseCookies(http.Response response) {
    final header = response.headers['set-cookie'];
    if (header == null || header.isEmpty) return;

    final matches = RegExp(
      r'(^|,\s*)([A-Za-z0-9_.-]+)=([^;,]+)',
    ).allMatches(header);
    for (final match in matches) {
      final name = match.group(2);
      final value = match.group(3);
      if (name != null && value != null) {
        _identityCookies[name] = value;
      }
    }
  }

  Future<void> _persistSession(MerchantSession session, {int? generation}) {
    final expected = generation ?? _sessionGeneration;
    final operation = _sessionWrites.catchError((Object _) {}).then((_) async {
      if (expected != _sessionGeneration) return;
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
      } else {
        await _secureStorage.delete(key: _sessionExpiresAtKey);
      }
    });
    _sessionWrites = operation;
    return operation;
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

  Future<DateTime?> _readStoredExpiresAt() async {
    return _parseDateTime(await _secureStorage.read(key: _sessionExpiresAtKey));
  }

  Future<void> _clearSession() async {
    _sessionGeneration++;
    _session = null;
    verificationUnavailable = false;
    accountTransition = false;
    privateContextVersion++;
    _identityCookies.clear();
    preferredSiteId = null;
    needsStoreSelection = false;
    final operation = _sessionWrites.catchError((Object _) {}).then((_) async {
      await _secureStorage.delete(key: _sessionTokenKey);
      await _secureStorage.delete(key: _sessionUserKey);
      await _secureStorage.delete(key: _sessionExpiresAtKey);
    });
    _sessionWrites = operation;
    await operation;
  }

  bool _isExpired(DateTime? expiresAt) {
    if (expiresAt == null) return false;
    return !expiresAt.isAfter(DateTime.now().add(const Duration(minutes: 2)));
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

DateTime? _parseDateTime(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim());
}
