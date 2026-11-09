// Native helper/error rendering through the shared field. Layout checks measure
// painted paragraphs; finding a Text widget alone is not full-copy visibility.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

const helper =
    'Choose a UTF-8 file or paste its exact contents. Registered imports continue independently after you leave.';
const rejected =
    'The saved request could not be confirmed. Keep the original file and check its status before starting another request.';
const validation =
    'Review this field carefully. The current draft needs correction before its original request can be submitted.';
void expectFullParagraph(WidgetTester tester, String text) {
  final paragraph = tester.renderObject<RenderParagraph>(find.text(text));
  expect(
    paragraph.didExceedMaxLines,
    isFalse,
    reason: 'Every word must be laid out rather than replaced by an ellipsis',
  );
  final expected = TextPainter(
    text: paragraph.text,
    textDirection: paragraph.textDirection,
    textScaler: paragraph.textScaler,
  )..layout(maxWidth: paragraph.size.width);
  expect(expected.computeLineMetrics().length, greaterThan(1));
  expect(
    paragraph.size.height,
    greaterThanOrEqualTo(expected.height - 0.5),
    reason:
        'The actual native field must reserve its full wrapped paragraph height',
  );
  expected.dispose();
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  for (final dark in [false, true]) {
    for (final state in [
      'helper',
      'explicit error',
      'validator error',
      'both errors',
    ]) {
      testWidgets('shared field paints full $state at320dp scale2.4 dark$dark', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 1200);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final form = GlobalKey<FormState>();
        var calls = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? StoreTheme.dark() : StoreTheme.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: const TextScaler.linear(2.4),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: Scaffold(
              body: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: form,
                  child: CustomTextField(
                    label: 'CSV contents',
                    initialValue: 'draft',
                    maxLength: 1048576,
                    helperText: helper,
                    errorText: ['explicit error', 'both errors'].contains(state)
                        ? rejected
                        : null,
                    validator: (_) {
                      calls++;
                      return ['validator error', 'both errors'].contains(state)
                          ? validation
                          : null;
                    },
                  ),
                ),
              ),
            ),
          ),
        );
        expect(
          form.currentState!.validate(),
          !['validator error', 'both errors'].contains(state),
          reason:
              'Presentation cannot turn a supplied error caption into a different Form validation policy',
        );
        await tester.pumpAndSettle();
        expect(calls, 1);
        expectFullParagraph(
          tester,
          state == 'helper'
              ? helper
              : state == 'explicit error'
              ? rejected
              : validation,
        );
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }
}
