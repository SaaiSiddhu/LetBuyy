// Banner Carousel Section - Amazon Style with Overlapping Cards
// FIXED: No flickering when banner changes
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

class BannerCarouselSection extends StatefulWidget {
  const BannerCarouselSection({super.key});

  @override
  State<BannerCarouselSection> createState() => _BannerCarouselSectionState();
}

class _BannerCarouselSectionState extends State<BannerCarouselSection>
    with SingleTickerProviderStateMixin {
  final PageController _pageController = PageController();
  
  // Use ValueNotifier to avoid full widget rebuild on page change
  final ValueNotifier<int> _currentPageNotifier = ValueNotifier<int>(0);
  
  Timer? _autoScrollTimer;
  final ScrollController _cardsScrollController = ScrollController();
  
  // Progress animation controller for the dot indicator
  late AnimationController _progressController;
  
  // Cache for recently viewed data - prevents refetching on rebuild
  List<ProductModel>? _cachedProducts;
  Stream<QuerySnapshot>? _recentlyViewedStream;

  @override
  void initState() {
    super.initState();
    _initProgressAnimation();
    _startAutoScroll();
  }

  void _initProgressAnimation() {
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );
    _progressController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _goToNextPage();
      }
    });
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _progressController.dispose();
    _pageController.dispose();
    _cardsScrollController.dispose();
    _currentPageNotifier.dispose();
    super.dispose();
  }

  void _startAutoScroll() {
    // Start the progress animation immediately
    _progressController.forward(from: 0.0);
  }

  void _goToNextPage() {
    if (!mounted) return;
    final banners = Provider.of<BannerProvider>(context, listen: false).banners;
    if (banners.isEmpty) return;
    
    final nextPage = (_currentPageNotifier.value + 1) % banners.length;
    _pageController.animateToPage(
      nextPage,
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeInOutCubic,
    );
    // Restart progress animation after page change
    _progressController.forward(from: 0.0);
  }

  void _onPageChanged(int index) {
    // Use ValueNotifier - no setState needed!
    _currentPageNotifier.value = index;
    // Restart progress animation when page changes manually
    _progressController.forward(from: 0.0);
  }

  // Standard wide banner aspect ratio: 16:9 (1920×1080px recommended)
  static const double _bannerAspectRatio = 16 / 9;
  
  // Maximum banner height - professional sizing
  static const double _maxBannerHeight = 380.0;
  static const double _minBannerHeight = 240.0;

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final userId = FirebaseAuth.instance.currentUser?.uid;
    final screenWidth = MediaQuery.of(context).size.width;

    return Consumer<BannerProvider>(
      builder: (context, bannerProvider, _) {
        final banners = bannerProvider.banners
            .where((b) => b.isActive)
            .toList()
          ..sort((a, b) => b.priority.compareTo(a.priority));

        // Fixed aspect ratio height calculation with strict limits
        final double calculatedHeight = screenWidth / _bannerAspectRatio;
        final double finalBannerHeight = calculatedHeight.clamp(_minBannerHeight, _maxBannerHeight);

        // Premium Amazon-style: Banner + overlapping full-width sheet
        const double sheetOverlap = 35.0;
        const double sheetHeaderHeight = 44.0;
        const double cardHeight = 150.0;
        final double sheetTotalHeight = cardHeight + sheetHeaderHeight;
        
        final totalHeight = finalBannerHeight + sheetTotalHeight - sheetOverlap;

        return SizedBox(
          height: totalHeight,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // 1. Premium Full-Width Banner (Smart Dynamic Height)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: finalBannerHeight,
                child: banners.isEmpty
                    ? Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: isDark 
                                ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
                                : [AppColors.primaryLight.withValues(alpha: 0.3), AppColors.primary.withValues(alpha: 0.1)],
                          ),
                        ),
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.local_offer_outlined, size: 48, color: isDark ? Colors.white24 : Colors.grey[400]),
                              const SizedBox(height: 12),
                              Text(
                                'Special offers coming soon!',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: isDark ? Colors.white38 : Colors.grey[500],
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : Stack(
                        children: [
                          // Premium Banner Slider - wrapped in RepaintBoundary
                          RepaintBoundary(
                            child: PageView.builder(
                              controller: _pageController,
                              onPageChanged: _onPageChanged,
                              itemCount: banners.length,
                              itemBuilder: (context, index) {
                                return _buildPremiumBannerImage(banners[index], isDark, index);
                              },
                            ),
                          ),
                    
                    // Premium Dots on banner - uses ValueListenableBuilder
                    Positioned(
                      bottom: 55,
                      left: 0,
                      right: 0,
                      child: ValueListenableBuilder<int>(
                        valueListenable: _currentPageNotifier,
                        builder: (context, currentPage, _) {
                          return Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(
                              banners.length,
                              (index) => _buildPremiumIndicator(index, isDark, currentPage),
                            ),
                          );
                        },
                      ),
                    ),

                    // Left navigation arrow (for web/tablet)
                    if (screenWidth > 600 && banners.length > 1)
                      Positioned(
                        left: 16,
                        top: 0,
                        bottom: 80,
                        child: Center(
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              if (_currentPageNotifier.value > 0) {
                                _pageController.previousPage(
                                  duration: const Duration(milliseconds: 400),
                                  curve: Curves.easeOutCubic,
                                );
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.7),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                              child: Icon(Icons.chevron_left, color: isDark ? Colors.white : Colors.black87, size: 28),
                            ),
                          ),
                        ),
                      ),

                    // Right navigation arrow (for web/tablet)
                    if (screenWidth > 600 && banners.length > 1)
                      Positioned(
                        right: 16,
                        top: 0,
                        bottom: 80,
                        child: Center(
                          child: GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              final bannerCount = banners.length;
                              if (_currentPageNotifier.value < bannerCount - 1) {
                                _pageController.nextPage(
                                  duration: const Duration(milliseconds: 400),
                                  curve: Curves.easeOutCubic,
                                );
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.7),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                              child: Icon(Icons.chevron_right, color: isDark ? Colors.white : Colors.black87, size: 28),
                            ),
                          ),
                        ),
                      ),
                        ],
                      ),
              ),

              // 2. Full Width Overlapping Sheet (Amazon Style) - Wrapped in RepaintBoundary
              if (userId != null)
                Positioned(
                  left: 0,
                  right: 0,
                  top: finalBannerHeight - sheetOverlap,
                  height: sheetTotalHeight,
                  child: RepaintBoundary(
                    child: Container(
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(20),
                          topRight: Radius.circular(20),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, -2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Sheet Header
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                            child: Text(
                              'Pick up where you left off',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white70 : Colors.blueGrey[700],
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          // Horizontal Cards List - uses cached stream
                          Expanded(
                            child: _RecentlyViewedWidget(
                              userId: userId,
                              isDark: isDark,
                              scrollController: _cardsScrollController,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPremiumBannerImage(BannerModel banner, bool isDark, int index) {
    return ValueListenableBuilder<int>(
      valueListenable: _currentPageNotifier,
      builder: (context, currentPage, _) {
        final isActive = index == currentPage;
        
        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            if (banner.targetRoute != null && banner.targetRoute!.isNotEmpty) {
              Navigator.pushNamed(context, banner.targetRoute!);
            }
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 350),
            curve: Curves.easeOutCubic,
            // Edge-to-edge when active, subtle margins when not
            margin: EdgeInsets.symmetric(
              horizontal: isActive ? 0 : 6,
              vertical: isActive ? 0 : 10,
            ),
            decoration: BoxDecoration(
              borderRadius: isActive ? BorderRadius.zero : BorderRadius.circular(20),
              boxShadow: isActive ? [] : [
                BoxShadow(
                  color: isDark 
                      ? Colors.black.withValues(alpha: 0.5)
                      : AppColors.primary.withValues(alpha: 0.35),
                  blurRadius: 28,
                  offset: const Offset(0, 14),
                  spreadRadius: 2,
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: isActive ? BorderRadius.zero : BorderRadius.circular(20),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Professional gradient background (visible when image doesn't fill)
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: isDark 
                            ? [const Color(0xFF1A1A2E), const Color(0xFF16213E)]
                            : [const Color(0xFFF8FAFC), const Color(0xFFE2E8F0)],
                      ),
                    ),
                  ),
                  
                  // Banner image - Contain to show full image without cropping
                  CachedNetworkImage(
                    imageUrl: banner.imageUrl,
                    fit: BoxFit.contain,
                    width: double.infinity,
                    height: double.infinity,
                    placeholder: (context, url) => Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: isDark 
                              ? [Colors.grey[850]!, Colors.grey[900]!]
                              : [AppColors.primaryLight.withValues(alpha: 0.2), AppColors.primary.withValues(alpha: 0.1)],
                        ),
                      ),
                      child: Center(
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            isDark ? Colors.white38 : AppColors.primary.withValues(alpha: 0.5),
                          ),
                        ),
                      ),
                    ),
                    errorWidget: (context, url, error) => Container(
                      color: isDark ? Colors.grey[800] : Colors.grey[200],
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.broken_image_outlined, size: 56, 
                            color: isDark ? Colors.white24 : Colors.grey[400]),
                          const SizedBox(height: 10),
                          Text('Failed to load', style: TextStyle(
                            color: isDark ? Colors.white38 : Colors.grey[500],
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          )),
                        ],
                      ),
                    ),
                  ),
                  
                  // Premium top gradient overlay (subtle vignette effect)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withValues(alpha: 0.25),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  
                  // Premium bottom gradient overlay for better dot visibility
                  Positioned(
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 120,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.55),
                          ],
                        ),
                      ),
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

  Widget _buildPremiumIndicator(int index, bool isDark, int currentPage) {
    final isActive = index == currentPage;
    final activeColor = isDark ? Colors.white : AppColors.primary;
    final inactiveColor = isDark ? Colors.white30 : Colors.black26;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        _pageController.animateToPage(
          index,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeOutCubic,
        );
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 5),
        width: isActive ? 32 : 10,
        height: 10,
        child: isActive
            ? AnimatedBuilder(
                animation: _progressController,
                builder: (context, child) {
                  return Stack(
                    children: [
                      // Background (unfilled part)
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(5),
                          color: activeColor.withValues(alpha: 0.3),
                        ),
                      ),
                      // Progress fill
                      FractionallySizedBox(
                        widthFactor: _progressController.value,
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(5),
                            color: activeColor,
                            boxShadow: [
                              BoxShadow(
                                color: activeColor.withValues(alpha: 0.6),
                                blurRadius: 8,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              )
            : Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(5),
                  color: inactiveColor,
                ),
              ),
      ),
    );
  }
}

