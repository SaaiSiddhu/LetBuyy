import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

// Internal packages
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

// Canonical gateway wiring (FB-2)
import 'data/canonical_api.dart';
import 'data/marketplace_repository.dart';

// Sign in with LetBuyy (APPID-P4d), behind LETBUYY_BUYER_SIGN_IN
import 'auth/buyer_sign_in_controller.dart';
import 'auth/buyer_sign_in_wiring.dart';
import 'config/app_config.dart';

// App-specific providers
import 'providers/auth_provider.dart';
import 'providers/user_provider.dart';
import 'providers/search_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/marketplace_ad_provider.dart';

// Routes
import 'app/routes.dart';

// Screens
import 'screens/main_screen.dart';
import 'screens/web_main_screen.dart';

/// Firebase options
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // ✅ Use path-based URLs (no hash #)
  usePathUrlStrategy();
  
  // Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // NOTE: App Check is NOT enabled since Cloud Functions don't enforce it
  // Enable later when needed for production
  
  // Initialize SharedPreferencesService 
  try {
    await SharedPreferencesService.init();
  } catch (e) {
    debugPrint('⚠️ SharedPreferencesService init error: $e');
  }
  
  // 🚀 PERFORMANCE: Defer FCM initialization to AFTER UI is visible
  // This prevents blocking app startup with network calls
  // FCM will initialize 2 seconds after runApp()
  
  // Set preferred orientations (mobile only)
  if (!kIsWeb) {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }
  
  runApp(const LetBuyyMarketplaceApp());

  
  // 🔔 Initialize FCM AFTER app starts (non-blocking)
  if (!kIsWeb) {
    Future.delayed(const Duration(seconds: 2), () async {
      try {
        await FCMService().initialize();
        debugPrint('✅ FCM initialized successfully (deferred)');
      } catch (e) {
        debugPrint('⚠️ FCM init error: $e');
      }
    });
  }
}

class LetBuyyMarketplaceApp extends StatelessWidget {
  const LetBuyyMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Auth provider
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        
        // User provider
        ChangeNotifierProvider(create: (_) => UserProvider()),
        
        // Search provider
        ChangeNotifierProvider(create: (_) => SearchProvider()),
        
        // Notification provider
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        
        // Shared providers from services package
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => CategoryProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => WishlistProvider()),
        ChangeNotifierProvider(create: (_) => AddressProvider()),
        
        // ✅ ADDED: Missing providers
        ChangeNotifierProvider(create: (_) => BannerProvider()),
        ChangeNotifierProvider(create: (_) => SponsoredBannerProvider()),
        ChangeNotifierProvider(create: (_) => CouponProvider()),
        ChangeNotifierProvider(create: (_) => ReviewProvider()),
        ChangeNotifierProvider(create: (_) => AppUpdateProvider()),
        
        // ✅ ADDED: Sponsored Products Ads provider
        ChangeNotifierProvider(create: (_) => MarketplaceAdProvider()),
        
        // ✅ ADDED: Loyalty Points provider
        ChangeNotifierProvider(create: (_) => LoyaltyProvider()),
        
        // ✅ ADDED: Services for reviews
        Provider<AuthService>(create: (_) => AuthService()),
        Provider<DatabaseService>(create: (_) => DatabaseService()),

        // FB-2: the canonical marketplace read path. Screens depend on the interface, never on
        // ApiMarketplaceRepository or on an ApiClient directly, so the backend behind a screen is
        // one decision here rather than a per-file import.
        Provider<MarketplaceRepository>(create: (_) => buildMarketplaceRepository()),

        // APPID-P4d: "Sign in with LetBuyy", built only with --dart-define=LETBUYY_BUYER_SIGN_IN=true.
        // Not lazy, so a sign-in callback that arrived while the app was stopped is collected at launch.
        if (AppConfig.buyerSignInEnabled)
          ChangeNotifierProvider<BuyerSignInController>(
            create: (_) => buildBuyerSignInController()..start(),
            lazy: false,
          ),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'LetBuyy',
            debugShowCheckedModeBanner: false,
            
            // Theme
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            
            // ✅ Native splash screen is enough - go directly to main
            // The native splash shows during Flutter engine initialization
            home: kIsWeb 
                ? const WebMainScreen(initialIndex: 0) 
                : const MainScreen(initialIndex: 0),
            onGenerateRoute: AppRoutes.onGenerateRoute,
          );
        },
      ),
    );
  }
}
