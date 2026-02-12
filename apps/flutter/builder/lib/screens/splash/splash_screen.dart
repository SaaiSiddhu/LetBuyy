import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../app/routes.dart';

/// Splash Screen - Visual only, no routing logic
/// All auth routing is handled by AuthWrapper
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigateAfterDelay();
  }

  Future<void> _navigateAfterDelay() async {
    // Show splash animation for 2 seconds, then go to auth wrapper
    await Future.delayed(const Duration(milliseconds: 2000));
    
    if (!mounted) return;
    
    // AuthWrapper handles all routing logic (KYC, login, wizard, main)
    Navigator.pushReplacementNamed(context, AppRoutes.auth);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Premium Gradient Background (Matches Login Branding)
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF0F172A), // _darkBg from Login
                  Color(0xFF1E293B), // Matches branding panel gradient
                ],
              ),
            ),
          ),

          // 2. Decorative Background Elements (Glassmorphism blobs)
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            left: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.03),
              ),
            ),
          ),

          // 3. Main Content
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // App Logo with Glow & Shadow
                Container(
                  width: 120,
                  height: 120,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 40,
                        offset: const Offset(0, 15),
                      ),
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.2),
                        blurRadius: 20,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  child: Image.asset(
                    'assets/icons/app_icon.png',
                    fit: BoxFit.contain,
                  ),
                )
                    .animate()
                    .scale(
                      duration: 800.ms, 
                      curve: Curves.easeOutBack,
                      begin: const Offset(0.5, 0.5),
                    )
                    .shimmer(delay: 1000.ms, duration: 1200.ms),

                const SizedBox(height: 48),

                // Brand Title
                const Text(
                  'LetBuyy',
                  style: TextStyle(
                    fontSize: 42,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -1.0,
                    height: 1.0,
                  ),
                )
                    .animate(delay: 300.ms)
                    .fadeIn(duration: 600.ms)
                    .slideY(begin: 0.2, end: 0, curve: Curves.easeOutQuad),

                const SizedBox(height: 8),

                // Subtitle / Tagline
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                  child: const Text(
                    'Store Builder',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                )
                    .animate(delay: 500.ms)
                    .fadeIn()
                    .slideY(begin: 0.2, end: 0),

                const SizedBox(height: 60),

                // Custom Loading Indicator
                SizedBox(
                  width: 40,
                  height: 40,
                  child: Stack(
                    children: [
                      const CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 3,
                      ),
                      Center(
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
                    .animate(delay: 800.ms)
                    .fadeIn(),
              ],
            ),
          ),
          
          // 4. Version or footer text (optional)
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Center(
              child: Text(
                'Powering your business',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.4),
                  fontSize: 12,
                  letterSpacing: 1,
                ),
              ).animate(delay: 1500.ms).fadeIn(),
            ),
          ),
        ],
      ),
    );
  }
}
