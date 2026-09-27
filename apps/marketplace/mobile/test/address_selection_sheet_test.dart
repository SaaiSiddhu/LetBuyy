// C2 corrective (address-sheet account transition) -- regression coverage for the two race
// conditions the 27 September 2026 review found in address_selection_sheet.dart's rewire onto
// BuyerAddressApi: (1) a direct A-to-B session change could briefly render Buyer A's addresses
// under Buyer B, because the reload was only *scheduled* (a post-frame callback comparing the
// controller's token against a stored `_loadedForToken`) rather than applied before that frame
// painted; (2) if the token changed while a request for the old buyer was still in flight, the
// stale request's own completion found itself no-longer-current and returned without resetting
// `_loadingAddresses`, so nothing ever re-armed a load for the new buyer -- the sheet could get
// stuck loading forever. Fixed with a monotonic generation counter (see the widget's own field
// docs) instead of a token comparison; this file proves that fix against a real, controllable race
// rather than relying on the design reasoning alone.
//
// Reuses the same fake-server/account-switch pattern letbuyy_account_screen_test.dart established
// (a stateful in-memory Dio interceptor, a scripted OAuth browser driving a real sign-in) --
// duplicated rather than shared: this file only needs the addresses endpoint and the switch
// machinery, and copying that here keeps this file self-contained without risking the existing,
// working account-screen suite in a shared-module refactor.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/address_selection_sheet.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';

const sessionToken = 'buyer-session-token';

class _MemoryStore implements BuyerSessionStore {
  _MemoryStore(this.session);
  StoredBuyerSession? session;
  PendingBuyerSignIn? pending;

  @override
  Future<StoredBuyerSession?> readSession() async => session;
  @override
  Future<void> writeSession(StoredBuyerSession value) async => session = value;
  @override
  Future<void> deleteSession() async => session = null;
  @override
  Future<PendingBuyerSignIn?> readPending() async => pending;
  @override
  Future<void> writePending(PendingBuyerSignIn value) async => pending = value;
  @override
  Future<void> deletePending() async => pending = null;
}

/// Answers `authorize()` with a real callback for whatever attempt (state) it was actually asked
/// to open -- an account switch drives BuyerSignInController.signIn() for real, through the same
/// protocol production uses, rather than reaching into the controller's private state.
class _ScriptedBrowser implements BuyerSignInBrowser {
  const _ScriptedBrowser({this.code = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'});
  final String code;

  @override
  Future<Uri?> authorize(Uri url) async =>
      Uri.parse('com.letbuyy.letbuyy:/oauth/callback?code=$code&state=${url.queryParameters['state']}');
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

/// A minimal stand-in for identity-platform's own token endpoint -- just enough for
/// BuyerSignInClient.exchange() to succeed and hand back [token].
Dio identityTokenDio(String token) {
  final dio = Dio();
  dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
    handler.resolve(Response(
      requestOptions: o,
      statusCode: 200,
      data: {'access_token': token, 'token_type': 'Bearer', 'expires_in': 2592000},
    ));
  }));
  return dio;
}

/// A tiny, stateful stand-in for the gateway's /storefront/buyer/{account,addresses} routes, keyed
/// by the token in the request. account() is answered only because
/// BuyerSignInController.restoreSession/signIn always read it as part of establishing a session --
/// this sheet itself never calls it.
class FakeGateway {
  FakeGateway({this.validToken = sessionToken, String email = 'asha@example.com'})
      : account = {'id': 'buyer-1', 'email': email, 'email_verified': true, 'full_name': null, 'phone': null};

  String validToken;
  Map<String, Object?> account;
  final Map<String, Map<String, Object?>> otherBuyersByToken = {};
  final Map<String, List<Map<String, Object?>>> addressesByToken = {};

  int requestsReceived = 0;
  bool offline = false;

  /// Holds every request carrying exactly this token open, until [releaseHeldToken] -- creates an
  /// in-flight window for one buyer's own traffic only, so a second buyer's sign-in and subsequent
  /// load are free to proceed normally alongside it.
  String? _heldToken;
  Completer<void>? _tokenHold;

