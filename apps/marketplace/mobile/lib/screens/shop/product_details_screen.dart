// lib/screens/user/shop/product_details_screen.dart
// Premium Amazon/Flipkart-style Product Details Screen - REVISED

import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

// Widget imports
import 'widgets/premium_image_gallery.dart';
import 'widgets/trust_badges_widget.dart';
import 'widgets/variant_selector.dart';
import 'widgets/product_share_widget.dart';
import 'widgets/reviews_section.dart';
import 'widgets/specification_list.dart';
import 'widgets/sponsored_products_banner.dart';
import '../../widgets/premium_scaffold.dart';
import '../../widgets/unified_search_header.dart';

class ProductDetailsScreen extends StatefulWidget {
  final String productId;

  const ProductDetailsScreen({
    super.key,
    required this.productId,
  });

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  final ScrollController _scrollController = ScrollController();
  int _quantity = 1;
  bool _isInWishlist = false;
  bool _isAddingToCart = false;
  bool _showFloatingHeader = false;

  @override
  void initState() {
    super.initState();
    _loadProduct();
    _checkWishlistStatus();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    final showHeader = _scrollController.offset > 300;
    if (showHeader != _showFloatingHeader) {
      setState(() => _showFloatingHeader = showHeader);
    }
  }

  void _loadProduct() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = Provider.of<ProductProvider>(context, listen: false);
      provider.loadProductById(widget.productId);

      // Save to recently viewed
      _saveRecentlyViewed();
      
