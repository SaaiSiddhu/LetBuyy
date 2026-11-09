// Native widgets and real shared transport preparation with synthetic responses.
// SQL atomicity and current-owner enforcement belong to the owned database lane.
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/collection_membership_screen.dart';
import 'package:letbuyy_store/screens/products/collections_screen.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

const site = '11111111-1111-4111-8111-111111111111',
    actor = '22222222-2222-4222-8222-222222222222',
    collection = '33333333-3333-4333-8333-333333333333',
    one = '44444444-4444-4444-8444-444444444444',
    two = '55555555-5555-4555-8555-555555555555';
JsonMap snapshot({
  int version = 3,
  List<String> ids = const [one, two],
  List<String> unavailable = const [],
  String store = site,
}) => {
  'collection_id': collection,
  'store_id': store,
  'membership_version': version,
  'product_ids': ids,
  'products': [
    for (final id in ids)
      if (!unavailable.contains(id))
        {
          'id': id,
          'name': id == one ? 'Cotton tote' : 'Blue shirt',
          'price': 100,
          'is_active': true,
          'thumbnail_url': null,
        },
  ],
  'unavailable_product_ids': unavailable,
};

class Transport extends ApiClient {
  Transport()
    : super(baseUrl: 'https://gateway.synthetic.invalid/v1', maxRetries: 0);
  JsonMap current = snapshot();
  final writes = <ApiRequestOptions>[], receipts = <String, JsonMap>{};
  bool lose = false, deny = false, malformed = false, reject = false;
  bool hidden = false, failProducts = false;
  bool missing = false;
  ApiException? failure;
  int effects = 0;
  Completer<void>? entered, release;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    if (path == '/products/collections')
      return PaginatedResponse(
        data: [
          if (!hidden)
            {
              'id': collection,
              'store_id': site,
              'title': 'Synthetic collection',
              'description': null,
              'image_url': null,
              'created_at': '2026-11-02T00:00:00Z',
              'is_active': true,
              'membership_version': current['membership_version'],
              'product_count': (current['product_ids'] as List).length,
            },
        ],
        page: 1,
        limit: 20,
        total: hidden ? 0 : 1,
        hasMore: false,
        meta: {
          'page': 1,
          'per_page': 20,
          'total': hidden ? 0 : 1,
          'total_pages': hidden ? 0 : 1,
          'has_next': false,
          'has_prev': false,
        },
      );
    if (path == '/products' && failProducts) {
      throw const ApiException(
        message: 'Synthetic product read unavailable',
        statusCode: 503,
        code: 'SYNTHETIC_UNAVAILABLE',
      );
    }
    if (path == '/products')
      return PaginatedResponse(
        data: [
          for (final p in snapshot()['products'])
            {
              ...asJsonMap(p),
              'store_id': site,
              'version': 3,
              'stock': 2,
              'status': 'active',
              'options': [],
              'variants': [],
            },
        ],
        page: 1,
        limit: 50,
        total: 2,
        hasMore: false,
      );
    return PaginatedResponse(
      data: [
        {'id': site, 'name': 'Synthetic store', 'subdomain': 'synthetic-store'},
      ],
      page: 1,
      limit: 50,
      total: 1,
      hasMore: false,
    );
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (deny)
      throw const ApiException(
        message: 'Synthetic revoked owner',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    if (options?.method != HttpMethod.put) return Map.of(current);
    writes.add(options!);
    if (failure != null) throw failure!;
    final body = asJsonMap(options.body), key = options.idempotencyKey!;
    if (reject)
      throw const ApiException(
        message: 'Synthetic deleted product',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      );
    if (receipts.containsKey(key)) return Map.of(receipts[key]!);
    if (missing)
      throw const ApiException(
        message: 'Synthetic collection removed',
        statusCode: 404,
        code: 'COLLECTION_MEMBERSHIP_NOT_FOUND',
      );
    if (body['expected_version'] != current['membership_version'])
      throw const ApiException(
        message: 'Synthetic web edit won',
        statusCode: 409,
        code: 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT',
      );
    current = snapshot(
      version: (current['membership_version'] as int) + 1,
      ids: List<String>.from(body['product_ids']),
    );
    effects++;
    receipts[key] = Map.of(current);
    if (entered != null) {
      entered!.complete();
      entered = null;
      await release!.future;
    }
    if (lose) {
      lose = false;
      throw const ApiException(
        message: 'Synthetic committed reply lost',
        statusCode: 503,
        code: 'SYNTHETIC_REPLY_LOST',
      );
    }
    return malformed
        ? snapshot(
            version: current['membership_version'] as int,
            ids: [two, one],
          )
        : Map.of(current);
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'lost membership reply survives recreation and replays exact ordered request once',
    () async {
      final h = Harness(), s = h.service();
      h.api.lose = true;
      await expectLater(
        s.replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two, one],
        ),
        throwsA(isA<ApiException>()),
      );
      final original = h.api.writes.single;
      final restored = h.service();
      final result = await restored.retryCollectionMembership(site, collection);
      expect(result.productIds, [two, one]);
      expect(h.api.effects, 1);
      expect(h.api.writes.last.idempotencyKey, original.idempotencyKey);
      expect(h.api.writes.last.body, original.body);
      expect(original.method, HttpMethod.put);
      expect(original.storeId, site);
      expect(original.maxRetries, 0);
      expect(
        await restored.pendingCollectionMembership(site, collection),
        isNull,
      );
    },
  );
  test(
    'web conflict retains selection and reviewed revision gets one fresh key',
    () async {
      final h = Harness(), s = h.service();
      h.api.current = snapshot(version: 4, ids: [one]);
      await expectLater(
        s.replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two],
        ),
        throwsA(isA<ApiException>()),
      );
      final saved = (await s.pendingCollectionMembership(site, collection))!;
      expect(saved.intent['outcome'], 'conflict');
      expect(h.api.effects, 0);
      final reviewed = await s.readCollectionMembership(site, collection);
      await s.rebaseCollectionMembership(site, saved, reviewed);
      expect(h.api.current['product_ids'], [two]);
      expect(h.api.effects, 1);
      expect(
        h.api.writes.last.idempotencyKey,
        isNot(h.api.writes.first.idempotencyKey),
      );
      expect(asJsonMap(h.api.writes.last.body)['expected_version'], 4);
    },
  );
  test(
    'saved-selection discovery is isolated by actor, store, environment and command family',
    () async {
      final h = Harness();
      h.api.lose = true;
      await expectLater(
        h.service().replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two, one],
        ),
        throwsA(isA<ApiException>()),
      );
      h.storage.data['synthetic-auth-key'] = 'SYN_TOKEN_NEVER_RENDER';
      final context = (
        actorId: actor,
        storeId: site,
        version: h.api.captureRequestContext(),
      );
      await SecurityCommandStore(
        storage: h.storage,
        environment: 'staging',
      ).prepare(context, 'collection-membership:$one', {
        'collection_id': one,
        'product_ids': [two],
        'expected_version': 3,
        'request_key': two,
        'outcome': 'pending',
      }, check: () {});
      final records = await h.service().pendingCollectionMemberships(site);
      expect(records.length, 1);
      expect(records.single.intent['collection_id'], collection);
      expect(records.single.encoded, isNot(contains('SYN_TOKEN_NEVER_RENDER')));
      h.currentActor = one;
      expect(await h.service().pendingCollectionMemberships(site), isEmpty);
      h.currentActor = actor;
      h.currentStore = two;
      expect(await h.service().pendingCollectionMemberships(two), isEmpty);
      h.currentStore = site;
      expect((await h.service().pendingCollectionMemberships(site)).length, 1);
      expect(
        h.api.writes.length,
        1,
        reason: 'Discovery never executes a stored operation.',
      );
    },
  );
  test(
    'a malformed scoped recovery record cannot silently disappear as an empty result',
    () async {
      final h = Harness();
      h.api.lose = true;
      await expectLater(
        h.service().replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two, one],
        ),
        throwsA(isA<ApiException>()),
      );
      final key = h.storage.data.keys.single,
          value = jsonDecode(h.storage.data[key]!) as Map<String, dynamic>;
      value['actor'] = one;
      h.storage.data[key] = jsonEncode(value);
      await expectLater(
        h.service().pendingCollectionMemberships(site),
        throwsFormatException,
      );
      expect(h.storage.data.containsKey(key), isTrue);
    },
  );
  for (final failure in [
    const ApiException(
      message: 'Synthetic route missing',
      statusCode: 404,
      code: 'NOT_FOUND',
    ),
    const ApiException(
      message: 'Synthetic outage',
      statusCode: 503,
      code: 'UNAVAILABLE',
    ),
    const ApiException(
      message: 'Synthetic revoked owner',
      statusCode: 403,
      code: 'FORBIDDEN',
    ),
  ])
    test(
      'missing-selection dismissal keeps its original intent after ${failure.code}',
      () async {
        final h = Harness();
        h.api.missing = true;
        await expectLater(
          h.service().replaceCollectionMembership(
            site,
            CollectionMembershipSnapshot.fromJson(snapshot()),
            [two, one],
          ),
          throwsA(isA<ApiException>()),
        );
        final original = (await h.service().pendingCollectionMemberships(
          site,
        )).single;
        expect(original.intent['outcome'], 'missing');
        h.api.failure = failure;
        await expectLater(
          h.service().discardMissingCollectionMembership(site, collection),
          throwsA(isA<ApiException>()),
        );
        expect(
          (await h.service().pendingCollectionMemberships(site)).single.encoded,
          original.encoded,
        );
        expect(h.api.effects, 0);
        expect(h.api.writes.first.body, h.api.writes.last.body);
        expect(
          h.api.writes.first.idempotencyKey,
          h.api.writes.last.idempotencyKey,
        );
      },
    );
  test(
    'unknown result cannot be discarded even after a retry validation error',
    () async {
      final h = Harness(), s = h.service();
      h.api.lose = true;
      await expectLater(
        s.replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two],
        ),
        throwsA(isA<ApiException>()),
      );
      h.api.reject = true;
      await expectLater(
        s.retryCollectionMembership(site, collection),
        throwsA(isA<ApiException>()),
      );
      expect(
        (await s.pendingCollectionMembership(
          site,
          collection,
        ))!.intent['outcome'],
        'pending',
      );
      await expectLater(
        s.discardRejectedCollectionMembership(site, collection),
        throwsFormatException,
      );
      h.api.reject = false;
      await s.retryCollectionMembership(site, collection);
      expect(h.api.effects, 1);
    },
  );
  test(
    'definitive initial validation rejection permits explicit editing',
    () async {
      final h = Harness(), s = h.service();
      h.api.reject = true;
      await expectLater(
        s.replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two],
        ),
        throwsA(isA<ApiException>()),
      );
      expect(
        (await s.pendingCollectionMembership(
          site,
          collection,
        ))!.intent['outcome'],
        'rejected',
      );
      expect(h.api.effects, 0);
      await s.discardRejectedCollectionMembership(site, collection);
      h.api.reject = false;
      await s.replaceCollectionMembership(
        site,
        CollectionMembershipSnapshot.fromJson(snapshot()),
        [one],
      );
      expect(h.api.effects, 1);
    },
  );
  test(
    'malformed acknowledgement and account denial preserve the original recovery',
    () async {
      final h = Harness(), s = h.service();
      h.api.malformed = true;
      await expectLater(
        s.replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [one],
        ),
        throwsA(isA<ApiException>()),
      );
      expect(await s.pendingCollectionMembership(site, collection), isNotNull);
      h.currentActor = two;
      expect(await s.pendingCollectionMembership(site, collection), isNull);
      h.api.deny = true;
      await expectLater(
        s.readCollectionMembership(site, collection),
        throwsA(isA<ApiException>()),
      );
      h.currentActor = actor;
      h.api.deny = false;
      h.api.malformed = false;
      await s.retryCollectionMembership(site, collection);
      expect(h.api.effects, 1);
    },
  );
  test(
    'queued membership invocation and ordered input cannot adopt later values',
    () async {
      final h = Harness(),
          s = h.service(),
          entered = Completer<void>(),
          release = Completer<void>();
      final barrier = SecurityCommandStore(storage: h.storage).serialized(
        () async {
          entered.complete();
          await release.future;
        },
      );
      await entered.future;
      final ids = [two];
      final pending = s.replaceCollectionMembership(
        site,
        CollectionMembershipSnapshot.fromJson(snapshot()),
        ids,
      );
      ids.add(one);
      release.complete();
      await barrier;
      await pending;
      expect(h.api.current['product_ids'], [two]);
      final entered2 = Completer<void>(), release2 = Completer<void>();
      final barrier2 = SecurityCommandStore(storage: h.storage).serialized(
        () async {
          entered2.complete();
          await release2.future;
        },
      );
      await entered2.future;
      final denied = expectLater(
        s.replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(h.api.current),
          [one],
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      h.currentActor = two;
      release2.complete();
      await barrier2;
      await denied;
      expect(h.api.effects, 1);
    },
  );
  test(
    'pending command nested intent is immutable and independent of caller input',
    () {
      final ids = [one];
      final command = PendingSecurityCommand(
        actor,
        site,
        'synthetic',
        'synthetic-request',
        {
          'product_ids': ids,
          'nested': {'revision': 3},
        },
      );
      ids.add(two);
      expect(command.intent['product_ids'], [one]);
      expect(
        () => command.intent['product_ids'].add(two),
        throwsUnsupportedError,
      );
      expect(
        () => command.intent['nested']['revision'] = 4,
        throwsUnsupportedError,
      );
    },
  );
  Future<void> render(WidgetTester tester, Harness h) async {
    SharedPreferences.setMockInitialValues({});
    final stores = StoreService(api: h.api),
        scope = StoreContext(storeService: stores);
    await scope.loadStores();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreService>.value(value: stores),
          ChangeNotifierProvider<StoreContext>.value(value: scope),
          ChangeNotifierProvider<ProductService>.value(value: h.service()),
        ],
        child: const MaterialApp(
          home: CollectionMembershipScreen(
            storeId: site,
            collectionId: collection,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'normal Collections entry discovers a saved selection after its collection leaves the live list',
    (tester) async {
      final h = Harness();
      h.api.lose = true;
      await expectLater(
        h.service().replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two, one],
        ),
        throwsA(isA<ApiException>()),
      );
      h.api.hidden = true;
      SharedPreferences.setMockInitialValues({});
      final stores = StoreService(api: h.api),
          scope = StoreContext(storeService: stores);
      await scope.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreService>.value(value: stores),
            ChangeNotifierProvider<StoreContext>.value(value: scope),
            ChangeNotifierProvider<ProductService>.value(value: h.service()),
          ],
          child: const MaterialApp(home: CollectionsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Synthetic collection'), findsNothing);
      expect(find.text('Retry saved product selection'), findsOneWidget);
      final original = h.api.writes.single;
      await tester.tap(find.text('Retry saved product selection'));
      await tester.pumpAndSettle();
      expect(find.text('Retry saved product selection'), findsNothing);
      expect(find.text('Saved product selection confirmed.'), findsOneWidget);
      expect(h.api.effects, 1);
      expect(h.api.writes.last.body, original.body);
      expect(h.api.writes.last.idempotencyKey, original.idempotencyKey);
    },
  );
  testWidgets(
    'removed collection selection requires explicit dismissal and a current original no-effect check',
    (tester) async {
      final h = Harness();
      h.api.missing = true;
      h.api.hidden = true;
      await expectLater(
        h.service().replaceCollectionMembership(
          site,
          CollectionMembershipSnapshot.fromJson(snapshot()),
          [two, one],
        ),
        throwsA(isA<ApiException>()),
      );
      SharedPreferences.setMockInitialValues({});
      final stores = StoreService(api: h.api),
          scope = StoreContext(storeService: stores);
      await scope.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreService>.value(value: stores),
            ChangeNotifierProvider<StoreContext>.value(value: scope),
            ChangeNotifierProvider<ProductService>.value(value: h.service()),
          ],
          child: const MaterialApp(home: CollectionsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Discard rejected product selection'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.text('Keep saved request'));
      await tester.pumpAndSettle();
      expect((await h.service().pendingCollectionMemberships(site)).length, 1);
      await tester.tap(find.text('Discard rejected product selection'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.text('Discard selection request'));
      await tester.pumpAndSettle();
      expect(await h.service().pendingCollectionMemberships(site), isEmpty);
      expect(h.api.effects, 0);
      expect(h.api.writes.length, 2);
      expect(h.api.writes.last.body, h.api.writes.first.body);
      expect(
        h.api.writes.last.idempotencyKey,
        h.api.writes.first.idempotencyKey,
      );
      expect(
        find.text('Rejected product selection request discarded.'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'a failed product list keeps current-store Inventory navigation reachable',
    (tester) async {
      // Routing regression only: the actual warehouse/device/backend acceptance
      // is separate. Product read failure cannot decide another module's grant.
      SharedPreferences.setMockInitialValues({});
      final h = Harness(), stores = StoreService(api: Transport());
      h.api.failProducts = true;
      final scope = StoreContext(storeService: stores);
      await scope.loadStores();
      var opened = false;
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreService>.value(value: stores),
            ChangeNotifierProvider<StoreContext>.value(value: scope),
            ChangeNotifierProvider<ProductService>.value(value: h.service()),
          ],
          child: MaterialApp(
            home: const ProductsScreen(),
            routes: {
              AppRoutes.inventory: (_) {
                opened = true;
                return const Scaffold(body: Text('Synthetic route witness'));
              },
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Products could not load. Check your connection and store access, then retry.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.byTooltip('Show menu'));
      await tester.pumpAndSettle();
      expect(find.text('Inventory'), findsOneWidget);
      await tester.tap(find.text('Inventory'));
      await tester.pumpAndSettle();
      expect(opened, isTrue);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('normal Products menu reaches the real collection editor', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final h = Harness(), stores = StoreService(api: Transport());
    final scope = StoreContext(storeService: stores);
    await scope.loadStores();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreService>.value(value: stores),
          ChangeNotifierProvider<StoreContext>.value(value: scope),
          ChangeNotifierProvider<ProductService>.value(value: h.service()),
        ],
        child: MaterialApp(
          home: const ProductsScreen(),
          routes: {AppRoutes.collections: (_) => const CollectionsScreen()},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Show menu'));
    await tester.pumpAndSettle();
    expect(find.text('Collections'), findsOneWidget);
    await tester.tap(find.text('Collections'));
    await tester.pumpAndSettle();
    expect(find.text('Synthetic collection'), findsOneWidget);
    await tester.tap(find.byType(PopupMenuButton<String>).last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Manage products and order'));
    await tester.pumpAndSettle();
    expect(find.byType(CollectionMembershipScreen), findsOneWidget);
    expect(find.text('2 assigned products · revision 3'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('native editor reorders and recovers a committed lost reply', (
    tester,
  ) async {
    final h = Harness();
    h.api.lose = true;
    await render(tester, h);
    await tester.tap(find.byTooltip('Move Blue shirt up'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save membership'));
    await tester.pumpAndSettle();
    expect(find.text('Retry saved membership save'), findsOneWidget);
    expect(h.api.effects, 1);
    await tester.tap(find.text('Retry saved membership save'));
    await tester.pumpAndSettle();
    expect(h.api.effects, 1);
    expect(find.textContaining('Saved request confirmed.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'native editor preserves unavailable IDs until explicit removal',
    (tester) async {
      final h = Harness();
      h.api.current = snapshot(unavailable: [two]);
      await render(tester, h);
      expect(
        find.text('Unavailable product · assignment retained'),
        findsOneWidget,
      );
      await tester.tap(find.text('Save membership'));
      await tester.pumpAndSettle();
      expect(h.api.writes, isEmpty);
      expect(
        find.textContaining('Remove the explicitly unavailable'),
        findsOneWidget,
      );
      await tester.tap(
        find.byTooltip('Remove Product 55555555 from collection'),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save membership'));
      await tester.pumpAndSettle();
      expect(h.api.current['product_ids'], [one]);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('refresh asks before discarding an unsaved selection', (
    tester,
  ) async {
    final h = Harness();
    await render(tester, h);
    await tester.tap(find.byTooltip('Move Blue shirt up'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Reload collection membership'));
    await tester.pumpAndSettle();
    expect(find.text('Discard unsaved changes?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save membership'));
    await tester.pumpAndSettle();
    expect(h.api.current['product_ids'], [two, one]);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'native conflict requires current read and explicit replacement review',
    (tester) async {
      final h = Harness();
      await render(tester, h);
      h.api.current = snapshot(version: 4, ids: [one]);
      await tester.tap(find.byTooltip('Move Blue shirt up'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save membership'));
      await tester.pumpAndSettle();
      expect(h.api.effects, 0);
      expect(find.text('Read latest membership'), findsOneWidget);
      expect(
        find.text('Apply saved selection to reviewed revision'),
        findsNothing,
      );
      await tester.tap(find.text('Read latest membership'));
      await tester.pumpAndSettle();
      final apply = find.text('Apply saved selection to reviewed revision');
      await tester.ensureVisible(apply);
      await tester.tap(apply);
      await tester.pumpAndSettle();
      expect(find.text('Apply saved selection?'), findsOneWidget);
      expect(h.api.effects, 0);
      await tester.tap(find.text('Apply saved selection'));
      await tester.pumpAndSettle();
      expect(h.api.current['product_ids'], [two, one]);
      expect(h.api.effects, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'revoked owner hides collection rows and keeps the unknown saved request',
    (tester) async {
      final h = Harness();
      h.api.lose = true;
      await render(tester, h);
      await tester.tap(find.byTooltip('Move Blue shirt up'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save membership'));
      await tester.pumpAndSettle();
      h.api.deny = true;
      await tester.tap(find.text('Retry saved membership save'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1. Blue shirt'), findsNothing);
      expect(
        find.textContaining('Reopen it with the store owner account.'),
        findsOneWidget,
      );
      expect(
        await h.service().pendingCollectionMembership(site, collection),
        isNotNull,
      );
      expect(h.api.effects, 1);
      expect(tester.takeException(), isNull);
    },
  );
}
