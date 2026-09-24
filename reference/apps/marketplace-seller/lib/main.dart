import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'l10n/generated/app_localizations.dart';

// Internal packages
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
// For VerificationStatus
// App-specific providers
import 'providers/seller_provider.dart';
import 'providers/auth_provider.dart' as seller_auth;
import 'providers/notification_provider.dart';
import 'providers/locale_provider.dart';

// Routes
import 'app/routes.dart';

// Deep linking
import 'services/deep_link_service.dart';

// Core
import 'core/seller_status_router.dart';

// Screens

/// Firebase options
import 'firebase_options.dart';

void main() async {
  // 🌐 Use clean URLs without # (must be called before runApp)
  usePathUrlStrategy();
  
  WidgetsFlutterBinding.ensureInitialized();
  
  // 🖼️ Preserve native splash until we're ready to navigate
  FlutterNativeSplash.preserve(widgetsBinding: WidgetsBinding.instance);
  
  // 🚀 Initialize Firebase FIRST (required, but fast)
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // 🚀 Run non-critical init in parallel (fire and forget)
  _initializeServicesAsync();
  
  // Set preferred orientations (skip on web)
  if (!kIsWeb) {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
    
    // 🎨 Make status bar transparent for edge-to-edge design
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark, // For light background
      statusBarBrightness: Brightness.light, // iOS (light background)
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
    ));
  }
  
  // 🚀 Run app IMMEDIATELY - don't wait for anything else
  runApp(const LetBuyySellerApp());
}

/// Initialize non-critical services asynchronously (doesn't block app start)
Future<void> _initializeServicesAsync() async {
  // Initialize SharedPreferences (non-blocking)
  try {
    await SharedPreferencesService.init();
    debugPrint('✅ SharedPreferencesService initialized');
  } catch (e) {
    debugPrint('⚠️ SharedPreferencesService init error: $e');
  }
  
  // 🔔 Initialize FCM only on mobile (skip on web - it always fails)
  if (!kIsWeb) {
    try {
      // Defer to after first frame for instant startup
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await FCMService().initialize();
        debugPrint('✅ FCM initialized successfully');
      });
    } catch (e) {
      debugPrint('⚠️ FCM init error: $e');
    }
  } else {
    debugPrint('ℹ️ FCM skipped on web (not supported)');
  }
}


class LetBuyySellerApp extends StatelessWidget {
  const LetBuyySellerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Auth provider (required by splash screen)
        ChangeNotifierProvider(create: (_) => seller_auth.AuthProvider()),
        
        // Seller-specific providers
        ChangeNotifierProvider(create: (_) => SellerProvider()),
        
