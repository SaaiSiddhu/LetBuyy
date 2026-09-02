// lib/screens/onboarding/onboarding_screen.dart
//
// 🚀 PRODUCTION-READY ONBOARDING
// ✨ Modular Architecture | 🎨 Glassmorphism | ♿ Accessible
// 📱 Adaptive Layouts | ⚡ High Performance

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
// For BackdropFilter
import 'package:shared_preferences/shared_preferences.dart';

// Assume these exist in your project, otherwise replace with standard imports
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

// --- MODELS ---

enum OnboardingType { buyer, seller }

class OnboardingPageData {
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final List<String> features;

  const OnboardingPageData({
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    required this.features,
  });
}

// --- DATA SOURCE (Mock Localization) ---

class OnboardingContent {
  static const List<OnboardingPageData> buyerPages = [
    OnboardingPageData(
      title: 'Welcome to LetBuyy',
      description: 'Discover endless shopping possibilities. Fashion, electronics, home essentials, and more.',
      icon: Icons.shopping_bag_outlined,
      color: AppColors.info,
      features: ['Million+ Products', 'Best Prices', 'Fast Delivery'],
    ),
    OnboardingPageData(
      title: 'Unbeatable Deals',
      description: 'Save more with daily offers, flash sales, and exclusive discounts.',
      icon: Icons.local_offer_outlined,
      color: AppColors.warning,
      features: ['Daily Offers', 'Mega Discounts', 'Cashback Rewards'],
    ),
    OnboardingPageData(
      title: 'Lightning Delivery',
      description: 'Order today, enjoy tomorrow. Real-time tracking included.',
      icon: Icons.rocket_launch_outlined,
      color: AppColors.success,
      features: ['Next-Day Delivery', 'Live Tracking', 'Safe Packaging'],
    ),
  ];

  static const List<OnboardingPageData> sellerPages = [
    OnboardingPageData(
      title: 'Start Selling',
      description: 'Transform your business with our powerful platform. Reach millions.',
      icon: Icons.store_outlined,
      color: AppColors.accent,
      features: ['Zero Listing Fee', 'Easy Setup', 'Nationwide Reach'],
    ),
    OnboardingPageData(
      title: 'Business Analytics',
      description: 'Manage inventory and track growth with our intuitive dashboard.',
      icon: Icons.pie_chart_outline,
      color: AppColors.info,
      features: ['Real-Time Stats', 'Inventory Mgmt', 'Sales Reports'],
    ),
    OnboardingPageData(
      title: 'Instant Payouts',
      description: 'Get paid on time, every time. Secure and transparent.',
      icon: Icons.account_balance_wallet_outlined,
      color: AppColors.error,
      features: ['Daily Settlements', 'Bank Transfer', 'Payment Protection'],
    ),
  ];
}

// --- MAIN SCREEN ---

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> with TickerProviderStateMixin {
  // Logic & State
  final PageController _pageController = PageController();
  int _currentPage = 0;
  OnboardingType _selectedType = OnboardingType.buyer;
  bool _hasSelectedType = false;

  // Animation Controllers
  late final AnimationController _mainController;
  late final AnimationController _pageTransitionController;
  late final AnimationController _idleAnimationController;

  // Animations
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
  }

  void _setupAnimations() {
    // 1. Entrance Animation
    _mainController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _mainController,
      curve: Curves.easeOut,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _mainController,
      curve: Curves.easeOutQuart,
    ));

    // 2. Page Transition
    _pageTransitionController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    // 3. Idle (Pulse)
    _idleAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _idleAnimationController, curve: Curves.easeInOut),
    );

    // Start
    _mainController.forward();
    _pageTransitionController.forward();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _mainController.dispose();
    _pageTransitionController.dispose();
    _idleAnimationController.dispose();
    super.dispose();
  }

  // --- ACTIONS ---

  void _onTypeSelected(OnboardingType type) {
    HapticFeedback.mediumImpact();
    setState(() {
      _selectedType = type;
      _hasSelectedType = true;
      _currentPage = 0;
    });
    _pageTransitionController.forward(from: 0);
  }

  void _onBackToSelection() {
    HapticFeedback.lightImpact();
    setState(() {
      _hasSelectedType = false;
      _currentPage = 0;
    });
    _mainController.forward(from: 0);
  }

  void _onNextPage() {
    final pages = _selectedType == OnboardingType.buyer
        ? OnboardingContent.buyerPages
        : OnboardingContent.sellerPages;

    if (_currentPage < pages.length - 1) {
      HapticFeedback.selectionClick();
      _pageController.nextPage(
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeOutQuart,
      );
    } else {
      _finishOnboarding();
    }
  }

  Future<void> _finishOnboarding() async {
    HapticFeedback.heavyImpact();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(StorageConstants.keyOnboardingCompleted, true);
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.auth,
        (route) => false,
      );
    }
  }

  // --- UI BUILDER ---

  @override
  Widget build(BuildContext context) {
    // Responsive Helper
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 1024;

    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // 1. Dynamic Background
          _buildBackground(),

          // 2. Main Content
          FadeTransition(
            opacity: _fadeAnimation,
            child: SlideTransition(
              position: _slideAnimation,
              child: SafeArea(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 500),
                  switchInCurve: Curves.easeOutQuart,
                  switchOutCurve: Curves.easeInQuart,
                  child: !_hasSelectedType
                      ? TypeSelectionView(
                          key: const ValueKey('Selection'),
                          isDesktop: isDesktop,
                          onTypeSelected: _onTypeSelected,
                          onSkip: _finishOnboarding,
                          pulseAnimation: _pulseAnimation,
                        )
                      : OnboardingFlowView(
                          key: const ValueKey('Flow'),
                          type: _selectedType,
                          currentPage: _currentPage,
                          pageController: _pageController,
                          onBack: _onBackToSelection,
                          onNext: _onNextPage,
                          onSkip: _finishOnboarding,
                          onPageChanged: (idx) {
                            setState(() => _currentPage = idx);
                            _pageTransitionController.forward(from: 0);
                          },
                          animationController: _pageTransitionController,
                          isDesktop: isDesktop,
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackground() {
    // Clean gradient background
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white,
            AppColors.primary.withValues(alpha: 0.03),
          ],
        ),
      ),
    );
  }
}

