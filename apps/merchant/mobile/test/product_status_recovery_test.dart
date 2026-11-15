// Actual ProductService, encrypted command owner and shared versioned ProductsApi.
// Transport faults are fixtures; database effects are qualified in the owned DB lane.
import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;
import 'support/membership_page.dart';

const site = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';
JsonMap product(String id, {int version = 7, String status = 'active'}) => {
  'id': id,
  'store_id': site,
  'name': 'Synthetic $id',
  'price': 100,
  'stock': 2,
  'catalog_available_quantity': 2,
  'version': version,
  'status': status,
  'is_active': status == 'active',
  'options': [],
  'variants': [],
};

class Transport extends ApiClient {
  Transport()
    : super(baseUrl: 'https://gateway.synthetic.invalid/v1', maxRetries: 0);
  final rows = {'one': product('one'), 'two': product('two')};
  final receipts = <String, JsonMap>{}, writes = <ApiRequestOptions>[];
  bool loseReply = false, malformed = false, deny = false;
  int effects = 0;
  JsonMap bulkReply = {};
  Completer<void>? entered, release;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async => PaginatedResponse(
    data: path == '/stores'
        ? [
            {
              'id': site,
              'name': 'Synthetic store',
              'subdomain': 'synthetic-store',
            },
          ]
        : rows.values.map((row) => Map<String, dynamic>.from(row)).toList(),
    page: 1,
    limit: 50,
    total: path == '/stores' ? 1 : rows.length,
    hasMore: false,
    meta: path == '/stores' ? membershipPageMeta(1) : const {},
  );
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path == '/products/bulk') return bulkReply;
    final id = path.split('/').last;
    if (options?.method != HttpMethod.patch) return Map.of(rows[id]!);
    writes.add(options!);
    if (deny)
      throw const ApiException(
        message: 'Synthetic access revoked',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    final prior = receipts[options.idempotencyKey];
    if (prior != null) return Map.of(prior);
    final body = asJsonMap(options.body);
    if (body['version'] != rows[id]!['version'])
      throw const ApiException(
        message: 'Synthetic web revision won',
        statusCode: 409,
        code: 'PRODUCT_VERSION_CONFLICT',
      );
    rows[id] = {
      ...rows[id]!,
      ...body,
      'version': (rows[id]!['version'] as int) + 1,
    };
    effects++;
    receipts[options.idempotencyKey!] = Map.of(rows[id]!);
    if (entered != null) {
      entered!.complete();
      entered = null;
      await release!.future;
    }
    if (loseReply) {
      loseReply = false;
      throw const ApiException(
        message: 'Synthetic committed reply lost',
        statusCode: 503,
        code: 'SYNTHETIC_REPLY_LOST',
      );
    }
    return malformed
        ? {...rows[id]!, 'status': 'active', 'is_active': true}
        : Map.of(rows[id]!);
  }
}

class Harness {
  final api = Transport(), storage = MemoryStorage();
  String currentActor = actor, currentStore = site;
  ProductService service() => ProductService(
    api: api,
    actorIdProvider: () => currentActor,
    storeIdProvider: () => currentStore,
    commands: SecurityCommandStore(storage: storage),
  );
}

