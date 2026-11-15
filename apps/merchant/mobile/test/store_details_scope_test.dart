import 'support/membership_page.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/screens/settings/store_details_screen.dart';
import 'package:letbuyy_store/screens/settings/seo_settings_screen.dart';

JsonMap row(String id, [String? name]) => {
  'id': id,
  'version': 1,
  'name': name ?? 'Synthetic private $id',
  'subdomain': id,
  'legal_name': 'Private legal $id',
  'invoice_number_next': 1,
  'seo_title': 'SEO private $id',
  'seo_description': 'Private description $id',
};

class SettingsTransport extends ApiClient {
  SettingsTransport()
    : super(baseUrl: 'https://gateway.test/v1', maxRetries: 0);
  final rows = <String, JsonMap>{
    'store-a': row('store-a'),
    'store-b': row('store-b'),
  };
  Completer<void>? holdRead, holdWrite;
  int reads = 0, writes = 0;
  final writeBodies = <JsonMap>[];
  bool readUnavailable = false;
  bool writeReplyLost = false;
  bool overrideWriteAcknowledgement = false;
  Object? acknowledgedVersion;
  int? readDenial;
  bool wrongReadStore = false;
  @override
  Future<PaginatedResponse<JsonMap>> requestPaginatedJson(
    String path, {
    ApiRequestOptions? options,
  }) async => PaginatedResponse(
    data: rows.values.toList(),
    page: 1,
    limit: 50,
    total: 2,
    hasMore: false,
    meta: membershipPageMeta(2),
  );
  @override
  Future<JsonMap> requestJson(String path, {ApiRequestOptions? options}) async {
    final id = path.split('/').last;
    if (options?.method == HttpMethod.patch) {
      writes++;
      final fields = Map<String, dynamic>.from(options!.body! as Map);
      writeBodies.add(fields);
      final next = <String, dynamic>{
        ...rows[id]!,
        ...fields,
        'version': (rows[id]!['version'] as int) + 1,
      };
      await holdWrite?.future;
      rows[id] = next;
      if (writeReplyLost) {
        throw const ApiException(
          message: 'Synthetic committed reply lost',
          statusCode: 503,
          code: 'UNAVAILABLE',
        );
      }
      return {
        ...next,
        if (overrideWriteAcknowledgement) 'version': acknowledgedVersion,
      };
    }
    reads++;
    final current = Map<String, dynamic>.from(rows[id]!);
    await holdRead?.future;
    if (readDenial != null) {
      throw ApiException(
        message: 'Synthetic access denied',
        statusCode: readDenial!,
        code: 'FORBIDDEN',
      );
    }
    if (readUnavailable)
      throw const ApiException(
        message: 'Synthetic unavailable',
        statusCode: 503,
        code: 'UNAVAILABLE',
      );
    return wrongReadStore ? row('foreign-store') : current;
  }
}

Future<(SettingsTransport, StoreContext)> mount(
  WidgetTester tester, {
  SettingsTransport? transport,
  Widget screen = const StoreDetailsScreen(),
}) async {
  final api = transport ?? SettingsTransport();
  final service = StoreService(api: api);
  // The same canonical service owns membership, detail reads and acknowledged updates.
  final scope = StoreContext(storeService: service);
  await scope.bindActor('owner-a');
  await scope.ensureSelectedStore();
  addTearDown(() {
    api.close();
    scope.dispose();
    service.dispose();
  });
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreService>.value(value: service),
        ChangeNotifierProvider<StoreContext>.value(value: scope),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pump();
  await tester.pump();
  return (api, scope);
}

