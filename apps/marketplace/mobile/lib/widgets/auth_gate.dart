// lib/widgets/auth_gate.dart
// 💎 Premium Auth gate utility for requiring authentication before actions
// Features: Dark mode, glassmorphic design, subtle animations

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../providers/auth_provider.dart';
import 'auth_bottom_sheet.dart';

/// Shows auth bottom sheet if user is not logged in
/// Returns true if user is authenticated, false otherwise
Future<bool> requireAuth(BuildContext context, {String? action}) async {
  final authProvider = Provider.of<AuthProvider>(context, listen: false);
  
  // Already logged in
  if (authProvider.isLoggedIn) {
    return true;
  }
  
  // Show auth bottom sheet
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => AuthBottomSheet(
      actionDescription: action,
    ),
  );
  
  return result ?? false;
}

/// 💎 Premium Widget wrapper that requires auth before showing content
/// Features: Glassmorphic design, dark mode support, and smooth animations
class AuthGatedWidget extends StatelessWidget {
  final Widget child;
  final Widget? placeholder;
  final String? actionDescription;

  const AuthGatedWidget({
    super.key,
    required this.child,
    this.placeholder,
    this.actionDescription,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, _) {
        if (authProvider.isLoggedIn) {
          return child;
        }
        
        return placeholder ?? _buildPremiumLoginPrompt(context);
      },
    );
  }

  Widget _buildPremiumLoginPrompt(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final size = MediaQuery.of(context).size;
    
    // 🚀 WEB OPTIMIZATION: Wrap with GestureDetector for tap-to-dismiss keyboard
    return GestureDetector(
      onTap: () => FocusScope.of(context).unfocus(),
      child: Scaffold(
        backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
        body: Stack(
          children: [
          // Background gradient
          Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.topRight,
                radius: 1.5,
                colors: isDark
                    ? [AppColors.primary.withValues(alpha: 0.15), const Color(0xFF080B12)]
                    : [AppColors.primary.withValues(alpha: 0.1), const Color(0xFFF0F4F8)],
              ),
            ),
          ),
          
          // Floating orbs
          Positioned(
            top: -size.height * 0.1,
            right: -size.width * 0.1,
            child: Container(
              width: size.width * 0.5,
              height: size.width * 0.5,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [AppColors.primary.withValues(alpha: 0.2), Colors.transparent],
                ),
              ),
            ),
          ),
          
          Positioned(
            bottom: size.height * 0.1,
            left: -size.width * 0.2,
            child: Container(
              width: size.width * 0.6,
              height: size.width * 0.6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Colors.purple.withValues(alpha: 0.15), Colors.transparent],
                ),
              ),
            ),
          ),
          
          // Main content
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // 🚀 WEB OPTIMIZATION: Wrap glassmorphic card with RepaintBoundary
                  RepaintBoundary(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                      child: Container(
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.1),
                              blurRadius: 30,
                              spreadRadius: 5,
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Lock Icon with Glow
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(alpha: 0.3),
                                    blurRadius: 20,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              child: Icon(
                                Icons.lock_outline_rounded,
                                size: 48,
                                color: isDark ? Colors.white : AppColors.primary,
                              ),
                            ),
                            const SizedBox(height: 28),
                            
                            // Title
                            Text(
                              'Login Required',
                              style: TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: isDark ? Colors.white : const Color(0xFF111827),
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 12),
                            
                            // Subtitle
                            Text(
                              actionDescription ?? 'Please login to continue shopping',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                color: isDark ? Colors.white60 : Colors.grey[600],
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 32),
                            
                            // Login Button
                            SizedBox(
                              width: double.infinity,
                              height: 54,
                              child: ElevatedButton(
                                onPressed: () => requireAuth(context, action: actionDescription),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  shadowColor: AppColors.primary.withValues(alpha: 0.4),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.login_rounded, size: 20),
                                    SizedBox(width: 10),
                                    Text(
                                      'Login / Sign Up',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 0.3,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            
                            // Continue as Guest hint
                            Text(
                              'Browse freely, login when ready to buy',
                              style: TextStyle(
                                fontSize: 12,
                                color: isDark ? Colors.white38 : Colors.grey[500],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ), // ClipRRect
                ), // RepaintBoundary
                ],
              ),
            ),
          ),
        ],
        ),
      ),
    ); // GestureDetector
  }
}