        // Notification provider
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        
        // Locale provider for multi-language
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        
        // Shared providers from services package
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => CategoryProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
      ],
      child: Consumer2<ThemeProvider, LocaleProvider>(
        builder: (context, themeProvider, localeProvider, child) {
          return MaterialApp(
            title: 'LetBuyy Seller',
            debugShowCheckedModeBanner: false,
            
            // Theme
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            
            // Localization
            locale: localeProvider.locale,
            supportedLocales: const [
              Locale('en'), // English
              Locale('ta'), // Tamil
              Locale('hi'), // Hindi
            ],
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            
            // 🚀 UNIFIED: Single AuthGate for both web and mobile
            home: const AuthGate(),
            onGenerateRoute: AppRoutes.onGenerateRoute,
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED AUTH GATE - Single entry point for all platforms
// ═══════════════════════════════════════════════════════════════
/// Unified auth gate that handles routing for both web and mobile.
/// Uses SellerStatusRouter for all routing decisions - no duplicate logic.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _hasNavigated = false;

  @override
  void initState() {
    super.initState();
    // Start routing immediately
    WidgetsBinding.instance.addPostFrameCallback((_) => _determineRoute());
  }

  Future<void> _determineRoute() async {
    if (!mounted || _hasNavigated) return;

    final deepLinkService = DeepLinkService();
    final initialRoute = deepLinkService.getInitialRoute();
    
    debugPrint('🚀 AuthGate: Initial route = $initialRoute');

    // 1️⃣ Check for public routes (no auth required)
    if (deepLinkService.isPublicRoute(initialRoute)) {
      debugPrint('🔓 AuthGate: Public route, navigating directly');
      _navigateTo(initialRoute);
      return;
    }

    // 2️⃣ Check Firebase user
    final user = FirebaseAuth.instance.currentUser;
    
    if (user == null) {
      debugPrint('👤 AuthGate: No Firebase user, storing deep link and going to login');
      // Store deep link for after login
      if (!deepLinkService.isAuthRoute(initialRoute) && initialRoute != '/') {
        deepLinkService.pendingDeepLink = initialRoute;
        debugPrint('💾 Stored pending deep link: $initialRoute');
      }
      _navigateTo(AppRoutes.login);
      return;
    }

    // 3️⃣ Load seller and use SellerStatusRouter
    await _loadSellerAndNavigate(user.uid, initialRoute);
  }

  Future<void> _loadSellerAndNavigate(String uid, String initialRoute) async {
    if (!mounted || _hasNavigated) return;

    try {
      final sellerProvider = context.read<SellerProvider>();
      
      // 🚀 FAST PATH: Try loading from cache first (instant, no network)
      final cachedSeller = await sellerProvider.loadCachedSeller(uid);
      
      if (cachedSeller != null) {
        // ✅ Found cached seller - route immediately!
        debugPrint('⚡ AuthGate: Using cached seller for instant routing');
        
        if (!mounted || _hasNavigated) return;
        
        final targetRoute = SellerStatusRouter.getRouteForSeller(
          seller: cachedSeller,
          deepLink: initialRoute,
          hasFirebaseUser: true,
        );
        
        if (targetRoute == null) {
          debugPrint('🚫 AuthGate: Cached seller is suspended');
          await FirebaseAuth.instance.signOut();
          _navigateTo(AppRoutes.login);
        } else {
          _navigateTo(targetRoute);
          
          // Refresh cache in background (non-blocking)
          sellerProvider.loadSellerWithCache(uid);
        }
        return;
      }
      
      // 🐢 SLOW PATH: No cache, load from Firestore with timeout
      debugPrint('🔄 AuthGate: No cache, loading from Firestore...');
      await sellerProvider.loadSeller(uid).timeout(
        const Duration(seconds: 8),
        onTimeout: () {
          debugPrint('⚠️ AuthGate: Firestore load timeout');
        },
      );
      
      if (!mounted || _hasNavigated) return;
      
      final seller = sellerProvider.currentSeller;
      
      // 🚀 Use SellerStatusRouter for routing decision
      final targetRoute = SellerStatusRouter.getRouteForSeller(
        seller: seller,
        deepLink: initialRoute,
        hasFirebaseUser: true,
      );
      
      if (targetRoute == null) {
        // Suspended user - sign out
        debugPrint('🚫 AuthGate: Suspended user, signing out');
        await FirebaseAuth.instance.signOut();
        _navigateTo(AppRoutes.login);
      } else {
        _navigateTo(targetRoute);
      }
    } catch (e) {
      debugPrint('❌ AuthGate: Error loading seller - $e');
      
      // Check if user still exists
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        // User exists but error loading - treat as new seller
        _navigateTo(AppRoutes.welcome);
      } else {
        _navigateTo(AppRoutes.login);
      }
    }
  }

  void _navigateTo(String route) {
    if (!mounted || _hasNavigated) return;
    _hasNavigated = true;
    
    debugPrint('🔄 AuthGate: Navigating to $route');
    
    // Remove native splash now that we're ready to show actual content
    FlutterNativeSplash.remove();
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Navigator.pushReplacementNamed(context, route);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Lightweight loader while determining route
    return const _AuthGateLoader();
  }
}

/// Lightweight loader shown during auth check
class _AuthGateLoader extends StatelessWidget {
  const _AuthGateLoader();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF080B12),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Simple Logo
            SizedBox(
              width: 80,
              height: 80,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF0F5257), Color(0xFF083D41)],
                  ),
                  borderRadius: BorderRadius.all(Radius.circular(20)),
                ),
                child: Center(
                  child: Text(
                    'L',
                    style: TextStyle(
                      fontSize: 42,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(height: 24),
            Text(
              'LETBUYY SELLER',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: 2.0,
              ),
            ),
            SizedBox(height: 32),
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF39A2A6)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
