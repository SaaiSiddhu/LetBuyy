import 'package:flutter/material.dart';
import 'dark_theme_colors.dart';
import 'light_theme_colors.dart';

/// Unified Theme Colors Accessor
/// Provides theme-aware color access throughout the app
/// Usage: AppThemeColors.of(context).bgStart
class AppThemeColors {
  final bool isDark;
  
  AppThemeColors._(this.isDark);
  
  /// Create theme colors from BuildContext (recommended)
  factory AppThemeColors.of(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    return AppThemeColors._(brightness == Brightness.dark);
  }
  
  /// Create from explicit brightness value
  factory AppThemeColors.fromBrightness(Brightness brightness) {
    return AppThemeColors._(brightness == Brightness.dark);
  }

  // ============================================
  // BACKGROUND GRADIENTS
  // ============================================
  Color get bgStart => isDark ? DarkThemeColors.bgStart : LightThemeColors.bgStart;
  Color get bgMid => isDark ? DarkThemeColors.bgMid : LightThemeColors.bgMid;
  Color get bgEnd => isDark ? DarkThemeColors.bgEnd : LightThemeColors.bgEnd;
  
  Color get meshAccent1 => isDark ? DarkThemeColors.meshAccent1 : LightThemeColors.meshAccent1;
  Color get meshAccent2 => isDark ? DarkThemeColors.meshAccent2 : LightThemeColors.meshAccent2;
  Color get meshAccent3 => isDark ? DarkThemeColors.meshAccent3 : LightThemeColors.meshAccent3;

  // ============================================
  // SEMANTIC ELEVATION SYSTEM
  // ============================================
  Color get elevation0 => isDark ? DarkThemeColors.elevation0 : LightThemeColors.elevation0;
  Color get elevation1 => isDark ? DarkThemeColors.elevation1 : LightThemeColors.elevation1;
  Color get elevation2 => isDark ? DarkThemeColors.elevation2 : LightThemeColors.elevation2;
  Color get elevation3 => isDark ? DarkThemeColors.elevation3 : LightThemeColors.elevation3;

  // ============================================
  // GLASSMORPHISM SYSTEM
  // ============================================
  Color get glassLight => isDark ? DarkThemeColors.glassLight : LightThemeColors.glassLight;
  Color get glassLightBorder => isDark ? DarkThemeColors.glassLightBorder : LightThemeColors.glassLightBorder;
  double get glassLightBlur => isDark ? DarkThemeColors.glassLightBlur : LightThemeColors.glassLightBlur;
  
  Color get glassMedium => isDark ? DarkThemeColors.glassMedium : LightThemeColors.glassMedium;
  Color get glassMediumBorder => isDark ? DarkThemeColors.glassMediumBorder : LightThemeColors.glassMediumBorder;
  double get glassMediumBlur => isDark ? DarkThemeColors.glassMediumBlur : LightThemeColors.glassMediumBlur;
  
  Color get glassHeavy => isDark ? DarkThemeColors.glassHeavy : LightThemeColors.glassHeavy;
  Color get glassHeavyBorder => isDark ? DarkThemeColors.glassHeavyBorder : LightThemeColors.glassHeavyBorder;
  double get glassHeavyBlur => isDark ? DarkThemeColors.glassHeavyBlur : LightThemeColors.glassHeavyBlur;
  
  Color get glassAccent => isDark ? DarkThemeColors.glassAccent : LightThemeColors.glassAccent;
  Color get glassAccentBorder => isDark ? DarkThemeColors.glassAccentBorder : LightThemeColors.glassAccentBorder;

  // ============================================
  // CARDS & SURFACES
  // ============================================
  Color get card => isDark ? DarkThemeColors.card : LightThemeColors.card;
  Color get cardHover => isDark ? DarkThemeColors.cardHover : LightThemeColors.cardHover;
  Color get cardBorder => isDark ? DarkThemeColors.cardBorder : LightThemeColors.cardBorder;
  Color get surface => isDark ? DarkThemeColors.surface : LightThemeColors.surface;
  Color get surfaceVariant => isDark ? DarkThemeColors.surfaceVariant : LightThemeColors.surfaceVariant;

  // ============================================
  // TEXT COLORS
  // ============================================
  Color get textPrimary => isDark ? DarkThemeColors.textPrimary : LightThemeColors.textPrimary;
  Color get textSecondary => isDark ? DarkThemeColors.textSecondary : LightThemeColors.textSecondary;
  Color get textTertiary => isDark ? DarkThemeColors.textTertiary : LightThemeColors.textTertiary;
  Color get textHint => isDark ? DarkThemeColors.textHint : LightThemeColors.textHint;

  // ============================================
  // ACCENT COLORS (Same in both themes)
  // ============================================
  Color get accent => isDark ? DarkThemeColors.accent : LightThemeColors.accent;
  Color get accentBlue => isDark ? DarkThemeColors.accentBlue : LightThemeColors.accentBlue;
  Color get accentCyan => isDark ? DarkThemeColors.accentCyan : LightThemeColors.accentCyan;
  Color get accentPink => isDark ? DarkThemeColors.accentPink : LightThemeColors.accentPink;
  Color get accentTeal => isDark ? DarkThemeColors.accentTeal : LightThemeColors.accentTeal;
  Color get success => isDark ? DarkThemeColors.success : LightThemeColors.success;
  Color get warning => isDark ? DarkThemeColors.warning : LightThemeColors.warning;
  Color get error => isDark ? DarkThemeColors.error : LightThemeColors.error;

