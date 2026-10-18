// Widget/controlled transport proof; normal Android evidence is separate.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';
import 'package:letbuyy_store/screens/security/two_factor_screen.dart';
import 'two_factor_security_test.dart' show FactorTransport;
import 'support/loyalty_fixture.dart' show MemoryStorage;

class SecurityHarness {
  String actor = 'actor-a';
  final storage = MemoryStorage();
  late FactorTransport api;
  late StoreContext stores;
  late TwoFactorService service;
  MerchantStepUpProof? proof;
  Future<void> init({bool enrolled = true}) async {
    api = FactorTransport(context: () => stores.requestContextKey)
      ..enrolled = enrolled;
    stores = StoreContext(storeService: StoreService(api: api));
    await stores.bindActor(actor);
    await stores.ensureSelectedStore();
    service = TwoFactorService(
      api: api,
      actorIdProvider: () => actor,
      storeIdProvider: () => stores.selectedStoreId,
      storage: storage,
    );
  }

  Widget app({String? action}) => MultiProvider(
    providers: [
      ChangeNotifierProvider<StoreContext>.value(value: stores),
      ChangeNotifierProvider<TwoFactorService>.value(value: service),
    ],
    child: MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () async {
              proof = await Navigator.of(context).push<MerchantStepUpProof>(
                MaterialPageRoute(
                  builder: (_) => TwoFactorScreen(approvalAction: action),
                ),
              );
            },
            child: const Text('Open security'),
          ),
        ),
      ),
    ),
  );
}

Future<void> settle(WidgetTester t) async {
  for (var i = 0; i < 8; i++) {
    await t.pump(const Duration(milliseconds: 60));
  }
}

Future<void> press(WidgetTester t, String name) async {
  final f = find.text(name);
  await t.ensureVisible(f);
  await t.tap(f);
  await settle(t);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<SecurityHarness> harness(
    WidgetTester t, {
    bool enrolled = true,
  }) async {
    t.view.physicalSize = const Size(440, 1200);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final h = SecurityHarness();
    await h.init(enrolled: enrolled);
    addTearDown(h.api.close);
    return h;
  }

  testWidgets(
    'setup retains recovery codes after activation despite an unavailable status read',
    (t) async {
      final h = await harness(t, enrolled: false);
      await t.pumpWidget(h.app());
      await press(t, 'Open security');
      await press(t, 'Set up authenticator app');
      expect(find.text(h.api.seed), findsOneWidget);
      h.api.failRead = true;
      await t.enterText(find.byType(TextField), '123456');
      await press(t, 'Verify and enable');
      expect(find.text('Save your recovery codes'), findsOneWidget);
      expect(find.text('synthetic-code-a'), findsOneWidget);
      expect(find.text(h.api.seed), findsNothing);
      await press(t, 'I saved my recovery codes');
      expect(find.text('Authenticator app active'), findsOneWidget);
      expect(find.text('synthetic-code-a'), findsNothing);
      expect(h.storage.data, isEmpty);
      expect(t.takeException(), isNull);
    },
  );
  testWidgets(
    'a mounted secret is cleared and blocked when its account/store epoch changes',
    (t) async {
      final h = await harness(t, enrolled: false);
      await t.pumpWidget(h.app());
      await press(t, 'Open security');
      await press(t, 'Set up authenticator app');
      expect(find.text(h.api.seed), findsOneWidget);
      h.actor = 'actor-b';
      await h.stores.bindActor(h.actor);
      await settle(t);
      expect(find.text(h.api.seed), findsNothing);
      expect(find.text('Account or store access changed'), findsOneWidget);
      expect(find.text('Verify and enable'), findsNothing);
      expect(t.takeException(), isNull);
    },
  );
  testWidgets(
    'closing while an approval reply is pending never delivers that proof to the consumer',
    (t) async {
      final h = await harness(t);
      await t.pumpWidget(h.app(action: 'refund.approve'));
      await press(t, 'Open security');
      h.api.holdMutation = Completer<void>();
      h.api.mutationEntered = Completer<void>();
      await t.enterText(find.byType(TextField), '123456');
      await t.tap(find.text('Verify approval'));
      await settle(t);
      expect(h.api.mutationEntered!.isCompleted, true);
      await press(t, 'Close security');
      h.api.holdMutation!.complete();
      await settle(t);
      expect(h.proof, isNull);
      expect(find.text('Open security'), findsOneWidget);
      expect(t.takeException(), isNull);
    },
  );
}
