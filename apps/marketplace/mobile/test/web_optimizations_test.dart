import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace/utils/web_optimizations.dart';

/// `kIsWeb` is always `false` under a plain `flutter test` run (the Dart VM
/// target, not a web compile). Every assertion below exercises the
/// non-web branch of WebOptimizations -- the only branch reachable here.
void main() {
  group('WebOptimizations on the non-web (VM test) platform', () {
    test('isWeb and reduceAnimations report false', () {
      expect(WebOptimizations.isWeb, isFalse);
      expect(WebOptimizations.reduceAnimations, isFalse);
    });

    test('animationDuration returns the input duration unchanged', () {
      const normal = Duration(milliseconds: 350);
      expect(WebOptimizations.animationDuration(normal), normal);
    });

    test(
      'animationDuration is not silently zeroed for short durations either',
      () {
        const short = Duration(milliseconds: 50);
        expect(WebOptimizations.animationDuration(short), short);
      },
    );

    test('optionalDuration returns the mobile duration, never null', () {
      const mobile = Duration(milliseconds: 200);
      expect(WebOptimizations.optionalDuration(mobile), mobile);
    });

    testWidgets(
      'conditionalAnimate invokes the animator instead of returning the '
      'widget as-is',
      (tester) async {
        var animatorCalled = false;
        final original = Container(key: const Key('original'));

        final result = WebOptimizations.conditionalAnimate(original, (w) {
          animatorCalled = true;
          return Container(key: const Key('animated'), child: w);
        });

        expect(
          animatorCalled,
          isTrue,
          reason: 'on non-web, the animator function must run',
        );
        expect((result as Container).key, const Key('animated'));
      },
    );

    testWidgets('repaintBoundary wraps the child in a RepaintBoundary', (
      tester,
    ) async {
      final child = Container(key: const Key('payload'));
      final wrapped = WebOptimizations.repaintBoundary(child);

      await tester.pumpWidget(MaterialApp(home: wrapped));

      expect(find.byType(RepaintBoundary), findsWidgets);
      expect(find.byKey(const Key('payload')), findsOneWidget);
    });

    test(
      'imageCacheWidth does NOT cap the width on non-web, even above 400',
      () {
        // This is the behaviour a naive reading of the class doc comment
        // ("optimized image dimensions for web") could get wrong -- the cap
        // is web-only. On the platform this test actually runs on, a large
        // width must pass through untouched.
        expect(WebOptimizations.imageCacheWidth(1200), 1200);
      },
    );

    test('imageCacheWidth passes through null unchanged', () {
      expect(WebOptimizations.imageCacheWidth(null), isNull);
    });
  });
}
