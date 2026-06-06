import 'package:flutter/material.dart';
import 'letbuyy_color_tokens.dart';

/// Dark Premium Theme Colors for Store Builder
/// Uses 2025/2026 design trends: glassmorphism, bento grids, micro-interactions
class DarkThemeColors {
  DarkThemeColors._();

  // ============================================
  // BACKGROUND GRADIENTS
  // ============================================
  static const bgStart = Color(0xFF0A0F1A); // Deeper for contrast
  static const bgMid = Color(0xFF0F172A);
  static const bgEnd = Color(0xFF1E293B);

  // Mesh gradient colors for premium backgrounds
  static const meshAccent1 = LetbuyyColorTokens.brandPrimary;
  static const meshAccent2 = LetbuyyColorTokens.brandPrimaryDark;
  static const meshAccent3 = LetbuyyColorTokens.brandPrimaryDarker;

  // ============================================
  // SEMANTIC ELEVATION SYSTEM
  // ============================================
  /// Elevation 0: Base level (screen background)
  static const elevation0 = Color(0xFF0A0F1A);

  /// Elevation 1: Cards, panels (primary surfaces)
  static const elevation1 = Color(0xFF131B2E);

  /// Elevation 2: Hover states, modals
  static const elevation2 = Color(0xFF1A2540);

  /// Elevation 3: Tooltips, dropdowns, popovers
  static const elevation3 = Color(0xFF243352);

  // ============================================
  // GLASSMORPHISM SYSTEM
  // ============================================
  /// Light glass effect
  static Color glassLight = Colors.white.withValues(alpha: 0.03);
  static Color glassLightBorder = Colors.white.withValues(alpha: 0.08);
  static const double glassLightBlur = 8.0;

  /// Medium glass effect (default for cards)
  static Color glassMedium = Colors.white.withValues(alpha: 0.05);
  static Color glassMediumBorder = Colors.white.withValues(alpha: 0.12);
  static const double glassMediumBlur = 16.0;

  /// Heavy glass effect (modals, overlays)
  static Color glassHeavy = Colors.white.withValues(alpha: 0.08);
  static Color glassHeavyBorder = Colors.white.withValues(alpha: 0.18);
  static const double glassHeavyBlur = 24.0;

  /// Colored glass (accent overlays)
  static Color glassAccent = LetbuyyColorTokens.brandPrimary.withValues(
    alpha: 0.08,
  );
  static Color glassAccentBorder = LetbuyyColorTokens.brandPrimary.withValues(
    alpha: 0.25,
  );

  // ============================================
  // CARDS & SURFACES (Legacy - use elevation)
  // ============================================
  static const card = Color(0xFF1E293B);
  static const cardHover = Color(0xFF273548);
  static const cardBorder = Color(0xFF334155);
  static const surface = Color(0xFF1E293B);
  static const surfaceVariant = Color(0xFF273548);

  // ============================================
  // TEXT COLORS
  // ============================================
  static const textPrimary = Colors.white;
  static const textSecondary = Color(0xFF94A3B8);
  static const textTertiary = Color(0xFF64748B);
  static const textHint = Color(0xFF475569);

  // ============================================
  // ACCENT COLORS
  // ============================================
  static const accent = LetbuyyColorTokens.brandPrimary;
  static const accentBlue = Color(0xFF3B82F6); // Blue accent
  static const accentCyan = Color(0xFF06B6D4); // Cyan accent
  static const accentPink = Color(0xFFEC4899); // Pink accent
  static const accentTeal = Color(0xFF14B8A6); // Teal accent
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const error = Color(0xFFEF4444);

  // ============================================
  // DIVIDERS & BORDERS
  // ============================================
  static const divider = Color(0xFF1E293B);
  static const border = Color(0xFF334155);
  static const borderSubtle = Color(0xFF1E293B);

  // ============================================
  // GRADIENT PRESETS
  // ============================================
  /// Primary hero gradient
  static const heroGradient = LinearGradient(
    colors: [
      LetbuyyColorTokens.brandPrimary,
      LetbuyyColorTokens.brandPrimaryDark,
      LetbuyyColorTokens.brandPrimaryDarker,
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Success gradient
  static const successGradient = LinearGradient(
    colors: [Color(0xFF22C55E), Color(0xFF16A34A)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Blue gradient
  static const blueGradient = LinearGradient(
    colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Purple gradient
  static const purpleGradient = LinearGradient(
    colors: [
      LetbuyyColorTokens.brandPrimary,
      LetbuyyColorTokens.brandPrimaryDarker,
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Orange gradient
  static const orangeGradient = LinearGradient(
    colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Mesh gradient for backgrounds
  static BoxDecoration get meshGradient => BoxDecoration(
    gradient: RadialGradient(
      center: const Alignment(-0.8, -0.6),
      radius: 1.8,
      colors: [
        meshAccent1.withValues(alpha: 0.15),
        meshAccent2.withValues(alpha: 0.08),
        bgStart,
      ],
      stops: const [0.0, 0.4, 1.0],
    ),
  );

  // ============================================
  // ANIMATION & MOTION CONSTANTS
  // ============================================
  /// Fast micro-interactions
  static const Duration durationFast = Duration(milliseconds: 150);

  /// Default transitions
  static const Duration durationMedium = Duration(milliseconds: 300);

  /// Card entrances, complex animations
  static const Duration durationSlow = Duration(milliseconds: 450);

  /// Chart animations, count-ups
  static const Duration durationVeryLong = Duration(milliseconds: 800);

  /// Stagger delay between items
  static const Duration staggerDelay = Duration(milliseconds: 50);

  /// Default animation curve
  static const Curve defaultCurve = Curves.easeOutCubic;

  /// Bounce curve for playful animations
  static const Curve bounceCurve = Curves.elasticOut;

  /// Smooth curve for charts
  static const Curve smoothCurve = Curves.easeInOutCubic;

  // ============================================
  // DECORATIONS (Presets)
  // ============================================

  /// Screen background gradient
  static BoxDecoration get backgroundGradient => const BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [bgStart, bgMid, bgEnd],
      stops: [0.0, 0.5, 1.0],
    ),
  );

  /// Glassmorphic card (medium)
  static BoxDecoration get glassCard => BoxDecoration(
    color: glassMedium,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: glassMediumBorder),
  );

  /// Glassmorphic card (light)
  static BoxDecoration get glassCardLight => BoxDecoration(
    color: glassLight,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: glassLightBorder),
  );

  /// Glassmorphic card (heavy)
  static BoxDecoration get glassCardHeavy => BoxDecoration(
    color: glassHeavy,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: glassHeavyBorder),
  );

  /// Solid dark card (legacy compat)
  static BoxDecoration get solidCard => BoxDecoration(
    color: elevation1,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: borderSubtle),
  );

  /// Bento grid item decoration
  static BoxDecoration get bentoCard => BoxDecoration(
    color: glassMedium,
    borderRadius: BorderRadius.circular(24),
    border: Border.all(color: glassMediumBorder),
  );

  /// Floating action decoration
  static BoxDecoration floatingAction(Color accentColor) => BoxDecoration(
    gradient: LinearGradient(
      colors: [accentColor, accentColor.withValues(alpha: 0.8)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    borderRadius: BorderRadius.circular(16),
    boxShadow: [
      BoxShadow(
        color: accentColor.withValues(alpha: 0.3),
        blurRadius: 16,
        offset: const Offset(0, 8),
      ),
    ],
  );
}
