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
// Phase 1R (2026-09-26): the owner authorized removing Firebase entirely — no real marketplace users
// exist to preserve, so there is no legacy Firebase account left to link. The Firebase-linking bridge
// this controller used to drive (recording which Firebase user a buyer was, migration 259) is gone;
// this is now the app's only sign-in.

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
    DateTime Function()? clock,
    this.recheckAfter = const Duration(minutes: 15),
  })  : _client = client,
        _accounts = accounts,
        _browser = browser,
        _store = store,
        _clock = clock ?? DateTime.now;

  final BuyerSignInClient _client;
  final BuyerAccountApi _accounts;
  final BuyerSignInBrowser _browser;
  final BuyerSessionStore _store;
  final DateTime Function() _clock;

  /// How long a signed-in state is trusted before the app asks the gateway again on resume.
  final Duration recheckAfter;

  BuyerSignInStatus _status = BuyerSignInStatus.restoring;
  String? _email;
  String? _token;
  String? _buyerId;
  String? _message;
  DateTime? _checkedAt;
  bool _started = false;
  bool _disposed = false;

  BuyerSignInStatus get status => _status;
  String? get email => _email;

  /// The buyer's own session token, for a signed-in screen that needs to call another canonical
  /// buyer route directly (profile/address management). Null whenever [status] is not `signedIn` —
  /// callers must not hold onto a stale value across a sign-out.
  String? get token => _status == BuyerSignInStatus.signedIn ? _token : null;

  /// The canonical `buyer_accounts.id` (D-BUYER-SCOPE, 27 September 2026 review continuation) --
  /// CartProvider/WishlistProvider key their per-buyer local namespace on this, never on [token]
  /// (rotates per session) or [email] (not the canonical identifier and the review's own explicit
  /// instruction). Null whenever [status] is not `signedIn`, same lifetime as [token].
  String? get buyerId => _status == BuyerSignInStatus.signedIn ? _buyerId : null;

  /// The last thing to tell the buyer, if any. Never contains a token or a code.
  String? get message => _message;

  /// Where a failed or abandoned attempt leaves the app: still signed in if it was.
  BuyerSignInStatus get _settled => _email != null ? BuyerSignInStatus.signedIn : BuyerSignInStatus.signedOut;

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
    _token = null;
    _buyerId = null;
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
        _token = null;
        _buyerId = null;
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
      _token = null;
      _buyerId = null;
      _set(BuyerSignInStatus.signedOut, message: 'Your LetBuyy sign-in has expired. Sign in again.');
      return;
    }
    try {
      final account = await _accounts.account(session.token);
      _email = account.email;
      _token = session.token;
      _buyerId = account.id;
      _checkedAt = _clock();
      if (account.email != session.email || account.id != session.buyerId) {
        await _store.writeSession(session.withAccount(email: account.email, buyerId: account.id));
      }
      // The card's headline already names the account, so a fresh sign-in clears any older message.
      _set(BuyerSignInStatus.signedIn, keepMessage: !justSignedIn);
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        await _store.deleteSession();
        _email = null;
        _token = null;
        _buyerId = null;
        _set(BuyerSignInStatus.signedOut, message: error.statusCode == 403
            ? 'This LetBuyy account is disabled.'
            : 'Your LetBuyy sign-in has ended. Sign in again.');
        return;
      }
      // The gateway could not answer. The session may be fine; keep it and check again later --
      // including buyerId, cached on the session precisely for this path (CartProvider/
      // WishlistProvider still need a namespace to read while offline).
      _email = session.email;
      _token = session.token;
      _buyerId = session.buyerId;
      _set(BuyerSignInStatus.signedIn, message: 'We couldn’t reach LetBuyy just now. Showing your saved sign-in.');
    }
  }
}
