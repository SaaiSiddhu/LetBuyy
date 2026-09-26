// C3 (Firebase SDK removal) -- regression coverage for checkout_screen.dart's own address list.
// _loadAddresses() read FirebaseFirestore.instance.collection('addresses') directly, guarded by
// safeFirebaseUserId() == null (always true under canonical auth). That guard `return`ed without
// ever setting _isLoadingAddresses to false, so this was worse than "always empty": every real
// buyer who reached checkout saw the address section spin forever, with "Continue to Payment"
// permanently disabled (hasAddress can never become true) -- checkout was completely blocked, not
// merely missing an address. Now reads through the same canonical BuyerAddressApi
// letbuyy_account_screen.dart and address_selection_sheet.dart already use, and resets the loading
// flag on every path, including "not signed in."
//
// Reuses the same fake-server/account harness address_selection_sheet_test.dart and
// home_app_bar_address_test.dart established -- duplicated rather than shared, per those files'
// own stated reasoning.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/checkout/checkout_screen.dart';
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
  const _ScriptedBrowser({this.code = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'});
  final String code;

  @override
  Future<Uri?> authorize(Uri url) async =>
      Uri.parse('com.letbuyy.letbuyy:/oauth/callback?code=$code&state=${url.queryParameters['state']}');
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

class FakeGateway {
  FakeGateway({this.validToken = sessionToken, String email = 'asha@example.com'})
      : account = {'id': 'buyer-1', 'email': email, 'email_verified': true, 'full_name': 'Asha Verma', 'phone': null};

  String validToken;
  Map<String, Object?> account;
  final Map<String, List<Map<String, Object?>>> addressesByToken = {};

  Dio dio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) {
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
      ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
    ],
    child: const MaterialApp(
      home: CheckoutScreen(),
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
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('a signed-in buyer\'s real address renders, and checkout is never stuck loading forever', (tester) async {
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

    expect(find.byType(CircularProgressIndicator), findsNothing,
        reason: 'must not be stuck loading -- the old guard never reset _isLoadingAddresses');
    expect(find.text('Asha Verma'), findsOneWidget,
        reason: 'the buyer\'s real saved address must render, not the always-empty legacy Firestore result');
    expect(find.text('Continue to Payment'), findsOneWidget,
        reason: 'a real address must actually enable proceeding to payment');
    h.controller.dispose();
  });

  testWidgets('a guest sees the honest empty state, not a permanent spinner', (tester) async {
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

    expect(find.byType(CircularProgressIndicator), findsNothing,
        reason: 'the old guard\'s `return` before resetting _isLoadingAddresses left this spinning forever for every real buyer');
    expect(find.text('No addresses found'), findsOneWidget);
    // 'Select Address' appears twice with no address selected -- the app bar's own static title
    // (always present) and the disabled bottom button's label (shown only when !hasAddress) --
    // both count as proof proceeding to payment stays disabled here.
    expect(find.text('Select Address'), findsNWidgets(2));
    controller.dispose();
  });
}
