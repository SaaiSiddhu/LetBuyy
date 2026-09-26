// C3 corrective -- regression coverage for saved_addresses_screen.dart's disposition. That screen
// was disconnected from the legacy Firestore-backed AddressProvider in an earlier C2 pass and, from
// then on, unconditionally rendered "No Saved Addresses" regardless of whether the buyer actually
// had any -- a dead end reached from four real entry points (profile_screen.dart's two "Addresses"
// tiles, web_header.dart's and shop_app_bar.dart's header pills). It had no canonical successor
// wired in and could not add, edit, delete or set a default address.
//
// letbuyy_account_screen.dart is the already-existing, already-working canonical address book
// (BuyerAddressApi-backed, full list/add/edit/delete/set-default) -- address_selection_sheet.dart's
// own "Add"/"Edit" actions already redirect there instead of duplicating that work. Rather than
// REWIRE saved_addresses_screen.dart into a second, parallel address-management screen, all four
// entry points (plus the addresses/'/profile/addresses' route itself) now point at the one real
// screen, and saved_addresses_screen.dart is deleted outright.
//
// This proves the route a buyer actually lands on (AppRoutes.addresses, exactly what all four entry
// points navigate to) now shows a real, saved address -- not the old, permanent empty state.
//
// Reuses the same fake-server/account harness address_selection_sheet_test.dart and
// home_app_bar_address_test.dart established -- duplicated rather than shared, per those files' own
// stated reasoning.

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
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
  const _ScriptedBrowser({this.code = 'EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE'});
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

Widget wrap(BuyerSignInController controller, BuyerAddressApi addresses, BuyerAccountApi accounts, String initialRoute) {
  // Builds the exact widget AppRoutes.onGenerateRoute resolves the route to, and pumps only that
  // -- not `MaterialApp(initialRoute: ...)`, which for a nested-path route name like
  // '/profile/addresses' falls into Flutter's default initial-route splitting (it also tries to
  // build '/' and '/profile' as their own routes first, pulling in the full app shell's own,
  // unrelated provider requirements). This targets precisely what every real entry point does:
  // resolve this one route name and render what it builds.
  final route = AppRoutes.onGenerateRoute(RouteSettings(name: initialRoute)) as MaterialPageRoute;
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<BuyerSignInController>.value(value: controller),
      Provider<BuyerAddressApi>.value(value: addresses),
      Provider<BuyerAccountApi>.value(value: accounts),
    ],
    child: MaterialApp(
      home: Builder(builder: route.builder),
    ),
  );
}

({BuyerSignInController controller, BuyerAddressApi addresses, BuyerAccountApi accounts, FakeGateway gateway}) harness({FakeGateway? gateway}) {
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
  return (controller: controller, addresses: BuyerAddressApi(client), accounts: accounts, gateway: gw);
}

void main() {
  testWidgets('AppRoutes.addresses shows the buyer\'s real saved address, not the old dead-end empty state', (tester) async {
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
    await tester.pumpWidget(wrap(h.controller, h.addresses, h.accounts, AppRoutes.addresses));
    await tester.pumpAndSettle();

    expect(find.text('Asha Verma'), findsWidgets,
        reason: 'the buyer\'s real saved address must render on the route every entry point navigates to');
    expect(find.text('No Saved Addresses'), findsNothing,
        reason: 'the old, permanent SavedAddressesScreen empty state must be gone');
    expect(find.text('No saved addresses yet'), findsNothing,
        reason: 'letbuyy_account_screen.dart\'s own empty state must not show when a real address exists');
    h.controller.dispose();
  });

  testWidgets('AppRoutes.letbuyyAccount lands on the same real address book', (tester) async {
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
    await tester.pumpWidget(wrap(h.controller, h.addresses, h.accounts, AppRoutes.letbuyyAccount));
    await tester.pumpAndSettle();

    expect(find.text('12 MG Road, Bengaluru, Karnataka, 560001'), findsOneWidget);
    h.controller.dispose();
  });
}
