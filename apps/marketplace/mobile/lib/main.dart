import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

// Internal packages
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

// Canonical gateway wiring (FB-2)
import 'data/canonical_api.dart';
import 'data/marketplace_repository.dart';

// Sign in with LetBuyy (APPID-P4d) — the app's sole sign-in as of Phase 1R
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'auth/buyer_sign_in_controller.dart';
import 'auth/buyer_sign_in_wiring.dart';

// App-specific providers
import 'providers/auth_provider.dart';
import 'providers/user_provider.dart';
import 'providers/search_provider.dart';
import 'providers/marketplace_ad_provider.dart';

// Routes
import 'app/routes.dart';

// Screens
import 'screens/main_screen.dart';
import 'screens/web_main_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Use path-based URLs (no hash #)
  usePathUrlStrategy();

  // Phase 1R (2026-09-26): Firebase is removed entirely — no real marketplace users existed to
  // preserve, and canonical "Sign in with LetBuyy" is now this app's sole entry point (R1.2/R1.3).
  // No Firebase.initializeApp(), no FCM boot, no Firebase analytics.

  // Initialize SharedPreferencesService
  try {
    await SharedPreferencesService.init();
  } catch (e) {
    debugPrint('⚠️ SharedPreferencesService init error: $e');
  }

  // Set preferred orientations (mobile only)
  if (!kIsWeb) {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }

  runApp(const LetBuyyMarketplaceApp());
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

        // NotificationProvider retired (R1 corrective, C2): entirely FirebaseFirestore/FirebaseAuth-
        // backed (userId sourced from FirebaseAuth.instance.currentUser, which canonical "Sign in with
        // LetBuyy" never populates) with no canonical successor. Its one consumer, notification_screen.dart
        // at the '/notifications' route, had zero live navigation anywhere in the app (grepped — no
        // pushNamed, no bell icon); both deleted rather than left wired to a dead identity source.

        // Shared providers from services package
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => CategoryProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => WishlistProvider()),
        ChangeNotifierProvider(create: (_) => AddressProvider()),
        
        // ✅ ADDED: Missing providers
        // BannerProvider retired (Phase 1R, R1.3): it was entirely FirebaseFirestore/FirebaseStorage,
        // with no canonical successor. banner_carousel_section.dart now renders a static placeholder.
        // SponsoredBannerProvider retired (R1 corrective, C2): its one consumer, sponsored_banner.dart,
        // now renders SizedBox.shrink() unconditionally (matching its own prior empty state) instead of
        // opening a FirebaseFirestore realtime listener with no canonical successor.
        ChangeNotifierProvider(create: (_) => CouponProvider()),
        ChangeNotifierProvider(create: (_) => ReviewProvider()),
        // AppUpdateProvider retired (R1 corrective, C2): its two consumers, the '/downloads' route's
        // DownloadScreen and MandatoryUpdateDialog, had zero live navigation/construction anywhere in
        // the active app (grepped) — "Legacy compatibility" per the route's own comment — so both were
        // deleted along with the dead route, rather than left wired to a Firebase-backed provider.

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

        // APPID-P4d: "Sign in with LetBuyy" — Phase 1R made this the app's sole sign-in (no Firebase
        // fallback), so it is always provided; AppConfig.buyerSignInEnabled stays a documented
        // --dart-define override, never a condition on the controller's own presence, since
        // profile_screen.dart and others now read it unconditionally.
        // Not lazy, so a sign-in callback that arrived while the app was stopped is collected at launch.
        ChangeNotifierProvider<BuyerSignInController>(
          create: (_) => buildBuyerSignInController()..start(),
          lazy: false,
        ),

        // SUSTAINED-L: the buyer's canonical cross-store profile and address book, reachable once
        // signed in with LetBuyy. Lazy (unlike the controller above): nothing needs them before a
        // screen asks.
        Provider<BuyerAccountApi>(create: (_) => buildBuyerAccountApi()),
        Provider<BuyerAddressApi>(create: (_) => buildBuyerAddressApi()),
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
