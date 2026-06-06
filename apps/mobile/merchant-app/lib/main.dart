import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'config/app_config.dart';
import 'app/app.dart';
import 'services/api_client.dart';
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
import 'services/notification_settings_service.dart';
import 'services/push_service.dart';
import 'services/analytics_service.dart';
import 'services/theme_service.dart';
import 'services/theme_provider.dart';
import 'services/subscription_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  GoogleFonts.config.allowRuntimeFetching = true;

  // Shared API gateway client injected into all services.
  late final StoreAuthService authService;
  final apiClient = ApiClient(
    baseUrl: AppConfig.apiBaseUrl,
    tokenProvider: () => authService.accessToken,
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

        // Auth
        ChangeNotifierProvider<StoreAuthService>.value(value: authService),

        // Data services
        ChangeNotifierProvider<StoreService>(
          create: (_) => StoreService(api: apiClient),
        ),
        ChangeNotifierProvider<ProductService>(
          create: (_) => ProductService(api: apiClient),
        ),
        ChangeNotifierProvider<OrderService>(
          create: (_) => OrderService(api: apiClient),
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
        ChangeNotifierProvider<NotificationSettingsService>(
          create: (_) => NotificationSettingsService(api: apiClient),
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