Finder get nameField => find.byKey(const ValueKey('store-details-name-field'));
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  testWidgets(
    'store settings retires its private draft after A to B to A selection',
    (tester) async {
      final (api, scope) = await mount(tester);
      await tester.pumpAndSettle();
      expect(nameField, findsOneWidget);
      await tester.enterText(nameField, 'Private unsaved owner draft');
      final switchAway = scope.selectStoreById('store-b');
      await tester.pump();
      await switchAway;
      await tester.pump();
      expect(nameField, findsNothing);
      expect(find.text('Store access changed'), findsOneWidget);
      final switchBack = scope.selectStoreById('store-a');
      await tester.pump();
      await switchBack;
      await tester.pump();
      expect(nameField, findsNothing);
      expect(find.text('Private unsaved owner draft'), findsNothing);
      expect(api.writes, 0);
    },
  );
  testWidgets(
    'late store save cannot restore an old selection or report success',
    (tester) async {
      final api = SettingsTransport()..holdWrite = Completer<void>();
      final (_, scope) = await mount(tester, transport: api);
      await tester.pumpAndSettle();
      await tester.enterText(nameField, 'Updated owner name');
      await tester.pump();
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pump();
      expect(api.writes, 1);
      final change = scope.selectStoreById('store-b');
      await tester.pump();
      await change;
      await tester.pump();
      api.holdWrite!.complete();
      await tester.pumpAndSettle();
      expect(scope.selectedStoreId, 'store-b');
      expect(find.text('Store details saved.'), findsNothing);
      expect(nameField, findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'store settings opens from a fresh response and refuses offline cache authority',
    (tester) async {
      final api = SettingsTransport()..readUnavailable = true;
      await mount(tester, transport: api);
      await tester.pumpAndSettle();
      expect(api.reads, 1);
      expect(nameField, findsNothing);
      expect(
        find.text('Could not load store details. Try again.'),
        findsOneWidget,
      );
      expect(api.writes, 0);
    },
  );
  testWidgets('confirmed store settings readback replaces selected metadata', (
    tester,
  ) async {
    final (api, scope) = await mount(tester);
    await tester.pumpAndSettle();
    expect(api.reads, 1);
    await tester.enterText(nameField, 'Updated owner name');
    await tester.pump();
    await tester.tap(find.widgetWithText(TextButton, 'Save'));
    await tester.pumpAndSettle();
    expect(api.writes, 1);
    expect(api.writeBodies.single['version'], 1);
    expect(scope.selectedStore?.name, 'Updated owner name');
    expect(scope.selectedStore?.version, 2);
    expect(find.text('Store details saved.'), findsOneWidget);
    expect(api.reads, 2);
  });
  for (final revision in <Object?>[null, 1, 3, '2', 0, -1]) {
    testWidgets(
      'unverified profile acknowledgement revision $revision retains the draft before read recovery',
      (tester) async {
        final api = SettingsTransport()
          ..overrideWriteAcknowledgement = true
          ..acknowledgedVersion = revision;
        final (_, scope) = await mount(tester, transport: api);
        await tester.pumpAndSettle();
        await tester.enterText(nameField, 'Synthetic committed name');
        await tester.pump();
        await tester.tap(find.widgetWithText(TextButton, 'Save'));
        await tester.pumpAndSettle();
        expect(api.writes, 1);
        expect(
          api.rows['store-a']!['version'],
          2,
          reason: 'positive control: the synthetic server actually committed',
        );
        expect(find.text('Store details saved.'), findsNothing);
        expect(
          find
              .text(
                'The save is unconfirmed. Reload current details before another change.',
              )
              .hitTestable(),
          findsOneWidget,
        );
        expect(
          scope.selectedStore?.version,
          1,
          reason:
              'an unverified acknowledgement cannot replace selected metadata',
        );
        await tester.tap(find.byTooltip('Reload current store details'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Reload'));
        await tester.pumpAndSettle();
        expect(scope.selectedStore?.version, 2);
        expect(scope.selectedStore?.name, 'Synthetic committed name');
        expect(api.writes, 1);
      },
    );
  }
  test(
    'profile request freezes its nested original fields before waiting',
    () async {
      final api = SettingsTransport();
      final service = StoreService(api: api);
      addTearDown(() {
        api.close();
        service.dispose();
      });
      final fields = <String, dynamic>{
        'version': 1,
        'name': 'Frozen name',
        'business_profile': <String, dynamic>{
          'email': 'frozen@example.invalid',
        },
      };
      final request = service.updateStore('store-a', fields);
      fields['name'] = 'Changed caller name';
      (fields['business_profile'] as Map<String, dynamic>)['email'] =
          'changed@example.invalid';
      await request;
      expect(api.writeBodies.single['name'], 'Frozen name');
      expect(
        (api.writeBodies.single['business_profile'] as Map)['email'],
        'frozen@example.invalid',
      );
    },
  );
  testWidgets('late denied refresh cannot clear a newly selected store', (
    tester,
  ) async {
    final api = SettingsTransport()..holdRead = Completer<void>();
    final (_, scope) = await mount(tester, transport: api);
    expect(api.reads, 1);
    final change = scope.selectStoreById('store-b');
    await tester.pump();
    await change;
    api.readDenial = 403;
    api.holdRead!.complete();
    await tester.pumpAndSettle();
    expect(scope.selectedStoreId, 'store-b');
    expect(find.text('Store access changed'), findsOneWidget);
    expect(nameField, findsNothing);
    expect(api.writes, 0);
  });
  testWidgets(
    'fresh settings cannot adopt a foreign response or current revoked membership',
    (tester) async {
      final api = SettingsTransport()..wrongReadStore = true;
      final (_, scope) = await mount(tester, transport: api);
      await tester.pumpAndSettle();
      expect(nameField, findsNothing);
      expect(scope.selectedStoreId, 'store-a');
      api.wrongReadStore = false;
      api.readDenial = 403;
      await tester.tap(find.text('Retry store details'));
      await tester.pumpAndSettle();
      expect(scope.selectedStoreId, isNull);
      expect(scope.stores, isEmpty);
      expect(nameField, findsNothing);
      expect(find.text('Store access changed'), findsOneWidget);
    },
  );
  testWidgets('settings cannot edit without an observed positive revision', (
    tester,
  ) async {
    final api = SettingsTransport();
    api.rows['store-a']!.remove('version');
    await mount(tester, transport: api);
    await tester.pumpAndSettle();
    expect(nameField, findsNothing);
    expect(
      find.text('Could not load store details. Try again.'),
      findsOneWidget,
    );
    expect(api.writes, 0);
    api.rows['store-a']!['version'] = 3;
    await tester.tap(find.text('Retry store details'));
    await tester.pumpAndSettle();
    expect(nameField, findsOneWidget);
  });
  testWidgets('failed refresh preserves edits and Back can keep editing', (
    tester,
  ) async {
    final (api, _) = await mount(tester);
    await tester.pumpAndSettle();
    await tester.enterText(nameField, 'Unsaved retained name');
    await tester.pump();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Discard store edits?'), findsOneWidget);
    await tester.tap(find.text('Keep editing'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(nameField).controller!.text,
      'Unsaved retained name',
    );
    api.readUnavailable = true;
    await tester.tap(find.byTooltip('Reload current store details'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reload'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(nameField).controller!.text,
      'Unsaved retained name',
    );
    expect(
      find.text('Could not reload current details. Your edits are still here.'),
      findsOneWidget,
    );
    expect(api.writes, 0);
  });
  testWidgets(
    'unconfirmed scrolled save keeps recovery visible and the form scrollable without enabling another write',
    (tester) async {
      final api = SettingsTransport()..writeReplyLost = true;
      await mount(tester, transport: api);
      await tester.pumpAndSettle();
      await tester.enterText(nameField, 'Synthetic committed name');
      await tester.pump();
      final list = find.byType(ListView);
      await tester.drag(list, const Offset(0, -650));
      await tester.pumpAndSettle();
      final position = tester
          .state<ScrollableState>(
            find.descendant(of: list, matching: find.byType(Scrollable)).first,
          )
          .position;
      expect(position.pixels, greaterThan(0));
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pumpAndSettle();
      expect(api.writes, 1);
      expect(
        find
            .text(
              'The save is unconfirmed. Reload current details before another change.',
            )
            .hitTestable(),
        findsOneWidget,
      );
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Save'))
            .onPressed,
        isNull,
      );
      final scrolled = position.pixels;
      await tester.drag(list, const Offset(0, 650));
      await tester.pumpAndSettle();
      expect(position.pixels, lessThan(scrolled));
      await tester.ensureVisible(nameField);
      expect(tester.widget<TextFormField>(nameField).enabled, isFalse);
      await tester.tap(find.byTooltip('Reload current store details'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reload'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(nameField).controller!.text,
        'Synthetic committed name',
      );
      expect(tester.widget<TextFormField>(nameField).enabled, isTrue);
      expect(api.writes, 1);
      expect(
        find.text(
          'The save is unconfirmed. Reload current details before another change.',
        ),
        findsNothing,
      );
    },
  );
  testWidgets(
    'SEO settings retires a private draft and late success on store switch',
    (tester) async {
      final api = SettingsTransport()..holdWrite = Completer<void>();
      final (_, scope) = await mount(
        tester,
        transport: api,
        screen: const SEOSettingsScreen(),
      );
      await tester.pumpAndSettle();
      expect(find.text('SEO private store-a'), findsWidgets);
      await tester.enterText(find.byType(TextField).first, 'Updated SEO draft');
      await tester.pump();
      await tester.ensureVisible(find.text('Save SEO'));
      await tester.tap(find.text('Save SEO'));
      await tester.pump();
      expect(api.writes, 1);
      final change = scope.selectStoreById('store-b');
      await tester.pump();
      await change;
      await tester.pump();
      expect(find.byType(TextField), findsNothing);
      api.holdWrite!.complete();
      await tester.pumpAndSettle();
      expect(find.text('SEO settings saved.'), findsNothing);
      expect(scope.selectedStoreId, 'store-b');
    },
  );
  testWidgets(
    'clearing SEO sends canonical empty text and refreshes selected readback',
    (tester) async {
      final (api, scope) = await mount(
        tester,
        screen: const SEOSettingsScreen(),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '');
      await tester.enterText(find.byType(TextField).last, '');
      await tester.pump();
      await tester.ensureVisible(find.text('Save SEO'));
      await tester.tap(find.text('Save SEO'));
      await tester.pumpAndSettle();
      expect(api.writeBodies.single['seo_title'], '');
      expect(api.writeBodies.single['seo_description'], '');
      expect(api.reads, 2);
      expect(scope.selectedStore?.seoTitle, '');
    },
  );
  testWidgets(
    'SEO settings refuses cached editor authority during a fresh-read outage',
    (tester) async {
      final api = SettingsTransport()..readUnavailable = true;
      await mount(tester, transport: api, screen: const SEOSettingsScreen());
      await tester.pumpAndSettle();
      expect(api.reads, 1);
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Could not load SEO settings'), findsOneWidget);
      expect(api.writes, 0);
    },
  );
  testWidgets(
    'a name edit preserves unrelated business contact and address metadata',
    (tester) async {
      final api = SettingsTransport();
      const profile = {
        'email': 'synthetic-contact@example.invalid',
        'trade_name': 'Retained trade name',
      };
      api.rows['store-a'] = {
        ...row('store-a'),
        'business_profile': profile,
        'invoice_address': {
          'line1': 'Example Road',
          'city': 'Mumbai',
          'zip': '400001',
          'country': 'IN',
          'attention': 'Retained attention',
        },
      };
      await mount(tester, transport: api);
      await tester.pumpAndSettle();
      await tester.enterText(nameField, 'Updated synthetic name');
      await tester.pump();
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pumpAndSettle();
      expect(api.rows['store-a']!['business_profile'], profile);
      expect(
        (api.rows['store-a']!['invoice_address'] as Map)['attention'],
        'Retained attention',
      );
    },
  );
  testWidgets(
    'contact edits validate website, clear email and retain unrelated profile data',
    (tester) async {
      final api = SettingsTransport();
      api.rows['store-a'] = {
        ...row('store-a'),
        'business_profile': {
          'email': 'old-contact@example.invalid',
          'trade_name': 'Retained trade name',
        },
      };
      await mount(tester, transport: api);
      await tester.pumpAndSettle();
      Future<void> edit(String key, String value) async {
        final field = find.byKey(ValueKey(key));
        for (var i = 0; i < 25 && field.evaluate().isEmpty; i++) {
          await tester.drag(find.byType(ListView), const Offset(0, -260));
          await tester.pump();
        }
        await tester.ensureVisible(field);
        await tester.enterText(field, value);
        await tester.pump();
      }

      await edit('store-details-contact-email-field', '');
      await edit('store-details-contact-phone-field', '+91 98765-43210');
      await edit('store-details-contact-website-field', 'javascript:alert(1)');
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pump();
      expect(api.writes, 0);
      expect(find.text('Check the highlighted fields.'), findsOneWidget);
      await edit(
        'store-details-contact-website-field',
        'https://synthetic.example.invalid',
      );
      await tester.tap(find.widgetWithText(TextButton, 'Save'));
      await tester.pumpAndSettle();
      expect(api.writeBodies.single['business_profile'], {
        'phone': '+919876543210',
        'website': 'https://synthetic.example.invalid',
        'trade_name': 'Retained trade name',
      });
      expect(
        api.rows['store-a']!['business_profile'],
        api.writeBodies.single['business_profile'],
      );
    },
  );
}
