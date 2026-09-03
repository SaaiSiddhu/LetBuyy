import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/src/web/web_utils.dart';

/// kIsWeb is false under a plain `flutter test` VM run, so isWebMobile and
/// isWebDesktop always take their early `if (!kIsWeb) return false;` branch
/// here -- their platform-specific branches are unreachable without an
/// actual web compile target, which is out of scope for this phase.
void main() {
  group('WebUtils platform flags on a non-web test run', () {
    test('isWeb reflects kIsWeb directly', () {
      expect(WebUtils.isWeb, isFalse);
    });

    test('isWebMobile is false off-web regardless of platform', () {
      expect(WebUtils.isWebMobile, isFalse);
    });

    test('isWebDesktop is false off-web regardless of platform', () {
      expect(WebUtils.isWebDesktop, isFalse);
    });

    test('dispatchResizeEvent no-ops off-web instead of touching JS interop', () {
      // On a real web build this would reach into dart:js_interop; off-web
      // it must short-circuit before that -- the meaningful assertion is
      // that calling it does not throw.
      expect(WebUtils.dispatchResizeEvent, returnsNormally);
    });
  });

  group('WebUtils view-geometry math (pure arithmetic, no platform branch)', () {
    test('getFullScreenSize divides physical size by the device pixel ratio', () {
      final view = _FakeFlutterView(
        physicalSize: const Size(1080, 2400),
        devicePixelRatio: 3.0,
        viewInsetsBottom: 0,
      );
      final size = WebUtils.getFullScreenSize(view);
      expect(size.width, 360.0);
      expect(size.height, 800.0);
    });

    test('isKeyboardVisible is true when the bottom inset is positive', () {
      final withKeyboard = _FakeFlutterView(
        physicalSize: const Size(1080, 2400),
        devicePixelRatio: 3.0,
        viewInsetsBottom: 600,
      );
      final withoutKeyboard = _FakeFlutterView(
        physicalSize: const Size(1080, 2400),
        devicePixelRatio: 3.0,
        viewInsetsBottom: 0,
      );
      expect(WebUtils.isKeyboardVisible(withKeyboard), isTrue);
      expect(WebUtils.isKeyboardVisible(withoutKeyboard), isFalse);
    });

    test('getKeyboardHeight converts the physical inset to logical pixels', () {
      final view = _FakeFlutterView(
        physicalSize: const Size(1080, 2400),
        devicePixelRatio: 3.0,
        viewInsetsBottom: 600,
      );
      expect(WebUtils.getKeyboardHeight(view), 200.0);
    });
  });
}

/// Hand-written fake exposing only the FlutterView members WebUtils'
/// geometry helpers actually read, matching this repo's own
/// no-mocking-framework convention.
class _FakeFlutterView implements FlutterView {
  _FakeFlutterView({
    required this.physicalSize,
    required this.devicePixelRatio,
    required double viewInsetsBottom,
  }) : viewInsets = FakeViewPadding(bottom: viewInsetsBottom);

  @override
  final Size physicalSize;

  @override
  final double devicePixelRatio;

  @override
  final FakeViewPadding viewInsets;

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} not stubbed');
}

class FakeViewPadding implements ViewPadding {
  const FakeViewPadding({this.bottom = 0});

  @override
  final double bottom;

  @override
  double get left => 0;
  @override
  double get right => 0;
  @override
  double get top => 0;
}
