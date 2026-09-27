// C3 (Firebase SDK removal, 27 September 2026 review finding 3 follow-up) -- regression coverage
// for home_app_bar.dart's own independent, legacy Firebase-backed address display
// (_buildAddressStream/_buildAddressContent, now _HomeDeliveryAddressBar): it read
// FirebaseFirestore.instance.collection('addresses') directly, guarded by
// safeFirebaseUserId() == null, which is always true under canonical auth -- so the app's most-
// visited screen always showed the same "Select delivery location"/"Add delivery address" default,
// even for a signed-in buyer with a real saved address, and even after address_selection_sheet.dart
// (fixed in an earlier commit) let them pick one. This proves the home bar now shows the buyer's
// real default address, and that picking a different one in the sheet updates the bar immediately
// with no extra network round trip.
//
// Reuses the same fake-server/account harness address_selection_sheet_test.dart and
// letbuyy_account_screen_test.dart established (a stateful in-memory Dio interceptor, a scripted
// OAuth browser) -- duplicated rather than shared, per those files' own stated reasoning: this file
// only needs the addresses endpoint, and copying it here keeps it self-contained.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/home_app_bar.dart';
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

class _ScriptedBrowser implements BuyerSignInBrowser {
  const _ScriptedBrowser({this.code = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'});
  final String code;

  @override
  Future<Uri?> authorize(Uri url) async =>
      Uri.parse('com.letbuyy.letbuyy:/oauth/callback?code=$code&state=${url.queryParameters['state']}');
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

/// A tiny, stateful stand-in for the gateway's /storefront/buyer/{account,addresses} routes.
class FakeGateway {
  FakeGateway({this.validToken = sessionToken, String email = 'asha@example.com'})
      : account = {'id': 'buyer-1', 'email': email, 'email_verified': true, 'full_name': null, 'phone': null};

  String validToken;
  Map<String, Object?> account;
  final Map<String, List<Map<String, Object?>>> addressesByToken = {};
  int requestsReceived = 0;

  Dio dio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
      requestsReceived++;
      final token = o.headers['X-LetBuyy-Buyer-Session'] as String?;
      if (token != validToken) {
        handler.resolve(Response(requestOptions: o, statusCode: 401, data: {'success': false, 'error': {'code': 'UNAUTHORIZED', 'message': 'x'}}));
        return;
      }
      final path = o.path;
      if (path.endsWith('/buyer/account') && o.method == 'GET') {
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'buyer': account}}));
        return;
      }
      if (path.endsWith('/buyer/addresses') && o.method == 'GET') {
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'addresses': addressesByToken[token] ?? const []}}));
        return;
      }
      handler.resolve(Response(requestOptions: o, statusCode: 404, data: {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'unmapped'}}));
    }));
    return dio;
  }
}

Widget wrap(BuyerSignInController controller, BuyerAddressApi addresses) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<BuyerSignInController>.value(value: controller),
      Provider<BuyerAddressApi>.value(value: addresses),
      ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
    ],
    child: const MaterialApp(
      home: Scaffold(
        body: HomeAppBar(scrollOffset: 0),
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
    browser: const _ScriptedBrowser(),
    store: store,
  );
  return (controller: controller, addresses: BuyerAddressApi(client), gateway: gw);
}

void main() {
  testWidgets('the home app bar shows the signed-in buyer\'s real default address, not a fixed placeholder', (tester) async {
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
    expect(find.text('12 MG Road, Bengaluru, Karnataka'), findsOneWidget,
        reason: 'must show the real saved address, not the always-empty legacy Firestore default');
    expect(find.text('Select delivery location'), findsNothing);
    h.controller.dispose();
  });

  testWidgets('a guest with no session sees the honest placeholder, not a stale or fabricated address', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final store = _MemoryStore(null);
    final gateway = FakeGateway();
    final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: gateway.dio(), maxRetries: 0);
    final controller = BuyerSignInController(
      client: BuyerSignInClient(identityBaseUrl: 'https://accounts.letbuyy.test'),
      accounts: BuyerAccountApi(client),
      browser: const _ScriptedBrowser(),
      store: store,
    );
    await tester.runAsync(controller.start);
    await tester.pumpWidget(wrap(controller, BuyerAddressApi(client)));
    await tester.pumpAndSettle();
    expect(find.text('Select delivery location'), findsOneWidget);
    expect(gateway.requestsReceived, 0, reason: 'a guest must never reach the addresses endpoint');
    controller.dispose();
  });

  testWidgets('picking a different address in the sheet updates the bar immediately, with no extra round trip', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addressesByToken[sessionToken] = [
      {
        'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
        'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': true,
      },
      {
        'id': 'addr-2', 'label': 'work', 'full_name': 'Priya Rao', 'address_line1': '9 Park Avenue',
        'city': 'Pune', 'state': 'Maharashtra', 'postal_code': '411001', 'country': 'IN', 'is_default': false,
      },
    ];
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.addresses));
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka'), findsOneWidget);

    await tester.tap(find.text('12 MG Road, Bengaluru, Karnataka'));
    await tester.pumpAndSettle();
    expect(find.text('Priya Rao'), findsOneWidget, reason: 'the sheet opened and loaded both saved addresses');

    final requestsBeforeSelection = gateway.requestsReceived;
    await tester.tap(find.text('Priya Rao'));
    await tester.pumpAndSettle();

    expect(find.text('9 Park Avenue, Pune, Maharashtra'), findsOneWidget,
        reason: 'the bar reflects the newly-picked address the instant the sheet closes');
    expect(find.text('12 MG Road, Bengaluru, Karnataka'), findsNothing);
    expect(gateway.requestsReceived, requestsBeforeSelection,
        reason: 'the bar must use the address the sheet already resolved, not fetch it again');
    h.controller.dispose();
  });
}
