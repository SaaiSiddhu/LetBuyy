import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/widgets/shared/merchant_media_picker.dart';

void main() {
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
        pick: () => completion.future,
      );
      await tester.pumpWidget(const SizedBox());
      completion.complete(XFile('/synthetic/native.jpg'));
      expect(await result, isNull);
      expect(tester.takeException(), isNull);
    },
  );
}
