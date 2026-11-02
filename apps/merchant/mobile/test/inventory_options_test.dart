import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'inventory_scope_boundary_test.dart' as scope;
import 'inventory_workspace_test.dart' as workspace;
import 'support/warehouse_fixture.dart' as w;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final supplier in [false, true]) {
    JsonMap row({String site = scope.a, int index = 1}) => supplier
        ? w.warehouseSupplierRecord(
            site: site,
            id: 'cccccccc-cccc-4ccc-8ccc-${index.toString().padLeft(12, '0')}',
            name: 'Choice $index',
          )
        : w.warehouseLocationRecord(
            site: site,
            id: 'cccccccc-cccc-4ccc-8ccc-${index.toString().padLeft(12, '0')}',
            name: 'Choice $index',
          );
    for (final fault in [
      'missing',
      'meta-site',
      'page',
      'limit',
      'count',
      'exact',
      'more',
      'duplicate',
      'scope',
      'alias',
      'address',
      'date',
      'deleted',
      'status',
    ])
      test(
        '${supplier ? 'supplier' : 'location'} isolated choices reject $fault',
        () async {
          final api = scope.client((r, h) {
            final record = row(),
                rows = [record],
                meta = w.warehousePageMeta(site: scope.a);
            if (fault == 'meta-site') meta['store_id'] = scope.b;
            if (fault == 'page') meta['page'] = 2;
            if (fault == 'limit') meta['per_page'] = 100;
            if (fault == 'count') meta['total'] = 2;
            if (fault == 'exact') meta['total_is_exact'] = false;
            if (fault == 'more') meta['has_next'] = true;
            if (fault == 'duplicate') {
              rows.add(record);
              meta['total'] = 2;
            }
            if (fault == 'scope')
              record[supplier ? 'site_id' : 'store_id'] = scope.b;
            if (fault == 'alias')
              record[supplier ? 'store_id' : 'site_id'] = scope.b;
            if (fault == 'address') record.remove('address');
            if (fault == 'date') record['created_at'] = 'invalid';
            if (fault == 'deleted')
              record['deleted_at'] = '2026-11-01T00:00:00Z';
            if (fault == 'status') record['status'] = 'inactive';
            h.resolve(
              Response(
                requestOptions: r,
                statusCode: 200,
                data: {'data': rows, if (fault != 'missing') 'meta': meta},
              ),
            );
          });
          final service = InventoryService(api: api);
          await expectLater(
            supplier
                ? service.readSuppliersPage(scope.a)
                : service.readLocationsPage(scope.a),
            throwsA(
              isA<ApiException>().having(
                (e) => e.code,
                'code',
                'WAREHOUSE_OPTIONS_UNVERIFIED',
              ),
            ),
          );
          expect(service.locations, isEmpty);
          expect(service.suppliers, isEmpty);
        },
      );
    test(
      '${supplier ? 'supplier' : 'location'} choices preserve independent list state and pin current filter requests',
      () async {
        final queries = <RequestOptions>[];
        final api = scope.client((r, h) {
          queries.add(r);
          final page = r.queryParameters['page'] as int;
          scope.respond(
            r,
            h,
            [row(index: page)],
            meta: w.warehousePageMeta(
              site: scope.a,
              page: page,
              limit: 1,
              total: 2,
            ),
          );
        });
        final service = InventoryService(api: api);
        if (supplier)
          await service.fetchSuppliers(scope.a, limit: 1);
        else
          await service.fetchLocations(scope.a, limit: 1);
        final options = supplier
            ? await service.readSuppliersPage(
                scope.a,
                page: 2,
                limit: 1,
                search: 'SYN_%',
              )
            : await service.readLocationsPage(
                scope.a,
                page: 2,
                limit: 1,
                search: 'SYN_%',
              );
        expect(options.total, 2);
        expect(options.hasMore, isFalse);
        expect(options.page, 2);
        expect(
          supplier
              ? service.suppliers.single.name
              : service.locations.single.name,
          'Choice 1',
        );
        expect(supplier ? service.suppliersTotal : service.locationsTotal, 2);
        expect(queries.last.queryParameters, containsPair('status', 'active'));
        expect(queries.last.queryParameters, containsPair('search', 'SYN_%'));
        expect(queries.last.headers['X-Store-ID'], scope.a);
      },
    );
    test(
      '${supplier ? 'supplier' : 'location'} delayed choice cannot escape a store context change',
      () async {
        var version = 1;
        final entered = Completer<void>(), release = Completer<void>();
        final api = scope.client((r, h) async {
          entered.complete();
          await release.future;
          scope.respond(r, h, [
            row(),
          ], meta: w.warehousePageMeta(site: scope.a));
        }, scope: () => version);
        final service = InventoryService(api: api),
            pending = supplier
                ? service.readSuppliersPage(scope.a)
                : service.readLocationsPage(scope.a);
        final outcome = expectLater(
          pending,
          throwsA(
            isA<ApiException>().having(
              (e) => e.code,
              'code',
              'SESSION_CONTEXT_CHANGED',
            ),
          ),
        );
        await entered.future;
        version++;
        release.complete();
        await outcome;
      },
    );
    testWidgets(
      '${supplier ? 'supplier' : 'location'} screen pages have exact counts and Previous recovery after denial',
      (tester) async {
        final pages = <int>[];
        await workspace.mount(
          tester,
          supplier
              ? const InventorySuppliersScreen()
              : const InventoryLocationsScreen(),
          (r, h) {
            final page = r.queryParameters['page'] as int? ?? 1;
            pages.add(page);
            workspace.respond(
              r,
              h,
              page == 2
                  ? []
                  : List.generate(
                      20,
                      (i) => row(site: workspace.siteA, index: i + 1),
                    ),
              status: page == 2 ? 403 : 200,
              more: page == 1,
              meta: w.warehousePageMeta(
                site: workspace.siteA,
                page: page,
                total: 21,
              ),
            );
          },
        );
        expect(find.text('21 matching records · Page 1'), findsOneWidget);
        await tester.tap(find.byTooltip('Next page'));
        await tester.pumpAndSettle();
        expect(pages.last, 2);
        expect(find.text('Page 2 · Count unavailable'), findsOneWidget);
        expect(find.text('Choice 1'), findsNothing);
        await tester.tap(find.byTooltip('Previous page'));
        await tester.pumpAndSettle();
        expect(find.text('Choice 1'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
