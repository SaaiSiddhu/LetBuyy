// Synthetic transport through the unchanged SDK and CustomerService. These
// checks exercise presentation, not hosted/database acceptance.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/screens/customers/customer_profile_create_editor.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:provider/provider.dart';
import 'customer_create_presentation_test.dart' as create;

JsonMap listCustomer() => {
  'id': 'synthetic-list-profile',
  'store_id': create.site,
  'display_name':
      'Synthetic customer with a deliberately long full name and retained operational identity',
  'email': 'synthetic-long-profile@example.invalid',
  'status': 'active',
  'order_count': 17,
  'total_spent': 999999999.99,
};

class CustomerListTransport extends create.CreateTransport {
  List<JsonMap> rows = [listCustomer()];
  List<JsonMap> segments = [];
  Completer<List<JsonMap>>? heldSegments;
  final queries = <QueryParams?>[];
  int? listStatus;
  bool hasMore = false;
  final exportCalls = <String>[];
  Future<PaginatedResponse<JsonMap>> Function(ApiRequestOptions?)? pageReply;
  Future<JsonMap> Function(String)? exportReply;
  int? detailStatus;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    if (path.startsWith('/export/')) {
      exportCalls.add(path);
      expect(
        options?.query?.keys.toList() ?? [],
        path == '/export/customers' ? ['store_id'] : [],
      );
      return exportReply!(path);
    }
    if (detailStatus != null)
      throw ApiException(
        message: 'Synthetic denial',
        code: 'SYNTHETIC_DENIED',
        statusCode: detailStatus!,
      );
    return super.requestJson(path, options: options);
  }

  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    expect(
      path,
      anyOf('/customers', '/customers/segments/synthetic-segment/customers'),
    );
    queries.add(options?.query);
    if (pageReply != null) return pageReply!(options);
    if (listStatus != null)
      throw ApiException(
        message: 'Synthetic unavailable',
        statusCode: listStatus!,
        code: 'SYNTHETIC_READ_FAILURE',
      );
    return PaginatedResponse(
      data: rows,
      total: rows.length,
      page: options?.query?['page'] as int? ?? 1,
      limit: 30,
      hasMore: hasMore,
      nextCursor: hasMore ? 'synthetic-next' : null,
    );
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    expect(path, '/customers/segments');
    return decoder(
      heldSegments == null ? segments : await heldSegments!.future,
    );
  }
}

Future<
  ({
    create.CreateScope scope,
    CustomerService service,
    GlobalKey<NavigatorState> navigator,
  })
