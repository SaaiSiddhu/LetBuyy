// APPID-P4d — the app's lifecycle around "Sign in with LetBuyy", with the browser, the protected
// storage and the servers replaced. The protocol underneath is the real BuyerSignInClient; only its
// transport is a stand-in (and it is driven against the real servers in the local-stack run).
//
// What must hold: an attempt is saved before the browser opens and spent exactly once; a callback that
// does not answer it changes nothing and does not spend it; a callback after the app was stopped still
// completes it; coming back without a callback is a cancel; an ended session signs the app out when it
// starts or resumes; a session and a code never reach a message.

import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/config/app_config.dart';
import 'package:letbuyy_marketplace/widgets/letbuyy_account_card.dart';
import 'package:provider/provider.dart';

const identity = 'https://accounts.letbuyy.test';
const sessionToken = 'platform-buyer-session-token';

class MemoryStore implements BuyerSessionStore {
  StoredBuyerSession? session;
  PendingBuyerSignIn? pending;
  int pendingWrites = 0;

  @override
  Future<StoredBuyerSession?> readSession() async => session;
  @override
  Future<void> writeSession(StoredBuyerSession value) async => session = value;
  @override
  Future<void> deleteSession() async => session = null;
  @override
  Future<PendingBuyerSignIn?> readPending() async => pending;
  @override
  Future<void> writePending(PendingBuyerSignIn value) async {
    pendingWrites++;
    pending = value;
  }

  @override
  Future<void> deletePending() async => pending = null;
}

/// The browser: answers authorize() with whatever [answer] makes of the attempt's address.
class FakeBrowser implements BuyerSignInBrowser {
  FakeBrowser(this.answer);
  Future<Uri?> Function(Uri url) answer;
  Uri? launchCallback;
  int cancels = 0;
  final opened = <Uri>[];

  @override
  Future<Uri?> authorize(Uri url) {
    opened.add(url);
    return answer(url);
  }

  @override
  Future<Uri?> takeLaunchCallback() async {
    final kept = launchCallback;
    launchCallback = null;
    return kept;
  }

  @override
  Future<void> cancelWaiting() async => cancels++;
}

/// The callback identity-platform would send for the attempt behind [url].
Uri callbackFor(Uri url, {String code = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', String? state}) =>
    Uri.parse('com.letbuyy.letbuyy:/oauth/callback?code=$code&state=${state ?? url.queryParameters['state']}');

class Servers {
  Servers({this.tokenStatus = 200, this.accountStatus = 200});
  int tokenStatus;
  int accountStatus;
  final tokenRequests = <RequestOptions>[];
  final accountRequests = <RequestOptions>[];

  Dio identityDio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
      tokenRequests.add(o);
      handler.resolve(Response(
        requestOptions: o,
        statusCode: tokenStatus,
        data: tokenStatus == 200
            ? {'access_token': sessionToken, 'token_type': 'Bearer', 'expires_in': 2592000}
            : {'error': tokenStatus == 400 ? 'invalid_grant' : 'temporarily_unavailable'},
      ));
    }));
    return dio;
  }

  Dio gatewayDio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
      if (o.path.endsWith('/buyer/account')) {
        accountRequests.add(o);
        if (accountStatus == 0) {
          handler.reject(DioException(requestOptions: o, type: DioExceptionType.connectionError));
          return;
        }
        handler.resolve(Response(
          requestOptions: o,
          statusCode: accountStatus,
          data: accountStatus == 200
              ? {'success': true, 'data': {'buyer': {'id': 'buyer-1', 'email': 'asha@example.com', 'email_verified': true}}}
              : {'success': false, 'error': {'code': accountStatus == 403 ? 'BUYER_DISABLED' : 'UNAUTHORIZED', 'message': 'x'}},
        ));
        return;
      }
      // The controller only ever calls /buyer/account. Anything else is a genuine bug, not a Firebase
      // link request to wave through — Phase 1R removed that call entirely.
      handler.reject(DioException(requestOptions: o, type: DioExceptionType.badResponse, message: 'unexpected gateway request: ${o.path}'));
    }));
    return dio;
  }
}

class Clock {
  DateTime now = DateTime.utc(2026, 9, 24, 12);
  DateTime call() => now;
}

