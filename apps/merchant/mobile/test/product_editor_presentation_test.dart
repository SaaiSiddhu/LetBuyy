// Presentation gates through the actual form, ProductService and shared SDK.
// Synthetic transport tests do not establish database or hosted acceptance.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show ProductContract;
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:provider/provider.dart';
import 'product_edit_concurrency_test.dart' as fixture;
import 'support/editor_steps_fixture.dart';

Future<fixture.SelectedStore> mountEditor(
  WidgetTester tester,
  fixture.ProductTransport api, {
  bool dark = false,
  double scale = 1,
}) async {
  final stores = fixture.SelectedStore(api),
      products = ProductService(api: api);
  addTearDown(products.dispose);
  addTearDown(stores.dispose);
  addTearDown(api.close);
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
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => ProductFormScreen(
                    product: ProductContract.fromJson(fixture.initial()),
                  ),
                ),
              ),
              child: const Text('Open product'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open product'));
  await tester.pumpAndSettle();
  return stores;
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final field in ['price', 'stock']) {
    testWidgets(
      'incomplete fresh $field cannot authorize an editor with fabricated zero',
      (tester) async {
        final api = fixture.ProductTransport('success')
          ..current = ({...fixture.initial()}..remove(field));
        await mountEditor(tester, api);
        expect(find.byType(TextFormField), findsNothing);
        expect(find.text('Retry product'), findsOneWidget);
        expect(api.calls, isEmpty);
        api.current = fixture.initial();
        await tester.tap(find.text('Retry product'));
        await tester.pumpAndSettle();
        expect(fixture.nameText(tester), 'Original product');
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
  testWidgets('product draft Back cancels safely and discard never submits', (
    tester,
  ) async {
    final api = fixture.ProductTransport('success');
    await mountEditor(tester, api);
    await tester.enterText(fixture.nameField(), 'Unsaved private name');
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Discard product draft?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(fixture.nameText(tester), 'Unsaved private name');
    expect(api.calls, isEmpty);
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Discard changes'));
    await tester.pumpAndSettle();
    expect(find.text('Open product'), findsOneWidget);
    expect(api.calls, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'pending product Back explains in-memory retry and never resubmits on dismissal',
    (tester) async {
      final api = fixture.ProductTransport('lost');
      await mountEditor(tester, api);
      await tester.enterText(fixture.nameField(), 'Original pending intent');
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      final original = api.calls.single;
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      expect(find.text('Leave unconfirmed save?'), findsOneWidget);
      expect(
        find.textContaining('kept only in this open editor'),
        findsOneWidget,
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.text('Retry pending save'), findsOneWidget);
      expect(api.calls.single.idempotencyKey, original.idempotencyKey);
      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Leave editor'));
      await tester.pumpAndSettle();
      expect(api.calls, hasLength(1));
      expect(find.text('Open product'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'product price accepts existing decimal contract and saves exact original units',
    (tester) async {
      final api = fixture.ProductTransport('success');
      await mountEditor(tester, api);
      await selectEditorSection(tester, 'Pricing');
      final price = find.widgetWithText(TextFormField, 'Sale Price *');
      await tester.enterText(price, '129.75');
      expect(tester.widget<TextFormField>(price).controller!.text, '129.75');
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(api.calls.single.body, containsPair('price', 129.75));
      expect(api.calls.single.body, containsPair('version', 7));
      expect(api.calls.single.storeId, fixture.site);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'saved custom category remains editable without requiring optional choices',
    (tester) async {
      final api = fixture.ProductTransport('success')
        ..current = {...fixture.initial(), 'category': 'custom-saved-category'};
      await mountEditor(tester, api);
      final field = find.widgetWithText(TextFormField, 'Category');
      await tester.ensureVisible(field);
      await tester.pumpAndSettle();
      expect(
        tester.widget<TextFormField>(field).controller!.text,
        'custom-saved-category',
      );
      expect(find.byTooltip('Choose existing category'), findsOneWidget);
      expect(api.calls, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  for (final dark in [false, true]) {
    testWidgets(
      'product editor reflows its pricing and details at320dp scale2.4 dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = fixture.ProductTransport('success');
        await mountEditor(tester, api, dark: dark, scale: 2.4);
        await selectEditorSection(tester, 'Pricing');
        expect(
          find.widgetWithText(TextFormField, 'Sale Price *'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        for (final section in ['Images', 'Variants', 'Details']) {
          await selectEditorSection(tester, section);
          expect(tester.takeException(), isNull);
        }
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
