// UI through the real OrderService/shared SDK with synthetic completion only.
// Positive/negative presentation proof, not a hosted/refund/provider result.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/orders/order_detail_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'orders_presentation_test.dart' as orders;
import 'orders_read_presentation_test.dart' as read;
import 'support/loyalty_fixture.dart' show MemoryStorage;

class HeldRefundOrders extends OrderService {
  HeldRefundOrders({required super.api, super.cache});
  final held = Completer<JsonMap?>();
  int preparations = 0;
  @override
  Future<JsonMap?> pendingRefundRequest(String id, MerchantSecurityContext c) {
    preparations++;
    return held.future;
  }
}

class DetailNavigationObserver extends NavigatorObserver {
  int pops = 0;
  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pops++;
  }
}

class DetailUiTransport extends orders.OrdersTransport {
  final detailReads = <ApiRequestOptions?>[];
  final providerReads = <ApiRequestOptions>[];
  JsonMap providerResult = {
    'provider_mode': 'sandbox',
    'capabilities': {
      'provider_mode': 'unavailable',
      'manual': true,
      'carrier_booking_available': false,
    },
  };
  Completer<JsonMap>? heldProvider;
  int? providerFailure;
  JsonMap result = {...read.orderRow(), 'order_number': 'FRESH-SYNTHETIC'};
  int? detailFailure;
  bool loseRefundReply = false;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path == '/shipping/labels/provider-mode') {
      providerReads.add(options!);
      if (heldProvider != null) return heldProvider!.future;
      if (providerFailure != null) throw read.failure(providerFailure!);
      return providerResult;
    }
    if (path == '/shipping/labels' && options?.method == HttpMethod.post) {
      commands.add((path: path, options: options!));
      return {
        'label': {
          'carrier': 'Synthetic carrier',
          'tracking_number': 'SYN-LABEL-001',
          'pdf_base64': '',
        },
      };
    }
    if (path == '/orders/${read.recordId}' &&
        (options?.method == null || options?.method == HttpMethod.get)) {
      detailReads.add(options);
      if (detailFailure != null) throw read.failure(detailFailure!);
      return result;
    }
    if (path == '/orders/${read.recordId}/refund' &&
        options?.method == HttpMethod.post) {
      commands.add((path: path, options: options!));
      if (loseRefundReply) throw read.failure(503);
      return {
        'status': 'pending',
        'refund_id': 'synthetic-refund',
        'return_id': 'synthetic-return',
        'order': result,
      };
    }
    return super.requestJson(path, options: options);
  }
}

JsonMap detailWithLines() => {
  ...read.orderRow(),
  'line_items': [
    {
      'id': 'synthetic-line',
      'name': 'Synthetic item',
      'quantity': 2,
      'unit_price': 129.75,
      'total': 259.5,
    },
  ],
};

Finder detailField(String label) => find.descendant(
  of: find.byWidgetPredicate((w) => w is CustomTextField && w.label == label),
  matching: find.byType(TextFormField),
);

Future<void> editLines(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    find.text('Edit'),
    180,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.tap(find.text('Edit'));
  await tester.pumpAndSettle();
  expect(find.text('Edit line items'), findsOneWidget);
}

