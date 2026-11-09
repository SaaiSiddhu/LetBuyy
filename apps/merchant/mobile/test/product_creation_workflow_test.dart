// Mounted creation UI, actual ProductService and shared SDK. Synthetic responses
// test presentation/retry intent; real permissions/effects use the owned suite.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'product_edit_concurrency_test.dart' as f;
import 'product_option_matrix_workflow_test.dart' as m;
import 'support/editor_steps_fixture.dart';

class CreationTransport extends f.ProductTransport {
  CreationTransport([this.creationMode = 'clean']) : super('clean');
  final String creationMode;
  final creations = <ApiRequestOptions>[];
  final receipts = <String, JsonMap>{};
  Completer<JsonMap>? hold;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method != HttpMethod.post)
      return super.requestJson(path, options: options);
    creations.add(options!);
    if (creationMode == 'denied')
      throw const ApiException(
        message: 'Current permission revoked',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    if (creationMode == 'quota') {
      throw const ApiException(
        message: 'Your store has reached its product limit.',
        statusCode: 403,
        code: 'PRODUCT_LIMIT_REACHED',
      );
    }
    if (hold != null) return hold!.future;
    final key = options.idempotencyKey ?? 'missing-${creations.length}';
    if (receipts[key] case final prior?) return prior;
    final input = jsonDecode(jsonEncode(options.body)) as JsonMap;
    current = {
      ...f.initial(),
      ...input,
      'options': input['product_options'] ?? [],
      'version': 11,
      'variants': [
        for (final row in (input['variants'] as List? ?? []))
          {
            ...row as Map,
            'id': f.variant,
            'price': row['price'] ?? input['price'],
          },
      ],
    };
    receipts[key] = jsonDecode(jsonEncode(current)) as JsonMap;
    if (creationMode == 'lost' && creations.length == 1)
      throw const ApiException(
        message: 'Synthetic committed reply lost',
        statusCode: 503,
        code: 'UNAVAILABLE',
      );
    if (creationMode == 'bad-response' && creations.length == 1) {
      return {...current, 'store_id': 'foreign-store'};
    }
    return current;
  }
}

Future<({ProductService service, f.SelectedStore stores})> openCreation(
  WidgetTester tester,
  CreationTransport api,
) async {
  tester.view.physicalSize = const Size(1000, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final service = ProductService(api: api), stores = f.SelectedStore(api);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<ProductService>.value(value: service),
        ChangeNotifierProvider<StoreContext>.value(value: stores),
      ],
      child: MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const ProductFormScreen(),
                ),
              ),
              child: const Text('Open creation'),
            ),
          ),
        ),
      ),
    ),
  );
  await m.press(tester, 'Open creation');
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
    service.dispose();
    stores.dispose();
    api.close();
  });
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Product Name *'),
    'Synthetic new product',
  );
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Description'),
    'Synthetic description',
  );
  return (service: service, stores: stores);
}

Future<void> price(WidgetTester tester, [String amount = '125']) async {
  await selectEditorSection(tester, 'Pricing');
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Sale Price *'),
    amount,
  );
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Stock Quantity *'),
    '0',
  );
}

Future<void> image(WidgetTester tester) async {
  await selectEditorSection(tester, 'Images');
  await m.press(tester, 'Add Image');
  await m.press(tester, 'Image URL');
  await tester.enterText(
    find.widgetWithText(TextFormField, 'Image URL'),
    'https://images.example.invalid/new-product.png',
  );
  await m.press(tester, 'Add');
}

Future<void> axis(WidgetTester tester) async {
  await selectEditorSection(tester, 'Variants');
  await m.press(tester, 'Manage product options');
  await m.change(tester, 'Add product option', 'Size', second: 'M');
  await m.press(tester, 'Apply options');
}

