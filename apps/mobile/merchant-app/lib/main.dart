import 'dart:async';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:letbuyy_models/merchant_contracts.dart';
import 'package:provider/provider.dart';
import 'config/app_config.dart';
import 'app/app.dart';
import 'app/store_context.dart';
import 'services/api_client.dart';
import 'services/cache_service.dart';
import 'services/crash_reporting_service.dart';
import 'services/store_service.dart';
import 'services/store_auth_service.dart';
import 'services/language_service.dart';
import 'services/storage_service.dart';
import 'services/product_service.dart';
import 'services/order_service.dart';
import 'services/return_service.dart';
import 'services/customer_service.dart';
import 'services/whatsapp_service.dart';
import 'services/marketing_service.dart';
import 'services/money_service.dart';
import 'services/kyc_service.dart';
import 'services/two_factor_service.dart';
import 'services/inventory_service.dart';
import 'services/coupon_service.dart';
import 'services/cms_service.dart';
import 'services/custom_domains.dart';
import 'services/media_service.dart';
import 'services/metafield_service.dart';
import 'services/notification_settings_service.dart';
import 'services/platform_blocked_service.dart';
import 'services/shipping_tax_service.dart';
import 'services/staff_service.dart';
import 'services/review_service.dart';
import 'services/form_submission_service.dart';
import 'services/app_marketplace_service.dart';
import 'services/app_badge_service.dart';
import 'services/ai_studio_service.dart';
import 'services/home_widget_service.dart';
import 'services/push_service.dart';
import 'services/analytics_service.dart';
import 'services/theme_service.dart';
import 'services/theme_provider.dart';
import 'services/subscription_service.dart';
import 'services/telemetry_service.dart';

