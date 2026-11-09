import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'media_library_recovery_test.dart' as base;

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'an edited filename is displayed while original upload provenance remains',
    () {
      final row = MediaAssetContract.fromJson({
        'id': 'synthetic',
        'filename': 'Renamed.pdf',
        'original_name': 'Original.pdf',
      });
      expect(row.displayName, 'Renamed.pdf');
      expect(row.originalName, 'Original.pdf');
    },
  );

  for (final narrow in [false, true]) {
    testWidgets(
      'mobile edits all five canonical metadata fields and keeps invalid tags in its editor (narrow=$narrow)',
      (tester) async {
        final errors = <String>[];
        final previousErrorHandler = FlutterError.onError;
        FlutterError.onError = (details) {
          errors.add(details.toString());
          previousErrorHandler?.call(details);
        };
        addTearDown(() => FlutterError.onError = previousErrorHandler);
        final f = base.Fixture();
        var row = <String, dynamic>{
          'id': 'media-1',
          'store_id': 'store-a',
          'filename': 'Original.pdf',
          'original_name': 'Original.pdf',
          'url': 'https://synthetic.invalid/file.pdf',
          'mime_type': 'application/pdf',
          'media_type': 'document',
          'size_bytes': 12,
          'alt_text': 'Original',
          'caption': 'Original caption',
          'folder': 'original',
          'tags': <String>[],
        };
        final writes = <Map<String, dynamic>>[];
        f.api.dio.interceptors.clear();
        f.api.dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (o, h) {
              if (o.method == 'PATCH') {
                final input = Map<String, dynamic>.from(o.data as Map);
                writes.add(input);
                row = {...row, ...input};
              }
              h.resolve(
                Response(
                  requestOptions: o,
                  statusCode: 200,
                  data: {
                    'data': o.method == 'PATCH' ? row : [row],
                    'meta': {'has_next': false},
                  },
                ),
              );
            },
          ),
        );
        await f.mount(tester, loaded: false);
        if (narrow) {
          tester.view.physicalSize = const Size(320, 740);
          tester.platformDispatcher.textScaleFactorTestValue = 2.4;
          tester.view.viewInsets = const FakeViewPadding(bottom: 240);
          addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
          addTearDown(tester.view.resetViewInsets);
          await tester.pumpAndSettle();
        }
        final edit = find
            .byWidgetPredicate(
              (w) => w is IconButton && w.tooltip == 'Edit media',
            )
            .hitTestable();
        await tester.scrollUntilVisible(
          edit,
          200,
          scrollable: find
              .descendant(
                of: find.byType(CustomScrollView),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.tap(edit);
        await tester.pumpAndSettle();
        Finder field(String label) => find.byWidgetPredicate(
          (w) => w is TextField && w.decoration?.labelText == label,
        );
        for (final label in [
          'Filename',
          'Alt text',
          'Caption',
          'Folder',
          'Tags',
        ])
          expect(field(label), findsOneWidget);
        await tester.ensureVisible(field('Filename'));
        await tester.enterText(field('Filename'), 'Renamed.pdf');
        await tester.ensureVisible(field('Alt text'));
        await tester.enterText(field('Alt text'), 'Updated alternative text');
        await tester.ensureVisible(field('Caption'));
        await tester.enterText(field('Caption'), 'Updated caption');
        await tester.ensureVisible(field('Folder'));
        await tester.enterText(field('Folder'), 'recovery');
        await tester.ensureVisible(field('Tags'));
        await tester.enterText(
          field('Tags'),
          List.generate(21, (i) => 'tag$i').join(', '),
        );
        await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save'));
        await tester.tap(find.widgetWithText(FilledButton, 'Save'));
        await tester.pumpAndSettle();
        expect(find.byType(AlertDialog), findsOneWidget);
        expect(writes, isEmpty);
        expect(find.textContaining('Review media details'), findsOneWidget);
        expect(
          tester.widget<TextField>(field('Filename')).controller!.text,
          'Renamed.pdf',
        );
        await tester.enterText(field('Tags'), 'hero, recovery');
        await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save'));
        await tester.tap(find.widgetWithText(FilledButton, 'Save'));
        await tester.pumpAndSettle();
        expect(writes.single, {
          'filename': 'Renamed.pdf',
          'alt_text': 'Updated alternative text',
          'caption': 'Updated caption',
          'folder': 'recovery',
          'tags': ['hero', 'recovery'],
        });
        expect(find.byType(AlertDialog), findsNothing);
        expect(find.text('Renamed.pdf'), findsOneWidget);
        expect(row['original_name'], 'Original.pdf');
        expect(tester.takeException(), isNull, reason: errors.join('\n'));
      },
    );
  }
}
