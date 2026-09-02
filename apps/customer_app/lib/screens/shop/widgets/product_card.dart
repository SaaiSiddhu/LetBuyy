// lib/screens/shop/widgets/product_card.dart
// 💎 PREMIUM: Ultra-Professional Product Card with DEAL Support
// Grid View: Flipkart Style | List View: Amazon Style

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

import '../../../providers/marketplace_ad_provider.dart';

/// Ultra-Professional Product Card with Deal Support
/// - Grid View: Flipkart-inspired compact card
/// - List View: Amazon-inspired horizontal card
/// - Red theme when product has an active deal
class ProductCard extends StatefulWidget {
  final ProductModel product;
  final bool isGridView;
  final VoidCallback? onTap;
  final DealModel? deal; // Optional preloaded deal
  final bool isSponsored; // Whether this card is a sponsored ad
  final String? source; // Traffic source for analytics (organic, search, category, ads, recommendation)
  final String? adCampaignId; // Campaign ID for ads source

  const ProductCard({
    super.key,
    required this.product,
    this.isGridView = true,
    this.onTap,
    this.deal,
    this.isSponsored = false,
    this.source,
    this.adCampaignId,
  });

  @override
  State<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<ProductCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  
  DealModel? _deal;
  bool _hasCheckedDeal = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 120),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    
    // Use preloaded deal if available
    _deal = widget.deal;
    if (_deal == null) {
      _checkForDeal();
    } else {
      _hasCheckedDeal = true;
    }
  }

  Future<void> _checkForDeal() async {
    if (_hasCheckedDeal) return;
    _hasCheckedDeal = true;
    
    try {
      final dealService = DealService();
      final deal = await dealService.getActiveDealForProduct(widget.product.id);
      if (mounted && deal != null) {
        setState(() => _deal = deal);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails _) => _controller.forward();
  void _onTapUp(TapUpDetails _) => _controller.reverse();
  void _onTapCancel() => _controller.reverse();

  void _onTap() {
    HapticFeedback.lightImpact();
    _trackSponsoredClick();
    
    // Call onTap callback if provided (for extra actions like ad click tracking)
    widget.onTap?.call();
    
    // Determine source for analytics
    final source = widget.source ?? (widget.isSponsored ? 'ads' : 'organic');
    debugPrint('🔍 ProductCard._onTap: source=$source, widget.source=${widget.source}, isSponsored=${widget.isSponsored}, campaignId=${widget.adCampaignId}');
    
    // Always navigate with source attribution for analytics
    Navigator.pushNamed(
      context,
      '/product/${widget.product.id}',
      arguments: {
        'source': source,
        if (widget.adCampaignId != null) 'adCampaignId': widget.adCampaignId,
      },
    );
  }

  void _trackSponsoredClick() {
    try {
      final adProvider = Provider.of<MarketplaceAdProvider>(context, listen: false);
      if (adProvider.isSponsored(widget.product.id)) {
        final userId = FirebaseAuth.instance.currentUser?.uid;
        adProvider.recordClick(widget.product.id, userId: userId);
      }
    } catch (_) {}
  }

  bool _isSponsored() {
    // Use widget param first, fallback to checking ad provider
    if (widget.isSponsored) return true;
    try {
      final adProvider = Provider.of<MarketplaceAdProvider>(context, listen: false);
      return adProvider.isSponsored(widget.product.id);
    } catch (_) {
      return false;
    }
  }

  bool get _hasDeal => _deal != null && _deal!.isActive;

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    // 🚀 WEB OPTIMIZATION: Wrap in RepaintBoundary to isolate repaints
    return RepaintBoundary(
      child: Consumer<WishlistProvider>(
        builder: (context, wishlistProvider, _) {
          final isInWishlist = wishlistProvider.isInWishlist(widget.product.id);
          
          final cardWidget = widget.isGridView
              ? _buildGridCard(isDark, isInWishlist, wishlistProvider)
              : _buildListCard(isDark, isInWishlist, wishlistProvider);
          
          return GestureDetector(
            onTapDown: kIsWeb ? null : _onTapDown,
            onTapUp: kIsWeb ? null : _onTapUp,
            onTapCancel: kIsWeb ? null : _onTapCancel,
            onTap: _onTap,
            // 🚀 WEB OPTIMIZATION: Skip ScaleTransition on web (causes lag)
            child: kIsWeb 
                ? cardWidget 
                : ScaleTransition(
                    scale: _scaleAnimation,
                    child: cardWidget,
                  ),
          );
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // GRID VIEW (Flipkart Style) - WITH DEAL SUPPORT
  // ---------------------------------------------------------------------------
  Widget _buildGridCard(bool isDark, bool isInWishlist, WishlistProvider wishlistProvider) {
    final discount = widget.product.discount;
    final isSponsored = _isSponsored();
    final hasDiscount = widget.product.originalPrice != null &&
        widget.product.originalPrice! > widget.product.price;
    final isFreeDelivery = widget.product.isFreeDelivery ?? false;
    
    // Deal-specific colors (RED theme)
    final dealBorderColor = _hasDeal 
        ? (isDark ? const Color(0xFF991B1B) : const Color(0xFFFECACA))
        : Colors.transparent;
    final dealBgTint = _hasDeal
        ? (isDark ? const Color(0xFF1A0A0A) : const Color(0xFFFEF2F2))
        : null;
    
    // Sponsored cards: NO special border - just AD badge (removed golden theme)
    // Only deals get special border treatment
    final hasBorder = _hasDeal;
    final borderColor = dealBorderColor;
    final bgTint = dealBgTint;

    return Container(
      decoration: BoxDecoration(
        color: bgTint ?? (isDark ? const Color(0xFF1E293B) : Colors.white),
        border: Border(
          right: BorderSide(
            color: hasBorder 
                ? borderColor 
                : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.15)),
            width: hasBorder ? 2 : 0.5,
          ),
          bottom: BorderSide(
            color: hasBorder 
                ? borderColor 
                : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.15)),
            width: hasBorder ? 2 : 0.5,
          ),
          left: hasBorder ? BorderSide(color: borderColor, width: 2) : BorderSide.none,
          top: hasBorder ? BorderSide(color: borderColor, width: 2) : BorderSide.none,
        ),
      ),
       child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // --- Image Section (80%) ---
          Expanded(
            flex: 8,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Image
                ClipRRect(
                  child: Container(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                    child: widget.product.imageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: widget.product.imageUrl!,
                            fit: BoxFit.contain,
                            placeholder: (_, __) => _buildImagePlaceholder(isDark),
                            errorWidget: (_, __, ___) => _buildImagePlaceholder(isDark),
                          )
                        : _buildImagePlaceholder(isDark),
                  ),
                ),

                // Wishlist Button (Bottom Right of image)
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: _buildWishlistButton(isDark, isInWishlist, wishlistProvider),
                ),

                // AD Badge (Top Right) - Premium Glassmorphic Style
                if (isSponsored && !_hasDeal)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.campaign_outlined, color: Colors.white, size: 10),
                          SizedBox(width: 3),
                          Text(
                            'AD',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // 🔥 DEAL Badge (Top Left) - RED THEME
                if (_hasDeal)
                  Positioned(
                    top: 8,
                    left: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.error, const Color(0xFFDC2626)],
                        ),
                        borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.error.withValues(alpha: 0.4),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('🔥', style: TextStyle(fontSize: 10)),
                          const SizedBox(width: 3),
                          Text(
                            'DEAL',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                // Regular Discount Badge (if no deal)
                else if (discount > 0)
                  Positioned(
                    top: 8,
                    left: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        borderRadius: BorderRadius.horizontal(right: Radius.circular(4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_downward_rounded, color: Colors.white, size: 9),
                          const SizedBox(width: 2),
                          Text(
                            '$discount%',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Deal Discount Badge (Top Right near wishlist)
                if (_hasDeal)
                  Positioned(
                    top: 8,
                    right: 44,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        _deal!.discountLabel,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),

                // Out of Stock Overlay
                if (widget.product.stock == 0)
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.6),
                      child: const Center(
                        child: Text(
                          'OUT OF STOCK',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // --- Content Section (20%) ---
          Expanded(
            flex: 3,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Title
                  Flexible(
                    child: Text(
                      widget.product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white.withValues(alpha: 0.9) : Colors.black87,
                      ),
                    ),
                  ),
                  
                  // Price Row - Show deal price if active
                  Row(
                    children: [
                      Text(
                        '₹${_formatPrice(_hasDeal ? _deal!.dealPrice : widget.product.price)}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: _hasDeal ? AppColors.error : (isDark ? Colors.white : Colors.black),
                        ),
                      ),
                      if (_hasDeal || hasDiscount) ...[
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            '₹${_formatPrice(_hasDeal ? _deal!.originalPrice : widget.product.originalPrice!)}',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 10,
                              decoration: TextDecoration.lineThrough,
                              color: isDark ? Colors.grey[500] : Colors.grey[600],
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      // Compact star rating
                      if (widget.product.rating > 0) ...[
                        const Icon(Icons.star_rounded, color: Color(0xFFFFC107), size: 11),
                        const SizedBox(width: 2),
                        Text(
                          widget.product.rating.toStringAsFixed(1),
                          style: TextStyle(fontSize: 10, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                        ),
                      ],
                    ],
                  ),
                  
                  // Badges Row
                  Row(
                    children: [
                      // Deal timer badge
                      if (_hasDeal)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          margin: const EdgeInsets.only(right: 4),
                          decoration: BoxDecoration(
                            color: AppColors.error.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(3),
                            border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.timer_rounded, size: 9, color: AppColors.error),
                              const SizedBox(width: 2),
                              Text(
                                _formatDealTime(_deal!.timeRemaining),
                                style: TextStyle(fontSize: 7, color: AppColors.error, fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        )
                      else if (widget.product.isVerified)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          margin: const EdgeInsets.only(right: 4),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Color(0xFF10B981), Color(0xFF059669)]),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified_rounded, color: Colors.white, size: 9),
                              SizedBox(width: 2),
                              Text('LetBuyy', style: TextStyle(fontSize: 7, color: Colors.white, fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      if (isFreeDelivery && !_hasDeal)
                        Text(
                          'Free Delivery',
                          style: TextStyle(fontSize: 8, color: const Color(0xFF10B981), fontWeight: FontWeight.w600),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // LIST VIEW (Amazon Style) - WITH DEAL SUPPORT
  // ---------------------------------------------------------------------------
  Widget _buildListCard(bool isDark, bool isInWishlist, WishlistProvider wishlistProvider) {
    final discount = widget.product.discount;
    final hasDiscount = widget.product.originalPrice != null &&
        widget.product.originalPrice! > widget.product.price;
    final isFreeDelivery = widget.product.isFreeDelivery ?? false;
    final isSponsored = _isSponsored();
    
    // Deal-specific colors (RED theme)
    final dealBorderColor = _hasDeal 
        ? (isDark ? const Color(0xFF991B1B) : const Color(0xFFFECACA))
        : Colors.transparent;
    
    // Sponsored cards: NO special border - just AD badge (removed golden theme)
    // Only deals get special border treatment
    final hasBorder = _hasDeal;
    final borderColor = dealBorderColor;
    final bgColor = _hasDeal 
        ? (isDark ? const Color(0xFF1A0505) : const Color(0xFFFEF2F2))
        : (isDark ? const Color(0xFF1E293B) : Colors.white);

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        border: hasBorder
            ? Border.all(color: borderColor, width: 2)
            : Border(
                bottom: BorderSide(
                  color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.12),
                  width: 1,
                ),
              ),
        borderRadius: hasBorder ? BorderRadius.circular(12) : null,
      ),
      margin: hasBorder ? const EdgeInsets.symmetric(horizontal: 8, vertical: 4) : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // --- Image Section (Left) ---
          SizedBox(
            width: 140,
            height: 180,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Image
                ClipRRect(
                  borderRadius: _hasDeal 
                      ? const BorderRadius.only(topLeft: Radius.circular(10), bottomLeft: Radius.circular(10))
                      : BorderRadius.zero,
                  child: Container(
                    color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                    child: widget.product.imageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: widget.product.imageUrl!,
                            fit: BoxFit.contain,
                            placeholder: (_, __) => _buildImagePlaceholder(isDark),
                            errorWidget: (_, __, ___) => _buildImagePlaceholder(isDark),
                          )
                        : _buildImagePlaceholder(isDark),
                  ),
                ),

                // 🔥 DEAL Badge
                if (_hasDeal)
                  Positioned(
                    top: 8,
                    left: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.error, const Color(0xFFDC2626)],
                        ),
                        borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.error.withValues(alpha: 0.4),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('🔥', style: TextStyle(fontSize: 10)),
                          SizedBox(width: 3),
                          Text(
                            'DEAL',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Wishlist (Bottom Left)
                Positioned(
                  bottom: 4,
                  left: 4,
                  child: _buildWishlistButton(isDark, isInWishlist, wishlistProvider, small: true),
                ),

                // LetBuyy Choice Badge (if not deal)
                if (widget.product.isVerified && !_hasDeal)
                  Positioned(
                    bottom: 0,
                    left: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1A3848),
                        borderRadius: BorderRadius.only(topRight: Radius.circular(3)),
                      ),
                      child: const Text(
                        "LetBuyy's Choice",
                        style: TextStyle(color: Colors.white, fontSize: 7, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),

                // Out of Stock
                if (widget.product.stock == 0)
                  Positioned.fill(
                    child: Container(
                      color: Colors.black.withValues(alpha: 0.5),
                      child: const Center(
                        child: Text('OUT OF STOCK', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // --- Content Section (Right) ---
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Sponsored or Deal indicator
                  if (_hasDeal)
                    Container(
                      margin: const EdgeInsets.only(bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.timer_rounded, size: 12, color: AppColors.error),
                          const SizedBox(width: 4),
                          Text(
                            'Ends in ${_formatDealTime(_deal!.timeRemaining)}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.error,
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (isSponsored)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        'Sponsored',
                        style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                      ),
                    ),

                  // Product Title
                  Text(
                    widget.product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      height: 1.2,
                      color: isDark ? Colors.white : const Color(0xFF0F1111),
                    ),
                  ),

                  // Star Rating Row
                  if (widget.product.rating > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(
                        children: [
                          Text(
                            widget.product.rating.toStringAsFixed(1),
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : AppColors.primary),
                          ),
                          const SizedBox(width: 3),
                          ...List.generate(5, (index) {
                            final starValue = index + 1;
                            if (widget.product.rating >= starValue) {
                              return const Icon(Icons.star_rounded, color: Color(0xFFFFA41C), size: 14);
                            } else if (widget.product.rating >= starValue - 0.5) {
                              return const Icon(Icons.star_half_rounded, color: Color(0xFFFFA41C), size: 14);
                            } else {
                              return Icon(Icons.star_outline_rounded, color: Colors.grey[400], size: 14);
                            }
                          }),
                          Text(
                            ' (${_formatCount(widget.product.reviewCount)})',
                            style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : AppColors.primary),
                          ),
                        ],
                      ),
                    ),

                  // Deal badge or Limited time deal badge
                  if (_hasDeal)
                    Container(
                      margin: const EdgeInsets.only(top: 5),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.error, const Color(0xFFDC2626)],
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${_deal!.discountLabel} OFF',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                    )
                  else if (discount > 15)
                    Container(
                      margin: const EdgeInsets.only(top: 5),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFCC0C39),
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: const Text(
                        'Limited time deal',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600),
                      ),
                    ),

                  // Price Row
                  Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '₹',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: _hasDeal ? AppColors.error : (isDark ? Colors.white : Colors.black),
                          ),
                        ),
                        Text(
                          _formatPrice(_hasDeal ? _deal!.dealPrice : widget.product.price),
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w500,
                            color: _hasDeal ? AppColors.error : (isDark ? Colors.white : Colors.black),
                          ),
                        ),
                        if (_hasDeal || hasDiscount) ...[
                          const SizedBox(width: 6),
                          Text(
                            'M.R.P: ₹${_formatPrice(_hasDeal ? _deal!.originalPrice : widget.product.originalPrice!)}',
                            style: TextStyle(fontSize: 12, decoration: TextDecoration.lineThrough, color: isDark ? Colors.grey[500] : Colors.grey[600]),
                          ),
                          if (!_hasDeal) ...[
                            const SizedBox(width: 4),
                            Text('($discount% off)', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFCC0C39))),
                          ],
                        ],
                      ],
                    ),
                  ),

                  // Delivery Info
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text.rich(
                      TextSpan(
                        style: TextStyle(fontSize: 12, color: isDark ? Colors.white70 : Colors.black87),
                        children: [
                          if (isFreeDelivery)
                            const TextSpan(text: 'FREE delivery ', style: TextStyle(fontWeight: FontWeight.w700)),
                          TextSpan(
                            text: widget.product.shippingDays ?? 'Tomorrow',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Add to Cart Button
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: SizedBox(
                      width: double.infinity,
                      height: 34,
                      child: ElevatedButton(
                        onPressed: widget.product.stock == 0 ? null : () {
                          HapticFeedback.mediumImpact();
                          Provider.of<CartProvider>(context, listen: false).addItem(widget.product);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Added to cart'),
                              duration: const Duration(seconds: 1),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _hasDeal ? AppColors.error : const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          padding: EdgeInsets.zero,
                        ),
                        child: Text(
                          _hasDeal ? '🔥 Grab Deal' : 'Add to cart',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
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

  // ---------------------------------------------------------------------------
  // SHARED WIDGETS
  // ---------------------------------------------------------------------------

  Widget _buildWishlistButton(bool isDark, bool isInWishlist, WishlistProvider provider, {bool small = false}) {
    final size = small ? 28.0 : 34.0;
    final iconSize = small ? 14.0 : 18.0;

    return GestureDetector(
      onTap: () async {
        HapticFeedback.mediumImpact();
        if (isInWishlist) {
          await provider.removeItem(widget.product.id);
        } else {
          await provider.addItem(widget.product);
        }
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.85),
          shape: BoxShape.circle,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 6)],
        ),
        child: Icon(
          isInWishlist ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          color: isInWishlist ? AppColors.error : (isDark ? Colors.grey[400] : Colors.grey[500]),
          size: iconSize,
        ),
      ),
    );
  }

  Widget _buildImagePlaceholder(bool isDark) {
    return Center(
      child: Icon(
        Icons.image_outlined,
        size: 36,
        color: isDark ? Colors.grey[700] : Colors.grey[300],
      ),
    );
  }

  String _formatPrice(double price) {
    final intPrice = price.toInt();
    if (intPrice < 1000) return intPrice.toString();
    
    final str = intPrice.toString();
    final len = str.length;
    
    if (len <= 3) return str;
    
    final lastThree = str.substring(len - 3);
    final remaining = str.substring(0, len - 3);
    
    String formatted = '';
    for (int i = remaining.length - 1; i >= 0; i--) {
      formatted = remaining[i] + formatted;
      if ((remaining.length - i) % 2 == 0 && i != 0) {
        formatted = ',$formatted';
      }
    }
    
    return '$formatted,$lastThree';
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(count >= 10000 ? 0 : 1)}K';
    return count.toString();
  }

  String _formatDealTime(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m';
    } else if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m';
    } else {
      return '${duration.inSeconds}s';
    }
  }
}
