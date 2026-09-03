import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/src/responsive/breakpoints.dart';

void main() {
  group('Breakpoints.isMobile/isTablet/isDesktop boundaries', () {
    test('just under the tablet breakpoint (650) is mobile', () {
      expect(Breakpoints.isMobile(649), isTrue);
      expect(Breakpoints.isTablet(649), isFalse);
    });

    test('exactly the tablet breakpoint (650) is tablet, not mobile', () {
      expect(Breakpoints.isMobile(650), isFalse);
      expect(Breakpoints.isTablet(650), isTrue);
    });

    test('just under the desktop breakpoint (1100) is still tablet', () {
      expect(Breakpoints.isTablet(1099), isTrue);
      expect(Breakpoints.isDesktop(1099), isFalse);
    });

    test('exactly the desktop breakpoint (1100) is desktop, not tablet', () {
      expect(Breakpoints.isTablet(1100), isFalse);
      expect(Breakpoints.isDesktop(1100), isTrue);
    });
  });

  group('Breakpoints.getDeviceType', () {
    test('classifies each side of both boundaries correctly', () {
      expect(Breakpoints.getDeviceType(320), DeviceType.mobile);
      expect(Breakpoints.getDeviceType(649), DeviceType.mobile);
      expect(Breakpoints.getDeviceType(650), DeviceType.tablet);
      expect(Breakpoints.getDeviceType(1099), DeviceType.tablet);
      expect(Breakpoints.getDeviceType(1100), DeviceType.desktop);
      expect(Breakpoints.getDeviceType(2560), DeviceType.desktop);
    });
  });

  group('Breakpoints sub-tier classifiers', () {
    test('mobile small/medium/large partition correctly', () {
      expect(Breakpoints.isMobileSmall(374), isTrue);
      expect(Breakpoints.isMobileSmall(375), isFalse);
      expect(Breakpoints.isMobileMedium(375), isTrue);
      expect(Breakpoints.isMobileMedium(427), isTrue);
      expect(Breakpoints.isMobileMedium(428), isFalse);
      expect(Breakpoints.isMobileLarge(428), isTrue);
      expect(Breakpoints.isMobileLarge(649), isTrue);
    });

    test('desktop small/medium/large partition correctly', () {
      expect(Breakpoints.isDesktopSmall(1280), isTrue);
      expect(Breakpoints.isDesktopSmall(1440), isFalse);
      expect(Breakpoints.isDesktopMedium(1440), isTrue);
      expect(Breakpoints.isDesktopMedium(1919), isTrue);
      expect(Breakpoints.isDesktopLarge(1920), isTrue);
    });
  });
}
