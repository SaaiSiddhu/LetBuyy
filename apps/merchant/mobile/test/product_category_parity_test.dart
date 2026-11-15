import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show ProductContract;
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:provider/provider.dart';
import 'product_edit_concurrency_test.dart' as base;
import 'support/editor_steps_fixture.dart';

final categoryTemplate = Map<String, dynamic>.from(
  jsonDecode(
    File(
      '../../../tests/fixtures/product-category-contracts.json',
    ).readAsStringSync(),
  )['row'],
);

class CategoryTransport extends base.ProductTransport {
  CategoryTransport() : super('clean');
  final reads = <ApiRequestOptions>[];
  final creates = <JsonMap>[];
  bool denied = false;
  Completer<void>? held;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path == '/products' && options?.method == HttpMethod.post) {
      final body = Map<String, dynamic>.from(options!.body as Map);
      creates.add(body);
      return {...base.initial(), ...body, 'version': 1};
    }
    return super.requestJson(path, options: options);
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    expect(path, '/categories');
    reads.add(options!);
    await held?.future;
    if (denied)
      throw const ApiException(
        message: 'Synthetic denied category read',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    final query = options.query!;
    final page = query['page'] as int, limit = query['limit'] as int;
    final search = (query['search'] as String? ?? '').toLowerCase();
    final all = List.generate(
      21,
      (i) => <String, dynamic>{
        ...categoryTemplate,
        'id': '00000000-0000-4000-8000-${(i + 1).toString().padLeft(12, '0')}',
        'store_id': base.site,
        'name': 'Synthetic category ${i + 1}',
        'slug': 'synthetic-${i + 1}',
        'path': 'synthetic-${i + 1}',
      },
    ).where((r) => (r['name'] as String).toLowerCase().contains(search)).toList();
    final rows = all.skip((page - 1) * limit).take(limit).toList();
    final pages = (all.length / limit).ceil();
    return PaginatedResponse(
      data: rows,
      total: all.length,
      page: page,
      limit: limit,
      hasMore: page < pages,
      meta: {
        'page': page,
        'per_page': limit,
        'total': all.length,
        'total_pages': pages,
        'has_prev': page > 1,
        'has_next': page < pages,
      },
    );
  }
}

Finder categoryField() => find.widgetWithText(TextFormField, 'Category');
Future<base.SelectedStore> mountCategoryEditor(
  WidgetTester tester,
  CategoryTransport api, {
  bool creating = false,
  bool narrow = false,
}) async {
  tester.view.physicalSize = narrow
      ? const Size(320, 740)
      : const Size(1000, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final stores = base.SelectedStore(api);
  final service = ProductService(
    api: api,
    actorIdProvider: () => 'synthetic-owner',
    storeIdProvider: () => stores.selectedStoreId,
  );
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    service.dispose();
    stores.dispose();
    api.close();
  });
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider<ProductService>.value(value: service),
      ],
      child: MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(narrow ? 2.4 : 1)),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => ProductFormScreen(
                    product: creating
                        ? null
                        : ProductContract.fromJson(api.current),
                  ),
                ),
              ),
              child: const Text('Open product'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open product'));
  await tester.pumpAndSettle();
  return stores;
}

