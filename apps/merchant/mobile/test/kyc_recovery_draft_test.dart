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
  testWidgets(
    'private retry restores its original document type and reference instead of offering a new intent',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final f = i.Fixture()..privateMode = true;
      final service = f.service(),
          stores = TestStores(f.api)
            ..actor = 'synthetic-actor'
            ..store = i.site;
      final dir = Directory.systemTemp.createTempSync('merchant-kyc-draft-');
      final file = File('${dir.path}/original.png')
        ..writeAsBytesSync([137, 80, 78, 71, 13, 10, 26, 10, 1]);
      await tester.runAsync(() async {
        await service.fetchOverview(i.site);
        await expectLater(f.upload(service, file), throwsA(anything));
      });
      expect(service.canRetryUpload, isTrue);
      addTearDown(() async {
        await tester.pumpWidget(const SizedBox());
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
          child: const MaterialApp(home: KycScreen()),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Resume upload'));
      await tester.tap(find.text('Resume upload'));
      await tester.pumpAndSettle();
      expect(find.text('Bank proof'), findsOneWidget);
      final reference = tester.widget<TextFormField>(
        find.widgetWithText(TextFormField, 'Reference'),
      );
      expect(reference.controller!.text, '1234');
      expect(reference.enabled, isFalse);
      expect(f.calls.where((x) => x.path.endsWith('/upload')), hasLength(1));
    },
  );
}
