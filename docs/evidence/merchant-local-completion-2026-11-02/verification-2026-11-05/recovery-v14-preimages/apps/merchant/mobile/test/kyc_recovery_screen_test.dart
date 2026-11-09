import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/kyc/kyc_screen.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'kyc_containment_test.dart' show TestStores;
import 'kyc_interrupted_upload_recovery_test.dart' as i;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final unknown in [false, true]) {
    testWidgets(
      'KYC interrupted ${unknown ? 'storage' : 'confirmation'} has truthful reachable recovery at320 scale2.4',
      (tester) async {
        FlutterSecureStorage.setMockInitialValues({});
        final f = i.Fixture()..loseObject = unknown;
        final service = f.service();
        final stores = TestStores(f.api)
          ..actor = 'synthetic-actor'
          ..store = i.site;
        final dir = Directory.systemTemp.createTempSync(
          'letbuyy-kyc-recovery-ui-',
        );
        final file = File('${dir.path}/proof.png')
          ..writeAsBytesSync([137, 80, 78, 71, 13, 10, 26, 10, 1]);
        await tester.runAsync(() async {
          await service.fetchOverview(i.site);
          await expectLater(f.upload(service, file), throwsA(anything));
        });
        expect(service.hasPendingUpload, isTrue);
        file.deleteSync();
        tester.view.physicalSize = const Size(320, 1000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(() async {
          await tester.pumpWidget(const SizedBox.shrink());
          service.dispose();
          stores.dispose();
          f.api.close();
          dir.deleteSync(recursive: true);
        });
        await tester.pumpWidget(
          MultiProvider(
            providers: [
              ChangeNotifierProvider<StoreContext>.value(value: stores),
              ChangeNotifierProvider<KycService>.value(value: service),
            ],
            child: MaterialApp(
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(2.4)),
                child: child!,
              ),
              home: const KycScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('Interrupted upload'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(
          find.text('Interrupted upload'),
          findsOneWidget,
          reason: tester
              .widgetList<Text>(find.byType(Text))
              .map((t) => t.data)
              .join('|'),
        );
        expect(find.text('Add document'), findsNothing);
        if (unknown) {
          expect(find.textContaining('needs review'), findsOneWidget);
          expect(find.text('Confirm upload'), findsNothing);
        } else {
          final button = find.widgetWithText(TextButton, 'Confirm upload');
          await tester.ensureVisible(button);
          await tester.pumpAndSettle();
          expect(button.hitTestable(), findsOneWidget);
          await tester.tap(button);
          await tester.pumpAndSettle();
          expect(service.hasPendingUpload, isFalse);
          expect(f.completions, hasLength(2));
          expect(f.key(f.completions.first), f.key(f.completions.last));
        }
        expect(f.posts, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