Future<({orders.OrdersScope scope, CacheService cache, OrderService service})>
mountDetail(
  WidgetTester tester,
  DetailUiTransport api, {
  bool initial = true,
  OrderService Function(CacheService)? serviceFactory,
  double scale = 1,
  bool dark = false,
  NavigatorObserver? observer,
}) async {
  final scope = orders.OrdersScope(api);
  api.epoch = scope.epoch;
  final cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
  final service =
      serviceFactory?.call(cache) ??
      OrderService(
        api: api,
        cache: cache,
        securityCommands: SecurityCommandStore(storage: MemoryStorage()),
      );
  final security = TwoFactorService(
    api: api,
    actorIdProvider: () => 'synthetic-actor',
    storeIdProvider: () => read.site,
    storage: MemoryStorage(),
  );
  addTearDown(api.close);
  addTearDown(scope.dispose);
  addTearDown(service.dispose);
  addTearDown(security.dispose);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<OrderService>.value(value: service),
        ChangeNotifierProvider<TwoFactorService>.value(value: security),
      ],
      child: MaterialApp(
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        navigatorObservers: [if (observer != null) observer],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: OrderDetailScreen(
          orderId: read.recordId,
          initialOrder: initial
              ? OrderContract.fromJson({
                  ...read.orderRow(),
                  'order_number': 'SAVED-PRIVATE',
                })
              : null,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (scope: scope, cache: cache, service: service);
}

void main() {
  testWidgets(
    'canonical API item projection stays readable without inventing command line references',
    (tester) async {
      final api = DetailUiTransport();
      api.result = {...read.orderRow()}..remove('line_items');
      final items = [
        {
          'product_id': 'synthetic-product',
          'variant_id': null,
          'title': 'Canonical synthetic product',
          'quantity': 1,
          'unit_price': 199.0,
          'total': 199.0,
          'sku': 'SYN-CANONICAL',
        },
      ];
      api.result.addAll({
        'order_items': items,
        'items': items,
        'item_count': 1,
        'total': 199.0,
      });
      final host = await mountDetail(tester, api);
      await tester.scrollUntilVisible(
        find.text('Canonical synthetic product'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Qty 1'), findsOneWidget);
      expect(find.text('Unit price ₹199.00'), findsOneWidget);
      expect(find.text('Line total ₹199.00'), findsOneWidget);
      expect(find.text('Line changes unavailable'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Edit'), findsNothing);
      expect(host.service.cachedOrder(read.recordId)!.lineItems, isEmpty);
      expect(
        host.cache.readJsonMap(
          CacheService.orderDetailKey(read.recordId),
        )!['order_items'],
        items,
      );
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'an initial order is not a live confirmation: detail always reads and renders the current record',
    (tester) async {
      final api = DetailUiTransport();
      await mountDetail(tester, api);
      expect(api.detailReads, hasLength(1));
      expect(find.text('FRESH-SYNTHETIC'), findsOneWidget);
      expect(find.text('SAVED-PRIVATE'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  for (final status in [401, 403, 404]) {
    testWidgets(
      'current detail$status cannot retain an initial private record or active order commands',
      (tester) async {
        final api = DetailUiTransport()..detailFailure = status;
        await mountDetail(tester, api);
        expect(api.detailReads, hasLength(1));
        expect(find.text('SAVED-PRIVATE'), findsNothing);
        expect(find.text('Synthetic private record'), findsNothing);
        expect(find.text('Fulfill'), findsNothing);
        expect(find.text('Complete refund'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'wrong-store detail never enters the selected-store UI or its detail cache',
    (tester) async {
      final api = DetailUiTransport()
        ..result = {
          ...read.orderRow(store: read.otherSite),
          'order_number': 'OTHER-STORE-PRIVATE',
        };
      final h = await mountDetail(tester, api, initial: false);
      expect(api.detailReads, hasLength(1));
      expect(find.text('OTHER-STORE-PRIVATE'), findsNothing);
      expect(
        h.cache.readJsonMap(CacheService.orderDetailKey(read.recordId)),
        isNull,
      );
      expect(find.text('Fulfill'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'one refund preparation owns input before its pending journal and form settle',
    (tester) async {
      final api = DetailUiTransport();
      late HeldRefundOrders service;
      await mountDetail(
        tester,
        api,
        serviceFactory: (cache) =>
            service = HeldRefundOrders(api: api, cache: cache),
      );
      try {
        await tester.tap(find.text('Refund'));
        await tester.pump();
        await tester.tap(find.text('Refund'), warnIfMissed: false);
        await tester.pump();
        expect(service.preparations, 1);
      } finally {
        if (!service.held.isCompleted) service.held.complete(null);
        await tester.pumpAndSettle();
        if (find.byType(AlertDialog).evaluate().isNotEmpty) {
          await tester.tap(find.widgetWithText(TextButton, 'Cancel').last);
          await tester.pumpAndSettle();
        }
      }
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a fulfillment form is retired when the selected store context changes',
    (tester) async {
      final api = DetailUiTransport();
      final h = await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      expect(find.text('Fulfill order'), findsOneWidget);
      h.scope.retire();
      await tester.pumpAndSettle();
      expect(find.text('Fulfill order'), findsNothing);
      expect(find.text('Store access changed'), findsOneWidget);
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'refund validation remains visible in its actual form and sends no invalid command',
    (tester) async {
      final api = DetailUiTransport()
        ..result = {
          ...read.orderRow(),
          'line_items': [
            {
              'id': 'synthetic-line',
              'name': 'Synthetic item',
              'quantity': 2,
              'unit_price': 129.75,
              'total': 259.5,
            },
          ],
        };
      await mountDetail(tester, api);
      await tester.tap(find.text('Refund'));
      await tester.pumpAndSettle();
      expect(find.text('Request item refund'), findsOneWidget);
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      final quantity = find.descendant(
        of: find.byWidgetPredicate(
          (w) =>
              w is CustomTextField &&
              w.label == 'Return quantity: Synthetic item',
        ),
        matching: find.byType(TextFormField),
      );
      expect(quantity, findsOneWidget);
      await tester.enterText(quantity, '-1');
      await tester.pump();
      await tester.tap(find.widgetWithText(FilledButton, 'Request refund'));
      await tester.pump();
      expect(
        find.text(
          'Enter a return quantity between 0 and the ordered quantity.',
        ),
        findsOneWidget,
      );
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('detail confirmed zero is not replaced by the line-sum fallback', (
    tester,
  ) async {
    final api = DetailUiTransport()
      ..result = {
        ...read.orderRow(),
        'total': 0,
        'line_items': [
          {
            'id': 'synthetic-line',
            'name': 'Synthetic item',
            'quantity': 1,
            'total': 999,
            'unit_price': 999,
          },
        ],
      };
    await mountDetail(tester, api);
    expect(
      find.text('₹0.00'),
      findsAtLeastNWidgets(1),
      reason:
          'Stored zero is a value, not permission to display the protected fallback as the confirmed total.',
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('missing detail total is unavailable, not numeric zero', (
    tester,
  ) async {
    final api = DetailUiTransport()
      ..result = {...read.orderRow(), 'total': null};
    await mountDetail(tester, api);
    expect(find.text('Total unavailable'), findsAtLeastNWidgets(1));
    expect(tester.takeException(), isNull);
  });
  for (final level in ['high', null]) {
    testWidgets(
      'risk display keeps missing score and level distinct from model defaults $level',
      (tester) async {
        final api = DetailUiTransport()
          ..result = {
            ...read.orderRow(),
            'risk_level': level,
            'risk_score': null,
            'fulfillment_state': 'hold',
          };
        await mountDetail(tester, api);
        await tester.scrollUntilVisible(
          find.text('Risk signal'),
          160,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.text('Score unavailable'), findsOneWidget);
        expect(find.text('Score 0/100'), findsNothing);
        if (level == null) {
          expect(find.text('Risk level unavailable'), findsOneWidget);
          expect(find.text('Low risk'), findsNothing);
        } else {
          expect(find.text('High risk'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final dark in [false, true]) {
    testWidgets(
      'detail full record identity, exact amount and actions fit320dp at200percent dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        const number =
            'SYNTHETIC-VERY-LONG-ORDER-IDENTIFIER-1234567890-ABCDEFGHIJK';
        final api = DetailUiTransport()
          ..result = {
            ...read.orderRow(),
            'order_number': number,
            'total': 129.75,
            'customer_name':
                'Synthetic customer with a long full name for a narrow operational screen',
            'risk_level': null,
            'risk_score': null,
            'fulfillment_state': 'hold',
          };
        await mountDetail(tester, api, scale: 2, dark: dark);
        final plain = find.byWidgetPredicate(
          (w) => w is Text && w.data == number,
        );
        if (plain.evaluate().isNotEmpty) {
          expect(
            tester.renderObject<RenderParagraph>(plain).didExceedMaxLines,
            isFalse,
            reason: 'The full order identity must be readable, not ellipsized.',
          );
        } else {
          final selectable = find.byWidgetPredicate(
            (w) => w is SelectableText && w.data == number,
          );
          expect(selectable, findsOneWidget);
          expect(tester.widget<SelectableText>(selectable).maxLines, isNull);
        }
        expect(find.text('₹129.75'), findsAtLeastNWidgets(1));
        await tester.scrollUntilVisible(
          find.text('Risk signal'),
          160,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.text('Risk level unavailable'), findsOneWidget);
        expect(find.text('Score unavailable'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('a late repeated sheet close cannot pop the order behind it', (
    tester,
  ) async {
    final api = DetailUiTransport(), observer = DetailNavigationObserver();
    await mountDetail(tester, api, observer: observer);
    await tester.ensureVisible(find.widgetWithText(OutlinedButton, 'Cancel'));
    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancel'));
    await tester.pumpAndSettle();
    final close = tester
        .widget<TextButton>(find.widgetWithText(TextButton, 'Keep order'))
        .onPressed!;
    close();
    close();
    await tester.pumpAndSettle();
    expect(
      observer.pops,
      1,
      reason: 'Only the sheet owns this close, even before its exit frame.',
    );
    expect(find.text('Order detail'), findsOneWidget);
    expect(api.commands, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'an outgoing fulfillment editor cannot submit through its discard confirmation',
    (tester) async {
      final api = DetailUiTransport();
      await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      await tester.enterText(detailField('Carrier'), 'Synthetic carrier');
      await tester.pump();
      final save = tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Ship'))
          .onPressed!;
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      save();
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'dirty Back keeps native text, then line Save sends the original exact mapping',
    (tester) async {
      final api = DetailUiTransport()..result = detailWithLines();
      await mountDetail(tester, api);
      await editLines(tester);
      await tester.enterText(detailField('Quantity: Synthetic item'), '1');
      await tester.pump();
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Cancel').last);
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextFormField>(detailField('Quantity: Synthetic item'))
            .controller!
            .text,
        '1',
      );
      expect(api.commands, isEmpty);
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(find.text('Edit line items'), findsNothing);
      final sent = api.commands.single;
      expect(sent.path, '/orders/${read.recordId}/line-items');
      final body = asJsonMap(sent.options.body);
      expect(body['lines'], [
        {'order_item_id': 'synthetic-line', 'quantity': 1},
      ]);
      expect(body['add_items'], isEmpty);
      expect(body['remove_line_item_ids'], isEmpty);
      expect(body['idempotency_key'], isNotEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'manual fulfillment submits exact trimmed tracking without shipping purchase fields',
    (tester) async {
      final api = DetailUiTransport();
      await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      await tester.enterText(detailField('Carrier'), ' Synthetic carrier ');
      await tester.enterText(detailField('Tracking number'), ' SYN-001 ');
      await tester.tap(find.widgetWithText(FilledButton, 'Ship'));
      await tester.pumpAndSettle();
      final sent = api.commands.single;
      expect(sent.path, '/orders/${read.recordId}/fulfill');
      final body = asJsonMap(sent.options.body);
      expect(body['carrier'], 'Synthetic carrier');
      expect(body['tracking_number'], 'SYN-001');
      expect(body['create_shipping_label'], isFalse);
      expect(body.containsKey('package_weight_grams'), isFalse);
      expect(body.containsKey('logistics_provider'), isFalse);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'fulfillment reads confirmed runtime mode but never grants unavailable carrier booking',
    (tester) async {
      final api = DetailUiTransport();
      await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      expect(api.providerReads, isEmpty);
      await tester.tap(find.text('Buy shipping label'));
      await tester.pumpAndSettle();
      expect(api.providerReads, hasLength(1));
      expect(api.providerReads.single.storeId, read.site);
      expect(api.providerReads.single.query, {'store_id': read.site});
      expect(api.providerReads.single.expectedContextVersion, 0);
      expect(find.text('SANDBOX'), findsOneWidget);
      expect(
        find.textContaining('Carrier booking unavailable'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Buy label + ship'),
            )
            .onPressed,
        isNull,
      );
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a denied carrier-mode read stays unavailable and manual fulfillment remains usable',
    (tester) async {
      final api = DetailUiTransport()..providerFailure = 403;
      await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Buy shipping label'));
      await tester.pumpAndSettle();
      expect(find.text('Provider status unavailable'), findsOneWidget);
      expect(find.text('LIVE'), findsNothing);
      expect(find.text('SANDBOX'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Buy label + ship'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(find.text('Buy shipping label'));
      await tester.pumpAndSettle();
      expect(detailField('Carrier'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, 'Ship'))
            .onPressed,
        isNotNull,
      );
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'held provider mode cannot settle into a retired fulfillment form',
    (tester) async {
      final api = DetailUiTransport()..heldProvider = Completer<JsonMap>();
      final h = await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Buy shipping label'));
      await tester.pump();
      expect(api.providerReads, hasLength(1));
      h.scope.retire();
      await tester.pump();
      api.heldProvider!.complete({
        'provider_mode': 'live',
        'capabilities': {
          'provider_mode': 'live',
          'carrier_booking_available': true,
        },
      });
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(find.text('LIVE'), findsNothing);
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'explicit available label capability preserves original package defaults and two command sequence',
    (tester) async {
      final api = DetailUiTransport()
        ..providerResult = {
          'provider_mode': 'sandbox',
          'capabilities': {
            'provider_mode': 'sandbox',
            'manual': true,
            'carrier_booking_available': true,
          },
        };
      await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Buy shipping label'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Buy label + ship'));
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(2));
      expect(api.commands.first.path, '/shipping/labels');
      final label = asJsonMap(api.commands.first.options.body);
      expect(label['order_id'], read.recordId);
      expect(label['provider'], 'shiprocket');
      expect(label['package'], {
        'weight_grams': 500,
        'length_cm': 10.0,
        'width_cm': 10.0,
        'height_cm': 5.0,
      });
      expect(api.commands.last.path, '/orders/${read.recordId}/fulfill');
      final fulfill = asJsonMap(api.commands.last.options.body);
      expect(fulfill['carrier'], 'Synthetic carrier');
      expect(fulfill['tracking_number'], 'SYN-LABEL-001');
      expect(fulfill['create_shipping_label'], isFalse);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'older optional provider read cannot grant booking after a newer toggle read',
    (tester) async {
      final first = Completer<JsonMap>();
      final api = DetailUiTransport()..heldProvider = first;
      await mountDetail(tester, api);
      await tester.tap(find.text('Fulfill'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Buy shipping label'));
      await tester.pump();
      await tester.tap(find.text('Buy shipping label'));
      await tester.pumpAndSettle();
      api.heldProvider = null;
      await tester.tap(find.text('Buy shipping label'));
      await tester.pumpAndSettle();
      expect(api.providerReads, hasLength(2));
      expect(find.text('SANDBOX'), findsOneWidget);
      first.complete({
        'provider_mode': 'live',
        'capabilities': {
          'provider_mode': 'live',
          'carrier_booking_available': true,
        },
      });
      await tester.pumpAndSettle();
      expect(find.text('LIVE'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Buy label + ship'),
            )
            .onPressed,
        isNull,
      );
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'lost refund reply reopens original readonly intent and retries its same key',
    (tester) async {
      final api = DetailUiTransport()
        ..result = detailWithLines()
        ..loseRefundReply = true;
      await mountDetail(tester, api);
      await tester.tap(find.text('Refund'));
      await tester.pumpAndSettle();
      await tester.enterText(
        detailField('Return quantity: Synthetic item'),
        '1',
      );
      await tester.enterText(
        detailField('Reason'),
        ' Synthetic partial return ',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Request refund'));
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(1));
      expect(
        find.text(
          'Refund request saved. Payment completion is still required.',
        ),
        findsNothing,
      );
      final first = api.commands.single;
      await tester.tap(find.text('Refund'));
      await tester.pumpAndSettle();
      expect(find.text('Retry original request'), findsOneWidget);
      expect(
        tester
            .widget<TextFormField>(
              detailField('Return quantity: Synthetic item'),
            )
            .controller!
            .text,
        '1',
      );
      expect(
        tester.widget<TextFormField>(detailField('Reason')).controller!.text,
        'Synthetic partial return',
      );
      final qty = tester.widget<CustomTextField>(
        find.byWidgetPredicate(
          (w) =>
              w is CustomTextField &&
              w.label == 'Return quantity: Synthetic item',
        ),
      );
      expect(qty.enabled, isFalse);
      api.loseRefundReply = false;
      await tester.tap(
        find.widgetWithText(FilledButton, 'Retry original request'),
      );
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(2));
      expect(
        api.commands.last.options.idempotencyKey,
        first.options.idempotencyKey,
      );
      expect(api.commands.last.options.body, first.options.body);
      expect(asJsonMap(first.options.body)['lines'], [
        {'order_item_id': 'synthetic-line', 'quantity': 1},
      ]);
      expect(asJsonMap(first.options.body).containsKey('amount'), isFalse);
      expect(api.detailReads, hasLength(2));
      expect(tester.takeException(), isNull);
    },
  );
}
