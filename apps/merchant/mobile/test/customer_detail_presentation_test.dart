// Applied after source2/native26/iOS11 were terminal and reconciled.
// Real client owners/SDK with synthetic transport: no hosted permission proof.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/customers/customer_detail_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/order_service.dart';
import 'package:letbuyy_store/services/whatsapp_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:provider/provider.dart';
import 'customer_create_presentation_test.dart' as create;

JsonMap detailProfile() => {
  'id': 'synthetic-profile-id',
  'store_id': create.site,
  'email': 'detail@example.invalid',
  'display_name':
      'Synthetic customer with a deliberately long full operational name',
  'phone': '9000000098',
  'status': 'active',
  'order_count': 17,
  'total_spent': 999999999.99,
  'tags': ['synthetic'],
};

class DetailTransport extends create.CreateTransport {
  JsonMap row = detailProfile();
  Completer<List<JsonMap>>? heldAddresses;
  int? addressStatus, orderStatus, profileStatus;
  final reads = <String>[];
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    reads.add(path);
    if ((options?.method ?? HttpMethod.get) != HttpMethod.get)
      calls.add(options!);
    expect(options?.method ?? HttpMethod.get, HttpMethod.get);
    expect(path, '/customers/detail%40example.invalid');
    if (profileStatus != null)
      throw ApiException(
        message: 'Synthetic profile unavailable',
        statusCode: profileStatus!,
        code: 'SYNTHETIC_UNAVAILABLE',
      );
    return row;
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    reads.add(path);
    expect(options?.query?['store_id'], create.site);
    if (path.endsWith('/addresses')) {
      if (addressStatus != null)
        throw ApiException(
          message: 'Synthetic addresses unavailable',
          statusCode: addressStatus!,
          code: 'SYNTHETIC_UNAVAILABLE',
        );
      return decoder(heldAddresses == null ? [] : await heldAddresses!.future);
    }
    expect(path, '/customers/detail%40example.invalid/notes');
    return decoder([]);
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    reads.add(path);
    expect(path, '/orders');
    expect(options?.query?['customer_email'], 'detail@example.invalid');
    expect(options?.query?['limit'], 10);
    if (orderStatus != null)
      throw ApiException(
        message: 'Synthetic orders unavailable',
        statusCode: orderStatus!,
        code: 'SYNTHETIC_UNAVAILABLE',
      );
    return const PaginatedResponse(
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      hasMore: false,
    );
  }
}

