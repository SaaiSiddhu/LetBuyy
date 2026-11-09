import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/services/native_media_selection.dart';
import 'package:letbuyy_store/services/security_command_store.dart';
import 'package:letbuyy_store/widgets/shared/merchant_media_picker.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final dark in [false, true]) {
    testWidgets(
      'recovered file requires explicit review at320dp scale2.4 dark$dark',
      (tester) async {
        FlutterSecureStorage.setMockInitialValues({});
        final directory = (await tester.runAsync(
          () => Directory.systemTemp.createTemp('native-recovery-ui-'),
        ))!;
        final input = File('${directory.path}/original.jpg');
        await tester.runAsync(
          () => input.writeAsBytes([255, 216, 255, 224, 1, 2]),
        );
        final selection = NativeMediaSelection(
          contextProvider: () => (actorId: 'a', storeId: 's', version: 1),
          directoryProvider: () async => directory,
          retrieveLostData: () async => LostDataResponse.empty(),
        );
        await tester.runAsync(
          () => selection.pick(
            purpose: 'public-media-image',
            kind: 'image',
            maxBytes: 100,
            pick: () async => XFile(input.path),
          ),
        );
        expect(selection.hasSelection, isTrue);
        expect(selection.canRecover, isTrue);
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        XFile? recovered;
        var nativeCalls = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? ThemeData.dark() : ThemeData.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(2.4)),
              child: child!,
            ),
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () async {
                    recovered = await pickMerchantMedia(
                      context,
                      source: ImageSource.camera,
                      purpose: 'public-media-image',
                      selection: selection,
                      pick: () async {
                        nativeCalls++;
                        return null;
                      },
                    );
                  },
                  child: const Text('Select image'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Select image'));
        await tester.pumpAndSettle();
        for (
          var n = 0;
          n < 10 &&
              find.text('Review previous file selection').evaluate().isEmpty;
          n++
        ) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 10)),
          );
          await tester.pumpAndSettle();
        }
        expect(recovered, isNull);
        expect(nativeCalls, 0);
        expect(find.text('Review previous file selection'), findsOneWidget);
        await tester.ensureVisible(find.text('Use saved file'));
        await tester.tap(find.text('Use saved file'));
        await tester.pumpAndSettle();
        expect(find.text('Review previous file selection'), findsNothing);
        for (var n = 0; n < 30 && recovered == null; n++) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 10)),
          );
          await tester.pumpAndSettle();
        }
        expect(recovered, isNotNull);
        expect(nativeCalls, 0);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        selection.dispose();
        await tester.runAsync(() => directory.delete(recursive: true));
      },
    );
  }
  test(
    'a private selection cannot be rebound to a different verification type',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final directory = await Directory.systemTemp.createTemp(
        'private-selection-type-',
      );
      final file = File('${directory.path}/original.jpg');
      await file.writeAsBytes([1, 2, 3]);
      final selection = NativeMediaSelection(
        contextProvider: () => (actorId: 'a', storeId: 's', version: 1),
        commands: SecurityCommandStore(),
        directoryProvider: () async => directory,
        retrieveLostData: () async => LostDataResponse.empty(),
      );
      final picked = (await selection.pick(
        purpose: 'private-kyc-business_pan',
        kind: 'image',
        maxBytes: 100,
        draft: {'document_type': 'business_pan'},
        pick: () async => XFile(file.path),
      ))!;
      await expectLater(
        selection.bindInput(picked, {
          'document_type': 'bank_proof',
          'reference': '1234',
        }),
        throwsA(isA<Exception>()),
      );
      selection.dispose();
      await directory.delete(recursive: true);
    },
  );
}
