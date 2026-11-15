import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

Future<void>? _initialization;

/// Load the existing Inter typography from this package before first paint.
/// Font errors stay observable; an absent asset never starts a network fetch.
Future<void> initializeLetbuyyTypography() =>
    _initialization ??= _loadBundledTypography();

Future<void> _loadBundledTypography() async {
  GoogleFonts.config.allowRuntimeFetching = false;
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString(
      'packages/letbuyy_ui_kit/assets/fonts/Inter-OFL.txt',
    );
    yield LicenseEntryWithLineBreaks(const ['Inter'], license);
  });
  for (final weight in FontWeight.values) {
    GoogleFonts.inter(fontWeight: weight);
  }
  await GoogleFonts.pendingFonts();
}
