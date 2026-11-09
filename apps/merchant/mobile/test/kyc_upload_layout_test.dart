// Actual KYC/shared form composition and transport. Large text must keep records/actions reachable.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_store/app/store_context.dart';
import 'package:letbuyy_store/services/kyc_service.dart';
import 'package:letbuyy_store/screens/kyc/kyc_screen.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'kyc_containment_test.dart' as f;

void main() {
  setUpAll(() async {
    await initializeLetbuyyTypography();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  for (final dark in [false, true])
    for (final large in [false, true])
      testWidgets(
        'actual GST upload form ${dark ? 'dark' : 'light'} ${large ? '320dp scale2.4' : '390dp scale1'}',
        (tester) async {
          tester.view.devicePixelRatio = 1;
          tester.view.physicalSize = large
              ? const Size(320, 760)
              : const Size(390, 844);
          addTearDown(tester.view.resetDevicePixelRatio);
          addTearDown(tester.view.resetPhysicalSize);
          WidgetController.hitTestWarningShouldBeFatal = true;
          final fixture = f.Fixture();
          addTearDown(() async {
            await tester.pumpWidget(const SizedBox.shrink());
            fixture.service.dispose();
            fixture.stores.dispose();
            fixture.api.close();
          });
          await tester.pumpWidget(
            MultiProvider(
              providers: [
                ChangeNotifierProvider<StoreContext>.value(
                  value: fixture.stores,
                ),
                ChangeNotifierProvider<KycService>.value(
                  value: fixture.service,
                ),
              ],
              child: MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: dark ? StoreTheme.dark() : StoreTheme.light(),
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: TextScaler.linear(large ? 2.4 : 1)),
                  child: child!,
                ),
                home: const KycScreen(),
              ),
            ),
          );
          await tester.pump();
          await f.replyWidget(tester, fixture, {
            ...f.overview('8a55c36a-1460-42bb-8fa4-f499c92b5c01'),
            'required_documents': [
              {
                'document_type': 'gst_certificate',
                'title': 'GST certificate',
                'required': true,
                'status': 'draft',
              },
            ],
          });
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(
            tester.getSize(find.byType(ListView)).height,
            greaterThan(tester.view.physicalSize.height * .5),
            reason:
                'The verification notice must scroll with the records, leaving a reachable main viewport.',
          );
          final trigger = find.byKey(
            const ValueKey('record-reference-gst_certificate'),
          );
          await tester.scrollUntilVisible(trigger, 300, maxScrolls: 50);
          await tester.pumpAndSettle();
          await tester.tap(trigger);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.ensureVisible(
            find.widgetWithText(FilledButton, 'Upload document'),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(
            find.widgetWithText(LetbuyyChoiceField<String>, 'GST certificate'),
            findsOneWidget,
          );
          final referenceLabel = tester.renderObject<RenderParagraph>(
            find.text('Reference'),
          );
          expect(
            referenceLabel.didExceedMaxLines,
            isFalse,
            reason:
                'The full reference label must remain readable at large text.',
          );
          final choice = find.byType(LetbuyyChoiceField<String>);
          await tester.ensureVisible(choice);
          await tester.tap(choice);
          await tester.pumpAndSettle();
          final pan = find.widgetWithText(
            RadioListTile<String>,
            'Business PAN',
          );
          await tester.ensureVisible(pan);
          await tester.tap(pan);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.ensureVisible(
            find.widgetWithText(FilledButton, 'Apply selection'),
          );
          await tester.pumpAndSettle();
          await tester.tap(
            find.widgetWithText(FilledButton, 'Apply selection'),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(
            tester.widget<LetbuyyChoiceField<String>>(choice).value,
            'business_pan',
          );
          await tester.ensureVisible(find.widgetWithText(TextButton, 'Close'));
          await tester.pumpAndSettle();
          await tester.tap(find.widgetWithText(TextButton, 'Close'));
          await tester.pumpAndSettle();
          expect(find.text('Leave verification upload?'), findsOneWidget);
          expect(find.text('Upload verification document'), findsOneWidget);
          await tester.tap(find.text('Leave upload'));
          await tester.pumpAndSettle();
          expect(find.text('Upload verification document'), findsNothing);
          expect(fixture.calls.where((r) => r.method == 'POST'), isEmpty);
        },
      );
}
