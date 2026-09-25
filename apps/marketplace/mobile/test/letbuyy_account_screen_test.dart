// SUSTAINED-L — the signed-in buyer's canonical profile/address screen, with the gateway replaced
// by a fake, stateful in-memory server (the same Dio-interceptor style buyer_sign_in_controller_test.dart
// already uses), so create/edit/delete/list round-trip realistically rather than against one-shot stubs.
//
// What must hold: the real account and addresses render; a profile edit only succeeds after the
// server confirms it, and a validation failure or a server/network failure never shows success; every
// CRUD address action reaches the right endpoint and updates the list; a second tap on an in-flight
// mutation is a no-op, not a second request; an ended session is shown, not silently retried forever;
// signing out clears every trace of the signed-in buyer's data from the widget tree; and a response
// for a buyer session that has since changed is never applied.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_session_store.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_browser.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/profile/letbuyy_account_screen.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

const sessionToken = 'buyer-session-token';

/// CustomTextField renders its label as a Text SIBLING of the TextFormField it wraps, not a
/// descendant of it -- so `find.widgetWithText(TextFormField, label)` can never match. This finds
/// the TextFormField inside the CustomTextField that has the given label instead.
Finder textField(String label) => find.descendant(
      of: find.widgetWithText(CustomTextField, label),
      matching: find.byType(TextFormField),
    );

class _MemoryStore implements BuyerSessionStore {
  _MemoryStore(this.session);
  StoredBuyerSession? session;

  @override
  Future<StoredBuyerSession?> readSession() async => session;
  @override
  Future<void> writeSession(StoredBuyerSession value) async => session = value;
  @override
  Future<void> deleteSession() async => session = null;
  @override
  Future<PendingBuyerSignIn?> readPending() async => null;
  @override
  Future<void> writePending(PendingBuyerSignIn value) async {}
  @override
  Future<void> deletePending() async {}
}

class _NoBrowser implements BuyerSignInBrowser {
  @override
  Future<Uri?> authorize(Uri url) async => null;
  @override
  Future<Uri?> takeLaunchCallback() async => null;
  @override
  Future<void> cancelWaiting() async {}
}

/// A tiny, stateful stand-in for the gateway's /storefront/buyer/{account,profile,addresses} routes,
/// keyed by the token in the request -- a wrong or missing token answers 401, exactly like
/// requireBuyerSession would fail closed for a session that no longer exists.
class FakeGateway {
  FakeGateway({this.validToken = sessionToken, String email = 'asha@example.com'})
      : account = {'id': 'buyer-1', 'email': email, 'email_verified': true, 'full_name': null, 'phone': null};

  String validToken;
  Map<String, Object?> account;
  final List<Map<String, Object?>> addresses = [];
  int accountReads = 0;
  int addressListReads = 0;
  int addressPatchRequests = 0;
  bool offline = false;
  int? forceStatus;
  int _nextId = 1;

  /// When set, every request is held open until this completes -- creates a real "in flight" window
  /// to prove a second tap during it never fires a second request.
  Completer<void>? holdRequests;

  /// Counted the instant a request ARRIVES, before any hold -- so a request parked on `holdRequests`
  /// still counts as "reached the server" for a duplicate-tap assertion.
  int requestsReceived = 0;

  Dio dio() {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (o, handler) async {
      requestsReceived++;
      final hold = holdRequests;
      if (hold != null) await hold.future;
      if (offline) {
        handler.reject(DioException(requestOptions: o, type: DioExceptionType.connectionError));
        return;
      }
      final token = o.headers['X-LetBuyy-Buyer-Session'] as String?;
      if (token != validToken) {
        handler.resolve(Response(requestOptions: o, statusCode: 401, data: {'success': false, 'error': {'code': 'UNAUTHORIZED', 'message': 'x'}}));
        return;
      }
      if (forceStatus != null) {
        handler.resolve(Response(requestOptions: o, statusCode: forceStatus!, data: {'success': false, 'error': {'code': 'DB_ERROR', 'message': 'x'}}));
        return;
      }
      final path = o.path;
      if (path.endsWith('/buyer/account') && o.method == 'GET') {
        accountReads++;
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'buyer': account}}));
        return;
      }
      if (path.endsWith('/buyer/profile') && o.method == 'PATCH') {
        final body = o.data as Map;
        if (body.containsKey('full_name')) account['full_name'] = body['full_name'];
        if (body.containsKey('phone')) account['phone'] = body['phone'];
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'buyer': account}}));
        return;
      }
      if (path.endsWith('/buyer/addresses') && o.method == 'GET') {
        addressListReads++;
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'addresses': addresses}}));
        return;
      }
      if (path.endsWith('/buyer/addresses') && o.method == 'POST') {
        final body = Map<String, Object?>.from(o.data as Map);
        body['id'] = 'addr-${_nextId++}';
        if (body['is_default'] == true) {
          for (final a in addresses) a['is_default'] = false;
        }
        addresses.add(body);
        handler.resolve(Response(requestOptions: o, statusCode: 201, data: {'success': true, 'data': {'address': body}}));
        return;
      }
      final addressIdMatch = RegExp(r'/buyer/addresses/([^/]+)$').firstMatch(path);
      if (addressIdMatch != null && o.method == 'PATCH') {
        addressPatchRequests++;
        final id = addressIdMatch.group(1);
        final existing = addresses.where((a) => a['id'] == id).firstOrNull;
        if (existing == null) {
          handler.resolve(Response(requestOptions: o, statusCode: 404, data: {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'x'}}));
          return;
        }
        final body = o.data as Map;
        if (body['is_default'] == true) {
          for (final a in addresses) a['is_default'] = false;
        }
        existing.addAll(body.cast<String, Object?>());
        handler.resolve(Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'address': existing}}));
        return;
      }
      if (addressIdMatch != null && o.method == 'DELETE') {
        final id = addressIdMatch.group(1);
        final existed = addresses.any((a) => a['id'] == id);
        addresses.removeWhere((a) => a['id'] == id);
        handler.resolve(existed
            ? Response(requestOptions: o, statusCode: 200, data: {'success': true, 'data': {'deleted': true}})
            : Response(requestOptions: o, statusCode: 404, data: {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'x'}}));
        return;
      }
      handler.resolve(Response(requestOptions: o, statusCode: 404, data: {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'unmapped'}}));
    }));
    return dio;
  }
}

