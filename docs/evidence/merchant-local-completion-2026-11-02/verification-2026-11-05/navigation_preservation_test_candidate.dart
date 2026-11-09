// Prepared outside frozen inputs. Move/run only after the active native
// qualification has a collected terminal and independently verified cleanup.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/content/navigation_screen.dart';
import 'package:letbuyy_store/services/cache_service.dart';
import 'package:letbuyy_store/services/cms_service.dart';
import 'package:letbuyy_store/services/store_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'shipping_settings_scope_test.dart' as f;

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    for (final parent in [null, f.rowId(700)]) {
      testWidgets('menu label edit preserves parent $parent in dark=$dark', (
        tester,
      ) async {
        SharedPreferences.setMockInitialValues({});
        late StoreContext stores;
        var reads = 0;
        final writes = <Map<String, dynamic>>[];
        final original = <String, dynamic>{
          'id': f.rowId(701),
          'store_id': f.siteA,
          'menu_id': f.rowId(600),
          'label': 'Saved menu child',
          'url': '/collections/saved',
          'target_type': 'collection',
          'target_resource_id': f.rowId(800),
          'parent_item_id': parent,
          'sort_order': 1,
          'is_visible': false,
          'open_in_new_tab': true,
        };
        var saved = Map<String, dynamic>.from(original);
        final root = <String, dynamic>{
          ...original,
          'id': f.rowId(700),
          'label': 'Saved menu parent',
          'url': '/collections',
          'target_type': 'url',
          'target_resource_id': null,
          'parent_item_id': null,
          'sort_order': 0,
          'is_visible': true,
        };
        Map<String, dynamic> payload() => {
          'menu': {
            'id': f.rowId(600),
            'store_id': f.siteA,
            'name': 'Saved header menu',
            'location': 'main',
          },
          'items': [root, saved],
        };
        final api = f.apiFor((request, handler) {
          final path = Uri.parse(request.path).path;
          if (path.endsWith('/stores') && request.method == 'GET') {
            f.reply(request, handler, [
              {
                'id': f.siteA,
                'name': 'Synthetic menu store',
                'subdomain': 'synthetic-menu-store',
                'currency': 'INR',
              },
            ]);
          } else if (path.endsWith('/pages/navigation') &&
              request.method == 'GET') {
            expect(request.queryParameters['store_id'], f.siteA);
            expect(request.queryParameters['location'], 'main');
            reads++;
            f.reply(request, handler, payload());
          } else if (path.endsWith('/pages/navigation/main') &&
              request.method == 'PUT') {
            final body = Map<String, dynamic>.from(request.data as Map);
            writes.add(body);
            final items = (body['items'] as List).cast<Map>();
            saved = {...saved, ...Map<String, dynamic>.from(items[1])};
            f.reply(request, handler, payload());
          } else {
            throw StateError('Unexpected menu request ${request.method} $path');
          }
        }, () => stores.requestContextKey);
        final storeService = StoreService(api: api, cache: CacheService.memory());
        stores = StoreContext(storeService: storeService);
        await stores.bindActor('synthetic-menu-owner');
        await stores.ensureSelectedStore();
        final cms = CmsService(api: api);
        addTearDown(cms.dispose);
        addTearDown(stores.dispose);
        addTearDown(storeService.dispose);
        await tester.pumpWidget(MultiProvider(
          providers: [
            ChangeNotifierProvider.value(value: stores),
            ChangeNotifierProvider.value(value: storeService),
            ChangeNotifierProvider.value(value: cms),
          ],
          child: MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            home: const NavigationScreen(),
          ),
        ));
        await tester.pumpAndSettle();
        expect(reads, 1);
        expect(find.text('Saved menu child'), findsOneWidget);
        await tester.tap(find.byTooltip('Edit item').at(1));
        await tester.pumpAndSettle();
        final label = find.byWidgetPredicate(
          (widget) => widget is TextField && widget.decoration?.labelText == 'Label',
        );
        await tester.enterText(label, 'Renamed menu child');
        tester.testTextInput.hide();
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Save'));
        await tester.pumpAndSettle();
        expect(writes, isEmpty, reason: 'Item editor changes only the local draft');
        await tester.tap(find.widgetWithText(FilledButton, 'Save menu'));
        await tester.pumpAndSettle();
        expect(writes, hasLength(1));
        expect(reads, 2, reason: 'Replacement uses the existing fresh readback');
        final body = writes.single;
        expect(body['store_id'], f.siteA);
        expect(body['location'], 'main');
        final items = (body['items'] as List).cast<Map>();
        expect(items, hasLength(2));
        final child = Map<String, dynamic>.from(items[1]);
        expect(child['parent_item_id'], parent);
        expect(child['label'], 'Renamed menu child');
        for (final key in [
          'url', 'target_type', 'target_resource_id', 'is_visible', 'open_in_new_tab',
        ]) {
          expect(child[key], original[key], reason: 'Preserve saved $key');
        }
        expect(child['sort_order'], 1);
        expect(cms.navigationPayload!.items[1].parentItemId, parent);
        expect(find.text('Renamed menu child'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pumpAndSettle();
      });
    }
  }
}