  void holdToken(String token) {
    _heldToken = token;
    _tokenHold = Completer<void>();
  }

  void releaseHeldToken() => _tokenHold?.complete();

  Dio dio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) async {
      requestsReceived++;
      if (offline) {
        handler.reject(DioException(requestOptions: o, type: DioExceptionType.connectionError));
        return;
      }
      final token = o.headers['X-LetBuyy-Buyer-Session'] as String?;
      if (token != null && token == _heldToken) await _tokenHold!.future;
      final otherAccount = token == null ? null : otherBuyersByToken[token];
      if (token != validToken && otherAccount == null) {
        handler.resolve(Response(requestOptions: o, statusCode: 401, data: {'success': false, 'error': {'code': 'UNAUTHORIZED', 'message': 'x'}}));
        return;
      }
      final path = o.path;
      if (path.endsWith('/buyer/account') && o.method == 'GET') {
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'buyer': otherAccount ?? account}}));
        return;
      }
      if (path.endsWith('/buyer/addresses') && o.method == 'GET') {
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'addresses': addressesByToken[token!] ?? const []}}));
        return;
      }
      handler.resolve(Response(requestOptions: o, statusCode: 404, data: {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'unmapped'}}));
    }));
    return dio;
  }
}

/// Pumps repeatedly, inside the real async zone `runAsync` provides, until [condition] is
/// observably true -- never a fixed "sleep and hope" delay. Bounded by [timeout] so a condition
/// that is never met still fails fast and readably, rather than hanging the test.
Future<void> pumpUntil(
  WidgetTester tester,
  bool Function() condition, {
  Duration timeout = const Duration(seconds: 5),
  Duration pumpDuration = const Duration(milliseconds: 1),
}) {
  return tester.runAsync(() async {
    final deadline = DateTime.now().add(timeout);
    while (!condition()) {
      if (DateTime.now().isAfter(deadline)) {
        throw TimeoutException('pumpUntil: condition not met within $timeout');
      }
      await tester.pump(pumpDuration);
    }
  });
}

Widget wrap(BuyerSignInController controller, BuyerAddressApi addresses) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<BuyerSignInController>.value(value: controller),
      Provider<BuyerAddressApi>.value(value: addresses),
      // AddressSelectionSheet reads ThemeProvider directly (Provider.of<ThemeProvider> in build())
      // -- unlike letbuyy_account_screen.dart, which never touches it.
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ],
    child: MaterialApp(
      home: Scaffold(
        body: AddressSelectionSheet(onAddressSelected: (_) {}),
      ),
    ),
  );
}

({BuyerSignInController controller, BuyerAddressApi addresses, FakeGateway gateway}) harness({FakeGateway? gateway}) {
  final gw = gateway ?? FakeGateway();
  final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: gw.dio(), maxRetries: 0);
  final accounts = BuyerAccountApi(client);
  final store = _MemoryStore(StoredBuyerSession(token: gw.validToken, expiresAt: DateTime.utc(2100)));
  final controller = BuyerSignInController(
    client: BuyerSignInClient(identityBaseUrl: 'https://accounts.letbuyy.test'),
    accounts: accounts,
    browser: _ScriptedBrowser(),
    store: store,
  );
  return (controller: controller, addresses: BuyerAddressApi(client), gateway: gw);
}

