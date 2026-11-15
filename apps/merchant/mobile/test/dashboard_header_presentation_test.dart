// Header presentation only; store selection uses the unchanged local owner.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/dashboard/premium_header.dart';
import 'staff_scope_boundary_test.dart' as fixture;

Future<void> mountHeader(
  WidgetTester tester,
  StoreContext stores,
  StoreAuthService auth,
  VoidCallback changed, {
  bool dark = false,
  double scale = 1,
}) => tester.pumpWidget(
  MultiProvider(
    providers: [
      ChangeNotifierProvider<StoreContext>.value(value: stores),
      ChangeNotifierProvider<StoreAuthService>.value(value: auth),
    ],
    child: MaterialApp(
      theme: dark ? StoreTheme.dark() : StoreTheme.light(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.linear(scale),
          disableAnimations: true,
        ),
        child: child!,
      ),
      home: Scaffold(
        body: PremiumHeader(isDark: false, onStoreChanged: changed),
      ),
    ),
  ),
);

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
  });
  for (final dark in [false, true]) {
    testWidgets(
      'header and loaded store choices reflow at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = ApiClient(
          baseUrl: 'https://gateway.test/v1',
          maxRetries: 0,
        );
        final stores = StoreContext(storeService: fixture.FixedStores(api));
        final auth = StoreAuthService(
          api: api,
          identityBaseUrl: 'https://accounts.example.invalid',
        );
        final semantics = tester.ensureSemantics();
        await stores.ensureSelectedStore();
        try {
          await mountHeader(
            tester,
            stores,
            auth,
            () {},
            dark: dark,
            scale: 2.4,
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.tap(
            find.bySemanticsLabel('Active store: ${fixture.siteA}'),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.ensureVisible(find.text('Apply selection'));
          await tester.pumpAndSettle();
          expect(find.text('Apply selection').hitTestable(), findsOneWidget);
          await tester.ensureVisible(find.text('Cancel'));
          await tester.tap(find.text('Cancel'));
          await tester.pumpAndSettle();
          expect(stores.selectedStoreId, fixture.siteA);
          await tester.tap(find.bySemanticsLabel('Account'));
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.text('Add account'));
          await tester.pumpAndSettle();
          expect(find.text('Add account').hitTestable(), findsOneWidget);
          expect(tester.takeException(), isNull);
        } finally {
          await tester.pumpWidget(const SizedBox.shrink());
          semantics.dispose();
          stores.dispose();
          auth.dispose();
          api.close();
        }
      },
    );
  }

  testWidgets(
    'store picker completion cannot call its disposed originating header',
    (tester) async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      final auth = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://accounts.example.invalid',
      );
      final semantics = tester.ensureSemantics();
      await stores.ensureSelectedStore();
      var visible = true, callbacks = 0;
      late StateSetter update;
      try {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<StoreContext>.value(value: stores),
              ChangeNotifierProvider<StoreAuthService>.value(value: auth),
            ],
            child: MaterialApp(
              theme: StoreTheme.light(),
              home: Scaffold(
                body: StatefulBuilder(
                  builder: (_, set) {
                    update = set;
                    return visible
                        ? PremiumHeader(
                            isDark: false,
                            onStoreChanged: () => callbacks++,
                          )
                        : const Text('New destination body');
                  },
                ),
              ),
            ),
          ),
        );
        await tester.tap(
          find.bySemanticsLabel('Active store: ${fixture.siteA}'),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text(fixture.siteB));
        update(() => visible = false);
        await tester.pumpAndSettle();
        expect(find.byType(PremiumHeader), findsNothing);
        await tester.tap(find.text('Apply selection'));
        await tester.pumpAndSettle();
        expect(stores.selectedStoreId, fixture.siteB);
        expect(callbacks, 0);
        expect(find.text('New destination body'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        semantics.dispose();
        stores.dispose();
        auth.dispose();
        api.close();
      }
    },
  );
  testWidgets(
    'header store selection stays a draft until Apply and Cancel preserves the active store',
    (tester) async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      final auth = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://accounts.example.invalid',
      );
      final semantics = tester.ensureSemantics();
      var changed = 0;
      await stores.bindActor('owner-a');
      await stores.ensureSelectedStore();
      try {
        await mountHeader(tester, stores, auth, () => changed++);
        await tester.tap(
          find.bySemanticsLabel('Active store: ${fixture.siteA}'),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text(fixture.siteB));
        await tester.pumpAndSettle();
        expect(stores.selectedStoreId, fixture.siteA);
        expect(changed, 0);
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        expect(stores.selectedStoreId, fixture.siteA);
        await tester.tap(
          find.bySemanticsLabel('Active store: ${fixture.siteA}'),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text(fixture.siteB));
        await tester.tap(find.text('Apply selection'));
        await tester.pumpAndSettle();
        expect(stores.selectedStoreId, fixture.siteB);
        expect(changed, 1);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        semantics.dispose();
        stores.dispose();
        auth.dispose();
        api.close();
      }
    },
  );

  testWidgets(
    'an open header account menu retires actions when its original actor view changes',
    (tester) async {
      final api = ApiClient(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
      final stores = StoreContext(storeService: fixture.FixedStores(api));
      final auth = StoreAuthService(
        api: api,
        identityBaseUrl: 'https://accounts.example.invalid',
      );
      final semantics = tester.ensureSemantics();
      await stores.bindActor('owner-a');
      await stores.ensureSelectedStore();
      try {
        await mountHeader(tester, stores, auth, () {});
        await tester.tap(find.bySemanticsLabel('Account'));
        await tester.pumpAndSettle();
        expect(find.text('Add account'), findsOneWidget);
        await stores.bindActor('owner-b');
        await tester.pumpAndSettle();
        expect(find.text('Add account'), findsNothing);
        expect(find.text('Store access changed'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        semantics.dispose();
        stores.dispose();
        auth.dispose();
        api.close();
      }
    },
  );
}
