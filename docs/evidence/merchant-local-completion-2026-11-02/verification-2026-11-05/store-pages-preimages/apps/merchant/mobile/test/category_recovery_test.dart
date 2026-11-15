import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/screens/products/categories_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'support/loyalty_fixture.dart' show MemoryStorage;

final fixture = jsonDecode(
  File(
    '../../../tests/fixtures/product-category-contracts.json',
  ).readAsStringSync(),
);
final site = fixture['row']['store_id'] as String,
    actor = fixture['row']['created_by'] as String,
    category = fixture['row']['id'] as String;

class Transport extends ApiClient {
  Transport()
    : super(baseUrl: 'https://gateway.synthetic.invalid/v1', maxRetries: 0);
  JsonMap current = Map<String, dynamic>.from(fixture['row']);
  final writes = <ApiRequestOptions>[], receipts = <String, JsonMap>{};
  bool lose = false, deny = false, malformed = false, reject = false;
  int effects = 0;
  Completer<void>? entered, release;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    if (deny)
      throw const ApiException(
        message: 'Synthetic revoked owner',
        statusCode: 403,
        code: 'FORBIDDEN',
      );
    if (path == '/categories')
      return PaginatedResponse(
        data: [Map.of(current)],
        page: 1,
        limit: 20,
        total: 1,
        hasMore: false,
        meta: {
          'page': 1,
          'per_page': 20,
          'total': 1,
          'total_pages': 1,
          'has_prev': false,
          'has_next': false,
        },
      );
    if (path == '/products')
      return const PaginatedResponse(
        data: [],
        page: 1,
        limit: 50,
        total: 0,
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
    if (options?.method == null || options!.method == HttpMethod.get)
      return Map.of(current);
    writes.add(options);
    final body = asJsonMap(options.body), key = options.idempotencyKey!;
    if (reject)
      throw const ApiException(
        message: 'Synthetic invalid parent',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      );
    if (receipts.containsKey(key)) return Map.of(receipts[key]!);
    if (body['version'] != current['version'])
      throw const ApiException(
        message: 'Synthetic newer web edit',
        statusCode: 409,
        code: 'PRODUCT_CATEGORY_VERSION_CONFLICT',
      );
    current = {...current, ...body}..remove('idempotency_key');
    current['version'] = (current['version'] as int) + 1;
    final result = {
      ...current,
      'idempotency_key': key,
      'operation': 'update',
      'affected_products': body.containsKey('name') ? 2 : 0,
    };
    receipts[key] = result;
    effects++;
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
        ? {...result, 'description': 'Wrong acknowledged fields'}
        : Map.of(result);
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
    'committed reply loss survives service restart and repeats the exact category request once',
    () async {
      final h = Harness(), s = h.service();
      h.api.lose = true;
      await expectLater(
        s.saveCategory(site, 'update', {
          'version': 3,
          'description': 'Synthetic native edit',
        }, id: category),
        throwsA(isA<ApiException>()),
      );
      final original = h.api.writes.single,
          restored = h.service(),
          receipt = await restored.retryCategory(site);
      expect(receipt.category.description, 'Synthetic native edit');
      expect(h.api.effects, 1);
      expect(h.api.writes.last.body, original.body);
      expect(h.api.writes.last.idempotencyKey, original.idempotencyKey);
      expect(original.method, HttpMethod.patch);
      expect(original.maxRetries, 0);
      expect(await restored.pendingCategoryCommand(site), isNull);
    },
  );
  test(
    'wrong acknowledged fields retain the original request rather than showing success',
    () async {
      final h = Harness(), s = h.service();
      h.api.malformed = true;
      await expectLater(
        s.saveCategory(site, 'update', {
          'version': 3,
          'description': 'Synthetic original',
        }, id: category),
        throwsFormatException,
      );
      expect(await s.pendingCategoryCommand(site), isNotNull);
      h.api.malformed = false;
      expect(
        (await s.retryCategory(site)).category.description,
        'Synthetic original',
      );
      expect(h.api.effects, 1);
    },
  );
  test(
    'a web conflict requires explicit current review while unknown outcomes cannot be discarded',
    () async {
      final h = Harness(), s = h.service();
      h.api.current['version'] = 4;
      await expectLater(
        s.saveCategory(site, 'update', {
          'version': 3,
          'name': 'Synthetic stale edit',
        }, id: category),
        throwsA(isA<ApiException>()),
      );
      expect(
        (await s.pendingCategoryCommand(site))!.intent['outcome'],
        'rejected',
      );
      final row = await s.reviewRejectedCategory(site);
      expect(row!.version, 4);
      expect(await s.pendingCategoryCommand(site), isNull);
      h.api.lose = true;
      await expectLater(
        s.saveCategory(site, 'update', {
          'version': 4,
          'description': 'Synthetic lost',
        }, id: category),
        throwsA(isA<ApiException>()),
      );
      h.api.reject = true;
      await expectLater(s.retryCategory(site), throwsA(isA<ApiException>()));
      expect(
        (await s.pendingCategoryCommand(site))!.intent['outcome'],
        'pending',
      );
      await expectLater(s.reviewRejectedCategory(site), throwsFormatException);
    },
  );
  test(
    'actor changes retire a committed late response and isolate the preserved request',
    () async {
      final h = Harness(),
          s = h.service(),
          entered = Completer<void>(),
          release = Completer<void>();
      h.api.entered = entered;
      h.api.release = release;
      final work = s.saveCategory(site, 'update', {
        'version': 3,
        'description': 'Synthetic old account',
      }, id: category);
      final denied = expectLater(
        work,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
      await entered.future;
      h.currentActor = category;
      release.complete();
      await denied;
      expect(await s.pendingCategoryCommand(site), isNull);
      h.currentActor = actor;
      expect(await s.pendingCategoryCommand(site), isNotNull);
      await s.retryCategory(site);
      expect(h.api.effects, 1);
    },
  );
  Future<void> render(
    WidgetTester tester,
    Harness h, {
    bool menu = false,
  }) async {
    SharedPreferences.setMockInitialValues({});
    final stores = StoreService(api: h.api),
        scope = StoreContext(storeService: stores);
    await scope.bindActor(actor);
    await scope.loadStores();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreService>.value(value: stores),
          ChangeNotifierProvider<StoreContext>.value(value: scope),
          ChangeNotifierProvider<ProductService>.value(value: h.service()),
        ],
        child: MaterialApp(
          home: menu ? const ProductsScreen() : const CategoriesScreen(),
          routes: {AppRoutes.categories: (_) => const CategoriesScreen()},
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'normal Products menu reaches real native category list and current counts',
    (tester) async {
      final h = Harness();
      await render(tester, h, menu: true);
      await tester.tap(find.byTooltip('Show menu'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Categories'));
      await tester.pumpAndSettle();
      expect(find.byType(CategoriesScreen), findsOneWidget);
      expect(find.text('Synthetic cotton'), findsOneWidget);
      expect(find.text('2 products · 0 children'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'native category screen recovers the saved original after a committed reply loss',
    (tester) async {
      final h = Harness();
      h.api.lose = true;
      await expectLater(
        h.service().saveCategory(site, 'update', {
          'version': 3,
          'description': 'Synthetic restored',
        }, id: category),
        throwsA(isA<ApiException>()),
      );
      await render(tester, h);
      expect(
        find.text('Saved category request needs recovery'),
        findsOneWidget,
      );
      await tester.tap(find.text('Retry original category request'));
      await tester.pumpAndSettle();
      expect(find.text('Saved category request needs recovery'), findsNothing);
      expect(h.api.effects, 1);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'unsaved native category fields require confirmation before system Back',
    (tester) async {
      final h = Harness();
      await render(tester, h);
      await tester.tap(find.text('Edit Synthetic cotton'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      final name = find.byWidgetPredicate(
        (w) => w is TextField && w.decoration?.labelText == 'Name',
      );
      await tester.enterText(name, 'Synthetic unsaved category');
      await tester.pump();
      await tester.binding.handlePopRoute();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('Discard unsaved category fields?'), findsOneWidget);
      await tester.tap(find.text('Keep editing'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(
        tester.widget<TextField>(name).controller!.text,
        'Synthetic unsaved category',
      );
      expect(h.api.writes, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'category editor is a full page and saves unchanged canonical metadata/version',
    (tester) async {
      final h = Harness();
      await render(tester, h);
      await tester.tap(find.text('Edit Synthetic cotton'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(find.byType(BottomSheet), findsNothing);
      final name = find.byWidgetPredicate(
        (w) => w is CustomTextField && w.label == 'Name',
      );
      await tester.enterText(name, 'Synthetic renamed category');
      await tester.tap(find.text('Update category'));
      await tester.pumpAndSettle();
      expect(h.api.effects, 1);
      final body = h.api.writes.single.body as Map;
      expect(body['version'], fixture['row']['version']);
      expect(body['name'], 'Synthetic renamed category');
      expect(body['display_order'], fixture['row']['display_order']);
      expect(body['parent_id'], fixture['row']['parent_id']);
      expect(body['is_visible'], fixture['row']['is_visible']);
      expect(find.text('Synthetic renamed category'), findsOneWidget);
      expect(
        find.text('Category saved. 2 assigned products updated.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'account retirement removes a dirty category and nested confirmation before another actor can use it',
    (tester) async {
      final h = Harness();
      await render(tester, h);
      final scope = tester
          .element(find.byType(CategoriesScreen))
          .read<StoreContext>();
      await tester.tap(find.text('Edit Synthetic cotton'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byWidgetPredicate(
          (w) => w is CustomTextField && w.label == 'Name',
        ),
        'Private prior actor draft',
      );
      await tester.pump();
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard unsaved category fields?'), findsOneWidget);
      final priorFrame = scope.requestContextKey;
      await scope.bindActor('different-actor');
      expect(scope.requestContextKey, isNot(priorFrame));
      await tester.pumpAndSettle();
      expect(find.text('Private prior actor draft'), findsNothing);
      expect(find.text('Discard unsaved category fields?'), findsNothing);
      expect(find.text('Store access changed'), findsWidgets);
      expect(h.api.writes, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'revoked-owner read shows unavailable counts and disables category creation',
    (tester) async {
      final h = Harness();
      h.api.deny = true;
      // Load the local store context before the controlled category denial.
      SharedPreferences.setMockInitialValues({});
      final stores = StoreService(api: Transport()),
          scope = StoreContext(storeService: stores);
      await scope.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<StoreContext>.value(value: scope),
            ChangeNotifierProvider<ProductService>.value(value: h.service()),
          ],
          child: const MaterialApp(home: CategoriesScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Category counts are unavailable.'), findsOneWidget);
      expect(
        tester
            .widget<FloatingActionButton>(find.byType(FloatingActionButton))
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