List<ProductContract> initial() =>
    ['one', 'two'].map((id) => ProductContract.fromJson(product(id))).toList();
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'normal product selection recovers the saved status after a lost reply',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final h = Harness(),
          stores = StoreService(api: h.api),
          service = h.service();
      final scope = StoreContext(storeService: stores);
      h.api.loseReply = true;
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreService>.value(value: stores),
            ChangeNotifierProvider<StoreContext>.value(value: scope),
            ChangeNotifierProvider<ProductService>.value(value: service),
          ],
          child: const MaterialApp(home: ProductsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.bySemanticsLabel('Select'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.byKey(const ValueKey('product-select-one')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('product-select-one')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.byKey(const ValueKey('product-select-two')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('product-select-two')));
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel('Remove'), findsNothing);
      await tester.tap(find.bySemanticsLabel('Set as draft'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Set as draft'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Saved product changes:'), findsOneWidget);
      expect(find.textContaining('Product changes confirmed.'), findsNothing);
      final original = h.api.writes.single.idempotencyKey;
      await tester.ensureVisible(find.text('Retry saved product changes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Retry saved product changes'));
      await tester.pumpAndSettle();
      expect(h.api.writes[1].idempotencyKey, original);
      expect(h.api.effects, 2);
      expect(find.text('Catalog status: Draft'), findsNWidgets(2));
      expect(find.textContaining('Saved product changes:'), findsNothing);
      expect(
        find.text('Product changes confirmed. Catalog refreshed.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  test(
    'lost acknowledgement survives service recreation and replays exact versions and keys once',
    () async {
      final h = Harness(), first = h.service();
      h.api.loseReply = true;
      await expectLater(
        first.changeProductStatuses(site, initial(), 'draft'),
        throwsA(isA<ApiException>()),
      );
      final original = h.api.writes.single;
      expect(h.api.effects, 1);
      expect(await first.pendingProductStatus(site), isNotNull);
      final restored = h.service();
      expect(await restored.retryProductStatuses(site), isNull);
      expect(h.api.effects, 2);
      expect(h.api.writes.length, 3);
      expect(h.api.writes[1].body, original.body);
      expect(h.api.writes[1].idempotencyKey, original.idempotencyKey);
      expect(
        h.api.writes.every((o) => o.storeId == site && o.maxRetries == 0),
        isTrue,
      );
      expect(
        h.api.rows.values.every(
          (p) => p['status'] == 'draft' && p['is_active'] == false,
        ),
        isTrue,
      );
      expect(await restored.pendingProductStatus(site), isNull);
    },
  );
  test(
    'concurrent duplicate taps cannot replace the saved identity or repeat effects',
    () async {
      final h = Harness(), s = h.service();
      await Future.wait([
        s.changeProductStatuses(site, initial(), 'draft'),
        s.changeProductStatuses(site, initial(), 'draft'),
      ]);
      expect(h.api.effects, 2);
      expect(h.api.writes.length, 2);
      expect(await s.pendingProductStatus(site), isNull);
    },
  );
  test(
    'web revision conflicts preserve unrelated acknowledgements and require reviewed reapplication',
    () async {
      final h = Harness(), s = h.service();
      h.api.rows['one'] = product('one', version: 12);
      final pending = await s.changeProductStatuses(site, initial(), 'draft');
      expect(h.api.effects, 1);
      expect((pending!.intent['items'] as List).map((r) => r['outcome']), [
        'conflict',
        'confirmed',
      ]);
      expect(await s.retryProductStatuses(site), isNotNull);
      expect(h.api.effects, 1);
      final reviewed = await s.reviewProductStatuses(site);
      expect(reviewed.single.version, 12);
      expect(
        await s.applyReviewedProductStatuses(site, pending, reviewed),
        isNull,
      );
      expect(h.api.effects, 2);
      expect(h.api.rows['one']!['version'], 13);
      expect(
        h.api.writes.where((o) => (o.body as Map)['version'] == 12),
        hasLength(1),
      );
    },
  );
  test(
    'malformed success stays recoverable and changed intent cannot discard it',
    () async {
      final h = Harness(), s = h.service();
      h.api.malformed = true;
      await expectLater(
        s.changeProductStatuses(site, initial(), 'draft'),
        throwsA(isA<ApiException>()),
      );
      expect(await s.pendingProductStatus(site), isNotNull);
      await expectLater(
        s.changeProductStatuses(site, initial(), 'archived'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'PENDING_SECURITY_COMMAND',
          ),
        ),
      );
      h.api.malformed = false;
      expect(await s.retryProductStatuses(site), isNull);
      expect(h.api.effects, 2);
    },
  );
  test(
    'denial retains original recovery identity without sharing it with another account',
    () async {
      final h = Harness(), s = h.service();
      h.api.deny = true;
      await expectLater(
        s.changeProductStatuses(site, initial(), 'draft'),
        throwsA(isA<ApiException>()),
      );
      final key = (await s.pendingProductStatus(site))!.key;
      h.currentActor = '33333333-3333-4333-8333-333333333333';
      expect(await s.pendingProductStatus(site), isNull);
      expect(await s.retryProductStatuses(site), isNull);
      h.currentActor = actor;
      expect((await s.pendingProductStatus(site))!.key, key);
      expect(h.api.effects, 0);
    },
  );
  test('late acknowledgement cannot clear a retired account request', () async {
    final h = Harness(), s = h.service();
    h.api.entered = Completer<void>();
    h.api.release = Completer<void>();
    final entered = h.api.entered!.future;
    final denied = expectLater(
      s.changeProductStatuses(site, initial(), 'draft'),
      throwsA(isA<ApiException>()),
    );
    await entered;
    h.currentStore = 'another-store';
    h.api.release!.complete();
    await denied;
    h.currentStore = site;
    expect(await s.pendingProductStatus(site), isNotNull);
    expect(h.api.effects, 1);
    expect(await s.retryProductStatuses(site), isNull);
    expect(h.api.effects, 2);
  });
  test(
    'missing versions and foreign products fail before the first side effect',
    () async {
      for (final row in [
        {...product('one'), 'version': null},
        {...product('one'), 'store_id': 'foreign'},
      ]) {
        final h = Harness();
        await expectLater(
          h.service().changeProductStatuses(site, [
            ProductContract.fromJson(row),
          ], 'draft'),
          throwsFormatException,
        );
        expect(h.api.writes, isEmpty);
        expect(h.storage.data, isEmpty);
      }
    },
  );
  test(
    'queued product changes cannot adopt a replacement account in the same store',
    () async {
      final h = Harness(),
          gate = Completer<void>(),
          entered = Completer<void>();
      final prior = SecurityCommandStore(storage: h.storage).serialized(
        () async {
          entered.complete();
          await gate.future;
        },
      );
      await entered.future;
      final pending = h.service().changeProductStatuses(
        site,
        initial(),
        'draft',
      );
      final refused = expectLater(
        pending,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      h.currentActor = '33333333-3333-4333-8333-333333333333';
      gate.complete();
      await prior;
      await refused;
      expect(h.api.writes, isEmpty);
      expect(h.storage.data, isEmpty);
    },
  );
  test(
    'failed encrypted intent persistence cannot send the first product mutation',
    () async {
      final h = Harness();
      h.storage.failWrite = true;
      await expectLater(
        h.service().changeProductStatuses(site, initial(), 'draft'),
        throwsStateError,
      );
      expect(h.api.writes, isEmpty);
      expect(h.api.effects, 0);
    },
  );
  test(
    'bulk acknowledgements cannot manufacture a missing or invalid affected count',
    () async {
      for (final value in [null, -1, 1.5, '1', true, 3]) {
        final h = Harness();
        h.api.bulkReply = {if (value != null) 'affected': value};
        await expectLater(
          h.service().bulkAction(
            action: 'deactivate',
            productIds: ['one', 'two'],
            storeId: site,
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'PRODUCT_BULK_UNCONFIRMED',
            ),
          ),
        );
      }
    },
  );
}
