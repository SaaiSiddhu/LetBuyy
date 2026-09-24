// APPID-P4d — the marketplace app's half of signing in with a LetBuyy account: an authorization code
// with PKCE (RFC 7636) from identity-platform, opened in the system browser (RFC 8252), exchanged for
// a platform buyer session (D-ONE-IDENTITY, migration 259).
//
// Pure Dart and transport only. The app supplies the browser, the callback listener and the
// platform-protected storage; this file decides what a sign-in request is, which callback it will
// accept, and how a code becomes a session.
//
// What the app never holds: a client secret (it is a public client, RFC 8252 §8.5), or the buyer's
// password (typed into identity-platform's own page, never a web view the app controls). What binds a
// code to this attempt: the PKCE verifier, generated here, kept in protected storage while the browser
// is open and sent only to identity-platform's token endpoint; and the state, which must come back
// unchanged. The code itself lives 60 seconds and is burned on first use, by the database. No nonce:
// that is an OpenID Connect ID-token binding, and this flow issues no ID token; PKCE and state are
// what RFC 8252 requires of it.

import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

import 'api_client.dart';
import 'types.dart';

/// The app's first-party client id, and its one callback: the published applicationId as a
/// private-use scheme (RFC 8252 §7.1). Both must match auth-core's constants exactly.
const String letbuyyMarketplaceAppClientId = 'letbuyy-marketplace-app';
const String letbuyyMarketplaceAppCallbackScheme = 'com.letbuyy.letbuyy';
const String letbuyyMarketplaceAppCallbackPath = '/oauth/callback';
const String letbuyyMarketplaceAppRedirectUri = '$letbuyyMarketplaceAppCallbackScheme:$letbuyyMarketplaceAppCallbackPath';

/// The header the gateway reads a platform buyer session from.
const String letbuyyBuyerSessionHeader = 'X-LetBuyy-Buyer-Session';

final RegExp _base64UrlToken = RegExp(r'^[A-Za-z0-9_-]{43}$');

/// The S256 code challenge for [verifier] (RFC 7636 §4.2): base64url(SHA-256(verifier)), unpadded.
String pkceS256Challenge(String verifier) => _unpadded(base64Url.encode(sha256.convert(ascii.encode(verifier)).bytes));

String _unpadded(String value) => value.replaceAll('=', '');

String _randomToken(Random random) {
  final bytes = List<int>.generate(32, (_) => random.nextInt(256));
  return _unpadded(base64Url.encode(bytes));
}

