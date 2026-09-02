// lib/screens/splash/splash_screen.dart
// 🚀 Premium Marketplace Splash Screen - Clean & Performant
// ✨ Matches seller app design style with gradient header and wave

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../app/routes.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import '../../providers/auth_provider.dart' as app_auth;

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  
  // Animation controllers
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  late AnimationController _pulseController;
  
  bool _hasNavigated = false;
  String _statusMessage = 'Initializing...';
  double _progress = 0.0;

  @override
  void initState() {
    super.initState();
    _setSystemUI();
    _initAnimations();
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_hasNavigated) {
        _runInitialization();
      }
    });
  }

  void _setSystemUI() {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Color(0xFF080B12),
        systemNavigationBarIconBrightness: Brightness.light,
      ),
    );
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);
    
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _updateStatus(String message, double progress) {
    if (mounted && !_hasNavigated) {
      setState(() {
        _statusMessage = message;
        _progress = progress;
      });
    }
  }

  Future<void> _runInitialization() async {
    if (_hasNavigated || !mounted) return;
    
    try {
      // 🚀 INSTANT SPLASH: Show UI for minimum 400ms (branding), then navigate
      _updateStatus('Welcome', 0.5);
      
      // Check cached user (INSTANT - no network call)
      final cachedUser = FirebaseAuth.instance.currentUser;
      
      // Small delay just for smooth animation (NOT blocking network calls)
      await Future.delayed(const Duration(milliseconds: 400));
      if (_hasNavigated || !mounted) return;
      
      _updateStatus('Opening Store...', 1.0);
      await Future.delayed(const Duration(milliseconds: 100));
      
      // Navigate immediately - auth restoration happens AFTER on MainScreen
      if (mounted && !_hasNavigated) {
        _hasNavigated = true;
        debugPrint('🚀 Splash: Navigating in <600ms (user: ${cachedUser?.email ?? "guest"})');
        Navigator.pushReplacementNamed(context, AppRoutes.main);
      }
      
    } catch (e) {
      debugPrint('❌ SPLASH Error: $e');
      if (mounted && !_hasNavigated) {
        _hasNavigated = true;
        Navigator.pushReplacementNamed(context, AppRoutes.main);
      }
    }
  }

  // 🚀 REMOVED: These blocking methods are no longer needed
  // Auth restoration now happens in AuthProvider AFTER navigation

  Future<void> _waitForProvidersReady() async {
    final authProvider = Provider.of<app_auth.AuthProvider>(context, listen: false);
    int attempts = 0;
    const maxAttempts = 20;
    
    while (authProvider.isInitializing && attempts < maxAttempts) {
      await Future.delayed(const Duration(milliseconds: 100));
      attempts++;
    }
  }

  Future<User?> _waitForAuthState() async {
    final completer = Completer<User?>();
    StreamSubscription<User?>? subscription;
    Timer? timeout;
    
    timeout = Timer(const Duration(seconds: 5), () {
      if (!completer.isCompleted) {
        subscription?.cancel();
        completer.complete(FirebaseAuth.instance.currentUser);
      }
    });
    
    subscription = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (!completer.isCompleted) {
        timeout?.cancel();
        subscription?.cancel();
        completer.complete(user);
      }
    });
    
    return completer.future;
  }

  Future<String> _getRoute(User? user) async {
    try {
      // Guest mode enabled - always go to main screen
      // Users can browse without login, auth required only for actions
      if (user != null) {
        try {
          await user.getIdToken(true);
        } catch (e) {
          debugPrint('⚠️ Token refresh failed, continuing as guest: $e');
        }
      }
      
      return AppRoutes.main;
      
    } catch (e) {
      debugPrint('❌ Route error: $e');
      return AppRoutes.main;
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      // Same dark teal background as app icon - for both modes
      backgroundColor: const Color(0xFF0A3D47),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // 1. Animated Background
          _buildAnimatedBackground(isDark),
          
          // 2. Floating Orbs
          ..._buildFloatingOrbs(isDark, size),
          
          // 3. Main Content
          
          // 4. Main Content
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(),
                
                // Logo Section
                _buildLogo(isDark, theme),
                
                const SizedBox(height: 48),
                
                // Brand Text
                _buildBrandText(isDark),
                
                const SizedBox(height: 16),
                                
                const Spacer(),
                
                // Progress Section
                _buildProgressSection(isDark, theme),
                
                const SizedBox(height: 48),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(
                math.sin(_bgAnimController.value * 2 * math.pi) * 0.5,
                math.cos(_bgAnimController.value * 2 * math.pi) * 0.5,
              ),
              colors: [
                AppColors.primary.withValues(alpha: 0.2), 
                const Color(0xFF0A3D47), 
                const Color(0xFF0A3D47)
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: -size.height * 0.1,
        right: -size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, _floatController.value * 30),
              child: Container(
                width: size.width * 0.4,
                height: size.width * 0.4,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [AppColors.primary.withValues(alpha: 0.15), Colors.transparent],
                  ),
                ),
              ),
            );
          },
        ),
      ),
      Positioned(
        bottom: -size.height * 0.1,
        left: -size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(_floatController.value * 20, 0),
              child: Container(
                width: size.width * 0.5,
                height: size.width * 0.5,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [AppColors.infoAccent.withValues(alpha: 0.1), Colors.transparent],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    ];
  }

  Widget _buildLogo(bool isDark, ThemeData theme) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, _) {
        return Transform.scale(
          scale: 1.0 + (_pulseController.value * 0.05),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 30 + (_pulseController.value * 10),
                  spreadRadius: _pulseController.value * 5,
                ),
              ],
            ),
            child: Icon(
              Icons.shopping_bag_rounded, 
              size: 64, 
              color: isDark ? Colors.white : AppColors.primary
            ),
          ),
        );
      },
    ).animate().fadeIn(duration: 800.ms).slideY(begin: 0.2, end: 0);
  }
  
  Widget _buildBrandText(bool isDark) {
    return Column(
      children: [
        ShaderMask(
          shaderCallback: (bounds) => LinearGradient(
            colors: isDark 
                ? [Colors.white, const Color(0xFFE0E0E0)] 
                : [const Color(0xFF111827), const Color(0xFF374151)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(bounds),
          child: const Text(
            'LetBuyy',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 40,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -1.0,
              fontFamily: 'Inter',
            ),
          ),
        ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.2),
        
        const SizedBox(height: 8),
        
        Text(
          'Smart Shopping Platform',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 15,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
            fontWeight: FontWeight.w500,
            letterSpacing: 0.5,
          ),
        ).animate().fadeIn(delay: 500.ms),
      ],
    );
  }

  Widget _buildProgressSection(bool isDark, ThemeData theme) {
    return Column(
      children: [
        // Custom Progress Bar
        Container(
          width: 200,
          height: 4,
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(2),
          ),
          child: Stack(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 200 * _progress,
                height: 4,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      theme.colorScheme.primary,
                      AppColors.infoAccent,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(2),
                  boxShadow: [
                    BoxShadow(
                      color: theme.colorScheme.primary.withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 16),
        
        // Status Text
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Text(
            _statusMessage,
            key: ValueKey(_statusMessage),
            style: TextStyle(
              fontSize: 13,
              color: isDark ? Colors.grey[500] : Colors.grey[500],
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    ).animate().fadeIn(delay: 800.ms);
  }
}

// Grid Pattern Painter for consistency
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.1});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: opacity)
      ..strokeWidth = 1;

    const spacing = 50.0;
    
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
