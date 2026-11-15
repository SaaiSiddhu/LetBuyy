import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/customers/customer_profile_create_editor.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/merchant_store_view.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';

const site = '11111111-1111-4111-8111-111111111111';

class CreateTransport extends ApiClient {
  CreateTransport()
    : super(baseUrl: 'https://customer.synthetic.invalid/v1', maxRetries: 0);
  int epoch = 0;
  final calls = <ApiRequestOptions>[];
  Future<JsonMap> Function(ApiRequestOptions)? reply;
  @override
  Object captureRequestContext() => epoch;
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    expect(path, '/customers');
    calls.add(options!);
    if (reply != null) return reply!(options);
    final body = options.body as Map;
    return {
      'id': 'synthetic-customer',
      'store_id': site,
      'email': body['email'],
      'display_name': body['first_name'],
    };
  }
}

class BrowseCreateTransport extends CreateTransport {
  int listReads = 0;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async {
    expect(path, '/customers');
    listReads++;
    return PaginatedResponse(
      data: [
        {
          'id': 'synthetic-list-customer',
          'store_id': site,
          'display_name': 'Synthetic list profile',
          'email': 'synthetic-list@example.invalid',
          'order_count': 4,
          'total_spent': 19,
        },
      ],
      total: 1,
      page: 1,
      limit: 30,
      hasMore: false,
    );
  }

  @override
  Future<T> requestData<T>(
    String path, {
    ApiRequestOptions? options,
    required JsonDecoder<T> decoder,
  }) async {
    expect(path, '/customers/segments');
    return decoder([]);
  }
}

