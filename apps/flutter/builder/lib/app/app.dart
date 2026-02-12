import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/store_theme.dart';
import '../services/theme_provider.dart';
import 'routes.dart';
import 'auth_wrapper.dart';

/// Store Builder App
/// Uses shared LetBuyy theme colors for consistency
class StoreBuilderApp extends StatelessWidget {
  const StoreBuilderApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    
    return MaterialApp(
      title: 'LetBuyy Store Builder',
      debugShowCheckedModeBanner: false,
      theme: StoreTheme.light(),
      darkTheme: StoreTheme.dark(),
      themeMode: themeProvider.themeMode,
      home: const AuthWrapper(),  // Use home instead of initialRoute for stability
      onGenerateRoute: AppRoutes.generateRoute,
    );
  }
}

