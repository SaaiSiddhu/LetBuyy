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
  sessionUnavailable,
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

class MerchantIdentityUnavailableException extends SessionVerificationUnavailableException {
  const MerchantIdentityUnavailableException();
  @override
  String toString() => 'Sign-in is temporarily unavailable. Please retry.';
}

class MerchantAuthSupersededException implements Exception {
  const MerchantAuthSupersededException();
  @override
  String toString() => 'This sign-in attempt is no longer current.';
}

class StoreAuthService extends ChangeNotifier {
  StoreAuthService({
    required ApiClient api,
    required String identityBaseUrl,
    String? mobileBffBaseUrl,
    TurnstileTokenProvider? turnstileTokenProvider,
    FlutterSecureStorage? secureStorage,
    http.Client? httpClient,
    String sessionCookieName = 'lb_session',
    String csrfCookieName = 'letbuyy_csrf',
  }) : _api = api,
       _sessionCookieName = sessionCookieName,
       _csrfCookieName = csrfCookieName,
       _identityBaseUrl = _trimTrailingSlash(identityBaseUrl),
       _mobileBffBaseUrl = mobileBffBaseUrl == null
           ? null
           : _trimTrailingSlash(mobileBffBaseUrl),
       _turnstileTokenProvider = turnstileTokenProvider,
       _secureStorage = secureStorage ?? const FlutterSecureStorage(),
       _http = httpClient ?? http.Client() {
    if (!const {
          'lb_session',
          'lb_session_staging',
        }.contains(sessionCookieName) ||
        csrfCookieName !=
            (sessionCookieName == 'lb_session_staging'
                ? 'letbuyy_csrf_staging'
                : 'letbuyy_csrf')) {
      throw ArgumentError('Merchant session and CSRF namespaces must match.');
    }
  }

  String get _sessionTokenKey => _sessionCookieName;
  String get _sessionUserKey => '${_sessionCookieName}_user';
  String get _sessionExpiresAtKey => '${_sessionCookieName}_expires_at';
  final String _csrfCookieName;
  final String _sessionCookieName;

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
  bool accountTransition = false;
  bool _signingOut = false;
  bool? lastLogoutRevocationConfirmed;
  int privateContextVersion = 0;
  String? preferredSiteId;
  bool needsStoreSelection = false;
  bool get verificationUnavailable => _sessionRecoveryPending;
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
  String? get accessToken => accountTransition || _signingOut ? null : _session?.token;
  DateTime? get sessionExpiresAt => _session?.expiresAt;
  Stream<AuthState> get authStateChanges => _authEvents.stream;
  bool _sessionRecoveryPending = false;
  bool get hasSessionRecovery => _sessionRecoveryPending;
  int _authEpoch = 0;
  bool _disposed = false;
  Future<void> _storageTail = Future<void>.value();
  bool _isCurrent(int epoch) => !_disposed && epoch == _authEpoch;

  // Order encrypted writes with sign-out. A late validation or interrupted write
  // must never resurrect a retired account, including after process restart.
  Future<bool> _writeStorage(int epoch, Future<void> Function() write) {
    final operation = _storageTail.then((_) async {
      if (!_isCurrent(epoch)) return false;
      await write();
      return _isCurrent(epoch);
    });
    _storageTail = operation.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return operation;
  }

  Future<void> restoreSession() async {
    final epoch = ++_authEpoch;
    final token = await _secureStorage.read(key: _sessionTokenKey);
    if (!_isCurrent(epoch)) return;
    if (token == null || token.isEmpty) {
      _emit(AuthChangeEvent.signedOut);
      return;
    }

    await _recoverSession(token, AuthChangeEvent.initialSession, epoch);
  }