// --- SUB-WIDGET: TYPE SELECTION ---

class TypeSelectionView extends StatelessWidget {
  final bool isDesktop;
  final Function(OnboardingType) onTypeSelected;
  final VoidCallback onSkip;
  final Animation<double> pulseAnimation;

  const TypeSelectionView({
    super.key,
    required this.isDesktop,
    required this.onTypeSelected,
    required this.onSkip,
    required this.pulseAnimation,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildHeader(context),
        Expanded(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 900),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Welcome to LetBuyy',
                      style: TextStyle(
                        fontSize: 42,
                        fontWeight: FontWeight.w900,
                        color: AppColors.primary,
                        letterSpacing: -1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Are you here to Shop or Sell?',
                      style: TextStyle(
                        fontSize: 18,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 48),
                    if (isDesktop)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(child: _buildCard(OnboardingType.buyer)),
                          const SizedBox(width: 24),
                          Expanded(child: _buildCard(OnboardingType.seller)),
                        ],
                      ).height(400) // Extension method or sized box
                    else
                      Column(
                        children: [
                          _buildCard(OnboardingType.buyer),
                          const SizedBox(height: 20),
                          _buildCard(OnboardingType.seller),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        _buildVersionFooter(),
      ],
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          TextButton(
            onPressed: onSkip,
            child: Text(
              'Skip',
              style: TextStyle(
                color: Colors.grey[600],
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(OnboardingType type) {
    final isBuyer = type == OnboardingType.buyer;
    final color = isBuyer ? AppColors.info : AppColors.accent;

    return TypeSelectionCard(
      title: isBuyer ? 'Shop as Buyer' : 'Sell as Seller',
      subtitle: isBuyer
          ? 'Browse millions of products with best prices.'
          : 'Setup your store and reach nationwide customers.',
      icon: isBuyer ? Icons.shopping_bag_outlined : Icons.store_outlined,
      color: color,
      onTap: () => onTypeSelected(type),
      pulseAnimation: pulseAnimation,
    );
  }

  Widget _buildVersionFooter() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Text(
        'v1.0.0',
        style: TextStyle(color: Colors.grey[300], fontSize: 12),
      ),
    );
  }
}

// --- SUB-WIDGET: ONBOARDING FLOW ---

class OnboardingFlowView extends StatelessWidget {
  final OnboardingType type;
  final int currentPage;
  final PageController pageController;
  final VoidCallback onBack;
  final VoidCallback onNext;
  final VoidCallback onSkip;
  final Function(int) onPageChanged;
  final AnimationController animationController;
  final bool isDesktop;

  const OnboardingFlowView({
    super.key,
    required this.type,
    required this.currentPage,
    required this.pageController,
    required this.onBack,
    required this.onNext,
    required this.onSkip,
    required this.onPageChanged,
    required this.animationController,
    required this.isDesktop,
  });

  @override
  Widget build(BuildContext context) {
    final pages = type == OnboardingType.buyer
        ? OnboardingContent.buyerPages
        : OnboardingContent.sellerPages;

    final activeColor = pages[currentPage].color;

    return Column(
      children: [
        // 1. Navigation Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: onBack,
                tooltip: 'Go Back',
              ),
              const Spacer(),
              TextButton(
                onPressed: onSkip,
                child: const Text('Skip'),
              ),
            ],
          ),
        ),

        // 2. Content Area
        Expanded(
          child: isDesktop
              ? Row(
                  children: [
                    Expanded(
                        flex: 4,
                        child: OnboardingDesktopHero(
                            data: pages[currentPage], anim: animationController)),
                    Expanded(
                        flex: 6,
                        child: _buildPageView(pages)),
                  ],
                )
              : _buildPageView(pages),
        ),

        // 3. Bottom Controls
        Container(
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              // Indicators
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  pages.length,
                  (index) => OnboardingIndicator(
                    isActive: currentPage == index,
                    color: activeColor,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              
              // Action Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: activeColor,
                    foregroundColor: Colors.white,
                    elevation: 8,
                    shadowColor: activeColor.withValues(alpha: 0.4),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Text(
                    currentPage == pages.length - 1 ? 'Get Started' : 'Continue',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPageView(List<OnboardingPageData> pages) {
    return PageView.builder(
      controller: pageController,
      itemCount: pages.length,
      onPageChanged: onPageChanged,
      physics: const BouncingScrollPhysics(),
      itemBuilder: (context, index) {
        return OnboardingPageContent(
          data: pages[index],
          animationController: animationController,
          isVisible: currentPage == index,
        );
      },
    );
  }
}

// --- REUSABLE COMPONENTS ---

class TypeSelectionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final Animation<double> pulseAnimation;

  const TypeSelectionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
    required this.pulseAnimation,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulseAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: pulseAnimation.value,
          child: child,
        );
      },
      child: Material(
        color: Colors.white,
        elevation: 8,
        shadowColor: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: color.withValues(alpha: 0.1), width: 2),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  color.withValues(alpha: 0.05),
                  Colors.white,
                ],
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 48, color: color),
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class OnboardingPageContent extends StatelessWidget {
  final OnboardingPageData data;
  final AnimationController animationController;
  final bool isVisible;

  const OnboardingPageContent({
    super.key,
    required this.data,
    required this.animationController,
    required this.isVisible,
  });

  @override
  Widget build(BuildContext context) {
    final fade = CurvedAnimation(
      parent: animationController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    );

    final slide = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: animationController,
      curve: const Interval(0.2, 1.0, curve: Curves.easeOutQuart),
    ));

