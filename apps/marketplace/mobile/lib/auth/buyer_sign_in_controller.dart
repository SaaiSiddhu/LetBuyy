// APPID-P4d — "Sign in with LetBuyy" in the marketplace app, behind LETBUYY_BUYER_SIGN_IN (off).
//
// The buyer signs in at identity-platform in the system browser; the app receives a code for this
// attempt, exchanges it with the attempt's PKCE verifier, and keeps the platform buyer session in
// protected storage (D-ONE-IDENTITY). The protocol is letbuyy_api_client's BuyerSignInClient; this
// file is the app's lifecycle around it:
//   * an attempt is saved before the browser opens, so it survives the app being stopped, and a
//     callback that arrives after a restart still completes it;
//   * a callback is used once, and only if it answers the saved attempt; a stray or forged callback
//     changes nothing, and does not spend the attempt it failed to answer;
//   * coming back to the app without a callback ends the attempt (cancelled);
//   * an ended session (expiry, password reset, "sign out everywhere", a disabled account) is found
//     when the app starts or resumes, and signs the app out.
//
// Firebase is untouched (Firebase-era screens still read the Firebase uid until FB-4 moves each one).
// After signing in, the app asks the gateway to record which Firebase user this buyer is, which only
// happens when both prove the same verified email address (migration 259). That mapping is all the
// bridge does: it creates no account and grants no access.

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';

import 'buyer_session_store.dart';
import 'buyer_sign_in_browser.dart';

enum BuyerSignInStatus { restoring, signedOut, waitingForBrowser, completing, signedIn }

class BuyerSignInController extends ChangeNotifier with WidgetsBindingObserver {
  BuyerSignInController({
    required BuyerSignInClient client,
    required BuyerAccountApi accounts,
    required BuyerSignInBrowser browser,
    required BuyerSessionStore store,
    Future<String?> Function()? firebaseIdToken,
    DateTime Function()? clock,
    this.recheckAfter = const Duration(minutes: 15),
  })  : _client = client,
        _accounts = accounts,
        _browser = browser,
        _store = store,
        _firebaseIdToken = firebaseIdToken,
        _clock = clock ?? DateTime.now;

  final BuyerSignInClient _client;
  final BuyerAccountApi _accounts;
  final BuyerSignInBrowser _browser;
  final BuyerSessionStore _store;
  final Future<String?> Function()? _firebaseIdToken;
  final DateTime Function() _clock;

  /// How long a signed-in state is trusted before the app asks the gateway again on resume.
  final Duration recheckAfter;

  BuyerSignInStatus _status = BuyerSignInStatus.restoring;
  String? _email;
  String? _message;
  FirebaseLinkResult? _firebaseLink;
  DateTime? _checkedAt;
  bool _started = false;
  bool _disposed = false;

  BuyerSignInStatus get status => _status;
  String? get email => _email;

  /// The last thing to tell the buyer, if any. Never contains a token or a code.
  String? get message => _message;
  FirebaseLinkResult? get firebaseLink => _firebaseLink;

  /// Where a failed or abandoned attempt leaves the app: still signed in if it was.
  BuyerSignInStatus get _settled => _email != null ? BuyerSignInStatus.signedIn : BuyerSignInStatus.signedOut;

  Future<void>? _linkTask;

  /// The Firebase link started by the last successful sign-in or restore, for tests to await.
  @visibleForTesting
  Future<void> get linking => _linkTask ?? Future<void>.value();

  void _set(BuyerSignInStatus status, {String? message, bool keepMessage = false}) {
    _status = status;
    if (!keepMessage) _message = message;
    if (!_disposed) notifyListeners();
  }

  /// Collects a callback that arrived before the app was running, then restores the saved session.
  Future<void> start() async {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    await _collectLaunchCallback();
    if (_status == BuyerSignInStatus.restoring) await _restoreSession();
  }

  @override
  void dispose() {
    _disposed = true;
    if (_started) WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(onResumed());
  }

  /// The app is in the foreground again.
  @visibleForTesting
  Future<void> onResumed() async {
    await _collectLaunchCallback();
    if (_status == BuyerSignInStatus.waitingForBrowser) {
      // Back in the app with no callback: the buyer left the browser. On Android this answers the
      // waiting authorize() with nothing, which signIn() reports as cancelled.
      await _browser.cancelWaiting();
      return;
    }
    final checkedAt = _checkedAt;
    if (_status == BuyerSignInStatus.signedIn && (checkedAt == null || _clock().difference(checkedAt) >= recheckAfter)) {
      await _restoreSession();
    }
  }

  Future<void> signIn() async {
    if (_status == BuyerSignInStatus.waitingForBrowser || _status == BuyerSignInStatus.completing) return;
    final pending = _client.begin();
    await _store.writePending(pending);
    _set(BuyerSignInStatus.waitingForBrowser);

    final Uri? callback;
    try {
      callback = await _browser.authorize(_client.authorizationUrl(pending));
    } on PlatformException {
      await _store.deletePending();
      _set(_settled, message: 'We couldn’t open the sign-in page. Check that a web browser is installed.');
      return;
    }
    if (callback != null) {
      await _complete(callback);
      // A callback with no saved attempt behind it changes nothing, and the wait is over.
      if (_status == BuyerSignInStatus.waitingForBrowser) _set(_settled, keepMessage: true);
    } else if (_status == BuyerSignInStatus.waitingForBrowser) {
      await _store.deletePending();
      _set(_settled, message: 'Sign-in was cancelled.');
    }
  }