class CreateScope extends StoreContext {
  CreateScope(this.api) : super(storeService: StoreService(api: api));
  final CreateTransport api;
  int epoch = 0;
  @override
  Object get requestContextKey => epoch;
  @override
  String get selectedStoreId => site;
  @override
  StoreModel get selectedStore => StoreModel.fromJson({
    'id': site,
    'seller_id': 'synthetic',
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

Finder input(String key) => find.descendant(
  of: find.byKey(Key(key)),
  matching: find.byType(TextFormField),
);
Future<
  ({
    CreateScope scope,
    GlobalKey<NavigatorState> navigator,
    ValueNotifier<CustomerContract?> result,
  })
>
mount(
  WidgetTester tester,
  CreateTransport api, {
  bool dark = false,
  double scale = 1,
  double inset = 0,
}) async {
  final scope = CreateScope(api),
      service = CustomerService(api: api),
      navigator = GlobalKey<NavigatorState>(),
      result = ValueNotifier<CustomerContract?>(null);
  addTearDown(scope.dispose);
  addTearDown(service.dispose);
  addTearDown(api.close);
  addTearDown(result.dispose);
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
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(scale),
            viewInsets: EdgeInsets.only(bottom: inset),
          ),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                final MerchantStoreView view = (
                  key: scope.requestContextKey,
                  storeId: site,
                );
                result.value = await Navigator.of(context)
                    .push<CustomerContract>(
                      MaterialPageRoute(
                        builder: (_) => guardMerchantStoreView(
                          view,
                          CustomerProfileCreateEditor(view: view),
                          fullPage: true,
                        ),
                      ),
                    );
              },
              child: const Text('Open create'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open create'));
  await tester.pumpAndSettle();
  return (scope: scope, navigator: navigator, result: result);
}

Future<void> enter(WidgetTester tester, String key, String value) async {
  await tester.ensureVisible(input(key));
  await tester.enterText(input(key), value);
  await tester.pump();
}

Future<void> fill(WidgetTester tester) async {
  await enter(tester, 'customer-name-field', '  Synthetic   Buyer Person  ');
  await enter(tester, 'customer-email-field', ' SYNTHETIC@example.invalid ');
  await enter(tester, 'customer-phone-field', ' 9000000099 ');
  await enter(tester, 'customer-tags-field', ' vip, wholesale, vip, , ');
}

void main() {
  testWidgets(
    'leaving an unconfirmed create rechecks the existing list without claiming success',
    (tester) async {
      final api = BrowseCreateTransport();
      api.reply = (_) async => throw const ApiException(
        message: 'Synthetic reply lost',
        statusCode: 503,
        code: 'SYNTHETIC_REPLY_LOST',
      );
      final scope = CreateScope(api), service = CustomerService(api: api);
      addTearDown(api.close);
      addTearDown(scope.dispose);
      addTearDown(service.dispose);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<ApiClient>.value(value: api),
            ChangeNotifierProvider<StoreContext>.value(value: scope),
            ChangeNotifierProvider<CustomerService>.value(value: service),
          ],
          child: MaterialApp(
            theme: StoreTheme.light(),
            home: const CustomersScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(api.listReads, 1);
      await tester.tap(find.byTooltip('Add customer'));
      await tester.pumpAndSettle();
      await fill(tester);
      await tester.tap(find.text('Save customer'));
      await tester.pumpAndSettle();
      expect(find.text('Save unconfirmed'), findsOneWidget);
      await tester.tap(find.text('Close and review'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Leave and review'));
      await tester.pumpAndSettle();
      expect(api.listReads, 2);
      expect(api.calls, hasLength(1));
      expect(find.text('Customer added.'), findsNothing);
      expect(find.text('Synthetic list profile'), findsOneWidget);
    },
  );

  testWidgets(
    'cancelling an unsent create preserves the existing list read and return context',
    (tester) async {
      final api = BrowseCreateTransport();
      final currentScope = CreateScope(api),
          service = CustomerService(api: api);
      addTearDown(api.close);
      addTearDown(currentScope.dispose);
      addTearDown(service.dispose);
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<ApiClient>.value(value: api),
            ChangeNotifierProvider<StoreContext>.value(value: currentScope),
            ChangeNotifierProvider<CustomerService>.value(value: service),
          ],
          child: MaterialApp(
            theme: StoreTheme.light(),
            home: const CustomersScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(api.listReads, 1);
      expect(find.text('Synthetic list profile'), findsOneWidget);
      await tester.tap(find.byTooltip('Add customer'));
      await tester.pumpAndSettle();
      await enter(tester, 'customer-name-field', 'Synthetic unsent draft');
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Discard changes'));
      await tester.pumpAndSettle();
      expect(api.listReads, 1);
      expect(api.calls, isEmpty);
      expect(find.text('Synthetic list profile'), findsOneWidget);
    },
  );

  testWidgets(
    'explicit canonical validation rejection keeps editable fields for a corrected intent',
    (tester) async {
      final api = CreateTransport();
      api.reply = (_) async => throw const ApiException(
        message: 'Synthetic input rejected',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      );
      final host = await mount(tester, api);
      await fill(tester);
      await tester.tap(find.text('Save customer'));
      await tester.pumpAndSettle();
      expect(find.text('Input rejected'), findsOneWidget);
      expect(find.text('Save unconfirmed'), findsNothing);
      expect(
        tester
            .widget<CustomTextField>(
              find.byKey(const Key('customer-email-field')),
            )
            .enabled,
        isTrue,
      );
      expect(api.calls, hasLength(1));
      api.reply = null;
      await enter(tester, 'customer-email-field', 'corrected@example.invalid');
      expect(find.text('Input rejected'), findsNothing);
      await tester.tap(find.text('Save customer'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(2));
      expect(host.result.value?.email, 'corrected@example.invalid');
    },
  );

  testWidgets(
    'create uses the canonical editor and unchanged original request normalization',
    (tester) async {
      final api = CreateTransport();
      final host = await mount(tester, api);
      expect(find.byType(LetbuyyEditorScaffold), findsOneWidget);
      await fill(tester);
      await tester.tap(find.text('Save customer'));
      await tester.pumpAndSettle();
      expect(host.result.value?.email, 'synthetic@example.invalid');
      expect(api.calls, hasLength(1));
      expect(api.calls.single.body, {
        'store_id': site,
        'email': 'synthetic@example.invalid',
        'first_name': 'Synthetic',
        'last_name': 'Buyer Person',
        'phone': '9000000099',
        'tags': ['vip', 'wholesale', 'vip'],
        'accepts_marketing': false,
      });
    },
  );
  testWidgets(
    'dirty Back cancel keeps exact native text and original validation',
    (tester) async {
      final api = CreateTransport();
      await mount(tester, api);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Save customer'),
            )
            .onPressed,
        isNull,
      );
      await enter(tester, 'customer-name-field', 'Synthetic private draft');
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.widgetWithText(TextButton, 'Cancel'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextFormField>(input('customer-name-field'))
            .controller!
            .text,
        'Synthetic private draft',
      );
      expect(api.calls, isEmpty);
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Discard changes'));
      await tester.pumpAndSettle();
      expect(find.text('Open create'), findsOneWidget);
      expect(api.calls, isEmpty);
    },
  );
  testWidgets('one pending save owns Back and duplicate callbacks', (
    tester,
  ) async {
    final api = CreateTransport(), held = Completer<JsonMap>();
    api.reply = (_) => held.future;
    await mount(tester, api);
    await fill(tester);
    final submit = tester
        .widget<FilledButton>(
          find.widgetWithText(FilledButton, 'Save customer'),
        )
        .onPressed!;
    submit();
    submit();
    await tester.pump();
    expect(api.calls, hasLength(1));
    expect(find.text('Saving customer…'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.byType(CustomerProfileCreateEditor), findsOneWidget);
    expect(find.text('Discard changes?'), findsNothing);
    held.complete({
      'id': 'synthetic-customer',
      'store_id': site,
      'email': 'synthetic@example.invalid',
    });
    await tester.pumpAndSettle();
    expect(api.calls, hasLength(1));
    expect(find.text('Open create'), findsOneWidget);
  });
  testWidgets(
    'lost acknowledgement keeps fields and never retries a fresh SDK operation',
    (tester) async {
      final api = CreateTransport();
      api.reply = (_) async => throw const ApiException(
        message: 'Synthetic reply lost',
        code: 'SYNTHETIC_REPLY_LOST',
        statusCode: 503,
      );
      await mount(tester, api);
      await fill(tester);
      final submit = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Save customer'),
          )
          .onPressed!;
      submit();
      await tester.pumpAndSettle();
      expect(find.text('Save unconfirmed'), findsOneWidget);
      expect(find.text('Save customer'), findsNothing);
      expect(
        tester
            .widget<TextFormField>(input('customer-email-field'))
            .controller!
            .text,
        ' SYNTHETIC@example.invalid ',
      );
      expect(
        tester
            .widget<CustomTextField>(
              find.byKey(const Key('customer-email-field')),
            )
            .enabled,
        isFalse,
      );
      submit();
      await tester.pump();
      expect(api.calls, hasLength(1));
      await tester.tap(find.text('Close and review'));
      await tester.pumpAndSettle();
      expect(find.text('Leave unconfirmed save?'), findsOneWidget);
      await tester.tap(find.text('Leave and review'));
      await tester.pumpAndSettle();
      expect(find.text('Open create'), findsOneWidget);
    },
  );
  for (final status in [401, 403])
    testWidgets(
      'current$status hides private fields and retires saved callbacks',
      (tester) async {
        final api = CreateTransport();
        api.reply = (_) async => throw ApiException(
          message: 'Synthetic denied',
          code: 'SYNTHETIC_DENIED',
          statusCode: status,
        );
        await mount(tester, api);
        await fill(tester);
        final submit = tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Save customer'),
            )
            .onPressed!;
        submit();
        await tester.pumpAndSettle();
        expect(find.text('Customer access unconfirmed'), findsOneWidget);
        expect(find.byType(EditableText), findsNothing);
        expect(find.text('Synthetic private draft'), findsNothing);
        submit();
        await tester.pump();
        expect(api.calls, hasLength(1));
      },
    );
  testWidgets(
    'late create after owner retirement cannot settle or reveal the old editor',
    (tester) async {
      final api = CreateTransport(), held = Completer<JsonMap>();
      api.reply = (_) => held.future;
      final host = await mount(tester, api);
      await fill(tester);
      await tester.tap(find.text('Save customer'));
      await tester.pump();
      host.scope.retire();
      await tester.pump();
      expect(find.byType(EditableText), findsNothing);
      held.complete({
        'id': 'synthetic-customer',
        'store_id': site,
        'email': 'synthetic@example.invalid',
      });
      await tester.pumpAndSettle();
      expect(host.result.value, isNull);
      expect(find.text('Customer saved'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'acknowledgement cannot pop a covering route or allow another create',
    (tester) async {
      final api = CreateTransport(), held = Completer<JsonMap>();
      api.reply = (_) => held.future;
      final host = await mount(tester, api);
      await fill(tester);
      await tester.tap(find.text('Save customer'));
      await tester.pump();
      host.navigator.currentState!.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('Covering destination')),
        ),
      );
      await tester.pumpAndSettle();
      held.complete({
        'id': 'synthetic-customer',
        'store_id': site,
        'email': 'synthetic@example.invalid',
      });
      await tester.pumpAndSettle();
      expect(find.text('Covering destination'), findsOneWidget);
      expect(host.result.value, isNull);
      host.navigator.currentState!.pop();
      await tester.pumpAndSettle();
      expect(find.text('Customer saved'), findsOneWidget);
      expect(find.text('Save customer'), findsNothing);
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();
      expect(host.result.value?.email, 'synthetic@example.invalid');
      expect(api.calls, hasLength(1));
    },
  );
  testWidgets('wrong-record create acknowledgement remains unconfirmed', (
    tester,
  ) async {
    final api = CreateTransport();
    api.reply = (_) async => {
      'id': 'another',
      'store_id': site,
      'email': 'another@example.invalid',
    };
    final host = await mount(tester, api);
    await fill(tester);
    await tester.tap(find.text('Save customer'));
    await tester.pumpAndSettle();
    expect(host.result.value, isNull);
    expect(find.text('Save unconfirmed'), findsOneWidget);
    expect(find.text('another@example.invalid'), findsNothing);
  });
  for (final dark in [false, true])
    testWidgets(
      'create reflows full labels and actions at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 780);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = CreateTransport();
        await mount(tester, api, dark: dark, scale: 2.4, inset: 250);
        await enter(
          tester,
          'customer-name-field',
          'Synthetic long private customer name',
        );
        await enter(
          tester,
          'customer-email-field',
          'synthetic@example.invalid',
        );
        await enter(
          tester,
          'customer-tags-field',
          'synthetic-wholesale,long-synthetic-preference',
        );
        expect(find.text('Save customer').hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
        expect(api.calls, isEmpty);
      },
    );
}
