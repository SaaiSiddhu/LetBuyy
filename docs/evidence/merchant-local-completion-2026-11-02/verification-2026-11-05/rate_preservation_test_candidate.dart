// Prepared outside frozen inputs. Run/move only after the currently active
// qualification or native run has a collected terminal and owned cleanup.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/settings/shipping_screen.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/shipping_tax_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'shipping_settings_scope_test.dart' as f;

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final limits in [(0, 1250), (250, 1250), (null, 1250), (250, null)]) {
    testWidgets('rate price edit preserves saved weight limits $limits', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      late StoreContext stores;
      final patches = <Map<String, dynamic>>[];
      var rateReads = 0;
      var saved = <String, dynamic>{
        ...f.row('rates', f.siteA, 1),
        'name': 'Saved weighted rate',
        'type': 'weight_based',
        'min_weight_grams': limits.$1,
        'max_weight_grams': limits.$2,
      };
      final api = f.apiFor((request, handler) {
        final path = Uri.parse(request.path).path;
        if (path.endsWith('/stores') && request.method == 'GET') {
          f.reply(request, handler, [
            {
              'id': f.siteA,
              'name': 'Synthetic weight store',
              'subdomain': 'synthetic-weight-store',
              'currency': 'INR',
            },
          ]);
        } else if (path.endsWith('/shipping-tax/shipping/zones') &&
            request.method == 'GET') {
          f.reply(request, handler, [
            {...f.row('zones', f.siteA, 500), 'name': 'Saved zone', 'countries': ['IN']},
            {...f.row('zones', f.siteA, 501), 'name': 'Other zone', 'countries': ['IN']},
          ]);
        } else if (path.endsWith('/shipping-tax/shipping') &&
            request.method == 'GET') {
          rateReads++;
          f.reply(request, handler, [saved]);
        } else if (path.endsWith('/shipping-tax/shipping/${f.rowId(1)}') &&
            request.method == 'PATCH') {
          expect(request.headers['X-Store-ID'], f.siteA);
          final body = Map<String, dynamic>.from(request.data as Map);
          patches.add(body);
          saved = {...saved, ...body};
          f.reply(request, handler, saved);
        } else {
          throw StateError('Unexpected synthetic rate request ${request.method} $path');
        }
      }, () => stores.requestContextKey);
      final service = StoreService(api: api, cache: CacheService.memory());
      stores = StoreContext(storeService: service);
      await stores.bindActor('synthetic-weight-owner');
      await stores.ensureSelectedStore();
      final settings = ShippingTaxService(
        api: api,
        storeIdProvider: () => stores.selectedStoreId,
      );
      addTearDown(settings.dispose);
      addTearDown(stores.dispose);
      addTearDown(service.dispose);
      await tester.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: stores),
          ChangeNotifierProvider.value(value: service),
          ChangeNotifierProvider.value(value: settings),
        ],
        child: MaterialApp(theme: StoreTheme.light(), home: const ShippingScreen()),
      ));
      await tester.pumpAndSettle();
      expect(rateReads, 1);
      await tester.tap(find.text('Rates'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Edit rate'));
      await tester.pumpAndSettle();
      final price = find.byWidgetPredicate(
        (widget) => widget is TextField && widget.decoration?.labelText == 'Price',
      );
      await tester.ensureVisible(price);
      await tester.enterText(price, '21.50');
      tester.testTextInput.hide();
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(patches, hasLength(1));
      expect(patches.single['price'], 21.5);
      expect(patches.single['min_weight_grams'], limits.$1);
      expect(patches.single['max_weight_grams'], limits.$2);
      expect(patches.single.containsKey('zone_id'), isFalse);
      expect(settings.rates.single.minWeightGrams, limits.$1);
      expect(settings.rates.single.maxWeightGrams, limits.$2);
      expect(settings.rates.single.price, 21.5);
      expect(rateReads, 2, reason: 'The saved screen uses the existing fresh GET');
      await tester.tap(find.byTooltip('Edit rate'));
      await tester.pumpAndSettle();
      final zoneSelector = tester.widget<DropdownButton<String>>(
        find.byType(DropdownButton<String>).first,
      );
      expect(zoneSelector.value, f.rowId(500));
      expect(zoneSelector.onChanged, isNull,
          reason: 'Existing rate updates cannot reparent the saved zone');
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();
      expect(patches, hasLength(1));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    });
  }
}