Future<void> mountDetail(
  WidgetTester tester,
  DetailTransport api, {
  bool dark = false,
  double scale = 1,
  CacheService? cache,
  WhatsAppService? whatsApp,
}) async {
  final stores = create.CreateScope(api),
      service = CustomerService(api: api, cache: cache),
      orders = OrderService(api: api);
  addTearDown(stores.dispose);
  addTearDown(service.dispose);
  addTearDown(orders.dispose);
  addTearDown(api.close);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: stores),
        ChangeNotifierProvider<CustomerService>.value(value: service),
        ChangeNotifierProvider<OrderService>.value(value: orders),
        if (whatsApp != null)
          ChangeNotifierProvider<WhatsAppService>.value(value: whatsApp),
      ],
      child: MaterialApp(
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const CustomerDetailScreen(email: 'detail@example.invalid'),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

Future<void> revealDetail(WidgetTester tester, Finder target) async {
  await tester.scrollUntilVisible(
    target,
    180,
    scrollable: find
        .byWidgetPredicate(
          (w) =>
              w is Scrollable &&
              (w.axisDirection == AxisDirection.down ||
                  w.axisDirection == AxisDirection.up),
        )
        .first,
    maxScrolls: 30,
  );
  await tester.pump();
}

void main() {
  testWidgets(
    'primary Customer profile remains visible while optional addresses are held',
    (tester) async {
      final api = DetailTransport(), held = Completer<List<JsonMap>>();
      api.heldAddresses = held;
      try {
        await mountDetail(tester, api);
        expect(
          find.text(detailProfile()['display_name'] as String),
          findsWidgets,
        );
        expect(api.calls, isEmpty);
      } finally {
        if (!held.isCompleted) held.complete([]);
        await tester.pumpAndSettle();
      }
    },
  );
  testWidgets(
    'optional address failure preserves the primary profile with a truthful local recovery state',
    (tester) async {
      final api = DetailTransport()..addressStatus = 503;
      await mountDetail(tester, api);
      await tester.pumpAndSettle();
      expect(
        find.text(detailProfile()['display_name'] as String),
        findsWidgets,
      );
      await revealDetail(tester, find.text('Addresses unavailable'));
      expect(find.text('Addresses unavailable'), findsOneWidget);
      expect(find.text('Customer unavailable'), findsNothing);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'failed recent-order read is unavailable instead of a successful empty history',
    (tester) async {
      final api = DetailTransport()..orderStatus = 503;
      await mountDetail(tester, api);
      await tester.pumpAndSettle();
      await revealDetail(tester, find.text('Recent orders'));
      expect(find.text('Recent orders unavailable'), findsOneWidget);
      expect(
        find.text('No recent orders returned for this customer.'),
        findsNothing,
      );
      expect(api.calls, isEmpty);
    },
  );
  for (final dark in [false, true])
    testWidgets(
      'Customer Detail wraps full identity and exact amount at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = DetailTransport();
        await mountDetail(tester, api, dark: dark, scale: 2.4);
        await tester.pumpAndSettle();
        final name = find.text(detailProfile()['display_name'] as String).last;
        await revealDetail(tester, name);
        expect(
          tester.renderObject<RenderParagraph>(name).didExceedMaxLines,
          isFalse,
        );
        final amount = find.text('INR 99,99,99,999.99');
        await revealDetail(tester, amount);
        expect(
          tester.renderObject<RenderParagraph>(amount).didExceedMaxLines,
          isFalse,
        );
        expect(tester.takeException(), isNull);
        expect(api.calls, isEmpty);
      },
    );
  testWidgets(
    'stored profile is labelled and captured prior edit cannot grant a write',
    (tester) async {
      final api = DetailTransport();
      await mountDetail(
        tester,
        api,
        cache: CacheService.memory(actorIdProvider: () => 'synthetic-actor'),
      );
      await tester.pumpAndSettle();
      final edit = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Edit customer'),
          )
          .onPressed!;
      api.profileStatus = 503;
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pumpAndSettle();
      expect(
        find.text('Saved customer snapshot. Refresh before making changes.'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Edit customer'),
            )
            .onPressed,
        isNull,
      );
      edit();
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.byType(EditableText), findsNothing);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'an independent recent Orders denial leaves current Customer read and edit authority separate',
    (tester) async {
      final api = DetailTransport()..orderStatus = 403;
      await mountDetail(tester, api);
      await tester.pumpAndSettle();
      expect(find.text('Customer unavailable'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Edit customer'),
            )
            .onPressed,
        isNotNull,
      );
      await revealDetail(tester, find.text('Recent orders'));
      expect(find.text('Recent orders unavailable'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'an API-context replacement retires the existing Detail instead of adopting new profile data',
    (tester) async {
      final api = DetailTransport();
      await mountDetail(tester, api);
      await tester.pumpAndSettle();
      final service = tester
          .element(find.byType(CustomerDetailScreen))
          .read<CustomerService>();
      final edit = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Edit customer'),
          )
          .onPressed!;
      api.epoch++;
      await service.fetchCustomerByEmail(
        'detail@example.invalid',
        storeId: create.site,
      );
      await tester.pumpAndSettle();
      edit();
      await tester.pumpAndSettle();
      expect(
        find.text(detailProfile()['display_name'] as String),
        findsNothing,
      );
      expect(find.byType(EditableText), findsNothing);
      expect(
        find.text(
          'Store access changed. Reopen the customer from the selected store.',
        ),
        findsOneWidget,
      );
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'missing Detail metrics and status remain unavailable rather than model defaults',
    (tester) async {
      final api = DetailTransport()
        ..row = (detailProfile()
          ..remove('total_spent')
          ..remove('order_count')
          ..remove('status'));
      await mountDetail(tester, api);
      await tester.pumpAndSettle();
      await revealDetail(tester, find.text('Spend unavailable'));
      expect(find.text('Spend unavailable'), findsOneWidget);
      expect(find.text('Order count unavailable'), findsOneWidget);
      expect(find.text('Status unavailable'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );
}
