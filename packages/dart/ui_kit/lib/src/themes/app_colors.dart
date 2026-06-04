import 'package:flutter/material.dart';

class AppColors {
  // ============================================
  // PRIMARY COLORS - LetBuyy Brand Purple V1
  // ============================================
  static const Color brandPurple = Color(0xFF8B5CF6);
  static const Color primary = Color(0xFF8B5CF6);
  static const Color primaryLight = Color(0xFFA78BFA);
  static const Color primaryDark = Color(0xFF6D28D9);
  static const Color primaryHover = Color(0xFF7C3AED);
  static const Color primaryActive = Color(0xFF6D28D9);
  static const Color primaryLighter = Color(0xFFC4B5FD);
  static const Color primaryDarker = Color(0xFF6D28D9);

  // ============================================
  // SECONDARY COLORS - Brand Purple Support
  // ============================================
  static const Color secondary = primaryHover;
  static const Color secondaryLight = primaryLight;
  static const Color secondaryDark = primaryActive;
  static const Color secondaryLighter = primaryLighter;

  // ============================================
  // ACCENT COLORS - Lime Green
  // ============================================
  static const Color accent = Color(0xFFA4E500); // Lime Green
  static const Color accentLight = Color(0xFFC8F06B);
  static const Color accentDark = Color(0xFF798700);

  // ============================================
  // EDITOR ACCENT - Compatibility aliases for Purple V1
  // ============================================
  static const Color lavender = primary;
  static const Color lavenderLight = primaryLight;
  static const Color lavenderDark = primaryActive;
  static const Color indigo = primary;

  // ============================================
  // BACKGROUND COLORS - Light Theme
  // ============================================
  static const Color background = Color(0xFFF8FAFC); // Ultra-light cool grey (Modern Standard)
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF1F5F9);
  static const Color surfaceContainer = Color(0xFFE2E8F0);
  
  // Glassmorphism (Light)
  static const Color surfaceGlass = Color(0xCCFFFFFF); // High opacity for readability
  static const Color surfaceGlassHigh = Color(0xE6FFFFFF);
  static const Color surfaceGlassLow = Color(0x66FFFFFF);

  static const Color lightGrey = Color(0xFFF1F6F5);
  static const Color white = Color(0xFFFFFFFF);

  // ============================================
  // BACKGROUND COLORS - Dark Theme
  // ============================================
  static const Color backgroundDark = Color(0xFF020617); // Richer, deeper dark (Slate 950)
  static const Color surfaceDark = Color(0xFF0F172A); // Slate 900
  static const Color surfaceDarkVariant = Color(0xFF1E293B); // Slate 800
  static const Color surfaceDarkContainer = Color(0xFF334155); // Slate 700
  static const Color surfaceDarkElevated = Color(0xFF475569); // Slate 600

  // Glassmorphism (Dark)
  static const Color surfaceGlassDark = Color(0xCC0F172A);
  static const Color surfaceGlassDarkHigh = Color(0xE60F172A);
  static const Color surfaceGlassDarkLow = Color(0x660F172A);

  // ============================================
  // TEXT COLORS - Light Theme
  // ============================================
  static const Color textPrimary = Color(0xFF1A1A2E); // Dark slate
  static const Color textSecondary = Color(0xFF4A5568); // Slate gray
  static const Color textTertiary = Color(0xFF718096); // Muted gray
  static const Color textHint = Color(0xFFA0AEC0); // Light gray
  static const Color textDisabled = Color(0xFFCBD5E0); // Disabled gray

  static const Color grey = Color(0xFF718096);

  // ============================================
  // TEXT COLORS - Dark Theme
  // ============================================
  static const Color textLight = Color(0xFFD3E4E3);
  static const Color textLightSecondary = Color(0xFFAED9D8);
  static const Color textLightTertiary = Color(0xFF89CBCB);
  static const Color textLightHint = Color(0xFF67BFBF);
  static const Color textLightDisabled = Color(0xFF3B706F);

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

  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0xFF60A5FA);
  static const Color infoDark = Color(0xFF2563EB);
  static const Color infoAccent = Color(0xFF33CCCC); // Accent variant for gradients

  // ============================================
  // BORDER & DIVIDER COLORS
  // ============================================
  static const Color border = Color(0xFFCAD7D6);
  static const Color borderLight = Color(0xFFE2EAE9);
  static const Color borderDark = Color(0xFF3B706F);

  static const Color divider = Color(0xFFB5CAC9);
  static const Color dividerLight = Color(0xFFD2E2E1);

  static const Color borderDarkTheme = Color(0xFF2B5556);
  static const Color dividerDarkTheme = Color(0xFF3B706F);

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
  
  // Premium Gold Gradient
  static const LinearGradient goldGradient = LinearGradient(
    colors: [Color(0xFFFFD700), Color(0xFFB8860B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  
  // Modern Ocean Gradient
  static const LinearGradient oceanGradient = LinearGradient(
    colors: [Color(0xFF06B6D4), Color(0xFF3B82F6)], // Cyan to Blue
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
    colors: [background, Color(0xFFF1F5F9)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // ============================================
  // LOGIN / AUTH SCREEN GRADIENTS
  // ============================================
  
  /// Branding panel gradient (left side of login screen)
  static const LinearGradient brandingGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF0F2027),  // Deep dark blue-teal
      Color(0xFF203A43),  // Mid teal  
      Color(0xFF2C5364),  // Steel blue
    ],
  );

  /// Auth screen scaffold colors
  static const Color scaffoldLight = Color(0xFFF0F4F8);
  static const Color scaffoldDark = Color(0xFF080B12);
  
  /// Auth card gradient
  static const LinearGradient authCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFF1E293B),
      Color(0xFF0F172A),
    ],
  );

  /// Premium glass effect gradient
  static const LinearGradient glassGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0x1AFFFFFF),
      Color(0x0DFFFFFF),
    ],
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
