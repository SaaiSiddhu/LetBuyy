import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Matches GoogleFonts.poppins/.inter's own signature exactly, so either can be assigned here as a
/// tear-off with no wrapping.
typedef GoogleFontStyleBuilder = TextStyle Function({
  TextStyle? textStyle,
  Color? color,
  Color? backgroundColor,
  double? fontSize,
  FontWeight? fontWeight,
  FontStyle? fontStyle,
  double? letterSpacing,
  double? wordSpacing,
  TextBaseline? textBaseline,
  double? height,
  Locale? locale,
  Paint? foreground,
  Paint? background,
  List<Shadow>? shadows,
  List<FontFeature>? fontFeatures,
  TextDecoration? decoration,
  Color? decorationColor,
  TextDecorationStyle? decorationStyle,
  double? decorationThickness,
});

/// The two Google Font families [AppTextStyles] builds every style from, resolved through this
/// swappable seam instead of calling `GoogleFonts.poppins`/`GoogleFonts.inter` directly.
///
/// Why this exists: `google_fonts`' own font-load bookkeeping (`google_fonts_base.dart`) attaches
/// only a success-only `.then()` to its internal load future, so a failed load (no bundled asset, no
/// network in a hermetic test) always leaves a second, package-internal Future carrying the
/// rejection that no external code -- not a `pendingFonts()` poll, not a `FlutterError.onError`
/// override -- can reach or suppress. That is a real, upstream defect, not a timing quirk in any one
/// test (`docs/evidence/appid-2026-09-24/SUSTAINED_L.md`). Rather than fight it after the fact, the
/// test process never calls `GoogleFonts.*` at all: `flutter_test_config.dart` overrides both fields
/// below to a plain, deterministic style builder before any test runs. Production never overrides
/// them, so the shipped app's typography is completely unchanged -- same real Google Fonts, same
/// real asset/network loading path, same visual result as before this file existed.
class AppFonts {
  const AppFonts._();

  /// Read by every style in [AppTextStyles]. Only ever reassigned by
  /// `apps/marketplace/mobile/test/flutter_test_config.dart` -- production code must never set this.
  static GoogleFontStyleBuilder poppins = GoogleFonts.poppins;

  /// Read by every style in [AppTextStyles]. Only ever reassigned by
  /// `apps/marketplace/mobile/test/flutter_test_config.dart` -- production code must never set this.
  static GoogleFontStyleBuilder inter = GoogleFonts.inter;
}
