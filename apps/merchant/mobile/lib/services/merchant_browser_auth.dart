import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'authentication_browser.dart';
import '../config/app_config.dart';
import 'merchant_auth_contract.g.dart';
import 'store_auth_service.dart';

enum BrowserAuthStatus {
  idle,
  opening,
  waiting,
  exchanging,
  verifying,
  unavailable,
}

/// One coordinator for warm/cold callbacks, protected PKCE and actor replacement.
class MerchantBrowserAuth extends ChangeNotifier {
  MerchantBrowserAuth({
    required StoreAuthService auth,
    required String identityBaseUrl,
    required this.environment,
    required this.clientId,
    AuthenticationBrowser? browser,
    FlutterSecureStorage? storage,
    http.Client? httpClient,
  }) : _auth = auth,
       _identity = Uri.parse(identityBaseUrl),
       _storageNamespace = AppConfig.persistenceNamespace(
         environmentName: environment,
         identityUrl: Uri.parse(identityBaseUrl).origin,
       ),
       _browser = browser ?? PlatformAuthenticationBrowser(),
       _storage = storage ?? const FlutterSecureStorage(),
       _http = httpClient ?? http.Client() {
    final registered = merchantAuthCallbacks[environment]?['merchant_android'];
    final allowed =
        registered != null &&
        (_identity.origin == Uri.parse(registered).origin ||
            (environment == 'development' &&
                _identity.scheme == 'http' &&
                ['localhost', '127.0.0.1'].contains(_identity.host)));
    if (!allowed ||
        _identity.userInfo.isNotEmpty ||
        _identity.hasQuery ||
        _identity.hasFragment ||
        !['', '/'].contains(_identity.path)) {
      throw ArgumentError(
        'Accounts origin is not registered for this app environment',
      );
    }
  }

  static const pendingKey = 'lb_accounts_pending_v1';
  static const candidateKey = 'lb_accounts_candidate_v1';
  static const _timeout = Duration(seconds: 20);
  final String _storageNamespace;
  String get _pendingStorageKey => '$_storageNamespace$pendingKey';
  String get _candidateStorageKey => '$_storageNamespace$candidateKey';
  final StoreAuthService _auth;
  final Uri _identity;
  final String environment, clientId;
  final AuthenticationBrowser _browser;
  final FlutterSecureStorage _storage;
  final http.Client _http;
  StreamSubscription<String?>? _subscription;
  Map<String, dynamic>? _pending;
  bool _exchanging = false, _starting = false;
  int _generation = 0;
  BrowserAuthStatus status = BrowserAuthStatus.idle;
  String? message;
  bool get busy =>
      status != BrowserAuthStatus.idle &&
      status != BrowserAuthStatus.unavailable;
  String get callbackId =>
      clientId == 'merchant_ios' ? 'ios_session' : 'android_https';
  Uri get callback => Uri.parse(
    merchantAuthCallbacks[environment]?[clientId] ??
        (throw StateError('Unsupported Accounts configuration')),
  );

  static String _secret() => base64UrlEncode(
    List.generate(32, (_) => Random.secure().nextInt(256)),
  ).replaceAll('=', '');
  static String challenge(String verifier) => base64UrlEncode(
    sha256.convert(utf8.encode(verifier)).bytes,
  ).replaceAll('=', '');

  void _state(BrowserAuthStatus value, [String? notice]) {
    status = value;
    message = notice;
    notifyListeners();
  }

  Future<void> initialize() async {
    _subscription ??= _browser.callbacks.listen((url) {
      if (url == null) {
        _browserClosed();
      } else {
        unawaited(handleCallback(url));
      }
    });
    try {
      final raw = await _storage.read(key: _pendingStorageKey);
      if (raw != null)
        _pending = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      if (_pending != null && !_validPending(_pending!)) {
        if (await _storage.read(key: _candidateStorageKey) == null)
          await _cancelRemote();
        await _clearPending();
      }
      if (_pending != null ||
          await _storage.read(key: _candidateStorageKey) != null)
        _auth.setAccountTransition(true);
      final initial = await _browser.initialCallback();
      if (initial != null)
        await handleCallback(initial);
      else if (await _storage.read(key: _candidateStorageKey) != null)
        await retryVerification();
      else if (_pending != null)
        _state(
          BrowserAuthStatus.waiting,
          'Finish sign-in in the secure browser, or cancel and start again.',
        );
    } catch (_) {
      _state(
        BrowserAuthStatus.unavailable,
        'Unable to resume sign-in. Please retry from this device.',
      );
    }
  }