  /// The buyer's own Cancel while the browser is open.
  Future<void> cancel() async {
    if (_status != BuyerSignInStatus.waitingForBrowser) return;
    await _browser.cancelWaiting();
    if (_status == BuyerSignInStatus.waitingForBrowser) {
      await _store.deletePending();
      _set(_settled, message: 'Sign-in was cancelled.');
    }
  }

  /// Signs this device out. The session is deleted here; "sign out everywhere" is identity-platform's.
  Future<void> signOut() async {
    await _store.deleteSession();
    _email = null;
    _firebaseLink = null;
    _checkedAt = null;
    _set(BuyerSignInStatus.signedOut, message: 'You’re signed out of LetBuyy on this device.');
  }

  Future<void> _collectLaunchCallback() async {
    final Uri? callback;
    try {
      callback = await _browser.takeLaunchCallback();
    } on PlatformException {
      return;
    } on MissingPluginException {
      return;
    }
    if (callback != null) await _complete(callback);
  }

  Future<void> _complete(Uri callback) async {
    final pending = await _store.readPending();
    // Nothing was waiting: a stray or replayed callback. It changes nothing.
    if (pending == null) return;
    final wasRestoring = _status == BuyerSignInStatus.restoring;
    _set(BuyerSignInStatus.completing);

    final read = _client.readCallback(callback, pending);
    switch (read) {
      case BuyerSignInRejected():
        // Not an answer to this attempt. It is kept, so the real callback can still complete it,
        // unless it has expired.
        final expired = pending.isExpired(_clock().toUtc());
        if (expired) await _store.deletePending();
        _set(wasRestoring ? BuyerSignInStatus.restoring : _settled,
            message: expired ? 'That sign-in took too long. Try again.' : 'That sign-in couldn’t be completed. Try again.');
        return;
      case BuyerSignInDeclined():
        await _store.deletePending();
        _set(wasRestoring ? BuyerSignInStatus.restoring : _settled, message: 'Sign-in was cancelled.');
        return;
      case BuyerSignInCode(:final code):
        await _store.deletePending();
        final BuyerSessionGrant grant;
        try {
          grant = await _client.exchange(code, pending);
        } on BuyerSignInException catch (error) {
          _set(wasRestoring ? BuyerSignInStatus.restoring : _settled, message: switch (error.failure) {
            BuyerSignInFailure.invalidGrant => 'That sign-in expired before it finished. Try again.',
            BuyerSignInFailure.network => 'You seem to be offline. Check your connection and try again.',
            BuyerSignInFailure.unavailable => 'Sign-in is unavailable right now. Try again in a moment.',
          });
          return;
        }
        await _store.writeSession(StoredBuyerSession(token: grant.accessToken, expiresAt: grant.expiresAt));
        _email = null;
        _firebaseLink = null;
        await _restoreSession(justSignedIn: true);
    }
  }

  /// Reads the saved session and asks the gateway who it is.
  Future<void> _restoreSession({bool justSignedIn = false}) async {
    final session = await _store.readSession();
    if (session == null) {
      _set(BuyerSignInStatus.signedOut, keepMessage: true);
      return;
    }
    if (session.isExpired(_clock().toUtc())) {
      await _store.deleteSession();
      _email = null;
      _set(BuyerSignInStatus.signedOut, message: 'Your LetBuyy sign-in has expired. Sign in again.');
      return;
    }
    try {
      final account = await _accounts.account(session.token);
      _email = account.email;
      _checkedAt = _clock();
      if (account.email != session.email) await _store.writeSession(session.withEmail(account.email));
      // The card's headline already names the account, so a fresh sign-in clears any older message.
      _set(BuyerSignInStatus.signedIn, keepMessage: !justSignedIn);
      _linkTask = _linkFirebase(session.token);
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        await _store.deleteSession();
        _email = null;
        _set(BuyerSignInStatus.signedOut, message: error.statusCode == 403
            ? 'This LetBuyy account is disabled.'
            : 'Your LetBuyy sign-in has ended. Sign in again.');
        return;
      }
      // The gateway could not answer. The session may be fine; keep it and check again later.
      _email = session.email;
      _set(BuyerSignInStatus.signedIn, message: 'We couldn’t reach LetBuyy just now. Showing your saved sign-in.');
    }
  }

  bool _linking = false;

  Future<void> _linkFirebase(String token) async {
    final idToken = _firebaseIdToken;
    final settled = _firebaseLink;
    if (idToken == null || _linking) return;
    if (settled == FirebaseLinkResult.linked || settled == FirebaseLinkResult.alreadyLinked || settled == FirebaseLinkResult.conflict) return;
    _linking = true;
    try {
      final firebaseToken = await idToken();
      if (firebaseToken == null) return;
      _firebaseLink = await _accounts.linkFirebase(token, firebaseToken);
      if (!_disposed) notifyListeners();
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        await _store.deleteSession();
        _email = null;
        _set(BuyerSignInStatus.signedOut, message: 'Your LetBuyy sign-in has ended. Sign in again.');
      }
    } on Exception {
      // Firebase could not produce a token (offline, signed out). Linking is tried again next time.
    } finally {
      _linking = false;
    }
  }
}
