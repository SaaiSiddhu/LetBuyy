import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/screens/settings/shipping_screen.dart';
import 'package:letbuyy_store/screens/settings/taxes_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/shipping_tax_service.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show SharedTypeContract;

const siteA = '00000000-0000-4000-8000-000000000001';
const siteB = '00000000-0000-4000-8000-000000000002';
String rowId(int n) =>
    '10000000-0000-4000-8000-${n.toString().padLeft(12, '0')}';
const paths = {
  'zones': '/shipping-tax/shipping/zones',
  'rates': '/shipping-tax/shipping',
  'taxes': '/shipping-tax/taxes',
  'profiles': '/shipping-tax/shipping/profiles',
};
Map<String, dynamic> row(String resource, String site, int n) => {
  'id': rowId(n),
  'store_id': site,
  'site_id': site,
  'name': 'Private $site $n',
  if (resource == 'rates') ...{'zone_id': rowId(500), 'price': 20},
  if (resource == 'taxes') 'rate': 18,
  if (resource == 'profiles') ...{
    'is_default': n == 1,
    'cod_enabled': false,
    'handling_fee_minor': 12975,
    'updated_at': '2026-10-30T09:12:20.123456Z',
  },
};
void reply(
  RequestOptions r,
  RequestInterceptorHandler h,
  Object data, {
  int status = 200,
  int? total,
  Map<String, dynamic>? overrideMeta,
}) {
  final page = r.queryParameters['page'] as int? ?? 1;
  final count = total ?? (data is List ? data.length : 0);
  h.resolve(
    Response(
      requestOptions: r,
      statusCode: status,
      data: {
        'data': data,
        'meta':
            overrideMeta ??
            {
              'store_id': r.queryParameters['store_id'],
              'total': count,
              'page': page,
              'per_page': 100,
              'total_pages': (count / 100).ceil(),
              'has_next': page * 100 < count,
              'has_prev': page > 1,
            },
      },
    ),
  );
}

ApiClient apiFor(
  void Function(RequestOptions, RequestInterceptorHandler) handler,
  Object? Function() scope,
) {
  final dio = Dio();
  final api = ApiClient(
    baseUrl: 'https://gateway.test/v1',
    dio: dio,
    maxRetries: 0,
    contextVersionProvider: scope,
  );
  dio.interceptors.add(InterceptorsWrapper(onRequest: handler));
  addTearDown(api.close);
  return api;
}

Future<Object> read(ShippingTaxService s, String resource, String site) =>
    switch (resource) {
      'zones' => s.fetchZones(site),
      'rates' => s.fetchRates(site),
      'taxes' => s.fetchTaxes(site),
      _ => s.fetchProfiles(site),
    };