// Separate stateful widget for recently viewed - prevents rebuilds from parent
class _RecentlyViewedWidget extends StatefulWidget {
  final String userId;
  final bool isDark;
  final ScrollController scrollController;

  const _RecentlyViewedWidget({
    required this.userId,
    required this.isDark,
    required this.scrollController,
  });

  @override
  State<_RecentlyViewedWidget> createState() => _RecentlyViewedWidgetState();
}

class _RecentlyViewedWidgetState extends State<_RecentlyViewedWidget> {
  // Cache for recently viewed products
  List<ProductModel>? _cachedProducts;
  final bool _isLoading = true;
  late Stream<QuerySnapshot> _stream;
  
  // Deal service and cache for showing deal badges
  final DealService _dealService = DealService();
  final Map<String, DealModel?> _dealsCache = {};
  bool _dealsLoaded = false;

  @override
  void initState() {
    super.initState();
    _stream = FirebaseFirestore.instance
        .collection('recently_viewed')
        .doc(widget.userId)
        .collection('products')
        .orderBy('viewedAt', descending: true)
        .limit(10)
        .snapshots();
  }

  /// Load active deals for products
  Future<void> _loadDealsForProducts(List<ProductModel> products) async {
    if (_dealsLoaded || products.isEmpty) return;
    _dealsLoaded = true;
    
    for (final product in products) {
      if (!_dealsCache.containsKey(product.id)) {
        try {
          final deal = await _dealService.getActiveDealForProduct(product.id);
          if (mounted) {
            setState(() {
              _dealsCache[product.id] = deal;
            });
          }
        } catch (e) {
          _dealsCache[product.id] = null;
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // If we have cached products, show them immediately without flicker
    if (_cachedProducts != null && _cachedProducts!.isNotEmpty) {
      // Load deals for these products
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _loadDealsForProducts(_cachedProducts!);
      });
      return _buildProductsList(_cachedProducts!, widget.isDark);
    }

    return StreamBuilder<QuerySnapshot>(
      stream: _stream,
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return const SizedBox.shrink();
        }

        final productIds = snapshot.data!.docs
            .map((doc) => doc.data() as Map<String, dynamic>)
            .map((data) => data['productId'] as String?)
            .where((id) => id != null)
            .toList();

        if (productIds.isEmpty) return const SizedBox.shrink();

        return FutureBuilder<List<ProductModel>>(
          future: _fetchProducts(productIds.cast<String>()),
          builder: (context, productsSnapshot) {
            // Show shimmer while loading (only on first load)
            if (productsSnapshot.connectionState == ConnectionState.waiting && _cachedProducts == null) {
              return _buildShimmerList(widget.isDark);
            }
            
            if (!productsSnapshot.hasData || productsSnapshot.data!.isEmpty) {
              // Show cached if available
              if (_cachedProducts != null) {
                return _buildProductsList(_cachedProducts!, widget.isDark);
              }
              return const SizedBox.shrink();
            }

            // Cache the products
            _cachedProducts = productsSnapshot.data!;
            
            // Load deals for these products
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _loadDealsForProducts(_cachedProducts!);
            });
            
            return _buildProductsList(_cachedProducts!, widget.isDark);
          },
        );
      },
    );
  }

  Widget _buildProductsList(List<ProductModel> products, bool isDark) {
    return ListView.builder(
      controller: widget.scrollController,
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      itemCount: products.length,
      physics: const BouncingScrollPhysics(),
      itemBuilder: (context, index) {
        final product = products[index];
        final deal = _dealsCache[product.id];
        return _buildKeepShoppingCard(product, isDark, deal);
      },
    );
  }

  Widget _buildShimmerList(bool isDark) {
    return ListView.builder(
      controller: widget.scrollController,
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      itemCount: 4,
      physics: const NeverScrollableScrollPhysics(),
      itemBuilder: (context, index) {
        return _buildShimmerCard(isDark);
      },
    );
  }

  // Product cache
  static final Map<String, ProductModel> _productCache = {};

  Future<List<ProductModel>> _fetchProducts(List<String> productIds) async {
    try {
      final products = <ProductModel>[];
      final idsToFetch = <String>[];
      
      // Check cache first
      for (final id in productIds.take(10)) {
        if (_productCache.containsKey(id)) {
          products.add(_productCache[id]!);
        } else {
          idsToFetch.add(id);
        }
      }
      
      // Fetch missing products in parallel
      if (idsToFetch.isNotEmpty) {
        final futures = idsToFetch.map((id) => 
          FirebaseFirestore.instance
              .collection('products')
              .doc(id)
              .get()
              .timeout(const Duration(seconds: 3), onTimeout: () {
                throw TimeoutException('Timeout fetching product $id');
              })
        );
        
        final docs = await Future.wait(futures, eagerError: false);
        
        for (final doc in docs) {
          if (doc.exists) {
            final product = ProductModel.fromFirestore(doc);
            _productCache[product.id] = product;
            products.add(product);
          }
        }
      }
      
      // Sort by original order
      products.sort((a, b) {
        final indexA = productIds.indexOf(a.id);
        final indexB = productIds.indexOf(b.id);
        return indexA.compareTo(indexB);
      });
      
      return products;
    } catch (e) {
      debugPrint('Error fetching products: $e');
      return [];
    }
  }

  Widget _buildShimmerCard(bool isDark) {
    return Container(
      width: 120,
      margin: const EdgeInsets.only(right: 10),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Expanded(
            flex: 3,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade300,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              ),
              child: Center(
                child: Icon(
                  Icons.image_outlined,
                  color: isDark ? Colors.white24 : Colors.grey.shade400,
                  size: 28,
                ),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 10,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 10,
                    width: 60,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKeepShoppingCard(ProductModel product, bool isDark, DealModel? deal) {
    final hasDeal = deal != null;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(context, AppRoutes.productDetails, arguments: product.id);
      },
      child: Container(
        width: 120,
        margin: const EdgeInsets.only(right: 10),
        decoration: BoxDecoration(
          // Red theme for deals, primary theme otherwise
          color: hasDeal
              ? (isDark 
                  ? const Color(0xFF450A0A).withValues(alpha: 0.4) 
                  : const Color(0xFFFEF2F2))
              : (isDark 
                  ? AppColors.primaryDark.withValues(alpha: 0.2)
                  : AppColors.primary.withValues(alpha: 0.08)),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: hasDeal
                ? (isDark 
                    ? AppColors.error.withValues(alpha: 0.4) 
                    : const Color(0xFFFECACA))
                : (isDark 
                    ? AppColors.primaryLight.withValues(alpha: 0.15)
                    : AppColors.primary.withValues(alpha: 0.12)),
            width: hasDeal ? 1.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: hasDeal
                  ? AppColors.error.withValues(alpha: isDark ? 0.25 : 0.15)
                  : (isDark 
                      ? AppColors.primary.withValues(alpha: 0.15)
                      : AppColors.primary.withValues(alpha: 0.1)),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with deal badge or text
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      hasDeal ? product.name : 'Keep shopping for\n${product.name}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: hasDeal ? 10 : 11,
                        fontWeight: FontWeight.w600,
                        height: 1.15,
                        color: hasDeal 
                            ? (isDark ? Colors.white : const Color(0xFF991B1B))
                            : (isDark ? Colors.white : Colors.black87),
                      ),
                    ),
                  ),
                  // Deal badge
                  if (hasDeal) ...[
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.error, const Color(0xFFDC2626)],
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🔥', style: TextStyle(fontSize: 7)),
                          const SizedBox(width: 2),
                          Text(
                            '${deal.discountPercentage}%',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 7,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            
            // Product Image
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Center(
                  child: CachedNetworkImage(
                    imageUrl: product.images.isNotEmpty ? product.images.first : '',
                    fit: BoxFit.contain,
                    placeholder: (context, url) => Container(color: isDark ? Colors.grey[800] : Colors.grey[100]),
                    errorWidget: (context, url, error) => Icon(Icons.image_not_supported, size: 24, color: Colors.grey[400]),
                  ),
                ),
              ),
            ),
            
            // Price section (only show for deals)
            if (hasDeal)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 6),
                child: Row(
                  children: [
                    Text(
                      '₹${deal.dealPrice.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: AppColors.error,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '₹${deal.originalPrice.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white38 : Colors.grey[500],
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