void main() {
  testWidgets('the signed-in buyer\'s real address renders, and a guest never reaches the network', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addressesByToken[sessionToken] = [
      {
        'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
        'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': true,
      },
    ];
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.addresses));
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka 560001'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('signing out clears the previously-shown addresses immediately', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addressesByToken[sessionToken] = [
      {
        'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
        'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': true,
      },
    ];
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.addresses));
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka 560001'), findsOneWidget);

    await tester.runAsync(h.controller.signOut);
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka 560001'), findsNothing, reason: 'no trace of the signed-out buyer\'s address remains');
    expect(find.text('Please login to see addresses'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('a stale in-flight response for Buyer A is never applied once Buyer B is signed in, and the sheet does not get stuck loading', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    const buyerAToken = sessionToken;
    const buyerBToken = 'buyer-b-session-token';
    final gateway = FakeGateway(validToken: buyerAToken, email: 'asha-a@example.com');
    gateway.otherBuyersByToken[buyerBToken] = {
      'id': 'buyer-2', 'email': 'bilal-b@example.com', 'email_verified': true, 'full_name': null, 'phone': null,
    };
    gateway.addressesByToken[buyerAToken] = [
      {
        'id': 'addr-a1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
        'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': true,
      },
    ];
    gateway.addressesByToken[buyerBToken] = [
      {
        'id': 'addr-b1', 'label': 'home', 'full_name': 'Bilal Baig', 'address_line1': '7 Brigade Road',
        'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560025', 'country': 'IN', 'is_default': true,
      },
    ];

    final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: gateway.dio(), maxRetries: 0);
    final accounts = BuyerAccountApi(client);
    final addresses = BuyerAddressApi(client);
    final store = _MemoryStore(StoredBuyerSession(token: buyerAToken, expiresAt: DateTime.utc(2100)));
    final controller = BuyerSignInController(
      client: BuyerSignInClient(identityBaseUrl: 'https://accounts.letbuyy.test', dio: identityTokenDio(buyerBToken)),
      accounts: accounts,
      browser: const _ScriptedBrowser(),
      store: store,
    );
    addTearDown(controller.dispose);

    await tester.runAsync(controller.start);
    expect(controller.status, BuyerSignInStatus.signedIn);
    final baseline = gateway.requestsReceived;

    // Hold Buyer A's own traffic open -- the sheet's initial load is about to start, and this
    // keeps its response outstanding for the rest of the test, exactly like a real slow response
    // arriving late.
    gateway.holdToken(buyerAToken);
    await tester.pumpWidget(wrap(controller, addresses));
    await pumpUntil(tester, () => gateway.requestsReceived > baseline, pumpDuration: const Duration(milliseconds: 20));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsWidgets, reason: 'Buyer A\'s load is still held open');

    // Buyer B signs in for real while Buyer A's response is still outstanding -- the same
    // begin/browser/exchange/restoreSession sequence production runs.
    await tester.runAsync(controller.signIn);
    await pumpUntil(
      tester,
      () => controller.status == BuyerSignInStatus.signedIn && controller.token == buyerBToken,
      pumpDuration: const Duration(milliseconds: 20),
    );
    await tester.pump();
    expect(find.text('12 MG Road, Bengaluru, Karnataka 560001'), findsNothing, reason: 'Buyer A\'s address must never render once Buyer B is current');

    // The generation bump this triggers must start a fresh, independent request for Buyer B --
    // never left stuck on Buyer A's still-outstanding load.
    await pumpUntil(
      tester,
      () => find.text('7 Brigade Road, Bengaluru, Karnataka 560025').evaluate().isNotEmpty,
      pumpDuration: const Duration(milliseconds: 20),
    );
    await tester.pump();
    expect(find.text('7 Brigade Road, Bengaluru, Karnataka 560025'), findsOneWidget, reason: 'the sheet loaded Buyer B\'s own addresses');
    expect(find.byType(CircularProgressIndicator), findsNothing, reason: 'recovered, not stuck loading forever');

    // Only now does Buyer A's held response actually arrive -- late, after Buyer B is current.
    gateway.releaseHeldToken();
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka 560001'), findsNothing, reason: 'Buyer A\'s late response was never applied');
    expect(find.text('7 Brigade Road, Bengaluru, Karnataka 560025'), findsOneWidget);
  });

  testWidgets('a network failure on load is shown as offline, and Retry recovers', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addressesByToken[sessionToken] = [
      {
        'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
        'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': true,
      },
    ];
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    gateway.offline = true;
    await tester.pumpWidget(wrap(h.controller, h.addresses));
    await tester.pumpAndSettle();
    expect(find.textContaining('offline'), findsOneWidget);

    gateway.offline = false;
    await tester.tap(find.text('Retry'));
    await pumpUntil(tester, () => find.text('12 MG Road, Bengaluru, Karnataka 560001').evaluate().isNotEmpty);
    await tester.pump();
    expect(find.text('12 MG Road, Bengaluru, Karnataka 560001'), findsOneWidget);
    h.controller.dispose();
  });
}