List<Object> visible(ShippingTaxService s, String resource) =>
    switch (resource) {
      'zones' => s.zones,
      'rates' => s.rates,
      'taxes' => s.taxRates,
      _ => s.profiles,
    };
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'tax-inclusive editing requires a fresh owned boolean rather than a cached or missing default',
    () async {
      var body = <String, dynamic>{
        'id': siteA,
        'name': 'Current store',
        'tax_inclusive': false,
      };
      final api = apiFor((r, h) {
        expect(r.headers['X-Store-ID'], siteA);
        reply(r, h, body);
      }, () => 1);
      final stores = StoreService(api: api);
      expect((await stores.fetchAuthorizedStore(siteA)).taxInclusive, false);
      for (final invalid in [
        <String, dynamic>{'id': siteA},
        <String, dynamic>{'id': siteB, 'tax_inclusive': true},
      ]) {
        body = invalid;
        await expectLater(
          stores.fetchAuthorizedStore(siteA),
          throwsA(isA<ApiException>()),
        );
      }
      expect(stores.currentStore, isNull);
      stores.dispose();
    },
  );
  for (final resource in paths.keys) {
    test(
      '$resource composes 101 rows and pins both header and query to the store',
      () async {
        final calls = <RequestOptions>[];
        final api = apiFor((r, h) {
          calls.add(r);
          final second = r.queryParameters['page'] == 2;
          reply(r, h, [
            for (var n = second ? 101 : 1; n <= (second ? 101 : 100); n++)
              row(resource, siteA, n),
          ], total: 101);
        }, () => 'actor-a');
        final s = ShippingTaxService(api: api, storeIdProvider: () => siteA);
        await read(s, resource, siteA);
        expect(visible(s, resource), hasLength(101));
        expect(calls, hasLength(2));
        for (final call in calls) {
          expect(call.path, endsWith(paths[resource]!));
          expect(call.headers['X-Store-ID'], siteA);
          expect(call.queryParameters['store_id'], siteA);
        }
      },
    );
    test(
      '$resource retires private rows on failed refresh, foreign scope, and actor change',
      () async {
        var actor = 'a', selected = siteA, status = 200, foreign = false;
        final api = apiFor(
          (r, h) => reply(r, h, [
            row(resource, foreign ? siteB : selected, 1),
          ], status: status),
          () => actor,
        );
        final s = ShippingTaxService(api: api, storeIdProvider: () => selected);
        for (final failure in [401, 403, 503]) {
          status = 200;
          await read(s, resource, siteA);
          expect(visible(s, resource), isNotEmpty);
          status = failure;
          await expectLater(
            read(s, resource, siteA),
            throwsA(isA<ApiException>()),
          );
          expect(visible(s, resource), isEmpty);
        }
        status = 200;
        foreign = true;
        await expectLater(
          read(s, resource, siteA),
          throwsA(isA<ApiException>()),
        );
        expect(visible(s, resource), isEmpty);
        foreign = false;
        await read(s, resource, siteA);
        actor = 'b';
        expect(visible(s, resource), isEmpty);
        selected = siteB;
        await read(s, resource, siteB);
        expect(visible(s, resource), hasLength(1));
      },
    );
    test(
      '$resource rejects a missing acknowledgement or incomplete first page',
      () async {
        var incomplete = false;
        final api = apiFor(
          (r, h) => reply(
            r,
            h,
            [row(resource, siteA, 1)],
            total: incomplete ? 101 : 1,
            overrideMeta: incomplete ? null : {},
          ),
          () => 1,
        );
        final s = ShippingTaxService(api: api, storeIdProvider: () => siteA);
        await expectLater(
          read(s, resource, siteA),
          throwsA(isA<ApiException>()),
        );
        incomplete = true;
        await expectLater(
          read(s, resource, siteA),
          throwsA(isA<ApiException>()),
        );
        expect(visible(s, resource), isEmpty);
      },
    );
    test(
      '$resource ignores an older refresh completing after the new one',
      () async {
        RequestOptions? delayed;
        RequestInterceptorHandler? pending;
        var requests = 0;
        final api = apiFor((r, h) {
          if (++requests == 1) {
            delayed = r;
            pending = h;
          } else {
            reply(r, h, [row(resource, siteA, 2)]);
          }
        }, () => 1);
        final s = ShippingTaxService(api: api, storeIdProvider: () => siteA);
        final old = read(s, resource, siteA);
        final rejection = expectLater(old, throwsA(isA<ApiException>()));
        await Future<void>.delayed(Duration.zero);
        await read(s, resource, siteA);
        reply(delayed!, pending!, [row(resource, siteA, 1)]);
        await rejection;
        final current = visible(s, resource).single as SharedTypeContract;
        expect(current['id'], rowId(2));
      },
    );
    test(
      '$resource rejects delayed A after A to B to A with a new context version',
      () async {
        var epoch = 0, selected = siteA;
        RequestOptions? delayed;
        RequestInterceptorHandler? pending;
        final ready = Completer<void>();
        final api = apiFor((r, h) {
          delayed = r;
          pending = h;
          ready.complete();
        }, () => epoch);
        final s = ShippingTaxService(api: api, storeIdProvider: () => selected);
        final readA = read(s, resource, siteA);
        final rejection = expectLater(readA, throwsA(isA<ApiException>()));
        await ready.future;
        selected = siteB;
        epoch++;
        selected = siteA;
        epoch++;
        reply(delayed!, pending!, [row(resource, siteA, 1)]);
        await rejection;
        expect(visible(s, resource), isEmpty);
      },
    );
  }
  test(
    'a duplicate ID on a later settings page rejects the whole configuration',
    () async {
      final api = apiFor(
        (r, h) => reply(
          r,
          h,
          r.queryParameters['page'] == 1
              ? [for (var n = 1; n <= 100; n++) row('zones', siteA, n)]
              : [row('zones', siteA, 1)],
          total: 101,
        ),
        () => 1,
      );
      final s = ShippingTaxService(api: api, storeIdProvider: () => siteA);
      await expectLater(s.fetchZones(siteA), throwsA(isA<ApiException>()));
      expect(s.zones, isEmpty);
    },
  );
  test('a rate from a foreign joined zone is rejected', () async {
    final api = apiFor(
      (r, h) => reply(r, h, [
        {
          ...row('rates', siteA, 1),
          'shipping_zones': {'store_id': siteB},
        },
      ]),
      () => 1,
    );
    final s = ShippingTaxService(api: api, storeIdProvider: () => siteA);
    await expectLater(s.fetchRates(siteA), throwsA(isA<ApiException>()));
    expect(s.rates, isEmpty);
  });
  for (final shipping in [true, false]) {
    for (final change in ['actor', 'store', 'denial']) {
      testWidgets(
        '${shipping ? 'shipping' : 'tax'} private dialog retires on $change',
        (tester) async {
          SharedPreferences.setMockInitialValues({});
          tester.view.physicalSize = const Size(390, 844);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          late final StoreContext stores;
          final api = _WidgetApi(() => stores.requestContextKey);
          addTearDown(api.close);
          final storeService = StoreService(api: api);
          stores = StoreContext(storeService: storeService);
          await stores.bindActor('actor-a');
          await stores.ensureSelectedStore();
          final settings = ShippingTaxService(
            api: api,
            storeIdProvider: () => stores.selectedStoreId,
          );
          await tester.pumpWidget(
            MultiProvider(
              providers: [
                ChangeNotifierProvider.value(value: stores),
                ChangeNotifierProvider.value(value: storeService),
                ChangeNotifierProvider.value(value: settings),
              ],
              child: MaterialApp(
                home: shipping ? const ShippingScreen() : const TaxesScreen(),
              ),
            ),
          );
          await tester.pumpAndSettle();
          await tester.tap(find.text(shipping ? 'New zone' : 'New tax'));
          await tester.pumpAndSettle();
          final field = find.byWidgetPredicate(
            (w) =>
                w is TextField &&
                w.decoration?.labelText ==
                    (shipping ? 'Zone name' : 'Tax name'),
          );
          await tester.enterText(field, 'Private unsaved draft');
          if (change == 'denial') {
            api.denyMutations = true;
            tester.testTextInput.hide();
            await tester.pumpAndSettle();
            await tester.tap(find.text('Create'));
            await tester.pumpAndSettle();
            expect(find.text('Private $siteA 1'), findsNothing);
            expect(find.text(shipping ? 'New zone' : 'New tax'), findsNothing);
            expect(find.byType(SwitchListTile), findsNothing);
            expect(api.mutations, 1);
          } else {
            if (change == 'actor') {
              await stores.bindActor('actor-b');
            } else {
              await stores.selectStoreById(siteB);
            }
            await tester.pumpAndSettle();
            expect(find.text('Private unsaved draft'), findsNothing);
            expect(find.text('Store access changed'), findsOneWidget);
            expect(find.text('Create'), findsNothing);
            expect(find.text('Save'), findsNothing);
            expect(api.mutations, 0);
            await tester.tap(find.text('Close'));
            await tester.pumpAndSettle();
            if (change == 'actor') {
              expect(
                find.text(shipping ? 'New zone' : 'New tax'),
                findsNothing,
              );
            } else {
              expect(find.text('Private $siteB 1'), findsOneWidget);
              expect(find.text('Private $siteA 1'), findsNothing);
            }
          }
          await tester.pumpWidget(const SizedBox.shrink());
          settings.dispose();
          stores.dispose();
          storeService.dispose();
        },
      );
    }
  }
}

