import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/settings/settings_screen.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/screens/products/import_products_screen.dart';
import 'package:letbuyy_store/screens/content/page_editor_screen.dart';
import 'package:letbuyy_store/screens/content/post_editor_screen.dart';
import 'package:letbuyy_store/screens/customize/theme_versions_screen.dart';
import 'package:letbuyy_store/screens/editor/section_editor_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:letbuyy_store/main.dart' as app;
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/config/v1_capability_policy.dart';
import 'package:letbuyy_store/screens/main/store_main_screen.dart';
import 'package:letbuyy_store/screens/customize/theme_screen.dart';

// Opt in on a local device. Uses normal UI login and real backend reads;
// does not inject sessions or submit commerce mutations.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'local signed-in merchant screen audit',
    (tester) async {
      expect(AppConfig.environment, 'local');
      print('SCREEN_AUDIT boot');
      await tester.runAsync(() async {
        app.main();
        await Future<void>.delayed(const Duration(seconds: 4));
      });
      print('SCREEN_AUDIT boot-returned');
      await tester.pump(const Duration(seconds: 2));
      if (find.byType(StoreMainScreen).evaluate().isEmpty) {
        const email = String.fromEnvironment('AUDIT_MERCHANT_EMAIL');
        const password = String.fromEnvironment('AUDIT_MERCHANT_PASSWORD');
        expect(
          email.isNotEmpty && password.isNotEmpty,
          isTrue,
          reason: 'Supply private local demo credentials for normal UI login.',
        );
        for (
          var i = 0;
          i < 30 && find.text('Security check passed').evaluate().isEmpty;
          i++
        ) {
          await tester.pump(const Duration(seconds: 1));
        }
        await tester.enterText(find.byType(TextFormField).at(0), email);
        await tester.enterText(find.byType(TextFormField).at(1), password);
        await tester.tap(find.text('Continue'));
        print('SCREEN_AUDIT normal-login-submitted');
      }
      for (
        var i = 0;
        i < 30 && find.byType(StoreMainScreen).evaluate().isEmpty;
        i++
      ) {
        await tester.pump(const Duration(seconds: 1));
      }
      expect(
        find.byType(StoreMainScreen),
        findsOneWidget,
        reason: 'Sign in through the normal app before running this audit.',
      );
      final navigator = tester.state<NavigatorState>(
        find.byType(Navigator).first,
      );
      const filter = String.fromEnvironment('AUDIT_SCREEN_FILTER');
      final selectedScreens = filter
          .split(',')
          .where((s) => s.isNotEmpty)
          .toSet();
      final results = <Map<String, Object?>>[];
      final mainContext = tester.element(find.byType(StoreMainScreen));
      final storeContext = mainContext.read<StoreContext>();
      const selectedStoreId = String.fromEnvironment('AUDIT_STORE_ID');
      if (selectedStoreId.isNotEmpty)
        await storeContext.selectStoreById(selectedStoreId);
      final selected = await storeContext.ensureSelectedStore();
      expect(selected, isNotNull);
      final store = selected!;
      final requests = <Map<String, Object?>>[];
      final api = mainContext.read<ApiClient>();
      final productService = mainContext.read<ProductService>();
      final interceptor = InterceptorsWrapper(
        onResponse: (response, handler) {
          requests.add({
            'method': response.requestOptions.method,
            'path': response.requestOptions.path,
            'status': response.statusCode,
          });
          handler.next(response);
        },
        onError: (error, handler) {
          final body = error.response?.data;
          final detail = body is Map ? body['error'] : null;
          requests.add({
            'method': error.requestOptions.method,
            'path': error.requestOptions.path,
            'status': error.response?.statusCode,
            'code': detail is Map ? detail['code'] : null,
          });
          handler.next(error);
        },
      );
      api.dio.interceptors.add(interceptor);
      final previous = FlutterError.onError;
      final errors = <String>[];
      FlutterError.onError = (details) =>
          errors.add(details.exceptionAsString());
      print('SCREEN_AUDIT main-found');
      Future<void> inspect(String name, Route<dynamic> route) async {
        if (selectedScreens.isNotEmpty && !selectedScreens.contains(name))
          return;
        errors.clear();
        requests.clear();
        navigator.push(route);
        for (var i = 0; i < 5; i++) {
          await tester.pump(const Duration(seconds: 1));
        }
        final texts = find
            .byType(Text)
            .evaluate()
            .map((e) {
              final t = e.widget as Text;
              return t.data ?? t.textSpan?.toPlainText() ?? '';
            })
            .where((t) => t.isNotEmpty)
            .toSet()
            .toList();
        final failures = List<String>.of(errors);
        results.add({
          'screen': name,
          'texts': texts,
          'errors': failures,
          'requests': List<Map<String, Object?>>.of(requests),
        });
        binding.reportData = {'screens': results};

        print('SCREEN_AUDIT $name errors=${failures.length}');
        print(
          'SCREEN_AUDIT_CAPTURE ${name.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}',
        );
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(seconds: 2)),
        );
        navigator.pop();
        await tester.pump(const Duration(seconds: 1));
      }

      try {
        const lifecycle = {
          AppRouteId.auth,
          AppRouteId.splash,
          AppRouteId.main,
          AppRouteId.login,
          AppRouteId.otp,
          AppRouteId.turnstileChallenge,
          AppRouteId.onboarding,
          AppRouteId.createStore,
          AppRouteId.storePublished,
        };
        for (final spec in AppRoutes.allRoutes) {
          if (lifecycle.contains(spec.id)) continue;
          if (spec.path.startsWith('/features/')) {
            results.add({
              'screen': spec.path,
              'availability': V1CapabilityPolicy.availabilityFor(spec.id).name,
              'alias': true,
            });
            continue;
          }
          await inspect(
            spec.path,
            AppRoutes.generateRoute(
              RouteSettings(
                name: spec.path,
                arguments: switch (spec.id) {
                  AppRouteId.livePreview => {
                    'storeUrl': AppConfig.storefrontUrlFor(
                      subdomain: store.subdomain,
                      publicUrl: store.publicUrl,
                    ),
                    'storeName': store.name,
                  },
                  AppRouteId.orderDetail => {
                    'orderId': const String.fromEnvironment('AUDIT_ORDER_ID'),
                  },
                  AppRouteId.customerDetail => {
                    'email': const String.fromEnvironment(
                      'AUDIT_CUSTOMER_EMAIL',
                    ),
                  },
                  AppRouteId.couponForm => {'storeId': store.id},
                  _ => null,
                },
              ),
            ),
          );
        }
        await inspect(
          'theme-catalog',
          MaterialPageRoute<void>(builder: (_) => const ThemeScreen()),
        );
        final product = await productService.fetchProductForEdit(
              const String.fromEnvironment('AUDIT_PRODUCT_ID'),
              store.id,
            );
        final extras = <String, Widget>{
          'product-edit': ProductFormScreen(product: product),
          'settings': const SettingsScreen(),
          'product-create': const ProductFormScreen(),
          'product-import': ImportProductsScreen(
            store: store,
            alreadySelectedIds: const {},
          ),
          'page-create': PageEditorScreen(storeId: store.id),
          'post-create': PostEditorScreen(storeId: store.id),
          'theme-versions': ThemeVersionsScreen(
            storeId: store.id,
            themeSlug: store.themeId,
            themeName: store.themeId,
          ),
          'section-editor': const SectionEditorScreen(),
        };
        for (final entry in extras.entries) {
          await inspect(
            entry.key,
            MaterialPageRoute<void>(builder: (_) => entry.value),
          );
        }
      } finally {
        api.dio.interceptors.remove(interceptor);
        FlutterError.onError = previous;
        binding.reportData = {'screens': results};
      }
      expect(
        results
            .where((r) => (r['errors'] as List?)?.isNotEmpty ?? false)
            .map((r) => r['screen']),
        isEmpty,
        reason: 'Every audited screen must render without framework errors.',
      );
      expect(
        results.expand((r) =>
          (r['requests'] as List<Map<String, Object?>>?) ?? const [])
          .where((r) => r['status'] == null || (r['status'] as int) >= 500),
        isEmpty,
        reason: 'A rendered screen must not hide failed backend reads.',
      );
    },
    skip: !const bool.fromEnvironment('RUN_LOCAL_SCREEN_AUDIT'),
    timeout: const Timeout(Duration(minutes: 15)),
  );
}
