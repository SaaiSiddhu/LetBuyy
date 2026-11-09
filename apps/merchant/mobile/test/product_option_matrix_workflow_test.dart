import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'product_edit_concurrency_test.dart' as f;
import 'support/editor_steps_fixture.dart';

Future<({ProductService service, f.SelectedStore stores})> openOptions(
  WidgetTester tester,
  f.ProductTransport api,
) async {
  tester.view.physicalSize = const Size(1000, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final owners = await f.mount(tester, api);
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
    owners.service.dispose();
    owners.stores.dispose();
    api.close();
  });
  await selectEditorSection(tester, 'Variants');
  await press(tester, 'Manage product options');
  return owners;
}

Future<void> press(WidgetTester tester, String label) async {
  final target = find.text(label);
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
  await tester.tap(target);
  await tester.pumpAndSettle();
}

Future<void> change(
  WidgetTester tester,
  String action,
  String value, {
  String label = 'Option name',
  String? second,
}) async {
  await press(tester, action);
  await tester.enterText(find.widgetWithText(TextFormField, label), value);
  if (second != null) {
    await tester.enterText(
      find.widgetWithText(TextFormField, 'First value'),
      second,
    );
  }
  await press(tester, 'Apply change');
}

Future<void> save(WidgetTester tester) async {
  await press(tester, 'Apply options');
  await press(tester, 'Update');
}

Map<String, dynamic> body(f.ProductTransport api, [int index = 0]) =>
    jsonDecode(jsonEncode(api.calls[index].body)) as Map<String, dynamic>;

void sparse(f.ProductTransport api, {bool sameSize = false}) {
  api.current['options'] = [
    {
      'name': 'Size',
      'position': 0,
      'values': sameSize ? ['M'] : ['M', 'L', 'XL'],
    },
    {
      'name': 'Colour',
      'position': 1,
      'values': ['Blue', 'Red'],
    },
  ];
  api.current['variants'] = [
    ...api.current['variants'] as List,
    {
      'id': '44444444-4444-4444-8444-444444444444',
      'title': sameSize ? 'M / Red' : 'L / Red',
      'sku': 'KEEP-SECOND',
      'stock': 0,
      'price': 110,
      'options': {'Size': sameSize ? 'M' : 'L', 'Colour': 'Red'},
    },
  ];
}

