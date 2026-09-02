// lib/screens/user/home/web_home_screen.dart

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

// Widget imports
import 'widgets/categories_grid.dart';
import 'widgets/sponsored_banner.dart';
import 'widgets/web_header.dart';
import 'widgets/web_footer.dart';

class WebHomeScreen extends StatefulWidget {
  const WebHomeScreen({super.key});

  @override
  State<WebHomeScreen> createState() => _WebHomeScreenState();
}

class _WebHomeScreenState extends State<WebHomeScreen>
    with TickerProviderStateMixin {
  late ScrollController _scrollController;
  late AnimationController _fabAnimationController;
  late AnimationController _sectionAnimationController;
  late AnimationController _headerAnimationController;
  late AnimationController _bgAnimController;
  late AnimationController _floatController;

  bool _showBackToTop = false;
  bool _isRefreshing = false;
  double _scrollOffset = 0;
  bool _headerCompact = false;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_onScroll);

    _fabAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _sectionAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _headerAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );

    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);

    _loadData();
  }

  void _onScroll() {
    final offset = _scrollController.offset;
    setState(() => _scrollOffset = offset);

    // Compact header on scroll
    if (offset > 100 && !_headerCompact) {
      setState(() => _headerCompact = true);
      _headerAnimationController.forward();
    } else if (offset <= 100 && _headerCompact) {
      setState(() => _headerCompact = false);
      _headerAnimationController.reverse();
    }

    // Back to top button
    if (offset > 400 && !_showBackToTop) {
      setState(() => _showBackToTop = true);
      _fabAnimationController.forward();
    } else if (offset <= 400 && _showBackToTop) {
      setState(() => _showBackToTop = false);
      _fabAnimationController.reverse();
    }
  }

  Future<void> _loadData({bool showIndicator = true}) async {
    if (!mounted || _isRefreshing) return;

    setState(() => _isRefreshing = true);

    try {
      await Future.wait([
        Provider.of<ProductProvider>(context, listen: false).loadProducts(),
        Provider.of<CategoryProvider>(context, listen: false).loadCategories(),
      ]);

      if (mounted) {
        Provider.of<CartProvider>(context, listen: false).loadCart();
        Provider.of<WishlistProvider>(context, listen: false).loadWishlist();
        _sectionAnimationController.forward(from: 0.0);

        if (showIndicator) {
          _showSnackBar('Content loaded successfully', isSuccess: true);
        }
      }
    } catch (e) {
      if (mounted && showIndicator) {
        _showSnackBar('Failed to load content', isSuccess: false);
      }
    } finally {
      if (mounted) setState(() => _isRefreshing = false);
    }
  }

  void _showSnackBar(String message, {required bool isSuccess}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                isSuccess ? Icons.check_circle : Icons.error_outline,
                color: Colors.white,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(message,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ],
          ),
          backgroundColor: isSuccess ? AppColors.success : AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: Duration(seconds: isSuccess ? 2 : 3),
          margin: const EdgeInsets.only(bottom: 70, left: 16, right: 16),
          action: !isSuccess
              ? SnackBarAction(
                  label: 'RETRY',
                  textColor: Colors.white,
                  onPressed: _loadData,
                )
              : null,
        ),
      );
  }

  void _scrollToTop() {
    _scrollController.animateTo(0,
        duration: const Duration(milliseconds: 600), curve: Curves.easeOutCubic);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _fabAnimationController.dispose();
    _sectionAnimationController.dispose();
    _headerAnimationController.dispose();
    _bgAnimController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      extendBodyBehindAppBar: false,
      appBar: const WebHeader(),
      body: Stack(
        children: [
          // Animated Background Gradient
          _buildAnimatedBackground(isDark), // Assuming this method exists elsewhere or will be added

          // Grid Pattern Overlay
          Positioned.fill(
            child: CustomPaint(painter: _GridPatternPainter(isDark: isDark)), // Assuming this class exists elsewhere or will be added
          ),

          // Floating Orbs
          ..._buildFloatingOrbs(isDark, MediaQuery.of(context).size), // Assuming this method exists elsewhere or will be added

          // Main Content
          RefreshIndicator(
            onRefresh: _loadData,
            color: AppColors.primary,
            backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
            strokeWidth: 2.5,
            child: CustomScrollView(
              controller: _scrollController,
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              slivers: [
                // Compact Hero Banner
                SliverToBoxAdapter(
                  child: _buildAnimatedSection(
                    index: 0,
                    child: _buildHeroBanner(isDark, screenWidth),
                  ),
                ),

                // Quick Categories
                SliverToBoxAdapter(
                  child: _buildAnimatedSection(
                    index: 1,
                    child: _buildQuickCategories(isDark, screenWidth),
                  ),
                ),

                // Compact Sections Grid
                SliverToBoxAdapter(
                  child: _buildAnimatedSection(
                    index: 2,
                    child: _buildCompactSections(isDark, screenWidth),
                  ),
                ),

                // Main Products Grid
                _buildProductsGrid(isDark, screenWidth),

                // Footer
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: const WebFooter(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: _buildFloatingButtons(isDark),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATED SECTION WRAPPER
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildAnimatedSection({required int index, required Widget child}) {
    final interval = Interval(
      (index * 0.08).clamp(0.0, 1.0),
      ((index + 2) * 0.08).clamp(0.0, 1.0),
      curve: Curves.easeOut,
    );

    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.03),
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: _sectionAnimationController,
        curve: interval,
      )),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: _sectionAnimationController,
          curve: interval,
        ),
        child: child,
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT HERO BANNER - Using SponsoredBanner as BannerSlider was deleted
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildHeroBanner(bool isDark, double screenWidth) {
    final maxWidth = _getMaxWidth(screenWidth);
    final parallax = (_scrollOffset * 0.25).clamp(0.0, 100.0);

    return Transform.translate(
      offset: Offset(0, parallax),
      child: Opacity(
        opacity: (1 - _scrollOffset / 500).clamp(0.0, 1.0),
        child: Center(
          child: Container(
            constraints: BoxConstraints(maxWidth: maxWidth),
            margin: EdgeInsets.fromLTRB(
              _getPadding(screenWidth),
              screenWidth > 1200 ? 20 : 16,
              _getPadding(screenWidth),
              screenWidth > 1200 ? 16 : 12,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(screenWidth > 1200 ? 20 : 16),
              child: const SponsoredBanner(),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUICK CATEGORIES - COMPACT & ELEGANT
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildQuickCategories(bool isDark, double screenWidth) {
    final maxWidth = _getMaxWidth(screenWidth);

    return Center(
      child: Container(
        constraints: BoxConstraints(maxWidth: maxWidth),
        margin: EdgeInsets.symmetric(
          horizontal: _getPadding(screenWidth),
          vertical: screenWidth > 1200 ? 16 : 12,
        ),
        child: Consumer<CategoryProvider>(
          builder: (context, categoryProvider, _) {
            if (categoryProvider.isLoading ||
                categoryProvider.allCategories.isEmpty) {
              return const SizedBox.shrink();
            }

            final categories = categoryProvider.allCategories.take(8).toList();

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionHeader('Shop by Category', isDark, screenWidth),
                const SizedBox(height: 16),
                SizedBox(
                  height: screenWidth > 1200 ? 140 : 120,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length,
                    physics: const BouncingScrollPhysics(),
                    itemBuilder: (context, index) {
                      return _CategoryChip(
                        category: categories[index],
                        isDark: isDark,
                        isLarge: screenWidth > 1200,
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT SECTIONS - Categories & Sponsored (simplified after widget cleanup)
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildCompactSections(bool isDark, double screenWidth) {
    final maxWidth = _getMaxWidth(screenWidth);
    final isDesktop = screenWidth > 1200;

    return Center(
      child: Container(
        constraints: BoxConstraints(maxWidth: maxWidth),
        margin: EdgeInsets.symmetric(
          horizontal: _getPadding(screenWidth),
          vertical: isDesktop ? 16 : 12,
        ),
        child: Column(
          children: [
            // Categories Grid
            const CategoriesGrid(),
            SizedBox(height: isDesktop ? 20 : 16),
            // Sponsored Banner
            const SponsoredBanner(),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS GRID - RESPONSIVE & COMPACT
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildProductsGrid(bool isDark, double screenWidth) {
    final crossAxisCount = screenWidth > 1800
        ? 6
        : screenWidth > 1400
            ? 5
            : screenWidth > 1200
                ? 4
                : screenWidth > 900
                    ? 3
                    : 2;

    final maxWidth = _getMaxWidth(screenWidth);
    final padding = _getPadding(screenWidth);

    return SliverPadding(
      padding: EdgeInsets.symmetric(horizontal: padding),
      sliver: Consumer<ProductProvider>(
        builder: (context, productProvider, _) {
          if (productProvider.isLoading) {
            return _buildShimmerGrid(isDark, crossAxisCount, screenWidth);
          }

          if (productProvider.products.isEmpty) {
            return SliverToBoxAdapter(
              child: _buildEmptyState(isDark, screenWidth),
            );
          }

          return SliverGrid(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              childAspectRatio: 0.68,
              crossAxisSpacing: screenWidth > 1200 ? 16 : 12,
              mainAxisSpacing: screenWidth > 1200 ? 16 : 12,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                return Center(
                  child: ConstrainedBox(
                    constraints:
                        BoxConstraints(maxWidth: maxWidth / crossAxisCount),
                    child: _ProductCard(
                      product: productProvider.products[index],
                      isDark: isDark,
                      isCompact: screenWidth <= 1200,
                    ),
                  ),
                );
              },
              childCount: productProvider.products.length,
            ),
          );
        },
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIMMER GRID
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildShimmerGrid(bool isDark, int count, double screenWidth) {
    return SliverGrid(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: count,
        childAspectRatio: 0.68,
        crossAxisSpacing: screenWidth > 1200 ? 16 : 12,
        mainAxisSpacing: screenWidth > 1200 ? 16 : 12,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, index) => _ShimmerCard(isDark: isDark),
        childCount: 12,
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildEmptyState(bool isDark, double screenWidth) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(screenWidth > 1200 ? 80.0 : 50.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: screenWidth > 1200 ? 120 : 90,
              height: screenWidth > 1200 ? 120 : 90,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.inventory_2_outlined,
                size: screenWidth > 1200 ? 60 : 45,
                color: AppColors.primary,
              ),
            ),
            SizedBox(height: screenWidth > 1200 ? 24 : 18),
            Text(
              'No Products Available',
              style: TextStyle(
                fontSize: screenWidth > 1200 ? 24 : 18,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.grey[300] : AppColors.textPrimary,
              ),
            ),
            SizedBox(height: screenWidth > 1200 ? 12 : 8),
            Text(
              'Check back later for exciting new arrivals',
              style: TextStyle(
                fontSize: screenWidth > 1200 ? 14 : 12,
                color: isDark ? Colors.grey[500] : AppColors.textSecondary,
              ),
            ),
            SizedBox(height: screenWidth > 1200 ? 24 : 18),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Refresh'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(
                  horizontal: screenWidth > 1200 ? 28 : 20,
                  vertical: screenWidth > 1200 ? 14 : 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                elevation: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOATING BUTTONS
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildFloatingButtons(bool isDark) {
    return ScaleTransition(
      scale: Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(
          parent: _fabAnimationController,
          curve: Curves.easeOutBack,
        ),
      ),
      child: FloatingActionButton(
        onPressed: _scrollToTop,
        backgroundColor: AppColors.primary,
        elevation: 4,
        mini: true,
        child: const Icon(Icons.keyboard_arrow_up, color: Colors.white, size: 24),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER - SECTION HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildSectionHeader(String title, bool isDark, double screenWidth) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 20,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: TextStyle(
            fontSize: screenWidth > 1200 ? 20 : 18,
            fontWeight: FontWeight.w800,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  double _getMaxWidth(double screenWidth) =>
      screenWidth > 1800 ? 1600.0 : screenWidth > 1400 ? 1400.0 : 1200.0;

  double _getPadding(double screenWidth) =>
      screenWidth > 1400 ? 40.0 : screenWidth > 1200 ? 32.0 : 20.0;

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATED BACKGROUND - Radial gradient that shifts over time
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(
                math.sin(_bgAnimController.value * 2 * math.pi) * 0.2,
                math.cos(_bgAnimController.value * 2 * math.pi) * 0.2,
              ),
              radius: 1.5,
              colors: isDark
                  ? [const Color(0xFF1E293B), const Color(0xFF0F172A), const Color(0xFF020617)]
                  : [const Color(0xFFF0F9FF), const Color(0xFFE0F2FE), const Color(0xFFF8FAFC)],
            ),
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOATING ORBS - Animated gradient circles for premium visual effect
  // ═══════════════════════════════════════════════════════════════════════════
  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      // Top-right orb
      Positioned(
        top: -80,
        right: -80,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, _floatController.value * 20),
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: isDark ? 0.12 : 0.08),
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.04),
                      blurRadius: 60,
                      spreadRadius: 20,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      // Bottom-left orb
      Positioned(
        bottom: 100,
        left: -60,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) {
            return Transform.translate(
              offset: Offset(0, -_floatController.value * 25),
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF8B5CF6).withValues(alpha: isDark ? 0.1 : 0.06),
                      Colors.transparent,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF8B5CF6).withValues(alpha: 0.03),
                      blurRadius: 50,
                      spreadRadius: 15,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    ];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORY CHIP - COMPACT & MODERN
// ═════════════════════════════════════════════════════════════════════════════
class _CategoryChip extends StatefulWidget {
  final dynamic category;
  final bool isDark;
  final bool isLarge;

  const _CategoryChip({
    required this.category,
    required this.isDark,
    this.isLarge = true,
  });

  @override
  State<_CategoryChip> createState() => _CategoryChipState();
}

class _CategoryChipState extends State<_CategoryChip> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final size = widget.isLarge ? 140.0 : 120.0;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: () {
          AppRoutes.navigateTo(context, AppRoutes.categories,
              arguments: widget.category.id);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: size,
          margin: const EdgeInsets.only(right: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: _isHovered
                  ? [AppColors.primary.withValues(alpha: 0.15), AppColors.primaryLight.withValues(alpha: 0.1)]
                  : [AppColors.primary.withValues(alpha: 0.08), AppColors.primaryLight.withValues(alpha: 0.04)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: _isHovered
                  ? AppColors.primary.withValues(alpha: 0.3)
                  : (widget.isDark ? Colors.grey[800]! : Colors.grey[200]!),
              width: _isHovered ? 1.5 : 1,
            ),
            boxShadow: _isHovered
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isHovered
                      ? AppColors.primary.withValues(alpha: 0.2)
                      : AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.category_outlined,
                  color: AppColors.primary,
                  size: widget.isLarge ? 28 : 24,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                widget.category.name ?? 'Category',
                style: TextStyle(
                  fontSize: widget.isLarge ? 13 : 12,
                  fontWeight: FontWeight.w700,
                  color: widget.isDark ? Colors.grey[200] : AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PRODUCT CARD - ULTRA COMPACT & PROFESSIONAL
// ═════════════════════════════════════════════════════════════════════════════
class _ProductCard extends StatefulWidget {
  final ProductModel product;
  final bool isDark;
  final bool isCompact;

  const _ProductCard({
    required this.product,
    required this.isDark,
    this.isCompact = false,
  });

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return Consumer2<CartProvider, WishlistProvider>(
      builder: (context, cartProvider, wishlistProvider, _) {
        final isInCart = cartProvider.isInCart(widget.product.id);
        final isInWishlist = wishlistProvider.isInWishlist(widget.product.id);

        return MouseRegion(
          cursor: SystemMouseCursors.click,
          onEnter: (_) => setState(() => _isHovered = true),
          onExit: (_) => setState(() => _isHovered = false),
          child: GestureDetector(
            onTap: () {
              AppRoutes.navigateTo(context, AppRoutes.productDetails,
                  arguments: widget.product.id);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              transform: _isHovered
                  ? (Matrix4.identity()..translate(0.0, -4.0, 0.0))
                  : Matrix4.identity(),
              decoration: BoxDecoration(
                color: widget.isDark ? AppColors.surfaceDark : Colors.white,
                borderRadius: BorderRadius.circular(widget.isCompact ? 14 : 16),
                border: Border.all(
                  color: _isHovered
                      ? AppColors.primary.withValues(alpha: 0.3)
                      : (widget.isDark ? Colors.grey[800]! : Colors.grey.shade200),
                  width: _isHovered ? 1.5 : 1,
                ),
                boxShadow: _isHovered
                    ? [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: widget.isDark ? 0.3 : 0.04),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Image
                  Expanded(
                    child: Stack(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            color: widget.isDark ? Colors.grey[850] : Colors.grey[50],
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(widget.isCompact ? 13 : 15),
                            ),
                            image: widget.product.imageUrl != null
                                ? DecorationImage(
                                    image: NetworkImage(widget.product.imageUrl!),
                                    fit: BoxFit.cover,
                                  )
                                : null,
                          ),
                          child: widget.product.imageUrl == null
                              ? Center(
                                  child: Icon(Icons.shopping_bag_outlined,
                                      size: 40,
                                      color: widget.isDark
                                          ? Colors.grey[700]
                                          : Colors.grey[300]),
                                )
                              : null,
                        ),

                        // Discount Badge
                        if (widget.product.discount > 0)
                          Positioned(
                            top: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [AppColors.error, AppColors.error.withValues(alpha: 0.8)],
                                ),
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.error.withValues(alpha: 0.3),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                              child: Text(
                                '-${widget.product.discount}%',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),

                        // Wishlist
                        Positioned(
                          top: 8,
                          right: 8,
                          child: GestureDetector(
                            onTap: () async {
                              if (isInWishlist) {
                                await wishlistProvider
                                    .removeItem(widget.product.id);
                              } else {
                                await wishlistProvider.addItem(widget.product);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: widget.isDark
                                    ? Colors.grey[850]
                                    : Colors.white.withValues(alpha: 0.95),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.1),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                              child: Icon(
                                isInWishlist
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                color: isInWishlist
                                    ? AppColors.error
                                    : (widget.isDark
                                        ? Colors.grey[400]
                                        : AppColors.textSecondary),
                                size: 16,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Details
                  Padding(
                    padding: EdgeInsets.all(widget.isCompact ? 10 : 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: widget.isCompact ? 13 : 14,
                            fontWeight: FontWeight.w600,
                            color: widget.isDark
                                ? Colors.grey[200]
                                : AppColors.textPrimary,
                            height: 1.2,
                          ),
                        ),
                        SizedBox(height: widget.isCompact ? 6 : 8),

                        // Rating
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            children: [
                              Icon(Icons.star, size: 14, color: Colors.amber[700]),
                              const SizedBox(width: 4),
                              Text(
                                widget.product.rating.toStringAsFixed(1),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: widget.isDark
                                      ? Colors.grey[400]
                                      : AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Price
                        Row(
                          children: [
                            Text(
                              '₹${widget.product.price.toStringAsFixed(0)}',
                              style: TextStyle(
                                fontSize: widget.isCompact ? 16 : 18,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primary,
                              ),
                            ),
                            if (widget.product.originalPrice != null &&
                                widget.product.originalPrice! >
                                    widget.product.price)
                              Padding(
                                padding: const EdgeInsets.only(left: 6),
                                child: Text(
                                  '₹${widget.product.originalPrice!.toStringAsFixed(0)}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    decoration: TextDecoration.lineThrough,
                                    color: widget.isDark
                                        ? Colors.grey[600]
                                        : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        SizedBox(height: widget.isCompact ? 8 : 10),

                        // Cart Button
                        SizedBox(
                          width: double.infinity,
                          height: widget.isCompact ? 34 : 38,
                          child: ElevatedButton(
                            onPressed: () async {
                              if (isInCart) {
                                AppRoutes.navigateTo(context, AppRoutes.cart);
                              } else {
                                await cartProvider.addItem(widget.product,
                                    quantity: 1);
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isInCart
                                  ? AppColors.success
                                  : AppColors.primary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  isInCart
                                      ? Icons.check_circle_outline
                                      : Icons.shopping_cart_outlined,
                                  size: 16,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  isInCart ? 'In Cart' : 'Add',
                                  style: TextStyle(
                                    fontSize: widget.isCompact ? 12 : 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SHIMMER CARD
// ═════════════════════════════════════════════════════════════════════════════
class _ShimmerCard extends StatelessWidget {
  final bool isDark;

  const _ShimmerCard({required this.isDark});

  @override
  Widget build(BuildContext context) {
    final shimmerColor = isDark ? Colors.grey[850]! : Colors.grey[200]!;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: shimmerColor,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(13)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 14,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: shimmerColor,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  height: 14,
                  width: 80,
                  decoration: BoxDecoration(
                    color: shimmerColor,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  height: 36,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: shimmerColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GRID PATTERN PAINTER - Subtle grid overlay for premium feel
// ═════════════════════════════════════════════════════════════════════════════
class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  final double opacity;

  _GridPatternPainter({this.isDark = false, this.opacity = 0.1});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withValues(alpha: opacity)
      ..strokeWidth = 0.5;

    const double gridSize = 50;

    for (double x = 0; x < size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    for (double y = 0; y < size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
