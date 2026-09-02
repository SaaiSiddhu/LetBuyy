import 'package:flutter/material.dart';

class AppColors {
  // ============================================
  // PRIMARY COLORS - Cyan/Turquoise Theme (from Logo)
  // ============================================
  static const Color primary = Color(0xFF00B4C5); // Bright Cyan (Logo Primary)
  static const Color primaryLight = Color(0xFF5DC8D5); // Light Cyan (Logo Screen)
  static const Color primaryDark = Color(0xFF008A98); // Deep Cyan
  static const Color primaryLighter = Color(0xFF8DE8F0); // Soft Cyan
  static const Color primaryDarker = Color(0xFF006B78); // Extra Dark Cyan

  // ============================================
  // SECONDARY COLORS - Dark Navy (from Logo Cart)
  // ============================================
  static const Color secondary = Color(0xFF1E3A4C); // Dark Navy (Logo Cart)
  static const Color secondaryLight = Color(0xFF3A5A6C);
  static const Color secondaryDark = Color(0xFF0F2030);
  static const Color secondaryLighter = Color(0xFF5A7A8C);

  // ============================================
  // ACCENT COLORS - Lime Green (Keep for highlights)
  // ============================================
  static const Color accent = Color(0xFFA4E500); // Lime Green
  static const Color accentLight = Color(0xFFC8F06B);
  static const Color accentDark = Color(0xFF798700);

  // ============================================
  // BACKGROUND COLORS - Light Theme
  // ============================================
  static const Color background = Color(0xFFF0F8FA); // Light Cyan Tint
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFE8F4F6);
  static const Color surfaceContainer = Color(0xFFD0E8EC);

  static const Color lightGrey = Color(0xFFF5FAFA);
  static const Color white = Color(0xFFFFFFFF);

  // ============================================
  // BACKGROUND COLORS - Dark Theme
  // ============================================
  static const Color backgroundDark = Color(0xFF0A1820); // Very Dark Navy
  static const Color surfaceDark = Color(0xFF152535); // Dark Navy
  static const Color surfaceDarkVariant = Color(0xFF1E3A4C); // Navy (matches logo cart)
  static const Color surfaceDarkContainer = Color(0xFF2A4A5C);
  static const Color surfaceDarkElevated = Color(0xFF3A5A6C);

  // ============================================
  // TEXT COLORS - Light Theme
  // ============================================
  static const Color textPrimary = Color(0xFF0F2030);
  static const Color textSecondary = Color(0xFF3A5A6C);
  static const Color textTertiary = Color(0xFF6A8A9C);
  static const Color textHint = Color(0xFF9AB0BC);
  static const Color textDisabled = Color(0xFFC0D0D8);

  static const Color grey = Color(0xFF6A8A9C);

  // ============================================
  // TEXT COLORS - Dark Theme
  // ============================================
  static const Color textLight = Color(0xFFE8F4F6);
  static const Color textLightSecondary = Color(0xFFB0D8E0);
  static const Color textLightTertiary = Color(0xFF80C0D0);
  static const Color textLightHint = Color(0xFF60A8B8);
  static const Color textLightDisabled = Color(0xFF3A5A6C);

  // ============================================
  // STATUS COLORS
  // ============================================
  static const Color success = Color(0xFFA4E500);
  static const Color successLight = Color(0xFFC8F06B);
  static const Color successDark = Color(0xFF798700);

  static const Color error = Color(0xFFB02525);
  static const Color errorLight = Color(0xFFE05C5C);
  static const Color errorDark = Color(0xFF710A0A);

  static const Color warning = Color(0xFFFBBF24);
  static const Color warningLight = Color(0xFFFDE68A);
  static const Color warningDark = Color(0xFFB45309);

  static const Color info = Color(0xFF00B4C5); // Updated to logo cyan
  static const Color infoLight = Color(0xFF5DC8D5);
  static const Color infoDark = Color(0xFF008A98);

  // ============================================
  // BORDER & DIVIDER COLORS
  // ============================================
  static const Color border = Color(0xFFD0E0E4);
  static const Color borderLight = Color(0xFFE8F4F6);
  static const Color borderDark = Color(0xFF2A4A5C);

  static const Color divider = Color(0xFFB8D0D8);
  static const Color dividerLight = Color(0xFFD8E8EC);

  static const Color borderDarkTheme = Color(0xFF2A4A5C);
  static const Color dividerDarkTheme = Color(0xFF3A5A6C);

  // ============================================
  // GRADIENT COLORS
  // ============================================
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

  // ============================================
  // SHADOW COLORS
  // ============================================
  static const Color shadowLight = Color(0x1A000000);
  static const Color shadowMedium = Color(0x33000000);
  static const Color shadowDark = Color(0x4D000000);
  static const Color shadowExtraDark = Color(0x66000000);

  static const Color shadowDarkTheme = Color(0x80000000);

  // ============================================
  // ORDER STATUS COLORS
  // ============================================
  static const Color pending = Color(0xFFFBBF24);
  static const Color confirmed = Color(0xFF0F5257);
  static const Color processing = Color(0xFF88B04D);
  static const Color shipped = Color(0xFF09846A);
  static const Color outForDelivery = Color(0xFFF97316);
  static const Color delivered = Color(0xFFA4E500);
  static const Color cancelled = Color(0xFFB02525);
  static const Color returned = Color(0xFF6B7280);
  static const Color refunded = Color(0xFF4B706F);

  // ============================================
  // RATING COLORS
  // ============================================
  static const Color ratingActive = Color(0xFFFBBF24);
  static const Color ratingInactive = Color(0xFFE0E0E0);
  static const Color ratingActiveDark = Color(0xFFF2EECB);
  static const Color ratingInactiveDark = Color(0xFF595959);

  // ============================================
  // DISCOUNT & BADGE COLORS
  // ============================================
  static const Color discountBg = Color(0xFFB02525);
  static const Color discountText = Color(0xFFFFFFFF);
  static const Color discountBgDark = Color(0xFF710A0A);

  static const Color badgeNew = Color(0xFFA4E500);
  static const Color badgeSale = Color(0xFFB02525);
  static const Color badgeFeatured = Color(0xFFF97316);
  static const Color badgeOutOfStock = Color(0xFF6B7280);

  // ============================================
  // SPECIAL UI COLORS
  // ============================================
  static const Color favorite = Color(0xFF88B04D);
  static const Color cart = Color(0xFFF97316);
  static const Color notification = Color(0xFFB02525);

  static const Color inStock = Color(0xFFA4E500);
  static const Color lowStock = Color(0xFFF97316);
  static const Color outOfStock = Color(0xFFB02525);

  static const Color cod = Color(0xFFA4E500);
  static const Color online = Color(0xFF0F5257);
  static const Color wallet = Color(0xFF88B04D);

  // ============================================
  // OVERLAY COLORS
  // ============================================
  static const Color overlay = Color(0x802C554E);
  static const Color overlayLight = Color(0x402C554E);
  static const Color overlayDark = Color(0xB32C554E);

  // ============================================
  // SHIMMER COLORS
  // ============================================
  static const Color shimmerBase = Color(0xFFBCD8D6);
  static const Color shimmerHighlight = Color(0xFFE9F1F0);

  static const Color shimmerBaseDark = Color(0xFF2B5556);
  static const Color shimmerHighlightDark = Color(0xFF4A8B88);

  // ============================================
  // CATEGORY COLORS
  // ============================================
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

  // ============================================
  // HELPER METHODS
  // ============================================
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
