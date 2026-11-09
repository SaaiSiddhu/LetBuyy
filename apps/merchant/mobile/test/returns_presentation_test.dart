// Actual Flutter screen, ReturnService and shared SDK; synthetic transport only.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/orders/returns_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/return_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/services/two_factor_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'orders_read_presentation_test.dart' as orders;
import 'returns_read_presentation_test.dart' as read;
import 'support/loyalty_fixture.dart' show MemoryStorage;

class ReturnsUiTransport extends read.ReturnsReadTransport {
  final commands = <({String path, ApiRequestOptions options})>[];
  JsonMap row = read.returnRow();
  bool loseCreateReply = false;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    commands.add((path: path, options: options!));
    if (loseCreateReply) throw orders.failure(503);
    return row;
  }
}

class ReturnScope extends StoreContext {
  ReturnScope(this.api) : super(storeService: StoreService(api: api));
  final ReturnsUiTransport api;
  int epoch = 0;
  @override
  Object get requestContextKey => epoch;
  @override
  String get selectedStoreId => orders.site;
  @override
  StoreModel get selectedStore => StoreModel.fromJson({
    'id': orders.site,
    'seller_id': 'synthetic-actor',
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

class HeldReturnCompletion extends ReturnService {
  HeldReturnCompletion({required super.api});
  final held = Completer<JsonMap?>();
  int preparations = 0;
  @override
  Future<JsonMap?> pendingRefundCompletion(
    String id,
    MerchantSecurityContext c,
  ) {
    preparations++;
    return held.future;
  }
}

class ReturnNavigationObserver extends NavigatorObserver {
  int pops = 0;
  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pops++;
  }
}

Finder field(String label) => find.descendant(
  of: find.byWidgetPredicate((w) => w is CustomTextField && w.label == label),
  matching: find.byType(TextFormField),
);
Future<({ReturnScope scope, ReturnService service})> mountReturns(
  WidgetTester tester,
  ReturnsUiTransport api, {
  bool settle = true,
  double scale = 1,
  bool dark = false,
  ReturnService? service,
  NavigatorObserver? observer,
}) async {
  final scope = ReturnScope(api),
      reader =
          service ??
          ReturnService(
            api: api,
            securityCommands: SecurityCommandStore(storage: MemoryStorage()),
          );
  final security = TwoFactorService(
    api: api,
    actorIdProvider: () => 'synthetic-actor',
    storeIdProvider: () => orders.site,
    storage: MemoryStorage(),
  );
  addTearDown(api.close);
  addTearDown(scope.dispose);
  addTearDown(reader.dispose);
  addTearDown(security.dispose);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: api),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
        ChangeNotifierProvider<ReturnService>.value(value: reader),
        ChangeNotifierProvider<TwoFactorService>.value(value: security),
      ],
      child: MaterialApp(
        navigatorObservers: [if (observer != null) observer],
        theme: dark ? StoreTheme.dark() : StoreTheme.light(),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const ReturnsScreen(),
      ),
    ),
  );
  if (settle)
    await tester.pumpAndSettle();
  else
    await tester.pump();
  return (scope: scope, service: reader);
}

