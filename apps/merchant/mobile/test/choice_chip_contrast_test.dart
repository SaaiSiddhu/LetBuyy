import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_store/theme/store_theme.dart';

void main() {
  for (final dark in [false, true]) {
    testWidgets(
      'canonical enabled chip labels retain readable selected and unselected pairs dark$dark',
      (tester) async {
        final theme = dark ? StoreTheme.dark() : StoreTheme.light();
        await tester.pumpWidget(
          MaterialApp(
            theme: theme,
            home: Scaffold(
              body: Wrap(
                children: [
                  ChoiceChip(
                    label: const Text('Selected segment'),
                    selected: true,
                    onSelected: (_) {},
                  ),
                  ChoiceChip(
                    label: const Text('Other segment'),
                    selected: false,
                    onSelected: (_) {},
                  ),
                ],
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        for (final label in ['Selected segment', 'Other segment']) {
          final text = find.text(label),
              chip = find.ancestor(of: text, matching: find.byType(ChoiceChip));
          final style = tester.renderObject<RenderParagraph>(text).text.style!;
          final foreground = style.foreground?.color ?? style.color;
          expect(
            foreground,
            isNotNull,
            reason:
                'Enabled chip labels require an explicit paired foreground instead of a renderer default.',
          );
          final ink = tester.widget<Ink>(
            find.descendant(of: chip, matching: find.byType(Ink)).first,
          );
          final paint = ink.decoration! as ShapeDecoration;
          final background = Color.alphaBlend(
            paint.color!,
            theme.colorScheme.surface,
          );
          final renderedForeground = Color.alphaBlend(foreground!, background);
          final first = renderedForeground.computeLuminance(),
              second = background.computeLuminance();
          final ratio =
              (math.max(first, second) + .05) / (math.min(first, second) + .05);
          expect(
            ratio,
            greaterThanOrEqualTo(4.5),
            reason:
                '$label rendered foreground$foreground/background$background',
          );
        }
        expect(tester.takeException(), isNull);
      },
    );
  }
}