Future<void> openCategories(WidgetTester tester) async {
  final browse = find.byWidgetPredicate(
    (w) => w is IconButton && w.tooltip == 'Choose existing category',
  );
  await tester.ensureVisible(browse);
  await tester.pumpAndSettle();
  expect(browse.hitTestable(), findsOneWidget);
  await tester.tap(browse);
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'creating an uncategorized product omits invented category metadata',
    (tester) async {
      final api = CategoryTransport();
      await mountCategoryEditor(tester, api, creating: true);
      await tester.enterText(base.nameField(), 'Synthetic new product');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Description'),
        'Synthetic product description',
      );
      await selectEditorSection(tester, 'Images');
      await tester.tap(find.text('Add Image'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Image URL'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Image URL'),
        'https://synthetic.invalid/new.png',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Add'));
      await tester.pumpAndSettle();
      await selectEditorSection(tester, 'Pricing');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Sale Price *'),
        '100',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Stock Quantity *'),
        '2',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(api.creates, hasLength(1));
      expect(api.creates.single.containsKey('category'), isFalse);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'category validation and optional choices reflow with large text and keyboard',
    (tester) async {
      final api = CategoryTransport();
      await mountCategoryEditor(tester, api, narrow: true);
      tester.view.viewInsets = const FakeViewPadding(bottom: 240);
      addTearDown(tester.view.resetViewInsets);
      await tester.ensureVisible(categoryField());
      await tester.enterText(categoryField(), List.filled(51, '🙂').join());
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(find.text('Use at most 100 characters.'), findsOneWidget);
      expect(api.calls, isEmpty);
      await openCategories(tester);
      final option = find.text('Synthetic category 1');
      await tester.ensureVisible(option);
      await tester.pumpAndSettle();
      expect(option.hitTestable(), findsOneWidget);
      await tester.tap(option);
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(categoryField()).controller!.text,
        'Synthetic category 1',
      );
      expect(tester.takeException(), isNull);
    },
  );
  for (final value in ['Merchant cotton & silk', '']) {
    testWidgets(
      'product category accepts web text and clears as null: $value',
      (tester) async {
        final api = CategoryTransport();
        api.current['category'] = 'Original category';
        await mountCategoryEditor(tester, api);
        expect(categoryField(), findsOneWidget);
        await tester.ensureVisible(categoryField());
        await tester.enterText(categoryField(), value);
        await tester.tap(find.widgetWithText(FilledButton, 'Update'));
        await tester.pumpAndSettle();
        expect(api.calls, hasLength(1));
        expect(api.current['category'], value.isEmpty ? null : value);
        expect(
          api.reads,
          isEmpty,
          reason: 'Free text must not require an optional category-list read',
        );
      },
    );
  }
  testWidgets(
    'existing category choice uses server pagination and search and writes its name',
    (tester) async {
      final api = CategoryTransport();
      await mountCategoryEditor(tester, api);
      await openCategories(tester);
      expect(api.reads.single.query, containsPair('store_id', base.site));
      expect(find.text('Synthetic category 21'), findsNothing);
      await tester.tap(find.byTooltip('Next choices'));
      await tester.pumpAndSettle();
      expect(api.reads.last.query, containsPair('page', 2));
      await tester.tap(find.text('Synthetic category 21'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(categoryField()).controller!.text,
        'Synthetic category 21',
      );
      await openCategories(tester);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Search categories'),
        'category 7',
      );
      await tester.tap(find.byTooltip('Search choices'));
      await tester.pumpAndSettle();
      expect(
        api.reads.last.query,
        allOf(containsPair('page', 1), containsPair('search', 'category 7')),
      );
      await tester.tap(find.text('Synthetic category 7'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.current['category'], 'Synthetic category 7');
    },
  );
  testWidgets(
    'unavailable optional category choices retain typed product data and can retry',
    (tester) async {
      final api = CategoryTransport()..denied = true;
      await mountCategoryEditor(tester, api);
      await tester.ensureVisible(categoryField());
      await tester.enterText(categoryField(), 'Unsubmitted custom category');
      await openCategories(tester);
      expect(
        find.textContaining('Choices could not be loaded'),
        findsOneWidget,
      );
      api.denied = false;
      await tester.tap(find.text('Retry choices'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic category 1'), findsOneWidget);
      await tester.tap(find.byTooltip('Close choices'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(categoryField()).controller!.text,
        'Unsubmitted custom category',
      );
      expect(api.calls, isEmpty);
    },
  );
  testWidgets('late category results cannot survive a retired product store', (
    tester,
  ) async {
    final api = CategoryTransport()..held = Completer<void>();
    final stores = await mountCategoryEditor(tester, api);
    final browse = find.byTooltip('Choose existing category');
    await tester.ensureVisible(browse);
    await tester.tap(browse);
    await tester.pump();
    stores.selection = '99999999-9999-4999-8999-999999999999';
    await tester.pump();
    api.held!.complete();
    await tester.pumpAndSettle();
    expect(find.textContaining('Store access changed'), findsWidgets);
    expect(find.text('Synthetic category 1'), findsNothing);
    expect(api.calls, isEmpty);
  });
}
