// Real OrderService/ProductService and shared SDK, synthetic transport only.
// No hosted permission, provider, native keyboard or persistence certification.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/routes.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/orders/orders_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'orders_read_presentation_test.dart' as read;

class OrdersTransport extends read.ReadTransport {
  final reads = <({String path, ApiRequestOptions? options})>[];
  final commands = <({String path, ApiRequestOptions options})>[];
  final orderQueries = <JsonMap>[];
  List<JsonMap> rows = [read.orderRow()];
  Completer<PaginatedResponse<JsonMap>>? heldOrders;
  Completer<JsonMap>? heldCommand;
  int? listFailure;
  bool failCommands = false;
  String exportStatus = 'queued';
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    reads.add((path: path, options: options));
    if (path == '/orders') {
      orderQueries.add(Map<String, dynamic>.from(options!.query!));
      if (heldOrders != null) return heldOrders!.future;
      if (listFailure != null) throw read.failure(listFailure!);
      return PaginatedResponse(
        data: rows.map((r) => {...r}).toList(),
        total: rows.length,
        page: 1,
        limit: 20,
        hasMore: true,
        nextCursor: 'opaque-next',
      );
    }
    if (path == '/products')
      return PaginatedResponse(
        data: [
          {
            'id': 'synthetic-product',
            'store_id': read.site,
            'name': 'Synthetic product',
            'price': 129.75,
            'is_active': true,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        hasMore: false,
      );
    throw StateError('Unplanned paginated path: $path');
  }

  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (options?.method == HttpMethod.post ||
        options?.method == HttpMethod.patch) {
      commands.add((path: path, options: options!));
      if (heldCommand != null) return heldCommand!.future;
      if (failCommands) throw read.failure(503);
      if (path == '/orders/drafts') return {'id': 'synthetic-draft'};
      if (path.endsWith('/convert')) return {'order': read.orderRow()};
      return read.orderRow();
    }
    reads.add((path: path, options: options));
    if (path == '/export/orders')
      return {
        'job': {'id': 'synthetic-job', 'status': exportStatus},
      };
    if (path == '/export/jobs/synthetic-job')
      return {
        'job': {'id': 'synthetic-job', 'status': exportStatus},
      };
    if (path.endsWith('/packing-slip'))
      return {
        'order_number': 'SYNTHETIC-A',
        'text': 'Synthetic saved packing slip',
        'filename': 'packing-slip.pdf',
        'pdf_base64': '',
      };
    throw StateError('Unplanned read: $path');
  }
}

class OrdersScope extends StoreContext {
  OrdersScope(this.api) : super(storeService: StoreService(api: api));
  final OrdersTransport api;
  int epoch = 0;
  @override
  Object get requestContextKey => epoch;
  @override
  String get selectedStoreId => read.site;
  @override
  StoreModel get selectedStore => StoreModel.fromJson({
    'id': read.site,
    'seller_id': 'synthetic-owner',
    'name': 'Synthetic store',
    'subdomain': 'synthetic',
    'theme_id': 'modern',
  });
  @override
  Future<StoreModel?> ensureSelectedStore({bool force = false}) async =>
      selectedStore;
  void retire() {
    epoch++;
    api.epoch = epoch;
    notifyListeners();
  }
}

Future<({OrdersTransport api, OrdersScope scope, OrderService orders})>
mountOrders(
  WidgetTester tester, {
  OrdersTransport? transport,
  double scale = 1,
  bool dark = false,
  void Function(Object, bool)? onActions,
}) async {
  SharedPreferences.setMockInitialValues({});
  final api = transport ?? OrdersTransport();
  final scope = OrdersScope(api);
  // The same transport owns the active context and real SDK throughout a test.
  api.epoch = scope.epoch;
  final cache = CacheService.memory(
    actorIdProvider: () => api.epoch.toString(),
  );
  final orders = OrderService(api: api, cache: cache),
      products = ProductService(api: api);
  addTearDown(api.close);
  addTearDown(scope.dispose);
  addTearDown(orders.dispose);
  addTearDown(products.dispose);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<OrderService>.value(value: orders),
        ChangeNotifierProvider<ProductService>.value(value: products),
      ],
      child: MaterialApp(
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            disableAnimations: true,
          ),
          child: child!,
        ),
        routes: {
          AppRoutes.orderDetail: (_) =>
              const Scaffold(body: Text('Synthetic detail destination')),
        },
        home: OrdersScreen(onPageActionsChanged: onActions),
      ),
    ),
  );
  await tester.pump();
  await tester.pumpAndSettle();
  return (api: api, scope: scope, orders: orders);
}

