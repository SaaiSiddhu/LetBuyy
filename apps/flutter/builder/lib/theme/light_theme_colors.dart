import 'package:flutter/material.dart';

/// Light Premium Theme Colors for Store Builder
/// Mirror of DarkThemeColors with light mode equivalents
/// Uses 2025/2026 design trends: glassmorphism, bento grids, micro-interactions
class LightThemeColors {
  LightThemeColors._();

  // ============================================
  // BACKGROUND GRADIENTS
  // ============================================
  static const bgStart = Color(0xFFF8FAFC);  // Slate 50
  static const bgMid = Color(0xFFF1F5F9);    // Slate 100
  static const bgEnd = Color(0xFFE2E8F0);    // Slate 200
  
  // Mesh gradient colors for premium backgrounds
  static const meshAccent1 = Color(0xFF8B5CF6);
  static const meshAccent2 = Color(0xFF3B82F6);
  static const meshAccent3 = Color(0xFF06B6D4);
  
  // ============================================
  // SEMANTIC ELEVATION SYSTEM
  // ============================================
  /// Elevation 0: Base level (screen background)
  static const elevation0 = Color(0xFFF8FAFC);
  
  /// Elevation 1: Cards, panels (primary surfaces)
  static const elevation1 = Color(0xFFFFFFFF);
  
  /// Elevation 2: Hover states, modals
  static const elevation2 = Color(0xFFF8FAFC);
  
  /// Elevation 3: Tooltips, dropdowns, popovers
  static const elevation3 = Color(0xFFF1F5F9);
  
  // ============================================
  // GLASSMORPHISM SYSTEM
  // ============================================
  /// Light glass effect
  static Color glassLight = Colors.black.withValues(alpha: 0.02);
  static Color glassLightBorder = Colors.black.withValues(alpha: 0.06);
  static const double glassLightBlur = 8.0;
  
  /// Medium glass effect (default for cards)
  static Color glassMedium = Colors.black.withValues(alpha: 0.03);
  static Color glassMediumBorder = Colors.black.withValues(alpha: 0.08);
  static const double glassMediumBlur = 16.0;
  
  /// Heavy glass effect (modals, overlays)
  static Color glassHeavy = Colors.black.withValues(alpha: 0.05);
  static Color glassHeavyBorder = Colors.black.withValues(alpha: 0.12);
  static const double glassHeavyBlur = 24.0;
  
  /// Colored glass (accent overlays)
  static Color glassAccent = const Color(0xFF8B5CF6).withValues(alpha: 0.06);
  static Color glassAccentBorder = const Color(0xFF8B5CF6).withValues(alpha: 0.20);
  
  // ============================================
  // CARDS & SURFACES
  // ============================================
  static const card = Color(0xFFFFFFFF);
  static const cardHover = Color(0xFFF8FAFC);
  static const cardBorder = Color(0xFFE2E8F0);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceVariant = Color(0xFFF8FAFC);
  
  // ============================================
  // TEXT COLORS
  // ============================================
  static const textPrimary = Color(0xFF0F172A);    // Slate 900
  static const textSecondary = Color(0xFF475569);  // Slate 600
  static const textTertiary = Color(0xFF64748B);   // Slate 500
  static const textHint = Color(0xFF94A3B8);       // Slate 400
  
  // ============================================
  // ACCENT COLORS (Same as dark - vibrant colors work on both)
  // ============================================
  static const accent = Color(0xFF8B5CF6);       // Primary purple
  static const accentBlue = Color(0xFF3B82F6);   // Blue accent
  static const accentCyan = Color(0xFF06B6D4);   // Cyan accent
  static const accentPink = Color(0xFFEC4899);   // Pink accent
  static const accentTeal = Color(0xFF14B8A6);   // Teal accent
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFF59E0B);
  static const error = Color(0xFFEF4444);
  
  // ============================================
  // DIVIDERS & BORDERS
  // ============================================
  static const divider = Color(0xFFE2E8F0);      // Slate 200
  static const border = Color(0xFFCBD5E1);       // Slate 300
  static const borderSubtle = Color(0xFFE2E8F0); // Slate 200
  
  // ============================================
  // GRADIENT PRESETS
  // ============================================
  /// Primary hero gradient
  static const heroGradient = LinearGradient(
    colors: [Color(0xFF8B5CF6), Color(0xFF6366F1), Color(0xFF3B82F6)],
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
    colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  
  /// Orange gradient
  static const orangeGradient = LinearGradient(
    colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  
  /// Mesh gradient for backgrounds (light version)
  static BoxDecoration get meshGradient => BoxDecoration(
    gradient: RadialGradient(
      center: const Alignment(-0.8, -0.6),
      radius: 1.8,
      colors: [
        meshAccent1.withValues(alpha: 0.08),
        meshAccent2.withValues(alpha: 0.04),
        bgStart,
      ],
      stops: const [0.0, 0.4, 1.0],
    ),
  );
  
  // ============================================
  // ANIMATION & MOTION CONSTANTS (Same as dark)
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
    color: card,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: cardBorder),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.04),
        blurRadius: 8,
        offset: const Offset(0, 2),
      ),
    ],
  );
  
  /// Glassmorphic card (light)
  static BoxDecoration get glassCardLight => BoxDecoration(
    color: surfaceVariant,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: borderSubtle),
  );
  
  /// Glassmorphic card (heavy)
  static BoxDecoration get glassCardHeavy => BoxDecoration(
    color: card,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: border),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.08),
        blurRadius: 16,
        offset: const Offset(0, 4),
      ),
    ],
  );

  /// Solid card (legacy compat)
  static BoxDecoration get solidCard => BoxDecoration(
    color: card,
    borderRadius: BorderRadius.circular(20),
    border: Border.all(color: cardBorder),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.04),
        blurRadius: 8,
        offset: const Offset(0, 2),
      ),
    ],
  );
  
  /// Bento grid item decoration
  static BoxDecoration get bentoCard => BoxDecoration(
    color: card,
    borderRadius: BorderRadius.circular(24),
    border: Border.all(color: cardBorder),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.04),
        blurRadius: 8,
        offset: const Offset(0, 2),
      ),
    ],
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