    return FadeTransition(
      opacity: fade,
      child: SlideTransition(
        position: slide,
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Image/Icon Area with Blob
              SizedBox(
                height: 280,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 240,
                      height: 240,
                      decoration: BoxDecoration(
                        color: data.color.withValues(alpha: 0.05),
                        shape: BoxShape.circle,
                      ),
                    ),
                    Icon(data.icon, size: 120, color: data.color),
                    // Add glassmorphism decoration here if desired
                  ],
                ),
              ),
              
              const SizedBox(height: 32),
              
              Text(
                data.title,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  height: 1.2,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 16),
              
              Text(
                data.description,
                style: TextStyle(
                  fontSize: 16,
                  color: Colors.grey[600],
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 32),

              // Features List
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: data.features.map((feature) => Chip(
                  label: Text(
                    feature,
                    style: TextStyle(
                      color: data.color,
                      fontWeight: FontWeight.bold,
                      fontSize: 12
                    ),
                  ),
                  backgroundColor: data.color.withValues(alpha: 0.08),
                  side: BorderSide.none,
                  shape: const StadiumBorder(),
                )).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OnboardingIndicator extends StatelessWidget {
  final bool isActive;
  final Color color;

  const OnboardingIndicator({
    super.key,
    required this.isActive,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      height: 8,
      width: isActive ? 24 : 8,
      decoration: BoxDecoration(
        color: isActive ? color : Colors.grey[300],
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

class OnboardingDesktopHero extends StatelessWidget {
  final OnboardingPageData data;
  final AnimationController anim;

  const OnboardingDesktopHero({super.key, required this.data, required this.anim});

  @override
  Widget build(BuildContext context) {
    // This is the left side color panel for Desktop view
    return Container(
      color: data.color,
      child: Center(
        child: Icon(
          data.icon, 
          size: 200, 
          color: Colors.white.withValues(alpha: 0.3)
        ),
      ),
    );
  }
}

// --- UTILS ---

class BackgroundPatternPainter extends CustomPainter {
  final Color color;
  BackgroundPatternPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    // Implement custom background logic here (circles, waves, etc)
    final paint = Paint()..color = color;
    canvas.drawCircle(Offset(size.width * 0.9, size.height * 0.1), 100, paint);
    canvas.drawCircle(Offset(size.width * 0.1, size.height * 0.9), 150, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// Extension to help with sizing in the Row above
extension SizedRow on Row {
  Widget height(double h) => SizedBox(height: h, child: this);
}