  Future<void> acceptHostedSession({
    required String token,
    required String expectedUserId,
    String? preferredSiteId,
    bool Function()? shouldCommit,
  }) async {
    final epoch = ++_authEpoch;
    final candidate = await _validateIdentitySession(token);
    if (candidate == null || candidate.user.id != expectedUserId)
      throw StateError('Sign-in is no longer valid');
    if (_signingOut ||
        !_isCurrent(epoch) ||
        (shouldCommit != null && !shouldCommit()))
      return;
    final previous = _session;
    await _persistSession(candidate, epoch);
    if (!_isCurrent(epoch)) return;
    if (_signingOut || (shouldCommit != null && !shouldCommit())) {
      if (previous != null && !_signingOut) {
        await _persistSession(previous, epoch);
      } else {
        await _clearSession(epoch);
      }
      return;
    }
    _sessionRecoveryPending = false;
    _authEpoch++;
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
    final epoch = ++_authEpoch;
    final normalizedEmail = email.trim().toLowerCase();
    final csrf = await _fetchCsrfCookie();
    final proof = await _requireTurnstileToken(turnstileToken);
    if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();
    final response = await _postIdentityJson(
      '/api/auth/login',
      csrf: csrf,
      body: {
        'email': normalizedEmail,
        'password': password,
        if (mfaCode != null && mfaCode.trim().isNotEmpty)
          'mfaCode': mfaCode.trim(),
        'turnstileToken': proof,
      },
    );
    if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();

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

    return (await _acceptIdentityToken(token, epoch)).user;
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

    final epoch = ++_authEpoch;
    await verifySignUpOtp(normalizedEmail, otp.trim());
    if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();
    final token = await _setVerifiedPassword(password, name: name);
    return (await _acceptIdentityToken(token, epoch)).user;
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

  Future<String> _setVerifiedPassword(String password, {String? name}) async {
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

    return token;
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
    setAccountTransition(true);
    final epoch = ++_authEpoch;
    final token =
        _session?.token ??
        _identityCookies[_sessionCookieName] ??
        await _secureStorage.read(key: _sessionTokenKey);
    if (!_isCurrent(epoch)) return;
    _session = null;
    _sessionRecoveryPending = false;
    _identityCookies.clear();
    _emit(AuthChangeEvent.signedOut);
    notifyListeners();
    try {
      await _clearSession(epoch);
    } finally {
      try {
        await beforeSignOut?.call();
      } catch (_) {
        debugPrint('Notification cleanup unavailable during sign-out.');
      }
      if (token != null && token.isNotEmpty) {
        try {
          final request = http.Request('POST', _identityUri('/api/auth/logout'))
            ..followRedirects = false
            ..headers['Authorization'] = 'Bearer $token';
          final response = await http.Response.fromStream(await _http.send(request))
              .timeout(const Duration(seconds: 20));
          lastLogoutRevocationConfirmed = response.statusCode == 200;
        } catch (_) {
          lastLogoutRevocationConfirmed = false;
        }
      }
      _signingOut = false;
      notifyListeners();
    }
  }

  Future<bool> refreshSession() async {
    final epoch = ++_authEpoch;
    final token =
        _session?.token ?? await _secureStorage.read(key: _sessionTokenKey);
    if (!_isCurrent(epoch)) return false;
    if (token == null || token.isEmpty) {
      await _clearSession(epoch);
      if (!_isCurrent(epoch)) return false;
      _emit(AuthChangeEvent.signedOut);
      notifyListeners();
      return false;
    }

    return await _recoverSession(
          token,
          AuthChangeEvent.tokenRefreshed,
          epoch,
        ) !=
        null;
  }

  Future<MerchantSession> _acceptIdentityToken(String token, int epoch) async {
    // A successful password/OTP response proves a token was issued, not that a
    // complete current user was read. Retain only that token until confirmation.
    final saved = await _writeStorage(epoch, () async {
      await _secureStorage.delete(key: _sessionUserKey);
      await _secureStorage.delete(key: _sessionExpiresAtKey);
      await _secureStorage.write(key: _sessionTokenKey, value: token);
    });
    if (!saved) throw const MerchantAuthSupersededException();
    final session = await _recoverSession(
      token,
      AuthChangeEvent.signedIn,
      epoch,
    );
    if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();
    if (session != null) return session;
    if (hasSessionRecovery) throw const MerchantIdentityUnavailableException();
    throw Exception('This sign-in is no longer valid. Please sign in again.');
  }

  Future<MerchantSession?> _recoverSession(
    String token,
    AuthChangeEvent event,
    int epoch,
  ) async {
    MerchantSession? validated;
    try {
      validated = await _validateIdentitySession(token);
    } on MerchantIdentityUnavailableException {
      if (!_isCurrent(epoch)) return null;
      _session = null;
      _sessionRecoveryPending = true;
      _emit(AuthChangeEvent.sessionUnavailable);
      notifyListeners();
      return null;
    }
    if (!_isCurrent(epoch)) return null;
    if (validated == null) {
      await _clearSession(epoch);
      if (!_isCurrent(epoch)) return null;
      _emit(AuthChangeEvent.sessionExpired);
      notifyListeners();
      return null;
    }
    if (!await _persistSession(validated, epoch)) return null;
    _session = validated;
    _sessionRecoveryPending = false;
    _emit(event);
    notifyListeners();
    return validated;
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
    final epoch = _authEpoch;
    final existing = _csrfFromJar();
    if (existing != null && existing.isNotEmpty) return existing;

    try {
      final response = await _http.get(_identityUri('/login'));
      if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();
      _storeResponseCookies(response);
    } catch (_) {
      // Fall through to cookie extraction / synthetic generation.
    }
    if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();

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
    final epoch = _authEpoch;
    final response = await _http.post(
      _identityUri(path),
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        'Cookie': _cookieHeader(extra: {_csrfCookieName: csrf}),
      },
      body: jsonEncode(body),
    );
    if (!_isCurrent(epoch)) throw const MerchantAuthSupersededException();
    // Protection redirects/HTML and server failures do not mean the entered
    // password is wrong. Never pass an infrastructure page into login handling.
    if (response.statusCode >= 300 && response.statusCode < 400 ||
        response.statusCode >= 500) {
      throw const MerchantIdentityUnavailableException();
    }
    try {
      if (jsonDecode(response.body) is! Map)
        throw const MerchantIdentityUnavailableException();
    } catch (_) {
      throw const MerchantIdentityUnavailableException();
    }
    _storeResponseCookies(response);
    return response;
  }

