// Explicit widget transport fakes. The app supplies this same canonical API
// provider; actual Gateway/database and native device proofs are separate.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/profile/profile_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'support/buyer_session_fixture.dart';

List<BuyerAddress> addresses(int count) => List.generate(count, (i) => BuyerAddress(
  id: 'address-$i', label: 'home', fullName: 'Synthetic recipient',
  addressLine1: 'Synthetic address', city: 'Chennai', state: 'Tamil Nadu',
  postalCode: '600001', country: 'IN', isDefault: i == 0,
));

class _Addresses extends BuyerAddressApi {
  _Addresses() : super(ApiClient(baseUrl: 'https://gateway.example.invalid'));
  Future<List<BuyerAddress>> Function(String) read = (_) async => addresses(0);
  @override Future<List<BuyerAddress>> list(String token) => read(token);
}

Widget wrap(BuyerSignInController auth, _Addresses api) => MultiProvider(providers: [
  ChangeNotifierProvider<BuyerSignInController>.value(value: auth),
  Provider<BuyerAddressApi>.value(value: api),
  ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
  ChangeNotifierProvider<WishlistProvider>(create: (_) => WishlistProvider()),
], child: MaterialApp(home: const ProfileScreen(), routes: {
  AppRoutes.letbuyyAccount: (context) => Scaffold(body: TextButton(
    onPressed: () => Navigator.pop(context), child: const Text('Return from address book'))),
}));

Future<void> switchBuyer(WidgetTester tester, BuyerSignInController auth) async {
  await tester.runAsync(auth.signOut); await tester.pump();
  await tester.runAsync(auth.signIn); await tester.pump();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets('late A address count cannot replace B count after a switch', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    final api = _Addresses(), lateA = Completer<List<BuyerAddress>>();
    api.read = (token) => token == 'A' ? lateA.future : Future.value(addresses(1));
    await tester.pumpWidget(wrap(auth, api)); await tester.pump();
    await switchBuyer(tester, auth); await tester.pump(const Duration(seconds: 2));
    lateA.complete(addresses(9)); await tester.pumpAndSettle();
    expect(find.text('1 saved'), findsOneWidget); expect(find.text('9 saved'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('B loading/failure never displays A count or a fabricated empty count', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    final api = _Addresses(), lateB = Completer<List<BuyerAddress>>();
    api.read = (token) => token == 'A' ? Future.value(addresses(4)) : lateB.future;
    await tester.pumpWidget(wrap(auth, api)); await tester.pumpAndSettle();
    expect(find.text('4 saved'), findsOneWidget);
    await switchBuyer(tester, auth); await tester.pump(const Duration(seconds: 2));
    expect(find.text('4 saved'), findsNothing);
    lateB.completeError(const ApiException(message: 'Unavailable', statusCode: 500, code: 'SERVER_ERROR')); await tester.pumpAndSettle();
    expect(find.text('4 saved'), findsNothing); expect(find.text('0 saved'), findsNothing);
    expect(find.text('Manage addresses'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('returning from the canonical address book refreshes the current buyer count', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    final api = _Addresses(); var count = 2; api.read = (_) async => addresses(count);
    await tester.pumpWidget(wrap(auth, api)); await tester.pumpAndSettle();
    expect(find.text('2 saved'), findsOneWidget);
    await tester.ensureVisible(find.text('Addresses')); await tester.tap(find.text('Addresses')); await tester.pumpAndSettle();
    count = 3; await tester.tap(find.text('Return from address book')); await tester.pumpAndSettle();
    expect(find.text('3 saved'), findsOneWidget); expect(find.text('2 saved'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