({BuyerSignInController controller, MemoryStore store, FakeBrowser browser, Servers servers, Clock clock}) harness({
  Future<Uri?> Function(Uri url)? answer,
  MemoryStore? store,
  Servers? servers,
  Clock? clock,
  int seed = 1,
}) {
  final s = store ?? MemoryStore();
  final sv = servers ?? Servers();
  final c = clock ?? Clock();
  final browser = FakeBrowser(answer ?? (url) async => callbackFor(url));
  final controller = BuyerSignInController(
    client: BuyerSignInClient(identityBaseUrl: identity, dio: sv.identityDio(), random: Random(seed), clock: c.call),
    accounts: BuyerAccountApi(ApiClient(baseUrl: 'https://gateway.test/v1', dio: sv.gatewayDio(), maxRetries: 0)),
    browser: browser,
    store: s,
    clock: c.call,
  );
  return (controller: controller, store: s, browser: browser, servers: sv, clock: c);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('a sign-in saves the attempt first, spends it once, and keeps only the session', () async {
    final h = harness();
    await h.controller.start();
    expect(h.controller.status, BuyerSignInStatus.signedOut);

    await h.controller.signIn();
    expect(h.store.pendingWrites, 1);
    expect(h.store.pending, isNull, reason: 'the attempt is spent');
    expect(h.store.session?.token, sessionToken);
    expect(h.store.session?.email, 'asha@example.com');
    expect(h.controller.status, BuyerSignInStatus.signedIn);
    expect(h.controller.email, 'asha@example.com');
    expect(h.controller.message, isNull, reason: 'the headline names the account; no second copy');

    final opened = h.browser.opened.single;
    expect(opened.path, '/buyer/authorize');
    expect(opened.queryParameters['client_id'], 'letbuyy-marketplace-app');
    final exchange = h.servers.tokenRequests.single.data as Map;
    expect(exchange['code_verifier'], isNotNull);
    expect(opened.toString().contains(exchange['code_verifier'] as String), isFalse, reason: 'the verifier never went to the browser');
    expect(h.servers.accountRequests.single.headers['X-LetBuyy-Buyer-Session'], sessionToken);
    h.controller.dispose();
  });

  test('the feature is on by default, and a build can still turn it off', () {
    // Phase 1R: no Firebase fallback remains, so this is the app's sole sign-in and defaults on.
    // The flag survives only as a documented --dart-define override, never a security boundary.
    expect(AppConfig.buyerSignInEnabled, isTrue);
    expect(AppConfig.identityBaseUrl, 'https://accounts.letbuyy.com');
  });

  test('coming back without a callback is a cancel, and nothing is kept', () async {
    final h = harness(answer: (_) async => null);
    await h.controller.start();
    await h.controller.signIn();
    expect(h.controller.status, BuyerSignInStatus.signedOut);
    expect(h.controller.message, 'Sign-in was cancelled.');
    expect(h.store.pending, isNull);
    expect(h.store.session, isNull);
    expect(h.servers.tokenRequests, isEmpty);
    h.controller.dispose();
  });

  test('resuming while the browser is open ends the wait, which signIn reports as cancelled', () async {
    final h = harness(answer: (_) async => null);
    await h.controller.start();
    h.browser.answer = (_) => Future<Uri?>.delayed(const Duration(milliseconds: 10));
    final signingIn = h.controller.signIn();
    await Future<void>.delayed(Duration.zero);
    expect(h.controller.status, BuyerSignInStatus.waitingForBrowser);
    await h.controller.onResumed();
    expect(h.browser.cancels, 1);
    await signingIn;
    expect(h.controller.status, BuyerSignInStatus.signedOut);
    h.controller.dispose();
  });

  test('a declined sign-in is a cancel; a callback for another attempt changes nothing and spends nothing', () async {
    final declined = harness(answer: (url) async => Uri.parse('com.letbuyy.letbuyy:/oauth/callback?error=access_denied&state=${url.queryParameters['state']}'));
    await declined.controller.start();
    await declined.controller.signIn();
    expect(declined.controller.message, 'Sign-in was cancelled.');
    expect(declined.store.pending, isNull);

    final forged = harness(answer: (url) async => callbackFor(url, state: 'x' * 43));
    await forged.controller.start();
    await forged.controller.signIn();
    expect(forged.controller.status, BuyerSignInStatus.signedOut);
    expect(forged.controller.message, 'That sign-in couldn’t be completed. Try again.');
    expect(forged.store.pending, isNotNull, reason: 'the real callback can still complete this attempt');
    expect(forged.servers.tokenRequests, isEmpty, reason: 'nothing was exchanged');

    // The real callback arrives afterwards (the app was brought back by it) and completes it.
    forged.browser.launchCallback = callbackFor(forged.browser.opened.single);
    await forged.controller.onResumed();
    expect(forged.controller.status, BuyerSignInStatus.signedIn);
    expect(forged.store.pending, isNull);
    declined.controller.dispose();
    forged.controller.dispose();
  });

  test('a callback with no attempt behind it changes nothing, signed in or not', () async {
    final h = harness();
    await h.controller.start();
    await h.controller.signIn();
    expect(h.controller.status, BuyerSignInStatus.signedIn);
    h.browser.launchCallback = callbackFor(h.browser.opened.single);
    await h.controller.onResumed();
    expect(h.controller.status, BuyerSignInStatus.signedIn);
    expect(h.servers.tokenRequests, hasLength(1), reason: 'a replayed callback is not exchanged again');
    h.controller.dispose();
  });

  test('an attempt saved before the app was stopped is completed by the callback that relaunches it', () async {
    final first = harness(answer: (_) => Completer<Uri?>().future);
    await first.controller.start();
    unawaited(first.controller.signIn());
    await Future<void>.delayed(Duration.zero);
    expect(first.store.pending, isNotNull);
    final url = first.browser.opened.single;
    first.controller.dispose();

    // A new process: the same storage, and the callback handed over at launch.
    final second = harness(store: first.store);
    second.browser.launchCallback = callbackFor(url);
    await second.controller.start();
    expect(second.controller.status, BuyerSignInStatus.signedIn);
    expect(second.store.pending, isNull);
    second.controller.dispose();
  });

  test('a callback for an expired attempt is refused and the attempt is dropped', () async {
    final clock = Clock();
    final h = harness(answer: (_) => Completer<Uri?>().future, clock: clock);
    await h.controller.start();
    unawaited(h.controller.signIn());
    await Future<void>.delayed(Duration.zero);
    final url = h.browser.opened.single;
    clock.now = clock.now.add(const Duration(minutes: 20));
    h.browser.launchCallback = callbackFor(url);
    await h.controller.onResumed();
    expect(h.store.pending, isNull);
    expect(h.store.session, isNull);
    expect(h.controller.message, 'That sign-in took too long. Try again.');
    h.controller.dispose();
  });

  test('a refused code and an unreachable identity-platform each leave the app signed out, saying why', () async {
    final refused = harness(servers: Servers(tokenStatus: 400));
    await refused.controller.start();
    await refused.controller.signIn();
    expect(refused.controller.status, BuyerSignInStatus.signedOut);
    expect(refused.controller.message, 'That sign-in expired before it finished. Try again.');
    expect(refused.store.session, isNull);

    final down = harness(servers: Servers(tokenStatus: 503));
    await down.controller.start();
    await down.controller.signIn();
    expect(down.controller.message, 'Sign-in is unavailable right now. Try again in a moment.');
    refused.controller.dispose();
    down.controller.dispose();
  });

  test('a browser that cannot open says so', () async {
    final h = harness(answer: (_) async => throw PlatformException(code: 'NO_BROWSER'));
    await h.controller.start();
    await h.controller.signIn();
    expect(h.controller.status, BuyerSignInStatus.signedOut);
    expect(h.controller.message, contains('browser'));
    expect(h.store.pending, isNull);
    h.controller.dispose();
  });

  test('an ended session signs the app out at start and on resume; an unreachable gateway does not', () async {
    final store = MemoryStore()..session = StoredBuyerSession(token: sessionToken, expiresAt: DateTime.utc(2026, 10, 20), email: 'asha@example.com');
    final ended = harness(store: store, servers: Servers(accountStatus: 401));
    await ended.controller.start();
    expect(ended.controller.status, BuyerSignInStatus.signedOut);
    expect(ended.controller.message, 'Your LetBuyy sign-in has ended. Sign in again.');
    expect(store.session, isNull);

    final disabledStore = MemoryStore()..session = StoredBuyerSession(token: sessionToken, expiresAt: DateTime.utc(2026, 10, 20));
    final disabled = harness(store: disabledStore, servers: Servers(accountStatus: 403));
    await disabled.controller.start();
    expect(disabled.controller.message, 'This LetBuyy account is disabled.');
    expect(disabledStore.session, isNull);

    final offlineStore = MemoryStore()..session = StoredBuyerSession(token: sessionToken, expiresAt: DateTime.utc(2026, 10, 20), email: 'asha@example.com');
    final offline = harness(store: offlineStore, servers: Servers(accountStatus: 0));
    await offline.controller.start();
    expect(offline.controller.status, BuyerSignInStatus.signedIn, reason: 'offline is not signed out');
    expect(offline.controller.email, 'asha@example.com');
    expect(offlineStore.session, isNotNull);

    final clock = Clock();
    final laterStore = MemoryStore()..session = StoredBuyerSession(token: sessionToken, expiresAt: DateTime.utc(2026, 10, 20));
    final servers = Servers();
    final later = harness(store: laterStore, servers: servers, clock: clock);
    await later.controller.start();
    expect(later.controller.status, BuyerSignInStatus.signedIn);
    servers.accountStatus = 401; // signed out everywhere, elsewhere
    await later.controller.onResumed();
    expect(later.controller.status, BuyerSignInStatus.signedIn, reason: 'checked moments ago');
    clock.now = clock.now.add(const Duration(minutes: 16));
    await later.controller.onResumed();
    expect(later.controller.status, BuyerSignInStatus.signedOut);
    expect(laterStore.session, isNull);

    for (final h in [ended, disabled, offline, later]) {
      h.controller.dispose();
    }
  });

  test('a stored session past its expiry is dropped without asking the gateway', () async {
    final store = MemoryStore()..session = StoredBuyerSession(token: sessionToken, expiresAt: DateTime.utc(2026, 9, 1));
    final h = harness(store: store);
    await h.controller.start();
    expect(h.controller.status, BuyerSignInStatus.signedOut);
    expect(h.controller.message, 'Your LetBuyy sign-in has expired. Sign in again.');
    expect(h.servers.accountRequests, isEmpty);
    h.controller.dispose();
  });

  test('signing out deletes the session on this device', () async {
    final h = harness();
    await h.controller.start();
    await h.controller.signIn();
    await h.controller.signOut();
    expect(h.store.session, isNull);
    expect(h.controller.status, BuyerSignInStatus.signedOut);
    expect(h.controller.email, isNull);
    h.controller.dispose();
  });

  test('no message ever carries the session or the code', () async {
    final messages = <String?>[];
    final h = harness();
    h.controller.addListener(() => messages.add(h.controller.message));
    await h.controller.start();
    await h.controller.signIn();
    await h.controller.signOut();
    for (final message in messages.whereType<String>()) {
      expect(message.contains(sessionToken), isFalse);
      expect(message.contains('CCCCCCCC'), isFalse);
    }
    h.controller.dispose();
  });

  test('the app lifecycle reaches the controller', () async {
    final h = harness(answer: (_) => Completer<Uri?>().future);
    await h.controller.start();
    unawaited(h.controller.signIn());
    await Future<void>.delayed(Duration.zero);
    h.controller.didChangeAppLifecycleState(AppLifecycleState.resumed);
    await Future<void>.delayed(Duration.zero);
    expect(h.browser.cancels, 1);
    h.controller.dispose();
  });

  testWidgets('the card offers sign-in, then names the account, and sign-out', (tester) async {
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(ChangeNotifierProvider<BuyerSignInController>.value(
      value: h.controller,
      child: const MaterialApp(home: Scaffold(body: LetBuyyAccountCard(isDark: false))),
    ));
    expect(find.text('One account for the LetBuyy app and every LetBuyy store'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Sign in with LetBuyy'), findsOneWidget);

    await tester.runAsync(h.controller.signIn);
    await tester.pump();
    expect(find.text('Signed in as asha@example.com'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Sign out of LetBuyy on this device'), findsOneWidget);
    expect(find.textContaining(sessionToken), findsNothing);

    await tester.runAsync(h.controller.signOut);
    await tester.pump();
    expect(find.text('You’re signed out of LetBuyy on this device.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Sign in with LetBuyy'), findsOneWidget);
    h.controller.dispose();
  });
}
