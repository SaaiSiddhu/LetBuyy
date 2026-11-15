import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/store_health/store_health_screen.dart';
import 'package:letbuyy_store/screens/auth/error_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/image_source_sheet.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'coupon_presentation_test.dart' as f;

JsonMap health({String site = f.site, Object? score = 84}) => {
  'store_id': site,
  'score': score,
  'generated_at': '2026-11-05T10:00:00Z',
  'pillars': [
    {
      'id': 'launch',
      'label': 'Private A health',
      'score': 88,
      'status': 'ready',
      'summary': 'Exact saved health assessment',
      'route': '/products',
      'action_label': 'Review catalog',
    },
  ],
};

class HealthTransport extends f.CouponTransport {
  final healthReads = <String>[];
  Future<JsonMap> Function(String)? healthReply;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    healthReads.add(path);
    return healthReply != null
        ? healthReply!(path)
        : health(site: path.split('/')[2]);
  }
}

class HealthScope extends f.CouponScope {
  HealthScope(super.api);
  Future<StoreModel?> Function()? selection;
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async =>
      selection != null ? selection!() : selectedStore;
}

Future<({HealthScope scope, GlobalKey<NavigatorState> navigator})> mount(
  WidgetTester tester,
  HealthTransport api, {
  Widget? child,
  double scale = 1,
  Size size = const Size(390, 844),
  bool dark = false,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final stores = HealthScope(api),
      service = StoreService(api: api, cache: CacheService.memory()),
      nav = GlobalKey<NavigatorState>();
  addTearDown(stores.dispose);
  addTearDown(service.dispose);
  addTearDown(api.close);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider<StoreService>.value(value: service),
      ],
      child: MaterialApp(
        navigatorKey: nav,
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: child ?? const StoreHealthScreen(),
        onGenerateRoute: (settings) => MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => Scaffold(body: Text('Opened ${settings.name!}')),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 60));
  return (scope: stores, navigator: nav);
}

Finder refresh() => find.byWidgetPredicate(
  (w) => w is IconButton && ['Refresh', 'Refresh health'].contains(w.tooltip),
);
Finder button(String text) => find.byWidgetPredicate(
  (w) =>
      w is ButtonStyleButton &&
      find
          .descendant(of: find.byWidget(w), matching: find.text(text))
          .evaluate()
          .isNotEmpty,
);
Future<void> cover(WidgetTester tester, GlobalKey<NavigatorState> nav) async {
  nav.currentState!.push(
    MaterialPageRoute<void>(
      builder: (_) => const Scaffold(body: Text('Cover')),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets('health does not accept another store assessment', (
    tester,
  ) async {
    final api = HealthTransport()
      ..healthReply = (_) async => health(site: 'foreign-store');
    await mount(tester, api);
    await tester.pumpAndSettle();
    expect(find.text('Private A health'), findsNothing);
    expect(find.textContaining('Store health is unavailable'), findsWidgets);
  });
  testWidgets(
    'a missing health score is unavailable rather than a confirmed zero',
    (tester) async {
      final api = HealthTransport()
        ..healthReply = (_) async => health(score: null);
      await mount(tester, api);
      await tester.pumpAndSettle();
      expect(find.text('Score unavailable'), findsOneWidget);
      expect(find.text('Action needed'), findsNothing);
    },
  );
  testWidgets('store A-B-A retires a held old health reply', (tester) async {
    final api = HealthTransport(), held = Completer<JsonMap>();
    var first = true;
    api.healthReply = (_) {
      if (first) {
        first = false;
        return held.future;
      }
      return Future.value({...health(), 'pillars': <JsonMap>[]});
    };
    final owner = await mount(tester, api);
    owner.scope.retire(store: 'other-store');
    await tester.pump();
    owner.scope.retire(store: f.site);
    await tester.pump();
    held.complete(health());
    await tester.pumpAndSettle();
    expect(find.text('Private A health'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('health refresh denial clears the prior private assessment', (
    tester,
  ) async {
    final api = HealthTransport();
    await mount(tester, api);
    await tester.pumpAndSettle();
    expect(find.text('Private A health'), findsOneWidget);
    api.healthReply = (_) async => throw const ApiException(
      message: 'Synthetic denial',
      statusCode: 403,
      code: 'SYNTHETIC',
    );
    await tester.tap(refresh());
    await tester.pumpAndSettle();
    expect(find.text('Private A health'), findsNothing);
  });
  testWidgets('covered saved-sign-in Retry never calls its owner', (
    tester,
  ) async {
    var calls = 0;
    final owner = await mount(
      tester,
      HealthTransport(),
      child: ErrorScreen(
        title: 'Saved sign-in',
        message: 'Kept securely',
        onRetry: () => calls++,
      ),
    );
    final callback = tester
        .widget<ButtonStyleButton>(button('Retry saved sign-in'))
        .onPressed!;
    await cover(tester, owner.navigator);
    callback();
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(tester.takeException(), isNull);
  });
  testWidgets('same-frame saved-sign-in Retry dispatches once', (tester) async {
    var calls = 0;
    await mount(
      tester,
      HealthTransport(),
      child: ErrorScreen(
        title: 'Saved sign-in',
        message: 'Kept securely',
        onRetry: () => calls++,
      ),
    );
    final callback = tester
        .widget<ButtonStyleButton>(button('Retry saved sign-in'))
        .onPressed!;
    callback();
    callback();
    expect(calls, 1);
    await tester.pumpAndSettle();
  });
  for (final dark in [false, true]) {
    testWidgets(
      'image action sheet scrolls within a short large-text window dark=$dark',
      (tester) async {
        ImageSource? result;
        await mount(
          tester,
          HealthTransport(),
          size: const Size(320, 320),
          scale: 2.4,
          dark: dark,
          child: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  result = await showImageSourceSheet(
                    context,
                    title:
                        'Choose the image source for the saved store branding',
                  );
                },
                child: const Text('Choose image'),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Choose image'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.byTooltip('Close'), findsOneWidget);
        expect(result, isNull);
      },
    );
  }
}