void main() {
  testWidgets(
    'product-wide rename preserves durable variant identity and exact quantities',
    (tester) async {
      final api = f.ProductTransport('clean');
      await openOptions(tester, api);
      await change(tester, 'Rename Colour option', 'Finish');
      await save(tester);
      final command = body(api), rows = body(api)['variants'] as List;
      expect((command['product_options'] as List).map((o) => o['name']), [
        'Size',
        'Finish',
      ]);
      expect(rows.single['id'], f.variant);
      expect(rows.single['options'], {'Size': 'M', 'Finish': 'Blue'});
      expect(rows.single['stock'], 0);
      expect(rows.single['sku'], 'SKU-OLD');
      expect(rows.single['price'], 100);
    },
  );

  testWidgets(
    'adding a third option extends sparse rows one-to-one without fabricating combinations',
    (tester) async {
      final api = f.ProductTransport('clean');
      sparse(api);
      await openOptions(tester, api);
      await change(tester, 'Add product option', 'Pack', second: 'Single');
      await save(tester);
      final rows = body(api)['variants'] as List;
      expect(rows, hasLength(2));
      expect(rows.map((r) => r['id']), [
        f.variant,
        '44444444-4444-4444-8444-444444444444',
      ]);
      expect(rows.map((r) => r['options']), [
        {'Size': 'M', 'Colour': 'Blue', 'Pack': 'Single'},
        {'Size': 'L', 'Colour': 'Red', 'Pack': 'Single'},
      ]);
      expect(rows.last['sku'], 'KEEP-SECOND');
    },
  );

  testWidgets(
    'renaming a global value changes only its rows and does not replace IDs',
    (tester) async {
      final api = f.ProductTransport('clean');
      sparse(api);
      await openOptions(tester, api);
      await change(
        tester,
        'Rename Blue in Colour',
        'Navy',
        label: 'Option value',
      );
      await save(tester);
      final rows = body(api)['variants'] as List;
      expect(rows.first['options'], {'Size': 'M', 'Colour': 'Navy'});
      expect(rows.first['title'], 'M / Navy');
      expect(rows.first['id'], f.variant);
      expect(rows.last['options'], {'Size': 'L', 'Colour': 'Red'});
      expect(rows.last['price'], 110);
      expect(rows.last['sku'], 'KEEP-SECOND');
    },
  );

  testWidgets(
    'adding a value keeps old rows and gives only new combinations no ID and zero quantity',
    (tester) async {
      final api = f.ProductTransport('clean');
      await openOptions(tester, api);
      await change(tester, 'Add value to Size', 'L', label: 'Option value');
      await save(tester);
      final rows = body(api)['variants'] as List;
      expect(rows, hasLength(2));
      expect(rows.first['id'], f.variant);
      expect(rows.last.containsKey('id'), isFalse);
      expect(rows.last['options'], {'Size': 'L', 'Colour': 'Blue'});
      expect(rows.last['stock'], 0);
      expect(rows.last['sku'], isNull);
    },
  );

  testWidgets(
    'removing an added value requires confirmation and removes only the affected draft rows',
    (tester) async {
      final api = f.ProductTransport('clean');
      await openOptions(tester, api);
      await change(tester, 'Add value to Size', 'L', label: 'Option value');
      await tester.tap(find.byTooltip('Remove L from Size'));
      await tester.pumpAndSettle();
      await press(tester, 'Cancel');
      expect(find.text('2 variants'), findsOneWidget);
      await tester.tap(find.byTooltip('Remove L from Size'));
      await tester.pumpAndSettle();
      await press(tester, 'Remove from draft');
      expect(find.text('1 variants'), findsOneWidget);
      await save(tester);
      expect((body(api)['variants'] as List).single['id'], f.variant);
      expect((body(api)['product_options'] as List).first['values'], ['M']);
    },
  );

  testWidgets(
    'axis removal that would merge bound variants is blocked without a request',
    (tester) async {
      final api = f.ProductTransport('clean');
      sparse(api, sameSize: true);
      await openOptions(tester, api);
      await press(tester, 'Remove Colour option');
      expect(
        find.text(
          'This would combine variants. Remove the conflicting variants first.',
        ),
        findsOneWidget,
      );
      expect(find.text('2 variants'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'case-colliding names preserve the invalid draft until corrected',
    (tester) async {
      final api = f.ProductTransport('clean');
      await openOptions(tester, api);
      await change(tester, 'Rename Colour option', 'size');
      expect(find.text('Each option needs a distinct name.'), findsOneWidget);
      expect(
        tester
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Option name'),
            )
            .controller!
            .text,
        'size',
      );
      expect(api.calls, isEmpty);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Option name'),
        'Finish',
      );
      await press(tester, 'Apply change');
      await save(tester);
      expect((body(api)['product_options'] as List).last['name'], 'Finish');
    },
  );

  testWidgets(
    'axis reorder preserves IDs and named values while changing only canonical positions',
    (tester) async {
      final api = f.ProductTransport('clean');
      await openOptions(tester, api);
      await tester.tap(find.byTooltip('Move Colour option up'));
      await tester.pumpAndSettle();
      await save(tester);
      expect(body(api)['product_options'], [
        {
          'name': 'Colour',
          'position': 0,
          'values': ['Blue'],
        },
        {
          'name': 'Size',
          'position': 1,
          'values': ['M'],
        },
      ]);
      final row = (body(api)['variants'] as List).single;
      expect(row['id'], f.variant);
      expect(row['options'], {'Colour': 'Blue', 'Size': 'M'});
    },
  );

  testWidgets(
    'combination limit rejects atomically and retains the entered value',
    (tester) async {
      final api = f.ProductTransport('clean');
      (api.current['options'] as List).first['values'] = List.generate(
        100,
        (i) => '$i',
      );
      (api.current['variants'] as List).single['options'] = {
        'Size': '0',
        'Colour': 'Blue',
      };
      await openOptions(tester, api);
      // The large Size card can scroll; choose the exact current option action.
      await tester.scrollUntilVisible(
        find.text('Add value to Colour'),
        500,
        scrollable: find.byType(Scrollable).last,
        maxScrolls: 30,
      );
      await change(
        tester,
        'Add value to Colour',
        'Green',
        label: 'Option value',
      );
      expect(
        find.text('Use up to 3 options and 100 variants.'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Option value'),
            )
            .controller!
            .text,
        'Green',
      );
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'store retirement removes option fields and prevents a stale apply',
    (tester) async {
      final api = f.ProductTransport('clean');
      final owners = await openOptions(tester, api);
      await press(tester, 'Rename Colour option');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Option name'),
        'Unsent',
      );
      owners.stores.selection = '66666666-6666-4666-8666-666666666666';
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.text('Apply change'), findsNothing);
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'pending option retry keeps its exact earlier body and preserves a newer option draft',
    (tester) async {
      final api = f.ProductTransport('lost');
      await openOptions(tester, api);
      await change(tester, 'Rename Colour option', 'Finish');
      await save(tester);
      expect(api.calls, hasLength(1));
      await press(tester, 'Manage product options');
      await change(tester, 'Rename Finish option', 'Material');
      await press(tester, 'Apply options');
      await press(tester, 'Retry pending save');
      expect(api.calls, hasLength(2));
      expect(api.calls[0].idempotencyKey, api.calls[1].idempotencyKey);
      expect(body(api, 0), body(api, 1));
      await press(tester, 'Update');
      expect(api.calls, hasLength(3));
      expect(api.calls[2].idempotencyKey, isNot(api.calls[1].idempotencyKey));
      expect(
        (body(api, 2)['product_options'] as List).last['name'],
        'Material',
      );
    },
  );
  testWidgets('safe axis removal preserves every remaining durable row', (
    tester,
  ) async {
    final api = f.ProductTransport('clean');
    sparse(api);
    (api.current['variants'] as List).last['options'] = {
      'Size': 'L',
      'Colour': 'Blue',
    };
    await openOptions(tester, api);
    await press(tester, 'Remove Colour option');
    await press(tester, 'Remove from draft');
    await save(tester);
    final rows = body(api)['variants'] as List;
    expect(rows.map((r) => r['id']), [
      f.variant,
      '44444444-4444-4444-8444-444444444444',
    ]);
    expect(rows.map((r) => r['options']), [
      {'Size': 'M'},
      {'Size': 'L'},
    ]);
    expect(rows.last['sku'], 'KEEP-SECOND');
  });

  testWidgets(
    'duplicate row keeps the entered values and cannot reach the server',
    (tester) async {
      final api = f.ProductTransport('clean');
      await openOptions(tester, api);
      await press(tester, 'Apply options');
      await press(tester, 'Add variant');
      await tester.enterText(find.widgetWithText(TextFormField, 'Value'), 'M');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Option 2 value'),
        'Blue',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Add variant'));
      await tester.pumpAndSettle();
      expect(
        find.text('A variant with these option values already exists.'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<TextFormField>(
              find.widgetWithText(TextFormField, 'Option 2 value'),
            )
            .controller!
            .text,
        'Blue',
      );
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'conflicted option draft survives until explicit current-version reload',
    (tester) async {
      final api = f.ProductTransport('conflict');
      await openOptions(tester, api);
      await change(tester, 'Rename Colour option', 'Finish');
      await save(tester);
      expect(find.textContaining('Server winner'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Update'))
            .onPressed,
        isNull,
      );
      await press(tester, 'Manage product options');
      expect(find.text('Rename Finish option'), findsOneWidget);
      await press(tester, 'Apply options');
      await press(tester, 'Reload latest and discard my edits');
      await press(tester, 'Manage product options');
      expect(find.text('Rename Colour option'), findsOneWidget);
      await change(tester, 'Rename Colour option', 'Material');
      await save(tester);
      expect(body(api, 1)['version'], 23);
      expect(
        (body(api, 1)['product_options'] as List).last['name'],
        'Material',
      );
    },
  );
}
