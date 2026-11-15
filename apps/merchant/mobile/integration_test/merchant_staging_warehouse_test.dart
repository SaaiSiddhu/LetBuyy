import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart'
    show initializeLetbuyyTypography;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

import 'support/resolved_staging_transport.dart';

// Explicit, approved staging job. The fixture is supplied to this app's private
// files directory over task-owned ADB stdin; credentials never enter defines,
// source, APK assets, command arguments or test output. This exercises real
// screens and the hosted BFF, not normal password/CAPTCHA/Accounts UI sign-in.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'staging warehouse screens persist and retire actor scope',
    (tester) async {
      expect(AppConfig.environment, 'staging');
      expect(AppConfig.endpointConfigurationError(), isNull);
      const directory = '/data/user/0/com.letbuyy.store/files';
      final fixture = Map<String, dynamic>.from(
        jsonDecode(
              File(
                '$directory/merchant-staging-warehouse-fixture.json',
              ).readAsStringSync(),
            )
            as Map,
      );
      expect(fixture['environment'], 'staging');
      expect(fixture['published'], false);
      final namePrefix = fixture['namePrefix'] as String;
      expect(namePrefix.startsWith('Synthetic Native '), isTrue);
      final expectedPincode = fixture['expectedPincode'] as String? ?? '560001';
      expect(RegExp(r'^[0-9]{6}$').hasMatch(expectedPincode), isTrue);
      final owner = Map<String, dynamic>.from(fixture['owner'] as Map);
      final other = Map<String, dynamic>.from(fixture['otherOwner'] as Map);
      var actor = owner['id'] as String;
      var token = owner['token'] as String;
      StoreContext? scope;
      final resolved = fixture['resolvedBffAddress'];
      if (resolved != null) {
        expect(resolved['hostname'], 'bff-staging.letbuyy.com');
        final age = DateTime.now().toUtc().difference(
          DateTime.parse(resolved['resolvedUtc'] as String),
        );
        expect(age.isNegative, isFalse);
        expect(age, lessThan(const Duration(minutes: 10)));
      }
      final api = ApiClient(
        baseUrl: AppConfig.bffBaseUrl,
        tokenProvider: () => token,
        storeIdProvider: () => scope?.selectedStoreId,
        contextVersionProvider: () => scope?.requestContextKey,
        attachSessionCookie: true,
        sessionCookieName: AppConfig.sessionCookieName,
        receiveTimeout: const Duration(seconds: 45),
        dio: resolved == null
            ? null
            : resolvedStagingVerificationTransport(resolved['ipv4'] as String),
      );
      final stores = StoreService(api: api);
      final storeScope = StoreContext(storeService: stores);
      scope = storeScope;
      final inventory = InventoryService(
        api: api,
        actorIdProvider: () => actor,
        storeIdProvider: () => storeScope.selectedStoreId,
      );
      final checks = <String>[];
      final result = <String, Object?>{
        'environment': 'staging',
        'normalPasswordLogin': false,
        'realNativeScreens': true,
        'realHostedBff': true,
        'productionWrite': false,
        'hostResolvedTestTransport': resolved != null,
        'nativeDnsAccepted': resolved == null,
        'certificateVerification': 'default trust roots and original hostname',
      };
      void record(String name) {
        checks.add(name);
        result['checks'] = checks;
        binding.reportData = Map<String, Object?>.from(result);
        debugPrint('STAGING_WAREHOUSE_RESULT ${jsonEncode(result)}');
        File(
          '$directory/merchant-staging-warehouse-result.json',
        ).writeAsStringSync('${jsonEncode(result)}\n');
      }

      // LiveTestWidgetsBinding.runAsync reports caught errors and returns null.
      // Propagate them here so a failed prerequisite cannot record a later pass.
      Future<void> realIO(Future<void> Function() action) async {
        Object? failure;
        StackTrace? stack;
        await tester.runAsync(() async {
          try {
            await action();
          } catch (error, trace) {
            failure = error;
            stack = trace;
          }
        });
        if (failure != null) Error.throwWithStackTrace(failure!, stack!);
      }

      Future<void> waitUntil(bool Function() ready, String reason) async {
        for (var i = 0; i < 90 && !ready(); i++) {
          await tester.pump(const Duration(milliseconds: 500));
        }
        expect(ready(), isTrue, reason: reason);
        expect(tester.takeException(), isNull);
      }

      Future<void> open(Widget screen) async {
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<StoreContext>.value(value: storeScope),
              ChangeNotifierProvider<InventoryService>.value(value: inventory),
            ],
            child: MaterialApp(theme: StoreTheme.light(), home: screen),
          ),
        );
        await tester.pump();
      }

      Future<void> tap(String label) async {
        final finder = find.text(label).last;
        await tester.ensureVisible(finder);
        await tester.tap(finder);
        await tester.pump(const Duration(milliseconds: 500));
      }

      Future<void> fill(String label, String value) async {
        final finder = find.byWidgetPredicate(
          (widget) =>
              widget is TextField && widget.decoration?.labelText == label,
        );
        await waitUntil(
          () => finder.evaluate().isNotEmpty,
          'The current warehouse form has opened its $label field',
        );
        await tester.ensureVisible(finder);
        await tester.enterText(finder, value);
        await tester.pump();
      }

      try {
        await realIO(() async {
          await initializeLetbuyyTypography();
          final session = await api.auth.session();
          expect(session['authenticated'], true);
          expect(session['user']['id'], actor);
          await storeScope.bindActor(actor);
          await storeScope.loadStores(force: true);
          await storeScope.selectStoreById(owner['siteId'] as String);
        });
        record('canonical synthetic owner session and owned store validated');
        for (final supplier in [false, true]) {
          final name = '$namePrefix ${supplier ? 'Supplier' : 'Location'}';
          final site = owner['siteId'] as String;
          // A stopped test may already have committed. Reconcile by the named
          // synthetic row and never submit a new logical operation on a rerun.
          var exists = false;
          await realIO(() async {
            if (supplier) {
              final rows = await inventory.fetchSuppliers(site);
              exists = rows.any((row) => row.name == name);
            } else {
              final rows = await inventory.fetchLocations(site);
              exists = rows.any((row) => row.name == name);
            }
          });
          await open(
            supplier
                ? const InventorySuppliersScreen()
                : const InventoryLocationsScreen(),
          );
          await waitUntil(
            () =>
                tester
                    .widget<FloatingActionButton>(
                      find.byType(FloatingActionButton),
                    )
                    .onPressed !=
                null,
            'Current hosted warehouse capabilities and encrypted journal are ready',
          );
          if (!exists) {
            final label = supplier ? 'New supplier' : 'New location';
            final field = supplier ? 'Supplier name' : 'Name';
            // A capability recheck may retire readiness between the previous
            // frame and this tap. Reopen only the empty form, never a submitted
            // command; submission itself remains a single original intent.
            for (var attempt = 0; attempt < 3; attempt++) {
              await waitUntil(
                () =>
                    tester
                        .widget<FloatingActionButton>(
                          find.byType(FloatingActionButton),
                        )
                        .onPressed !=
                    null,
                'Current warehouse action is available',
              );
              await tap(label);
              await tester.pump(const Duration(seconds: 1));
              if (find
                  .byWidgetPredicate(
                    (widget) =>
                        widget is TextField &&
                        widget.decoration?.labelText == field,
                  )
                  .evaluate()
                  .isNotEmpty)
                break;
            }
            await fill(supplier ? 'Supplier name' : 'Name', name);
            if (supplier) {
              await fill('Email', 'native-stage@example.invalid');
            } else {
              await fill('City', 'Bengaluru');
              await fill('State', 'Karnataka');
              await fill('Pincode (optional)', expectedPincode);
            }
            FocusManager.instance.primaryFocus?.unfocus();
            await tester.pump(const Duration(milliseconds: 500));
            await tap(supplier ? 'Create supplier' : 'Create location');
          }
          await waitUntil(
            () => find.text(name).evaluate().isNotEmpty,
            'The real screen reloads the committed named staging row',
          );
          await realIO(() async {
            if (supplier) {
              final rows = await inventory.fetchSuppliers(site);
              expect(rows.where((row) => row.name == name), hasLength(1));
            } else {
              final rows = await inventory.fetchLocations(site);
              final matches = rows.where((row) => row.name == name).toList();
              expect(matches, hasLength(1));
              final page = await api.inventory.locations(storeId: site);
              final raw = page.data.singleWhere(
                (row) => row['id'] == matches.single.id,
              );
              expect(raw['address']['pincode'], expectedPincode);
            }
            expect(await inventory.pendingWarehouseCommand(site), isNull);
          });
          record(
            '${supplier ? 'supplier' : 'location'} native form, hosted readback '
            'and resolved encrypted intent${exists ? ' (prior commit reconciled)' : ''}',
          );
        }
        await realIO(() async {
          actor = other['id'] as String;
          token = other['token'] as String;
          await stores.clearSessionStores();
          await storeScope.bindActor(actor);
          final session = await api.auth.session();
          expect(session['user']['id'], actor);
          await storeScope.loadStores(force: true);
          await storeScope.selectStoreById(other['siteId'] as String);
        });
        await tester.pump(const Duration(seconds: 1));
        expect(find.text('$namePrefix Supplier'), findsNothing);
        await open(const InventorySuppliersScreen());
        await waitUntil(
          () =>
              tester
                  .widget<FloatingActionButton>(
                    find.byType(FloatingActionButton),
                  )
                  .onPressed !=
              null,
          'Second synthetic owner has its own current capabilities',
        );
        expect(find.text('$namePrefix Supplier'), findsNothing);
        await realIO(() async {
          try {
            await api.inventory.suppliers(storeId: owner['siteId'] as String);
            fail('A different owner must not read the first populated store');
          } on ApiException catch (error) {
            expect(error.statusCode, 403);
          }
        });
        record(
          'actor switch retires prior rows; populated cross-tenant read denied',
        );
        result['status'] = 'passed-bounded-staging-native-warehouse-ui';
        record('completed');
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        inventory.dispose();
        storeScope.dispose();
        stores.dispose();
      }
    },
    timeout: const Timeout(Duration(minutes: 8)),
  );
}