Future<void> reveal(WidgetTester tester, Finder target) async {
  final scroll = find
      .descendant(
        of: find.byType(CustomScrollView).first,
        matching: find.byType(Scrollable),
      )
      .first;
  if (target.evaluate().isEmpty) {
    await tester.drag(scroll, const Offset(0, 10000));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(target, 180, scrollable: scroll);
  } else {
    await tester.ensureVisible(target);
  }
  await tester.pumpAndSettle();
}

Future<void> choose(
  WidgetTester tester,
  String field,
  String value, {
  bool apply = true,
}) async {
  final button = find.widgetWithText(OutlinedButton, field);
  await reveal(tester, button);
  await tester.tap(button);
  await tester.pumpAndSettle();
  final option = find.widgetWithText(RadioListTile<String>, value);
  await tester.ensureVisible(option);
  await tester.tap(option);
  await tester.pumpAndSettle();
  await tester.tap(
    find.widgetWithText(
      apply ? FilledButton : TextButton,
      apply ? 'Apply selection' : 'Cancel',
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openDraft(WidgetTester tester) async {
  await reveal(tester, find.widgetWithText(FilledButton, 'Draft'));
  await tester.tap(find.widgetWithText(FilledButton, 'Draft'));
  await tester.pumpAndSettle();
}

Finder input(String label) => find.descendant(
  of: find.widgetWithText(CustomTextField, label),
  matching: find.byType(TextFormField),
);
Future<void> fillDraft(WidgetTester tester) async {
  await tester.enterText(input('Customer name'), ' Synthetic owner ');
  await tester.enterText(
    input('Customer email'),
    ' synthetic@example.invalid ',
  );
  await tester.ensureVisible(input('Phone'));
  await tester.enterText(input('Phone'), ' +919000000000 ');
  await tester.ensureVisible(input('Notes'));
  await tester.enterText(input('Notes'), ' Synthetic note ');
  await tester.pumpAndSettle();
}

void main() {
  for (final value in [0, 1, 'malformed']) {
    testWidgets(
      'canonical server item_count $value is used without defaulting absent line_items to zero',
      (tester) async {
        final api = OrdersTransport();
        final row = read.orderRow()..remove('line_items');
        row['item_count'] = value;
        api.rows = [row];
        await mountOrders(tester, transport: api);
        await reveal(
          tester,
          find.byKey(const ValueKey('order-card-${read.recordId}')),
        );
        expect(
          find.text(value is int ? '$value items' : 'Item count unavailable'),
          findsOneWidget,
        );
        expect(api.commands, isEmpty);
      },
    );
  }

  for (final entry in <({String name, Object? raw, String expected})>[
    (name: 'missing', raw: 'missing', expected: 'Item count unavailable'),
    (name: 'null', raw: null, expected: 'Item count unavailable'),
    (
      name: 'malformed',
      raw: [
        {'quantity': null},
      ],
      expected: 'Item count unavailable',
    ),
    (name: 'explicit empty', raw: [], expected: '0 items'),
    (
      name: 'real quantities',
      raw: [
        {'quantity': 2},
        {'quantity': 3},
      ],
      expected: '5 items',
    ),
    (
      name: 'supported integer text',
      raw: [
        {'quantity': '2'},
      ],
      expected: '2 items',
    ),
  ]) {
    testWidgets(
      'native23 item population ${entry.name} is truthful in visible and spoken list',
      (tester) async {
        final api = OrdersTransport();
        final row = read.orderRow();
        if (entry.name == 'missing') {
          row.remove('line_items');
        } else {
          row['line_items'] = entry.raw;
        }
        api.rows = [row];
        await mountOrders(tester, transport: api);
        final card = find.byKey(const ValueKey('order-card-${read.recordId}'));
        await reveal(tester, card);
        expect(find.text(entry.expected), findsOneWidget);
        final semantics = tester.ensureSemantics();
        try {
          expect(
            tester.getSemantics(card).getSemanticsData().label,
            contains(entry.expected),
          );
        } finally {
          semantics.dispose();
        }
        expect(api.commands, isEmpty);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'loaded-page status uses an applied sheet draft and exact list query stays unchanged',
    (tester) async {
      final api = OrdersTransport()
        ..rows = [
          read.orderRow(),
          {
            ...read.orderRow(),
            'id': 'pending-id',
            'order_number': 'PENDING-SYNTHETIC',
            'status': 'pending',
          },
        ];
      await mountOrders(tester, transport: api);
      expect(find.textContaining('Loaded page 1'), findsOneWidget);
      final originalReads = api.orderQueries.length;
      await choose(tester, 'Page status: All', 'Pending', apply: false);
      await reveal(
        tester,
        find.byKey(const ValueKey('order-card-${read.recordId}')),
      );
      expect(find.text('SYNTHETIC-A'), findsOneWidget);
      await choose(tester, 'Page status: All', 'Pending');
      await reveal(tester, find.byKey(const ValueKey('order-card-pending-id')));
      expect(find.text('PENDING-SYNTHETIC'), findsOneWidget);
      expect(find.text('SYNTHETIC-A'), findsNothing);
      expect(api.orderQueries.length, originalReads);
      expect(api.orderQueries.single, {
        'store_id': read.site,
        'page': 1,
        'limit': 20,
      });
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'server cursor pages do not retain prior-page rows, counts or selection',
    (tester) async {
      final api = OrdersTransport();
      await mountOrders(tester, transport: api);
      await reveal(tester, find.text('Select'));
      await tester.tap(find.text('Select'));
      await tester.pumpAndSettle();
      await reveal(
        tester,
        find.byKey(const ValueKey('order-select-${read.recordId}')),
      );
      await tester.tap(
        find.byKey(const ValueKey('order-select-${read.recordId}')),
      );
      await tester.pumpAndSettle();
      api.rows = [
        {...read.orderRow(), 'id': 'page-two', 'order_number': 'PAGE-TWO'},
      ];
      await reveal(tester, find.text('Next page'));
      await tester.tap(find.text('Next page'));
      await tester.pumpAndSettle();
      expect(api.orderQueries.last, {
        'store_id': read.site,
        'page': 2,
        'limit': 20,
        'cursor': 'opaque-next',
      });
      expect(find.textContaining('Loaded page 2'), findsOneWidget);
      await reveal(tester, find.byKey(const ValueKey('order-card-page-two')));
      expect(find.text('SYNTHETIC-A'), findsNothing);
      expect(find.textContaining('0 selected'), findsOneWidget);
      api.rows = [read.orderRow()];
      await reveal(tester, find.text('Previous page'));
      await tester.tap(find.text('Previous page'));
      await tester.pumpAndSettle();
      expect(api.orderQueries.last, {
        'store_id': read.site,
        'page': 1,
        'limit': 20,
      });
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'exact zero and absent total remain distinct; long identities wrap at 320 and 200 percent',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = OrdersTransport()
        ..rows = [
          {
            ...read.orderRow(),
            'order_number': 'VERY-LONG-SYNTHETIC-ORDER-IDENTIFIER-1234567890',
            'customer_name':
                'A synthetic customer with a very long full name for narrow screens',
            'total': 129.75,
          },
          {
            ...read.orderRow(),
            'id': 'zero',
            'order_number': 'ZERO',
            'total': 0,
            'line_items': [
              {'quantity': 1, 'total': 999},
            ],
          },
          {
            ...read.orderRow(),
            'id': 'unknown',
            'order_number': 'UNKNOWN',
            'total': null,
          },
        ];
      await mountOrders(tester, transport: api, scale: 2, dark: true);
      await reveal(
        tester,
        find.byKey(const ValueKey('order-card-${read.recordId}')),
      );
      expect(find.text('₹129.75'), findsOneWidget);
      await reveal(tester, find.byKey(const ValueKey('order-card-zero')));
      expect(find.text('₹0.00'), findsOneWidget);
      expect(find.text('₹999.00'), findsNothing);
      await reveal(tester, find.byKey(const ValueKey('order-card-unknown')));
      expect(find.text('Total unavailable'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'current denial retires populated UI while same-owner offline retains labelled saved results',
    (tester) async {
      final api = OrdersTransport();
      await mountOrders(tester, transport: api);
      api.listFailure = 503;
      await tester.tap(find.byTooltip('Refresh orders'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Saved results ·'), findsOneWidget);
      final draft = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Draft'),
      );
      expect(draft.onPressed, isNull);
      api.listFailure = 403;
      await tester.tap(find.byTooltip('Refresh orders'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('order-card-${read.recordId}')),
        findsNothing,
      );
      expect(
        find.textContaining('Order access could not be confirmed.'),
        findsOneWidget,
      );
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'retired order route and held read cannot restore former private rows',
    (tester) async {
      final api = OrdersTransport();
      final h = await mountOrders(tester, transport: api);
      api.heldOrders = Completer<PaginatedResponse<JsonMap>>();
      await tester.tap(find.byTooltip('Refresh orders'));
      await tester.pump();
      final former = api.heldOrders!;
      h.scope.retire();
      api.heldOrders = null;
      api.rows = [
        {...read.orderRow(), 'order_number': 'CURRENT-ACTOR'},
      ];
      await tester.pumpAndSettle();
      former.complete(read.page(number: 'FORMER-PRIVATE'));
      await tester.pumpAndSettle();
      await reveal(
        tester,
        find.byKey(const ValueKey('order-card-${read.recordId}')),
      );
      expect(find.text('CURRENT-ACTOR'), findsOneWidget);
      expect(find.text('FORMER-PRIVATE'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'complex draft is a durable editor with validation, cancel-safe dirty input and exact original create/convert payload',
    (tester) async {
      final api = OrdersTransport();
      await mountOrders(tester, transport: api);
      await openDraft(tester);
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
      await tester.pumpAndSettle();
      expect(find.text('Enter a customer name.'), findsOneWidget);
      expect(api.commands, isEmpty);
      await fillDraft(tester);
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();
      await tester.drag(find.byType(ListView).last, const Offset(0, 800));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(input('Customer name')).controller!.text,
        ' Synthetic owner ',
      );
      await tester.scrollUntilVisible(
        find.byType(SwitchListTile),
        180,
        scrollable: find
            .descendant(
              of: find.byType(ListView).last,
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.byType(SwitchListTile));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
      await tester.pumpAndSettle();
      expect(api.commands.map((c) => c.path), [
        '/orders/drafts',
        '/orders/drafts/synthetic-draft/convert',
      ]);
      final body = Map<String, dynamic>.from(
        api.commands.first.options.body! as Map,
      );
      expect(
        body.remove('idempotency_key'),
        startsWith('mobile-draft-${read.site}-'),
      );
      expect(body, {
        'store_id': read.site,
        'customer_name': 'Synthetic owner',
        'customer_email': 'synthetic@example.invalid',
        'customer_phone': '+919000000000',
        'notes': 'Synthetic note',
        'items': [
          {'product_id': 'synthetic-product', 'quantity': 1},
        ],
        'payment_method': 'cod',
        'shipping_method': 'standard',
      });
      expect(find.byType(LetbuyyEditorScaffold), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'lost draft acknowledgement keeps the draft and cannot submit a new operation',
    (tester) async {
      final api = OrdersTransport()..failCommands = true;
      await mountOrders(tester, transport: api);
      await openDraft(tester);
      await fillDraft(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('The draft outcome could not be confirmed.'),
        findsOneWidget,
      );
      expect(
        tester.widget<TextFormField>(input('Customer name')).controller!.text,
        ' Synthetic owner ',
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Save draft'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(
        find.widgetWithText(FilledButton, 'Save draft'),
        warnIfMissed: false,
      );
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(1));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'draft store retirement while submitting prevents further conversion and private completion feedback',
    (tester) async {
      final api = OrdersTransport();
      final h = await mountOrders(tester, transport: api);
      await openDraft(tester);
      await fillDraft(tester);
      await tester.scrollUntilVisible(
        find.byType(SwitchListTile),
        180,
        scrollable: find
            .descendant(
              of: find.byType(ListView).last,
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.byType(SwitchListTile));
      await tester.pumpAndSettle();
      api.heldCommand = Completer<JsonMap>();
      await tester.tap(find.widgetWithText(FilledButton, 'Save draft'));
      await tester.pump();
      h.scope.retire();
      await tester.pump();
      api.heldCommand!.complete({'id': 'former-draft'});
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(1));
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.textContaining('Draft order saved'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'focused cancellation sheet retains exact trimmed reason and original cancel command',
    (tester) async {
      final api = OrdersTransport();
      await mountOrders(tester, transport: api);
      final cancel = find.widgetWithText(TextButton, 'Cancelled');
      await reveal(tester, cancel);
      await tester.tap(cancel);
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyFormSheet), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Cancel order'),
            )
            .onPressed,
        isNull,
      );
      await tester.enterText(
        input('Cancellation reason'),
        ' Synthetic cancellation ',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Cancel order'));
      await tester.pumpAndSettle();
      final command = api.commands.single;
      expect(command.path, '/orders/${read.recordId}');
      final body = Map<String, dynamic>.from(command.options.body! as Map);
      expect(
        body.remove('idempotency_key'),
        startsWith('mobile-cancel-${read.recordId}-'),
      );
      expect(body, {
        'status': 'cancelled',
        'cancellation_reason': 'Synthetic cancellation',
      });
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'queued export rechecks the original job without silently starting another',
    (tester) async {
      final api = OrdersTransport();
      final actionStates = <bool>[];
      await mountOrders(
        tester,
        transport: api,
        onActions: (_, visible) => actionStates.add(visible),
      );
      await reveal(tester, find.text('Export'));
      await tester.tap(find.text('Export'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Loaded-page search, date and sort'),
        findsOneWidget,
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Start CSV export'));
      await tester.pumpAndSettle(const Duration(milliseconds: 400));
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 400));
      }
      await tester.pumpAndSettle();
      expect(api.reads.where((r) => r.path == '/export/orders'), hasLength(1));
      expect(
        api.reads.where((r) => r.path == '/export/jobs/synthetic-job'),
        hasLength(5),
      );
      expect(find.text('CSV export · queued'), findsOneWidget);
      expect(actionStates, contains(true));
      await reveal(tester, find.text('Recheck same job'));
      await tester.tap(find.text('Recheck same job'));
      await tester.pumpAndSettle();
      expect(api.reads.where((r) => r.path == '/export/orders'), hasLength(1));
      expect(
        api.reads.where((r) => r.path == '/export/jobs/synthetic-job'),
        hasLength(6),
      );
      expect(find.text('Share CSV'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'packing slip is a durable reading page; clipboard acknowledgement after retirement has no stale UI',
    (tester) async {
      final api = OrdersTransport();
      final h = await mountOrders(tester, transport: api);
      final clipboard = Completer<void>();
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') await clipboard.future;
        return null;
      });
      addTearDown(
        () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
      );
      await reveal(tester, find.text('Print'));
      await tester.tap(find.text('Print'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(find.text('Synthetic saved packing slip'), findsOneWidget);
      await tester.tap(find.text('Copy'));
      await tester.pump();
      h.scope.retire();
      await tester.pump();
      clipboard.complete();
      await tester.pumpAndSettle();
      expect(find.text('Packing slip copied.'), findsNothing);
      expect(find.text('Store access changed'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
