// lib/screens/shop/seller_store_screen.dart
// 💎 PREMIUM: Professional Seller Store with Products & Reels

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../../widgets/unified_search_header.dart';
import 'widgets/product_card.dart';
import '../../widgets/premium_scaffold.dart';

class SellerStoreScreen extends StatefulWidget {
  final String sellerId;

  const SellerStoreScreen({
    super.key,
    required this.sellerId,
  });

  @override
  State<SellerStoreScreen> createState() => _SellerStoreScreenState();
}

class _SellerStoreScreenState extends State<SellerStoreScreen> with SingleTickerProviderStateMixin {
  // C3 (Firebase SDK removal, 27 September 2026 review continuation): SellerModel/the Firestore
  // `sellers` collection are gone -- there is no canonical "get seller profile by id" endpoint yet
  // (only /storefront/marketplace/sellers/:siteId/follower-count exists server-side), so this
  // screen no longer claims a seller profile (business info, verification, join date) it cannot
  // honestly back. storeName is derived from this seller's own canonical products below.
  String? _storeName;
  bool _sellerFound = false;
  List<ProductModel> _products = [];
  List<Map<String, dynamic>> _reels = [];
  bool _isLoading = true;
  double _averageRating = 0;
  int _totalReviews = 0;
  final int _followersCount = 0;
  bool _isFollowing = false;
  
  TabController? _tabController;
  
  // Deal support
  final Map<String, DealModel?> _dealCache = {};
  final DealService _dealService = DealService();

