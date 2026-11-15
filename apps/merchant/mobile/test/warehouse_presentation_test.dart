import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/screens/inventory/operations_screen.dart';
import 'package:letbuyy_store/screens/inventory/locations_screen.dart';
import 'package:letbuyy_store/screens/inventory/suppliers_screen.dart';
import 'package:letbuyy_store/screens/inventory/purchase_orders_screen.dart';
import 'package:letbuyy_store/screens/inventory/transfers_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'inventory_workspace_test.dart' as workspace;
import 'inventory_operations_test.dart' as operations;
import 'support/warehouse_fixture.dart' as w;
import 'support/loyalty_fixture.dart' show MemoryStorage;
import 'package:letbuyy_store/screens/inventory/inventory_screen.dart';

class _HeldJournal extends MemoryStorage {
  final release = Completer<void>();
  bool entered = false;
  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    entered = true;
    await release.future;
    return super.read(
      key: key,
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
  }
}

Widget narrow(Widget child, {required bool dark}) => Builder(
  builder: (context) => Center(
    child: SizedBox(
      width: 320,
      height: 640,
      child: Theme(
        data: dark ? StoreTheme.dark() : StoreTheme.light(),
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(
            size: const Size(320, 640),
            textScaler: TextScaler.linear(2.4),
          ),
          child: child,
        ),
      ),
    ),
  ),
);

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets(
    'current stock is readable while journal discovery is held and commands remain blocked',
    (tester) async {
      final journal = _HeldJournal();
      var writes = 0;
      await workspace.mount(
        tester,
        const InventoryScreen(),
        (r, h) {
          if (r.method != 'GET') writes++;
          workspace.respond(r, h, [workspace.record(workspace.siteA)]);
        },
        storage: journal,
        settle: false,
      );
      addTearDown(() {
        if (!journal.release.isCompleted) journal.release.complete();
      });
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(journal.entered, isTrue);
      expect(find.textContaining('Private A'), findsOneWidget);
      expect(find.text('Checking saved stock changes…'), findsOneWidget);
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Adjust'),
            )
            .onPressed,
        isNull,
      );
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (w) => w is IconButton && w.tooltip == 'Scan barcode',
              ),
            )
            .onPressed,
        isNull,
      );
      expect(writes, 0);
      journal.release.complete();
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, 'Adjust'),
            )
            .onPressed,
        isNotNull,
      );
      expect(writes, 0);
      expect(tester.takeException(), isNull);
    },
  );
  for (final status in [200, 503]) {
    testWidgets('held operations $status settles safely after route disposal', (
      tester,
    ) async {
      final release = Completer<void>();
      var held = false;
      await workspace.mount(tester, const InventoryOperationsScreen(), (
        r,
        h,
      ) async {
        if (r.path.endsWith('/supplier-metrics')) {
          held = true;
          await release.future;
          operations.serve(r, h, status: status);
        } else {
          operations.serve(r, h);
        }
      }, settle: false);
      await tester.pump(const Duration(milliseconds: 100));
      expect(held, isTrue);
      await tester.pumpWidget(const MaterialApp(home: Text('Destination')));
      release.complete();
      await tester.pumpAndSettle();
      expect(find.text('Destination'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('captured operations refresh cannot read from a covered route', (
    tester,
  ) async {
    var reads = 0;
    await workspace.mount(tester, const InventoryOperationsScreen(), (r, h) {
      reads++;
      operations.serve(r, h);
    });
    final action = tester
        .widget<IconButton>(
          find.byWidgetPredicate(
            (w) => w is IconButton && w.tooltip == 'Refresh operations summary',
          ),
        )
        .onPressed!;
    final context = tester.element(find.byType(InventoryOperationsScreen));
    unawaited(
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => const Scaffold(body: Text('Destination')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final before = reads;
    action();
    await tester.pumpAndSettle();
    expect(reads, before);
    expect(find.text('Destination'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('captured operations refresh cannot read after disposal', (
    tester,
  ) async {
    var reads = 0;
    await workspace.mount(tester, const InventoryOperationsScreen(), (r, h) {
      reads++;
      operations.serve(r, h);
    });
    final action = tester
        .widget<IconButton>(
          find.byWidgetPredicate(
            (w) => w is IconButton && w.tooltip == 'Refresh operations summary',
          ),
        )
        .onPressed!;
    await tester.pumpWidget(const MaterialApp(home: Text('Destination')));
    final before = reads;
    action();
    await tester.pumpAndSettle();
    expect(reads, before);
    expect(tester.takeException(), isNull);
  });

  for (final dark in [false, true]) {
    testWidgets('supplier contact flows at 320dp large text dark=$dark', (
      tester,
    ) async {
      final contact = 'Long supplier contact name ' * 5;
      final email = '${'long-contact-' * 9}@example.invalid';
      await workspace.mount(
        tester,
        narrow(const InventorySuppliersScreen(), dark: dark),
        (r, h) => workspace.respond(r, h, [
          {
            ...w.warehouseSupplierRecord(site: workspace.siteA),
            'contact_name': contact,
            'email': email,
          },
        ]),
      );
      await tester.scrollUntilVisible(find.text(contact.trim()), 180);
      expect(find.text(contact.trim()), findsOneWidget);
      expect(find.text(email), findsOneWidget);
      expect(tester.takeException(), isNull);
      for (final element in find.byType(Text).evaluate()) {
        final render = element.renderObject;
        if (render is RenderParagraph)
          expect(render.didExceedMaxLines, isFalse);
      }
    });
    testWidgets(
      'location locality remains readable at 320dp large text dark=$dark',
      (tester) async {
        final city = 'Long warehouse locality ' * 4;
        final state = 'Long state name ' * 5;
        final locality = '${city.trim()}, ${state.trim()}, IN';
        await workspace.mount(
          tester,
          narrow(const InventoryLocationsScreen(), dark: dark),
          (r, h) => workspace.respond(r, h, [
            {
              ...w.warehouseLocationRecord(site: workspace.siteA),
              'address': {'city': city, 'state': state, 'country': 'IN'},
            },
          ]),
        );
        final text = find.text(locality);
        expect(text, findsOneWidget);
        expect(
          tester.renderObject<RenderParagraph>(text).didExceedMaxLines,
          isFalse,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final surface in [
    (
      name: 'locations',
      title: 'locations',
      screen: const InventoryLocationsScreen(),
    ),
    (
      name: 'suppliers',
      title: 'suppliers',
      screen: const InventorySuppliersScreen(),
    ),
    (
      name: 'purchase-orders',
      title: 'purchase orders',
      screen: const PurchaseOrdersScreen(),
    ),
    (
      name: 'transfers',
      title: 'transfers',
      screen: const InventoryTransfersScreen(),
    ),
  ]) {
    for (final status in [401, 403, 503]) {
      testWidgets(
        '${surface.name} same-page $status preserves only permitted prior read',
        (tester) async {
          final release = Completer<void>();
          var reads = 0;
          await workspace.mount(tester, surface.screen, (r, h) async {
            if (r.path.endsWith('/${surface.name}')) {
              reads++;
              if (reads > 1) {
                await release.future;
                workspace.respond(r, h, [], status: status);
              } else {
                workspace.respond(r, h, [
                  workspace.warehouseRecord(
                    r.path,
                    workspace.siteA,
                    name: 'Prior warehouse record',
                  ),
                ]);
              }
            } else {
              workspace.respond(r, h, []);
            }
          });
          expect(find.text('Prior warehouse record'), findsOneWidget);
          final action = tester
              .widget<IconButton>(
                find.byWidgetPredicate(
                  (w) =>
                      w is IconButton &&
                      w.tooltip == 'Refresh ${surface.title}',
                ),
              )
              .onPressed!;
          action();
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 50));
          expect(reads, 2);
          expect(find.text('Prior warehouse record'), findsOneWidget);
          expect(
            find.textContaining('Refreshing the same page.'),
            findsOneWidget,
          );
          action();
          await tester.pump();
          expect(
            reads,
            2,
            reason:
                'A captured enabled callback cannot duplicate a held refresh.',
          );
          release.complete();
          await tester.pumpAndSettle();
          expect(
            find.text('Prior warehouse record'),
            status == 503 ? findsOneWidget : findsNothing,
          );
          if (status == 503) {
            expect(find.textContaining('Refresh unavailable.'), findsOneWidget);
            expect(find.text('1 matching records · Page 1'), findsOneWidget);
          } else {
            expect(find.text('Page 1 · Count unavailable'), findsOneWidget);
            expect(find.textContaining('No matching'), findsNothing);
          }
          expect(tester.takeException(), isNull);
        },
      );
    }
  }
}
