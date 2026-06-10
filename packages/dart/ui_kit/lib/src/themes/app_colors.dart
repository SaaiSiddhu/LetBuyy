import 'package:flutter/material.dart';

import '../tokens/letbuyy_tokens.dart';

/// Compatibility color facade backed by the generated LetBuyy token bridge.
class AppColors {
  AppColors._();

  static const Color brandPurple = LetbuyyColorTokens.brandPrimary;
  static const Color primary = LetbuyyColorTokens.brandPrimary;
  static const Color primaryLight = LetbuyyColorTokens.brandPrimaryLight;
  static const Color primaryDark = LetbuyyColorTokens.brandPrimaryDarker;
  static const Color primaryHover = LetbuyyColorTokens.brandPrimaryDark;
  static const Color primaryActive = LetbuyyColorTokens.brandPrimaryDarker;
  static const Color primaryLighter = LetbuyyColorTokens.brandPrimaryLighter;
  static const Color primaryDarker = LetbuyyColorTokens.brandPrimaryDarker;

  static const Color secondary = primaryHover;
  static const Color secondaryLight = primaryLight;
  static const Color secondaryDark = primaryActive;
  static const Color secondaryLighter = primaryLighter;

  static const Color accent = LetbuyyColorTokens.accentPink;
  static const Color accentLight = LetbuyyColorTokens.accentPinkLight;
  static const Color accentDark = LetbuyyColorTokens.accentPinkDark;

  static const Color lavender = primary;
  static const Color lavenderLight = primaryLight;
  static const Color lavenderDark = primaryActive;
  static const Color indigo = primary;

  static const Color background = LetbuyyColorTokens.slate50;
  static const Color surface = LetbuyyColorTokens.white;
  static const Color surfaceVariant = LetbuyyColorTokens.slate100;
  static const Color surfaceContainer = LetbuyyColorTokens.slate200;
  static const Color lightGrey = LetbuyyColorTokens.slate100;
  static const Color white = LetbuyyColorTokens.white;

  static const Color backgroundDark = LetbuyyColorTokens.slate950;
  static const Color surfaceDark = LetbuyyColorTokens.slate900;
  static const Color surfaceDarkVariant = LetbuyyColorTokens.slate800;
  static const Color surfaceDarkContainer = LetbuyyColorTokens.slate700;
  static const Color surfaceDarkElevated = LetbuyyColorTokens.slate600;

  static const Color textPrimary = LetbuyyColorTokens.slate900;
  static const Color textSecondary = LetbuyyColorTokens.slate600;
  static const Color textTertiary = LetbuyyColorTokens.slate500;
  static const Color textHint = LetbuyyColorTokens.slate400;
  static const Color textDisabled = LetbuyyColorTokens.slate300;
  static const Color grey = LetbuyyColorTokens.slate500;

  static const Color textLight = LetbuyyColorTokens.slate50;
  static const Color textLightSecondary = LetbuyyColorTokens.slate300;
  static const Color textLightTertiary = LetbuyyColorTokens.slate400;
  static const Color textLightHint = LetbuyyColorTokens.slate500;
  static const Color textLightDisabled = LetbuyyColorTokens.slate700;

  static const Color success = LetbuyyColorTokens.success;
  static const Color successLight = LetbuyyPrimitiveTokens.green100;
  static const Color successDark = LetbuyyPrimitiveTokens.green700;
  static const Color error = LetbuyyColorTokens.error;
  static const Color errorLight = LetbuyyPrimitiveTokens.red300;
  static const Color errorDark = LetbuyyPrimitiveTokens.red700;
  static const Color warning = LetbuyyColorTokens.warning;
  static const Color warningLight = LetbuyyPrimitiveTokens.amber100;
  static const Color warningDark = LetbuyyPrimitiveTokens.amber800;
  static const Color info = LetbuyyColorTokens.info;
  static const Color infoLight = LetbuyyPrimitiveTokens.blue300;
  static const Color infoDark = LetbuyyPrimitiveTokens.blue700;
  static const Color infoAccent = LetbuyyColorTokens.cyan;

