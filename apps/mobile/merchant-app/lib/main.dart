import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'firebase_options.dart';
import 'config/supabase_config.dart';
import 'app/app.dart';
import 'services/api_client.dart';
import 'services/store_service.dart';
import 'services/store_auth_service.dart';
import 'services/language_service.dart';
import 'services/storage_service.dart';
import 'services/product_service.dart';
import 'services/order_service.dart';
import 'services/analytics_service.dart';
import 'services/theme_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Supabase (primary auth & data) ───────────────────────
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );
  if (kDebugMode) print('✅ Supabase initialized');

  // ── Firebase (FCM push notifications only) ───────────────
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      if (kDebugMode) print('✅ Firebase initialized (FCM only)');
    } else if (kDebugMode) {
      print('✅ Firebase already initialized (FCM only)');
    }
  } on FirebaseException catch (e) {
    if (e.code == 'duplicate-app') {
      if (kDebugMode) print('✅ Firebase already initialized (FCM only)');
    } else if (kDebugMode) {
      print('⚠️ Firebase init error: $e');
    }
  } catch (e) {
    if (kDebugMode) print('⚠️ Firebase init error: $e');
  }

  GoogleFonts.config.allowRuntimeFetching = true;

  // Shared API gateway client injected into all services.
  final apiClient = ApiClient(
    baseUrl: AppConfig.apiBaseUrl,
    tokenProvider: () =>
        Supabase.instance.client.auth.currentSession?.accessToken,
    headers: const {'X-Client': 'flutter-builder'},
    requestIdFactory: () =>
        'flutter-builder-${DateTime.now().microsecondsSinceEpoch}',
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

        // Auth
        ChangeNotifierProvider<StoreAuthService>(
          create: (_) => StoreAuthService(api: apiClient),
        ),

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
        ChangeNotifierProvider<AnalyticsService>(
          create: (_) => AnalyticsService(api: apiClient),
        ),

        // Storage
        Provider<StorageService>(create: (_) => StorageService(api: apiClient)),
      ],
      child: const StoreBuilderApp(),
    ),
  );
}
