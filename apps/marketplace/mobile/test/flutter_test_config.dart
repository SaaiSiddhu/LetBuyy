import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  // Belt-and-braces: nothing in this app should call GoogleFonts.* directly (AppTextStyles is the
  // only caller, and it now goes through AppFonts below), but this keeps a real network fetch from
  // ever starting if that ever changes.
  GoogleFonts.config.allowRuntimeFetching = false;
  // The actual fix: AppTextStyles' 46 fields are built from AppFonts.poppins/.inter, not
  // GoogleFonts.poppins/.inter directly (packages/dart/marketplace_ui_kit/lib/src/themes/
  // app_fonts.dart). Overriding both here means this test process never calls into google_fonts at
  // all -- no asset lookup, no network attempt, no failure, no Future for anything to leak.
  // google_fonts' own internal bookkeeping (a fire-and-forget `.then()` with no `onError` on its
  // load future) leaves a second, unreachable Future carrying any load failure that neither a
  // `pendingFonts()` poll nor a `FlutterError.onError` override can suppress from outside the
  // package (docs/evidence/appid-2026-09-24/SUSTAINED_L.md) -- removing the call is the only fix
  // that is actually deterministic, not a best-effort mitigation racing that failure.
  AppFonts.poppins = _deterministicStyle;
  AppFonts.inter = _deterministicStyle;
  await testMain();
}

/// Applies every parameter GoogleFonts.poppins/.inter would, except fontFamily/fontFamilyFallback --
/// this is the whole point: the platform's default test font renders instead, deterministically,
/// with no asset lookup and no network attempt.
TextStyle _deterministicStyle({
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
}) {
  final base = textStyle ?? const TextStyle();
  return base.copyWith(
    color: color,
    backgroundColor: backgroundColor,
    fontSize: fontSize,
    fontWeight: fontWeight,
    fontStyle: fontStyle,
    letterSpacing: letterSpacing,
    wordSpacing: wordSpacing,
    textBaseline: textBaseline,
    height: height,
    locale: locale,
    foreground: foreground,
    background: background,
    shadows: shadows,
    fontFeatures: fontFeatures,
    decoration: decoration,
    decorationColor: decorationColor,
    decorationStyle: decorationStyle,
    decorationThickness: decorationThickness,
  );
}