  // ============================================
  // DIVIDERS & BORDERS
  // ============================================
  Color get divider => isDark ? DarkThemeColors.divider : LightThemeColors.divider;
  Color get border => isDark ? DarkThemeColors.border : LightThemeColors.border;
  Color get borderSubtle => isDark ? DarkThemeColors.borderSubtle : LightThemeColors.borderSubtle;

  // ============================================
  // GRADIENT PRESETS
  // ============================================
  LinearGradient get heroGradient => isDark ? DarkThemeColors.heroGradient : LightThemeColors.heroGradient;
  LinearGradient get successGradient => isDark ? DarkThemeColors.successGradient : LightThemeColors.successGradient;
  LinearGradient get blueGradient => isDark ? DarkThemeColors.blueGradient : LightThemeColors.blueGradient;
  LinearGradient get purpleGradient => isDark ? DarkThemeColors.purpleGradient : LightThemeColors.purpleGradient;
  LinearGradient get orangeGradient => isDark ? DarkThemeColors.orangeGradient : LightThemeColors.orangeGradient;
  BoxDecoration get meshGradient => isDark ? DarkThemeColors.meshGradient : LightThemeColors.meshGradient;

  // ============================================
  // ANIMATION & MOTION CONSTANTS (Same in both themes)
  // ============================================
  Duration get durationFast => isDark ? DarkThemeColors.durationFast : LightThemeColors.durationFast;
  Duration get durationMedium => isDark ? DarkThemeColors.durationMedium : LightThemeColors.durationMedium;
  Duration get durationSlow => isDark ? DarkThemeColors.durationSlow : LightThemeColors.durationSlow;
  Duration get durationVeryLong => isDark ? DarkThemeColors.durationVeryLong : LightThemeColors.durationVeryLong;
  Duration get staggerDelay => isDark ? DarkThemeColors.staggerDelay : LightThemeColors.staggerDelay;
  Curve get defaultCurve => isDark ? DarkThemeColors.defaultCurve : LightThemeColors.defaultCurve;
  Curve get bounceCurve => isDark ? DarkThemeColors.bounceCurve : LightThemeColors.bounceCurve;
  Curve get smoothCurve => isDark ? DarkThemeColors.smoothCurve : LightThemeColors.smoothCurve;

  // ============================================
  // DECORATIONS (Presets)
  // ============================================
  BoxDecoration get backgroundGradient => isDark ? DarkThemeColors.backgroundGradient : LightThemeColors.backgroundGradient;
  BoxDecoration get glassCard => isDark ? DarkThemeColors.glassCard : LightThemeColors.glassCard;
  BoxDecoration get glassCardLight => isDark ? DarkThemeColors.glassCardLight : LightThemeColors.glassCardLight;
  BoxDecoration get glassCardHeavy => isDark ? DarkThemeColors.glassCardHeavy : LightThemeColors.glassCardHeavy;
  BoxDecoration get solidCard => isDark ? DarkThemeColors.solidCard : LightThemeColors.solidCard;
  BoxDecoration get bentoCard => isDark ? DarkThemeColors.bentoCard : LightThemeColors.bentoCard;
  
  BoxDecoration floatingAction(Color accentColor) => 
      isDark ? DarkThemeColors.floatingAction(accentColor) : LightThemeColors.floatingAction(accentColor);
  
  // ============================================
  // SPECIAL COLORS FOR SPECIFIC COMPONENTS
  // ============================================
  
  /// Bottom navigation bar background
  Color get bottomNavBackground => isDark 
      ? const Color(0xFF0F172A) 
      : const Color(0xFFFFFFFF);
  
  /// Bottom navigation bar border
  Color get bottomNavBorder => isDark 
      ? Colors.white.withValues(alpha: 0.1) 
      : Colors.black.withValues(alpha: 0.08);
  
  /// Bottom navigation selected item
  Color get bottomNavSelected => isDark 
      ? const Color(0xFF8B5CF6)
      : const Color(0xFF8B5CF6);
  
  /// Bottom navigation unselected item
  Color get bottomNavUnselected => isDark 
      ? Colors.white.withValues(alpha: 0.5) 
      : const Color(0xFF64748B);
  
  /// Selected nav item background
  Color get bottomNavSelectedBg => isDark 
      ? const Color(0xFF8B5CF6).withValues(alpha: 0.12)
      : const Color(0xFF8B5CF6).withValues(alpha: 0.12);
  
  /// Snackbar background
  Color get snackbarBackground => isDark 
      ? elevation2 
      : const Color(0xFF1E293B);
  
  /// Sheet handle color
  Color get sheetHandle => isDark 
      ? Colors.white.withValues(alpha: 0.2) 
      : Colors.black.withValues(alpha: 0.15);
}
