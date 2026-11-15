import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/screens/kyc/kyc_screen.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'kyc_containment_test.dart' as fixtures;
import 'support/kyc_public_fixture.dart';
import 'support/native_selection_passthrough.dart';
import 'package:letbuyy_store/services/native_media_selection.dart';

void main() {
  testWidgets(
    'denied private document picker preserves draft, allows retry and sends no upload',
    (tester) async {
      final f = fixtures.Fixture();
      var picks = 0;
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<NativeMediaSelection>(
              create: (_) => NativeSelectionPassthrough(),
            ),
            ChangeNotifierProvider<StoreContext>.value(value: f.stores),
            ChangeNotifierProvider<KycService>.value(value: f.service),
          ],
          child: MaterialApp(
            home: KycScreen(
              pickDocumentPhoto: () async {
                if (++picks == 1) {
                  throw PlatformException(
                    code: 'photo_access_denied',
                    message: 'Private native detail',
                  );
                }
                return null;
              },
            ),
          ),
        ),
      );
      await tester.pump();
      await fixtures.replyWidget(tester, f, fixtures.overview(kycSiteA));
      await tester.pumpAndSettle();
      await fixtures.openReference(tester);
      await tester.enterText(find.byType(TextField), '1234');
      await tester.tap(
        find.widgetWithText(OutlinedButton, 'Choose document photo'),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        find.textContaining('Could not open photo library'),
        findsOneWidget,
      );
      expect(find.textContaining('Private native detail'), findsNothing);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '1234',
      );
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
      await tester.tap(
        find.widgetWithText(OutlinedButton, 'Choose document photo'),
      );
      await tester.pumpAndSettle();
      expect(picks, 2);
      expect(tester.takeException(), isNull);
      expect(
        find.text('Document received. Close to refresh status.'),
        findsNothing,
      );
      expect(f.calls.where((r) => r.method == 'POST'), isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
      f.service.dispose();
      f.stores.dispose();
      f.api.close();
    },
  );
}
