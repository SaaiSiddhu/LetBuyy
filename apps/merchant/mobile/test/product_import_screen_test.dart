// UI lifetime fixtures only. Real transport and PostgreSQL recovery have their
// own suites; these cases exercise the actual screen and scope retirement.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_models/letbuyy_models.dart' hide JsonMap;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/models/store_model.dart';
import 'package:letbuyy_store/screens/products/csv_import_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'product_import_recovery_test.dart' as fixture;

const second = '99999999-9999-4999-8999-999999999999';

class FixedStores extends StoreService {
  FixedStores(ApiClient api) : super(api: api);
  @override
  Future<List<StoreModel>> fetchStores() async => [fixture.site, second]
      .map(
        (id) => StoreModel.fromJson({
          'id': id,
          'name': 'Synthetic store',
          'site_type': 'store',
          'subdomain': id,
        }),
      )
      .toList();
}

class ScreenProducts extends ProductService {
  ScreenProducts(ApiClient api) : super(api: api);
  bool unavailable = false;
  bool pending = false;
  ProductImportJob? registrationStop;
  Completer<ProductImportJob>? reply;
  final submissions = <String>[];
  ProductImportJob get existing => ProductImportJob.fromJson({
    ...fixture.job(fixture.jobId, 'a' * 64),
    'status': 'failed',
    'total_rows': 2,
    'row_count': 1,
    'failed_rows': 1,
    'pending_rows': 0,
    'error_code': 'PRODUCT_IMPORT_ROW_FAILED',
  });
  @override
  Future<ProductImportCapabilities> verifyCsvImport(String store) async {
    if (unavailable)
      throw const ApiException(
        message: 'Synthetic recovery outage',
        statusCode: 503,
        code: 'PRODUCT_IMPORT_UNAVAILABLE',
      );
    return ProductImportCapabilities.fromJson({
      'store_id': fixture.site,
      'actor_id': fixture.actorA,
      'contract_version': 2,
      'max_rows': 500,
      'max_bytes': 1048576,
      'durable_registration': true,
      'durable_rows': true,
      'async_recovery': true,
    });
  }

  @override
  Future<PendingSecurityCommand?> pendingCsvImport(String store) async =>
      pending
      ? PendingSecurityCommand(
          fixture.actorA,
          fixture.site,
          'product-csv-import',
          '88888888-8888-4888-8888-888888888888',
          {'contract_version': 2, 'source_sha256': 'b' * 64},
        )
      : null;
  @override
  Future<ProductImportJob?> stopCsvRegistration(String store) async {
    registrationStop = ProductImportJob.fromJson({
      ...fixture.job('88888888-8888-4888-8888-888888888888', 'b' * 64),
      'id': '88888888-8888-4888-8888-888888888888',
      'status': 'stopped',
      'total_rows': 0,
      'pending_rows': 0,
      'resumable': false,
      'error_code': 'PRODUCT_IMPORT_STOPPED',
      'completed_at': '2026-11-01T00:00:01Z',
    });
    pending = false;
    return registrationStop;
  }

  @override
  Future<ProductImportPage<ProductImportJob>> fetchCsvImports(
    String store, {
    int page = 1,
  }) async => ProductImportPage.history({
    'data': [
      existing.json,
      if (registrationStop != null) registrationStop!.json,
    ],
    'meta': {
      'store_id': fixture.site,
      'actor_id': fixture.actorA,
      'page': page,
      'per_page': 20,
      'total': registrationStop == null ? 1 : 2,
      'total_is_exact': true,
      'has_next': false,
    },
  });
  @override
  Future<ProductImportJob> importProductCsv(String store, String csv) {
    submissions.add(csv);
    return reply!.future;
  }

