import 'dart:async';
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

const _site = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class _Fixture {
  _Fixture(this.label, {bool held = false}) {
    if (held) hold = Completer<void>();
    api = ApiClient(
      baseUrl: 'https://gateway.test/v1',
      maxRetries: 0,
      storeIdProvider: () => stores.selectedStoreId,
      contextVersionProvider: () => stores.requestContextKey,
    );
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (r, h) async {
          if (r.path.endsWith('/stores')) {
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: {
                  'data': [
                    {
                      'id': _site,
                      'name': 'Synthetic Alpha',
                      'subdomain': 'synthetic-alpha',
                    },
                  ],
                  'meta': {
                    'total': 1,
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
          calls++;
          await hold?.future;
          h.resolve(
            Response(
              requestOptions: r,
              statusCode: 200,
              data: {
                'data': {
                  'site_id': _site,
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
                  'next_action': label,
                },
              },
            ),
          );
        },
      ),
    );
    service = StoreService(api: api);
    kyc = KycService(api: api);
  }
  final String label;
  late final ApiClient api;
  late final StoreService service;
  late final KycService kyc;
  late final StoreContext stores;
  Completer<void>? hold;
  int calls = 0;
  static Future<_Fixture> create(String label, {bool held = false}) async {
    SharedPreferences.setMockInitialValues({});
    final f = _Fixture(label, held: held);
    f.stores = StoreContext(
      storeService: f.service,
      prefs: await SharedPreferences.getInstance(),
      environment: 'local',
    );
    await f.stores.bindActor('synthetic-owner');
    await f.stores.ensureSelectedStore();
    return f;
  }

  void release() {
    if (hold != null && !hold!.isCompleted) hold!.complete();
  }

  void dispose() {
    release();
    kyc.dispose();
    stores.dispose();
    service.dispose();
    api.close();
  }
}

Future<void> _drive(WidgetTester tester) async {
  for (var i = 0; i < 20; i++) {
    await tester.pump(const Duration(milliseconds: 10));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 10)),
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final replace in ['service', 'stores', 'both', 'pending-service']) {
    testWidgets(
      'equal-key $replace replacement retires the old verification frame and allows fresh retry',
      (tester) async {
        final held = replace == 'pending-service';
        final old = (await tester.runAsync(
          () => _Fixture.create('Old private verification details', held: held),
        ))!;
        final fresh = (await tester.runAsync(
          () => _Fixture.create('Fresh verification details'),
        ))!;
        expect(old.stores.requestContextKey, fresh.stores.requestContextKey);
        final selected = ValueNotifier<(StoreContext, KycService)>((
          old.stores,
          old.kyc,
        ));
        addTearDown(() async {
          await tester.pumpWidget(const SizedBox.shrink());
          selected.dispose();
          old.dispose();
          fresh.dispose();
        });
        await tester.pumpWidget(
          MaterialApp(
            home: ValueListenableBuilder<(StoreContext, KycService)>(
              valueListenable: selected,
              builder: (context, pair, child) => MultiProvider(
                providers: [
                  ChangeNotifierProvider<StoreContext>.value(value: pair.$1),
                  ChangeNotifierProvider<KycService>.value(value: pair.$2),
                ],
                child: child,
              ),
              child: const KycScreen(),
            ),
          ),
        );
        await _drive(tester);
        expect(old.calls, 1);
        if (!held)
          expect(find.text('Old private verification details'), findsOneWidget);
        selected.value = (
          replace == 'stores' || replace == 'both' ? fresh.stores : old.stores,
          replace == 'stores' ? old.kyc : fresh.kyc,
        );
        await _drive(tester);
        old.release();
        await _drive(tester);
        expect(find.text('Old private verification details'), findsNothing);
        expect(
          find.text('Store access changed. Reload verification details.'),
          findsOneWidget,
        );
        await tester.tap(find.text('Retry'));
        await _drive(tester);
        if (replace == 'stores') {
          expect(old.calls, 2);
          expect(find.text('Old private verification details'), findsOneWidget);
        } else {
          expect(fresh.calls, 1);
          expect(find.text('Fresh verification details'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
      timeout: const Timeout(Duration(seconds: 30)),
    );
  }
}
