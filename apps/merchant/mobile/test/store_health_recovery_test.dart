// Native UI/transport checks; real mounted Gateway/Postgres evidence is separate.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/screens/store_health/store_health_screen.dart';

const a = '22222222-2222-4222-8222-222222222222';
const b = '33333333-3333-4333-8333-333333333333';
JsonMap health(String site) => {
  'store_id': site,
  'score': 0,
  'readiness': {'status': 'unknown', 'complete': 0, 'total': 7, 'unknown': 1},
  'pillars': [
    {
      'id': 'domain',
      'label': 'Synthetic domain $site',
      'status': 'unknown',
      'score': 0,
      'summary': 'Domain evidence needs checking.',
      'route': '/domain-settings',
      'action_label': 'Review and resolve',
    },
  ],
};

class Transport extends ApiClient {
  Transport() : super(baseUrl: 'https://synthetic.invalid/v1', maxRetries: 0);
  bool fail = false, wrongStore = false;
  Completer<void>? hold;
  final calls = <String>[];
  @override
  Future<dynamic> request(String path, {ApiRequestOptions? options}) async {
    if (path == '/stores')
      return {
        'data': [
          for (final id in [a, b])
            {
              'id': id,
              'name': 'Synthetic $id',
              'subdomain': 'syn-${id.substring(0, 8)}',
            },
        ],
        'meta': {'page': 1, 'per_page': 25, 'total': 2},
      };
    calls.add(path);
    final site = path.split('/')[2];
    final gate = hold;
    if (gate != null && site == a) await gate.future;
    if (fail)
      throw const ApiException(
        message: 'Synthetic outage',
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
      );
    return {'data': health(wrongStore ? b : site)};
  }
}

Future<(Transport, StoreContext)> mount(WidgetTester t) async {
  SharedPreferences.setMockInitialValues({});
  final api = Transport();
  final actual = StoreService(api: api);
  final stores = StoreContext(storeService: actual);
  await stores.bindActor('synthetic-owner');
  await stores.ensureSelectedStore();
  await t.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: stores),
        ChangeNotifierProvider<StoreService>.value(value: actual),
      ],
      child: MaterialApp(
        home: const StoreHealthScreen(),
        routes: {
          '/domain-settings': (_) => Scaffold(
            appBar: AppBar(),
            body: const Text('Synthetic domain settings'),
          ),
        },
      ),
    ),
  );
  await t.pumpAndSettle();
  addTearDown(() {
    api.close();
    stores.dispose();
    actual.dispose();
  });
  return (api, stores);
}

void main() {
  testWidgets(
    'unknown evidence stays unknown; its action opens the real named settings route and returns to refresh',
    (t) async {
      final (api, _) = await mount(t);
      expect(find.text('Needs checking'), findsOneWidget);
      expect(find.text('Checks complete'), findsNothing);
      await t.tap(find.text('Review and resolve'));
      await t.pumpAndSettle();
      expect(find.text('Synthetic domain settings'), findsOneWidget);
      await t.pageBack();
      await t.pumpAndSettle();
      expect(api.calls.length, 2);
    },
  );
  testWidgets('failed refresh hides previous evidence and retry recovers', (
    t,
  ) async {
    final (api, _) = await mount(t);
    api.fail = true;
    await t.tap(find.byTooltip('Refresh'));
    await t.pumpAndSettle();
    expect(find.text('Store health is unavailable right now.'), findsOneWidget);
    expect(find.text('Needs checking'), findsNothing);
    api.fail = false;
    await t.tap(find.byTooltip('Refresh'));
    await t.pumpAndSettle();
    expect(find.text('Needs checking'), findsOneWidget);
  });
  testWidgets(
    'a late health reply cannot replace evidence after store switching',
    (t) async {
      final (api, stores) = await mount(t);
      api.hold = Completer<void>();
      await t.tap(find.byTooltip('Refresh'));
      await t.pump();
      await stores.selectStoreById(b);
      await t.pumpAndSettle();
      expect(find.text('Synthetic domain $b'), findsOneWidget);
      api.hold!.complete();
      await t.pumpAndSettle();
      expect(find.text('Synthetic domain $a'), findsNothing);
      expect(find.text('Synthetic domain $b'), findsOneWidget);
    },
  );
  testWidgets(
    'a mismatched health response cannot be shown for the selected store',
    (t) async {
      final (api, _) = await mount(t);
      api.wrongStore = true;
      await t.tap(find.byTooltip('Refresh'));
      await t.pumpAndSettle();
      expect(
        find.text('Store health is unavailable right now.'),
        findsOneWidget,
      );
      expect(find.text('Synthetic domain $b'), findsNothing);
    },
  );
}