      // ✅ Track product view for seller analytics
      _incrementViewCount();
    });
  }

  /// Saves this product to the user's recently viewed list in Firestore
  Future<void> _saveRecentlyViewed() async {
    try {
      final userId = safeFirebaseUserId();
      if (userId == null) return;

      final docRef = FirebaseFirestore.instance
          .collection('recently_viewed')
          .doc(userId)
          .collection('products')
          .doc(widget.productId);

      await docRef.set({
        'productId': widget.productId,
        'viewedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      debugPrint('✅ Saved to recently viewed: ${widget.productId}');
    } catch (e) {
      debugPrint('⚠️ Error saving recently viewed: $e');
    }
  }

  /// Increments view count for this product in Firestore and tracks seller analytics
  Future<void> _incrementViewCount() async {
    try {
      // Get product to access sellerId
      final productDoc = await FirebaseFirestore.instance
          .collection('products')
          .doc(widget.productId)
          .get();
      
      if (!productDoc.exists) return;
      
      final sellerId = productDoc.data()?['sellerId'] as String?;
      
      // Increment view count on product
      await FirebaseFirestore.instance
          .collection('products')
          .doc(widget.productId)
          .update({
        'viewCount': FieldValue.increment(1),
      });
      
      // Track seller analytics with source attribution
      if (sellerId != null) {
        // Get traffic source from route arguments
        final args = ModalRoute.of(context)?.settings.arguments;
        TrafficSource source = TrafficSource.organic;
        String? adCampaignId;
        
        debugPrint('🔍 Route args type: ${args.runtimeType}, value: $args');
        
        if (args is Map<String, dynamic>) {
          final sourceStr = args['source'] as String?;
          adCampaignId = args['adCampaignId'] as String?;
          debugPrint('🔍 Parsed: sourceStr=$sourceStr, adCampaignId=$adCampaignId');
          source = AnalyticsEvent.sourceFromString(sourceStr);
        }
        
        await SellerAnalyticsService.trackProductView(
          sellerId: sellerId,
          productId: widget.productId,
          source: source,
          adCampaignId: adCampaignId,
          userId: safeFirebaseUserId(),
        );
      }
      
      debugPrint('📊 View count incremented for: ${widget.productId}');
    } catch (e) {
      debugPrint('⚠️ Error incrementing view count: $e');
    }
  }

  Future<void> _checkWishlistStatus() async {
    try {
      final wishlistProvider = Provider.of<WishlistProvider>(context, listen: false);
      final isInWishlist = wishlistProvider.isInWishlist(widget.productId);
      if (mounted) {
        setState(() => _isInWishlist = isInWishlist);
      }
    } catch (e) {
      debugPrint('Error checking wishlist: $e');
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _toggleWishlist(ProductModel product) async {
    HapticFeedback.lightImpact();
    try {
      final wishlistProvider = Provider.of<WishlistProvider>(context, listen: false);
      if (_isInWishlist) {
        await wishlistProvider.removeFromWishlist(product.id);
      } else {
        await wishlistProvider.addToWishlist(product);
      }
      if (mounted) {
        setState(() => _isInWishlist = !_isInWishlist);
      }
    } catch (e) {
      debugPrint('Error toggling wishlist: $e');
    }
  }

  Future<void> _addToCart(ProductModel product, {bool buyNow = false}) async {
    if (!product.inStock) return;
    
    HapticFeedback.mediumImpact();
    setState(() => _isAddingToCart = true);

    try {
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);

      String? variantString;
      if (product.variantOptions.isNotEmpty) {
        final selectedOptions = productProvider.selectedOptions;
        
        // Validate that all variant options have been selected
        final missingOptions = product.variantOptions
            .where((opt) => !selectedOptions.containsKey(opt.name) || selectedOptions[opt.name]!.isEmpty)
            .map((opt) => opt.name)
            .toList();
        
        if (missingOptions.isNotEmpty) {
          _showSnackBar('Please select: ${missingOptions.join(", ")}', isError: true);
          setState(() => _isAddingToCart = false);
          return;
        }
        
        // Build variant string e.g., "Size: M, Color: Red"
        variantString = selectedOptions.entries
            .map((e) => '${e.key}: ${e.value}')
            .join(', ');
      }

      // ✅ FIXED: For Buy Now, clear cart first to avoid item accumulation
      if (buyNow) {
        await cartProvider.clearCart();
      }

      await cartProvider.addToCart(product, quantity: _quantity, variant: variantString);
      
      // ✅ Track cart add for seller analytics
      await SellerAnalyticsService.trackAddToCart(
        sellerId: product.sellerId,
        productId: product.id,
        source: TrafficSource.organic,
        userId: safeFirebaseUserId(),
        quantity: _quantity,
      );

      if (buyNow) {
        Navigator.pushNamed(context, AppRoutes.checkout);
      } else {
        _showSnackBar('Added to cart!', isError: false);
      }
    } catch (e) {
      _showSnackBar('Error adding to cart', isError: true);
    } finally {
      if (mounted) {
        setState(() => _isAddingToCart = false);
      }
    }
  }

  void _showSnackBar(String message, {required bool isError}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(isError ? Icons.error_outline : Icons.check_circle_outline, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: isError ? AppColors.error : AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _showShareWidget(ProductModel product) {
    HapticFeedback.mediumImpact();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ProductShareWidget(product: product),
    );
  }

  void _navigateToProduct(ProductModel product) {
    Navigator.pushNamed(context, AppRoutes.productDetails, arguments: product.id);
  }
  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return PremiumScaffold(
      // backgroundColor handled by PremiumScaffold
      body: Consumer<ProductProvider>(
        builder: (context, productProvider, child) {
          final product = productProvider.selectedProduct;

          if (product == null || productProvider.isLoading) {
            return _buildLoadingState(isDark);
          }

          // Calculate total price based on quantity
          final totalPrice = product.salePrice * _quantity;
          final totalOriginalPrice = (product.originalPrice ?? product.salePrice) * _quantity;

          return Stack(
            children: [
              // Main Content - Column layout with sticky headers
              Column(
                children: [
                  // 1️⃣ STICKY SEARCH HEADER (Always visible at top)
                  UnifiedSearchHeader(
                    showBackButton: true,
                    searchHint: 'Search for products...',
                  ),
                  
                  // 2️⃣ STICKY SPONSORED AD CAROUSEL (Shows when scrolled)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOut,
                    height: _showFloatingHeader ? 56 : 0,
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 250),
                      opacity: _showFloatingHeader ? 1.0 : 0.0,
                      child: SponsoredProductsBanner(excludeProductId: product.id),
                    ),
                  ),
                  
                  // 3️⃣ SCROLLABLE CONTENT
                  Expanded(
                    child: CustomScrollView(
                      controller: _scrollController,
                      physics: const BouncingScrollPhysics(),
                      slivers: [
                        // Content
                        SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // 1. TOP SPONSORED ADS BANNER (Premium)
                              SponsoredProductsBanner(excludeProductId: product.id),

                              // 2. PREMIUM PRODUCT HEADER (Hero Section)
                              _buildPremiumProductHeader(product, isDark, totalPrice, totalOriginalPrice),

                              const SizedBox(height: 12),

                              // Trust Badges
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: TrustBadgesWidget(
                                  isDark: isDark,
                                  isFreeDelivery: product.isFreeDelivery ?? false,
                                  hasExpress: product.expressDelivery ?? false,
                                  isVerified: product.isVerified,
                                ),
                              ),

                              const SizedBox(height: 12),

                              // Variant Selector
                              if (product.variantOptions.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: VariantSelector(),
                                ),

                              // Quantity Selector
                              _buildQuantitySelector(product, isDark),

                              const SizedBox(height: 16),

                              // Available Coupons (REAL DATA)
                              _buildCouponsSection(isDark),

                              // === ALL VISIBLE SECTIONS (NOT ACCORDION) ===

                              const SizedBox(height: 16),

                              // 1. DELIVERY & RETURNS
                              _buildSectionCard(
                                title: 'Delivery & Returns',
                                icon: Icons.local_shipping_outlined,
                                iconColor: const Color(0xFF4CAF50),
                                isDark: isDark,
                                child: _buildDeliveryContent(product, isDark),
                              ),

                              const SizedBox(height: 12),

                              // 2. SELLER INFORMATION
                              _buildSectionCard(
                                title: 'Seller Information',
                                icon: Icons.store_outlined,
                                iconColor: const Color(0xFFFF9800),
                                isDark: isDark,
                                child: _buildSellerSection(product.sellerId, isDark),
                              ),

                              const SizedBox(height: 12),

                              // 3. PRODUCT DESCRIPTION
                              _buildSectionCard(
                                title: 'Product Description',
                                icon: Icons.description_outlined,
                                iconColor: const Color(0xFF2196F3),
                                isDark: isDark,
                                child: Text(
                                  product.description,
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.6,
                                    color: isDark ? Colors.grey[300] : Colors.grey[700],
                                  ),
                                ),
                              ),

                              const SizedBox(height: 12),

                              // 4. SPECIFICATIONS
                              if (product.specifications != null && product.specifications!.isNotEmpty)
                                _buildSectionCard(
                                  title: 'Specifications',
                                  icon: Icons.list_alt_rounded,
                                  iconColor: const Color(0xFF9C27B0),
                                  isDark: isDark,
                                  child: SpecificationList(
                                    specifications: product.specifications!,
                                    isDark: isDark,
                                  ),
                                ),

                              const SizedBox(height: 12),

                              // 5. CUSTOMER REVIEWS
                              _buildSectionCard(
                                title: 'Customer Reviews (${product.reviewCount})',
                                icon: Icons.star_outline_rounded,
                                iconColor: const Color(0xFFFFC107),
                                isDark: isDark,
                                child: SizedBox(
                                  height: 450,
                                  child: ReviewsSection(
                                    productId: product.id,
                                    productName: product.name,
                                    isDark: isDark,
                                  ),
                                ),
                              ),

                              const SizedBox(height: 16),

                              // 6. SIMILAR PRODUCTS (2 columns, up to 8 products)
                              _buildSimilarProductsSection(product, isDark),

                              // Bottom Spacing
                              const SizedBox(height: 140),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Bottom Bar
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _buildBottomBar(product, isDark, totalPrice, totalOriginalPrice),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFloatingHeader(ProductModel product, bool isDark, double totalPrice) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 8,
          left: 16,
          right: 16,
          bottom: 12,
        ),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const SizedBox(width: 8),
            // Product thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: product.primaryImage,
                width: 40,
                height: 40,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    product.name,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '₹${totalPrice.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.primaryLight : AppColors.primary,
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

  // ============ PREMIUM PRODUCT HEADER ============
  Widget _buildPremiumProductHeader(ProductModel product, bool isDark, double totalPrice, double totalOriginalPrice) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 1. IMMERSIVE IMAGE GALLERY
        Stack(
          children: [
            PremiumImageGallery(
              images: product.images,
              isDark: isDark,
              productName: product.name,
              discountPercent: product.discount,
              isNew: product.isNew,
              isTrending: product.isTrending,
            ),
            
            // Floating Action Buttons (Wishlist & Share)
            Positioned(
              bottom: 20,
              right: 20,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(30),
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                    decoration: BoxDecoration(
                      color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildCircleAction(
                          icon: _isInWishlist ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                          color: _isInWishlist ? const Color(0xFFFF4B4B) : (isDark ? Colors.white : Colors.black87),
                          onTap: () => _toggleWishlist(product),
                          isDark: isDark,
                        ),
                        const SizedBox(width: 8),
                        _buildCircleAction(
                          icon: Icons.share_rounded,
                          color: isDark ? Colors.white : Colors.black87,
                          onTap: () => _showShareWidget(product),
                          isDark: isDark,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        
        Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 2. BRAND / SELLER LINK
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Row(
                  children: [
                    _buildStoreVisitLink(product.sellerId, isDark, isDark ? Colors.grey[400]! : Colors.grey[600]!),
                    const Spacer(),
                    // Rating Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _getRatingColor(product.rating).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.star_rounded, size: 16, color: _getRatingColor(product.rating)),
                          const SizedBox(width: 4),
                          Text(
                            product.rating.toStringAsFixed(1),
                            style: TextStyle(
                              color: _getRatingColor(product.rating),
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '(${product.reviewCount})',
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.grey[500] : Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // 3. PRODUCT NAME
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: Text(
                  product.name,
                  style: TextStyle(
                    fontSize: 22, // Larger, more prominent
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    height: 1.3,
                    letterSpacing: -0.5,
                  ),
                ),
              ),

              // 4. TAGS ROW
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: _buildTagsRow(product, isDark),
              ),

              // 5. PRICE & OFFERS
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                         Text(
                          '₹${_formatPrice(totalPrice)}',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            color: isDark ? AppColors.textLight : AppColors.textPrimary,
                            letterSpacing: -1,
                          ),
                        ),
                        if (product.originalPrice != null && product.originalPrice! > product.salePrice) ...[
                          const SizedBox(width: 12),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '₹${_formatPrice(totalOriginalPrice)}',
                              style: TextStyle(
                                fontSize: 18,
                                decoration: TextDecoration.lineThrough,
                                decorationColor: isDark ? Colors.grey[500] : Colors.grey[400],
                                color: isDark ? Colors.grey[500] : Colors.grey[400],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444), // Modern red
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '-${product.discount}%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (product.reviewCount > 0)
                      Text(
                        '${_formatBoughtCount(product.reviewCount * 3)}+ bought in past month',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isDark ? const Color(0xFFFCA5A5) : const Color(0xFFDC2626), // Subtler red for credibility
                        ),
                      ),
                    
                    const SizedBox(height: 8),
                    // Stock Status
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: product.inStock ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          product.inStock ? 'In Stock' : 'Out of Stock',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: product.inStock 
                                ? (isDark ? const Color(0xFF34D399) : const Color(0xFF059669))
                                : (isDark ? const Color(0xFFF87171) : const Color(0xFFDC2626)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCircleAction({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.8),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 8,
            ),
          ],
        ),
        child: Icon(icon, size: 22, color: color),
      ),
    );
  }

  Widget _buildStoreVisitLink(String sellerId, bool isDark, Color accentColor) {
    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance.collection('sellers').doc(sellerId).get(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || !snapshot.data!.exists) {
          return const SizedBox.shrink();
        }

        final seller = SellerModel.fromMap(snapshot.data!.data() as Map<String, dynamic>, sellerId);

        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.pushNamed(context, AppRoutes.sellerStore, arguments: sellerId);
          },
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: 'Visit the ',
                    style: TextStyle(
                      fontSize: 13,
                      color: accentColor,
                    ),
                  ),
                  TextSpan(
                    text: seller.storeName,
                    style: TextStyle(
                      fontSize: 14, // Slightly larger
                      fontWeight: FontWeight.w800, // Extra bold
                      color: MediaQuery.of(context).platformBrightness == Brightness.dark ? Colors.blue[300] : Colors.blue[700], // Distinct link color
                      decoration: TextDecoration.underline, // Underline to indicate link
                      decorationColor: MediaQuery.of(context).platformBrightness == Brightness.dark ? Colors.blue[300] : Colors.blue[700],
                    ),
                  ),
                  TextSpan(
                    text: ' Store',
                    style: TextStyle(
                      fontSize: 13,
                      color: accentColor,
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

  Widget _buildTagsRow(ProductModel product, bool isDark) {
    final tags = <Widget>[];
    
    if (product.isTrending) {
      tags.add(_buildTag('Trending', const Color(0xFFFF6B35), Icons.trending_up));
    }
    if (product.isNew) {
      tags.add(_buildTag('New Arrival', const Color(0xFF2196F3), Icons.new_releases));
    }
    if (product.isFreeDelivery ?? false) {
      tags.add(_buildTag('Free Delivery', const Color(0xFF4CAF50), Icons.local_shipping));
    }
    if (product.discount >= 20) {
      tags.add(_buildTag('Limited Time Deal', const Color(0xFFCC0C39), Icons.timer));
    }
    
    if (tags.isEmpty) return const SizedBox.shrink();
    
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        children: tags,
      ),
    );
  }

  Widget _buildTag(String label, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  String _formatBoughtCount(int count) {
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(0)}K';
    } else if (count >= 100) {
      return '${(count ~/ 100) * 100}';
    } else if (count >= 50) {
      return '50';
    }
    return '10';
  }

  // Helper for Indian Pricing Format (Lakh/Crore) - e.g. 1,00,000
  String _formatPrice(double price) {
    if (price == 0) return '0';
    
    // Get integer part
    int intPrice = price.toInt();
    String priceStr = intPrice.toString();
    
    if (priceStr.length <= 3) return priceStr;
    
    String lastThree = priceStr.substring(priceStr.length - 3);
    String otherNumbers = priceStr.substring(0, priceStr.length - 3);
    
    if (otherNumbers != '') {
      lastThree = ',$lastThree';
    }
    
    // Regex to insert commas every 2 digits for Indian format
    var res = otherNumbers.replaceAllMapped(RegExp(r"\B(?=(\d{2})+(?!\d))"), (match) => ",");
    
    return res + lastThree;
  }

  Widget _buildProductInfoCard(ProductModel product, bool isDark, double totalPrice, double totalOriginalPrice) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Product Name
          Text(
            product.name,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              height: 1.3,
            ),
          ),

          const SizedBox(height: 16),

          // Price Row - Shows total based on quantity
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${totalPrice.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                ),
              ),
              if (product.originalPrice != null && product.originalPrice! > product.salePrice) ...[
                const SizedBox(width: 12),
                Text(
                  '₹${totalOriginalPrice.toStringAsFixed(0)}',
                  style: TextStyle(
                    fontSize: 18,
                    decoration: TextDecoration.lineThrough,
                    color: isDark ? AppColors.textLightHint : AppColors.textHint,
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${product.discount}% OFF',
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ],
          ),

          // Per unit price when quantity > 1
          if (_quantity > 1)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '₹${product.salePrice.toStringAsFixed(0)} × $_quantity items',
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppColors.textLightHint : AppColors.textHint,
                ),
              ),
            ),

          const SizedBox(height: 16),

          // Rating & Stock Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _getRatingColor(product.rating),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Text(
                      product.rating.toStringAsFixed(1),
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.star_rounded, color: Colors.white, size: 14),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${product.reviewCount} Reviews',
                style: TextStyle(fontSize: 14, color: isDark ? AppColors.textLightHint : AppColors.textHint),
              ),
              const Spacer(),
              if (product.inStock)
                Row(
                  children: [
                    Icon(Icons.check_circle, size: 16, color: AppColors.successLight),
                    const SizedBox(width: 4),
                    Text('In Stock', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.successLight)),
                  ],
                )
              else
                Row(
                  children: [
                    Icon(Icons.cancel, size: 16, color: AppColors.errorLight),
                    const SizedBox(width: 4),
                    Text('Out of Stock', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.errorLight)),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getRatingColor(double rating) {
    if (rating >= 4.0) return const Color(0xFF4CAF50);
    if (rating >= 3.0) return const Color(0xFFFFC107);
    if (rating >= 2.0) return const Color(0xFFFF9800);
    return const Color(0xFFF44336);
  }

  Widget _buildQuantitySelector(ProductModel product, bool isDark) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final maxQty = product.maxOrderQuantity ?? 10;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
      ),
      child: Row(
        children: [
          Icon(Icons.shopping_bag_outlined, color: accentColor, size: 22),
          const SizedBox(width: 12),
          Text(
            'Quantity',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: isDark ? AppColors.textLight : AppColors.textPrimary),
          ),
          const Spacer(),
          Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceVariant.withValues(alpha: 0.1) : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _buildQtyButton(icon: Icons.remove, onTap: _quantity > 1 ? () => setState(() => _quantity--) : null, isDark: isDark, accentColor: accentColor),
                Container(
                  width: 50,
                  alignment: Alignment.center,
                  child: Text('$_quantity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                ),
                _buildQtyButton(icon: Icons.add, onTap: _quantity < maxQty ? () => setState(() => _quantity++) : null, isDark: isDark, accentColor: accentColor),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQtyButton({required IconData icon, required VoidCallback? onTap, required bool isDark, required Color accentColor}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap != null ? () { HapticFeedback.selectionClick(); onTap(); } : null,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, size: 20, color: onTap != null ? accentColor : (isDark ? Colors.grey[600] : Colors.grey[400])),
        ),
      ),
    );
  }

  // Phase 1R corrective (C2): was Consumer<CouponProvider>. CouponProvider was entirely
  // FirebaseFirestore-backed with no canonical successor; availableCoupons was already always
  // empty (fetchAvailableCoupons() could never load anything, Firestore unreachable), so this
  // section already always rendered nothing.
  Widget _buildCouponsSection(bool isDark) {
    return const SizedBox.shrink();
  }

  Widget _buildCouponItem(CouponModel coupon, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceVariant.withValues(alpha: 0.1) : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border, style: BorderStyle.solid),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), style: BorderStyle.solid),
            ),
            child: Text(
              coupon.code,
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
                fontSize: 12,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  coupon.type == CouponType.percentage
                      ? '${coupon.discount.toInt()}% OFF'
                      : '₹${coupon.discount.toInt()} OFF',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                if (coupon.minOrderAmount > 0)
                  Text(
                    'Min. order ₹${coupon.minOrderAmount.toInt()}',
                    style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[500] : Colors.grey[600]),
                  ),
              ],
            ),
          ),
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: coupon.code));
              _showSnackBar('Coupon code copied!', isError: false);
            },
            child: const Text('COPY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required bool isDark,
    required Widget child,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 16),
              Text(
                title,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
             decoration: BoxDecoration( // Optional subtle background for content
               color: isDark ? Colors.transparent : Colors.transparent, 
               borderRadius: BorderRadius.circular(16),
             ),
             child: child
          ),
          const SizedBox(height: 24),
          Divider(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05), height: 1),
        ],
      ),
    );
  }

  Widget _buildDeliveryContent(ProductModel product, bool isDark) {
    return Column(
      children: [
        _buildDeliveryRow(Icons.local_shipping_outlined, 'Delivery', product.shippingDays ?? '3-5 days', isDark),
        const SizedBox(height: 12),
        _buildDeliveryRow(
          Icons.attach_money_rounded,
          'Shipping Fee',
          product.isFreeDelivery == true ? 'FREE' : '₹${product.shippingPrice?.toStringAsFixed(0) ?? '40'}',
          isDark,
          highlight: product.isFreeDelivery == true,
        ),
        const SizedBox(height: 12),
        _buildDeliveryRow(Icons.replay_rounded, 'Returns', '7 days easy return', isDark),
        if (product.expressDelivery == true) ...[
          const SizedBox(height: 12),
          _buildDeliveryRow(Icons.flash_on_rounded, 'Express', 'Available (${product.expressDeliveryDays ?? '1-2 days'})', isDark, highlight: true),
        ],
      ],
    );
  }

  Widget _buildDeliveryRow(IconData icon, String label, String value, bool isDark, {bool highlight = false}) {
    return Row(
      children: [
        Icon(icon, size: 18, color: highlight ? AppColors.success : (isDark ? Colors.grey[500] : Colors.grey[600])),
        const SizedBox(width: 12),
        Text(label, style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 14)),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: highlight ? AppColors.success : (isDark ? Colors.white : Colors.black87),
            fontSize: 14,
          ),
        ),
      ],
    );
  }

  Widget _buildSellerSection(String sellerId, bool isDark) {
    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance.collection('sellers').doc(sellerId).get(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || !snapshot.data!.exists) {
          return const SizedBox.shrink();
        }

        final seller = SellerModel.fromMap(snapshot.data!.data() as Map<String, dynamic>, sellerId);

        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            Navigator.pushNamed(context, AppRoutes.sellerStore, arguments: sellerId);
          },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : Colors.grey[50],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primary.withValues(alpha: 0.2),
                  ),
                  child: ClipOval(
                    child: seller.photoUrl != null
                        ? CachedNetworkImage(imageUrl: seller.photoUrl!, fit: BoxFit.cover)
                        : Icon(Icons.store, color: AppColors.primary),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            seller.storeName,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                          if (seller.isVerified) ...[
                            const SizedBox(width: 6),
                            const Icon(Icons.verified, size: 16, color: AppColors.success),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Tap to view store',
                        style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[500] : Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_ios_rounded, size: 16, color: isDark ? Colors.grey[500] : Colors.grey[400]),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSimilarProductsSection(ProductModel product, bool isDark) {
    return Consumer<ProductProvider>(
      builder: (context, productProvider, _) {
        final similarProducts = productProvider.products
            .where((p) => p.categoryId == product.categoryId && p.id != product.id && p.isActive)
            .take(8)
            .toList();

        if (similarProducts.isEmpty) return const SizedBox.shrink();

        final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Icon(Icons.grid_view_rounded, color: accentColor, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Similar Products',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      // Navigate to category page
                    },
                    child: Text('View All', style: TextStyle(color: accentColor, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.7,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: similarProducts.length > 8 ? 8 : similarProducts.length,
                itemBuilder: (context, index) => _buildSimilarProductCard(similarProducts[index], isDark),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSimilarProductCard(ProductModel product, bool isDark) {
    return GestureDetector(
      onTap: () => _navigateToProduct(product),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                  child: CachedNetworkImage(
                    imageUrl: product.primaryImage,
                    height: 120,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(height: 120, color: isDark ? Colors.grey[800] : Colors.grey[200]),
                    errorWidget: (_, __, ___) => Container(height: 120, color: isDark ? Colors.grey[800] : Colors.grey[200], child: const Icon(Icons.image_not_supported)),
                  ),
                ),
                if (product.discount > 0)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.error, borderRadius: BorderRadius.circular(4)),
                      child: Text('${product.discount}% OFF', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                  ),
              ],
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: isDark ? Colors.white : Colors.black87),
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Text('₹${product.salePrice.toStringAsFixed(0)}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                        if (product.originalPrice != null) ...[
                          const SizedBox(width: 4),
                          Text('₹${product.originalPrice!.toStringAsFixed(0)}', style: TextStyle(fontSize: 10, decoration: TextDecoration.lineThrough, color: Colors.grey[500])),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.star_rounded, color: Color(0xFFFFC107), size: 12),
                        const SizedBox(width: 4),
                        Text(product.rating.toStringAsFixed(1), style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600])),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar(ProductModel product, bool isDark, double totalPrice, double totalOriginalPrice) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      padding: EdgeInsets.only(
        left: 16, 
        right: 16, 
        top: 10, 
        bottom: bottomPadding > 0 ? bottomPadding + 4 : 10,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A).withValues(alpha: 0.98) : Colors.white.withValues(alpha: 0.98),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[200]!,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // 💰 Price Section (Compact)
            Expanded(
              flex: 3,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '₹${totalPrice.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      if (product.discount > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${product.discount}% OFF',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.green,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (product.originalPrice != null && product.originalPrice! > product.salePrice)
                    Row(
                      children: [
                        Text(
                          '₹${totalOriginalPrice.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 12,
                            decoration: TextDecoration.lineThrough,
                            color: Colors.grey[500],
                          ),
                        ),
                        if (_quantity > 1) ...[
                          const SizedBox(width: 6),
                          Text(
                            '× $_quantity',
                            style: TextStyle(
                              fontSize: 11,
                              color: isDark ? Colors.grey[400] : Colors.grey[600],
                            ),
                          ),
                        ],
                      ],
                    ),
                ],
              ),
            ),
            
            const SizedBox(width: 12),
            
            // 🛒 Add to Cart Button (Compact)
            Expanded(
              flex: 3,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: product.inStock ? () => _addToCart(product) : null,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: product.inStock ? accentColor : Colors.grey,
                        width: 1.5,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.shopping_cart_outlined,
                          color: product.inStock ? accentColor : Colors.grey,
                          size: 18,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Add',
                          style: TextStyle(
                            color: product.inStock ? accentColor : Colors.grey,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            
            const SizedBox(width: 8),
            
            // ⚡ Buy Now Button (Compact + Prominent)
            Expanded(
              flex: 4,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: product.inStock && !_isAddingToCart 
                      ? () => _addToCart(product, buyNow: true) 
                      : null,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      gradient: product.inStock
                          ? LinearGradient(
                              colors: [accentColor, accentColor.withValues(alpha: 0.85)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: product.inStock ? null : Colors.grey[400],
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: product.inStock
                          ? [
                              BoxShadow(
                                color: accentColor.withValues(alpha: 0.35),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ]
                          : null,
                    ),
                    child: _isAddingToCart
                        ? const Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            ),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(Icons.flash_on_rounded, color: Colors.white, size: 18),
                              SizedBox(width: 6),
                              Text(
                                'Buy Now',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return SafeArea(
      child: Column(
        children: [
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Icons.arrow_back_rounded, color: isDark ? Colors.white : Colors.black87)),
              ],
            ),
          ),
          const Expanded(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading product...'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