>
mountList(
  WidgetTester tester,
  CustomerListTransport api, {
  bool dark = false,
  double scale = 1,
  CacheService? cache,
}) async {
  final scope = create.CreateScope(api),
      service = CustomerService(api: api, cache: cache),
      navigator = GlobalKey<NavigatorState>();
  addTearDown(scope.dispose);
  addTearDown(service.dispose);
  addTearDown(api.close);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<CustomerService>.value(value: service),
      ],
      child: MaterialApp(
        navigatorKey: navigator,
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const CustomersScreen(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  return (scope: scope, service: service, navigator: navigator);
}

Finder verticalScroll() => find
    .byWidgetPredicate(
      (widget) =>
          widget is Scrollable &&
          (widget.axisDirection == AxisDirection.down ||
              widget.axisDirection == AxisDirection.up),
    )
    .first;
Future<void> reveal(WidgetTester tester, Finder target) async {
  await tester.scrollUntilVisible(
    target,
    180,
    scrollable: verticalScroll(),
    maxScrolls: 25,
  );
  await tester.pump();
}

void main() {
  testWidgets(
    'populated primary customers remain useful while optional segments are held',
    (tester) async {
      final api = CustomerListTransport(), held = Completer<List<JsonMap>>();
      api.heldSegments = held;
      try {
        await mountList(tester, api);
        expect(
          find.text(listCustomer()['display_name'] as String),
          findsOneWidget,
        );
        expect(api.queries, hasLength(1));
        expect(api.calls, isEmpty);
      } finally {
        if (!held.isCompleted) held.complete([]);
        await tester.pumpAndSettle();
      }
    },
  );
  for (final dark in [false, true])
    testWidgets(
      'Customer full identity and exact page spend wrap at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = CustomerListTransport();
        await mountList(tester, api, dark: dark, scale: 2.4);
        await tester.pumpAndSettle();
        final name = find.text(listCustomer()['display_name'] as String);
        await reveal(tester, name);
        final paragraph = tester.renderObject<RenderParagraph>(name);
        expect(paragraph.didExceedMaxLines, isFalse);
        final amount = find.text('INR 99,99,99,999.99').last;
        await reveal(tester, amount);
        expect(
          tester.renderObject<RenderParagraph>(amount).didExceedMaxLines,
          isFalse,
        );
        expect(tester.takeException(), isNull);
        expect(api.calls, isEmpty);
      },
    );
  testWidgets(
    'missing raw customer spend and order count are unavailable rather than model defaults',
    (tester) async {
      final api = CustomerListTransport();
      final row = listCustomer()
        ..remove('total_spent')
        ..remove('order_count')
        ..remove('status');
      api.rows = [row];
      await mountList(tester, api);
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Spend unavailable'));
      expect(find.text('Spend unavailable'), findsOneWidget);
      expect(find.text('Order count unavailable'), findsOneWidget);
      expect(find.text('Status unavailable'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'query changes retire old rows and late prior search cannot relabel the new population',
    (tester) async {
      final api = CustomerListTransport(),
          held = Completer<PaginatedResponse<JsonMap>>();
      await mountList(tester, api);
      await tester.pumpAndSettle();
      api.pageReply = (options) async =>
          options?.query?['search'] == 'older private query'
          ? held.future
          : PaginatedResponse(
              data: [
                listCustomer()..['display_name'] = 'New matching customer',
              ],
              total: 1,
              page: 1,
              limit: 30,
              hasMore: false,
            );
      try {
        await tester.enterText(find.byType(TextField), 'older private query');
        await tester.pump(const Duration(milliseconds: 350));
        expect(
          find.text(listCustomer()['display_name'] as String),
          findsNothing,
        );
        expect(find.text('Loading customers…'), findsOneWidget);
        await tester.enterText(find.byType(TextField), 'new current query');
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pumpAndSettle();
        await reveal(tester, find.text('New matching customer'));
        expect(find.text('New matching customer'), findsOneWidget);
        held.complete(
          PaginatedResponse(
            data: [
              listCustomer()..['display_name'] = 'Retired old query customer',
            ],
            total: 1,
            page: 1,
            limit: 30,
            hasMore: false,
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Retired old query customer'), findsNothing);
        expect(find.text('New matching customer'), findsOneWidget);
        expect(api.queries.last?['search'], 'new current query');
        expect(api.calls, isEmpty);
      } finally {
        if (!held.isCompleted)
          held.complete(
            PaginatedResponse(
              data: [],
              total: 0,
              page: 1,
              limit: 30,
              hasMore: false,
            ),
          );
      }
    },
  );
  testWidgets(
    'same-query refresh retains labelled rows while a new cursor page retires them',
    (tester) async {
      final api = CustomerListTransport()..hasMore = true;
      await mountList(tester, api);
      await tester.pumpAndSettle();
      var held = Completer<PaginatedResponse<JsonMap>>();
      api.pageReply = (_) => held.future;
      await tester.tap(find.byTooltip('Refresh customers'));
      await tester.pump();
      await reveal(tester, find.text(listCustomer()['display_name'] as String));
      expect(
        find.text(listCustomer()['display_name'] as String),
        findsOneWidget,
      );
      expect(
        find.text(
          'Refreshing the same page. Previously loaded information is shown below.',
        ),
        findsOneWidget,
      );
      held.complete(
        PaginatedResponse(
          data: [listCustomer()],
          total: 2,
          page: 1,
          limit: 30,
          hasMore: true,
          nextCursor: 'next-exact',
        ),
      );
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Next'));
      final next = tester
          .widget<TextButton>(find.widgetWithText(TextButton, 'Next'))
          .onPressed!;
      held = Completer<PaginatedResponse<JsonMap>>();
      await tester.tap(find.text('Next'));
      await tester.pump();
      next();
      expect(api.queries.last?['cursor'], 'next-exact');
      expect(api.queries.last?['page'], 2);
      expect(api.queries, hasLength(3));
      expect(find.text(listCustomer()['display_name'] as String), findsNothing);
      held.complete(
        PaginatedResponse(
          data: [listCustomer()..['display_name'] = 'Next page customer'],
          total: 2,
          page: 2,
          limit: 30,
          hasMore: false,
        ),
      );
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Next page customer'));
      expect(find.text('Next page customer'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'observed current denial removes private query and rows and fences captured actions until a fresh primary read',
    (tester) async {
      final api = CustomerListTransport();
      final mounted = await mountList(tester, api);
      await tester.pumpAndSettle();
      final createAction = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Add customer'),
          )
          .onPressed!;
      await tester.enterText(
        find.byType(TextField),
        'private synthetic search',
      );
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      api.detailStatus = 403;
      await expectLater(
        mounted.service.fetchCustomerByEmail(
          'denied@example.invalid',
          storeId: create.site,
        ),
        throwsA(isA<ApiException>()),
      );
      await tester.pumpAndSettle();
      expect(find.text(listCustomer()['display_name'] as String), findsNothing);
      expect(find.text('private synthetic search'), findsNothing);
      expect(find.byType(EditableText), findsNothing);
      expect(find.text('Customer access unavailable'), findsOneWidget);
      createAction();
      await tester.pumpAndSettle();
      expect(find.byType(CustomerProfileCreateEditor), findsNothing);
      expect(api.calls, isEmpty);
      await tester.tap(find.byTooltip('Refresh customers'));
      await tester.pumpAndSettle();
      await reveal(tester, find.text(listCustomer()['display_name'] as String));
      expect(
        find.text(listCustomer()['display_name'] as String),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'stored offline rows remain labelled and cannot authorize creation',
    (tester) async {
      final api = CustomerListTransport();
      await mountList(
        tester,
        api,
        cache: CacheService.memory(actorIdProvider: () => 'synthetic-actor'),
      );
      await tester.pumpAndSettle();
      api.listStatus = 503;
      await tester.tap(find.byTooltip('Refresh customers'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Saved offline snapshot. Reconnect and refresh before making changes.',
        ),
        findsOneWidget,
      );
      await reveal(tester, find.text(listCustomer()['display_name'] as String));
      expect(
        find.text(listCustomer()['display_name'] as String),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Add customer'),
            )
            .onPressed,
        isNull,
      );
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'queued export retains the exact job for explicit recheck instead of creating another',
    (tester) async {
      final api = CustomerListTransport();
      api.exportReply = (path) async => {
        'job': {
          'id': 'synthetic-export-id',
          'type': 'customers',
          'status': 'queued',
        },
      };
      await mountList(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Export customers'));
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 400));
      }
      await tester.pumpAndSettle();
      expect(
        api.exportCalls.where((path) => path == '/export/customers'),
        hasLength(1),
      );
      expect(find.text('Export status: queued'), findsOneWidget);
      expect(
        find.text(
          'Exports all supported customers in this store. Search, segment, and page controls do not limit the CSV.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Recheck same export'));
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 400));
      }
      await tester.pumpAndSettle();
      expect(
        api.exportCalls.where((path) => path == '/export/customers'),
        hasLength(1),
      );
      expect(
        api.exportCalls
            .skip(1)
            .every((path) => path == '/export/jobs/synthetic-export-id'),
        isTrue,
      );
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'lost export start remains uncertain and never starts another job from captured callbacks',
    (tester) async {
      final api = CustomerListTransport();
      api.exportReply = (_) async => throw const ApiException(
        message: 'Synthetic lost reply',
        code: 'SYNTHETIC_LOST_REPLY',
        statusCode: 503,
      );
      await mountList(tester, api);
      await tester.pumpAndSettle();
      final export = tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Export customers'),
          )
          .onPressed!;
      await tester.tap(find.text('Export customers'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('The export start was not confirmed.'),
        findsOneWidget,
      );
      export();
      await tester.pumpAndSettle();
      expect(api.exportCalls, ['/export/customers']);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Export customers'),
            )
            .onPressed,
        isNull,
      );
    },
  );
  test(
    'held primary page cannot restore rows or replace stored bytes after newer same-store denial',
    () async {
      final api = CustomerListTransport(),
          cache = CacheService.memory(actorIdProvider: () => 'synthetic-actor');
      final service = CustomerService(api: api, cache: cache),
          held = Completer<PaginatedResponse<JsonMap>>();
      try {
        final current = await service.fetchCustomers(create.site);
        expect(service.hasFreshCustomerPage(current), isTrue);
        final key = CacheService.customersKey(create.site, page: 1, limit: 30),
            stored = cache.readJsonList(
              CacheService.customersKey(create.site, page: 1, limit: 30),
            );
        api.pageReply = (_) => held.future;
        final late = service.fetchCustomers(create.site);
        final lateResult = expectLater(late, throwsA(isA<ApiException>()));
        api.detailStatus = 403;
        await expectLater(
          service.fetchCustomerByEmail(
            'a@example.invalid',
            storeId: create.site,
          ),
          throwsA(isA<ApiException>()),
        );
        held.complete(
          PaginatedResponse(
            data: [listCustomer()..['display_name'] = 'Retired late row'],
            total: 1,
            page: 1,
            limit: 30,
            hasMore: false,
          ),
        );
        await lateResult;
        expect(service.hasDeniedRead(create.site), isTrue);
        expect(service.customers, isEmpty);
        expect(service.acceptsCustomerPage(current), isFalse);
        expect(cache.readJsonList(key), stored);
      } finally {
        if (!held.isCompleted)
          held.complete(
            PaginatedResponse(
              data: [],
              total: 0,
              page: 1,
              limit: 30,
              hasMore: false,
            ),
          );
        service.dispose();
        api.close();
      }
    },
  );
  testWidgets(
    'full segment name and authoritative count remain readable at320dp scale2.4',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      const name =
          'Synthetic customer segment with a deliberately long complete operational label';
      final api = CustomerListTransport()
        ..segments = [
          {
            'id': 'synthetic-segment',
            'store_id': create.site,
            'name': name,
            'customer_count': 71,
            'rules': {},
          },
        ];
      await mountList(tester, api, scale: 2.4);
      await tester.pumpAndSettle();
      await reveal(tester, find.text('$name (71)'));
      expect(
        tester
            .renderObject<RenderParagraph>(find.text('$name (71)'))
            .didExceedMaxLines,
        isFalse,
      );
      final bounds = tester.getRect(find.text('$name (71)'));
      expect(bounds.left, greaterThanOrEqualTo(0));
      expect(bounds.right, lessThanOrEqualTo(320));
      expect(tester.takeException(), isNull);
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'segment page-local search keeps the loaded page identity without another server request',
    (tester) async {
      final api = CustomerListTransport()
        ..hasMore = true
        ..segments = [
          {
            'id': 'synthetic-segment',
            'store_id': create.site,
            'name': 'Synthetic segment',
            'customer_count': 71,
            'rules': {},
          },
        ];
      await mountList(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Synthetic segment (71)'));
      await tester.pumpAndSettle();
      await reveal(tester, find.text('Next'));
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(api.queries.last?['page'], 2);
      final reads = api.queries.length;
      await tester.ensureVisible(find.byType(TextField));
      await tester.enterText(
        find.byType(TextField),
        'no match on this loaded page',
      );
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(api.queries, hasLength(reads));
      expect(find.text('Loaded page 2'), findsOneWidget);
      expect(find.text('Page 2'), findsOneWidget);
      expect(find.text('No matching customers'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );

  testWidgets(
    'retired owner action and input callbacks cannot adopt a newly loaded owner view',
    (tester) async {
      final actual = CustomerListTransport();
      final mounted = await mountList(tester, actual);
      await tester.pumpAndSettle();
      final oldCreate = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Add customer'),
          )
          .onPressed!;
      final oldSearch = tester
          .widget<TextField>(find.byType(TextField))
          .onChanged!;
      mounted.scope.retire();
      await tester.pumpAndSettle();
      final reads = actual.queries.length;
      oldCreate();
      oldSearch('Retired private query');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(find.byType(CustomerProfileCreateEditor), findsNothing);
      expect(find.text('Retired private query'), findsNothing);
      expect(actual.queries, hasLength(reads));
      expect(actual.calls, isEmpty);
    },
  );
  testWidgets(
    'observed denial also retires an open Customer create draft and captured save after later reconfirmation',
    (tester) async {
      final api = CustomerListTransport();
      await create.mount(tester, api);
      await create.enter(
        tester,
        'customer-name-field',
        'Private synthetic draft',
      );
      await create.enter(
        tester,
        'customer-email-field',
        'private-draft@example.invalid',
      );
      final save = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Save customer'),
          )
          .onPressed!;
      final service = tester
          .element(find.byType(CustomerProfileCreateEditor))
          .read<CustomerService>();
      api.detailStatus = 403;
      await expectLater(
        service.fetchCustomerByEmail(
          'denied@example.invalid',
          storeId: create.site,
        ),
        throwsA(isA<ApiException>()),
      );
      await tester.pumpAndSettle();
      expect(find.byType(EditableText), findsNothing);
      expect(find.text('Private synthetic draft'), findsNothing);
      await service.fetchCustomers(create.site);
      await tester.pumpAndSettle();
      save();
      await tester.pumpAndSettle();
      expect(find.byType(EditableText), findsNothing);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets(
    'observed denial retires an open segment draft and its captured command callback',
    (tester) async {
      final actual = CustomerListTransport();
      final mounted = await mountList(tester, actual);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create segment'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextFormField).first,
        'Private synthetic segment draft',
      );
      await tester.pump();
      final save = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Save segment'),
          )
          .onPressed!;
      actual.detailStatus = 403;
      await expectLater(
        mounted.service.fetchCustomerByEmail(
          'denied@example.invalid',
          storeId: create.site,
        ),
        throwsA(isA<ApiException>()),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private synthetic segment draft'), findsNothing);
      expect(find.byType(EditableText), findsNothing);
      await mounted.service.fetchCustomers(create.site);
      await tester.pumpAndSettle();
      save();
      await tester.pumpAndSettle();
      expect(find.byType(EditableText), findsNothing);
      expect(actual.calls, isEmpty);
    },
  );
  testWidgets(
    'a confirmed failed export needs explicit new intent and stale restart callbacks cannot replace another job',
    (tester) async {
      final api = CustomerListTransport();
      var starts = 0;
      api.exportReply = (path) async {
        if (path == '/export/customers') starts++;
        return {
          'job': {
            'id': 'synthetic-export-$starts',
            'type': 'customers',
            'status': starts == 1 ? 'failed' : 'queued',
          },
        };
      };
      await mountList(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Export customers'));
      await tester.pumpAndSettle();
      expect(starts, 1);
      final restart = tester
          .widget<TextButton>(
            find.widgetWithText(TextButton, 'Start another export'),
          )
          .onPressed!;
      await tester.tap(find.text('Start another export'));
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 400));
      }
      await tester.pumpAndSettle();
      expect(starts, 2);
      restart();
      await tester.pumpAndSettle();
      expect(starts, 2);
      expect(find.text('Export status: queued'), findsOneWidget);
    },
  );
  testWidgets(
    'denial during a pending create stays unconfirmed and rechecks the parent after access reconfirmation',
    (tester) async {
      final api = CustomerListTransport(), held = Completer<JsonMap>();
      final mounted = await mountList(tester, api);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add customer'));
      await tester.pumpAndSettle();
      await create.enter(
        tester,
        'customer-name-field',
        'Pending private draft',
      );
      await create.enter(
        tester,
        'customer-email-field',
        'pending-draft@example.invalid',
      );
      api.reply = (_) => held.future;
      try {
        await tester.tap(find.text('Save customer'));
        await tester.pump();
        expect(api.calls, hasLength(1));
        api.detailStatus = 403;
        await expectLater(
          mounted.service.fetchCustomerByEmail(
            'denied@example.invalid',
            storeId: create.site,
          ),
          throwsA(isA<ApiException>()),
        );
        await tester.pumpAndSettle();
        expect(find.byType(EditableText), findsNothing);
        expect(
          find.textContaining('Closing does not cancel server work.'),
          findsOneWidget,
        );
        await mounted.service.fetchCustomers(create.site);
        held.complete({
          'id': 'synthetic-created-id',
          'store_id': create.site,
          'email': 'pending-draft@example.invalid',
          'display_name': 'Pending private draft',
        });
        await tester.pumpAndSettle();
        final beforeClose = api.queries.length;
        await tester.tap(find.text('Close editor'));
        await tester.pumpAndSettle();
        expect(api.queries, hasLength(beforeClose + 1));
        expect(api.calls, hasLength(1));
        expect(find.text('Customer added.'), findsNothing);
        expect(find.text('Pending private draft'), findsNothing);
      } finally {
        if (!held.isCompleted)
          held.complete({
            'id': 'synthetic-created-id',
            'store_id': create.site,
            'email': 'pending-draft@example.invalid',
          });
      }
    },
  );
}
