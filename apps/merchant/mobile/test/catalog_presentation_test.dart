// Presentation fixtures through the real ProductService and shared contracts.
// This is not a database, file-delivery or hosted synchronization acceptance.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/merchant_export_share.dart';
import 'product_status_recovery_test.dart' as fixture;
import 'support/loyalty_fixture.dart' show MemoryStorage;

class CatalogTransport extends fixture.Transport {
  final queries = <JsonMap>[];
  final dispatchScopes = <String?>[];
  String? Function()? currentStore;
  final rowsByStore = <String, List<JsonMap>>{};
  final exportQueries = <JsonMap>[];
  final jobPaths = <String>[];
  Completer<PaginatedResponse<JsonMap>>? heldProducts;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    if (path == '/products') {
      queries.add(Map<String, dynamic>.from(options?.query ?? {}));
      dispatchScopes.add(currentStore?.call());
      if (heldProducts != null) return heldProducts!.future;
      final rows = rowsByStore[options?.query?['store_id']];
      if (rows != null)
        return PaginatedResponse(
          data: rows,
          page: 1,
          limit: 20,
          total: rows.length,
          hasMore: false,
        );
    }
    final result = await super.requestPaginatedJson(path, options: options);
    if (path == '/products' && options?.query?['stock_filter'] != null) {
      return PaginatedResponse(
        data: result.data,
        page: result.page,
        limit: result.limit,
        total: result.total,
        hasMore: result.hasMore,
        meta: {'stock_filter': options!.query!['stock_filter']},
      );
    }
    return result;
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path == '/export/products') {
      exportQueries.add(Map<String, dynamic>.from(options?.query ?? {}));
      return {
        'job': {'id': 'synthetic-export', 'status': 'queued'},
      };
    }
    if (path == '/export/jobs/synthetic-export') {
      jobPaths.add(path);
      return {
        'job': {'id': 'synthetic-export', 'status': 'queued'},
      };
    }
    return super.requestJson(path, options: options);
  }
}

class HeldExportTransport extends ApiClient {
  HeldExportTransport()
    : super(baseUrl: 'https://gateway.synthetic.invalid/v1', maxRetries: 0);
  final download = Completer<Object?>();
  final calls = <String>[];
  @override
  Future<Object?> request(String path, {ApiRequestOptions? options}) async {
    calls.add(path);
    return download.future;
  }
}