void main() {
  CrashReportingService? crashReportingService;
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      GoogleFonts.config.allowRuntimeFetching = true;
      final cacheService = await CacheService.open();

      // Shared API gateway client injected into all services.
      late final StoreAuthService authService;
      late final StoreContext storeContext;
      final apiClient = ApiClient(
        baseUrl: AppConfig.apiBaseUrl,
        tokenProvider: () => authService.accessToken,
        storeIdProvider: () => storeContext.selectedStoreId,
        unauthorizedHandler: (exception) =>
            authService.handleUnauthorized(exception),
        attachSessionCookie: true,
        headers: const {'X-Client': 'flutter-builder'},
        requestIdFactory: () =>
            'flutter-builder-${DateTime.now().microsecondsSinceEpoch}',
      );
      authService = StoreAuthService(
        api: apiClient,
        identityBaseUrl: AppConfig.identityBaseUrl,
        turnstileTokenProvider: () => AppConfig.turnstileToken,
      );
      final pushService = PushService(
        api: apiClient,
        tokenProvider: () => AppConfig.mobilePushDeviceToken,
      );
      const appBadgeService = AppBadgeService();
      final storeService = StoreService(api: apiClient, cache: cacheService);
      storeContext = StoreContext(storeService: storeService);
      final telemetryService = TelemetryService(
        sink: await SharedPreferencesTelemetrySink.open(),
        storeIdProvider: () => storeContext.selectedStoreId,
        userIdProvider: () => authService.currentUser?.id,
      );
      crashReportingService = CrashReportingService(
        sink: await buildMerchantCrashReportingSink(
          sentryDsn: AppConfig.sentryDsn,
          sentryEnabled: AppConfig.hasSentryDsn,
        ),
        environment: AppConfig.environment,
        release: AppConfig.appRelease,
        storeIdProvider: () => storeContext.selectedStoreId,
        userIdProvider: () => authService.currentUser?.id,
      );
      _installCrashHooks(crashReportingService!);
      String? lastTrackedStoreId;
      storeContext.addListener(() {
        final selected = storeContext.selectedStore;
        if (selected == null || selected.id == lastTrackedStoreId) return;
        lastTrackedStoreId = selected.id;
        unawaited(
          telemetryService.track(
            MerchantTelemetryEventNames.storeSelected,
            storeId: selected.id,
            metadata: {'store_name': selected.name},
          ),
        );
      });
      authService.authStateChanges.listen((state) {
        if (state.event == AuthChangeEvent.signedIn ||
            state.event == AuthChangeEvent.initialSession ||
            state.event == AuthChangeEvent.tokenRefreshed) {
          unawaited(
            pushService.registerCurrentDeviceToken(
              deviceName: 'LetBuyy Merchant App',
            ),
          );
        }

        final eventName = switch (state.event) {
          AuthChangeEvent.signedIn => MerchantTelemetryEventNames.authSignedIn,
          AuthChangeEvent.initialSession =>
            MerchantTelemetryEventNames.authSessionRestored,
          AuthChangeEvent.signedOut =>
            MerchantTelemetryEventNames.authSignedOut,
          AuthChangeEvent.sessionExpired =>
            MerchantTelemetryEventNames.authSignedOut,
          AuthChangeEvent.tokenRefreshed =>
            MerchantTelemetryEventNames.authSessionRestored,
        };
        unawaited(
          telemetryService.track(
            eventName,
            userId: state.session?.user.id,
            metadata: {'auth_event': state.event.name},
          ),
        );
      });
      await authService.restoreSession();
      unawaited(
        telemetryService.track(
          MerchantTelemetryEventNames.appOpened,
          metadata: {
            'api_host': Uri.tryParse(AppConfig.apiBaseUrl)?.host ?? 'unknown',
          },
        ),
      );

      runApp(
        MultiProvider(
          providers: [
            // Theme & language
            ChangeNotifierProvider(create: (_) => ThemeProvider()..loadTheme()),
            ChangeNotifierProvider(
              create: (_) => LanguageService()..loadLanguage(),
            ),

            // API gateway client (shared singleton)
            Provider<ApiClient>.value(value: apiClient),
            Provider<CacheService>.value(value: cacheService),
            Provider<TelemetryService>.value(value: telemetryService),
            Provider<CrashReportingService>.value(
              value: crashReportingService!,
            ),

            // Auth
            ChangeNotifierProvider<StoreAuthService>.value(value: authService),
            ChangeNotifierProvider<StoreContext>.value(value: storeContext),

            // Data services
            ChangeNotifierProvider<StoreService>.value(value: storeService),
            ChangeNotifierProvider<ProductService>(
              create: (_) =>
                  ProductService(api: apiClient, cache: cacheService),
            ),
            ChangeNotifierProvider<OrderService>(
              create: (_) => OrderService(
                api: apiClient,
                cache: cacheService,
                appBadgeService: appBadgeService,
              ),
            ),
            ChangeNotifierProvider<ReturnService>(
              create: (_) => ReturnService(api: apiClient),
            ),
            ChangeNotifierProvider<CustomerService>(
              create: (_) =>
                  CustomerService(api: apiClient, cache: cacheService),
            ),
            ChangeNotifierProvider<WhatsAppService>(
              create: (_) => WhatsAppService(api: apiClient),
            ),
            ChangeNotifierProvider<MarketingService>(
              create: (_) => MarketingService(api: apiClient),
            ),
            ChangeNotifierProvider<MoneyService>(
              create: (_) => MoneyService(api: apiClient),
            ),
            ChangeNotifierProvider<KycService>(
              create: (_) => KycService(api: apiClient),
            ),
            ChangeNotifierProvider<TwoFactorService>(
              create: (_) => TwoFactorService(api: apiClient),
            ),
            ChangeNotifierProvider<InventoryService>(
              create: (_) => InventoryService(api: apiClient),
            ),
            ChangeNotifierProvider<CouponService>(
              create: (_) => CouponService(api: apiClient),
            ),
            ChangeNotifierProvider<CmsService>(
              create: (_) => CmsService(api: apiClient),
            ),
            ChangeNotifierProvider<DomainService>(
              create: (_) => DomainService(api: apiClient),
            ),
            ChangeNotifierProvider<MediaService>(
              create: (_) => MediaService(api: apiClient),
            ),
            ChangeNotifierProvider<MetafieldService>(
              create: (_) => MetafieldService(api: apiClient),
            ),
            ChangeNotifierProvider<ShippingTaxService>(
              create: (_) => ShippingTaxService(api: apiClient),
            ),
            ChangeNotifierProvider<StaffService>(
              create: (_) => StaffService(api: apiClient),
            ),
            ChangeNotifierProvider<ReviewService>(
              create: (_) => ReviewService(api: apiClient),
            ),
            ChangeNotifierProvider<FormSubmissionService>(
              create: (_) => FormSubmissionService(api: apiClient),
            ),
            ChangeNotifierProvider<AppMarketplaceService>(
              create: (_) => AppMarketplaceService(api: apiClient),
            ),
            ChangeNotifierProvider<AiStudioService>(
              create: (_) => AiStudioService(api: apiClient),
            ),
            Provider<AppBadgeService>.value(value: appBadgeService),
            Provider<HomeWidgetService>(
              create: (_) => const HomeWidgetService(),
            ),
            ChangeNotifierProvider<NotificationSettingsService>(
              create: (_) => NotificationSettingsService(api: apiClient),
            ),
            ChangeNotifierProvider<PlatformBlockedService>(
              create: (_) => PlatformBlockedService(),
            ),
            ChangeNotifierProvider<PushService>.value(value: pushService),
            ChangeNotifierProvider<AnalyticsService>(
              create: (_) => AnalyticsService(api: apiClient),
            ),
            ChangeNotifierProvider<ThemeService>(
              create: (_) => ThemeService(api: apiClient),
            ),
            Provider<SubscriptionService>(
              create: (_) => SubscriptionService(api: apiClient),
            ),

            // Storage
            Provider<StorageService>(
              create: (_) => StorageService(api: apiClient),
            ),
          ],
          child: const StoreBuilderApp(),
        ),
      );
    },
    (error, stackTrace) {
      final service = crashReportingService;
      if (service == null) return;
      unawaited(
        service.recordError(
          error,
          stackTrace,
          fatal: true,
          source: 'dart_zone',
        ),
      );
    },
  );
}

void _installCrashHooks(CrashReportingService service) {
  final previousFlutterError = FlutterError.onError;
  FlutterError.onError = (details) {
    previousFlutterError?.call(details);
    unawaited(service.recordFlutterError(details));
  };

  final previousPlatformError = PlatformDispatcher.instance.onError;
  PlatformDispatcher.instance.onError = (error, stackTrace) {
    unawaited(
      service.recordError(
        error,
        stackTrace,
        fatal: true,
        source: 'platform_dispatcher',
      ),
    );
    return previousPlatformError?.call(error, stackTrace) ?? false;
  };
}
