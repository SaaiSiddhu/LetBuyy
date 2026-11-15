// Real AnalyticsService and SDK, synthetic transport completion only.
// These are presentation/lifetime checks, not hosted report or RLS evidence.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/analytics/analytics_screen.dart';
import 'package:letbuyy_store/services/analytics_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

const site = '11111111-1111-4111-8111-111111111111';
JsonMap dashboard({double amount = 69.12, bool available = true}) => {
  'summary': available
      ? {
          'revenue': {'value': amount},
          'orders': {'value': 2},
          'products': 3,
          'avg_order_value': 34.56,
        }
      : <String, dynamic>{
          'revenue': <String, dynamic>{},
          'orders': <String, dynamic>{},
        },
  'comparison': {
    'previous_period': {'label': 'Previous synthetic range'},
    for (final metric in ['revenue', 'orders', 'average_order_value'])
      metric: {
        'value': metric == 'revenue' ? amount : 2,
        'prev': 0,
        'change_pct': 0,
      },
  },
};
JsonMap revenue() => {
  'chart': [
    {'date': '2026-11-01', 'revenue': 12.34, 'orders': 1},
    {'date': '2026-11-02', 'revenue': 56.78, 'orders': 1},
  ],
  'comparison': {
    'chart': [
      {'date': '2026-10-25', 'revenue': 0, 'orders': 0},
      {'date': '2026-10-26', 'revenue': 0, 'orders': 0},
    ],
  },
};
JsonMap live() => {
  'available': false,
  'generated_at': '2026-11-02T10:00:00Z',
  for (final key in [
    'top_pages',
    'traffic_sources',
    'devices',
    'countries',
    'recent_signals',
  ])
    key: [],
};

class AnalyticsTransport extends ApiClient {
  AnalyticsTransport()
    : super(baseUrl: 'https://analytics.synthetic.invalid/v1', maxRetries: 0);
  int epoch = 0;
  bool available = true;
  List<JsonMap>? productRows;
  final reads = <({String path, Map<String, dynamic>? query})>[];
  Future<JsonMap> Function(String, ApiRequestOptions?)? reply;
  Completer<JsonMap>? heldLive, heldPrimary;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    expect(options?.method ?? HttpMethod.get, HttpMethod.get);
    reads.add((path: path, query: options?.query));
    if (reply != null) return reply!(path, options);
    return response(path, options);
  }

  Future<JsonMap> response(String path, ApiRequestOptions? options) async {
    switch (path) {
      case '/analytics/dashboard':
        return heldPrimary == null
            ? dashboard(available: available)
            : heldPrimary!.future;
      case '/analytics/orders':
        return {
          'breakdown': {'pending': 2},
        };
      case '/analytics/revenue':
        return revenue();
      case '/analytics/traffic-sources':
        return {'available': false, 'sources': []};
      case '/analytics/live':
        return heldLive == null ? live() : heldLive!.future;
      default:
        fail('Unexpected analytics path: $path');
    }
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    expect(path, '/analytics/top-products');
    expect(options?.query?['limit'], 5);
    expect(options?.query?.containsKey('period'), isFalse);
    reads.add((path: path, query: options?.query));
    return decoder(
      productRows ??
          [
            {
              'id': 'synthetic-product',
              'name': 'Synthetic full product name',
              'total_sold': 2,
            },
          ],
    );
  }
}

class AnalyticsScope extends StoreContext {
  AnalyticsScope(this.api) : super(storeService: StoreService(api: api));
  final AnalyticsTransport api;
  int epoch = 0;
  Future<StoreModel?> Function()? selectionReply;
  String siteId = site;
  @override
  Object get requestContextKey => epoch;
  @override
  int get requestContextVersion => epoch;
  @override
  String get selectedStoreId => siteId;
  @override
  StoreModel get selectedStore => StoreModel.fromJson({
    'id': siteId,
    'seller_id': 'synthetic',
    'name': 'Synthetic report store',
    'subdomain': 'synthetic',
    'theme_id': 'modern',
    'total_visitors': 999,
    'total_orders': 888,
  });
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async =>
      selectionReply == null ? selectedStore : selectionReply!();
  void retire() {
    epoch++;
    api.epoch++;
    notifyListeners();
  }
}