class CatalogFixture {
  CatalogFixture() {
    storesService = StoreService(api: api);
    stores = StoreContext(storeService: storesService);
    api.currentStore = () => stores.selectedStoreId;
    products = ProductService(
      api: api,
      actorIdProvider: () => fixture.actor,
      storeIdProvider: () => stores.selectedStoreId ?? '',
      commands: SecurityCommandStore(storage: MemoryStorage()),
    );
  }
  final api = CatalogTransport();
  late final StoreService storesService;
  late final StoreContext stores;
  late final ProductService products;
  Future<void> mount(
    WidgetTester tester, {
    bool dark = false,
    double scale = 1,
  }) async {
    await stores.ensureSelectedStore();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: stores),
          ChangeNotifierProvider<StoreService>.value(value: storesService),
          ChangeNotifierProvider<ProductService>.value(value: products),
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
          home: const ProductsScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();
  }

  Future<void> dispose(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    products.dispose();
    stores.dispose();
    storesService.dispose();
    api.close();
  }
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'partial product fields remain unavailable instead of fabricating price stock or page counts',
    (tester) async {
      final f = CatalogFixture();
      f.api.rows['one'] = Map<String, dynamic>.from(fixture.product('one'))
        ..remove('price')
        ..remove('stock')
        ..remove('catalog_available_quantity')
        ..remove('is_active');
      try {
        await f.mount(tester);
        final card = find.byKey(const ValueKey('product-card-one'));
        expect(
          find.descendant(of: card, matching: find.text('₹0.00')),
          findsNothing,
        );
        expect(
          find.descendant(of: card, matching: find.text('Stock: 0')),
          findsNothing,
        );
        expect(
          find.descendant(of: card, matching: find.text('Price unavailable')),
          findsOneWidget,
        );
        expect(
          find.descendant(of: card, matching: find.text('Stock unavailable')),
          findsOneWidget,
        );
        expect(find.text('— Active on page'), findsOneWidget);
        expect(find.text('— Out of stock on page'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );
  testWidgets('catalog export Cancel and a retired store choice never submit', (
    tester,
  ) async {
    final f = CatalogFixture();
    try {
      await f.mount(tester);
      await tester.tap(find.text('Export'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyFormSheet), findsOneWidget);
      expect(f.api.exportQueries, isEmpty);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(f.api.exportQueries, isEmpty);
      await tester.tap(find.text('Export'));
      await tester.pumpAndSettle();
      await f.stores.adoptCreatedStore(
        StoreModel.fromJson({
          'id': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          'name': 'Store B',
          'subdomain': 'store-b',
        }),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Prepare CSV'),
            )
            .onPressed,
        isNull,
      );
      expect(find.text('Store context changed'), findsOneWidget);
      expect(f.api.exportQueries, isEmpty);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    } finally {
      await f.dispose(tester);
    }
  });
  testWidgets(
    'queued product export keeps one request and its original five job reads without success feedback',
    (tester) async {
      final f = CatalogFixture();
      final semantics = tester.ensureSemantics();
      try {
        await f.mount(tester);
        final export = tester
            .widget<OutlinedButton>(
              find.ancestor(
                of: find.text('Export'),
                matching: find.byWidgetPredicate(
                  (widget) => widget is OutlinedButton,
                ),
              ),
            )
            .onPressed!;
        await tester.tap(find.text('Export'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Prepare CSV'));
        await tester.pump();
        expect(f.api.exportQueries, hasLength(1));
        expect(f.api.exportQueries.single, {'store_id': fixture.site});
        export();
        await tester.pump();
        expect(find.byType(LetbuyyFormSheet), findsNothing);
        expect(f.api.exportQueries, hasLength(1));
        for (var attempt = 0; attempt < 6; attempt++) {
          await tester.pump(const Duration(milliseconds: 350));
        }
        expect(f.api.jobPaths, List.filled(5, '/export/jobs/synthetic-export'));
        expect(
          find.bySemanticsLabel(
            'Update: Product CSV export queued. Check this export for an update.',
          ),
          findsOneWidget,
        );
        expect(
          find.bySemanticsLabel(RegExp(r'^Success: Product CSV export')),
          findsNothing,
        );
        expect(find.text('Preparing product CSV…'), findsNothing);
        expect(
          tester
              .widget<OutlinedButton>(
                find.widgetWithText(OutlinedButton, 'Export'),
              )
              .onPressed,
          isNull,
        );
        export();
        await tester.pump();
        expect(f.api.exportQueries, hasLength(1));
        await tester.tap(find.text('Check export status'));
        await tester.pumpAndSettle();
        expect(f.api.jobPaths, List.filled(6, '/export/jobs/synthetic-export'));
        expect(f.api.exportQueries, hasLength(1));
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
        await f.dispose(tester);
      }
    },
  );
  const exportJob = {
    'id': 'synthetic-job',
    'status': 'completed',
    'filename': 'products.csv',
    'download_url':
        'https://worker.invalid/v1/export/jobs/synthetic-job/download?token=synthetic-proof',
  };
  test(
    'retired export view cannot start a private download or native handoff',
    () async {
      final api = HeldExportTransport();
      var shares = 0;
      try {
        await expectLater(
          shareMerchantExport(
            api: api,
            job: exportJob,
            isCurrent: () => false,
            share: (_) async {
              shares++;
              return const ShareResult(
                'dismissed',
                ShareResultStatus.dismissed,
              );
            },
          ),
          throwsA(
            isA<ApiException>().having(
              (error) => error.code,
              'code',
              'EXPORT_VIEW_CHANGED',
            ),
          ),
        );
        expect(api.calls, isEmpty);
        expect(shares, 0);
      } finally {
        api.close();
      }
    },
  );
  test(
    'a downloaded CSV cannot launch native share after its originating view retires',
    () async {
      final api = HeldExportTransport();
      var current = true, shares = 0;
      try {
        final result = shareMerchantExport(
          api: api,
          job: exportJob,
          isCurrent: () => current,
          share: (_) async {
            shares++;
            return const ShareResult('dismissed', ShareResultStatus.dismissed);
          },
        );
        final denied = expectLater(
          result,
          throwsA(
            isA<ApiException>().having(
              (error) => error.code,
              'code',
              'EXPORT_VIEW_CHANGED',
            ),
          ),
        );
        expect(api.calls, ['/export/jobs/synthetic-job/download']);
        current = false;
        api.download.complete('name,stock\nSynthetic,3\n');
        await denied;
        expect(shares, 0);
      } finally {
        api.close();
      }
    },
  );

  testWidgets(
    'catalog status and sort choices keep all13 original query mappings behind Apply',
    (tester) async {
      final f = CatalogFixture();
      const groups = <String, List<(String, String)>>{
        'Product status': [
          ('All', 'all'),
          ('Active', 'active'),
          ('Inactive', 'inactive'),
          ('Draft', 'draft'),
          ('Archived', 'archived'),
          ('Out of Stock', 'out_of_stock'),
          ('Stock 1–5', 'low_stock'),
        ],
        'Sort products': [
          ('Newest', 'newest'),
          ('Oldest', 'oldest'),
          ('Name A-Z', 'name_asc'),
          ('Name Z-A', 'name_desc'),
          ('Price ↑', 'price_asc'),
          ('Price ↓', 'price_desc'),
        ],
      };
      try {
        await f.mount(tester);
        for (final group in groups.entries) {
          for (final choice in group.value) {
            final field = find.byWidgetPredicate(
              (widget) =>
                  widget is LetbuyyChoiceField<String> &&
                  widget.label == group.key,
            );
            await tester.ensureVisible(field);
            await tester.pumpAndSettle();
            final before = f.api.queries.length;
            final previous = tester
                .widget<LetbuyyChoiceField<String>>(field)
                .value;
            await tester.tap(field);
            await tester.pumpAndSettle();
            expect(
              find.byWidgetPredicate(
                (widget) => widget is RadioListTile<String>,
              ),
              findsNWidgets(group.value.length),
            );
            await tester.tap(find.text(choice.$1));
            await tester.pump();
            expect(
              f.api.queries,
              hasLength(before),
              reason: '${group.key}/${choice.$1} is still a draft',
            );
            await tester.tap(find.text('Cancel'));
            await tester.pumpAndSettle();
            expect(
              tester.widget<LetbuyyChoiceField<String>>(field).value,
              previous,
            );
            expect(f.api.queries, hasLength(before));
            await tester.tap(field);
            await tester.pumpAndSettle();
            await tester.tap(find.text(choice.$1));
            await tester.pump();
            await tester.tap(find.text('Apply selection'));
            await tester.pumpAndSettle();
            expect(
              f.api.queries,
              hasLength(before + (previous == choice.$2 ? 0 : 1)),
            );
            final query = f.api.queries.last;
            expect(query, containsPair('store_id', fixture.site));
            expect(query, containsPair('page', 1));
            expect(query, containsPair('limit', 20));
            if (group.key == 'Product status') {
              final stock = const {
                'out_of_stock',
                'low_stock',
              }.contains(choice.$2);
              expect(query['status'], stock ? 'all' : choice.$2);
              expect(query['stock_filter'], stock ? choice.$2 : null);
            } else {
              final sort = choice.$2.startsWith('name_')
                  ? 'name'
                  : choice.$2.startsWith('price_')
                  ? 'price'
                  : 'created_at';
              final order =
                  const {
                    'newest',
                    'name_desc',
                    'price_desc',
                  }.contains(choice.$2)
                  ? 'desc'
                  : 'asc';
              expect(query['sort'], sort);
              expect(query['order'], order);
            }
            expect(tester.takeException(), isNull);
          }
        }
      } finally {
        await f.dispose(tester);
      }
    },
  );

  testWidgets(
    'first catalog read has a visible pending owner and no false empty catalog',
    (tester) async {
      final f = CatalogFixture();
      final pending = Completer<PaginatedResponse<JsonMap>>();
      f.api.heldProducts = pending;
      try {
        await f.mount(tester);
        expect(f.api.queries, hasLength(1));
        expect(find.text('Loading products').hitTestable(), findsOneWidget);
        expect(find.text('No Products Yet'), findsNothing);
        expect(find.text('0 On this page'), findsNothing);
        expect(tester.binding.transientCallbackCount, 0);
        pending.complete(
          const PaginatedResponse(
            data: <JsonMap>[],
            page: 1,
            limit: 20,
            total: 0,
            hasMore: false,
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Loading products'), findsNothing);
        expect(find.text('No Products Yet'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );
  testWidgets(
    'catalog choice sheet retires input when its originating store view is removed',
    (tester) async {
      final f = CatalogFixture();
      const siteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      f.api.rowsByStore[siteB] = [
        {
          ...fixture.product('one'),
          'store_id': siteB,
          'name': 'Current store B product',
        },
      ];
      try {
        await f.mount(tester);
        final sort = find.byWidgetPredicate(
          (widget) =>
              widget is LetbuyyChoiceField<String> &&
              widget.label == 'Sort products',
        );
        await tester.ensureVisible(sort);
        await tester.pumpAndSettle();
        await tester.tap(sort);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Price ↑'));
        await tester.pump();
        expect(f.api.queries, hasLength(1));
        await f.stores.adoptCreatedStore(
          StoreModel.fromJson({
            'id': siteB,
            'name': 'Store B',
            'subdomain': 'store-b',
          }),
        );
        await tester.pumpAndSettle();
        final apply = find.widgetWithText(FilledButton, 'Apply selection');
        expect(tester.widget<FilledButton>(apply).onPressed, isNull);
        expect(find.text('Choice unavailable'), findsOneWidget);
        expect(find.text('Price ↑'), findsNothing);
        await tester.tap(find.text('Cancel'));
        await tester.pumpAndSettle();
        expect(f.api.queries, hasLength(2));
        expect(f.api.queries.last, containsPair('sort', 'created_at'));
        expect(f.api.queries.last, containsPair('store_id', siteB));
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );
  testWidgets(
    'catalog debounce cannot carry a private query into a replacement store before its first frame',
    (tester) async {
      final f = CatalogFixture();
      const siteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      f.api.rowsByStore[siteB] = [
        {
          ...fixture.product('one'),
          'store_id': siteB,
          'name': 'Current store B product',
        },
      ];
      try {
        await f.mount(tester);
        final search = find.byType(TextField);
        await tester.enterText(search, 'Private A search phrase');
        expect(f.api.queries, hasLength(1));
        await f.stores.adoptCreatedStore(
          StoreModel.fromJson({
            'id': siteB,
            'name': 'Store B',
            'subdomain': 'store-b',
          }),
        );
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pumpAndSettle();
        expect(
          f.api.queries.where(
            (q) => q['store_id'] == siteB && q['search'] != null,
          ),
          isEmpty,
        );
        expect(tester.widget<TextField>(search).controller!.text, isEmpty);
        expect(f.api.queries.last['store_id'], siteB);
        expect(find.text('Current store B product'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );
  testWidgets(
    'catalog refresh cannot dispatch its old selected store after a pre-frame switch',
    (tester) async {
      final f = CatalogFixture();
      const siteB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      f.api.rowsByStore[siteB] = [
        {
          ...fixture.product('one'),
          'store_id': siteB,
          'name': 'Current store B product',
        },
      ];
      try {
        await f.mount(tester);
        expect(f.api.queries, hasLength(1));
        expect(f.api.dispatchScopes, [fixture.site]);
        final refresh = tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (widget) => widget is IconButton && widget.tooltip == 'Refresh',
              ),
            )
            .onPressed!;
        refresh();
        await f.stores.adoptCreatedStore(
          StoreModel.fromJson({
            'id': siteB,
            'name': 'Store B',
            'subdomain': 'store-b',
          }),
        );
        for (var i = 0; i < 4; i++) {
          await Future<void>.value();
        }
        expect(
          [
            for (var i = 0; i < f.api.queries.length; i++)
              if (f.api.queries[i]['store_id'] != f.api.dispatchScopes[i])
                f.api.queries[i],
          ],
          isEmpty,
          reason:
              'A pre-frame selection switch must retire dispatch, not only hide a late response',
        );
        await tester.pumpAndSettle();
        expect(f.api.queries.last['store_id'], siteB);
        expect(find.text('Current store B product'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        await f.dispose(tester);
      }
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'catalog controls and exact product amounts reflow at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final f = CatalogFixture();
        f.api.rows['one'] = {
          ...fixture.product('one'),
          'name':
              'A long product name with readable size and colour information',
          'price': 1234567.89,
          'compare_price': 2345678.90,
          'stock': 42,
        };
        try {
          await f.mount(tester, dark: dark, scale: 2.4);
          expect(tester.takeException(), isNull);
          final card = find.byKey(const ValueKey('product-card-one'));
          await tester.scrollUntilVisible(
            card,
            300,
            scrollable: find.byType(Scrollable).first,
            maxScrolls: 12,
          );
          for (final amount in ['₹12,34,567.89', '₹23,45,678.90']) {
            final text = find.descendant(of: card, matching: find.text(amount));
            expect(text, findsOneWidget);
            await tester.ensureVisible(text);
            await tester.pump();
            final rect = tester.getRect(text);
            final viewport = tester.getRect(find.byType(Viewport).first);
            expect(rect.left, greaterThanOrEqualTo(viewport.left));
            expect(rect.right, lessThanOrEqualTo(viewport.right));
            expect(rect.top, greaterThanOrEqualTo(viewport.top));
            expect(rect.bottom, lessThanOrEqualTo(viewport.bottom));
          }
          expect(tester.takeException(), isNull);
        } finally {
          await f.dispose(tester);
        }
      },
    );
  }
}
