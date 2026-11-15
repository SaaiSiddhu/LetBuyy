import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/settings/domain_settings_screen.dart';
import 'package:letbuyy_store/screens/settings/connected_domains_section.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/custom_domains.dart';
import 'package:letbuyy_store/services/store_service.dart';

const site = 'a0000000-0000-4000-8000-000000000001';
JsonMap setup({bool ready = false, String siteId = site}) => {
  'site_id': siteId,
  'hostname': 'checkout.demo.example.in',
  'parent_hostname': 'demo.example.in',
  'source': 'custom',
  'status': ready ? 'active' : 'verifying',
  'ssl_status': ready ? 'active' : 'pending',
  'checkout_origin': ready
      ? 'https://checkout.demo.example.in'
      : 'https://checkout.letbuyy.com',
  'fallback_origin': 'https://checkout.letbuyy.com',
  'reason': ready ? null : 'PARENT_NOT_VERIFIED',
  'dns_records': [
    {
      'type': 'CNAME',
      'name': 'checkout.demo.example.in',
      'value': 'owned-cname.example.test',
    },
  ],
};

class FixedStores extends StoreService {
  FixedStores(ApiClient api) : super(api: api);
  @override
  Future<List<StoreModel>> fetchStores() async => [
    StoreModel.fromJson({
      'id': site,
      'name': 'Demo',
      'subdomain': 'demo',
      'site_type': 'store',
    }),
  ];
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'domain history and redirect editing use the selected domain and confirmed registry state',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      String? redirect;
      final calls = <RequestOptions>[];
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls.add(r);
            if (r.method == 'PATCH')
              redirect = (r.data as Map)['redirect_to'] as String?;
            final rows = [
              {
                'site_id': site,
                'domain': 'primary.example.in',
                'role': 'primary',
                'status': 'active',
                'ssl_status': 'active',
              },
              {
                'site_id': site,
                'domain': 'alias.example.in',
                'role': 'redirect',
                'status': 'active',
                'ssl_status': 'active',
                'redirect_to': redirect,
              },
            ];
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: {
                  'data': r.path.endsWith('/history')
                      ? {
                          'domain': 'alias.example.in',
                          'connected': true,
                          'events': [
                            {
                              'check_type': 'verify',
                              'status': 'active',
                              'txt_verified': true,
                              'cname_verified': true,
                              'ssl_active': true,
                              'created_at': '2026-10-30T00:00:00Z',
                            },
                          ],
                        }
                      : r.method == 'GET'
                      ? {'domains': rows}
                      : {
                          'domain': 'alias.example.in',
                          'role': 'redirect',
                          'redirect_to': redirect,
                        },
                },
              ),
            );
          },
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ConnectedDomainsSection(siteId: site, onChanged: () {}),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('History').last);
      await tester.pumpAndSettle();
      expect(find.text('History · alias.example.in'), findsOneWidget);
      expect(find.text('verify · active'), findsOneWidget);
      expect(calls.last.queryParameters['site_id'], site);
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Redirect target'));
      await tester.tap(find.text('Redirect target'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('primary.example.in').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save redirect'));
      await tester.pumpAndSettle();
      final write = calls.singleWhere((r) => r.method == 'PATCH');
      expect(write.path, endsWith('/custom/domains/alias.example.in'));
      expect(write.data, {
        'site_id': site,
        'role': 'redirect',
        'redirect_to': 'primary.example.in',
      });
      expect(calls.last.method, 'GET');
      expect(find.text('Redirect target updated.'), findsOneWidget);
      expect(find.text('Redirects to primary.example.in'), findsOneWidget);
    },
  );

  test(
    'domain registry rejects foreign rows and unavailable history is not an empty history',
    () async {
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => h.resolve(
            Response(
              requestOptions: r,
              statusCode: 200,
              data: {
                'data': r.path.endsWith('/history')
                    ? {
                        'domain': 'demo.example.in',
                        'connected': false,
                        'events': [],
                      }
                    : {
                        'domains': [
                          {
                            'site_id': 'foreign-site',
                            'domain': 'demo.example.in',
                            'role': 'primary',
                            'status': 'active',
                            'ssl_status': 'active',
                          },
                        ],
                      },
              },
            ),
          ),
        ),
      );
      final service = DomainService(api: api);
      await expectLater(service.connectedDomains(site), throwsFormatException);
      await expectLater(
        service.domainHistory(site, 'demo.example.in'),
        throwsFormatException,
      );
    },
  );

  testWidgets(
    'removal requires confirmation and persisted absence; pending verification stays pending',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      var status = 'active';
      final calls = <RequestOptions>[];
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls.add(r);
            if (r.path.endsWith('/verify')) status = 'pending';
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: r.method == 'DELETE' ? 202 : 200,
                data: {
                  'data': r.method == 'GET'
                      ? {
                          'domains': [
                            {
                              'site_id': site,
                              'domain': 'demo.example.in',
                              'role': 'primary',
                              'status': status,
                              'ssl_status': 'pending',
                            },
                          ],
                        }
                      : r.path.endsWith('/verify')
                      ? {'domain': 'demo.example.in', 'status': 'pending'}
                      : {'released': false},
                },
              ),
            );
          },
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: ConnectedDomainsSection(siteId: site, onChanged: () {}),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();
      expect(calls.where((r) => r.method == 'DELETE'), isEmpty);
      await tester.tap(find.text('Remove domain'));
      await tester.pumpAndSettle();
      expect(calls.where((r) => r.method == 'DELETE').length, 1);
      expect(calls.last.method, 'GET');
      expect(find.text('Domain removed.'), findsNothing);
      expect(
        find.text('Removal is still processing. Refresh to check.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Verify domain'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Verification is still pending. Review DNS setup and check again.',
        ),
        findsOneWidget,
      );
      expect(find.text('Primary · pending · HTTPS pending'), findsOneWidget);
    },
  );

  test(
    'TLS alone never invents customer-verification readiness and observed status survives cache projection',
    () {
      DomainHealthSnapshot health(JsonMap extra) =>
          DomainHealthSnapshot.fromMap(
            {
              'domain': 'demo.example.in',
              'status': 'active',
              'ssl_active': true,
              ...extra,
            },
            fallbackDomain: 'demo.example.in',
            fallbackStatus: 'active',
            fallbackSslActive: true,
          );
      expect(health({}).customerVerification, isNull);
      for (final status in [
        'ready',
        'pending',
        'unavailable',
        'capacity_reached',
        'configuration_required',
      ]) {
        final snapshot = health({
          'customer_verification': {'status': status},
        });
        expect(snapshot.customerVerification!.status, status);
        expect(snapshot.toMap()['customer_verification'], {'status': status});
      }
      expect(
        () => health({
          'customer_verification': {'status': 'invented'},
        }),
        throwsFormatException,
      );
    },
  );

  JsonMap domain(String host, {String role = 'primary'}) => {
    'site_id': site,
    'domain': host,
    'role': role,
    'status': 'active',
    'ssl_status': 'active',
    'provider': 'synthetic DNS',
    'redirect_to': null,
  };

  test(
    'connecting an alias never overwrites the locally displayed primary domain',
    () async {
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => h.resolve(
            Response(
              requestOptions: r,
              statusCode: 200,
              data: {
                'data': {
                  'domain': 'alias.example.in',
                  'role': 'redirect',
                  'status': 'pending',
                  'records': {},
                },
              },
            ),
          ),
        ),
      );
      final original = StoreModel.fromJson({
        'id': site,
        'name': 'Demo',
        'subdomain': 'demo',
        'custom_domain': 'primary.example.in',
        'custom_domain_status': 'active',
        'ssl_active': true,
      });
      final saved = await DomainService(
        api: api,
      ).saveCustomDomain(original, 'alias.example.in');
      expect(identical(saved, original), true);
      expect(saved.customDomain, 'primary.example.in');
    },
  );

  testWidgets(
    'connected domain promotion is explicit and uses persisted list readback',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      var rows = [
        domain('primary.example.in'),
        domain('alias.example.in', role: 'redirect'),
      ];
      final calls = <RequestOptions>[];
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls.add(r);
            if (r.path.endsWith('/primary'))
              rows = [
                domain('primary.example.in', role: 'redirect'),
                domain('alias.example.in'),
              ];
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: {
                  'data': r.method == 'GET' ? {'domains': rows} : {'ok': true},
                },
              ),
            );
          },
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      var changed = 0;
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: ConnectedDomainsSection(
                  siteId: site,
                  onChanged: () => changed++,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(calls.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(find.text('Make primary'));
      await tester.pumpAndSettle();
      expect(
        calls.where((r) => r.method == 'POST').single.path,
        endsWith('/custom/domains/alias.example.in/primary'),
      );
      expect(calls.where((r) => r.method == 'POST').single.data, {
        'site_id': site,
      });
      expect(calls.last.method, 'GET');
      expect(find.text('Primary domain updated.'), findsOneWidget);
      expect(changed, 1);
    },
  );

  testWidgets(
    'DNS setup shows exact storefront and checkout records and retires on actor replacement',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => h.resolve(
            Response(
              requestOptions: r,
              statusCode: 200,
              data: {
                'data': r.method == 'GET'
                    ? {
                        'domains': [domain('demo.example.in')],
                      }
                    : {
                        'domain': 'demo.example.in',
                        'role': 'primary',
                        'status': 'pending',
                        'records': {
                          'txt': {
                            'name': '_letbuyy-challenge.demo.example.in',
                            'value': 'synthetic-owned-challenge',
                          },
                        },
                        'checkout': setup(),
                      },
              },
            ),
          ),
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.bindActor('actor-a');
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: ConnectedDomainsSection(siteId: site, onChanged: () {}),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('DNS setup'));
      await tester.pumpAndSettle();
      expect(find.text('synthetic-owned-challenge'), findsOneWidget);
      expect(find.text('checkout.demo.example.in'), findsOneWidget);
      expect(find.text('owned-cname.example.test'), findsOneWidget);
      await stores.bindActor('actor-b');
      await stores.loadStores();
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.text('synthetic-owned-challenge'), findsNothing);
    },
  );

  testWidgets(
    'unavailable domain registry is not presented as an empty registry',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => h.resolve(
            Response(
              requestOptions: r,
              statusCode: 503,
              data: {
                'error': {'message': 'private database detail'},
              },
            ),
          ),
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: ConnectedDomainsSection(siteId: site, onChanged: () {}),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Connected domains could not be loaded. Please retry.'),
        findsOneWidget,
      );
      expect(find.text('No custom domains connected.'), findsNothing);
      expect(find.text('private database detail'), findsNothing);
    },
  );

  Future<void> reveal(WidgetTester tester, String label) async {
    for (
      var n = 0;
      n < 10 && find.text(label).hitTestable().evaluate().isEmpty;
      n++
    ) {
      await tester.drag(find.byType(ListView), const Offset(0, -250));
      await tester.pumpAndSettle();
    }
    expect(find.text(label).hitTestable(), findsOneWidget);
  }

  test(
    'checkout contract rejects unknown state, unsafe origins and inconsistent readiness',
    () {
      expect(CheckoutDomainSetup.fromJson(setup()).isReady, false);
      expect(CheckoutDomainSetup.fromJson(setup(ready: true)).isReady, true);
      for (final change in <JsonMap>[
        {'status': 'invented'},
        {'ssl_status': 'invented'},
        {'source': 'external'},
        {'checkout_origin': 'javascript:alert(1)'},
        {'fallback_origin': 'https://user:pass@example.in'},
        {'status': 'active'},
        {'checkout_origin': 'https://checkout.demo.example.in/path'},
        {'site_id': 'not-a-site'},
        {
          'dns_records': [
            {'type': 'A', 'name': 'test', 'value': '1.1.1.1'},
          ],
        },
      ]) {
        expect(
          () => CheckoutDomainSetup.fromJson({...setup(), ...change}),
          throwsFormatException,
        );
      }
    },
  );

  test(
    'canonical checkout transport binds site, idempotency and current context',
    () async {
      final dio = Dio(), calls = <RequestOptions>[];
      var epoch = 1;
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
        contextVersionProvider: () => epoch,
        tokenProvider: () => 'synthetic-session',
      );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (request, handler) {
            calls.add(request);
            handler.resolve(
              Response(
                requestOptions: request,
                statusCode: request.method == 'POST' ? 202 : 200,
                data: {'data': setup()},
              ),
            );
          },
        ),
      );
      final service = DomainService(api: api);
      final read = await service.checkoutSetup(site);
      expect(read.siteId, site);
      await service.checkoutSetup(site, prepare: true);
      await service.checkoutSetup(site, prepare: true);
      expect(calls.first.path, endsWith('/v1/custom/checkout-domain'));
      expect(calls.first.queryParameters['site_id'], site);
      expect(calls[1].data, {'site_id': site});
      expect(calls[1].headers['X-Store-ID'], site);
      expect(
        calls[1].headers['X-Idempotency-Key'],
        calls[2].headers['X-Idempotency-Key'],
      );
      expect(calls[1].headers['Authorization'], 'Bearer synthetic-session');
      final gate = Completer<void>();
      dio.interceptors.insert(
        0,
        InterceptorsWrapper(
          onRequest: (request, handler) async {
            await gate.future;
            handler.next(request);
          },
        ),
      );
      final pending = service.checkoutSetup(site);
      await Future<void>.delayed(Duration.zero);
      epoch = 2;
      gate.complete();
      await expectLater(
        pending,
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            'SESSION_CONTEXT_CHANGED',
          ),
        ),
      );
    },
  );

  test(
    'checkout response for a different site never becomes a usable setup',
    () async {
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => h.resolve(
            Response(
              requestOptions: r,
              statusCode: 200,
              data: setup(siteId: 'b0000000-0000-4000-8000-000000000002'),
            ),
          ),
        ),
      );
      await expectLater(
        DomainService(api: api).checkoutSetup(site),
        throwsFormatException,
      );
    },
  );

  testWidgets(
    'native checkout card uses server DNS, promotes only from confirmed readiness and fences a replacement actor',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final dio = Dio(), calls = <RequestOptions>[];
      final api = ApiClient(
        baseUrl: 'https://gateway.test/v1',
        dio: dio,
        maxRetries: 0,
      );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) {
            calls.add(r);
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: setup(ready: r.method == 'POST'),
              ),
            );
          },
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.bindActor('actor-a');
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: const MaterialApp(home: DomainSettingsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await reveal(tester, 'Check checkout status');
      expect(find.text('HTTPS ready'), findsNothing);
      expect(find.text('Preparing'), findsOneWidget);
      expect(find.text('owned-cname.example.test'), findsOneWidget);
      expect(find.text('https://checkout.letbuyy.com'), findsOneWidget);
      await tester.tap(find.text('Check checkout status'));
      await tester.pumpAndSettle();
      expect(find.text('HTTPS ready'), findsOneWidget);
      expect(calls.where((r) => r.method == 'POST').length, 1);
      await stores.bindActor('actor-b');
      await stores.loadStores();
      await tester.pumpAndSettle();
      expect(
        find.text(
          'The selected store changed. Refresh domains before editing.',
        ),
        findsOneWidget,
      );
      expect(find.text('owned-cname.example.test'), findsNothing);
      expect(find.text('Check checkout status'), findsNothing);
    },
  );

  testWidgets(
    'checkout failure has a retry and never hides healthy storefront settings',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      var fail = true;
      final dio = Dio(),
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            dio: dio,
            maxRetries: 0,
          );
      addTearDown(api.close);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (r, h) => h.resolve(
            Response(
              requestOptions: r,
              statusCode: fail ? 503 : 200,
              data: fail
                  ? {
                      'error': {
                        'code': 'PRIVATE_DB_DETAIL',
                        'message': 'internal database detail',
                      },
                    }
                  : setup(),
            ),
          ),
        ),
      );
      final stores = StoreContext(storeService: FixedStores(api));
      await stores.loadStores();
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider(create: (_) => DomainService(api: api)),
          ],
          child: const MaterialApp(home: DomainSettingsScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Save domain'), findsOneWidget);
      expect(find.text('internal database detail'), findsNothing);
      await reveal(tester, 'Retry checkout status');
      fail = false;
      await tester.tap(find.text('Retry checkout status'));
      await tester.pumpAndSettle();
      expect(find.text('Retry checkout status'), findsNothing);
      expect(find.text('HTTPS ready'), findsNothing);
      expect(find.text('Preparing'), findsOneWidget);
    },
  );
}