  Timer? _browserCloseTimer;
  void _browserClosed() {
    if (_exchanging || _pending == null) return;
    final generation = _generation;
    _browserCloseTimer?.cancel();
    // Android can report its Custom Tab closed immediately before delivering
    // the return intent. Give that already-dispatched callback one bounded
    // turn to arrive. Explicit Cancel remains immediate and fences the reply.
    _browserCloseTimer = Timer(const Duration(milliseconds: 300), () {
      if (generation == _generation && !_exchanging && _pending != null) {
        unawaited(cancel());
      }
    });
  }

  bool _validPending(Map<String, dynamic> pending) =>
      pending['environment'] == environment &&
      pending['clientId'] == clientId &&
      pending['callbackId'] == callbackId &&
      pending['redirectUri'] == callback.toString() &&
      RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
      ).hasMatch(pending['requestId']?.toString() ?? '') &&
      ['state', 'managementProof'].every(
        (key) => RegExp(
          r'^[A-Za-z0-9_-]{43}$',
        ).hasMatch(pending[key]?.toString() ?? ''),
      ) &&
      pending['verifier'] is String &&
      RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(pending['verifier'] as String) &&
      DateTime.tryParse(
            pending['expiresAt']?.toString() ?? '',
          )?.isAfter(DateTime.now()) ==
          true;

  Future<void> begin(String purpose) async {
    if (_starting || _exchanging || busy) return;
    if (![
      'login',
      'signup',
      'create_store',
      'switch_account',
      'manage_security',
    ].contains(purpose))
      throw ArgumentError('Unsupported account action');
    _starting = true;
    final generation = ++_generation;
    final credential = _auth.accountActionCredential;
    _auth.setAccountTransition(true);
    _state(BrowserAuthStatus.opening);
    try {
      await _cancelRemote();
      await _clearPending();
      await _discardCandidate();
      final verifier = _secret(), state = _secret();
      final response = await _post(
        '/api/auth/mobile/requests',
        headers: {
          'Content-Type': 'application/json',
          if (credential != null) 'Authorization': 'Bearer $credential',
        },
        body: jsonEncode({
          'clientId': clientId,
          'callbackId': callbackId,
          'environment': environment,
          'purpose': purpose,
          'challenge': challenge(verifier),
          'state': state,
        }),
      ).timeout(_timeout);
      final data = _body(response);
      if (response.statusCode != 201)
        throw StateError('Unable to start account action');
      final url = Uri.parse(data['authorizationUrl'] as String);
      if (url.origin != _identity.origin ||
          url.path != '/mobile/authorize' ||
          url.userInfo.isNotEmpty ||
          url.hasQuery)
        throw StateError('Unexpected sign-in origin');
      if (generation != _generation) return;
      _pending = {
        ...data,
        'verifier': verifier,
        'state': state,
        'clientId': clientId,
        'callbackId': callbackId,
        'environment': environment,
        'purpose': purpose,
        'redirectUri': callback.toString(),
      };
      if (!_validPending(_pending!))
        throw StateError('Invalid account request');
      await _storage.write(
        key: _pendingStorageKey,
        value: jsonEncode(_pending),
      );
      _state(
        BrowserAuthStatus.waiting,
        'Complete sign-in in the secure browser.',
      );
      await _browser.open(url, callback.scheme);
    } catch (_) {
      await _cancelRemote();
      await _clearPending();
      _auth.setAccountTransition(false);
      _state(
        BrowserAuthStatus.unavailable,
        'Unable to open secure sign-in. Check your connection and try again.',
      );
    } finally {
      _starting = false;
    }
  }

  static String? callbackCode(
    String raw, {
    required Uri redirect,
    required String requestId,
    required String state,
  }) {
    try {
      final uri = Uri.parse(raw);
      final values = uri.queryParametersAll;
      if (raw.split('?').first != redirect.toString() ||
          uri.scheme != redirect.scheme ||
          uri.host != redirect.host ||
          uri.port != redirect.port ||
          uri.path != redirect.path ||
          uri.userInfo.isNotEmpty ||
          uri.hasFragment ||
          values.length != 3 ||
          values.keys.any(
            (key) => !['request', 'state', 'code'].contains(key),
          ) ||
          values.values.any((value) => value.length != 1) ||
          values['request']?.single != requestId ||
          values['state']?.single != state)
        return null;
      final code = values['code']?.single;
      return code != null && RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(code)
          ? code
          : null;
    } catch (_) {
      return null;
    }
  }

  Future<void> handleCallback(String raw) async {
    if (_exchanging) return;
    final pending = _pending;
    if (pending == null || !_validPending(pending)) return;
    final code = callbackCode(
      raw,
      redirect: callback,
      requestId: pending['requestId'] as String,
      state: pending['state'] as String,
    );
    if (code == null) return;
    _browserCloseTimer?.cancel();
    _exchanging = true;
    final generation = _generation;
    _state(BrowserAuthStatus.exchanging);
    try {
      // Retain only cancellation proof across a crash, never a redeemable verifier.
      // Startup cancels an orphaned exchange instead of replaying its one-use code.
      final cleanup = Map<String, dynamic>.from(pending)..remove('verifier');
      await _storage.write(key: _pendingStorageKey, value: jsonEncode(cleanup));
      final response = await _post(
        '/api/auth/mobile/exchange',
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'requestId': pending['requestId'],
          'state': pending['state'],
          'clientId': clientId,
          'callbackId': callbackId,
          'environment': environment,
          'code': code,
          'verifier': pending['verifier'],
        }),
      ).timeout(_timeout);
      final data = _body(response);
      if (response.statusCode != 200 ||
          data['token'] is! String ||
          data['userId'] is! String ||
          (data['userId'] as String).isEmpty)
        throw StateError('Sign-in was not completed');
      if (generation != _generation) return;
      await _storage.write(key: _candidateStorageKey, value: jsonEncode(data));
      await _clearPending();
      await _browser.close();
      await retryVerification();
    } catch (_) {
      await _cancelRemote();
      await _clearPending();
      _state(
        BrowserAuthStatus.unavailable,
        'Sign-in could not finish. Start again; your browser may remember your account.',
      );
    } finally {
      _exchanging = false;
    }
  }

  Future<void> retryVerification() async {
    final generation = _generation;
    final raw = await _storage.read(key: _candidateStorageKey);
    if (raw == null) {
      _auth.setAccountTransition(false);
      await _auth.restoreSession();
      _state(BrowserAuthStatus.idle);
      return;
    }
    _state(BrowserAuthStatus.verifying);
    try {
      final data = Map<String, dynamic>.from(jsonDecode(raw) as Map);
      await _auth.acceptHostedSession(
        token: data['token'] as String,
        expectedUserId: data['userId'] as String,
        preferredSiteId: data['siteId'] as String?,
        shouldCommit: () => generation == _generation,
      );
      if (generation != _generation) return;
      await _storage.delete(key: _candidateStorageKey);
      _state(BrowserAuthStatus.idle);
    } on SessionVerificationUnavailableException {
      _state(
        BrowserAuthStatus.unavailable,
        'Your account needs a connection to finish verification. Retry without signing in again.',
      );
    } catch (_) {
      await _storage.delete(key: _candidateStorageKey);
      _state(
        BrowserAuthStatus.unavailable,
        'This sign-in expired. Please start again.',
      );
    }
  }

  Future<void> cancel() async {
    _browserCloseTimer?.cancel();
    ++_generation;
    await _browser.close();
    await _cancelRemote();
    await _clearPending();
    await _discardCandidate();
    _auth.setAccountTransition(false);
    _state(BrowserAuthStatus.idle);
  }

  Future<void> _cancelRemote() async {
    final pending = _pending;
    if (pending == null) return;
    try {
      await _post(
        '/api/auth/mobile/cancel',
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'requestId': pending['requestId'],
          'managementProof': pending['managementProof'],
        }),
      ).timeout(const Duration(seconds: 5));
    } catch (_) {
      /* Local access is still cleared; server request expires. */
    }
  }

  Future<http.Response> _post(
    String path, {
    required Map<String, String> headers,
    required String body,
  }) async {
    final request = http.Request('POST', _identity.resolve(path));
    request.headers.addAll(headers);
    request.body = body;
    request.followRedirects = false;
    return http.Response.fromStream(await _http.send(request));
  }

  Future<void> _discardCandidate() async {
    final raw = await _storage.read(key: _candidateStorageKey);
    if (raw != null) {
      try {
        final token = (jsonDecode(raw) as Map)['token'];
        if (token is String)
          await _post(
            '/api/auth/logout',
            headers: {'Authorization': 'Bearer $token'},
            body: '{}',
          ).timeout(const Duration(seconds: 5));
      } catch (_) {
        /* An unconfirmed orphan remains governed by canonical session expiry. */
      }
    }
    await _storage.delete(key: _candidateStorageKey);
  }

  Future<void> _clearPending() async {
    _pending = null;
    await _storage.delete(key: _pendingStorageKey);
  }

  Map<String, dynamic> _body(http.Response response) =>
      Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  @override
  void dispose() {
    _browserCloseTimer?.cancel();
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}
