// C3 (Firebase SDK removal) -- regression coverage for web_mobile_header.dart's own independent,
// legacy Firebase-backed address display (_buildAddressText/_addressTapWrapper, now
// _WebDeliveryAddressBar): the web platform's own copy of the exact bug already fixed in
// home_app_bar.dart (see home_app_bar_address_test.dart and that widget's own doc comment for the
// full account). It read FirebaseFirestore.instance.collection('addresses') directly, guarded by
// safeFirebaseUserId() == null, which is always true under canonical auth -- so this header,
// present on every web page via WebMobileHeader, always showed "Select delivery location," never a
// real signed-in buyer's actual address. This proves the header now shows the buyer's real default
// address (in this header's own "city - postal code" format), and that its tap target opens the
// same working AddressSelectionSheet home_app_bar.dart's bar uses, not the dead-end
// '/profile/addresses' route (saved_addresses_screen.dart always renders an empty state).
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
import 'package:letbuyy_marketplace/widgets/web_mobile_header.dart';
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
  const _ScriptedBrowser({this.code = 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'});
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
      : account = {'id': 'buyer-1', 'email': email, 'email_verified': true, 'full_name': null, 'phone': null};

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
      // WebMobileHeader's own top row shows a cart badge via Consumer<CartProvider>.
      ChangeNotifierProvider<CartProvider>(create: (_) => CartProvider()),
    ],
    child: const MaterialApp(
      home: Scaffold(
        body: WebMobileHeader(),
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
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('the web header shows the signed-in buyer\'s real default address, not a fixed placeholder', (tester) async {
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
    expect(find.text('Bengaluru - 560001'), findsOneWidget,
        reason: 'must show the real saved address, not the always-empty legacy Firestore default');
    expect(find.text('Select delivery location'), findsNothing);
    expect(find.text('Location not set'), findsNothing,
        reason: 'the redundant hardcoded label next to a real address must be gone');
    h.controller.dispose();
  });

  testWidgets('a guest with no session sees the honest placeholder', (tester) async {
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
    controller.dispose();
  });

  testWidgets('tapping opens the real AddressSelectionSheet, not the dead-end saved-addresses route', (tester) async {
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

    await tester.tap(find.text('Bengaluru - 560001'));
    await tester.pumpAndSettle();
    expect(find.text('Asha Verma'), findsOneWidget,
        reason: 'the real address-picker sheet opened, listing the buyer\'s own saved address');
    h.controller.dispose();
  });
}