  Future<DealModel?> _getDealForProduct(String productId) async {
    if (_dealCache.containsKey(productId)) {
      return _dealCache[productId];
    }
    try {
      final deal = await _dealService.getActiveDealForProduct(productId);
      _dealCache[productId] = deal;
      return deal;
    } catch (_) {
      _dealCache[productId] = null;
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadSellerData();
  }
  
  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  Future<void> _loadSellerData() async {
    try {
      final productProvider = context.read<ProductProvider>();
      await productProvider.loadProducts();

      // C3 (Firebase SDK removal): the canonical marketplaceFeed has no per-seller filter yet, so
      // this filters the already-loaded canonical feed page client-side -- same truthful-pagination
      // caveat as ProductProvider.hasMore elsewhere (a seller with listings outside the loaded page
      // will show fewer products here than they actually have, honestly, not silently show zero).
      _products = productProvider.products
          .where((p) => p.sellerId == widget.sellerId)
          .toList();

      if (_products.isNotEmpty) {
        _storeName = _products.first.storeName;
        _sellerFound = true;

        double totalRating = 0;
        int totalReviews = 0;
        for (var product in _products) {
          totalRating += product.rating * product.reviewCount;
          totalReviews += product.reviewCount;
        }
        if (totalReviews > 0) {
          _averageRating = totalRating / totalReviews;
          _totalReviews = totalReviews;
        }
      }

      // Reels: explicitly deferred (this phase's reels placeholder policy) -- no canonical reels
      // backend exists, so this stays honestly empty rather than querying a retired Firestore
      // collection. The Reels tab itself stays visible (see _buildReelsTab's empty state).
      _reels = [];

      if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      debugPrint('Error loading seller: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    if (_isLoading) {
    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      body: Column(
        children: [
          UnifiedSearchHeader(
            showBackButton: true,
            searchHint: 'Search store...',
          ),
          const Expanded(
            child: Center(child: CircularProgressIndicator()),
          ),
        ],
      ),
    );
  }

    if (!_sellerFound) {
    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      body: Column(
        children: [
          UnifiedSearchHeader(
            showBackButton: true,
            searchHint: 'Search store...',
          ),
          const Expanded(
            child: Center(child: Text('Seller not found')),
          ),
        ],
      ),
    );
  }

    return PremiumScaffold(
    // resizeToAvoidBottomInset handled internally
    // backgroundColor handled internally
    body: _tabController == null 
        ? const Center(child: CircularProgressIndicator())
        : Column(
        children: [
          // 1️⃣ Sticky Search Header
          UnifiedSearchHeader(
            showBackButton: true,
            searchHint: 'Search in ${_storeName ?? "this store"}...',
          ),
          
          // 2️⃣ Main Content
          Expanded(
            child: NestedScrollView(
              headerSliverBuilder: (context, innerBoxIsScrolled) => [
                // Seller Header Section
                SliverToBoxAdapter(
                  child: _buildSellerHeader(isDark, accentColor),
                ),
                
                // Tab Bar
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _StickyTabBarDelegate(
                    TabBar(
                      controller: _tabController,
                      indicatorColor: accentColor,
                      indicatorWeight: 3,
                      labelColor: accentColor,
                      unselectedLabelColor: isDark ? Colors.grey[500] : Colors.grey[600],
                      labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      tabs: [
                        Tab(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.grid_view_rounded, size: 18),
                              const SizedBox(width: 6),
                              Text('Products (${_products.length})'),
                            ],
                          ),
                        ),
                        Tab(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.play_circle_outline_rounded, size: 18),
                              const SizedBox(width: 6),
                              Text('Reels (${_reels.length})'),
                            ],
                          ),
                        ),
                      ],
                    ),
                    isDark: isDark,
                  ),
                ),
              ],
              body: TabBarView(
                controller: _tabController,
                children: [
                  // Products Tab
                  _buildProductsTab(isDark),
                  
                  // Reels Tab
                  _buildReelsTab(isDark, accentColor),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  // ============================================================
  // SELLER HEADER SECTION
  // ============================================================
  Widget _buildSellerHeader(bool isDark, Color accentColor) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? [const Color(0xFF1A1A1A), const Color(0xFF0D0D0D)]
              : [Colors.white, const Color(0xFFF8F8F8)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: Column(
        children: [
          // Banner + Avatar Section
          Stack(
            clipBehavior: Clip.none,
            children: [
              // Banner
              Container(
                height: 100,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [accentColor, accentColor.withValues(alpha: 0.7)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
              
              // Avatar + Basic Info Card
              Positioned(
                left: 16,
                right: 16,
                top: 50,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 20,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          // Avatar
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: accentColor, width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: accentColor.withValues(alpha: 0.3),
                                  blurRadius: 12,
                                ),
                              ],
                            ),
                            child: ClipOval(
                              // C3 (Firebase SDK removal): no canonical seller-photo source exists
                              // (see this screen's own doc comment) -- always the store fallback icon.
                              child: Container(
                                color: accentColor.withValues(alpha: 0.2),
                                child: Icon(Icons.store, color: accentColor, size: 32),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),

                          // Info
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        _storeName ?? 'Store',
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: isDark ? Colors.white : Colors.black87,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    // C3: the verified badge had no canonical successor (no
                                    // seller-profile/verification endpoint exists yet) -- dropped
                                    // rather than shown unconditionally or fabricated.
                                  ],
                                ),
                                const SizedBox(height: 4),
                                // Rating Row
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: _getRatingColor(_averageRating),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Row(
                                        children: [
                                          Text(
                                            _averageRating.toStringAsFixed(1),
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          const SizedBox(width: 2),
                                          const Icon(Icons.star_rounded, color: Colors.white, size: 12),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '$_totalReviews reviews',
                                      style: TextStyle(
                                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          
                          // Follow Button
                          _buildFollowButton(accentColor),
                        ],
                      ),
                      
                      const SizedBox(height: 16),
                      
                      // Stats Row
                      _buildStatsRow(isDark, accentColor),
                    ],
                  ),
                ),
              ),
            ],
          ),
          
          // Spacer for the card overlap
          const SizedBox(height: 120),
          
          const SizedBox(height: 12),
        ],
      ),
    );
  }
  
  Widget _buildFollowButton(Color accentColor) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        setState(() => _isFollowing = !_isFollowing);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: _isFollowing ? Colors.grey[300] : accentColor,
          borderRadius: BorderRadius.circular(20),
          boxShadow: _isFollowing ? null : [
            BoxShadow(
              color: accentColor.withValues(alpha: 0.4),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _isFollowing ? Icons.check : Icons.add,
              size: 16,
              color: _isFollowing ? Colors.black54 : Colors.white,
            ),
            const SizedBox(width: 4),
            Text(
              _isFollowing ? 'Following' : 'Follow',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: _isFollowing ? Colors.black54 : Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildStatsRow(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _buildStat('${_products.length}', 'Products', Icons.shopping_bag_outlined, isDark),
          _buildStatDivider(),
          _buildStat('$_totalReviews', 'Reviews', Icons.star_outline_rounded, isDark),
          _buildStatDivider(),
          _buildStat('${_reels.length}', 'Reels', Icons.play_circle_outline_rounded, isDark),
          // C3 (Firebase SDK removal): the "Joined" stat had no canonical successor (no
          // seller-profile endpoint carries a join date yet) -- dropped rather than fabricated.
        ],
      ),
    );
  }
  
  Widget _buildStat(String value, String label, IconData icon, bool isDark) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 12, color: isDark ? Colors.grey[500] : Colors.grey[600]),
              const SizedBox(width: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  color: isDark ? Colors.grey[500] : Colors.grey[600],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildStatDivider() {
    return Container(
      width: 1,
      height: 30,
      color: Colors.grey.withValues(alpha: 0.2),
    );
  }
  

  // ============================================================
  // PRODUCTS TAB
  // ============================================================
  Widget _buildProductsTab(bool isDark) {
    if (_products.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inventory_2_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No products available',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
      );
    }
    
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.62,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: _products.length,
      itemBuilder: (context, index) {
        return ProductCard(
          product: _products[index],
          isGridView: true,
        );
      },
    );
  }
  
  // ============================================================
  // REELS TAB
  // ============================================================
  Widget _buildReelsTab(bool isDark, Color accentColor) {
    if (_reels.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.videocam_off_outlined, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No reels available',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ),
      );
    }
    
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.56,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
      ),
      itemCount: _reels.length,
      itemBuilder: (context, index) {
        return _buildReelCard(_reels[index], isDark, accentColor);
      },
    );
  }
  
  Widget _buildReelCard(Map<String, dynamic> reel, bool isDark, Color accentColor) {
    final thumbnail = reel['thumbnailUrl'] as String? ?? '';
    final views = reel['viewCount'] as int? ?? 0;
    final likes = reel['likeCount'] as int? ?? 0;
    
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        // Navigate to reel
        Navigator.pushNamed(context, '/reels', arguments: {'reelId': reel['id']});
      },
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.grey[200],
          borderRadius: BorderRadius.circular(8),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: thumbnail.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: thumbnail,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[300],
                      ),
                      errorWidget: (_, __, ___) => Container(
                        color: isDark ? Colors.grey[800] : Colors.grey[300],
                        child: Icon(Icons.play_circle_outline, color: Colors.grey[500], size: 32),
                      ),
                    )
                  : Container(
                      color: isDark ? Colors.grey[800] : Colors.grey[300],
                      child: Icon(Icons.play_circle_outline, color: Colors.grey[500], size: 32),
                    ),
            ),
            
            // Gradient Overlay
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                gradient: LinearGradient(
                  colors: [Colors.transparent, Colors.black.withValues(alpha: 0.7)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.5, 1.0],
                ),
              ),
            ),
            
            // Play Icon
            Center(
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
              ),
            ),
            
            // Views Count
            Positioned(
              left: 6,
              bottom: 6,
              child: Row(
                children: [
                  const Icon(Icons.play_arrow, color: Colors.white, size: 12),
                  const SizedBox(width: 2),
                  Text(
                    _formatCount(views),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
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
  
  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return count.toString();
  }

  Color _getRatingColor(double rating) {
    if (rating >= 4.0) return const Color(0xFF4CAF50);
    if (rating >= 3.0) return const Color(0xFFFFC107);
    if (rating >= 2.0) return const Color(0xFFFF9800);
    return const Color(0xFFF44336);
  }
}

// ============================================================
// STICKY TAB BAR DELEGATE
// ============================================================
class _StickyTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final bool isDark;

  _StickyTabBarDelegate(this.tabBar, {required this.isDark});

  @override
  double get minExtent => tabBar.preferredSize.height + 1;

  @override
  double get maxExtent => tabBar.preferredSize.height + 1;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[200]!,
          ),
        ),
      ),
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_StickyTabBarDelegate oldDelegate) {
    return tabBar != oldDelegate.tabBar || isDark != oldDelegate.isDark;
  }
}
