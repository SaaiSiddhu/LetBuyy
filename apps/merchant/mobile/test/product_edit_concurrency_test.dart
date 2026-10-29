import 'dart:async';
// Mounted actual form + ProductService + shared ProductsApi. Synthetic transport
// outcomes are separate from the real Gateway/app_tenant effects in the owned suite.
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show ProductContract;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

const site = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const variant = '33333333-3333-4333-8333-333333333333';
JsonMap initial() => {
  'id': id,
  'store_id': site,
  'version': 7,
  'name': 'Original product',
  'description': 'Synthetic complete description',
  'price': 100,
  'stock': 0,
  'images': ['https://images.example.invalid/product.png'],
  'options': [
    {
      'name': 'Size',
      'position': 0,
      'values': ['M'],
    },
    {
      'name': 'Colour',
      'position': 1,
      'values': ['Blue'],
    },
  ],
  'variants': [
    {
      'id': variant,
      'title': 'M / Blue',
      'sku': 'SKU-OLD',
      'stock': 0,
      'inventory_quantity': 0,
      'price': 100,
      'options': {'Size': 'M', 'Colour': 'Blue'},
    },
  ],
};

class ProductTransport extends ApiClient {
  ProductTransport(this.mode)
    : super(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
  final String mode;
  JsonMap current = initial();
  final calls = <ApiRequestOptions>[];
  JsonMap? receipt;
  String? receiptKey;
  bool readFails = false;
  Completer<JsonMap>? heldSave, heldRead;
  int readStatus = 200, detailReads = 0;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method != HttpMethod.patch) {
      detailReads++;
      if (readStatus != 200)
        throw ApiException(
          message: 'Synthetic access denial',
          statusCode: readStatus,
          code: 'FORBIDDEN',
        );
      if (heldRead != null) return heldRead!.future;
      if (readFails)
        throw const ApiException(
          message: 'Synthetic read outage',
          statusCode: 503,
          code: 'UNAVAILABLE',
        );
      return jsonDecode(jsonEncode(current)) as JsonMap;
    }
    calls.add(options!);
    if (mode == 'denied')
      throw const ApiException(
        message: 'Synthetic current permission denied',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    final body = options.body as Map<String, dynamic>;
    if (calls.length == 1 && mode == 'conflict') {
      current = {...initial(), 'name': 'Server winner', 'version': 23};
      throw const ApiException(
        message: 'Product changed; keep your draft and reload.',
        statusCode: 409,
        code: 'PRODUCT_VERSION_CONFLICT',
      );
    }
    if (receiptKey == options.idempotencyKey) return receipt!;
    current = {...current, ...body, 'version': (current['version'] as int) + 6};
    current['variants'] = (body['variants'] as List)
        .map(
          (row) => {
            ...(row as Map<String, dynamic>),
            'id': row['id'] ?? '55555555-5555-4555-8555-555555555555',
          },
        )
        .toList();
    current['options'] = body['product_options'];
    receiptKey = options.idempotencyKey;
    receipt = jsonDecode(jsonEncode(current)) as JsonMap;
    if (calls.length == 1 && mode == 'lost') {
      throw const ApiException(
        message: 'Synthetic response lost after server commit',
        statusCode: 503,
        code: 'UNAVAILABLE',
      );
    }
    return heldSave != null ? heldSave!.future : receipt!;
  }
}

class SelectedStore extends StoreContext {
  SelectedStore(ProductTransport api)
    : super(storeService: StoreService(api: api));
  String _selection = site;
  int _generation = 0;
  String get selection => _selection;
  set selection(String value) {
    _selection = value;
    _generation++;
    notifyListeners();
  }

  @override
  Object get requestContextKey => (_selection, _generation);
  @override
  String get selectedStoreId => _selection;
  @override
  StoreModel get selectedStore =>
      StoreModel.fromJson({'id': _selection, 'name': 'Synthetic store'});
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async =>
      StoreModel.fromJson({'id': selection, 'name': 'Synthetic store'});
}

