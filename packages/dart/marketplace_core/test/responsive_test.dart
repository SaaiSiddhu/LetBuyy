import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';

Widget _atWidth(double width, Widget child) {
  return MediaQuery(
    data: MediaQueryData(size: Size(width, 800)),
    child: Directionality(textDirection: TextDirection.ltr, child: child),
  );
}

void main() {
  group('Responsive widget switches its child by breakpoint', () {
    testWidgets('renders mobile below 768', (tester) async {
      await tester.pumpWidget(
        _atWidth(
          400,
          const Responsive(
            mobile: Text('mobile', textDirection: TextDirection.ltr),
            desktop: Text('desktop', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('mobile'), findsOneWidget);
      expect(find.text('desktop'), findsNothing);
    });

    testWidgets('renders tablet in [768, 1200) when provided', (tester) async {
      await tester.pumpWidget(
        _atWidth(
          900,
          const Responsive(
            mobile: Text('mobile', textDirection: TextDirection.ltr),
            tablet: Text('tablet', textDirection: TextDirection.ltr),
            desktop: Text('desktop', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('tablet'), findsOneWidget);
    });

    testWidgets('falls back to desktop in the tablet band when tablet is omitted', (
      tester,
    ) async {
      await tester.pumpWidget(
        _atWidth(
          900,
          const Responsive(
            mobile: Text('mobile', textDirection: TextDirection.ltr),
            desktop: Text('desktop', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('desktop'), findsOneWidget);
    });

    testWidgets('renders desktop at and above 1200', (tester) async {
      await tester.pumpWidget(
        _atWidth(
          1200,
          const Responsive(
            mobile: Text('mobile', textDirection: TextDirection.ltr),
            desktop: Text('desktop', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('desktop'), findsOneWidget);
    });
  });

  group('Responsive.isMobile/isTablet/isDesktop and getScreenType', () {
    testWidgets('agree with the widget\'s own build-time branching', (
      tester,
    ) async {
      ScreenType? type;
      bool? mobile, tablet, desktop;

      await tester.pumpWidget(
        _atWidth(
          900,
          Builder(
            builder: (context) {
              type = Responsive.getScreenType(context);
              mobile = Responsive.isMobile(context);
              tablet = Responsive.isTablet(context);
              desktop = Responsive.isDesktop(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(type, ScreenType.tablet);
      expect(mobile, isFalse);
      expect(tablet, isTrue);
      expect(desktop, isFalse);
    });
  });

  group('ResponsiveExtension on BuildContext', () {
    testWidgets('context.isMobile/screenType mirror the static methods', (
      tester,
    ) async {
      bool? isMobile;
      ScreenType? screenType;

      await tester.pumpWidget(
        _atWidth(
          400,
          Builder(
            builder: (context) {
              isMobile = context.isMobile;
              screenType = context.screenType;
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(isMobile, isTrue);
      expect(screenType, ScreenType.mobile);
    });

    testWidgets('context.isWeb mirrors kIsWeb (false under a VM test run)', (
      tester,
    ) async {
      bool? isWeb;
      await tester.pumpWidget(
        _atWidth(
          400,
          Builder(
            builder: (context) {
              isWeb = context.isWeb;
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(isWeb, isFalse);
    });
  });

  group('PlatformResponsive on this test environment (native macOS, not web)', () {
    // `flutter test` runs on the host Dart VM, not a browser -- kIsWeb is
    // false and dart:io Platform.isMacOS reflects the actual host OS (this
    // environment is Darwin/macOS). isNativeDesktop() is therefore true and
    // SHORT-CIRCUITS every width-based branch in both isNativeDesktop's
    // caller and PlatformResponsive.build -- the web-size branches
    // (webMobile/webTablet/webDesktop) are genuinely unreachable from a
    // plain `flutter test` run on this or any macOS/Windows/Linux dev
    // machine, regardless of window width. Documented, not worked around.
    testWidgets('isNativeDesktop is true on this host', (tester) async {
      expect(PlatformResponsive.isNativeDesktop(), isTrue);
      expect(PlatformResponsive.isNativeMobile(), isFalse);
    });

    testWidgets('build() takes the native-desktop path regardless of width', (
      tester,
    ) async {
      await tester.pumpWidget(
        _atWidth(
          400, // a mobile-sized width -- must NOT select the mobile widget,
          // because isNativeDesktop() short-circuits before width is
          // consulted at all.
          const PlatformResponsive(
            mobile: Text('mobile', textDirection: TextDirection.ltr),
            web: Text('web', textDirection: TextDirection.ltr),
            desktop: Text('desktop', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('desktop'), findsOneWidget);
      expect(find.text('mobile'), findsNothing);
    });

    testWidgets('build() falls back to web when desktop is omitted', (
      tester,
    ) async {
      await tester.pumpWidget(
        _atWidth(
          400,
          const PlatformResponsive(
            mobile: Text('mobile', textDirection: TextDirection.ltr),
            web: Text('web', textDirection: TextDirection.ltr),
          ),
        ),
      );
      expect(find.text('web'), findsOneWidget);
    });

    testWidgets('getPlatformType reports nativeDesktop on this host', (
      tester,
    ) async {
      PlatformType? type;
      await tester.pumpWidget(
        _atWidth(
          400,
          Builder(
            builder: (context) {
              type = PlatformResponsive.getPlatformType(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      expect(type, PlatformType.nativeDesktop);
    });
  });
}
