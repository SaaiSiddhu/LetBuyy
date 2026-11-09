import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'product_edit_concurrency_test.dart' as f;
import 'support/editor_steps_fixture.dart';

class CreationTransport extends f.ProductTransport {
  CreationTransport() : super('clean');
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method != HttpMethod.post)
      return super.requestJson(path, options: options);
    calls.add(options!);
    final body = options.body as JsonMap;
    return {...f.initial(), ...body, 'options': body['product_options']};
  }
}

void main() {
  test(
    'new product sends canonical option definitions with variant values through ProductsApi',
    () async {
      final api = CreationTransport();
      final actual = ProductService(api: api);
      addTearDown(actual.dispose);
      addTearDown(api.close);
      final options = <JsonMap>[
        {
          'name': 'Size',
          'position': 0,
          'values': ['M'],
        },
        {
          'name': 'Colour',
          'position': 1,
          'values': ['Green'],
        },
      ];
      await actual.createProduct(
        storeId: f.site,
        name: 'Synthetic variants',
        price: 100,
        productOptions: options,
        variants: [
          {
            'title': 'M / Green',
            'price': 120,
            'stock': 0,
            'options': {'Size': 'M', 'Colour': 'Green'},
          },
        ],
      );
      expect((api.calls.single.body as Map)['product_options'], options);
      expect(
        ((api.calls.single.body as Map)['variants'] as List).single['options'],
        {'Size': 'M', 'Colour': 'Green'},
      );
    },
  );

  Future<void> open(WidgetTester tester, f.ProductTransport api) async {
    tester.view.physicalSize = const Size(1000, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final owners = await f.mount(tester, api);
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      owners.service.dispose();
      owners.stores.dispose();
      api.close();
    });
  }

  testWidgets(
    'unrelated edit preserves optionless variants and an unspecified price',
    (tester) async {
      final api = f.ProductTransport('clean');
      final variant = Map<String, dynamic>.from(
        (api.current['variants'] as List).single as Map,
      );
      variant['options'] = <String, String>{};
      variant['price'] = null;
      api.current['variants'] = [variant];
      await open(tester, api);
      await tester.enterText(f.nameField(), 'Renamed product');
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      final saved =
          ((api.calls.single.body as Map)['variants'] as List).single as Map;
      expect(saved['options'], isEmpty);
      expect(saved.containsKey('price'), isFalse);
    },
  );
  testWidgets(
    'unrelated edit preserves explicit zero variant stock over a legacy quantity',
    (tester) async {
      final api = f.ProductTransport('clean');
      (api.current['variants'] as List).single['inventory_quantity'] = 17;
      await open(tester, api);
      await tester.enterText(f.nameField(), 'Renamed product');
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(1));
      expect(
        ((api.calls.single.body as Map)['variants'] as List).single['stock'],
        0,
      );
    },
  );
  testWidgets(
    'all existing option dimensions can be edited without replacing the variant identity',
    (tester) async {
      final api = f.ProductTransport('clean');
      await open(tester, api);
      await selectEditorSection(tester, 'Variants');
      await tester.ensureVisible(find.text('Edit M / Blue variant'));
      await tester.tap(find.text('Edit M / Blue variant'));
      await tester.pumpAndSettle();
      final colour = find.widgetWithText(TextFormField, 'Option 2 value');
      expect(colour, findsOneWidget);
      await tester.enterText(colour, 'Green');
      await tester.tap(find.widgetWithText(FilledButton, 'Save variant'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      final variant =
          ((api.calls.single.body as Map)['variants'] as List).single as Map;
      expect(variant['id'], f.variant);
      expect(variant['options'], {'Size': 'M', 'Colour': 'Green'});
    },
  );
  testWidgets(
    'malformed variant price remains in the editor and cannot silently inherit a base price',
    (tester) async {
      final api = f.ProductTransport('clean');
      await open(tester, api);
      await selectEditorSection(tester, 'Variants');
      await tester.ensureVisible(find.text('Edit M / Blue variant'));
      await tester.tap(find.text('Edit M / Blue variant'));
      await tester.pumpAndSettle();
      final price = find.widgetWithText(TextFormField, 'Price');
      await tester.ensureVisible(price);
      await tester.enterText(price, '1..2');
      await tester.tap(find.widgetWithText(FilledButton, 'Save variant'));
      await tester.pumpAndSettle();
      expect(find.text('Edit variant'), findsOneWidget);
      expect(find.text('Enter a valid non-negative price'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );
}