  @override
  Future<ProductImportJob> fetchCsvImport(String store, String id) async =>
      registrationStop?.id == id ? registrationStop! : existing;
  @override
  Future<ProductImportPage<ProductImportRow>> fetchCsvRows(
    String store,
    String id, {
    int page = 1,
    String status = 'all',
  }) async => ProductImportPage.rows({
    'data': [
      if (registrationStop?.id != id) ...[
        {
          'id': '55555555-5555-4555-8555-555555555555',
          'job_id': fixture.jobId,
          'store_id': fixture.site,
          'ordinal': 1,
          'status': 'completed',
          'product_id': '66666666-6666-4666-8666-666666666666',
          'error_code': null,
          'attempt_count': 1,
        },
        {
          'id': '77777777-7777-4777-8777-777777777777',
          'job_id': fixture.jobId,
          'store_id': fixture.site,
          'ordinal': 2,
          'status': 'failed',
          'product_id': null,
          'error_code': 'PRODUCT_IMPORT_ROW_FAILED',
          'attempt_count': 1,
        },
      ],
    ],
    'meta': {
      'store_id': fixture.site,
      'actor_id': fixture.actorA,
      'job_id': id,
      'page': 1,
      'per_page': 20,
      'total': registrationStop?.id == id ? 0 : 2,
      'total_is_exact': true,
      'has_next': false,
    },
  });
}

Future<(StoreContext, ScreenProducts)> mount(
  WidgetTester tester, {
  bool unavailable = false,
  bool pending = false,
}) async {
  SharedPreferences.setMockInitialValues({});
  final api = ApiClient(baseUrl: 'https://unused.synthetic.invalid/v1');
  addTearDown(api.close);
  final stores = StoreContext(storeService: FixedStores(api));
  await stores.bindActor(fixture.actorA);
  await stores.loadStores();
  final products = ScreenProducts(api)
    ..unavailable = unavailable
    ..pending = pending;
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: stores),
        ChangeNotifierProvider<ProductService>.value(value: products),
      ],
      child: const MaterialApp(home: CsvImportScreen(storeId: fixture.site)),
    ),
  );
  await tester.pumpAndSettle();
  return (stores, products);
}

void main() {
  testWidgets(
    'native original-registration stop confirms the request and clears its CSV without importing products',
    (tester) async {
      final (_, products) = await mount(tester, pending: true);
      await tester.enterText(find.byType(TextField), fixture.csv);
      final stop = find.widgetWithText(TextButton, 'Stop original request');
      await tester.ensureVisible(stop);
      await tester.tap(stop);
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('Stop original request'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Registration was stopped before any rows were accepted.'),
        findsOneWidget,
      );
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty,
      );
      expect(products.submissions, isEmpty);
      expect(products.pending, isFalse);
    },
  );
  testWidgets(
    'native CSV entry shows existing recovery during a new-import capability outage',
    (tester) async {
      final (_, products) = await mount(tester, unavailable: true);
      expect(find.text('Synthetic recovery outage'), findsOneWidget);
      final start = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Start import'),
      );
      expect(start.onPressed, isNull);
      final history = find.text('failed · 1/2 committed');
      await tester.ensureVisible(history);
      await tester.tap(history);
      await tester.pumpAndSettle();
      expect(find.textContaining('1/2 products committed'), findsOneWidget);
      expect(find.text('Row 1: completed'), findsOneWidget);
      expect(find.text('Row 2: failed'), findsOneWidget);
      expect(products.submissions, isEmpty);
    },
  );
  testWidgets(
    'native CSV contents and a late submitted result retire across A-B-A store navigation',
    (tester) async {
      final (stores, products) = await mount(tester);
      products.reply = Completer<ProductImportJob>();
      await tester.enterText(find.byType(TextField), fixture.csv);
      final start = find.widgetWithText(FilledButton, 'Start import');
      await tester.ensureVisible(start);
      await tester.tap(start);
      await tester.pump();
      expect(products.submissions, [fixture.csv]);
      final away = stores.selectStore(stores.stores.last);
      await tester.pump();
      await away;
      await tester.pump();
      final back = stores.selectStore(stores.stores.first);
      await tester.pump();
      await back;
      await tester.pump();
      products.reply!.complete(products.existing);
      await tester.pumpAndSettle();
      expect(find.textContaining('Account or store changed'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(find.text(fixture.jobId), findsNothing);
    },
  );
}
