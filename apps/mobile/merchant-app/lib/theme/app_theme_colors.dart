import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Theme-aware mobile color accessor backed by the generated LetBuyy token bridge.
class AppThemeColors {
  AppThemeColors._(this.isDark);

  final bool isDark;

  factory AppThemeColors.of(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    return AppThemeColors._(brightness == Brightness.dark);
  }

  factory AppThemeColors.fromBrightness(Brightness brightness) {
    return AppThemeColors._(brightness == Brightness.dark);
  }

  Color get bgStart =>
      isDark ? LetbuyyColorTokens.slate950 : LetbuyyColorTokens.slate50;
  Color get bgMid =>
      isDark ? LetbuyyColorTokens.slate900 : LetbuyyColorTokens.slate100;
  Color get bgEnd =>
      isDark ? LetbuyyColorTokens.slate800 : LetbuyyColorTokens.slate200;

  Color get meshAccent1 => LetbuyyColorTokens.brandPrimary;
  Color get meshAccent2 => LetbuyyColorTokens.brandPrimaryDark;
  Color get meshAccent3 => LetbuyyColorTokens.brandPrimaryDarker;

  Color get elevation0 => bgStart;
  Color get elevation1 =>
      isDark ? LetbuyyColorTokens.slate900 : LetbuyyColorTokens.white;
  Color get elevation2 =>
      isDark ? LetbuyyColorTokens.slate800 : LetbuyyColorTokens.slate50;
  Color get elevation3 =>
      isDark ? LetbuyyColorTokens.slate700 : LetbuyyColorTokens.slate100;

