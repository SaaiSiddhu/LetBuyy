// Explicit widget fakes reproduce stale account reads/saves. These checks do
// not replace the real Android/Gateway/PostgreSQL account journey.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'package:letbuyy_marketplace/screens/profile/edit_profile_screen.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'support/buyer_session_fixture.dart';

BuyerAccount buyer(String token, {String? name, String? phone}) => BuyerAccount(
  id: 'buyer-$token', email: 'syn-$token@example.invalid', emailVerified: true,
  fullName: name ?? 'NAME-$token', phone: phone,
);

class _Accounts extends BuyerAccountApi {
  _Accounts() : super(ApiClient(baseUrl: 'https://gateway.example.invalid'));
  Future<BuyerAccount> Function(String) read = (token) async => buyer(token);
  Future<BuyerAccount> Function(String, Object?, Object?) save =
      (token, name, phone) async => buyer(token, name: name as String?, phone: phone as String?);
  final writes = <String>[];
  @override Future<BuyerAccount> account(String token) => read(token);
  @override Future<BuyerAccount> updateProfile(String token, {Object? fullName, Object? phone}) {
    writes.add(token); return save(token, fullName, phone);
  }
}

Widget wrap(BuyerSignInController auth, _Accounts accounts) => MultiProvider(
  providers: [
    ChangeNotifierProvider<BuyerSignInController>.value(value: auth),
    Provider<BuyerAccountApi>.value(value: accounts),
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
  ],
  child: MaterialApp(home: const Scaffold(body: Text('PROFILE ROOT')),
    initialRoute: '/edit', routes: {'/edit': (_) => const EditProfileScreen()}),
);

Future<void> switchBuyer(WidgetTester tester, BuyerSignInController auth) async {
  await tester.runAsync(auth.signOut); await tester.pump();
  await tester.runAsync(auth.signIn); await tester.pump();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('a delayed A profile cannot populate B after the session switches', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    final accounts = _Accounts(), lateA = Completer<BuyerAccount>();
    accounts.read = (token) => token == 'A' ? lateA.future : Future.value(buyer(token));
    await tester.pumpWidget(wrap(auth, accounts)); await tester.pump();
    await switchBuyer(tester, auth); await tester.pump(const Duration(seconds: 2));
    lateA.complete(buyer('A', name: 'PRIVATE-A')); await tester.pumpAndSettle();
    expect(find.text('PRIVATE-A'), findsNothing); expect(find.text('NAME-B'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('signing out immediately hides an already loaded private profile', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    await tester.pumpWidget(wrap(auth, _Accounts())); await tester.pumpAndSettle();
    expect(find.text('NAME-A'), findsOneWidget);
    await tester.runAsync(auth.signOut); await tester.pumpAndSettle();
    expect(find.text('NAME-A'), findsNothing); expect(find.byType(TextFormField), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('late A save cannot show success or pop B editor', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    final accounts = _Accounts(), lateSave = Completer<BuyerAccount>();
    accounts.read = (token) async => buyer(token, phone: '9000000011');
    accounts.save = (_, _, _) => lateSave.future;
    await tester.pumpWidget(wrap(auth, accounts)); await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Save Changes')); await tester.tap(find.text('Save Changes')); await tester.pump();
    expect(accounts.writes, ['A']); await switchBuyer(tester, auth);
    lateSave.complete(buyer('A')); await tester.pump(); await tester.pump(const Duration(seconds: 2)); await tester.pumpAndSettle();
    expect(find.text('NAME-B'), findsOneWidget); expect(find.text('PROFILE ROOT'), findsNothing);
    expect(find.textContaining('Profile updated successfully'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('a buyer can save a profile without adding an unverified phone', (tester) async {
    final auth = (await tester.runAsync(createSyntheticBuyerSession))!; addTearDown(auth.dispose);
    final accounts = _Accounts();
    await tester.pumpWidget(wrap(auth, accounts)); await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Save Changes')); await tester.tap(find.text('Save Changes')); await tester.pump();
    expect(accounts.writes, ['A']); await tester.pump(const Duration(seconds: 2)); await tester.pumpAndSettle();
    expect(find.text('PROFILE ROOT'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