  Future<MerchantSession?> _validateIdentitySession(String token) async {
    try {
      final request = http.Request('GET', _identityUri('/api/auth/session'))
        ..headers['Authorization'] = 'Bearer $token'
        ..followRedirects = false;
      final response = await http.Response.fromStream(await _http.send(request))
          .timeout(const Duration(seconds: 20));
      final body = _decodeBody(response);
      // An HTML protection/login page, timeout or 5xx is not revocation. Only
      // an explicit Identity denial may retire the original encrypted token.
      if ((response.statusCode == 401 || response.statusCode == 403) &&
          body['authenticated'] == false)
        return null;
      if (response.statusCode != 200)
        throw const MerchantIdentityUnavailableException();
      if (body['authenticated'] == false) return null;
      if (body['authenticated'] != true || body['user'] is! Map) {
        throw const MerchantIdentityUnavailableException();
      }

      final user = MerchantSessionUser.fromJson(
        Map<String, dynamic>.from(body['user'] as Map),
      );
      if (user.id.trim().isEmpty || user.email.trim().isEmpty) {
        throw const MerchantIdentityUnavailableException();
      }
      return MerchantSession(
        token: body['rotated_session_token'] is String ? body['rotated_session_token'] as String : _extractCookie(response, _sessionCookieName) ?? token,
        user: user,
        expiresAt: _parseDateTime(body['expires_at'] ?? body['expiresAt']),
      );
    } catch (_) {
      throw const MerchantIdentityUnavailableException();
    }
  }

  String? _csrfFromJar() => _sessionCookieName == 'lb_session_staging'
      ? (_identityCookies[_csrfCookieName] ??
            _identityCookies['lb_csrf_staging'])
      : (_identityCookies[_csrfCookieName] ??
            _identityCookies['__Host-letbuyy_csrf'] ??
            _identityCookies['lb_csrf']);

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

  Future<bool> _persistSession(MerchantSession session, int epoch) =>
      _writeStorage(epoch, () async {
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

  Future<void> _clearSession(int epoch) async {
    if (!_isCurrent(epoch)) return;
    _session = null;
    _sessionRecoveryPending = false;
    accountTransition = false;
    privateContextVersion++;
    preferredSiteId = null;
    needsStoreSelection = false;
    _identityCookies.clear();
    await _writeStorage(epoch, () async {
      await _secureStorage.delete(key: _sessionTokenKey);
      await _secureStorage.delete(key: _sessionUserKey);
      await _secureStorage.delete(key: _sessionExpiresAtKey);
    });
  }

  Uri _identityUri(String path) => Uri.parse('$_identityBaseUrl$path');

  void _emit(AuthChangeEvent event) {
    if (!_authEvents.isClosed) {
      _authEvents.add(AuthState(event: event, session: _session));
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _authEpoch++;
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
