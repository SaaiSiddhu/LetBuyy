// Compact Professional Product Card - Flipkart Style with DEAL Support
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../../../providers/marketplace_ad_provider.dart';

/// Compact, professional product card inspired by Flipkart's design
/// Features: Minimal badges, prominent pricing, subtle animations, DEAL support
class CompactProductCard extends StatefulWidget {
  final ProductModel product;
  final VoidCallback? onTap;
  final double? width;
  final double? height;
  final bool showAddToCart;
  final DealModel? deal; // Optional preloaded deal
  final String? source; // Traffic source for analytics
  final String? adCampaignId; // Campaign ID for ads source

  const CompactProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.width,
    this.height,
    this.showAddToCart = true,
    this.deal,
    this.source,
    this.adCampaignId,
  });

  @override
  State<CompactProductCard> createState() => _CompactProductCardState();
}

class _CompactProductCardState extends State<CompactProductCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  bool _isPressed = false;
  
  DealModel? _deal;
  bool _hasCheckedDeal = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 150),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.96).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    
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

  bool get _hasDeal => _deal != null && _deal!.isActive;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    setState(() => _isPressed = true);
    _controller.forward();
  }

  void _onTapUp(TapUpDetails details) {
    setState(() => _isPressed = false);
    _controller.reverse();
  }

  void _onTapCancel() {
    setState(() => _isPressed = false);
    _controller.reverse();
  }

  void _onTap() {
    HapticFeedback.lightImpact();
    _trackSponsoredClick();
    
    // Call onTap callback if provided (for extra actions like ad click tracking)
    widget.onTap?.call();
    
    // Always navigate with source attribution for analytics
    Navigator.pushNamed(
      context,
      '/product/${widget.product.id}',
      arguments: {
        'source': widget.source ?? 'organic',
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
    } catch (e) {}
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    // Deal-specific colors
    final dealBorderColor = _hasDeal 
        ? (isDark ? const Color(0xFF991B1B) : const Color(0xFFFECACA))
        : null;
    final dealBgColor = _hasDeal
        ? (isDark ? const Color(0xFF1A0A0A) : const Color(0xFFFEF2F2))
        : null;

    return Consumer<WishlistProvider>(
      builder: (context, wishlistProvider, child) {
        final isInWishlist = wishlistProvider.isInWishlist(widget.product.id);

        return GestureDetector(
          onTapDown: _onTapDown,
          onTapUp: _onTapUp,
          onTapCancel: _onTapCancel,
          onTap: _onTap,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: Container(
              width: widget.width,
              height: widget.height,
              decoration: BoxDecoration(
                color: dealBgColor ?? (isDark ? const Color(0xFF1E1E1E) : Colors.white),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: dealBorderColor ?? (isDark 
                      ? Colors.white.withValues(alpha: 0.06) 
                      : Colors.grey.withValues(alpha: 0.12)),
                  width: _hasDeal ? 2 : 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: _hasDeal 
                        ? AppColors.error.withValues(alpha: isDark ? 0.2 : 0.1)
                        : (isDark 
                            ? Colors.black.withValues(alpha: 0.3) 
                            : Colors.black.withValues(alpha: 0.04)),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Image Section
                  _buildImageSection(isDark, isInWishlist, wishlistProvider),
                  
                  // Content Section
                  Expanded(
                    child: _buildContentSection(isDark),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildImageSection(bool isDark, bool isInWishlist, WishlistProvider wishlistProvider) {
    final discount = widget.product.discount ?? 0;
    final isSponsored = _isSponsored();

    return Expanded(
      flex: 3,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Product Image
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Container(
              color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF8F8F8),
              child: widget.product.imageUrl != null
                  ? CachedNetworkImage(
                      imageUrl: widget.product.imageUrl!,
                      fit: BoxFit.contain,
                      placeholder: (context, url) => _buildPlaceholder(isDark),
                      errorWidget: (context, url, error) => _buildPlaceholder(isDark),
                    )
                  : _buildPlaceholder(isDark),
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
                      _deal!.discountLabel,
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
          // Regular Discount Badge
          else if (discount > 0)
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF388E3C),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '$discount% off',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),

          // Sponsored Badge (hidden when deal is active)
          if (isSponsored && !_hasDeal)
            Positioned(
              top: discount > 0 ? 32 : 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: const Text(
                  'Ad',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

          // Top Right - Wishlist
          Positioned(
            top: 6,
            right: 6,
            child: GestureDetector(
              onTap: () async {
                HapticFeedback.mediumImpact();
                if (isInWishlist) {
                  await wishlistProvider.removeItem(widget.product.id);
                } else {
                  await wishlistProvider.addItem(widget.product);
                }
              },
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.85),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 4,
                    ),
                  ],
                ),
                child: Icon(
                  isInWishlist ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: isInWishlist ? AppColors.error : (isDark ? Colors.grey[400] : Colors.grey[600]),
                  size: 18,
                ),
              ),
            ),
          ),

          // Out of Stock Overlay
          if (widget.product.stock == 0)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.error,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'OUT OF STOCK',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildContentSection(bool isDark) {
    final originalPrice = widget.product.originalPrice;
    final hasDiscount = originalPrice != null && originalPrice > widget.product.price;
    final isFreeDelivery = widget.product.isFreeDelivery ?? false;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Product Name
          Flexible(
            flex: 2,
            child: Text(
              widget.product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                height: 1.2,
                color: isDark ? Colors.white.withValues(alpha: 0.9) : Colors.black87,
              ),
            ),
          ),

          const SizedBox(height: 2),

          // Rating (if exists)
          if (widget.product.rating > 0)
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: _getRatingColor(widget.product.rating),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.product.rating.toStringAsFixed(1),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(Icons.star_rounded, color: Colors.white, size: 8),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  '(${_formatCount(widget.product.reviewCount)})',
                  style: TextStyle(
                    fontSize: 9,
                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                  ),
                ),
              ],
            ),

          const SizedBox(height: 2),

          // Price Row - Show deal price if active
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '₹${_formatPrice(_hasDeal ? _deal!.dealPrice : widget.product.price)}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: _hasDeal ? AppColors.error : (isDark ? Colors.white : Colors.black),
                ),
              ),
              if (_hasDeal || hasDiscount) ...[
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    '₹${_formatPrice(_hasDeal ? _deal!.originalPrice : originalPrice!)}',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      decoration: TextDecoration.lineThrough,
                      decorationColor: isDark ? Colors.grey[500] : Colors.grey[500],
                      color: isDark ? Colors.grey[500] : Colors.grey[500],
                    ),
                  ),
                ),
              ],
            ],
          ),
          
          // Deal Timer or Delivery Info
          if (_hasDeal)
            Container(
              margin: const EdgeInsets.only(top: 2),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
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
                    style: TextStyle(
                      fontSize: 8,
                      color: AppColors.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            )
          else if (isFreeDelivery)
            Text(
              'Free Delivery',
              style: TextStyle(
                fontSize: 9,
                color: const Color(0xFF388E3C),
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPlaceholder(bool isDark) {
    return Center(
      child: Icon(
        Icons.image_outlined,
        size: 40,
        color: isDark ? Colors.grey[700] : Colors.grey[300],
      ),
    );
  }

  Color _getRatingColor(double rating) {
    if (rating >= 4.0) return const Color(0xFF388E3C); // Green
    if (rating >= 3.0) return const Color(0xFFFF9800); // Orange
    return const Color(0xFFF44336); // Red
  }

  String _formatPrice(double price) {
    if (price >= 10000000) {
      return '${(price / 10000000).toStringAsFixed(1)}Cr';
    } else if (price >= 100000) {
      return '${(price / 100000).toStringAsFixed(1)}L';
    } else if (price >= 1000) {
      return '${(price / 1000).toStringAsFixed(price % 1000 == 0 ? 0 : 1)}K';
    }
    return price.toStringAsFixed(0);
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(count >= 10000 ? 0 : 1)}K';
    }
    return count.toString();
  }

  String _formatDealTime(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h left';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m left';
    } else if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m left';
    } else {
      return '${duration.inSeconds}s left';
    }
  }

  bool _isSponsored() {
    try {
      final adProvider = Provider.of<MarketplaceAdProvider>(context, listen: false);
      return adProvider.isSponsored(widget.product.id);
    } catch (e) {
      return false;
    }
  }
}
