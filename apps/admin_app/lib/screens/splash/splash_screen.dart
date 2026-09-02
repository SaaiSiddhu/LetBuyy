// lib/screens/splash/splash_screen.dart
//
// 🚀 ULTRA-ADVANCED SPLASH SCREEN
// ✨ Matching auth_screen.dart & seller_registration_screen.dart patterns
// 📱 Fully responsive across all devices (mobile/tablet/desktop)
// 🎨 Enhanced animations with 7 controllers
// 🔥 Firebase Auth + Provider initialization with safe navigation

import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_router.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import '../../providers/auth_provider.dart' as app_auth;
import '../../providers/seller_provider.dart';
import '../../utils/performance_utils.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  
  // --- 7 ANIMATION CONTROLLERS (matching auth screens) ---
  late AnimationController _mainAnimController;
  late AnimationController _logoController;
  late AnimationController _pulseController;
  late AnimationController _shimmerController;
  late AnimationController _floatingController;
  late AnimationController _progressController;
  late AnimationController _fadeController;
  
  // --- ANIMATIONS ---
  late Animation<double> _logoScale;
  late Animation<double> _logoFade;
  late Animation<double> _pulse;
  late Animation<double> _shimmer;
  late Animation<Offset> _floating;
  late Animation<Offset> _slideUp;
  late Animation<double> _fadeIn;
  late Animation<double> _progressValue;

  // --- STATE ---
  bool _hasNavigated = false;
  String _statusMessage = 'Initializing...';
  double _progress = 0.0;
  bool _showDetails = false;

  @override
  void initState() {
    super.initState();
    _setSystemUI();
    _initAnimations();
    
    // Start initialization after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_hasNavigated) {
        _runInitialization();
      }
    });
  }

  @override
  void dispose() {
    _mainAnimController.dispose();
    _logoController.dispose();
    _pulseController.dispose();
    _shimmerController.dispose();
    _floatingController.dispose();
    _progressController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  void _setSystemUI() {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );
  }

  void _initAnimations() {
    // Main entrance animation (1200ms - matching seller screen)
    _mainAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _slideUp = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _mainAnimController,
      curve: const Interval(0.2, 0.9, curve: Curves.easeOutCubic),
    ));

    _fadeIn = CurvedAnimation(
      parent: _mainAnimController,
      curve: const Interval(0.3, 1.0, curve: Curves.easeIn),
    );

    // Logo animation (1000ms elastic out)
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _logoScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(
        parent: _logoController,
        curve: Curves.elasticOut,
      ),
    );

    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _logoController,
        curve: Curves.easeOut,
      ),
    );

    // Pulse animation (1800ms - matching seller screen)
    // Check if running on mobile web to reduce animations
    final isMobileWeb = PerformanceUtils.isMobileWeb;
    
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    // Only run pulse animation on non-mobile-web
    if (!isMobileWeb) _pulseController.repeat(reverse: true);

    _pulse = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(
        parent: _pulseController,
        curve: Curves.easeInOut,
      ),
    );

    // Shimmer effect (2500ms)
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    );
    // Only run shimmer animation on non-mobile-web
    if (!isMobileWeb) _shimmerController.repeat();

    _shimmer = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(
        parent: _shimmerController,
        curve: Curves.easeInOut,
      ),
    );

    // Floating animation (3000ms)
    _floatingController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    );
    // Only run floating animation on non-mobile-web
    if (!isMobileWeb) _floatingController.repeat(reverse: true);

    _floating = Tween<Offset>(
      begin: const Offset(0, -0.02),
      end: const Offset(0, 0.02),
    ).animate(CurvedAnimation(
      parent: _floatingController,
      curve: Curves.easeInOut,
    ));

    // Progress animation (600ms)
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _progressValue = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _progressController,
        curve: Curves.easeInOutCubic,
      ),
    );

    // Fade controller (400ms)
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    // Start animations
    _logoController.forward();
    _mainAnimController.forward();
    
    // Show details after main animation
    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) {
        setState(() => _showDetails = true);
        _fadeController.forward();
      }
    });
  }

  void _updateStatus(String message, double progress) {
    if (mounted && !_hasNavigated) {
      setState(() {
        _statusMessage = message;
        _progress = progress;
      });
      
      // Animate progress bar
      _progressController.reset();
      _progressController.forward();
    }
  }

  Future<void> _runInitialization() async {
    if (_hasNavigated || !mounted) return;
    
    debugPrint('');
    debugPrint('══════════════════════════════════════════════════');
    debugPrint('🚀 SPLASH: Starting initialization');
    debugPrint('══════════════════════════════════════════════════');
    
    try {
      // Step 1: Small delay for UI to render
      _updateStatus('Starting...', 0.1);
      await Future.delayed(const Duration(milliseconds: 300));
      if (_hasNavigated || !mounted) return;
      
      // Step 2: Wait for providers to initialize
      _updateStatus('Initializing...', 0.2);
      await _waitForProvidersReady(context);
      if (_hasNavigated || !mounted) return;
      
      // Step 3: Wait for Firebase Auth to restore session
      _updateStatus('Restoring session...', 0.4);
      final user = await _waitForAuthState();
      if (_hasNavigated || !mounted) return;
      
      // Step 4: Determine route based on auth state
      _updateStatus('Loading...', 0.7);
      final route = await _getRoute(user);
      if (_hasNavigated || !mounted) return;
      
      // Step 5: Final delay
      _updateStatus('Almost ready...', 0.9);
      await Future.delayed(const Duration(milliseconds: 300));
      if (_hasNavigated || !mounted) return;
      
      // Step 6: Navigate
      _updateStatus('Ready!', 1.0);
      await Future.delayed(const Duration(milliseconds: 100));
      
      _safeNavigate(route);
      
    } catch (e) {
      debugPrint('❌ SPLASH Error: $e');
      _safeNavigate(AppRouter.login);
    }
  }

  /// 🔥 CRITICAL: Wait for Firebase Auth to emit initial state
  Future<User?> _waitForAuthState() async {
    // Check if we already have a user
    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser != null) {
      debugPrint('✅ SPLASH: User already available: ${currentUser.uid}');
      return currentUser;
    }

    debugPrint('🔄 SPLASH: Waiting for Firebase Auth state...');
    
    final completer = Completer<User?>();
    StreamSubscription<User?>? subscription;
    Timer? timeout;
    
    timeout = Timer(const Duration(seconds: 5), () {
      if (!completer.isCompleted) {
        debugPrint('⚠️ SPLASH: Auth state timeout, using current user');
        subscription?.cancel();
        completer.complete(FirebaseAuth.instance.currentUser);
      }
    });
    
    subscription = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (!completer.isCompleted) {
        timeout?.cancel();
        subscription?.cancel();
        debugPrint('✅ SPLASH: Auth state received: ${user?.uid ?? 'null'}');
        completer.complete(user);
      }
    });
    
    return completer.future;
  }
  
  /// 🔥 Wait for providers to finish initialization
  Future<void> _waitForProvidersReady(BuildContext context) async {
    debugPrint('🔄 SPLASH: Waiting for providers to initialize...');
    
    if (!mounted) return;
    
    // Check initialization state with a timeout loop
    final startTime = DateTime.now();
    
    while (mounted) {
      final authProvider = Provider.of<app_auth.AuthProvider>(context, listen: false);
      final sellerProvider = Provider.of<SellerProvider>(context, listen: false);

      if (!authProvider.isInitializing && !sellerProvider.isInitializing) {
         debugPrint('✅ SPLASH: Providers ready');
         return;
      }

      if (DateTime.now().difference(startTime).inSeconds > 5) {
        debugPrint('⚠️ SPLASH: Provider initialization timeout');
        break;
      }
      await Future.delayed(const Duration(milliseconds: 100));
    }
  }

  Future<String> _getRoute(User? user) async {
    try {
      if (user == null) {
        debugPrint('👤 SPLASH: No user → going to login');
        return AppRouter.login;
      }
      
      debugPrint('🔐 SPLASH: User found: ${user.uid}');
      
      // Verify token validity
      try {
        await user.getIdToken(true);
        debugPrint('✅ SPLASH: Token valid');
      } catch (e) {
        debugPrint('❌ SPLASH: Token invalid - $e');
        try {
          await FirebaseAuth.instance.signOut();
        } catch (_) {}
        return AppRouter.login;
      }
      
      // Get user type from storage
      final prefs = await SharedPreferences.getInstance();
      final userType = prefs.getString(StorageConstants.keyUserType);
      final userRole = prefs.getString(StorageConstants.keyUserRole);
      
      debugPrint('📦 SPLASH: type=$userType, role=$userRole');
      
      // Check role first (admin takes priority)
      if (userRole == 'admin' || userType == 'admin') {
        return AppRouter.dashboard;
      }
      
      // Not admin - sign out and redirect to login
      await FirebaseAuth.instance.signOut();
      return AppRouter.login;
      
    } catch (e) {
      debugPrint('❌ SPLASH: Route error: $e');
      return AppRouter.login;
    }
  }

  /// 🔥 SAFE NAVIGATION using go_router
  void _safeNavigate(String route) {
    if (_hasNavigated) {
        debugPrint('⚠️ SPLASH: Already navigated/navigating. Ignoring request to $route');
        return;
    }
    _hasNavigated = true;
    
    debugPrint('');
    debugPrint('══════════════════════════════════════════════════');
    debugPrint('🚀 SPLASH: NAVIGATING TO → $route');
    debugPrint('══════════════════════════════════════════════════');
    debugPrint('');
    
    if (!mounted) {
      debugPrint('⚠️ SPLASH: Widget disposed before navigation');
      return;
    }
      
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        // Use go_router's context.go for proper URL-based navigation
        context.go(route);
      } catch (e) {
        debugPrint('❌ SPLASH: Navigation error: $e');
        // Fallback to login if navigation fails
        if (route != AppRouter.login) {
             try {
               context.go(AppRouter.login);
             } catch (_) {}
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Get screen dimensions for responsive layout
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 1024;
    final isTablet = size.width > 768 && size.width <= 1024;
    final isMobile = size.width <= 768;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary.withValues(alpha: 0.02),
              Colors.white,
              AppColors.primary.withValues(alpha: 0.01),
            ],
            stops: const [0.0, 0.5, 1.0],
          ),
        ),
        child: isDesktop
            ? _buildDesktopLayout()
            : isTablet
                ? _buildTabletLayout()
                : _buildMobileLayout(),
      ),
    );
  }

  // --- RESPONSIVE LAYOUTS ---

  Widget _buildDesktopLayout() {
    return Row(
      children: [
        // Left hero section
        Expanded(
          flex: 45,
          child: _buildHeroSection(),
        ),
        // Right content
        Expanded(
          flex: 55,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: _buildMainContent(isCompact: false),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTabletLayout() {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 600),
        margin: const EdgeInsets.all(32),
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 60,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: _buildMainContent(isCompact: false),
      ),
    );
  }

  Widget _buildMobileLayout() {
    return SafeArea(
      child: _buildMainContent(isCompact: true),
    );
  }

  // --- HERO SECTION (Desktop only) ---

  Widget _buildHeroSection() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary,
                AppColors.primary.withValues(alpha: 0.85),
                AppColors.primary.withValues(alpha: 0.95),
              ],
            ),
          ),
          child: Stack(
            children: [
              // Shimmer overlay
              Positioned.fill(
                child: AnimatedBuilder(
                  animation: _shimmer,
                  builder: (context, _) {
                    return Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment(_shimmer.value - 1, -0.5),
                          end: Alignment(_shimmer.value, 0.5),
                          colors: [
                            Colors.transparent,
                            Colors.white.withValues(alpha: 0.05),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              // Content
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(64),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Floating badge
                      SlideTransition(
                        position: _floating,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(30),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3),
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Colors.greenAccent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Initializing Platform',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 48),
                      // Main heading
                      FadeTransition(
                        opacity: _fadeIn,
                        child: const Text(
                          'Welcome to\nLetBuyy',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 56,
                            fontWeight: FontWeight.w900,
                            height: 1.1,
                            letterSpacing: -1,
                            shadows: [
                              Shadow(
                                color: Colors.black26,
                                offset: Offset(0, 4),
                                blurRadius: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      // Subtitle
                      FadeTransition(
                        opacity: _fadeIn,
                        child: Text(
                          'Your Smart Shopping Platform',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.95),
                            fontSize: 18,
                            fontWeight: FontWeight.w400,
                            height: 1.6,
                          ),
                        ),
                      ),
                      const SizedBox(height: 48),
                      // Stats
                      FadeTransition(
                        opacity: _fadeIn,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _buildStatItem('10K+', 'Active Users'),
                            const SizedBox(width: 48),
                            _buildStatItem('5K+', 'Products'),
                            const SizedBox(width: 48),
                            _buildStatItem('98%', 'Satisfaction'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatItem(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.8),
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  // --- MAIN CONTENT ---

  Widget _buildMainContent({required bool isCompact}) {
    return FadeTransition(
      opacity: _fadeIn,
      child: SlideTransition(
        position: _slideUp,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (!isCompact) const Spacer(flex: 2),
            
            // Logo
            _buildAnimatedLogo(isCompact: isCompact),
            
            if (!isCompact) const Spacer(flex: 1),
            
            SizedBox(height: isCompact ? 48 : 32),
            
            // Progress section
            _buildProgressSection(),
            
            if (!isCompact) const Spacer(flex: 2),
            
            // Details (shown after animation)
            if (_showDetails) ...[
              SizedBox(height: isCompact ? 32 : 24),
              _buildDetails(),
            ],
            
            if (isCompact) const SizedBox(height: 32),
            
            // Footer
            _buildFooter(),
            
            if (isCompact) const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildAnimatedLogo({required bool isCompact}) {
    final size = isCompact ? 100.0 : 120.0;
    
    return Hero(
      tag: 'app_logo',
      child: ScaleTransition(
        scale: _logoScale,
        child: FadeTransition(
          opacity: _logoFade,
          child: AnimatedBuilder(
            animation: _pulse,
            builder: (context, _) {
              return Transform.scale(
                scale: _pulse.value,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: size,
                      height: size,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary,
                            AppColors.primary.withValues(alpha: 0.8),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(size * 0.23),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.3),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                            spreadRadius: 0,
                          ),
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            blurRadius: 60,
                            offset: const Offset(0, 20),
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(size * 0.23),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Image.asset(
                            'assets/icons/app_icon.png',
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Icon(
                              Icons.shopping_bag_rounded,
                              size: size * 0.5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(height: isCompact ? 20 : 24),
                    Text(
                      'LetBuyy',
                      style: TextStyle(
                        fontSize: isCompact ? 32 : 36,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '✨ Smart Shopping Platform',
                      style: TextStyle(
                        fontSize: isCompact ? 13 : 14,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildProgressSection() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Progress bar with animation
        AnimatedBuilder(
          animation: _progressValue,
          builder: (context, _) {
            return Container(
              width: 200,
              height: 6,
              decoration: BoxDecoration(
                color: Colors.grey.shade200,
                borderRadius: BorderRadius.circular(3),
              ),
              child: FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: _progress * _progressValue.value,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primary,
                        AppColors.primary.withValues(alpha: 0.8),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(3),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 20),
        // Status message
        Text(
          _statusMessage,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 20),
        // Circular progress indicator
        SizedBox(
          width: 32,
          height: 32,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            valueColor: AlwaysStoppedAnimation(
              AppColors.primary.withValues(alpha: 0.7),
            ),
          ),
        ),
        const SizedBox(height: 16),
        // Percentage
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            '${(_progress * 100).toInt()}%',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDetails() {
    return FadeTransition(
      opacity: _fadeController,
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildDetailItem(
                Icons.verified_rounded,
                'Secure',
              ),
              const SizedBox(width: 32),
              _buildDetailItem(
                Icons.flash_on_rounded,
                'Fast',
              ),
              const SizedBox(width: 32),
              _buildDetailItem(
                Icons.favorite_rounded,
                'Trusted',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailItem(IconData icon, String label) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            icon,
            color: AppColors.primary,
            size: 24,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.grey.shade600,
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Text(
      'v1.0.0 • Powered by Firebase',
      style: TextStyle(
        fontSize: 11,
        color: Colors.grey.shade400,
      ),
    );
  }
}
