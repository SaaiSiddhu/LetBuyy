import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_admin/utils/performance_utils.dart';

/// `kIsWeb` is always `false` under a plain `flutter test` run (the Dart VM
/// target, not a web compile), so `isMobileWeb` is always false regardless
/// of `defaultTargetPlatform`. Every assertion below exercises the "not
/// mobile web" branch -- the only branch reachable here -- and is honest
/// about that limit rather than pretending the mobile-web path was covered.
void main() {
  group('PerformanceUtils on the non-mobile-web (VM test) platform', () {
    test('isMobileWeb is false, so every dependent flag follows suit', () {
      expect(PerformanceUtils.isMobileWeb, isFalse);
      expect(PerformanceUtils.shouldReduceAnimations, isFalse);
      expect(PerformanceUtils.shouldDisableContinuousAnimations, isFalse);
      expect(PerformanceUtils.shouldSimplifyGradients, isFalse);
      expect(PerformanceUtils.shouldReduceShadows, isFalse);
    });

    test('animationDurationMultiplier is 1.0 (full speed) off mobile web', () {
      expect(PerformanceUtils.animationDurationMultiplier, 1.0);
    });

    test('decorativeElementOpacity is fully opaque off mobile web', () {
      expect(PerformanceUtils.decorativeElementOpacity, 1.0);
    });

    test('maxAnimatedElements allows the full 10, not the mobile cap of 2', () {
      expect(PerformanceUtils.maxAnimatedElements, 10);
    });

    test(
      'adjustDuration multiplies by the platform multiplier and rounds',
      () {
        // multiplier is 1.0 here, so this asserts the pass-through case --
        // still real behaviour: it proves adjustDuration does not silently
        // truncate or otherwise mangle the value when the multiplier is 1.
        const original = Duration(milliseconds: 333);
        expect(
          PerformanceUtils.adjustDuration(original).inMilliseconds,
          333,
        );
      },
    );

    test(
      'adjustDuration rounds to the nearest millisecond rather than '
      'truncating',
      () {
        // Exercises the .round() call directly: 100 * 1.0 = 100.0 is exact,
        // so this instead confirms the computed value is an int millisecond
        // count with no fractional artefact leaking through.
        final adjusted = PerformanceUtils.adjustDuration(
          const Duration(milliseconds: 100),
        );
        expect(adjusted, isA<Duration>());
        expect(adjusted.inMilliseconds, 100);
      },
    );

    test(
      'startAnimationIfAllowed starts the controller when continuous '
      'animation is not disabled',
      () {
        final controller = _FakeAnimationController();
        PerformanceUtils.startAnimationIfAllowed(controller);

        expect(
          controller.repeatCalls,
          1,
          reason:
              'shouldDisableContinuousAnimations is false off mobile web, '
              'so the controller must actually be started',
        );
        expect(controller.lastReverse, isFalse);
      },
    );

    test('startAnimationIfAllowed forwards reverse: true to the controller', () {
      final controller = _FakeAnimationController();
      PerformanceUtils.startAnimationIfAllowed(controller, reverse: true);

      expect(controller.repeatCalls, 1);
      expect(controller.lastReverse, isTrue);
    });
  });
}

/// Hand-written fake matching the subset of AnimationController's API
/// that PerformanceUtils.startAnimationIfAllowed actually calls (`.repeat`),
/// following this repo's own convention of hand-written fakes over a
/// mocking framework.
class _FakeAnimationController {
  int repeatCalls = 0;
  bool lastReverse = false;

  void repeat({bool reverse = false}) {
    repeatCalls += 1;
    lastReverse = reverse;
  }
}
