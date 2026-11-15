import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

double contrast(Color a, Color b) {
  final values = [a.computeLuminance(), b.computeLuminance()]..sort();
  return (values.last + .05) / (values.first + .05);
}

void main() {
  for (final dark in [false, true]) {
    testWidgets(
      'real status and persistent feedback pairings wrap and remain readable dark$dark',
      (tester) async {
        tester.view.physicalSize = const Size(320, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final semantics = tester.ensureSemantics();
        try {
          await tester.pumpWidget(
            MaterialApp(
              theme: dark ? StoreTheme.dark() : StoreTheme.light(),
              home: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2.4)),
                child: Scaffold(
                  body: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final tone in LetbuyyStatusTone.values)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: LetbuyyStatusBadge(
                            label:
                                '${tone.name}: a long synthetic status with complete supporting meaning',
                            tone: tone,
                          ),
                        ),
                      for (final kind in LetbuyyFeedbackKind.values)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: LetbuyyInlineFeedback(
                            title: 'Recovery ${kind.name}',
                            message:
                                'The original synthetic request remains unconfirmed. Retry the same request after reviewing its retained fields.',
                            kind: kind,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          for (final tone in LetbuyyStatusTone.values) {
            final label =
                '${tone.name}: a long synthetic status with complete supporting meaning';
            await tester.scrollUntilVisible(
              find.text(label),
              160,
              scrollable: find.byType(Scrollable).first,
            );
            final owner = find.byWidgetPredicate(
              (w) => w is LetbuyyStatusBadge && w.tone == tone,
            );
            final text = tester.widget<Text>(
              find.descendant(of: owner, matching: find.byType(Text)),
            );
            final box = tester.widget<DecoratedBox>(
              find.descendant(of: owner, matching: find.byType(DecoratedBox)),
            );
            expect(
              contrast(
                text.style!.color!,
                (box.decoration as BoxDecoration).color!,
              ),
              greaterThanOrEqualTo(4.5),
            );
            expect(
              tester
                  .renderObject<RenderParagraph>(find.text(label))
                  .didExceedMaxLines,
              isFalse,
            );
            expect(
              tester.getSemantics(find.text(label)).label,
              contains(label),
            );
          }
          for (final kind in LetbuyyFeedbackKind.values) {
            await tester.scrollUntilVisible(
              find.text('Recovery ${kind.name}'),
              160,
              scrollable: find.byType(Scrollable).first,
            );
            final owner = find.byWidgetPredicate(
              (w) => w is LetbuyyInlineFeedback && w.kind == kind,
            );
            final texts = tester.widgetList<Text>(
              find.descendant(of: owner, matching: find.byType(Text)),
            );
            final box = tester.widget<DecoratedBox>(
              find.descendant(of: owner, matching: find.byType(DecoratedBox)),
            );
            for (final text in texts)
              expect(
                contrast(
                  text.style!.color!,
                  (box.decoration as BoxDecoration).color!,
                ),
                greaterThanOrEqualTo(4.5),
              );
          }
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );
  }
}
