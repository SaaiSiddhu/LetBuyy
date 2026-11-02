import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import '../l10n/app_localizations.dart';
import '../services/language_service.dart';
import '../services/telemetry_service.dart';
import '../theme/store_theme.dart';
import '../services/theme_provider.dart';
import '../services/merchant_browser_auth.dart';
import '../services/store_auth_service.dart';
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
        final accounts = context.watch<MerchantBrowserAuth?>();
        final accountTransition =
            context.watch<StoreAuthService?>()?.accountTransition ?? false;
        final media = MediaQuery.of(context);
        final scale = media.textScaler.scale(1);
        return MediaQuery(
          data: media.copyWith(
            textScaler: TextScaler.linear(scale.clamp(1.0, 1.35)),
          ),
          child: Stack(
            children: [
              IgnorePointer(
                ignoring: accountTransition,
                child: child ?? const SizedBox.shrink(),
              ),
              if (accountTransition && accounts != null)
                Positioned.fill(
                  child: Scaffold(
                    body: SafeArea(
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (accounts.busy)
                                const CircularProgressIndicator(),
                              const SizedBox(height: 20),
                              Semantics(
                                liveRegion: true,
                                child: Text(
                                  accounts.message ??
                                      'Finishing your account action…',
                                  textAlign: TextAlign.center,
                                ),
                              ),
                              if (accounts.status ==
                                  BrowserAuthStatus.unavailable)
                                FilledButton(
                                  onPressed: accounts.retryVerification,
                                  child: const Text('Retry verification'),
                                ),
                              TextButton(
                                onPressed: accounts.cancel,
                                child: const Text('Cancel and return'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
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
