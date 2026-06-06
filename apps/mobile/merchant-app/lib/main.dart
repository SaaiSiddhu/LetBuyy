import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'config/app_config.dart';
import 'app/app.dart';
import 'app/store_context.dart';
import 'services/api_client.dart';
import 'services/cache_service.dart';
import 'services/store_service.dart';
import 'services/store_auth_service.dart';
import 'services/language_service.dart';
import 'services/storage_service.dart';
import 'services/product_service.dart';
import 'services/order_service.dart';
import 'services/customer_service.dart';
import 'services/inventory_service.dart';
import 'services/coupon_service.dart';
import 'services/cms_service.dart';
import 'services/custom_domains.dart';
import 'services/media_service.dart';
import 'services/notification_settings_service.dart';
import 'services/platform_blocked_service.dart';
import 'services/shipping_tax_service.dart';
import 'services/staff_service.dart';
import 'services/review_service.dart';
import 'services/form_submission_service.dart';
import 'services/app_marketplace_service.dart';
import 'services/ai_studio_service.dart';
import 'services/push_service.dart';
import 'services/analytics_service.dart';
import 'services/theme_service.dart';
import 'services/theme_provider.dart';
import 'services/subscription_service.dart';

void main() async {
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
  final storeService = StoreService(api: apiClient, cache: cacheService);
  storeContext = StoreContext(storeService: storeService);
  await authService.restoreSession();

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

        // Auth
        ChangeNotifierProvider<StoreAuthService>.value(value: authService),
        ChangeNotifierProvider<StoreContext>.value(value: storeContext),

        // Data services
        ChangeNotifierProvider<StoreService>.value(value: storeService),
        ChangeNotifierProvider<ProductService>(
          create: (_) => ProductService(api: apiClient, cache: cacheService),
        ),
        ChangeNotifierProvider<OrderService>(
          create: (_) => OrderService(api: apiClient, cache: cacheService),
        ),
        ChangeNotifierProvider<CustomerService>(
          create: (_) => CustomerService(api: apiClient),
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
        ChangeNotifierProvider<NotificationSettingsService>(
          create: (_) => NotificationSettingsService(api: apiClient),
        ),
        ChangeNotifierProvider<PlatformBlockedService>(
          create: (_) => PlatformBlockedService(),
        ),
        ChangeNotifierProvider<PushService>(
          create: (_) => PushService(api: apiClient),
        ),
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
        Provider<StorageService>(create: (_) => StorageService(api: apiClient)),
      ],
      child: const StoreBuilderApp(),
    ),
  );
}