({BuyerSignInController controller, BuyerAccountApi accounts, BuyerAddressApi addresses, FakeGateway gateway, _MemoryStore store}) harness({
  FakeGateway? gateway,
}) {
  final gw = gateway ?? FakeGateway();
  final client = ApiClient(baseUrl: 'https://gateway.test/v1', dio: gw.dio(), maxRetries: 0);
  final accounts = BuyerAccountApi(client);
  final store = _MemoryStore(StoredBuyerSession(token: gw.validToken, expiresAt: DateTime.utc(2100)));
  final controller = BuyerSignInController(
    client: BuyerSignInClient(identityBaseUrl: 'https://accounts.letbuyy.test'),
    accounts: accounts,
    browser: _NoBrowser(),
    store: store,
  );
  return (controller: controller, accounts: accounts, addresses: BuyerAddressApi(client), gateway: gw, store: store);
}

Widget wrap(BuyerSignInController controller, BuyerAccountApi accounts, BuyerAddressApi addresses) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<BuyerSignInController>.value(value: controller),
      Provider<BuyerAccountApi>.value(value: accounts),
      Provider<BuyerAddressApi>.value(value: addresses),
    ],
    child: const MaterialApp(home: LetBuyyAccountScreen()),
  );
}

void main() {
  testWidgets('loading, then the real profile and an empty address list render', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    expect(find.byType(CircularProgressIndicator), findsWidgets);
    await tester.pumpAndSettle();
    expect(find.text('asha@example.com'), findsOneWidget);
    expect(find.text('No saved addresses yet'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('a successful profile update shows the saved values after the server confirms them', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();

    await tester.enterText(textField('Full name'), 'Asha Verma');
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ElevatedButton, 'Save profile').hitTestable(), warnIfMissed: false);
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump();
    expect(find.text('Profile updated.'), findsOneWidget);
    expect(h.gateway.account['full_name'], 'Asha Verma');
    h.controller.dispose();
  });

  testWidgets('an oversized name is rejected before any request is sent, and the input is kept', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();

    await tester.enterText(textField('Full name'), 'x' * 201);
    await tester.tap(find.widgetWithText(ElevatedButton, 'Save profile').hitTestable(), warnIfMissed: false);
    await tester.pump();
    expect(find.textContaining('200 characters'), findsOneWidget);
    expect(textField('Full name'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('a server failure on save never shows success, and the typed name is preserved', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();

    h.gateway.forceStatus = 500;
    await tester.enterText(textField('Full name'), 'Asha Verma');
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ElevatedButton, 'Save profile').hitTestable(), warnIfMissed: false);
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump();
    expect(find.text('Profile updated.'), findsNothing);
    expect(find.textContaining('couldn’t save your profile'), findsOneWidget);
    expect(find.text('Asha Verma'), findsOneWidget, reason: 'the typed name survives a failed save');
    h.controller.dispose();
  });

  testWidgets('adding, editing, setting default, and deleting an address round-trip through the fake server', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add'));
    await tester.pumpAndSettle();
    // "Full name" is ambiguous here: the profile card behind the sheet still has one too. The
    // sheet's own is added later in the tree, so .last is the address editor's.
    await tester.enterText(textField('Full name').last, 'Asha Verma');
    await tester.enterText(textField('Address line 1'), '12 MG Road');
    await tester.enterText(textField('City'), 'Bengaluru');
    await tester.enterText(textField('State'), 'Karnataka');
    await tester.enterText(textField('PIN code'), '560001');
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ElevatedButton, 'Save address'));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump();
    expect(find.text('12 MG Road, Bengaluru, Karnataka, 560001'), findsOneWidget);
    expect(h.gateway.addresses, hasLength(1));

    // Set as default.
    await tester.runAsync(() async {
      await tester.tap(find.text('Set as default'));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump();
    expect(find.text('Default'), findsOneWidget);
    expect(h.gateway.addresses.single['is_default'], true);

    // Edit.
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    await tester.enterText(textField('City'), 'Mysuru');
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ElevatedButton, 'Save address'));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump();
    // Not find.textContaining('Mysuru') -- the sheet's own now-dismissing City field can still hold
    // an EditableText with the same text mid-animation, making that finder ambiguous. The card's
    // exact, single-line summary is unambiguous.
    expect(find.text('12 MG Road, Mysuru, Karnataka, 560001'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('Remove, with confirmation, deletes the address and shows the empty state', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addresses.add({
      'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
      'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': false,
    });
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka, 560001'), findsOneWidget);

    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(find.text('Remove this address?'), findsOneWidget);

    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(TextButton, 'Remove').last);
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    // The dialog's own exit transition needs real animation time beyond a bare pump() -- advance
    // the test clock through it explicitly, matching the route transition's own duration.
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();
    expect(find.text('No saved addresses yet'), findsOneWidget);
    expect(gateway.addresses, isEmpty);
    h.controller.dispose();
  });

  testWidgets('Cancelling the confirmation dialog deletes nothing', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addresses.add({
      'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
      'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': false,
    });
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('12 MG Road, Bengaluru, Karnataka, 560001'), findsOneWidget);
    expect(gateway.addresses, hasLength(1));
    h.controller.dispose();
  });

  testWidgets('a second tap on Set as default while the first is still in flight sends only one request', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    gateway.addresses.add({
      'id': 'addr-1', 'label': 'home', 'full_name': 'Asha Verma', 'address_line1': '12 MG Road',
      'city': 'Bengaluru', 'state': 'Karnataka', 'postal_code': '560001', 'country': 'IN', 'is_default': false,
    });
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();

    final baseline = gateway.requestsReceived;
    final hold = Completer<void>();
    gateway.holdRequests = hold;
    // _setDefault's setState marking this address "mutating" runs synchronously, before its first
    // await -- so by the time this tap() returns, the guard is already up and the request is
    // parked on `hold`.
    await tester.runAsync(() async {
      await tester.tap(find.text('Set as default'));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();

    final button = tester.widget<TextButton>(find.ancestor(of: find.text('Set as default'), matching: find.byType(TextButton)));
    expect(button.onPressed, isNull, reason: 'disabled while its own request is in flight -- a second tap has nothing to trigger');
    expect(gateway.requestsReceived - baseline, 1, reason: 'exactly the one PATCH the first tap sent, now parked on hold');

    hold.complete();
    await tester.runAsync(() async => Future<void>.delayed(const Duration(milliseconds: 100)));
    await tester.pump();
    await tester.pump();
    expect(gateway.addressPatchRequests, 1, reason: 'still exactly one request once the in-flight call finishes');
    expect(find.text('Default'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('an ended session while viewing this screen shows a signed-out empty state, not a crash', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final h = harness();
    await tester.runAsync(h.controller.start);
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();
    expect(find.text('asha@example.com'), findsOneWidget);

    await tester.runAsync(h.controller.signOut);
    await tester.pumpAndSettle();
    expect(find.text('You’re signed out of LetBuyy'), findsOneWidget);
    expect(find.text('asha@example.com'), findsNothing, reason: 'no trace of the signed-out buyer\'s data remains');
    h.controller.dispose();
  });

  testWidgets('a load that fails with 401 is shown as an ended session, never a generic error', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    // The session is valid at restore time but the gateway then invalidates it (e.g. sign-out
    // everywhere from another device) before this screen's own account() read lands.
    gateway.validToken = 'a-different-token';
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();
    expect(find.textContaining('sign-in has ended'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('a network failure on load is shown as offline, and Retry recovers', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);
    gateway.offline = true;
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.pumpAndSettle();
    expect(find.textContaining('offline'), findsOneWidget);

    gateway.offline = false;
    await tester.runAsync(() async {
      await tester.tap(find.widgetWithText(ElevatedButton, 'Try Again'));
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    await tester.pump();
    await tester.pump();
    expect(find.text('asha@example.com'), findsOneWidget);
    h.controller.dispose();
  });

  testWidgets('a stale in-flight load for a buyer who has since signed out is never applied', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final gateway = FakeGateway();
    final h = harness(gateway: gateway);
    await tester.runAsync(h.controller.start);

    // Start the screen's load, then sign out before the fake server's response is processed --
    // WidgetsBinding's post-frame callback means the request has not resolved yet at this point.
    await tester.pumpWidget(wrap(h.controller, h.accounts, h.addresses));
    await tester.runAsync(h.controller.signOut);
    await tester.pumpAndSettle();

    expect(find.text('You’re signed out of LetBuyy'), findsOneWidget);
    expect(find.text('asha@example.com'), findsNothing, reason: 'the in-flight response for the signed-out buyer must never populate the screen');
    h.controller.dispose();
  });
}
