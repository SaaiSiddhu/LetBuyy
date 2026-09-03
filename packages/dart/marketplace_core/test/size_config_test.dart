import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_marketplace_core/src/responsive/size_config.dart';

/// SizeConfig stores its state in mutable `static late` fields (set by
/// `.init(context)` in the real app). Every test below sets those fields
/// directly before asserting, so each test is self-contained and order-
/// independent despite the shared global state.
void main() {
  group('SizeConfig block-size math', () {
    test('width()/height() scale linearly with the stored screen size', () {
      SizeConfig.screenWidth = 400;
      SizeConfig.screenHeight = 800;
      SizeConfig.blockSizeHorizontal = SizeConfig.screenWidth / 100;
      SizeConfig.blockSizeVertical = SizeConfig.screenHeight / 100;

      expect(SizeConfig.width(50), 200.0);
      expect(SizeConfig.height(25), 200.0);
    });

    test('safeWidth()/safeHeight() use the safe-area-adjusted block size', () {
      SizeConfig.screenWidth = 400;
      SizeConfig.screenHeight = 800;
      SizeConfig.safeAreaHorizontal = 40; // e.g. 20px notch on each side
      SizeConfig.safeAreaVertical = 100; // status bar + home indicator
      SizeConfig.safeBlockHorizontal =
          (SizeConfig.screenWidth - SizeConfig.safeAreaHorizontal) / 100;
      SizeConfig.safeBlockVertical =
          (SizeConfig.screenHeight - SizeConfig.safeAreaVertical) / 100;

      expect(SizeConfig.safeWidth(50), 180.0); // (400-40)/100*50
      expect(SizeConfig.safeHeight(50), 350.0); // (800-100)/100*50
    });
  });

  group('SizeConfig.getResponsiveTextSize', () {
    test('shrinks text by 10% under the mobile/tablet boundary (650)', () {
      SizeConfig.screenWidth = 400;
      expect(SizeConfig.getResponsiveTextSize(100), 90.0);
    });

    test('leaves text unchanged in the tablet band [650, 1100)', () {
      SizeConfig.screenWidth = 800;
      expect(SizeConfig.getResponsiveTextSize(100), 100.0);
    });

    test('grows text by 10% at and above the desktop boundary (1100)', () {
      SizeConfig.screenWidth = 1100;
      // 100 * 1.1 is not exactly representable in binary floating point
      // (yields 110.00000000000001), so this compares within a tight
      // tolerance rather than asserting bit-exact equality -- standard
      // practice for floating-point arithmetic, not a weakened assertion.
      expect(SizeConfig.getResponsiveTextSize(100), closeTo(110.0, 0.0001));
    });
  });

  group('SizeConfig.getResponsivePadding / getResponsiveMargin', () {
    test('padding steps 16 -> 24 -> 32 across the three bands', () {
      SizeConfig.screenWidth = 400;
      expect(SizeConfig.getResponsivePadding(), 16);
      SizeConfig.screenWidth = 800;
      expect(SizeConfig.getResponsivePadding(), 24);
      SizeConfig.screenWidth = 1200;
      expect(SizeConfig.getResponsivePadding(), 32);
    });

    test('margin steps 12 -> 16 -> 20 across the three bands', () {
      SizeConfig.screenWidth = 400;
      expect(SizeConfig.getResponsiveMargin(), 12);
      SizeConfig.screenWidth = 800;
      expect(SizeConfig.getResponsiveMargin(), 16);
      SizeConfig.screenWidth = 1200;
      expect(SizeConfig.getResponsiveMargin(), 20);
    });
  });

  group('SizeConfig.getGridColumns', () {
    test('steps 2 -> 3 -> 4 -> 5 across all four bands', () {
      SizeConfig.screenWidth = 400;
      expect(SizeConfig.getGridColumns(), 2);
      SizeConfig.screenWidth = 800;
      expect(SizeConfig.getGridColumns(), 3);
      SizeConfig.screenWidth = 1200;
      expect(SizeConfig.getGridColumns(), 4);
      SizeConfig.screenWidth = 1500;
      expect(SizeConfig.getGridColumns(), 5);
    });
  });

  group('SizeConfig.getCardWidth', () {
    test('subtracts padding and inter-card spacing, then divides by columns', () {
      // Mobile band: padding=16, margin=12, columns=2.
      // (400 - 16*2 - 12*(2-1)) / 2 = (400-32-12)/2 = 356/2 = 178
      SizeConfig.screenWidth = 400;
      expect(SizeConfig.getCardWidth(), 178.0);
    });
  });
}
