// UI dispatch/lifetime checks only; existing durable CSV protocol remains in
// product_import_recovery_test and its separate owned database qualification.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/csv_import_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'product_import_screen_test.dart' as screen;
import 'product_import_recovery_test.dart' as fixture;

class CsvPresentationProducts extends screen.ScreenProducts {
  CsvPresentationProducts(super.api);
  Completer<ProductImportJob>? heldJob;
  Completer<ProductImportPage<ProductImportJob>>? heldHistory;
  int pendingReads = 0;
  final rowReads = <({String store, String job, int page, String status})>[];
  @override
  Future<ProductImportJob> fetchCsvImport(String store, String id) async =>
      heldJob != null ? heldJob!.future : super.fetchCsvImport(store, id);
  @override
  Future<ProductImportPage<ProductImportJob>> fetchCsvImports(
    String store, {
    int page = 1,
  }) async => heldHistory != null
      ? heldHistory!.future
      : super.fetchCsvImports(store, page: page);
  @override
  Future<PendingSecurityCommand?> pendingCsvImport(String store) {
    pendingReads++;
    return super.pendingCsvImport(store);
  }

  @override
  Future<ProductImportPage<ProductImportRow>> fetchCsvRows(
    String store,
    String id, {
    int page = 1,
    String status = 'all',
  }) {
    rowReads.add((store: store, job: id, page: page, status: status));
    return super.fetchCsvRows(store, id, page: page, status: status);
  }
}

Future<({StoreContext stores, CsvPresentationProducts products})> mountCsv(
  WidgetTester tester, {
  bool dark = false,
  double scale = 1,
}) async {
  SharedPreferences.setMockInitialValues({});
  final api = ApiClient(baseUrl: 'https://unused.synthetic.invalid/v1');
  addTearDown(api.close);
  final stores = StoreContext(storeService: screen.FixedStores(api));
  await stores.bindActor(fixture.actorA);
  await stores.loadStores();
  final products = CsvPresentationProducts(api);
  addTearDown(stores.dispose);
  addTearDown(products.dispose);
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<StoreContext>.value(value: stores),
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
        home: const CsvImportScreen(storeId: fixture.site),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return (stores: stores, products: products);
}

Future<void> openCsvHistory(WidgetTester tester) async {
  final history = find.text('failed · 1/2 committed');
  await tester.ensureVisible(history);
  await tester.pumpAndSettle();
  await tester.tap(history);
  await tester.pump();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'retired CSV detail read never dispatches its later row request',
    (tester) async {
      final h = await mountCsv(tester);
      h.products.heldJob = Completer<ProductImportJob>();
      await openCsvHistory(tester);
      await h.stores.selectStore(h.stores.stores.last);
      await tester.pump();
      h.products.heldJob!.complete(h.products.existing);
      await tester.pumpAndSettle();
      expect(h.products.rowReads, isEmpty);
      expect(find.byType(TextField), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'retired CSV history read never starts an old pending-registration read',
    (tester) async {
      final h = await mountCsv(tester);
      final original = await h.products.fetchCsvImports(fixture.site);
      final before = h.products.pendingReads;
      h.products.heldHistory = Completer<ProductImportPage<ProductImportJob>>();
      await tester.tap(find.byTooltip('Refresh imports'));
      await tester.pump();
      await h.stores.selectStore(h.stores.stores.last);
      await tester.pump();
      h.products.heldHistory!.complete(original);
      await tester.pumpAndSettle();
      expect(h.products.pendingReads, before);
      expect(find.byType(TextField), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'CSV row choices keep all five original server values behind Apply',
    (tester) async {
      final h = await mountCsv(tester);
      await openCsvHistory(tester);
      await tester.pumpAndSettle();
      final before = h.products.rowReads.length;
      Future<void> open() async {
        final choice = find.ancestor(
          of: find.text('Row status'),
          matching: find.byType(OutlinedButton),
        );
        await tester.ensureVisible(choice);
        await tester.pumpAndSettle();
        await tester.tap(choice);
        await tester.pumpAndSettle();
      }

      await open();
      await tester.tap(find.widgetWithText(RadioListTile<String>, 'Failed'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(h.products.rowReads.length, before);
      for (final entry in {
        'Queued': 'queued',
        'Completed': 'completed',
        'Failed': 'failed',
        'Stopped': 'stopped',
        'All': 'all',
      }.entries) {
        final prior = h.products.rowReads.length;
        await open();
        await tester.tap(find.widgetWithText(RadioListTile<String>, entry.key));
        await tester.pumpAndSettle();
        expect(h.products.rowReads.length, prior);
        await tester.tap(find.widgetWithText(FilledButton, 'Apply selection'));
        await tester.pumpAndSettle();
        expect(h.products.rowReads.last, (
          store: fixture.site,
          job: fixture.jobId,
          page: 1,
          status: entry.value,
        ));
      }
      expect(h.products.submissions, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'CSV draft Back preserves exact contents on Cancel without a new registration',
    (tester) async {
      final h = await mountCsv(tester);
      await tester.enterText(find.byType(TextField), fixture.csv);
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Leave CSV draft?'), findsOneWidget);
      expect(
        find.textContaining('Registered jobs continue independently'),
        findsOneWidget,
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        fixture.csv,
      );
      expect(h.products.submissions, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'CSV stop Cancel has no effect and retired confirmation cannot stop another store request',
    (tester) async {
      final h = await mountCsv(tester);
      h.products.pending = true;
      await tester.tap(find.byTooltip('Refresh imports'));
      await tester.pumpAndSettle();
      Future<void> openStop() async {
        final stop = find.widgetWithText(TextButton, 'Stop original request');
        await tester.ensureVisible(stop);
        await tester.pumpAndSettle();
        await tester.tap(stop);
        await tester.pumpAndSettle();
      }

      await openStop();
      await tester.tap(find.text('Keep request'));
      await tester.pumpAndSettle();
      expect(h.products.registrationStop, isNull);
      expect(h.products.pending, isTrue);
      await openStop();
      await h.stores.selectStore(h.stores.stores.last);
      await tester.pumpAndSettle();
      expect(find.text('Store access changed'), findsOneWidget);
      expect(
        find.widgetWithText(FilledButton, 'Stop original request'),
        findsNothing,
      );
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(h.products.registrationStop, isNull);
      expect(h.products.submissions, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'CSV job rows and pagination reflow at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await mountCsv(tester, dark: dark, scale: 2.4);
        await openCsvHistory(tester);
        await tester.pumpAndSettle();
        expect(find.text('Row 1: completed'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