/// Compares two strings without stopping at the first difference.
bool _constantTimeEquals(String a, String b) {
  if (a.length != b.length) return false;
  var difference = 0;
  for (var i = 0; i < a.length; i++) {
    difference |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return difference == 0;
}

/// One sign-in attempt, from opening the browser to the callback. Persisted in protected storage
/// while the browser is open, so an attempt survives the app being stopped in the background.
class PendingBuyerSignIn {
  const PendingBuyerSignIn({required this.state, required this.codeVerifier, required this.startedAt});

  final String state;
  final String codeVerifier;
  final DateTime startedAt;

  /// Long enough to create an account or reset a password in the browser; short enough that an
  /// abandoned attempt does not linger. The code identity-platform issues lives 60 seconds anyway.
  static const Duration maxAge = Duration(minutes: 15);

  /// Expired, or started in the future (a clock set back is not trusted to extend an attempt).
  bool isExpired(DateTime now) => now.isAfter(startedAt.add(maxAge)) || startedAt.isAfter(now.add(const Duration(minutes: 5)));

  Map<String, Object> toJson() => {
        'v': 1,
        'state': state,
        'code_verifier': codeVerifier,
        'started_at': startedAt.toUtc().toIso8601String(),
      };

  /// Null for anything that is not exactly what [toJson] wrote.
  static PendingBuyerSignIn? fromJson(Object? json) {
    if (json is! Map || json['v'] != 1) return null;
    final state = json['state'];
    final verifier = json['code_verifier'];
    final startedAt = json['started_at'] is String ? DateTime.tryParse(json['started_at'] as String) : null;
    if (state is! String || !_base64UrlToken.hasMatch(state)) return null;
    if (verifier is! String || !_base64UrlToken.hasMatch(verifier)) return null;
    if (startedAt == null) return null;
    return PendingBuyerSignIn(state: state, codeVerifier: verifier, startedAt: startedAt);
  }
}

/// What a callback means for the attempt it claims to answer.
sealed class BuyerSignInCallback {
  const BuyerSignInCallback();
}

/// The browser came back with a code for this attempt.
final class BuyerSignInCode extends BuyerSignInCallback {
  const BuyerSignInCode(this.code);
  final String code;
}

/// The buyer declined at identity-platform.
final class BuyerSignInDeclined extends BuyerSignInCallback {
  const BuyerSignInDeclined();
}

/// Not an answer to this attempt: another address, a changed state, an expired attempt, or a
/// malformed or doubled parameter. Nothing in it is used.
final class BuyerSignInRejected extends BuyerSignInCallback {
  const BuyerSignInRejected(this.reason);
  final String reason;
}

/// A platform buyer session, for the gateway's buyer routes.
class BuyerSessionGrant {
  const BuyerSessionGrant({required this.accessToken, required this.expiresAt});
  final String accessToken;
  final DateTime expiresAt;
}

enum BuyerSignInFailure {
  /// The code was refused: spent, expired, or not for this verifier. Start again.
  invalidGrant,

  /// identity-platform could not answer. Try again shortly.
  unavailable,

  /// No connection.
  network,
}

class BuyerSignInException implements Exception {
  const BuyerSignInException(this.failure);
  final BuyerSignInFailure failure;

  @override
  String toString() => 'BuyerSignInException(${failure.name})';
}

/// The protocol: begin an attempt, build the address to open, read the callback, exchange the code.
class BuyerSignInClient {
  BuyerSignInClient({required String identityBaseUrl, Dio? dio, Random? random, DateTime Function()? clock})
      : _identity = _identityOrigin(identityBaseUrl),
        _dio = dio ?? Dio(),
        _random = random ?? Random.secure(),
        _clock = clock ?? DateTime.now {
    _dio.options
      ..connectTimeout = const Duration(seconds: 15)
      ..receiveTimeout = const Duration(seconds: 15)
      ..followRedirects = false
      ..validateStatus = (_) => true;
  }

  final Uri _identity;
  final Dio _dio;
  final Random _random;
  final DateTime Function() _clock;

  /// identity-platform's origin: https, or http only on this machine's own loopback for development,
  /// where the emulator reaches it through `adb reverse`. A verifier never travels in the clear.
  static Uri _identityOrigin(String value) {
    final uri = Uri.tryParse(value.trim());
    final loopback = uri != null && (uri.host == 'localhost' || uri.host == '127.0.0.1');
    if (uri == null || uri.host.isEmpty || !(uri.scheme == 'https' || (uri.scheme == 'http' && loopback))) {
      throw ArgumentError('identity-platform must be an https origin');
    }
    if (uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment || (uri.path.isNotEmpty && uri.path != '/')) {
      throw ArgumentError('identity-platform must be an origin, with no path, query or credentials');
    }
    return Uri(scheme: uri.scheme, host: uri.host, port: uri.hasPort ? uri.port : null);
  }

  /// A new attempt, with a fresh state and verifier from a secure random source.
  PendingBuyerSignIn begin() => PendingBuyerSignIn(
        state: _randomToken(_random),
        codeVerifier: _randomToken(_random),
        startedAt: _clock().toUtc(),
      );

  /// The address to open in the system browser.
  Uri authorizationUrl(PendingBuyerSignIn pending) => _identity.replace(
        path: '/buyer/authorize',
        queryParameters: {
          'response_type': 'code',
          'client_id': letbuyyMarketplaceAppClientId,
          'redirect_uri': letbuyyMarketplaceAppRedirectUri,
          'state': pending.state,
          'code_challenge': pkceS256Challenge(pending.codeVerifier),
          'code_challenge_method': 'S256',
        },
      );

  /// Whether [callback] answers [pending], and how. Anything that is not exactly the app's callback,
  /// carrying exactly one state equal to this attempt's, is rejected, and nothing in it is used.
  BuyerSignInCallback readCallback(Uri callback, PendingBuyerSignIn pending) {
    if (callback.scheme != letbuyyMarketplaceAppCallbackScheme || callback.hasAuthority) {
      return const BuyerSignInRejected('not the app callback');
    }
    if (callback.path != letbuyyMarketplaceAppCallbackPath || callback.hasFragment) {
      return const BuyerSignInRejected('not the app callback');
    }
    if (pending.isExpired(_clock().toUtc())) return const BuyerSignInRejected('the attempt expired');

    final Map<String, List<String>> params;
    try {
      params = callback.queryParametersAll;
    } on FormatException {
      return const BuyerSignInRejected('malformed callback');
    } on ArgumentError {
      return const BuyerSignInRejected('malformed callback');
    }
    for (final entry in params.entries) {
      if (entry.value.length != 1) return const BuyerSignInRejected('a parameter was given twice');
    }
    final state = params['state']?.single;
    if (state == null || !_constantTimeEquals(state, pending.state)) {
      return const BuyerSignInRejected('the state does not match');
    }
    final error = params['error']?.single;
    if (error != null) {
      return error == 'access_denied' ? const BuyerSignInDeclined() : BuyerSignInRejected('identity-platform: $error');
    }
    final code = params['code']?.single;
    if (code == null || !_base64UrlToken.hasMatch(code)) return const BuyerSignInRejected('no valid code');
    return BuyerSignInCode(code);
  }

  /// Exchanges [code] and this attempt's verifier for a platform buyer session. Throws
  /// [BuyerSignInException]; a refused code is [BuyerSignInFailure.invalidGrant] whatever the reason.
  Future<BuyerSessionGrant> exchange(String code, PendingBuyerSignIn pending) async {
    final Response<Object?> response;
    try {
      response = await _dio.post<Object?>(
        _identity.replace(path: '/api/buyer/oauth/token').toString(),
        data: {
          'grant_type': 'authorization_code',
          'code': code,
          'code_verifier': pending.codeVerifier,
          'client_id': letbuyyMarketplaceAppClientId,
          'redirect_uri': letbuyyMarketplaceAppRedirectUri,
        },
        options: Options(contentType: Headers.formUrlEncodedContentType, responseType: ResponseType.json),
      );
    } on DioException {
      throw const BuyerSignInException(BuyerSignInFailure.network);
    }

    final status = response.statusCode ?? 0;
    final body = response.data;
    if (status == 400 && body is Map && body['error'] == 'invalid_grant') {
      throw const BuyerSignInException(BuyerSignInFailure.invalidGrant);
    }
    if (status != 200 || body is! Map) throw const BuyerSignInException(BuyerSignInFailure.unavailable);

    final accessToken = body['access_token'];
    final tokenType = body['token_type'];
    final expiresIn = body['expires_in'];
    if (accessToken is! String || accessToken.isEmpty || tokenType is! String || tokenType.toLowerCase() != 'bearer') {
      throw const BuyerSignInException(BuyerSignInFailure.unavailable);
    }
    if (expiresIn is! int || expiresIn <= 0) throw const BuyerSignInException(BuyerSignInFailure.unavailable);
    return BuyerSessionGrant(accessToken: accessToken, expiresAt: _clock().toUtc().add(Duration(seconds: expiresIn)));
  }
}

/// The buyer, as the gateway shows them to themselves.
class BuyerAccount {
  const BuyerAccount({required this.id, required this.email, required this.emailVerified});

  final String id;
  final String email;
  final bool emailVerified;

  static BuyerAccount? fromJson(Object? json) {
    if (json is! Map) return null;
    final id = json['id'];
    final email = json['email'];
    if (id is! String || email is! String) return null;
    return BuyerAccount(id: id, email: email, emailVerified: json['email_verified'] == true);
  }
}

/// What linking the app's Firebase user to the buyer came to.
enum FirebaseLinkResult { linked, alreadyLinked, notVerified, emailMismatch, conflict, noVerifiedFirebaseEmail, unavailable, refused }

/// The gateway's buyer routes the app calls with its platform buyer session.
class BuyerAccountApi {
  BuyerAccountApi(this._client);

  final ApiClient _client;

  ApiRequestOptions _session(String sessionToken) =>
      ApiRequestOptions(headers: {letbuyyBuyerSessionHeader: sessionToken});

  /// Who the session is. A 401 or 403 [ApiException] means the session has ended: expired, signed out
  /// everywhere, a reset password, or a disabled account.
  Future<BuyerAccount> account(String sessionToken) async {
    final body = asJsonMap(await _client.get('/storefront/buyer/account', options: _session(sessionToken)));
    final data = body['data'];
    final account = BuyerAccount.fromJson(data is Map ? data['buyer'] : null);
    if (account == null) {
      throw const ApiException(message: 'Unexpected account response.', statusCode: 502, code: 'INVALID_RESPONSE');
    }
    return account;
  }

  /// Records which Firebase user this buyer is, for the move off Firebase. Never throws for a refusal;
  /// a 401 still throws, so the caller can treat the session as ended.
  Future<FirebaseLinkResult> linkFirebase(String sessionToken, String firebaseIdToken) async {
    try {
      final body = asJsonMap(await _client.post(
        '/storefront/buyer/firebase-link',
        body: {'id_token': firebaseIdToken},
        options: _session(sessionToken),
      ));
      final data = body['data'];
      final outcome = data is Map ? data['outcome'] : null;
      return outcome == 'already_linked' ? FirebaseLinkResult.alreadyLinked : FirebaseLinkResult.linked;
    } on ApiException catch (error) {
      if (error.statusCode == 401) rethrow;
      return switch (error.code) {
        'EMAIL_NOT_VERIFIED' => FirebaseLinkResult.notVerified,
        'EMAIL_MISMATCH' => FirebaseLinkResult.emailMismatch,
        'FIREBASE_LINK_CONFLICT' => FirebaseLinkResult.conflict,
        'FIREBASE_EMAIL_UNVERIFIED' => FirebaseLinkResult.noVerifiedFirebaseEmail,
        'NETWORK_ERROR' || 'TIMEOUT' => FirebaseLinkResult.unavailable,
        _ when error.statusCode >= 500 => FirebaseLinkResult.unavailable,
        _ => FirebaseLinkResult.refused,
      };
    }
  }
}
