import 'package:flutter/material.dart';

/// Store Admin Colors
/// Unified color system for LetBuyy Store Admin app (Landing Page + Dashboard)
/// Based on Indigo/Violet/Pink palette with Slate neutrals
class StoreAdminColors {
  StoreAdminColors._();

  // ============================================
  // PRIMARY COLORS - Indigo
  // ============================================
  static const Color primary = Color(0xFF6366F1);        // Indigo 500
  static const Color primaryLight = Color(0xFF818CF8);   // Indigo 400
  static const Color primaryLighter = Color(0xFFA5B4FC); // Indigo 300
  static const Color primaryDark = Color(0xFF4F46E5);    // Indigo 600
  static const Color primaryDarker = Color(0xFF4338CA);  // Indigo 700

  // ============================================
  // SECONDARY COLORS - Violet
  // ============================================
  static const Color secondary = Color(0xFF8B5CF6);        // Violet 500
  static const Color secondaryLight = Color(0xFFA78BFA);   // Violet 400
  static const Color secondaryLighter = Color(0xFFC4B5FD); // Violet 300
  static const Color secondaryDark = Color(0xFF7C3AED);    // Violet 600
  static const Color secondaryDarker = Color(0xFF6D28D9);  // Violet 700

  // ============================================
  // ACCENT COLORS - Pink
  // ============================================
  static const Color accent = Color(0xFFEC4899);        // Pink 500
  static const Color accentLight = Color(0xFFF472B6);   // Pink 400
  static const Color accentLighter = Color(0xFFF9A8D4); // Pink 300
  static const Color accentDark = Color(0xFFDB2777);    // Pink 600
  static const Color accentDarker = Color(0xFFBE185D);  // Pink 700

  // ============================================
  // SEMANTIC COLORS
  // ============================================
  static const Color success = Color(0xFF10B981);       // Emerald 500
  static const Color successLight = Color(0xFF34D399);  // Emerald 400
  static const Color successDark = Color(0xFF059669);   // Emerald 600

  static const Color warning = Color(0xFFF59E0B);       // Amber 500
  static const Color warningLight = Color(0xFFFBBF24);  // Amber 400
  static const Color warningDark = Color(0xFFD97706);   // Amber 600

  static const Color error = Color(0xFFEF4444);         // Red 500
  static const Color errorLight = Color(0xFFF87171);    // Red 400
  static const Color errorDark = Color(0xFFDC2626);     // Red 600

  static const Color info = Color(0xFF3B82F6);          // Blue 500
  static const Color infoLight = Color(0xFF60A5FA);     // Blue 400
  static const Color infoDark = Color(0xFF2563EB);      // Blue 600

  // ============================================
  // NEUTRAL COLORS - Slate
  // ============================================
  static const Color slate950 = Color(0xFF020617);
  static const Color slate900 = Color(0xFF0F172A);      // Headlines, Footer BG
  static const Color slate800 = Color(0xFF1E293B);      // Footer gradient
  static const Color slate700 = Color(0xFF334155);      // Dark cards
  static const Color slate600 = Color(0xFF475569);
  static const Color slate500 = Color(0xFF64748B);      // Body text
  static const Color slate400 = Color(0xFF94A3B8);      // Muted labels
  static const Color slate300 = Color(0xFFCBD5E1);      // Disabled text
  static const Color slate200 = Color(0xFFE2E8F0);      // Borders
  static const Color slate100 = Color(0xFFF1F5F9);      // Dividers, Hover
  static const Color slate50 = Color(0xFFF8FAFC);       // Backgrounds
  static const Color white = Color(0xFFFFFFFF);         // Surface

