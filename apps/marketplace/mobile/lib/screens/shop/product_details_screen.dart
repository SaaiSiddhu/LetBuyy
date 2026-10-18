// lib/screens/user/shop/product_details_screen.dart
// Premium Amazon/Flipkart-style Product Details Screen - REVISED

import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../../data/marketplace_repository.dart';
import '../profile/buyer_rewards_screen.dart';

// Widget imports
import 'widgets/premium_image_gallery.dart';
import 'widgets/trust_badges_widget.dart';
import 'widgets/variant_selector.dart';
import 'widgets/product_share_widget.dart';
import 'widgets/reviews_section.dart';
import 'widgets/specification_list.dart';
import 'widgets/sponsored_products_banner.dart';
import 'widgets/product_origin_disclosure.dart';
import '../../widgets/premium_scaffold.dart';
import '../../widgets/unified_search_header.dart';

class ProductDetailsScreen extends StatefulWidget {
  final String productId;

  const ProductDetailsScreen({
    super.key,
    required this.productId
  });

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  final ScrollController _scrollController = ScrollController();
  int _quantity = 1;
  bool _isAddingToCart = false;
  bool _showFloatingHeader = false;
  String? _canonicalCountryOfOrigin;

  @override
  void initState() {
    super.initState();
    _loadProduct();
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
      provider.clearError();
      // Recently-viewed tracking already happens inside loadProductById (local, canonical) --
      // see ProductProvider.addToRecentlyViewed's own call site there.
      unawaited(_loadProductAndRevalidateFeed(provider));
      _loadCanonicalProductDisclosure();
    });
  }

  Future<void> _loadProductAndRevalidateFeed(ProductProvider provider) async {
    await provider.loadProductById(widget.productId);
    if (!mounted || provider.selectedProduct == null) return;

    // Similar-product cards are derived from the shared feed, so refresh it after the
    // directly linked listing has been confirmed by the canonical detail endpoint.
    await provider.loadProducts(forceReload: true);
  }

  Future<void> _loadCanonicalProductDisclosure() async {
    try {
      final listing = await context.read<MarketplaceRepository>().listing(
        widget.productId
      );
      if (!mounted) return;
      setState(() => _canonicalCountryOfOrigin = listing?.countryOfOrigin);
    } catch (error) {
      // The product provider owns the existing detail-load error state. Keep its importer field
      // visible if available and omit origin when this supplemental canonical read is unavailable.
      debugPrint(
        'Could not load marketplace product-origin disclosure: $error'
      );
    }
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): _saveRecentlyViewed()
  // (Firestore `recently_viewed` collection) and _incrementViewCount() (Firestore product
  // view-count increment + SellerAnalyticsService.trackProductView) both deleted. Neither has a
  // canonical successor -- there is no gateway endpoint for either concern -- and both were
  // redundant/silently-failing: recently-viewed is already handled locally by ProductProvider
  // (see _loadProduct above), and the seller-analytics write never once succeeded (see
  // seller_analytics_service.dart's own deletion, same pass: it was the sole caller-reachable
  // consumer of AnalyticsEvent, now also deleted).

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _toggleWishlist(ProductModel product) async {
    final provider = context.read<WishlistProvider>();
    if (provider.isLoading) return;
    final revision = provider.identityRevision;
    HapticFeedback.lightImpact();
    final saved = await provider.toggleItem(product);
    if (!mounted || revision != provider.identityRevision) return;
    if (!saved) _showSnackBar('Could not save your wishlist', isError: true);
  }

  Future<void> _addToCart(ProductModel product, {bool buyNow = false}) async {
    if (!product.inStock) return;
    
    HapticFeedback.mediumImpact();
    setState(() => _isAddingToCart = true);

    try {
      final productProvider = Provider.of<ProductProvider>(context, listen: false,);
      final cartProvider = Provider.of<CartProvider>(context, listen: false);
      final identityRevision = cartProvider.identityRevision;

      String? variantString;
      if (product.variantOptions.isNotEmpty) {
        final selectedOptions = productProvider.selectedOptions;
        
        // Validate that all variant options have been selected
        final missingOptions = product.variantOptions
            .where((opt) => !selectedOptions.containsKey(opt.name) || selectedOptions[opt.name]!.isEmpty,)
            .map((opt) => opt.name)
            .toList();
        
        if (missingOptions.isNotEmpty) {
          _showSnackBar('Please select: ${missingOptions.join(", ")}', isError: true,);
          setState(() => _isAddingToCart = false);
          return;
        }
        
        // Build variant string e.g., "Size: M, Color: Red"
        variantString = selectedOptions.entries
            .map((e) => '${e.key}: ${e.value}')
            .join(', ');
      }

      // Buy Now replaces the cart in the same captured-identity write. A
      // clear-then-add pair could switch buyers between its two awaits.

      // C3 (Firebase SDK removal, 27 September 2026 review finding 5): was
      // `await cartProvider.addToCart(...)` with the result discarded, then an unconditional
      // success/navigation below -- back when CartProvider always failed (no userId ever
      // available), this showed "Added to cart!" and, for Buy Now, opened checkout on an empty
      // cart every single time. CartProvider is now a real local cart, so this checks addItem's
      // actual result rather than assuming it.
      final added = await cartProvider.addItem(product, quantity: _quantity, variant: variantString,
        variantId: productProvider.selectedVariant?.id, replaceExisting: buyNow,);
      if (!mounted || identityRevision != cartProvider.identityRevision) return;
      if (!added) {
        _showSnackBar('Could not add to cart', isError: true);
        return;
      }

      // C3 (Firebase SDK removal): SellerAnalyticsService.trackAddToCart deleted -- see this
      // screen's own _loadProduct doc comment; the write never once succeeded.

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
            Icon(isError ? Icons.error_outline : Icons.check_circle_outline, color: Colors.white,),
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
    Navigator.pushNamed(context, AppRoutes.productDetails, arguments: product.id,);
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

          if (product == null && productProvider.isLoading) {
            return _buildLoadingState(isDark);
          }
          if (product == null) {
            return _buildUnavailableState(
              isDark,
              loadFailed: productProvider.error != null,
            );
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
                      child: SponsoredProductsBanner(excludeProductId: product.id,),
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
                              SponsoredProductsBanner(excludeProductId: product.id,),

                              // 2. PREMIUM PRODUCT HEADER (Hero Section)
                              _buildPremiumProductHeader(product, isDark, totalPrice, totalOriginalPrice,),

                              const SizedBox(height: 12),

                              // Trust Badges
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16,),
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
                                  padding: const EdgeInsets.symmetric(horizontal: 16,),
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
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    _buildSellerSection(product.sellerId, product.storeName, isDark),
                                    TextButton.icon(
                                      icon: const Icon(Icons.stars_outlined),
                                      label: const Text('Seller rewards'),
                                      onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                                        builder: (_) => BuyerRewardsScreen(
                                          siteId: product.sellerId,
                                          storeName: product.storeName ?? 'This seller',
                                        ),
                                      )),
                                    ),
                                  ],
                                ),
                              ),

                              const SizedBox(height: 12),

                              // 3. PRODUCT DESCRIPTION
                              if (product.description.isNotEmpty)
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
                                  )
                                ),

                              ProductOriginDisclosure(
                                countryOfOrigin:
                                    _canonicalCountryOfOrigin ??
                                    product.countryOfOrigin,
                                importerDetails: product.importerDetails,
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
                              // C2 (canonical rewire): reviewCount has no canonical successor yet
                              // (see ProductProvider's doc comment) and stays at its honest default
                              // of 0 -- dropped from this heading rather than shown as "(0)" next to
                              // ReviewsSection's own "reviews aren't available yet" empty state.
                              _buildSectionCard(
                                title: 'Customer Reviews',
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
                child: _buildBottomBar(product, isDark, totalPrice, totalOriginalPrice,),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildFloatingHeader(ProductModel product, bool isDark, double totalPrice,) {
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
  Widget _buildPremiumProductHeader(ProductModel product, bool isDark, double totalPrice, double totalOriginalPrice,) {
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
              discountPercent: product.marketplaceListingId == null
                  ? product.discount
                  : null,
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
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6,),
                    decoration: BoxDecoration(
                      color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.2,),
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Consumer<WishlistProvider>(builder: (context, wishlist, _) {
                          final saved = wishlist.isInWishlist(product.id);
                          return Tooltip(
                            message: saved ? 'Remove from wishlist' : 'Save to wishlist',
                            child: _buildCircleAction(
                              icon: saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                              color: saved ? const Color(0xFFFF4B4B) : (isDark ? Colors.white : Colors.black87),
                              onTap: () => _toggleWishlist(product),
                              isDark: isDark,
                            ),
                          );
                        }),
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
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24),),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 2. BRAND / SELLER LINK
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Row(
                  children: [
                    _buildStoreVisitLink(product.sellerId, product.storeName, isDark, isDark ? Colors.grey[400]! : Colors.grey[600]!,),
                    const Spacer(),
                    // Rating Badge -- C2 (canonical rewire): rating has no canonical successor yet
                    // and stays at ProductModel's honest default of 0.0 (see ProductProvider's doc
                    // comment); hidden rather than shown as "★ 0.0 (0)" on every product, matching
                    // product_card.dart's existing `if (product.rating > 0)` guard.
                    if (product.rating > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6,),
                        decoration: BoxDecoration(
                          color: _getRatingColor(product.rating,).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 16, color: _getRatingColor(product.rating),),
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
                        if (product.hasDisplayableReferencePrice) ...[
                          const SizedBox(width: 12),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '${product.hasPriorThirtyDayLow ? '30-day low ' : ''}₹${_formatPrice(totalOriginalPrice)}',
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
                          if (product.marketplaceListingId == null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4,),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444), // Modern red
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                                product.discountLabel,
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
                          color: isDark ? const Color(0xFFFCA5A5) : const Color(0xFFDC2626,), // Subtler red for credibility
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

  // C2 (canonical rewire): the same raw, unguarded FirebaseFirestore.instance().get() as
  // _buildSellerSection above, at a second call site -- see that method's doc comment for why this
  // was a live, unconditional crash risk. Replaced the same way, with product.storeName.
  Widget _buildStoreVisitLink(String sellerId, String? storeName, bool isDark, Color accentColor,) {
    if (storeName == null || storeName.isEmpty) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(context, AppRoutes.sellerStore, arguments: sellerId,);
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
                  color: accentColor
                ),
              ),
              TextSpan(
                text: storeName,
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
                  color: accentColor
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTagsRow(ProductModel product, bool isDark) {
    final tags = <Widget>[];
    
    if (product.isTrending) {
      tags.add(_buildTag('Trending', const Color(0xFFFF6B35), Icons.trending_up),);
    }
    if (product.isNew) {
      tags.add(_buildTag('New Arrival', const Color(0xFF2196F3), Icons.new_releases),);
    }
    if (product.isFreeDelivery ?? false) {
      tags.add(_buildTag('Free Delivery', const Color(0xFF4CAF50), Icons.local_shipping,),);
    }
    if (product.discount >= 20 && product.marketplaceListingId == null) {
      tags.add(_buildTag('Limited Time Deal', const Color(0xFFCC0C39), Icons.timer),);
    }
    
    if (tags.isEmpty) return const SizedBox.shrink();
    
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        children: tags
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
    var res = otherNumbers.replaceAllMapped(RegExp(r"\B(?=(\d{2})+(?!\d))"), (match) => ",",);
    
    return res + lastThree;
  }

  Widget _buildProductInfoCard(ProductModel product, bool isDark, double totalPrice, double totalOriginalPrice,) {
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
              if (product.hasDisplayableReferencePrice) ...[
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
                if (product.marketplaceListingId == null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5,),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                      product.discountLabel,
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold,),
                  ),
                ),
              ],
            ]
          ),

          if (product.hasPriorThirtyDayLow)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${product.referencePriceLabel}: ₹${totalOriginalPrice.toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? AppColors.textLightHint : AppColors.textHint
                )
              ),
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

          // Rating & Stock Row -- C2 (canonical rewire): rating/reviewCount have no canonical
          // successor yet and stay at ProductModel's honest defaults (see ProductProvider's doc
          // comment); hidden rather than shown as "0.0 ★" / "0 Reviews" on every product.
          Row(
            children: [
              if (product.rating > 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6,),
                  decoration: BoxDecoration(
                    color: _getRatingColor(product.rating),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Text(
                        product.rating.toStringAsFixed(1),
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold,),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.star_rounded, color: Colors.white, size: 14,),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${product.reviewCount} Reviews',
                  style: TextStyle(fontSize: 14, color: isDark ? AppColors.textLightHint : AppColors.textHint,),
                ),
              ],
              const Spacer(),
              if (product.inStock)
                Row(
                  children: [
                    Icon(Icons.check_circle, size: 16, color: AppColors.successLight,),
                    const SizedBox(width: 4),
                    Text('In Stock', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.successLight,),),
                  ],
                )
              else
                Row(
                  children: [
                    Icon(Icons.cancel, size: 16, color: AppColors.errorLight),
                    const SizedBox(width: 4),
                    Text('Out of Stock', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.errorLight,),),
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
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border,),
      ),
      child: Row(
        children: [
          Icon(Icons.shopping_bag_outlined, color: accentColor, size: 22),
          const SizedBox(width: 12),
          Text(
            'Quantity',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: isDark ? AppColors.textLight : AppColors.textPrimary,),
          ),
          const Spacer(),
          Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceVariant.withValues(alpha: 0.1) : AppColors.surfaceVariant,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                _buildQtyButton(icon: Icons.remove, onTap: _quantity > 1 ? () => setState(() => _quantity--) : null, isDark: isDark, accentColor: accentColor,),
                Container(
                  width: 50,
                  alignment: Alignment.center,
                  child: Text('$_quantity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87,),),
                ),
                _buildQtyButton(icon: Icons.add, onTap: _quantity < maxQty ? () => setState(() => _quantity++) : null, isDark: isDark, accentColor: accentColor,),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQtyButton({required IconData icon, required VoidCallback? onTap, required bool isDark, required Color accentColor,}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap != null ? () { HapticFeedback.selectionClick(); onTap(); } : null,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, size: 20, color: onTap != null ? accentColor : (isDark ? Colors.grey[600] : Colors.grey[400]),),
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
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border, style: BorderStyle.solid,),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3), style: BorderStyle.solid,),
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
                    style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[500] : Colors.grey[600],),
                  ),
              ],
            ),
          ),
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: coupon.code));
              _showSnackBar('Coupon code copied!', isError: false);
            },
            child: const Text('COPY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),),
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
             child: child,
          ),
          const SizedBox(height: 24),
          Divider(color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05,), height: 1,),
        ],
      ),
    );
  }

  Widget _buildDeliveryContent(ProductModel product, bool isDark) {
    return Column(
      children: [
        _buildDeliveryRow(Icons.local_shipping_outlined, 'Delivery', product.shippingDays ?? '3-5 days', isDark,),
        const SizedBox(height: 12),
        _buildDeliveryRow(
          Icons.attach_money_rounded,
          'Shipping Fee',
          product.isFreeDelivery == true ? 'FREE' : '₹${product.shippingPrice?.toStringAsFixed(0) ?? '40'}',
          isDark,
          highlight: product.isFreeDelivery == true,
        ),
        const SizedBox(height: 12),
        _buildDeliveryRow(Icons.replay_rounded, 'Returns', '7 days easy return', isDark,),
        if (product.expressDelivery == true) ...[
          const SizedBox(height: 12),
          _buildDeliveryRow(Icons.flash_on_rounded, 'Express', 'Available (${product.expressDeliveryDays ?? '1-2 days'})', isDark, highlight: true,),
        ],
      ],
    );
  }

  Widget _buildDeliveryRow(IconData icon, String label, String value, bool isDark, {bool highlight = false,}) {
    return Row(
      children: [
        Icon(icon, size: 18, color: highlight ? AppColors.success : (isDark ? Colors.grey[500] : Colors.grey[600]),),
        const SizedBox(width: 12),
        Text(label, style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 14,),),
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

  // C2 (canonical rewire): this built a raw, unguarded FirebaseFirestore.instance().get() as a
  // FutureBuilder's `future:` argument -- evaluated synchronously during build(), unconditionally,
  // on this screen's always-rendered "Seller Information" card. FirebaseFirestore.instance throws
  // synchronously with no Firebase app initialized (confirmed empirically elsewhere this phase),
  // so this threw on every visit to any product's detail page, this app's most-visited screen --
  // not contained by a try/catch the way an async method's Firestore call would be, since nothing
  // here was inside one. Replaced with product.storeName, which the canonical marketplace feed/
  // listing endpoints already hand back directly (see ProductProvider's doc comments) -- no photo
  // or seller-verified flag exists on that canonical shape yet, so this card now shows a generic
  // store icon and no verified badge rather than inventing either.
  Widget _buildSellerSection(String sellerId, String? storeName, bool isDark) {
    if (storeName == null || storeName.isEmpty) return const SizedBox.shrink();

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(context, AppRoutes.sellerStore, arguments: sellerId,);
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
                child: Icon(Icons.store, color: AppColors.primary),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    storeName,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap to view store',
                    style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[500] : Colors.grey[600],),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, size: 16, color: isDark ? Colors.grey[500] : Colors.grey[400],),
          ],
        ),
      ),
    );
  }

  Widget _buildSimilarProductsSection(ProductModel product, bool isDark) {
    return Consumer<ProductProvider>(
      builder: (context, productProvider, _) {
        final similarProducts = productProvider.products
            .where((p) => p.categoryId == product.categoryId && p.id != product.id && p.isActive,)
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
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87,),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      // Navigate to category page
                    },
                    child: Text('View All', style: TextStyle(color: accentColor, fontWeight: FontWeight.w600,),),
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
            BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2),),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12),),
                  child: CachedNetworkImage(
                    imageUrl: product.primaryImage,
                    height: 120,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(height: 120, color: isDark ? Colors.grey[800] : Colors.grey[200],),
                    errorWidget: (_, __, ___) => Container(height: 120, color: isDark ? Colors.grey[800] : Colors.grey[200], child: const Icon(Icons.image_not_supported),),
                  ),
                ),
                if (product.discount > 0 &&
                    product.marketplaceListingId == null)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3,),
                      decoration: BoxDecoration(color: AppColors.error, borderRadius: BorderRadius.circular(4),),
                      child: Text(
                        product.discountLabel, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold,),),
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
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: isDark ? Colors.white : Colors.black87,),
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Text('₹${product.salePrice.toStringAsFixed(0)}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87,),),
                        if (product.hasDisplayableReferencePrice) ...[
                          const SizedBox(width: 4),
                          Text(
                            '${product.hasPriorThirtyDayLow ? '30d low ' : 'M.R.P. '}₹${product.originalPrice!.toStringAsFixed(0)}', style: TextStyle(fontSize: 10, decoration: TextDecoration.lineThrough, color: Colors.grey[500],),),
                        ],
                      ],
                    ),
                    // C2 (canonical rewire): rating has no canonical successor yet (see
                    // ProductProvider's doc comment); hidden rather than shown as "★ 0.0".
                    if (product.rating > 0) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, color: Color(0xFFFFC107), size: 12,),
                          const SizedBox(width: 4),
                          Text(product.rating.toStringAsFixed(1), style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600],),),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar(ProductModel product, bool isDark, double totalPrice, double totalOriginalPrice,) {
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
                      if (product.discount > 0 &&
                          product.marketplaceListingId == null) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2,),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            product.discountLabel,
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
                  if (product.hasDisplayableReferencePrice)
                    Row(
                      children: [
                        Text(
                          '${product.hasPriorThirtyDayLow ? '30d low ' : 'M.R.P. '}₹${totalOriginalPrice.toStringAsFixed(0)}',
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
                  // C5 corrective (found via this session's own device testing): unlike the Buy
                  // Now button beside it, this onTap had no !_isAddingToCart guard, so a fast
                  // double-tap could fire _addToCart twice before the first await returned,
                  // adding _quantity to the cart twice. _isAddingToCart is set synchronously at
                  // the top of _addToCart, before any await, so this guard is race-free.
                  onTap: product.inStock && !_isAddingToCart ? () => _addToCart(product) : null,
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
                              colors: [accentColor, accentColor.withValues(alpha: 0.85),],
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
                              Icon(Icons.flash_on_rounded, color: Colors.white, size: 18,),
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
                IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Icons.arrow_back_rounded, color: isDark ? Colors.white : Colors.black87,),),
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

  Widget _buildUnavailableState(bool isDark, {required bool loadFailed}) {
    final foreground = isDark ? Colors.white : Colors.black87;
    return SafeArea(
      child: Column(
        children: [
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.maybePop(context),
                  icon: Icon(Icons.arrow_back_rounded, color: foreground),
                ),
              ],
            ),
          ),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      loadFailed
                          ? Icons.cloud_off_outlined
                          : Icons.inventory_2_outlined,
                      size: 52,
                      color: foreground.withValues(alpha: 0.55),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      loadFailed
                          ? 'Could not load this product'
                          : 'This product is no longer available',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: foreground,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      loadFailed
                          ? 'Check your connection and try again.'
                          : 'This marketplace listing may have been removed or is no longer public.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: foreground.withValues(alpha: 0.7),
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (loadFailed)
                      OutlinedButton.icon(
                        onPressed: _loadProduct,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Try again'),
                      )
                    else
                      FilledButton.icon(
                        onPressed: () =>
                            Navigator.pushNamed(context, AppRoutes.shop),
                        icon: const Icon(Icons.storefront_outlined),
                        label: const Text('Browse products'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

}
