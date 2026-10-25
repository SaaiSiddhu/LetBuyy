import 'package:letbuyy_store/services/native_push_service.dart';
import 'package:letbuyy_store/widgets/dashboard/animated_revenue_chart.dart';
import 'package:path_provider/path_provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/screens/products/products_screen.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/screens/orders/orders_screen.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/settings/store_details_screen.dart';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/main.dart' as app;
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/main/store_main_screen.dart';
import 'package:letbuyy_store/screens/content/media_library_screen.dart';
import 'package:letbuyy_store/screens/settings/notifications_screen.dart';
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/services/notification_settings_service.dart';
import 'package:letbuyy_store/services/store_auth_service.dart';
import 'package:letbuyy_store/widgets/shared/barcode_scanner_sheet.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/inventory_service.dart';

// Explicit local device job. Normal UI sign-in; real mounted API and database.
// Creates only named synthetic operational fixtures; no real provider actions.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'merchant actions persist from physical UI through backend',
    (tester) async {
      expect(AppConfig.environment, 'local');
      await tester.runAsync(() async {
        app.main();
        await Future<void>.delayed(const Duration(seconds: 4));
      });
      await tester.pump(const Duration(seconds: 2));
      Future<void> waitFor(Finder finder) async {
        for (var i = 0; i < 30 && finder.evaluate().isEmpty; i++) {
          await tester.pump(const Duration(seconds: 1));
        }
        expect(finder, findsWidgets);
      }

      // Cached session restoration and the login challenge finish asynchronously.
      for (var i = 0; i < 40; i++) {
        if (find.byType(StoreMainScreen).evaluate().isNotEmpty ||
            find.text('Security check passed').evaluate().isNotEmpty)
          break;
        await tester.pump(const Duration(seconds: 1));
      }
      if (find.byType(StoreMainScreen).evaluate().isEmpty) {
        await waitFor(find.text('Security check passed'));
        await tester.enterText(
          find.byType(TextFormField).at(0),
          const String.fromEnvironment('AUDIT_MERCHANT_EMAIL'),
        );
        await tester.enterText(
          find.byType(TextFormField).at(1),
          const String.fromEnvironment('AUDIT_MERCHANT_PASSWORD'),
        );
        await tester.tap(find.text('Continue'));
      }
      await waitFor(find.byType(StoreMainScreen));
      final context = tester.element(find.byType(StoreMainScreen));
      final scope = context.read<StoreContext>();
      await scope.selectStoreById(
        const String.fromEnvironment('AUDIT_STORE_ID'),
      );
      final store = (await scope.ensureSelectedStore())!;
      final api = context.read<ApiClient>();
      final media = context.read<MediaService>();
      final products = context.read<ProductService>();
      final stores = context.read<StoreService>();
      final notifications = context.read<NotificationSettingsService>();
      final actor = context.read<StoreAuthService>().currentUser!.id;
      final inventory = context.read<InventoryService>();
      final nav = tester.state<NavigatorState>(find.byType(Navigator).first);
      final run = 'ui${DateTime.now().millisecondsSinceEpoch}';
      final results = <Map<String, Object?>>[];
      final errors = <String>[];
      final previous = FlutterError.onError;
      FlutterError.onError = (e) => errors.add(e.exceptionAsString());
      const filter = String.fromEnvironment('AUDIT_ACTION_FILTER');
      final selected = filter.split(',').where((s) => s.isNotEmpty).toSet();
      Future<void> tick([int seconds = 3]) async {
        for (var i = 0; i < seconds; i++) {
          await tester.pump(const Duration(seconds: 1));
        }
      }

      Future<void> open(Widget screen) async {
        nav.popUntil((r) => r.isFirst);
        ScaffoldMessenger.of(nav.context).clearSnackBars();
        FocusManager.instance.primaryFocus?.unfocus();
        await tick(2);
        nav.push(MaterialPageRoute<void>(builder: (_) => screen));
        await tick();
      }

      Future<void> tap(Finder f) async {
        if (f.evaluate().isEmpty) {
          final scroll = find.byWidgetPredicate(
            (w) => w is Scrollable && w.restorationId != 'editable',
          );
          if (scroll.evaluate().isNotEmpty) {
            await tester.scrollUntilVisible(
              f,
              160,
              scrollable: scroll.last,
              maxScrolls: 16,
            );
          }
        }
        await waitFor(f);
        FocusManager.instance.primaryFocus?.unfocus();
        await tick(2);
        await tester.ensureVisible(f.first);
        await tester.pump(const Duration(milliseconds: 300));
        await tester.tap(f.hitTestable().first);
        await tick(2);
      }

      Future<void> fill(String label, String value) async {
        final f = find.byWidgetPredicate(
          (w) => w is TextField && w.decoration?.labelText == label,
        );
        if (f.evaluate().isEmpty) {
          final scroll = find.byWidgetPredicate(
            (w) => w is Scrollable && w.restorationId != 'editable',
          );
          if (scroll.evaluate().isNotEmpty) {
            await tester.scrollUntilVisible(
              f,
              180,
              scrollable: scroll.last,
              maxScrolls: 12,
            );
          }
        }
        expect(f, findsWidgets, reason: 'Missing field: $label');
        await tester.ensureVisible(f.first);
        await tester.enterText(f.first, value);
        await tester.pump();
      }

      Future<void> action(String name, Future<void> Function() fn) async {
        if (selected.isNotEmpty && !selected.contains(name)) return;
        errors.clear();
        try {
          await fn().timeout(const Duration(minutes: 5));
          expect(errors, isEmpty);
          results.add({'action': name, 'result': 'pass'});
          print('ACTION_AUDIT $name PASS');
        } catch (e, stack) {
          results.add({
            'action': name,
            'result': 'fail',
            'error': e is ApiException
                ? '${e.statusCode} ${e.code}: ${e.message}'
                : e.toString(),
            'frameworkErrors': List.of(errors),
            'stack': stack.toString().split('\n').take(20).join('\n'),
          });
          print('ACTION_AUDIT $name FAIL: ${results.last['error']}');
        } finally {
          binding.reportData = {
            'run': run,
            'store': store.id,
            'actions': results,
          };
          nav.popUntil((r) => r.isFirst);
          await tick(1);
        }
      }

      Future<void> nativeGate(String stage) async {
        final signal = File(
          '/data/user/0/com.letbuyy.store/files/native-audit-continue',
        );
        print('NATIVE_READY $stage');
        for (var i = 0; i < 240; i++) {
          await tick(1);
          if (await signal.exists() &&
              (await signal.readAsString()).trim() == stage) {
            await signal.delete();
            await tick(3);
            return;
          }
        }
        throw StateError('Native action did not finish: $stage');
      }

      Future<void> beginMedia(String source) async {
        await open(const MediaLibraryScreen());
        await tap(find.text('Upload'));
        await tap(find.text('Upload image'));
        await tap(find.text(source));
      }

      Future<void> uploadedMedia(String stage) async {
        final before = (await media.fetchMedia(
          store.id,
        )).map((a) => a.id).toSet();
        await beginMedia(stage == 'gallery' ? 'Photo library' : 'Take photo');
        await nativeGate(stage);
        List<MediaAssetContract> added = [];
        for (var i = 0; i < 20; i++) {
          added = (await media.fetchMedia(
            store.id,
          )).where((a) => !before.contains(a.id)).toList();
          if (added.isNotEmpty) break;
          await tick(1);
        }
        expect(
          added.length,
          1,
          reason: 'Native selected image must reach database',
        );
        final asset = added.single;
        final client = HttpClient();
        try {
          final response = await (await client.getUrl(
            Uri.parse(asset.url),
          )).close();
          expect(response.statusCode, 200);
          expect(
            (await response.fold<int>(0, (sum, bytes) => sum + bytes.length)),
            greaterThan(100),
          );
        } finally {
          client.close(force: true);
        }
        expect(asset.storageKey, isNotNull);
        await media.deleteMedia(asset, deleteObject: true);
        final deletedClient = HttpClient();
        try {
          expect(
            (await (await deletedClient.getUrl(
              Uri.parse(asset.url),
            )).close()).statusCode,
            404,
          );
        } finally {
          deletedClient.close(force: true);
        }
        expect(
          (await media.fetchMedia(store.id)).any((a) => a.id == asset.id),
          isFalse,
        );
      }

      if (selected.any((name) => name.contains('barcode'))) {
        if (await inventory.lookupBarcode(
              storeId: store.id,
              barcode: 'LB-NATIVE-AUDIT-20261020',
            ) ==
            null) {
          await api.products.create({
            'store_id': store.id,
            'name': 'Synthetic native barcode fixture',
            'price': 100,
            'stock': 3,
            'barcode': 'LB-NATIVE-AUDIT-20261020',
            'sku': 'LB-NATIVE-AUDIT-20261020',
            'is_active': false,
            'country_of_origin': 'India',
          });
        }
      }
      try {
        await action('daily-revenue-periods', () async {
          nav.popUntil((r) => r.isFirst);
          await tap(find.bySemanticsLabel('Home tab'));
          for (final entry in const {
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '12m': 365,
          }.entries) {
            await tap(find.byKey(ValueKey('revenue-period-${entry.key}')));
            for (var i = 0; i < 60; i++) {
              await tick(1);
              final found = find.byType(AnimatedRevenueChart);
              if (found.evaluate().isNotEmpty &&
                  tester
                          .widget<AnimatedRevenueChart>(found)
                          .revenueData
                          .length ==
                      entry.value)
                break;
            }
            final chart = tester.widget<AnimatedRevenueChart>(
              find.byType(AnimatedRevenueChart),
            );
            expect(chart.period, entry.key);
            expect(chart.revenueData.length, entry.value);
            final fresh = await api.analytics.revenue({
              'store_id': store.id,
              'period': entry.key,
            });
            final points = asJsonList(fresh['chart']).map(asJsonMap).toList();
            expect(
              chart.revenueData,
              points.map((p) => (p['revenue'] as num).toDouble()).toList(),
            );
            expect(
              chart.revenueDates
                  .map((d) => d.toIso8601String().substring(0, 10))
                  .toList(),
              points.map((p) => p['date']).toList(),
            );
            expect(find.text('Revenue history unavailable'), findsNothing);
          }
        });
        await action('android-notification-presentation', () async {
          final native = context.read<NativePushService>();
          debugPrint('NATIVE_READY android-notification-permission');
          expect(await native.requestPermission(), isTrue);
          final title = 'Synthetic Push Audit $run';
          await api.requestJson(
            '/notifications/send',
            options: ApiRequestOptions(
              method: HttpMethod.post,
              body: {
                'site_id': store.id,
                'recipient': {'actor_id': actor},
                'preferred_channels': ['in_app'],
                'message': {
                  'channel': 'in_app',
                  'template_key': 'native.audit',
                  'subject': title,
                  'body': 'Synthetic backend notification presentation check',
                },
                'idempotency_key': '$run-native-presentation',
              },
            ),
          );
          final inbox = (await notifications.fetchInbox(
            limit: 100,
          )).firstWhere((n) => n.title == title);
          await native.showAlert(
            id: inbox.id,
            userId: actor,
            title: inbox.title,
            body: inbox.message ?? '',
          );
          await nativeGate('android-notification-tap');
          await waitFor(find.byType(NotificationsScreen));
          expect(find.text(title), findsWidgets);
          await notifications.deleteNotification(inbox.id);
          await native.bindActor(null);
          await native.bindActor(actor);
        });
        await action('native-camera-denial', () async {
          await beginMedia('Take photo');
          await nativeGate('camera-denial');
          expect(find.textContaining('Could not open camera'), findsWidgets);
          expect(find.text('Upload'), findsOneWidget);
        });
        await action('native-gallery-upload', () => uploadedMedia('gallery'));
        await action('native-camera-upload', () => uploadedMedia('camera'));
        await action('native-camera-cancel', () async {
          final before = (await media.fetchMedia(
            store.id,
          )).map((a) => a.id).toSet();
          await beginMedia('Take photo');
          await nativeGate('camera-cancel');
          expect(
            (await media.fetchMedia(store.id)).map((a) => a.id).toSet(),
            before,
          );
        });
        await action('native-barcode-manual-and-cancel', () async {
          String? code;
          final future = showBarcodeScannerSheet(
            nav.context,
          ).then((value) => code = value);
          await tick(2);
          await tap(find.byTooltip('Enter barcode manually'));
          await fill('Barcode', 'LB-NATIVE-AUDIT-20261020');
          await tap(find.text('Cancel'));
          expect(find.byTooltip('Close scanner'), findsOneWidget);
          await tap(find.byTooltip('Enter barcode manually'));
          await fill('Barcode', 'LB-NATIVE-AUDIT-20261020');
          await tap(find.text('Use code'));
          await future;
          expect(code, 'LB-NATIVE-AUDIT-20261020');
          final result = await inventory.lookupBarcode(
            storeId: store.id,
            barcode: code!,
          );
          expect(result, isNotNull);
        });
        await action('native-inventory-barcode-adjust', () async {
          final lookup = (await inventory.lookupBarcode(
            storeId: store.id,
            barcode: 'LB-NATIVE-AUDIT-20261020',
          ))!;
          final location = (await inventory.fetchLocations(store.id)).first;
          int quantity(List<InventoryLevel> levels) => levels
              .where(
                (l) =>
                    l.productId == lookup.productId &&
                    l.locationId == location.id,
              )
              .fold<int>(0, (sum, l) => sum + l.available);
          final before = quantity(await inventory.fetchLevels(store.id));
          await open(const InventoryScreen());
          await tap(find.byTooltip('Scan barcode'));
          await tap(find.byTooltip('Enter barcode manually'));
          await fill('Barcode', 'LB-NATIVE-AUDIT-20261020');
          await tap(find.text('Use code'));
          await fill('Change quantity', '1');
          await fill('Location ID', location.id);
          await tap(find.text('Apply'));
          expect(quantity(await inventory.fetchLevels(store.id)), before + 1);
          await inventory.adjustScannedStock(
            storeId: store.id,
            lookup: lookup,
            delta: -1,
            reason: 'correction',
            locationId: location.id,
            note: 'Restore synthetic native barcode audit quantity',
          );
          expect(quantity(await inventory.fetchLevels(store.id)), before);
        });
        await action('native-barcode-optical', () async {
          String? code;
          final future = showBarcodeScannerSheet(
            nav.context,
          ).then((value) => code = value);
          await tick(2);
          await nativeGate('barcode');
          await future.timeout(const Duration(seconds: 30));
          expect(code, 'LB-NATIVE-AUDIT-20261020');
          expect(
            await inventory.lookupBarcode(storeId: store.id, barcode: code!),
            isNotNull,
          );
        });
        await action('native-notification-inbox-and-actions', () async {
          for (final suffix in ['one', 'two']) {
            await api.post(
              '/notifications/send',
              body: {
                'site_id': store.id,
                'category': 'system',
                'recipient': {'actor_id': actor},
                'message': {
                  'channel': 'in_app',
                  'template_key': 'native.audit',
                  'subject': '$run $suffix',
                  'body': 'Synthetic native inbox check',
                },
                'preferred_channels': ['in_app'],
                'idempotency_key': '$run-notification-$suffix',
              },
            );
          }
          await open(const NotificationsScreen());
          await tap(find.text('$run one'));
          final rows = await notifications.fetchInbox(limit: 100);
          expect(rows.singleWhere((n) => n.title == '$run one').isRead, isTrue);
          await tap(find.text('Mark all read'));
          expect(
            (await notifications.fetchInbox(
              limit: 100,
            )).where((n) => n.title.startsWith(run)).every((n) => n.isRead),
            isTrue,
          );
          await tap(find.byTooltip('Notification actions').first);
          await tap(find.text('Delete'));
          await tap(find.byTooltip('Refresh notifications'));
          for (final row in await notifications.fetchInbox(limit: 100)) {
            if (row.title.startsWith(run))
              await notifications.deleteNotification(row.id);
          }
        });
        await action('native-notification-all-preferences', () async {
          final original = await notifications.fetchSettings(store.id);
          await open(const NotificationsScreen());
          final titles = [
            'Email',
            'SMS',
            'Push',
            'New orders',
            'Payments',
            'Low stock',
            'Refunds',
            'Customer signups',
            'Marketing',
          ];
          try {
            for (final title in titles) {
              final f = find.widgetWithText(SwitchListTile, title);
              if (f.evaluate().isEmpty) {
                await tester.scrollUntilVisible(
                  find.text(title),
                  180,
                  scrollable: find
                      .byWidgetPredicate(
                        (w) => w is Scrollable && w.restorationId != 'editable',
                      )
                      .last,
                );
              }
              final tile = tester.widget<SwitchListTile>(
                find.widgetWithText(SwitchListTile, title),
              );
              final before = tile.value;
              await tap(find.widgetWithText(SwitchListTile, title));
              final fresh = await notifications.fetchSettings(store.id);
              final values = {
                'Email': fresh.emailEnabled,
                'SMS': fresh.smsEnabled,
                'Push': fresh.pushEnabled,
                'New orders': fresh.orderCreated,
                'Payments': fresh.orderPaid,
                'Low stock': fresh.lowStock,
                'Refunds': fresh.refunds,
                'Customer signups': fresh.customerSignup,
                'Marketing': fresh.marketing,
              };
              expect(
                values[title],
                !before,
                reason: 'Preference $title must persist',
              );
            }
          } finally {
            await notifications.updateSettings(original);
          }
        });
        await action('native-share-store', () async {
          nav.popUntil((r) => r.isFirst);
          await tick(2);
          await tap(find.bySemanticsLabel('Share store'));
          await nativeGate('share-store');
        });
        await action('native-share-qr', () async {
          nav.popUntil((r) => r.isFirst);
          await tick(2);
          await tap(find.bySemanticsLabel('Store QR code'));
          await tap(find.text('Share QR'));
          await nativeGate('share-qr');
          final file = File(
            '${(await getTemporaryDirectory()).path}/${store.subdomain}_qr.png',
          );
          expect(await file.exists(), isTrue);
          final decoder = MobileScannerController(autoStart: false);
          try {
            final capture = await decoder.analyzeImage(file.path);
            final expected = AppConfig.storefrontUrlFor(
              subdomain: store.subdomain,
              publicUrl: store.publicUrl,
            );
            expect(
              capture?.barcodes.any((barcode) => barcode.rawValue == expected),
              isTrue,
            );
          } finally {
            await decoder.dispose();
          }
        });

        for (final kind in ['products', 'orders', 'customers']) {
          await action('native-share-$kind-csv', () async {
            if (kind == 'products') {
              await open(const ProductsScreen());
              await tap(find.text('Export'));
              await tap(find.text('Export as CSV'));
            }
            if (kind == 'orders') {
              await open(const OrdersScreen());
              await tap(find.text('Export'));
              await tap(find.text('Export as CSV'));
            }
            if (kind == 'customers') {
              await open(const CustomersScreen());
              await tap(find.byTooltip('Export customers'));
            }
            await nativeGate('share-$kind-csv');
          });
        }
        await action('native-share-packing-slip-pdf', () async {
          await open(const OrdersScreen());
          await tap(find.text('Print'));
          await tap(find.text('Copy'));
          await tap(find.text('Print'));
          await tap(find.text('Share PDF'));
          await nativeGate('share-pdf');
        });
        await action('native-product-gallery-save', () async {
          final created = await api.products.create({
            'store_id': store.id,
            'name': 'Synthetic native photo $run',
            'description': 'Synthetic native gallery persistence check',
            'price': 100,
            'stock': 0,
            'sku': '$run-photo',
            'is_active': false,
            'country_of_origin': 'India',
          });
          final product = await products.fetchProductForEdit(
            created['id'].toString(),
            store.id,
          );
          await open(ProductFormScreen(product: product));
          await tap(find.text('Images'));
          await tap(find.bySemanticsLabel('Add product image'));
          await tap(find.text('Photo library'));
          await nativeGate('product-gallery');
          expect(
            find.bySemanticsLabel('Product image 1, primary'),
            findsOneWidget,
          );
          await tap(find.text('Update'));
          final saved = await products.fetchProductForEdit(
            product.id,
            store.id,
          );
          expect(saved.images.length, 1);
          final url = saved.images.first;
          final client = HttpClient();
          try {
            expect(
              (await (await client.getUrl(Uri.parse(url))).close()).statusCode,
              200,
            );
          } finally {
            client.close(force: true);
          }
          await products.deleteProduct(product.id);
          final key = Uri.parse(url).path.split('/__local/assets/').last;
          await api.upload.remove(key, storeId: store.id);
        });
        await action('native-store-logo-gallery-save', () async {
          final original = await stores.fetchStore(store.id);
          await open(const StoreDetailsScreen());
          await waitFor(find.text('Tap to change logo'));
          await tap(find.byKey(const ValueKey('store-details-logo-picker')));
          await tap(find.text('Photo library'));
          await nativeGate('store-logo-gallery');
          final saved = await stores.fetchStore(store.id);
          expect(saved.logoUrl, isNot(original.logoUrl));
          expect(saved.logoUrl, isNotNull);
          final url = saved.logoUrl!;
          final client = HttpClient();
          try {
            expect(
              (await (await client.getUrl(Uri.parse(url))).close()).statusCode,
              200,
            );
          } finally {
            client.close(force: true);
          }
          final restored = await stores.updateStore(store.id, {
            'logo_url': original.logoUrl,
          });
          await scope.selectStore(restored);
          await api.upload.remove(
            Uri.parse(url).path.split('/__local/assets/').last,
            storeId: store.id,
          );
        });
      } finally {
        FlutterError.onError = previous;
        binding.reportData = {
          'run': run,
          'store': store.id,
          'actions': results,
        };
      }
      expect(results.where((r) => r['result'] == 'fail').toList(), isEmpty);
    },
    skip: !const bool.fromEnvironment('RUN_LOCAL_ACTION_AUDIT'),
    timeout: const Timeout(Duration(minutes: 45)),
  );
}