  // ============================================
  // BACKGROUND COLORS - Light Theme
  // ============================================
  static const Color background = Color(0xFFF8FAFC);    // slate50
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF1F5F9); // slate100
  static const Color surfaceContainer = Color(0xFFE2E8F0); // slate200

  // Landing page specific backgrounds
  static const Color heroBackground = Color(0xFFF8FAFF);
  static const Color sectionAlt = Color(0xFFFAF5FF);    // Light purple wash
  static const Color sectionBlue = Color(0xFFF0F4FF);   // Light blue wash

  // ============================================
  // BACKGROUND COLORS - Dark Theme
  // ============================================
  static const Color backgroundDark = Color(0xFF020617);   // slate950
  static const Color surfaceDark = Color(0xFF0F172A);      // slate900
  static const Color surfaceDarkVariant = Color(0xFF1E293B); // slate800
  static const Color surfaceDarkContainer = Color(0xFF334155); // slate700

  // ============================================
  // TEXT COLORS
  // ============================================
  static const Color textPrimary = Color(0xFF0F172A);    // slate900 - Headlines
  static const Color textSecondary = Color(0xFF64748B);  // slate500 - Body
  static const Color textMuted = Color(0xFF94A3B8);      // slate400 - Labels
  static const Color textDisabled = Color(0xFFCBD5E1);   // slate300
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // Dark theme text
  static const Color textLight = Color(0xFFF8FAFC);       // slate50
  static const Color textLightSecondary = Color(0xFFCBD5E1); // slate300
  static const Color textLightMuted = Color(0xFF94A3B8);  // slate400

  // ============================================
  // BORDER & DIVIDER COLORS
  // ============================================
  static const Color border = Color(0xFFE2E8F0);        // slate200
  static const Color borderLight = Color(0xFFF1F5F9);   // slate100
  static const Color borderDark = Color(0xFFCBD5E1);    // slate300
  static const Color divider = Color(0xFFF1F5F9);       // slate100

  static const Color borderDarkTheme = Color(0xFF334155);  // slate700
  static const Color dividerDarkTheme = Color(0xFF475569); // slate600

  // ============================================
  // GRADIENTS
  // ============================================
  
  /// Primary CTA gradient (Indigo → Violet)
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, secondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Accent gradient (Indigo → Violet → Pink)
  static const LinearGradient accentGradient = LinearGradient(
    colors: [primary, secondary, accent],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Hero section background gradient
  static const LinearGradient heroGradient = LinearGradient(
    colors: [
      Color(0xFFF8FAFF),  // Near white with blue tint
      Color(0xFFEEF2FF),  // Indigo 50
      Color(0xFFF5F3FF),  // Violet 50
      Color(0xFFFDF4FF),  // Fuchsia 50
      Color(0xFFFAFAFA),  // Neutral
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Pricing section gradient
  static const LinearGradient pricingSectionGradient = LinearGradient(
    colors: [white, Color(0xFFFAF5FF), Color(0xFFF0F4FF), white],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  /// Testimonials header gradient (Violet → Pink)
  static const LinearGradient testimonialGradient = LinearGradient(
    colors: [secondary, accent],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  /// Footer dark gradient
  static const LinearGradient footerGradient = LinearGradient(
    colors: [slate900, slate800],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  /// CTA Section bold gradient
  static const LinearGradient ctaGradient = LinearGradient(
    colors: [primary, secondary, accent],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ============================================
  // SHADOW COLORS
  // ============================================
  static const Color shadowLight = Color(0x1A000000);    // 10%
  static const Color shadowMedium = Color(0x26000000);   // 15%
  static const Color shadowDark = Color(0x33000000);     // 20%
  
  static Color primaryShadow = primary.withValues(alpha: 0.3);
  static Color secondaryShadow = secondary.withValues(alpha: 0.3);
  static Color accentShadow = accent.withValues(alpha: 0.3);

  // ============================================
  // CATEGORY / FEATURE COLORS
  // ============================================
  static const List<Color> featureColors = [
    primary,      // Indigo
    secondary,    // Violet
    Color(0xFF06B6D4), // Cyan
    success,      // Emerald
    warning,      // Amber
    accent,       // Pink
  ];

  static const List<Color> storeCardColors = [
    secondary,    // Fashion - Violet
    success,      // Grocery - Emerald
    info,         // Electronics - Blue
    accent,       // Cosmetics - Pink
    warning,      // Furniture - Amber
    Color(0xFF14B8A6), // Pet - Teal
    Color(0xFF78716C), // Books - Stone
    error,        // Sports - Red
    Color(0xFFFBBF24), // Toys - Yellow
    Color(0xFFD4AF37), // Jewelry - Gold
  ];

  // ============================================
  // HELPER METHODS
  // ============================================
  
  /// Get color with opacity
  static Color withOpacity(Color color, double opacity) {
    return color.withValues(alpha: opacity);
  }

  /// Badge background from color
  static Color badgeBackground(Color color) {
    return color.withValues(alpha: 0.1);
  }

  /// Border from color
  static Color borderFrom(Color color) {
    return color.withValues(alpha: 0.2);
  }
}
