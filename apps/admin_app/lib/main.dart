import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

// Internal packages
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

// App-specific providers
import 'providers/admin_provider.dart';
import 'providers/auth_provider.dart' as app_auth;
import 'providers/seller_provider.dart';
import 'providers/notification_provider.dart';

// Router
import 'app/app_router.dart';

/// Firebase options - you'll need to generate this
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Use path URL strategy (removes # from URLs)
  if (kIsWeb) {
    usePathUrlStrategy();
  }
  
  // Initialize Firebase
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  
  // Set preferred orientations (mobile only)
  if (!kIsWeb) {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }
  
  runApp(const LetBuyyAdminApp());
}

class LetBuyyAdminApp extends StatelessWidget {
  const LetBuyyAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Theme Provider
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        
        // Auth Provider (for admin login)
        ChangeNotifierProvider(create: (_) => app_auth.AuthProvider()),
        
        // Seller Provider (for KYC management)
        ChangeNotifierProvider(create: (_) => SellerProvider()),
        
        // Admin-specific provider
        ChangeNotifierProvider(create: (_) => AdminProvider()),
        
        // Notification Provider
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        
        // ✅ Category Provider (for product/category management)
        ChangeNotifierProvider(create: (_) => CategoryProvider()),
        
        // ✅ Banner Provider (for banner management)
        ChangeNotifierProvider(create: (_) => BannerProvider()),
        
        // ✅ App Update Provider (for managing app updates)
        ChangeNotifierProvider(create: (_) => AppUpdateProvider()),
        
        // ✅ Order Provider (for order management)
        ChangeNotifierProvider(create: (_) => OrderProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp.router(
            title: 'LetBuyy Admin',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            routerConfig: AppRouter.router,
          );
        },
      ),
    );
  }
}