class _WidgetApi extends ApiClient {
  _WidgetApi(Object? Function() scope)
    : super(
        baseUrl: 'https://gateway.test',
        maxRetries: 0,
        contextVersionProvider: scope,
      );
  int mutations = 0;
  bool denyMutations = false;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    final site = options?.query?['store_id'] as String?;
    final rows = path == '/stores'
        ? [
            for (final id in [siteA, siteB])
              <String, dynamic>{
                'id': id,
                'name': 'Store $id',
                'subdomain': id == siteA ? 'synthetic-a' : 'synthetic-b',
                'currency': 'INR',
                'tax_inclusive': true,
              },
          ]
        : [row(paths.entries.firstWhere((e) => e.value == path).key, site!, 1)];
    return PaginatedResponse(
      data: rows,
      total: rows.length,
      page: 1,
      limit: 100,
      hasMore: false,
      meta: {
        'store_id': site,
        'total': rows.length,
        'page': 1,
        'per_page': 100,
        'total_pages': 1,
        'has_next': false,
        'has_prev': false,
      },
    );
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method != null && options!.method != HttpMethod.get) {
      mutations++;
      if (denyMutations)
        throw const ApiException(
          message: 'Unavailable',
          statusCode: 403,
          code: 'FORBIDDEN',
        );
    }
    if (path.startsWith('/stores/'))
      return {
        'id': path.split('/').last,
        'name': 'Store',
        'tax_inclusive': true,
      };
    return {};
  }
}
