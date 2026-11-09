import 'dart:async';
import 'support/native_selection_passthrough.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/widgets/shared/merchant_media_picker.dart';

void main() {
  testWidgets(
    'unavailable camera offers the library for photos or video without inventing a permission fix',
    (tester) async {
      late BuildContext context;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (c) {
                context = c;
                return const SizedBox();
              },
            ),
          ),
        ),
      );
      final result = await pickMerchantMedia(
        context,
        source: ImageSource.camera,
        purpose: 'public-media-image',
        selection: NativeSelectionPassthrough(),
        pick: () async => throw PlatformException(
          code: 'no_available_camera',
          message: 'Private native details',
        ),
      );
      await tester.pump();
      expect(result, isNull);
      expect(
        find.textContaining('Choose media from the library'),
        findsOneWidget,
      );
      expect(find.textContaining('Private native details'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  for (final source in ImageSource.values) {
    testWidgets('${source.name} denial shows recovery and returns no file', (
      tester,
    ) async {
      late BuildContext context;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (c) {
                context = c;
                return const SizedBox();
              },
            ),
          ),
        ),
      );
      final result = await pickMerchantMedia(
        context,
        source: source,
        purpose: 'public-media-image',
        selection: NativeSelectionPassthrough(),
        pick: () async => throw PlatformException(
          code: '${source.name}_access_denied',
          message: 'Private native error',
        ),
      );
      await tester.pump();
      expect(result, isNull);
      expect(find.textContaining('Could not open'), findsOneWidget);
      expect(find.textContaining('Private native error'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets(
    'native cancellation is silent and successful selection preserves the file',
    (tester) async {
      late BuildContext context;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (c) {
                context = c;
                return const SizedBox();
              },
            ),
          ),
        ),
      );
      expect(
        await pickMerchantMedia(
          context,
          source: ImageSource.gallery,
          purpose: 'public-media-image',
          selection: NativeSelectionPassthrough(),
          pick: () async => null,
        ),
        isNull,
      );
      expect(find.byType(SnackBar), findsNothing);
      final file = XFile('/synthetic/native.png');
      expect(
        await pickMerchantMedia(
          context,
          source: ImageSource.gallery,
          purpose: 'public-media-image',
          selection: NativeSelectionPassthrough(),
          pick: () async => file,
        ),
        same(file),
      );
    },
  );
  testWidgets(
    'late native completion after leaving the screen returns no file',
    (tester) async {
      late BuildContext context;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (c) {
              context = c;
              return const SizedBox();
            },
          ),
        ),
      );
      final completion = Completer<XFile?>();
      final result = pickMerchantMedia(
        context,
        source: ImageSource.camera,
        purpose: 'public-media-image',
        selection: NativeSelectionPassthrough(),
        pick: () => completion.future,
      );
      await tester.pumpWidget(const SizedBox());
      completion.complete(XFile('/synthetic/native.jpg'));
      expect(await result, isNull);
      expect(tester.takeException(), isNull);
    },
  );
}
