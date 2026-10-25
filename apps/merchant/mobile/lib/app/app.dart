import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import '../l10n/app_localizations.dart';
import '../services/language_service.dart';
import '../services/telemetry_service.dart';
import '../theme/store_theme.dart';
import '../services/theme_provider.dart';
import 'routes.dart';
import 'auth_wrapper.dart';

final merchantNavigatorKey = GlobalKey<NavigatorState>();

/// Store Builder App
/// Uses shared LetBuyy theme colors for consistency
class StoreBuilderApp extends StatelessWidget {
  const StoreBuilderApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final languageService = context.watch<LanguageService>();
    final telemetry = _maybeTelemetry(context);

    return MaterialApp(
      navigatorKey: merchantNavigatorKey,
      title: AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: StoreTheme.light(),
      darkTheme: StoreTheme.dark(),
      themeMode: themeProvider.themeMode,
      locale: Locale(languageService.languageCode),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      localeResolutionCallback: (locale, supportedLocales) {
        if (locale == null) return const Locale('en');
        return supportedLocales.firstWhere(
          (supported) => supported.languageCode == locale.languageCode,
          orElse: () => const Locale('en'),
        );
      },
      builder: (context, child) {
        final media = MediaQuery.of(context);
        final scale = media.textScaler.scale(1);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(scale.clamp(1.0, 1.35)),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
      home:
          const AuthWrapper(), // Use home instead of initialRoute for stability
      onGenerateRoute: AppRoutes.generateRoute,
      navigatorObservers: telemetry == null
          ? const <NavigatorObserver>[]
          : <NavigatorObserver>[TelemetryNavigatorObserver(telemetry)],
    );
  }

  TelemetryService? _maybeTelemetry(BuildContext context) {
    try {
      return context.read<TelemetryService>();
    } on ProviderNotFoundException {
      return null;
    }
  }
}
