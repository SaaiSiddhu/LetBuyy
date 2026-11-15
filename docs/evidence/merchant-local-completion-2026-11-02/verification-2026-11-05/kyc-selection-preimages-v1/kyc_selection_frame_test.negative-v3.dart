// Actual StoreContext + KycService/SDK selection-boundary regression.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/kyc/kyc_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'package:letbuyy_store/services/store_service.dart';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

class _AfterLoadFrame extends StatefulWidget {
  const _AfterLoadFrame(this.change);
  final VoidCallback change;
  @override
  State<_AfterLoadFrame> createState() => _AfterLoadFrameState();
}

class _AfterLoadFrameState extends State<_AfterLoadFrame> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.change();
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final change in [false, true]) {
    testWidgets(
      change
          ? 'selection between initial ensure and continuation cannot request Alpha under Beta frame'
          : 'positive current Alpha verification overview renders through the actual SDK',
      (tester) async {
        late StoreContext stores;
        late StoreService storeService;
        late KycService service;
        late ApiClient api;
        final calls = <({String target, String? selected})>[];
        await tester.runAsync(() async {
          SharedPreferences.setMockInitialValues({});
          final prefs = await SharedPreferences.getInstance();
          api = ApiClient(
            baseUrl: 'https://gateway.test/v1',
            maxRetries: 0,
            storeIdProvider: () => stores.selectedStoreId,
            contextVersionProvider: () => stores.requestContextKey,
          );
          api.dio.interceptors.add(
            InterceptorsWrapper(
              onRequest: (r, h) {
                if (r.path.endsWith('/stores')) {
                  h.resolve(
                    Response(
                      requestOptions: r,
                      statusCode: 200,
                      data: {
                        'data': [
                          {
                            'id': a,
                            'name': 'Synthetic Alpha',
                            'subdomain': 'synthetic-alpha',
                          },
                          {
                            'id': b,
                            'name': 'Synthetic Beta',
                            'subdomain': 'synthetic-beta',
                          },
                        ],
                        'meta': {
                          'total': 2,
                          'page': 1,
                          'per_page': 50,
                          'total_pages': 1,
                          'has_next': false,
                          'has_prev': false,
                        },
                      },
                    ),
                  );
                  return;
                }
                expect(r.path.endsWith('/kyc'), isTrue);
                final id = r.queryParameters['store_id'] as String;
                calls.add((target: id, selected: stores.selectedStoreId));
                h.resolve(
                  Response(
                    requestOptions: r,
                    statusCode: 200,
                    data: {
                      'data': {
                        'site_id': id,
                        'provider_mode': 'sandbox',
                        'private_upload_available': false,
                        'overall_status': 'not_started',
                        'documents': [],
                        'required_documents': [
                          {
                            'document_type': 'business_pan',
                            'title': 'Business PAN',
                            'required': true,
                            'status': null,
                          },
                        ],
                        'next_action': id == a
                            ? 'Synthetic Alpha verification details'
                            : 'Synthetic Beta verification details',
                      },
                    },
                  ),
                );
              },
            ),
          );
          storeService = StoreService(api: api);
          stores = StoreContext(
            storeService: storeService,
            prefs: prefs,
            environment: 'local',
          );
          service = KycService(api: api);
          await stores.bindActor('synthetic-owner');
          await stores.ensureSelectedStore();
        });
        addTearDown(() async {
          await tester.pumpWidget(const SizedBox.shrink());
          service.dispose();
          stores.dispose();
          storeService.dispose();
          api.close();
        });
        expect(stores.selectedStoreId, a);
        Future<void>? selection;
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider.value(value: stores),
              ChangeNotifierProvider.value(value: service),
            ],
            child: MaterialApp(
              home: Stack(
                children: [
                  const KycScreen(),
                  if (change)
                    _AfterLoadFrame(
                      () => selection = stores.selectStoreById(b),
                    ),
                ],
              ),
            ),
          ),
        );
        // Real SDK completions and the widget fake clock both need a turn.
        for (var i = 0; i < 30; i++) {
          await tester.pump(const Duration(milliseconds: 10));
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 10)),
          );
        }
        await tester.pumpAndSettle();
        await selection;
        if (change) {
          expect(stores.selectedStoreId, b);
          expect(
            calls.where((call) => call.target != call.selected),
            isEmpty,
            reason:
                'A completed initial selection cannot be rebound to a new store frame',
          );
          expect(
            find.text('Synthetic Alpha verification details'),
            findsNothing,
          );
        } else {
          expect(calls, [(target: a, selected: a)]);
          expect(
            find.text('Synthetic Alpha verification details'),
            findsOneWidget,
          );
        }
      },
      timeout: const Timeout(Duration(seconds: 30)),
    );
  }
}