Future<AnalyticsScope> mountAnalytics(
  WidgetTester tester,
  AnalyticsTransport api, {
  bool dark = false,
  double scale = 1,
}) async {
  final stores = AnalyticsScope(api), service = AnalyticsService(api: api);
  addTearDown(stores.dispose);
  addTearDown(service.dispose);
  addTearDown(api.close);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider<AnalyticsService>.value(value: service),
      ],
      child: MaterialApp(
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const AnalyticsScreen(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  return stores;
}

Future<void> reveal(WidgetTester tester, Finder target) async {
  await tester.scrollUntilVisible(
    target,
    250,
    scrollable: find
        .byWidgetPredicate(
          (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
        )
        .first,
    maxScrolls: 80,
  );
  await tester.pump();
}

Future<void> choosePeriod(
  WidgetTester tester,
  String label, {
  bool apply = true,
}) async {
  final field = find.byType(LetbuyyChoiceField<String>);
  await tester.ensureVisible(field);
  await tester.tap(
    find.descendant(of: field, matching: find.byType(OutlinedButton)),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
  await tester.tap(find.text(label).last);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
  await tester.tap(find.text(apply ? 'Apply selection' : 'Cancel'));
  // A primary read may intentionally remain held; do not pumpAndSettle it.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

ApiException readFailure(int status) => ApiException(
  message: 'Synthetic private raw detail',
  statusCode: status,
  code: 'SYNTHETIC_REPORT_FAILURE',
);

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'Analytics shell remains visible while its first primary read is held',
    (tester) async {
      final api = AnalyticsTransport()..heldPrimary = Completer<JsonMap>();
      try {
        await mountAnalytics(tester, api);
        expect(find.text('Analytics'), findsOneWidget);
        expect(find.text('Reporting period'), findsWidgets);
      } finally {
        api.heldPrimary!.complete(dashboard());
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets(
    'optional held live activity cannot hide the primary exact report amount',
    (tester) async {
      final api = AnalyticsTransport()..heldLive = Completer<JsonMap>();
      try {
        await mountAnalytics(tester, api);
        expect(find.text('₹69.12'), findsWidgets);
        expect(find.text('Analytics'), findsOneWidget);
      } finally {
        api.heldLive!.complete(live());
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets(
    'missing summary and visits remain unavailable rather than zero or store totals',
    (tester) async {
      final api = AnalyticsTransport()..available = false;
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      final tiles = tester.widgetList<StatTile>(find.byType(StatTile)).toList();
      expect(
        tiles
            .take(4)
            .where(
              (t) =>
                  ['Revenue', 'Orders', 'Products', 'Visits'].contains(t.label),
            )
            .map((t) => t.value),
        everyElement('Unavailable'),
      );
      expect(tiles.length, greaterThanOrEqualTo(4));
      expect(find.text('999'), findsNothing);
    },
  );
  testWidgets(
    'missing top-product revenue is not presented as a confirmed zero',
    (tester) async {
      final api = AnalyticsTransport();
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Synthetic full product name'));
      expect(find.text('Revenue unavailable'), findsOneWidget);
      expect(find.text('₹0.00 revenue'), findsNothing);
    },
  );
  testWidgets(
    'an observed owner retirement removes private report values immediately',
    (tester) async {
      final api = AnalyticsTransport();
      final stores = await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      expect(find.textContaining('69'), findsWidgets);
      api.heldPrimary = Completer<JsonMap>();
      try {
        stores.retire();
        await tester.pump();
        expect(find.textContaining('69'), findsNothing);
      } finally {
        api.heldPrimary!.complete(dashboard(amount: 73.45));
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets(
    'only Apply changes the exact existing period query; canceled draft performs no reads',
    (tester) async {
      final api = AnalyticsTransport();
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      expect(api.reads.map((r) => r.path), [
        '/analytics/dashboard',
        '/analytics/orders',
        '/analytics/revenue',
        '/analytics/top-products',
        '/analytics/traffic-sources',
        '/analytics/live',
      ]);
      await choosePeriod(tester, 'Last 30 days', apply: false);
      expect(api.reads, hasLength(6));
      for (final item in [
        (label: 'Last 30 days', value: '30d'),
        (label: 'Last 90 days', value: '90d'),
        (label: 'Last 12 months', value: '12m'),
        (label: 'Last 7 days', value: '7d'),
      ]) {
        final offset = api.reads.length;
        await choosePeriod(tester, item.label);
        await tester.pumpAndSettle();
        expect(
          api.reads.skip(offset).map((r) => r.path),
          api.reads.take(6).map((r) => r.path),
        );
        for (final row in api.reads.skip(offset)) {
          expect(row.query?['store_id'], site);
          if ([
            '/analytics/dashboard',
            '/analytics/revenue',
            '/analytics/traffic-sources',
          ].contains(row.path)) {
            expect(row.query?['period'], item.value);
          } else {
            expect(row.query?.containsKey('period'), isFalse);
          }
          if (row.path == '/analytics/live')
            expect(row.query?['window_minutes'], 15);
        }
      }
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'late old-period result cannot overwrite the newer applied report',
    (tester) async {
      final api = AnalyticsTransport(), held = Completer<JsonMap>();
      api.reply = (path, options) {
        if (path == '/analytics/dashboard')
          return options?.query?['period'] == '7d'
              ? held.future
              : Future.value(dashboard(amount: 87.65));
        return api.response(path, options);
      };
      try {
        await mountAnalytics(tester, api);
        await choosePeriod(tester, 'Last 30 days');
        await tester.pumpAndSettle();
        expect(find.text('₹87.65'), findsWidgets);
        held.complete(dashboard(amount: 11.11));
        await tester.pumpAndSettle();
        expect(find.text('₹87.65'), findsWidgets);
        expect(find.text('₹11.11'), findsNothing);
        expect(
          api.reads.where((r) => r.path == '/analytics/live'),
          hasLength(1),
        );
      } finally {
        if (!held.isCompleted) held.complete(dashboard());
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets(
    'same-query refresh retains scoped data, and failure is labelled without changing values',
    (tester) async {
      final api = AnalyticsTransport(), held = Completer<JsonMap>();
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      api.heldPrimary = held;
      await tester.tap(find.byTooltip('Refresh analytics'));
      await tester.pump();
      expect(find.text('₹69.12'), findsWidgets);
      expect(
        find.textContaining('Previous values remain below'),
        findsOneWidget,
      );
      held.completeError(readFailure(503));
      await tester.pumpAndSettle();
      expect(find.text('₹69.12'), findsWidgets);
      expect(find.textContaining('Refresh failed.'), findsOneWidget);
      expect(find.textContaining('Synthetic private raw detail'), findsNothing);
      expect(api.reads, hasLength(7));
    },
  );
  testWidgets(
    'optional failure keeps the report; its recovery repeats only the live read',
    (tester) async {
      final api = AnalyticsTransport();
      var failLive = true;
      api.reply = (path, options) async {
        if (path == '/analytics/live' && failLive) throw readFailure(503);
        return api.response(path, options);
      };
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      expect(find.text('₹69.12'), findsWidgets);
      await reveal(tester, find.text('Retry live activity'));
      expect(find.text('Live activity could not load.'), findsOneWidget);
      failLive = false;
      await tester.tap(find.text('Retry live activity'));
      await tester.pumpAndSettle();
      expect(api.reads, hasLength(7));
      expect(api.reads.last.path, '/analytics/live');
      expect(find.textContaining('No live traffic yet.'), findsOneWidget);
    },
  );
  for (final status in [401, 403]) {
    testWidgets(
      'current primary$status retires the previously visible report',
      (tester) async {
        final api = AnalyticsTransport();
        await mountAnalytics(tester, api);
        await tester.pumpAndSettle();
        expect(find.text('₹69.12'), findsWidgets);
        api.reply = (path, options) async => throw readFailure(status);
        await tester.tap(find.byTooltip('Refresh analytics'));
        await tester.pumpAndSettle();
        expect(find.text('Analytics access unavailable'), findsOneWidget);
        expect(find.text('₹69.12'), findsNothing);
        expect(find.text('Synthetic full product name'), findsNothing);
        expect(
          find.textContaining('Synthetic private raw detail'),
          findsNothing,
        );
        expect(api.reads, hasLength(7));
      },
    );
    testWidgets(
      'current optional$status retires primary data and captured retry cannot bypass denial',
      (tester) async {
        final api = AnalyticsTransport()..heldLive = Completer<JsonMap>();
        await mountAnalytics(tester, api);
        expect(find.text('₹69.12'), findsWidgets);
        api.heldLive!.completeError(readFailure(status));
        await tester.pumpAndSettle();
        expect(find.text('Analytics access unavailable'), findsOneWidget);
        expect(find.text('₹69.12'), findsNothing);
        expect(find.text('Retry live activity'), findsNothing);
        expect(api.reads, hasLength(6));
      },
    );
  }
  testWidgets('older optional positive cannot restore a newer primary denial', (
    tester,
  ) async {
    final api = AnalyticsTransport()..heldLive = Completer<JsonMap>();
    try {
      await mountAnalytics(tester, api);
      expect(find.text('₹69.12'), findsWidgets);
      api.reply = (path, options) async => throw readFailure(403);
      await tester.tap(find.byTooltip('Refresh analytics'));
      await tester.pumpAndSettle();
      api.heldLive!.complete({
        ...live(),
        'available': true,
        'active_sessions': 17,
      });
      await tester.pumpAndSettle();
      expect(find.text('Analytics access unavailable'), findsOneWidget);
      expect(find.text('₹69.12'), findsNothing);
      expect(find.text('17'), findsNothing);
    } finally {
      if (!api.heldLive!.isCompleted) api.heldLive!.complete(live());
      await tester.pumpAndSettle();
    }
  });
  testWidgets(
    'observed context retirement is latched even if its old context later returns',
    (tester) async {
      final api = AnalyticsTransport();
      final scope = await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      scope.retire();
      await tester.pump();
      scope.epoch = 0;
      api.epoch = 0;
      scope.notifyListeners();
      await tester.pump();
      expect(find.text('₹69.12'), findsNothing);
      expect(find.text('Store or account changed'), findsOneWidget);
      expect(api.reads, hasLength(6));
      await tester.tap(find.text('Load selected store'));
      await tester.pumpAndSettle();
      expect(find.text('₹69.12'), findsWidgets);
      expect(api.reads, hasLength(12));
    },
  );
  testWidgets(
    'captured period and refresh actions retire with the owner frame',
    (tester) async {
      final api = AnalyticsTransport();
      final scope = await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      final period = tester
          .widget<LetbuyyChoiceField<String>>(
            find.byType(LetbuyyChoiceField<String>),
          )
          .onChanged!;
      final refresh = tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (w) => w is IconButton && w.tooltip == 'Refresh analytics',
            ),
          )
          .onPressed!;
      scope.retire();
      await tester.pump();
      period('30d');
      refresh();
      await tester.pumpAndSettle();
      expect(api.reads, hasLength(6));
      expect(find.text('₹69.12'), findsNothing);
      expect(find.text('Store or account changed'), findsOneWidget);
    },
  );
  testWidgets(
    'mismatched selected-store discovery cannot start a report query',
    (tester) async {
      final api = AnalyticsTransport();
      final scope = await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      scope.selectionReply = () async => StoreModel.fromJson({
        'id': '22222222-2222-4222-8222-222222222222',
        'seller_id': 'synthetic',
        'name': 'Wrong store',
        'subdomain': 'wrong',
        'theme_id': 'modern',
      });
      await tester.tap(find.byTooltip('Refresh analytics'));
      await tester.pumpAndSettle();
      expect(find.text('₹69.12'), findsNothing);
      expect(find.text('Store or account changed'), findsOneWidget);
      expect(api.reads, hasLength(6));
    },
  );
  testWidgets(
    'a valid empty store selection is distinct from an Analytics outage',
    (tester) async {
      final api = AnalyticsTransport();
      final scope = await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      scope.selectionReply = () async => null;
      await tester.tap(find.byTooltip('Refresh analytics'));
      await tester.pumpAndSettle();
      expect(find.text('No store selected'), findsOneWidget);
      expect(find.text('Report unavailable'), findsNothing);
      expect(find.text('₹69.12'), findsNothing);
      expect(api.reads, hasLength(6));
    },
  );
  testWidgets(
    'covered-route captured period action cannot start another query',
    (tester) async {
      final api = AnalyticsTransport();
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      final callback = tester
          .widget<LetbuyyChoiceField<String>>(
            find.byType(LetbuyyChoiceField<String>),
          )
          .onChanged!;
      final context = tester.element(find.byType(AnalyticsScreen));
      unawaited(
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const Scaffold(body: Text('Covering destination')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      callback('30d');
      await tester.pumpAndSettle();
      expect(api.reads, hasLength(6));
      expect(find.text('Covering destination'), findsOneWidget);
    },
  );
  testWidgets(
    'late completion after route disposal does not use a disposed State',
    (tester) async {
      final api = AnalyticsTransport()..heldPrimary = Completer<JsonMap>();
      await mountAnalytics(tester, api);
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: Text('Another page'))),
      );
      api.heldPrimary!.complete(dashboard());
      await tester.pumpAndSettle();
      expect(find.text('₹69.12'), findsNothing);
      expect(tester.takeException(), isNull);
      expect(api.reads.where((r) => r.path == '/analytics/live'), isEmpty);
    },
  );
  testWidgets(
    'genuine zero comparisons remain available without a positive previous value',
    (tester) async {
      final api = AnalyticsTransport();
      api.reply = (path, options) async => path == '/analytics/dashboard'
          ? dashboard(amount: 0)
          : api.response(path, options);
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Previous synthetic range'));
      final comparisons = tester
          .widgetList<StatTile>(find.byType(StatTile))
          .where((w) => w.supportingText?.startsWith('Previous:') == true)
          .toList();
      expect(comparisons, hasLength(3));
      expect(comparisons.first.value, '₹0.00');
      expect(
        comparisons.first.supportingText,
        'Previous: ₹0.00\n0.0% change reported',
      );
    },
  );
  testWidgets(
    'daily chart identifies paid orders separately from all created orders',
    (tester) async {
      final api = AnalyticsTransport();
      api.reply = (path, options) async {
        if (path == '/analytics/dashboard') {
          final result = dashboard(amount: 0);
          (result['summary'] as Map)['orders'] = {'value': 1};
          return result;
        }
        if (path == '/analytics/revenue')
          return {
            'chart': [
              {'date': '2026-11-01', 'revenue': 0, 'orders': 0},
              {'date': '2026-11-02', 'revenue': 0, 'orders': 0},
            ],
            'comparison': {'chart': []},
          };
        return api.response(path, options);
      };
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      final overview = tester
          .widgetList<StatTile>(find.byType(StatTile))
          .firstWhere((t) => t.label == 'Orders');
      expect(overview.value, '1');
      await reveal(tester, find.text('Daily paid-order values'));
      expect(find.text('Paid orders'), findsOneWidget);
      final chart = tester.widget<LineChart>(find.byType(LineChart).last);
      expect(chart.data.lineBarsData.last.spots.map((s) => s.y), [0, 0]);
      expect(find.textContaining('Paid orders only'), findsOneWidget);
    },
  );
  testWidgets(
    'status breakdown exposes exact existing all-time buckets without merging or period claims',
    (tester) async {
      final api = AnalyticsTransport();
      api.reply = (path, options) async => path == '/analytics/orders'
          ? {
              'breakdown': {'pending': 1, 'pending_cod': 2, 'delivered': 7},
            }
          : api.response(path, options);
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Orders by status'));
      expect(
        find.text('All recorded orders · not filtered by reporting period.'),
        findsOneWidget,
      );
      final tiles = tester
          .widgetList<StatTile>(find.byType(StatTile))
          .where(
            (t) => ['Pending', 'pending_cod', 'Delivered'].contains(t.label),
          )
          .toList();
      expect(tiles.map((t) => t.label), [
        'Pending',
        'pending_cod',
        'Delivered',
      ]);
      expect(tiles.map((t) => t.value), ['1', '2', '7']);
      expect(
        api.reads.where((r) => r.path == '/analytics/orders').single.query,
        {'store_id': site},
      );
    },
  );
  testWidgets(
    'paid-order zero chart uses distinct whole-unit axis ticks without rounding fractional counts',
    (tester) async {
      final api = AnalyticsTransport();
      api.reply = (path, options) async => path == '/analytics/revenue'
          ? {
              'chart': [
                {'date': '2026-11-01', 'revenue': 0, 'orders': 0},
                {'date': '2026-11-02', 'revenue': 0, 'orders': 0},
              ],
              'comparison': {'chart': []},
            }
          : api.response(path, options);
      await mountAnalytics(tester, api);
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Daily paid-order values'));
      final data = tester.widget<LineChart>(find.byType(LineChart).last).data;
      expect(data.lineBarsData.last.spots.map((point) => point.y), [0, 0]);
      final interval = data.titlesData.leftTitles.sideTitles.interval!;
      expect(interval, greaterThanOrEqualTo(1));
      expect(interval, interval.roundToDouble());
      expect(data.gridData.horizontalInterval, interval);
      expect(data.minY, data.minY.roundToDouble());
      expect(data.maxY, data.maxY.roundToDouble());
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'full Analytics report flows at320dp scale2.4 dark$dark without clipped names or invented product revenue',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = AnalyticsTransport()
          ..productRows = [
            {
              'id': 'synthetic-product',
              'name':
                  'Synthetic product with a deliberately very long complete operational title',
              'total_sold': 123456789,
            },
          ];
        api.reply = (path, options) async {
          if (path == '/analytics/traffic-sources')
            return {
              'available': true,
              'sources': [
                {
                  'label':
                      'A deliberately long complete attributed traffic source name',
                  'value': 123456789,
                  'percentage': 66.7,
                },
              ],
            };
          if (path == '/analytics/live')
            return {
              ...live(),
              'available': true,
              'active_sessions': 1,
              'visitors': 2,
              'page_views': 3,
              'cart_adds': 4,
              'checkouts_started': 5,
              'window_minutes': 15,
            };
          return api.response(path, options);
        };
        await mountAnalytics(tester, api, dark: dark, scale: 2.4);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        for (final text in [
          'Daily revenue values',
          'Daily paid-order values',
          api.productRows!.single['name'] as String,
          'A deliberately long complete attributed traffic source name',
        ]) {
          await reveal(tester, find.text(text));
          final paragraph = tester.renderObject<RenderParagraph>(
            find.text(text),
          );
          expect(paragraph.didExceedMaxLines, isFalse);
          expect(tester.takeException(), isNull);
        }
        expect(find.text('66.7%'), findsOneWidget);
        expect(tester.binding.transientCallbackCount, 0);
      },
    );
  }
  test(
    'response presence distinguishes real zeros while retaining original numeric defaults',
    () {
      final missing = TopProduct.fromJson({'id': 'p'}),
          zero = TopProduct.fromJson({
            'id': 'p',
            'revenue': 0,
            'total_sold': 0,
          });
      expect(missing.revenue, 0);
      expect(missing.orders, 0);
      expect(missing.revenueAvailable, isFalse);
      expect(missing.ordersAvailable, isFalse);
      expect(zero.revenue, 0);
      expect(zero.orders, 0);
      expect(zero.revenueAvailable, isTrue);
      expect(zero.ordersAvailable, isTrue);
      final daily = DailyStats.fromJson({'date': '2026-11-02', 'orders': 0});
      expect(daily.revenue, 0);
      expect(daily.orders, 0);
      expect(daily.revenueAvailable, isFalse);
      expect(daily.ordersAvailable, isTrue);
      final delta = AnalyticsMetricDelta.fromJson({
        'value': 0,
        'prev': 0,
        'change_pct': 0,
      });
      expect(delta.available, isTrue);
      expect(delta.hasPrevious, isFalse);
      expect(AnalyticsMetricDelta.fromJson({}).available, isFalse);
      final traffic = TrafficSourceEntry.fromJson({'label': 'Synthetic'});
      expect(traffic.sessions, 0);
      expect(traffic.percentage, 0);
      expect(traffic.sessionsAvailable, isFalse);
      expect(traffic.percentageAvailable, isFalse);
      expect(
        LiveViewEntry.fromJson({'label': 'Synthetic'}).valueAvailable,
        isFalse,
      );
      final activity = StoreLiveView.fromJson({...live(), 'available': true});
      expect(activity.available, isTrue);
      expect(activity.activeSessions, 0);
      expect(activity.metricsAvailable, isFalse);
    },
  );
}