void main() {
  testWidgets(
    'native25 missing order validation is announced once at its field',
    (tester) async {
      final api = ReturnsUiTransport();
      await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create'));
      await tester.pumpAndSettle();
      expect(find.text('Enter the existing order ID.'), findsOneWidget);
      expect(api.commands, isEmpty);
    },
  );
  testWidgets(
    'native25 corrected order input retires the obsolete required error without submitting',
    (tester) async {
      final api = ReturnsUiTransport();
      await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Create'));
      await tester.pumpAndSettle();
      await tester.enterText(
        field('Order ID'),
        read.returnRow()['order_id'] as String,
      );
      await tester.pump();
      expect(find.text('Enter the existing order ID.'), findsNothing);
      expect(
        tester.widget<TextFormField>(field('Order ID')).controller!.text,
        read.returnRow()['order_id'] as String,
      );
      expect(api.commands, isEmpty);
    },
  );

  testWidgets(
    'initial Returns pending state is visible in the shell before rows arrive',
    (tester) async {
      final api = ReturnsUiTransport(),
          held = Completer<PaginatedResponse<JsonMap>>();
      api.reply = (_) => held.future;
      await mountReturns(tester, api, settle: false);
      expect(find.byType(LoadingIndicator), findsOneWidget);
      expect(find.text('No returns yet'), findsNothing);
      held.complete(read.returnPage());
      await tester.pumpAndSettle();
      expect(find.text('SYNTHETIC-RMA'), findsOneWidget);
      expect(find.byType(LoadingIndicator), findsNothing);
    },
  );
  testWidgets(
    'exact server count exposes next page even when a short page has hasMore false',
    (tester) async {
      final api = ReturnsUiTransport();
      api.reply = (o) async => read.returnPage(
        page: o.query!['page'] as int,
        total: 21,
        row: {
          ...read.returnRow(),
          'order_number': 'RMA-PAGE-${o.query!['page']}',
        },
      );
      await mountReturns(tester, api);
      expect(find.text('21 matching returns'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('Next page'),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Next page'),
            )
            .onPressed,
        isNotNull,
      );
      final held = Completer<PaginatedResponse<JsonMap>>();
      api.reply = (_) => held.future;
      await tester.tap(find.text('Next page'));
      await tester.pump();
      expect(find.text('RMA-PAGE-1'), findsNothing);
      expect(find.text('21 matching returns'), findsNothing);
      expect(api.reads.last.query!['page'], 2);
      held.complete(
        read.returnPage(
          page: 2,
          total: 21,
          row: {...read.returnRow(), 'order_number': 'RMA-PAGE-2'},
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('RMA-PAGE-2'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Next page'),
            )
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
  for (final raw in [null, 0]) {
    testWidgets(
      'Returns raw amount $raw preserves unavailable versus confirmed zero',
      (tester) async {
        final api = ReturnsUiTransport()
          ..reply = (_) async =>
              read.returnPage(row: {...read.returnRow(), 'refund_amount': raw});
        await mountReturns(tester, api);
        await tester.scrollUntilVisible(
          find.text(raw == null ? 'Refund amount unavailable' : '₹0.00'),
          120,
          scrollable: find.byType(Scrollable).first,
        );
        expect(
          find.text(raw == null ? 'Refund amount unavailable' : '₹0.00'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'current Returns denial removes populated rows and status commands',
    (tester) async {
      final api = ReturnsUiTransport();
      await mountReturns(tester, api);
      expect(find.text('SYNTHETIC-RMA'), findsOneWidget);
      api.reply = (_) async => throw orders.failure(403);
      await tester.tap(find.byTooltip('Refresh returns'));
      await tester.pumpAndSettle();
      expect(find.text('SYNTHETIC-RMA'), findsNothing);
      expect(find.text('Received'), findsNothing);
      expect(find.text('Current read unconfirmed'), findsOneWidget);
      expect(find.text('No returns yet'), findsNothing);
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'create return is a full page with dirty Back, explicit validation and original defaults',
    (tester) async {
      final api = ReturnsUiTransport();
      await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      await tester.tap(find.widgetWithText(FilledButton, 'Create'));
      await tester.pump();
      expect(find.text('Enter the existing order ID.'), findsWidgets);
      expect(api.commands, isEmpty);
      await tester.enterText(field('Order ID'), ' ${orders.recordId} ');
      await tester.enterText(field('Reason'), ' Synthetic reason ');
      await tester.pump();
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Cancel').last);
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field('Reason')).controller!.text,
        ' Synthetic reason ',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Create'));
      await tester.pumpAndSettle();
      final sent = api.commands.single;
      expect(sent.path, '/returns');
      final body = asJsonMap(sent.options.body);
      expect(body['order_id'], orders.recordId);
      expect(body['reason'], 'Synthetic reason');
      expect(body['restock'], isTrue);
      expect(body['refund_method'], 'original_payment');
      expect(body['idempotency_key'], sent.options.idempotencyKey);
      expect(body.containsKey('amount'), isFalse);
      expect(api.reads, hasLength(2));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'uncertain create reopens immutable original fields and retries the same key',
    (tester) async {
      final api = ReturnsUiTransport()..loseCreateReply = true;
      await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Order ID'), orders.recordId);
      await tester.enterText(field('Reason'), 'Original synthetic reason');
      await tester.tap(find.widgetWithText(FilledButton, 'Create'));
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(1));
      final first = api.commands.single;
      expect(
        find.textContaining('could not be confirmed. Reopen'),
        findsOneWidget,
      );
      await tester.tap(find.text('Retry original return'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field('Reason')).controller!.text,
        'Original synthetic reason',
      );
      expect(
        tester
            .widget<CustomTextField>(
              find.byWidgetPredicate(
                (w) => w is CustomTextField && w.label == 'Order ID',
              ),
            )
            .enabled,
        isFalse,
      );
      api.loseCreateReply = false;
      await tester.tap(
        find.widgetWithText(FilledButton, 'Retry original request'),
      );
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(2));
      expect(api.commands.last.options.body, first.options.body);
      expect(
        api.commands.last.options.idempotencyKey,
        first.options.idempotencyKey,
      );
      expect(find.text('Retry original return'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'retired Returns editor withholds private fields and cannot dispatch a captured submit',
    (tester) async {
      final api = ReturnsUiTransport(), h = await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Order ID'), orders.recordId);
      await tester.enterText(field('Reason'), 'Private synthetic draft');
      final submit = tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Create'))
          .onPressed!;
      h.scope.retire();
      await tester.pumpAndSettle();
      submit();
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(field('Reason'), findsNothing);
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a current service denial retires an already open Returns editor without a store switch',
    (tester) async {
      final api = ReturnsUiTransport(), h = await mountReturns(tester, api);
      expect(find.text('SYNTHETIC-RMA'), findsOneWidget);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Order ID'), orders.recordId);
      await tester.enterText(
        field('Reason'),
        'Private synthetic retained input',
      );
      final submit = tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Create'))
          .onPressed!;
      api.reply = (_) async => throw orders.failure(403);
      await expectLater(
        h.service.fetchReturns(orders.site),
        throwsA(isA<ApiException>()),
      );
      await tester.pumpAndSettle();
      submit();
      await tester.pumpAndSettle();
      expect(field('Reason'), findsNothing);
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'latest current denial withholds an uncertain original attempt and cannot be cleared by an outage',
    (tester) async {
      final api = ReturnsUiTransport()..loseCreateReply = true;
      final h = await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Order ID'), orders.recordId);
      await tester.enterText(
        field('Reason'),
        'Private synthetic original attempt',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Create'));
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(1));
      final original = api.commands.single;
      final retry = tester
          .widget<ButtonStyleButton>(
            find
                .ancestor(
                  of: find.text('Retry original return'),
                  matching: find.byWidgetPredicate(
                    (w) => w is ButtonStyleButton,
                  ),
                )
                .first,
          )
          .onPressed!;
      api.reply = (_) async => throw orders.failure(403);
      await expectLater(
        h.service.fetchReturns(orders.site),
        throwsA(isA<ApiException>()),
      );
      api.reply = (_) async => throw orders.failure(503);
      await expectLater(
        h.service.fetchReturns(orders.site),
        throwsA(isA<ApiException>()),
      );
      await tester.pumpAndSettle();
      retry();
      await tester.pumpAndSettle();
      expect(find.text('SYNTHETIC-RMA'), findsNothing);
      expect(field('Order ID'), findsNothing);
      expect(api.commands, hasLength(1));
      expect(h.service.hasDeniedRead(orders.site), isTrue);
      api.reply = (_) async => read.returnPage();
      await tester.tap(find.byTooltip('Refresh returns'));
      await tester.pumpAndSettle();
      expect(h.service.hasDeniedRead(orders.site), isFalse);
      await tester.tap(find.text('Retry original return'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field('Reason')).controller!.text,
        'Private synthetic original attempt',
      );
      api.loseCreateReply = false;
      await tester.tap(
        find.widgetWithText(FilledButton, 'Retry original request'),
      );
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(2));
      expect(
        api.commands.last.options.idempotencyKey,
        original.options.idempotencyKey,
      );
      expect(api.commands.last.options.body, original.options.body);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'another reader invalidates page freshness without relabelling this workspace or granting its stale action',
    (tester) async {
      final api = ReturnsUiTransport(), h = await mountReturns(tester, api);
      await tester.scrollUntilVisible(
        find.text('Received'),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      final received = tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Received'),
          )
          .onPressed!;
      final held = Completer<PaginatedResponse<JsonMap>>();
      api.reply = (_) => held.future;
      final other = h.service.fetchReturns(
        orders.site,
        status: 'received',
        page: 2,
      );
      await tester.pump();
      received();
      await tester.pumpAndSettle();
      expect(api.commands, isEmpty);
      held.complete(
        read.returnPage(
          page: 2,
          total: 21,
          row: {
            ...read.returnRow(),
            'order_number': 'OTHER-READ-PAGE-2',
            'status': 'received',
          },
        ),
      );
      await other;
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Applied status: All · Page 1'),
        -160,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Applied status: All · Page 1'), findsOneWidget);
      expect(find.text('OTHER-READ-PAGE-2'), findsNothing);
      expect(find.text('Previous return page'), findsOneWidget);
      received();
      await tester.pumpAndSettle();
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'a create acknowledgement for another order stays unconfirmed with its original key retained',
    (tester) async {
      final api = ReturnsUiTransport()
        ..row = {
          ...read.returnRow(),
          'order_id': '44444444-4444-4444-8444-444444444444',
        };
      await mountReturns(tester, api);
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Order ID'), orders.recordId);
      await tester.tap(find.widgetWithText(FilledButton, 'Create'));
      await tester.pumpAndSettle();
      expect(api.commands, hasLength(1));
      expect(find.textContaining('Return created.'), findsNothing);
      expect(find.text('Retry original return'), findsOneWidget);
      expect(api.reads, hasLength(1));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'one Returns completion owns journal preparation before the reference sheet opens',
    (tester) async {
      final api = ReturnsUiTransport()
        ..reply = (_) async => read.returnPage(
          row: {...read.returnRow(), 'refund_id': 'synthetic-refund'},
        );
      final service = HeldReturnCompletion(api: api);
      await mountReturns(tester, api, service: service);
      await tester.scrollUntilVisible(
        find.text('Complete refund'),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      final activate = tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Complete refund'),
          )
          .onPressed!;
      activate();
      activate();
      await tester.pump();
      expect(service.preparations, 1);
      service.held.complete(null);
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyFormSheet), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();
      expect(api.commands, isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('retired editor Close belongs only to its own outgoing route', (
    tester,
  ) async {
    final api = ReturnsUiTransport(), observer = ReturnNavigationObserver();
    final h = await mountReturns(tester, api, observer: observer);
    await tester.tap(find.text('New return'));
    await tester.pumpAndSettle();
    h.scope.retire();
    await tester.pumpAndSettle();
    final close = tester
        .widget<TextButton>(find.widgetWithText(TextButton, 'Close'))
        .onPressed!;
    close();
    close();
    await tester.pumpAndSettle();
    expect(observer.pops, 1);
    expect(find.text('Returns'), findsOneWidget);
    expect(api.commands, isEmpty);
    expect(tester.takeException(), isNull);
  });
  for (final dark in [false, true]) {
    testWidgets('Returns record and editor compose at320dp200percent dark$dark', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = ReturnsUiTransport()
        ..reply = (_) async => read.returnPage(
          row: {
            ...read.returnRow(),
            'order_number': 'SYNTHETIC-LONG-ORDER-NUMBER-1234567890-ABCDEFGHIJ',
            'reason':
                'A long synthetic reason for checking natural wrapping and meaningful amounts in this real operational composition.',
          },
        );
      await mountReturns(tester, api, scale: 2, dark: dark);
      await tester.scrollUntilVisible(
        find.text('SYNTHETIC-LONG-ORDER-NUMBER-1234567890-ABCDEFGHIJ'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      final identity = tester.widget<SelectableText>(
        find.byWidgetPredicate(
          (w) =>
              w is SelectableText &&
              w.data == 'SYNTHETIC-LONG-ORDER-NUMBER-1234567890-ABCDEFGHIJ',
        ),
      );
      expect(identity.maxLines, isNull);
      await tester.scrollUntilVisible(
        find.text('₹129.75'),
        120,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tester.takeException(), isNull);
      await tester.scrollUntilVisible(
        find.text('New return'),
        -180,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('New return'));
      await tester.pumpAndSettle();
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