  Color get glassLight =>
      isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.02);
  Color get glassLightBorder =>
      isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.06);
  double get glassLightBlur => 8;

  Color get glassMedium =>
      isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.03);
  Color get glassMediumBorder =>
      isDark ? Colors.white.withValues(alpha: 0.12) : Colors.black.withValues(alpha: 0.08);
  double get glassMediumBlur => 16;

  Color get glassHeavy =>
      isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.05);
  Color get glassHeavyBorder =>
      isDark ? Colors.white.withValues(alpha: 0.18) : Colors.black.withValues(alpha: 0.12);
  double get glassHeavyBlur => 24;

  Color get glassAccent => LetbuyyColorTokens.brandPrimary.withValues(
        alpha: isDark ? 0.08 : 0.06,
      );
  Color get glassAccentBorder => LetbuyyColorTokens.brandPrimary.withValues(
        alpha: isDark ? 0.25 : 0.20,
      );

  Color get card =>
      isDark ? LetbuyyColorTokens.slate800 : LetbuyyColorTokens.white;
  Color get cardHover =>
      isDark ? LetbuyyColorTokens.slate700 : LetbuyyColorTokens.slate50;
  Color get cardBorder =>
      isDark ? LetbuyyColorTokens.slate700 : LetbuyyColorTokens.slate200;
  Color get surface => card;
  Color get surfaceVariant => cardHover;

  Color get textPrimary =>
      isDark ? LetbuyyColorTokens.white : LetbuyyColorTokens.slate900;
  Color get textSecondary =>
      isDark ? LetbuyyColorTokens.slate400 : LetbuyyColorTokens.slate600;
  Color get textTertiary =>
      isDark ? LetbuyyColorTokens.slate500 : LetbuyyColorTokens.slate500;
  Color get textHint =>
      isDark ? LetbuyyColorTokens.slate600 : LetbuyyColorTokens.slate400;

  Color get accent => LetbuyyColorTokens.brandPrimary;
  Color get accentBlue => LetbuyyColorTokens.info;
  Color get accentCyan => LetbuyyColorTokens.cyan;
  Color get accentPink => LetbuyyColorTokens.accentPink;
  Color get accentTeal => LetbuyyColorTokens.teal;
  Color get success => LetbuyyColorTokens.success;
  Color get warning => LetbuyyColorTokens.warning;
  Color get error => LetbuyyColorTokens.error;

  Color get divider =>
      isDark ? LetbuyyColorTokens.slate800 : LetbuyyColorTokens.slate200;
  Color get border =>
      isDark ? LetbuyyColorTokens.slate700 : LetbuyyColorTokens.slate300;
  Color get borderSubtle =>
      isDark ? LetbuyyColorTokens.slate800 : LetbuyyColorTokens.slate200;

  LinearGradient get heroGradient => const LinearGradient(
        colors: [
          LetbuyyColorTokens.brandPrimary,
          LetbuyyColorTokens.brandPrimaryDark,
          LetbuyyColorTokens.brandPrimaryDarker,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  LinearGradient get successGradient => const LinearGradient(
        colors: [LetbuyyColorTokens.success, LetbuyyColorTokens.successStrong],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  LinearGradient get blueGradient => const LinearGradient(
        colors: [LetbuyyColorTokens.info, LetbuyyPrimitiveTokens.blue700],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  LinearGradient get purpleGradient => const LinearGradient(
        colors: [
          LetbuyyColorTokens.brandPrimary,
          LetbuyyColorTokens.brandPrimaryDarker,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  LinearGradient get orangeGradient => const LinearGradient(
        colors: [LetbuyyColorTokens.warning, LetbuyyPrimitiveTokens.amber800],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  BoxDecoration get meshGradient => BoxDecoration(
        gradient: RadialGradient(
          center: const Alignment(-0.8, -0.6),
          radius: 1.8,
          colors: [
            meshAccent1.withValues(alpha: isDark ? 0.15 : 0.08),
            meshAccent2.withValues(alpha: isDark ? 0.08 : 0.04),
            bgStart,
          ],
          stops: const [0.0, 0.4, 1.0],
        ),
      );

  Duration get durationFast => const Duration(milliseconds: 150);
  Duration get durationMedium => const Duration(milliseconds: 300);
  Duration get durationSlow => const Duration(milliseconds: 450);
  Duration get durationVeryLong => const Duration(milliseconds: 800);
  Duration get staggerDelay => const Duration(milliseconds: 50);
  Curve get defaultCurve => Curves.easeOutCubic;
  Curve get bounceCurve => Curves.elasticOut;
  Curve get smoothCurve => Curves.easeInOutCubic;

  BoxDecoration get backgroundGradient => BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [bgStart, bgMid, bgEnd],
          stops: const [0.0, 0.5, 1.0],
        ),
      );

  BoxDecoration get glassCard => BoxDecoration(
        color: isDark ? glassMedium : card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? glassMediumBorder : cardBorder),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      );

  BoxDecoration get glassCardLight => BoxDecoration(
        color: isDark ? glassLight : surfaceVariant,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? glassLightBorder : borderSubtle),
      );

  BoxDecoration get glassCardHeavy => BoxDecoration(
        color: isDark ? glassHeavy : card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isDark ? glassHeavyBorder : cardBorder),
      );

  BoxDecoration get solidCard => BoxDecoration(
        color: card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: cardBorder),
      );

  BoxDecoration get bentoCard => BoxDecoration(
        color: card,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: cardBorder),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
      );

  BoxDecoration floatingAction(Color accentColor) => BoxDecoration(
        color: accentColor,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: isDark ? 0.3 : 0.24),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      );

  Color get bottomNavBackground =>
      isDark ? LetbuyyColorTokens.slate900 : LetbuyyColorTokens.white;
  Color get bottomNavBorder =>
      isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.08);
  Color get bottomNavSelected => LetbuyyColorTokens.brandPrimary;
  Color get bottomNavUnselected =>
      isDark ? Colors.white.withValues(alpha: 0.5) : LetbuyyColorTokens.slate500;
  Color get bottomNavSelectedBg =>
      LetbuyyColorTokens.brandPrimary.withValues(alpha: 0.12);

  Color get snackbarBackground =>
      isDark ? elevation2 : LetbuyyColorTokens.slate800;

  Color get sheetHandle =>
      isDark ? Colors.white.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.15);
}
