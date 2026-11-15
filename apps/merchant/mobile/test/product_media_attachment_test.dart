import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show ProductContract;
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/products/product_form_screen.dart';
import 'package:letbuyy_store/services/media_service.dart';
import 'package:letbuyy_store/services/product_service.dart';
import 'package:provider/provider.dart';
import 'product_edit_concurrency_test.dart' as fixture;
import 'support/editor_steps_fixture.dart';

const savedImage = 'https://synthetic.invalid/library.png';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  Future<({fixture.SelectedStore stores, fixture.ProductTransport api})> mount(
    WidgetTester tester, {
    Completer<void>? held,
    bool foreign = false,
    int imageCount = 1,
    bool openLibrary = true,
    bool alreadyAttached = false,
  }) async {
    final api = fixture.ProductTransport('success');
    if (imageCount != 1)
      api.current['images'] = List.generate(
        imageCount,
        (i) => 'https://synthetic.invalid/retained-$i.png',
      );
    if (alreadyAttached) api.current['images'] = [savedImage];
    final stores = fixture.SelectedStore(api);
    final media = MediaService(
      api: api,
      storeIdProvider: () => stores.selection,
    );
    final products = ProductService(api: api);
    addTearDown(api.close);
    addTearDown(stores.dispose);
    addTearDown(media.dispose);
    addTearDown(products.dispose);
    api.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (o, h) async {
          expect(o.method, 'GET');
          expect(Uri.parse(o.path).path, '/v1/media');
          expect(o.queryParameters['type'], 'image');
          expect(o.queryParameters['store_id'], fixture.site);
          await held?.future;
          h.resolve(
            Response(
              requestOptions: o,
              statusCode: 200,
              data: {
                'data': [
                  {
                    'id': 'saved-image',
                    'store_id': foreign ? 'another-store' : fixture.site,
                    'filename': 'library.png',
                    'url': savedImage,
                    'mime_type': 'image/png',
                    'media_type': 'image',
                    'size_bytes': 75,
                  },
                  {
                    'id': 'saved-video',
                    'store_id': fixture.site,
                    'filename': 'unsupported-product-video.mp4',
                    'url': 'https://synthetic.invalid/video.mp4',
                    'mime_type': 'video/mp4',
                    'media_type': 'video',
                    'size_bytes': 100,
                  },
                ],
                'meta': {'page': 1, 'per_page': 60, 'has_next': false},
              },
            ),
          );
        },
      ),
    );
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StoreContext>.value(value: stores),
          ChangeNotifierProvider<ProductService>.value(value: products),
          ChangeNotifierProvider<MediaService>.value(value: media),
        ],
        child: MaterialApp(
          home: ProductFormScreen(
            product: ProductContract.fromJson(api.current),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await selectEditorSection(tester, 'Images');
    if (!openLibrary) return (stores: stores, api: api);
    await tester.ensureVisible(find.text('Add Image'));
    await tester.tap(find.text('Add Image'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Media library'));
    if (held == null) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    }
    return (stores: stores, api: api);
  }

  testWidgets(
    'existing image attaches, reorders and saves without another upload',
    (tester) async {
      final f = await mount(tester);
      expect(find.text('Choose product image'), findsOneWidget);
      expect(find.text('unsupported-product-video.mp4'), findsNothing);
      expect(find.text('Use image'), findsOneWidget);
      await tester.tap(find.text('Use image'));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 5));
      expect(find.text('Choose product image'), findsNothing);
      await tester.ensureVisible(find.text('Move image 2 earlier'));
      await tester.tap(find.text('Move image 2 earlier'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Update'));
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect(f.api.calls, hasLength(1));
      expect((f.api.calls.single.body as Map)['images'], [
        savedImage,
        ...fixture.initial()['images'] as List,
      ]);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('cancel returns to unchanged product draft without a save', (
    tester,
  ) async {
    final f = await mount(tester);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Remove product image 2'), findsNothing);
    expect(f.api.calls, isEmpty);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final retained in [5, 19]) {
    testWidgets(
      'canonical media limit permits attaching and saving image ${retained + 1}',
      (tester) async {
        final f = await mount(tester, imageCount: retained);
        await tester.tap(find.text('Use image'));
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Update'));
        await tester.pumpAndSettle();
        final images = (f.api.calls.single.body as Map)['images'] as List;
        expect(images.length, retained + 1);
        expect(images.last, savedImage);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
  testWidgets(
    'twenty images block further attachment without removing existing media',
    (tester) async {
      final f = await mount(tester, imageCount: 20, openLibrary: false);
      expect(find.text('Add Image'), findsNothing);
      expect(find.text('Remove product image 20'), findsOneWidget);
      expect(f.api.calls, isEmpty);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'selecting an already attached library image keeps the product unchanged',
    (tester) async {
      final f = await mount(tester, alreadyAttached: true);
      await tester.tap(find.text('Use image'));
      await tester.pumpAndSettle();
      expect(find.text('This image is already attached.'), findsOneWidget);
      expect(find.text('Remove product image 2'), findsNothing);
      expect(f.api.calls, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'invalid and duplicate image URLs retain the editor until a valid new URL is entered',
    (tester) async {
      final f = await mount(tester, openLibrary: false);
      await tester.ensureVisible(find.text('Add Image'));
      await tester.tap(find.text('Add Image'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Image URL'));
      await tester.pumpAndSettle();
      final field = find.widgetWithText(TextFormField, 'Image URL');
      for (final url in [
        'javascript:alert(1)',
        (fixture.initial()['images'] as List).first as String,
      ]) {
        await tester.enterText(field, url);
        await tester.tap(find.widgetWithText(FilledButton, 'Add'));
        await tester.pumpAndSettle();
        expect(field, findsOneWidget);
        expect(f.api.calls, isEmpty);
        expect(find.text('Remove product image 2'), findsNothing);
      }
      await tester.enterText(field, savedImage);
      await tester.tap(find.widgetWithText(FilledButton, 'Add'));
      await tester.pumpAndSettle();
      expect(find.text('Remove product image 2'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Update'));
      await tester.pumpAndSettle();
      expect((f.api.calls.single.body as Map)['images'], [
        ...(fixture.initial()['images'] as List),
        savedImage,
      ]);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('late media from a retired store cannot attach to the product', (
    tester,
  ) async {
    final held = Completer<void>();
    final f = await mount(tester, held: held);
    f.stores.selection = 'new-store';
    await tester.pump();
    held.complete();
    await tester.pumpAndSettle();
    expect(find.text('Use image'), findsNothing);
    expect(find.text('Store access changed. Reload media.'), findsOneWidget);
    expect(f.api.calls, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'foreign media fails closed before displaying an attachment control',
    (tester) async {
      final f = await mount(tester, foreign: true);
      expect(find.text('Use image'), findsNothing);
      expect(
        find.text('Media is unavailable. Retry to reload the current store.'),
        findsOneWidget,
      );
      expect(f.api.calls, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