  static const Color border = LetbuyyColorTokens.slate300;
  static const Color borderLight = LetbuyyColorTokens.slate200;
  static const Color borderDark = LetbuyyColorTokens.slate700;
  static const Color divider = LetbuyyColorTokens.slate300;
  static const Color dividerLight = LetbuyyColorTokens.slate200;
  static const Color borderDarkTheme = LetbuyyColorTokens.slate700;
  static const Color dividerDarkTheme = LetbuyyColorTokens.slate600;

  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient primaryGradientVertical = LinearGradient(
    colors: [primary, primaryLight],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
  static const LinearGradient goldGradient = LinearGradient(
    colors: [warning, warningDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient oceanGradient = LinearGradient(
    colors: [LetbuyyColorTokens.cyan, info],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient secondaryGradient = LinearGradient(
    colors: [secondary, secondaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient accentGradient = LinearGradient(
    colors: [accent, accentLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient primaryGradientDark = LinearGradient(
    colors: [primaryDark, primaryDarker],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient backgroundGradientDark = LinearGradient(
    colors: [backgroundDark, surfaceDark],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
  static const LinearGradient backgroundGradientLight = LinearGradient(
    colors: [background, surfaceVariant],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
  static const LinearGradient brandingGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [surfaceDark, surfaceDarkVariant, surfaceDarkContainer],
  );

  static const Color scaffoldLight = LetbuyyColorTokens.slate50;
  static const Color scaffoldDark = LetbuyyColorTokens.slate950;
  static const LinearGradient authCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [surfaceDarkVariant, surfaceDark],
  );
  static const LinearGradient glassGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [LetbuyyPrimitiveTokens.overlayDark, LetbuyyPrimitiveTokens.overlayLight],
  );

  static final Color surfaceGlass = white.withValues(alpha: 0.80);
  static final Color surfaceGlassHigh = white.withValues(alpha: 0.90);
  static final Color surfaceGlassLow = white.withValues(alpha: 0.40);
  static final Color surfaceGlassDark = surfaceDark.withValues(alpha: 0.80);
  static final Color surfaceGlassDarkHigh = surfaceDark.withValues(alpha: 0.90);
  static final Color surfaceGlassDarkLow = surfaceDark.withValues(alpha: 0.40);

  static final Color shadowLight = LetbuyyColorTokens.black.withValues(alpha: 0.10);
  static final Color shadowMedium = LetbuyyColorTokens.black.withValues(alpha: 0.20);
  static final Color shadowDark = LetbuyyColorTokens.black.withValues(alpha: 0.30);
  static final Color shadowExtraDark = LetbuyyColorTokens.black.withValues(alpha: 0.40);
  static final Color shadowDarkTheme = LetbuyyColorTokens.black.withValues(alpha: 0.50);

  static const Color pending = warning;
  static const Color confirmed = info;
  static const Color processing = LetbuyyColorTokens.teal;
  static const Color shipped = LetbuyyColorTokens.cyan;
  static const Color outForDelivery = warningDark;
  static const Color delivered = success;
  static const Color cancelled = error;
  static const Color returned = LetbuyyColorTokens.slate500;
  static const Color refunded = LetbuyyColorTokens.slate600;

  static const Color ratingActive = warning;
  static const Color ratingInactive = LetbuyyColorTokens.slate200;
  static const Color ratingActiveDark = warningLight;
  static const Color ratingInactiveDark = LetbuyyColorTokens.slate600;

  static const Color discountBg = error;
  static const Color discountText = white;
  static const Color discountBgDark = LetbuyyPrimitiveTokens.red700;
  static const Color badgeNew = success;
  static const Color badgeSale = error;
  static const Color badgeFeatured = warningDark;
  static const Color badgeOutOfStock = LetbuyyColorTokens.slate500;

  static const Color favorite = success;
  static const Color cart = warningDark;
  static const Color notification = error;
  static const Color inStock = success;
  static const Color lowStock = warningDark;
  static const Color outOfStock = error;
  static const Color cod = success;
  static const Color online = info;
  static const Color wallet = LetbuyyColorTokens.teal;

  static final Color overlay = surfaceDark.withValues(alpha: 0.50);
  static final Color overlayLight = surfaceDark.withValues(alpha: 0.25);
  static final Color overlayDark = surfaceDark.withValues(alpha: 0.70);
  static const Color shimmerBase = LetbuyyColorTokens.slate200;
  static const Color shimmerHighlight = LetbuyyColorTokens.slate50;
  static const Color shimmerBaseDark = LetbuyyColorTokens.slate700;
  static const Color shimmerHighlightDark = LetbuyyColorTokens.slate600;

  static const List<Color> categoryColors = [
    primary,
    secondary,
    primaryLight,
    secondaryLight,
    accent,
    primaryDarker,
    secondaryDark,
    primaryLighter,
  ];

  static Color getOrderStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending':
        return pending;
      case 'confirmed':
        return confirmed;
      case 'processing':
        return processing;
      case 'shipped':
        return shipped;
      case 'outfordelivery':
      case 'out_for_delivery':
        return outForDelivery;
      case 'delivered':
        return delivered;
      case 'cancelled':
        return cancelled;
      case 'returned':
        return returned;
      case 'refunded':
        return refunded;
      default:
        return textSecondary;
    }
  }
}
