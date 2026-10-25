import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/main.dart' as app;
import 'package:letbuyy_store/config/app_config.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/main/store_main_screen.dart';
import 'package:letbuyy_store/screens/money/money_screen.dart';
import 'package:letbuyy_store/screens/settings/shipping_screen.dart';
import 'package:letbuyy_store/screens/settings/taxes_screen.dart';
import 'package:letbuyy_store/screens/discounts/coupon_form_screen.dart';
import 'package:letbuyy_store/screens/content/page_editor_screen.dart';
import 'package:letbuyy_store/screens/content/post_editor_screen.dart';
import 'package:letbuyy_store/screens/customers/customers_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/services/api_client.dart';
import 'package:letbuyy_store/services/shipping_tax_service.dart';
import 'package:letbuyy_store/services/coupon_service.dart';
import 'package:letbuyy_store/services/cms_service.dart';
import 'package:letbuyy_store/services/customer_service.dart';
import 'package:letbuyy_store/services/inventory_service.dart';
import 'package:letbuyy_store/services/money_service.dart';
import 'package:letbuyy_store/widgets/shared/merchant_search_sheet.dart';

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
            find.text('Security check passed').evaluate().isNotEmpty) break;
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
      final shipping = context.read<ShippingTaxService>();
      final coupons = context.read<CouponService>();
      final cms = context.read<CmsService>();
      final customers = context.read<CustomerService>();
      final inventory = context.read<InventoryService>();
      final money = context.read<MoneyService>();
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
          final scroll = find.byWidgetPredicate((w) => w is Scrollable && w.restorationId != 'editable');
          if (scroll.evaluate().isNotEmpty) {
            await tester.scrollUntilVisible(f, 160, scrollable: scroll.last, maxScrolls: 16);
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
          final scroll = find.byWidgetPredicate((w) => w is Scrollable && w.restorationId != 'editable');
          if (scroll.evaluate().isNotEmpty) {
            await tester.scrollUntilVisible(f, 180, scrollable: scroll.last, maxScrolls: 12);
          }
        }
        expect(f, findsWidgets, reason: 'Missing field: $label');
        await tester.ensureVisible(f.first);
        await tester.enterText(f.first, value);
        await tester.pump();
      }

      Finder rowAction(String name, String tooltip) {
        final row = find
            .ancestor(of: find.text(name), matching: find.byType(Row))
            .first;
        return find.descendant(of: row, matching: find.byTooltip(tooltip));
      }

      Future<void> action(String name, Future<void> Function() fn) async {
        if (selected.isNotEmpty && !selected.contains(name)) return;
        errors.clear();
        try {
          await fn().timeout(const Duration(minutes: 2));
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
            'stack': stack.toString().split('\n').take(9).join('\n'),
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

      try {
        await action('wallet-and-money-tabs', () async {
          final wallet = await money.fetchWallet(store.id);
          expect(wallet['ledger_reconciliation']['status'], 'verified');
          expect(
            wallet['ledger_reconciliation']['variance_minor'].toString(),
            '0',
          );
          await open(const MoneyScreen());
          for (final tab in ['Wallet', 'Commission', 'COD', 'Payouts']) {
            await tap(find.text(tab));
          }
          expect(find.textContaining('could not load'), findsNothing);
        });
        await action('shipping-zone-ui-create-edit-delete', () async {
          final name = '$run zone';
          await open(const ShippingScreen());
          await tap(find.text('New zone'));
          await fill('Zone name', name);
          await tap(find.text('Create'));
          var rows = await shipping.fetchZones(store.id);
          expect(rows.any((z) => z.name == name), isTrue);
          await tap(rowAction(name, 'Edit zone'));
          await fill('Zone name', '$name edited');
          await tap(find.text('Save'));
          rows = await shipping.fetchZones(store.id);
          expect(rows.any((z) => z.name == '$name edited'), isTrue);
          await tap(rowAction('$name edited', 'Delete zone'));
          await tap(find.text('Delete'));
          expect(
            (await shipping.fetchZones(
              store.id,
            )).any((z) => z.name == '$name edited'),
            isFalse,
          );
        });
        await action('tax-ui-create-edit-delete', () async {
          final name = '$run GST';
          await open(const TaxesScreen());
          await tap(find.text('New tax'));
          await fill('Tax name', name);
          await fill('Rate %', '18');
          await tap(find.text('Create'));
          var rows = await shipping.fetchTaxes(store.id);
          expect(rows.singleWhere((r) => r.name == name).rate, 18);
          await tap(rowAction(name, 'Edit tax rate'));
          await fill('Rate %', '12');
          await tap(find.text('Save'));
          rows = await shipping.fetchTaxes(store.id);
          expect(rows.singleWhere((r) => r.name == name).rate, 12);
          await tap(rowAction(name, 'Delete tax rate'));
          await tap(find.text('Delete'));
          expect(
            (await shipping.fetchTaxes(store.id)).any((r) => r.name == name),
            isFalse,
          );
        });
        await action('coupon-ui-create-edit-and-validate', () async {
          final code = run.toUpperCase();
          await open(CouponFormScreen(storeId: store.id));
          await fill('Code', code);
          await fill('Discount percentage', '10');
          await tap(find.text('Create coupon'));
          var coupon = (await coupons.fetchCoupons(
            store.id,
          )).singleWhere((r) => r.code == code);
          expect(coupon.value, 10);
          expect(
            (await coupons.validateCoupon(
              storeId: store.id,
              code: code,
              subtotal: 1000,
            ))['valid'],
            isTrue,
          );
          await open(CouponFormScreen(storeId: store.id, coupon: coupon));
          await fill('Discount percentage', '15');
          await tap(find.text('Save coupon'));
          coupon = (await coupons.fetchCoupons(
            store.id,
          )).singleWhere((r) => r.code == code);
          expect(coupon.value, 15);
          await coupons.deleteCoupon(coupon.id);
        });
        await action('page-ui-create-edit-publish', () async {
          await open(PageEditorScreen(storeId: store.id));
          await fill('Title', '$run page');
          await tap(find.byTooltip('Generate slug'));
          await fill('Body', 'Synthetic UI page body');
          await tap(find.text('Create page'));
          var page = (await cms.fetchPages(
            store.id,
            limit: 100,
          )).singleWhere((p) => p.title == '$run page');
          await open(PageEditorScreen(storeId: store.id, page: page));
          await fill('Title', '$run page edited');
          await tap(find.text('Published'));
          await tap(find.text('Save page'));
          page = (await cms.fetchPages(
            store.id,
            limit: 100,
          )).singleWhere((p) => p.id == page.id);
          expect(page.status, 'published');
          await cms.deletePage(page.id);
        });
        await action('blog-ui-create-edit-publish', () async {
          await open(PostEditorScreen(storeId: store.id));
          await fill('Title', '$run post');
          await tap(find.byTooltip('Generate slug'));
          await fill('Content', 'Synthetic UI post body');
          await tap(find.text('Create post'));
          var post = (await cms.fetchBlogPosts(
            store.id,
            limit: 100,
          )).singleWhere((p) => p.title == '$run post');
          await open(PostEditorScreen(storeId: store.id, post: post));
          await fill('Title', '$run post edited');
          await tap(find.text('Published'));
          await tap(find.text('Save post'));
          post = (await cms.fetchBlogPosts(
            store.id,
            limit: 100,
          )).singleWhere((p) => p.id == post.id);
          expect(post.status, 'published');
          await cms.deleteBlogPost(post.id);
        });
        await action('customer-ui-create-and-readback', () async {
          await open(const CustomersScreen());
          await tap(find.byTooltip('Add customer'));
          await fill('Full name', 'Synthetic $run');
          await fill('Email', '$run@example.invalid');
          await tap(find.text('Save customer'));
          final customer = await customers.fetchCustomerByEmail(
            '$run@example.invalid',
            storeId: store.id,
          );
          expect(customer.email, '$run@example.invalid');
          await customers.deleteCustomer(
            '$run@example.invalid',
            storeId: store.id,
          );
        });
        await action('location-ui-create-and-address-readback', () async {
          await open(const InventoryLocationsScreen());
          await tap(find.text('New location'));
          await fill('Name', '$run warehouse');
          await fill('Address', 'Synthetic warehouse');
          await fill('City', 'Chennai');
          await fill('State', 'TN');
          await tap(find.text('Create location'));
          final row = (await inventory.fetchLocations(
            store.id,
          )).singleWhere((r) => r.name == '$run warehouse');
          expect(row.city, 'Chennai');
          expect(row.address, 'Synthetic warehouse');
        });
        await action('supplier-ui-create-and-readback', () async {
          await open(const InventorySuppliersScreen());
          await tap(find.text('New supplier'));
          await fill('Supplier name', '$run supplier');
          await fill('Email', '$run-supplier@example.invalid');
          await tap(find.text('Create supplier'));
          expect(
            (await inventory.fetchSuppliers(
              store.id,
            )).any((s) => s.name == '$run supplier'),
            isTrue,
          );
        });
        await action('search-ui-load-and-open-product', () async {
          await open(const Scaffold(body: MerchantSearchSheet()));
          await fill('Search orders and products', 'Bengaluru');
          await tick(4);
          await tap(find.text('Bengaluru Street Runner'));
          await waitFor(find.text('Edit Product'));
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
    timeout: const Timeout(Duration(minutes: 25)),
  );
}