Future<({ProductService service, SelectedStore stores})> mount(
  WidgetTester tester,
  ProductTransport api, {
  bool settle = true,
}) async {
  final service = ProductService(api: api), stores = SelectedStore(api);
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
                  builder: (_) => ProductFormScreen(
                    product: ProductContract.fromJson(initial()),
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
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
  }
  return (service: service, stores: stores);
}

Finder nameField() => find.widgetWithText(TextFormField, 'Product Name *');
String nameText(WidgetTester tester) =>
    tester.widget<TextFormField>(nameField()).controller!.text;

void main() {
  testWidgets(
    'pending recovery ignores newer invalid numeric input and keeps it unsaved',
    (tester) async {
      tester.view.physicalSize = const Size(1000, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = ProductTransport('lost');
      await mount(tester, api);
      await tester.enterText(nameField(), 'First valid save');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Pricing'));
      await tester.tap(find.text('Pricing'));
      await tester.pumpAndSettle();
      final price = find.widgetWithText(TextFormField, 'Sale Price *');
      await tester.enterText(price, '');
      await tester.tap(find.text('Retry pending save'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(2));
      expect(api.calls[1].body, api.calls[0].body);
      expect(api.calls[1].idempotencyKey, api.calls[0].idempotencyKey);
      expect(tester.widget<TextFormField>(price).controller!.text, '');
      expect(find.textContaining('Your newer draft is kept'), findsOneWidget);
    },
  );

  testWidgets(
    'new variant server identity is recovered before a newer scalar draft is saved',
    (tester) async {
      tester.view.physicalSize = const Size(1000, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = ProductTransport('lost');
      await mount(tester, api);
      await tester.ensureVisible(find.text('Variants'));
      await tester.tap(find.text('Variants'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ElevatedButton, 'Add variant'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextFormField, 'Value'), 'L');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Price'),
        '100',
      );
      await tester.tap(find.widgetWithText(ElevatedButton, 'Add variant').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect((api.calls.single.body as Map)['variants'], hasLength(2));
      expect(
        ((api.calls.single.body as Map)['variants'] as List).last['id'],
        isNull,
      );
      await tester.ensureVisible(find.text('Basic Info'));
      await tester.tap(find.text('Basic Info'));
      await tester.pumpAndSettle();
      await tester.enterText(nameField(), 'Newer scalar draft');
      await tester.tap(find.text('Retry pending save'));
      await tester.pumpAndSettle();
      expect(nameText(tester), 'Newer scalar draft');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(3));
      final rows = (api.calls.last.body as Map)['variants'] as List;
      expect(rows.first['id'], variant);
      expect(rows.last['id'], '55555555-5555-4555-8555-555555555555');
      expect((api.calls.last.body as Map)['version'], 13);
    },
  );

  testWidgets(
    'conflict keeps the actual draft, shows latest, and only explicit reload adopts its version',
    (tester) async {
      final api = ProductTransport('conflict');
      await mount(tester, api);
      await tester.enterText(nameField(), 'My unsaved draft');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect(nameText(tester), 'My unsaved draft');
      expect(find.textContaining('Server winner'), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Update'))
            .onPressed,
        isNull,
      );
      expect(api.calls.single.body, containsPair('version', 7));
      await tester.tap(find.text('Reload latest and discard my edits'));
      await tester.pumpAndSettle();
      expect(nameText(tester), 'Server winner');
      await tester.enterText(nameField(), 'Reviewed after reload');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect((api.calls.last.body as Map)['version'], 23);
      expect(
        api.calls.last.idempotencyKey,
        isNot(api.calls.first.idempotencyKey),
      );
    },
  );

  testWidgets(
    'ambiguous save retries the captured intent and preserves a newer draft after recovery',
    (tester) async {
      final api = ProductTransport('lost');
      await mount(tester, api);
      await tester.enterText(nameField(), 'First save');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect(find.text('Retry pending save'), findsOneWidget);
      await tester.enterText(nameField(), 'Newer unsaved draft');
      await tester.tap(find.text('Retry pending save'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(2));
      expect(api.calls[1].idempotencyKey, api.calls[0].idempotencyKey);
      expect(api.calls[1].body, api.calls[0].body);
      expect(nameText(tester), 'Newer unsaved draft');
      expect(find.textContaining('Your newer draft is kept'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect((api.calls.last.body as Map)['version'], 13);
      expect((api.calls.last.body as Map)['name'], 'Newer unsaved draft');
      expect(
        api.calls.last.idempotencyKey,
        isNot(api.calls.first.idempotencyKey),
      );
    },
  );

  testWidgets(
    'normal form sends stable variant ID, all named options, and exact zero stock',
    (tester) async {
      final api = ProductTransport('success');
      await mount(tester, api);
      await tester.enterText(nameField(), 'Renamed product');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      final body = api.calls.single.body as Map;
      expect(body['version'], 7);
      final row = (body['variants'] as List).single as Map;
      expect(row['id'], variant);
      expect(row['stock'], 0);
      expect(row['options'], {'Size': 'M', 'Colour': 'Blue'});
      expect(api.calls.single.storeId, site);
    },
  );

  testWidgets('selected store change cannot submit the old product draft', (
    tester,
  ) async {
    final api = ProductTransport('success');
    final harness = await mount(tester, api);
    harness.stores.selection = '44444444-4444-4444-8444-444444444444';
    await tester.pumpAndSettle();
    expect(api.calls, isEmpty);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('Store access changed'), findsOneWidget);
  });

  testWidgets(
    'fresh edit read outage cannot silently turn cached data into an editable version',
    (tester) async {
      final api = ProductTransport('success')..readFails = true;
      await mount(tester, api);
      expect(find.text('Retry product'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.widgetWithText(TextButton, 'Update'), findsNothing);
      expect(api.calls, isEmpty);
      api.readFails = false;
      await tester.tap(find.text('Retry product'));
      await tester.pumpAndSettle();
      expect(nameText(tester), 'Original product');
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Update'))
            .onPressed,
        isNotNull,
      );
    },
  );
  testWidgets('A-B-A cannot revive an old pushed product form', (tester) async {
    final api = ProductTransport('success');
    final h = await mount(tester, api);
    h.stores.selection = 'other';
    h.stores.selection = site;
    await tester.pumpAndSettle();
    expect(find.text('Store access changed'), findsOneWidget);
    expect(find.byType(TextFormField), findsNothing);
    expect(api.calls, isEmpty);
  });
  testWidgets(
    'save completion after a store change cannot reveal old fields or announce success',
    (tester) async {
      final api = ProductTransport('success');
      final h = await mount(tester, api);
      api.heldSave = Completer<JsonMap>();
      await tester.enterText(nameField(), 'Old private draft');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pump();
      expect(api.calls, hasLength(1));
      h.stores.selection = 'other';
      await tester.pump();
      api.heldSave!.complete(api.receipt!);
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('Product updated!'), findsNothing);
    },
  );
  testWidgets(
    'initial read denial cannot reveal the supplied private product snapshot',
    (tester) async {
      final api = ProductTransport('success')..readStatus = 403;
      await mount(tester, api);
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('Original product'), findsNothing);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'private product fields appear only after the fresh read succeeds',
    (tester) async {
      final api = ProductTransport('success')..heldRead = Completer<JsonMap>();
      await mount(tester, api, settle: false);
      expect(api.detailReads, 1);
      expect(find.text('Load product'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      api.heldRead!.complete(initial());
      await tester.pumpAndSettle();
      expect(nameText(tester), 'Original product');
    },
  );
  testWidgets(
    'retired initial read cannot disclose the old product in the next store',
    (tester) async {
      final api = ProductTransport('success')..heldRead = Completer<JsonMap>();
      final h = await mount(tester, api, settle: false);
      expect(api.detailReads, 1);
      h.stores.selection = 'other';
      await tester.pump();
      api.heldRead!.complete(initial());
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'a current write denial retires the private editor instead of retaining old authority',
    (tester) async {
      final api = ProductTransport('denied');
      await mount(tester, api);
      expect(nameText(tester), 'Original product');
      await tester.tap(find.widgetWithText(TextButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(1));
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('Product updated!'), findsNothing);
    },
  );
}