void main() {
  testWidgets(
    'valid image-free new product uses the existing canonical create contract',
    (tester) async {
      final api = CreationTransport();
      await openCreation(tester, api);
      await price(tester);
      await m.press(tester, 'Save');
      expect(api.creations, hasLength(1));
      expect((api.creations.single.body as Map)['images'], isEmpty);
      expect(find.text('Open creation'), findsOneWidget);
    },
  );
  testWidgets(
    'options added before price entry inherit the eventual product price',
    (tester) async {
      final api = CreationTransport();
      await openCreation(tester, api);
      await axis(tester);
      await price(tester);
      await selectEditorSection(tester, 'Variants');
      await m.press(tester, 'Edit M variant');
      expect(
        tester
            .widget<TextFormField>(find.widgetWithText(TextFormField, 'Price'))
            .controller!
            .text,
        isEmpty,
      );
      await m.press(tester, 'Save variant');
      await m.press(tester, 'Save');
      final row =
          ((api.creations.single.body as Map)['variants'] as List).single
              as Map;
      expect(row.containsKey('price'), isFalse);
      expect((api.creations.single.body as Map)['price'], 125);
    },
  );
  testWidgets(
    'removing the last unsaved variant clears orphan option definitions',
    (tester) async {
      final api = CreationTransport();
      await openCreation(tester, api);
      await axis(tester);
      await m.press(tester, 'Delete M variant');
      await m.press(tester, 'Cancel');
      expect(find.text('Edit M variant'), findsOneWidget);
      await m.press(tester, 'Delete M variant');
      await m.press(tester, 'Remove variant');
      await m.press(tester, 'Manage product options');
      expect(find.text('Rename Size option'), findsNothing);
      await m.press(tester, 'Apply options');
      await price(tester);
      await m.press(tester, 'Save');
      expect((api.creations.single.body as Map)['product_options'], isEmpty);
    },
  );
  testWidgets(
    'unconfirmed creation replays its exact original key/body and never creates a second product',
    (tester) async {
      final api = CreationTransport('lost');
      await openCreation(tester, api);
      await price(tester);
      await image(tester);
      await m.press(tester, 'Save');
      expect(api.creations, hasLength(1));
      expect(api.creations.single.idempotencyKey, isNotNull);
      expect(find.text('Retry pending save'), findsOneWidget);
      await selectEditorSection(tester, 'Basic Info');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Product Name *'),
        'A newer draft',
      );
      await m.press(tester, 'Retry pending save');
      expect(api.creations, hasLength(2));
      expect(api.creations[1].idempotencyKey, api.creations[0].idempotencyKey);
      expect(api.creations[1].body, api.creations[0].body);
      expect(api.receipts, hasLength(1));
      expect(find.text('A newer draft'), findsOneWidget);
      expect(find.text('Update'), findsOneWidget);
      await m.press(tester, 'Update');
      expect(api.creations, hasLength(2));
      expect(api.calls, hasLength(1));
      expect((api.calls.single.body as Map)['name'], 'A newer draft');
    },
  );
  testWidgets(
    'a current create permission denial retires private editable fields',
    (tester) async {
      final api = CreationTransport('denied');
      await openCreation(tester, api);
      await price(tester);
      await image(tester);
      await m.press(tester, 'Save');
      expect(api.creations, hasLength(1));
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(api.receipts, isEmpty);
    },
  );
  testWidgets('description-free creation stays valid', (tester) async {
    final api = CreationTransport();
    await openCreation(tester, api);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Description'),
      '',
    );
    await price(tester);
    await m.press(tester, 'Save');
    expect(api.creations, hasLength(1));
    expect(
      (api.creations.single.body as Map).containsKey('description'),
      isFalse,
    );
  });
  testWidgets(
    'a Code option follows the catalog contract through original-key creation recovery',
    (tester) async {
      final api = CreationTransport('lost');
      final mounted = await openCreation(tester, api);
      await selectEditorSection(tester, 'Variants');
      await m.press(tester, 'Manage product options');
      await m.change(tester, 'Add product option', 'Code', second: 'M');
      await m.press(tester, 'Apply options');
      await price(tester);
      await m.press(tester, 'Save');
      expect(api.creations, hasLength(1));
      expect(
        (((api.creations.single.body as Map)['variants'] as List).single
            as Map)['options'],
        {'Code': 'M'},
      );
      await m.press(tester, 'Retry pending save');
      expect(api.creations, hasLength(2));
      expect(api.creations[1].body, api.creations[0].body);
      expect(api.creations[1].idempotencyKey, api.creations[0].idempotencyKey);
      expect(api.receipts, hasLength(1));
      expect(mounted.service.products, hasLength(1));
      expect(find.text('Open creation'), findsOneWidget);
    },
  );
  testWidgets(
    'a definitive product quota refusal preserves editable draft and does not claim access revocation',
    (tester) async {
      final api = CreationTransport('quota');
      await openCreation(tester, api);
      await price(tester);
      await m.press(tester, 'Save');
      expect(api.creations, hasLength(1));
      expect(find.text('Store access changed'), findsNothing);
      expect(find.text('Retry pending save'), findsNothing);
      expect(find.byType(TextFormField), findsWidgets);
      expect(
        find.textContaining('Your store has reached its product limit.'),
        findsOneWidget,
      );
      expect(api.receipts, isEmpty);
    },
  );
  testWidgets('invalid newer input cannot prevent original creation recovery', (
    tester,
  ) async {
    final api = CreationTransport('lost');
    await openCreation(tester, api);
    await price(tester);
    await m.press(tester, 'Save');
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Sale Price *'),
      '',
    );
    await m.press(tester, 'Retry pending save');
    expect(api.creations, hasLength(2));
    expect(api.creations[1].body, api.creations[0].body);
    expect(find.text('Update'), findsOneWidget);
    expect(
      tester
          .widget<TextFormField>(
            find.widgetWithText(TextFormField, 'Sale Price *'),
          )
          .controller!
          .text,
      isEmpty,
    );
    await m.press(tester, 'Update');
    expect(api.calls, isEmpty);
  });
  testWidgets(
    'malformed acknowledgement keeps the original key until recovery',
    (tester) async {
      final api = CreationTransport('bad-response');
      final mounted = await openCreation(tester, api);
      await price(tester);
      await m.press(tester, 'Save');
      expect(find.text('Retry pending save'), findsOneWidget);
      expect(mounted.service.products, isEmpty);
      await m.press(tester, 'Retry pending save');
      expect(api.creations[1].idempotencyKey, api.creations[0].idempotencyKey);
      expect(api.receipts, hasLength(1));
      expect(mounted.service.products, hasLength(1));
      expect(find.text('Open creation'), findsOneWidget);
    },
  );
  testWidgets(
    'store changes retire an in-flight creation without stale navigation',
    (tester) async {
      final api = CreationTransport()..hold = Completer<JsonMap>();
      final mounted = await openCreation(tester, api);
      await price(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pump();
      expect(api.creations, hasLength(1));
      mounted.stores.selection = 'foreign-store';
      await tester.pump();
      api.hold!.complete({
        ...f.initial(),
        ...api.creations.single.body as Map<String, dynamic>,
        'version': 11,
      });
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(api.creations, hasLength(1));
      expect(find.text('Product created!'), findsNothing);
    },
  );
  testWidgets(
    'newer variant identity needs explicit review after creation acknowledgement',
    (tester) async {
      final api = CreationTransport('lost');
      await openCreation(tester, api);
      await axis(tester);
      await price(tester);
      await m.press(tester, 'Save');
      await selectEditorSection(tester, 'Variants');
      await m.press(tester, 'Delete M variant');
      await m.press(tester, 'Remove variant');
      await m.press(tester, 'Retry pending save');
      expect(api.creations, hasLength(2));
      expect(api.creations[1].body, api.creations[0].body);
      expect(find.text('Reload latest and discard my edits'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Update'))
            .onPressed,
        isNull,
      );
      expect(api.calls, isEmpty);
    },
  );
}
