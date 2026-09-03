import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/src/responsive/responsive_helper.dart';

/// ResponsiveHelper.getValue reads MediaQuery.sizeOf(context), so every
/// case here pumps a real widget tree at a controlled size via
/// MediaQuery(data: ..., child: ...) and reads the value through a Builder.
void main() {
  Future<T> valueAt<T>(
    WidgetTester tester,
    double width,
    T Function(BuildContext) read,
  ) async {
    late T result;
    await tester.pumpWidget(
      MediaQuery(
        data: MediaQueryData(size: Size(width, 800)),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Builder(
            builder: (context) {
              result = read(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      ),
    );
    return result;
  }

  group('ResponsiveHelper.getValue', () {
    testWidgets('returns mobile below 768', (tester) async {
      final v = await valueAt(
        tester,
        400,
        (c) => ResponsiveHelper.getValue(c, mobile: 'm', tablet: 't', desktop: 'd'),
      );
      expect(v, 'm');
    });

    testWidgets('returns tablet in [768, 1200)', (tester) async {
      final v = await valueAt(
        tester,
        900,
        (c) => ResponsiveHelper.getValue(c, mobile: 'm', tablet: 't', desktop: 'd'),
      );
      expect(v, 't');
    });

    testWidgets('returns desktop at and above 1200', (tester) async {
      final v = await valueAt(
        tester,
        1200,
        (c) => ResponsiveHelper.getValue(c, mobile: 'm', tablet: 't', desktop: 'd'),
      );
      expect(v, 'd');
    });

    testWidgets('falls back to desktop when tablet is omitted', (tester) async {
      final v = await valueAt(
        tester,
        900,
        (c) => ResponsiveHelper.getValue(c, mobile: 'm', desktop: 'd'),
      );
      expect(v, 'd', reason: 'no tablet value was provided');
    });
  });

  group('ResponsiveHelper derived helpers', () {
    testWidgets('getGridCount follows the same three-tier scheme', (tester) async {
      expect(
        await valueAt(tester, 400, (c) => ResponsiveHelper.getGridCount(c)),
        2,
      );
      expect(
        await valueAt(tester, 900, (c) => ResponsiveHelper.getGridCount(c)),
        3,
      );
      expect(
        await valueAt(tester, 1200, (c) => ResponsiveHelper.getGridCount(c)),
        5,
      );
    });

    testWidgets('getMaxContentWidth caps desktop width at 1400', (tester) async {
      expect(
        await valueAt(tester, 2000, (c) => ResponsiveHelper.getMaxContentWidth(c)),
        1400.0,
      );
    });

    testWidgets(
      'getMaxContentWidth returns the actual width when below the desktop cap',
      (tester) async {
        expect(
          await valueAt(tester, 400, (c) => ResponsiveHelper.getMaxContentWidth(c)),
          400.0,
        );
      },
    );
  });

  group('ResponsiveHelper orientation', () {
    testWidgets('isPortrait/isLandscape read MediaQuery orientation', (
      tester,
    ) async {
      bool? portrait;
      bool? landscape;
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(size: Size(400, 800)), // taller than wide
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: Builder(
              builder: (context) {
                portrait = ResponsiveHelper.isPortrait(context);
                landscape = ResponsiveHelper.isLandscape(context);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );

      expect(portrait, isTrue);
      expect(landscape, isFalse);
    });
  });
}
