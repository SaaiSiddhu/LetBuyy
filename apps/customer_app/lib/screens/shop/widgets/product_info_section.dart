import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'dart:async';

class ProductInfoSection extends StatefulWidget {
  final ProductModel product;

  const ProductInfoSection({super.key, required this.product});

  @override
  State<ProductInfoSection> createState() => _ProductInfoSectionState();
}

class _ProductInfoSectionState extends State<ProductInfoSection> {
  DealModel? _deal;
  bool _hasCheckedDeal = false;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _checkForDeal();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkForDeal() async {
    if (_hasCheckedDeal) return;
    _hasCheckedDeal = true;
    
    try {
      final dealService = DealService();
      final deal = await dealService.getActiveDealForProduct(widget.product.id);
      if (mounted && deal != null) {
        setState(() => _deal = deal);
        // Start countdown timer
        _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
          if (mounted) setState(() {});
        });
      }
    } catch (_) {}
  }

  bool get _hasDeal => _deal != null && _deal!.isActive;

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 🔥 DEAL BANNER (if active)
          if (_hasDeal) _buildDealBanner(isDark),

          // Category & Brand
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.product.category,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Spacer(),
              Consumer<WishlistProvider>(
                builder: (context, wishlistProvider, child) {
                  final isInWishlist = wishlistProvider.isInWishlist(widget.product.id);
                  return IconButton(
                    onPressed: () async {
                      HapticFeedback.mediumImpact();
                      if (isInWishlist) {
                        await wishlistProvider.removeItem(widget.product.id);
                      } else {
                        await wishlistProvider.addItem(widget.product);
                      }
                    },
                    icon: Icon(
                      isInWishlist ? Icons.favorite : Icons.favorite_border,
                      color: isInWishlist ? AppColors.error : Colors.grey,
                    ),
                  );
                },
              ),
              IconButton(
                onPressed: () {
                  // Share functionality
                },
                icon: const Icon(Icons.share_outlined),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Product Name
          Text(
            widget.product.name,
            style: AppTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
              height: 1.3,
            ),
          ),

          const SizedBox(height: 12),

          // Rating & Reviews
          Row(
            children: [
              ...List.generate(5, (index) {
                return Icon(
                  index < widget.product.rating.floor()
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  size: 20,
                  color: Colors.amber[700],
                );
              }),
              const SizedBox(width: 8),
              Text(
                '${widget.product.rating.toStringAsFixed(1)} (${widget.product.reviewCount ?? 0} reviews)',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Price Section - Updated for deals
          _buildPriceSection(isDark),

          const SizedBox(height: 20),

          // Stock Status
          Row(
            children: [
              Icon(
                widget.product.inStock ? Icons.check_circle : Icons.cancel,
                color: widget.product.inStock ? AppColors.success : AppColors.error,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                widget.product.inStock ? 'In Stock' : 'Out of Stock',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: widget.product.inStock ? AppColors.success : AppColors.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Description
          Text(
            'Description',
            style: AppTextStyles.titleLarge.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            widget.product.description,
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  // 🔥 DEAL BANNER
  Widget _buildDealBanner(bool isDark) {
    final timeRemaining = _deal!.timeRemaining;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF450A0A), const Color(0xFF7F1D1D)]
              : [const Color(0xFFFEF2F2), const Color(0xFFFEE2E2)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark 
              ? const Color(0xFF991B1B).withValues(alpha: 0.5) 
              : const Color(0xFFFECACA),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.error.withValues(alpha: isDark ? 0.3 : 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Text('🔥', style: TextStyle(fontSize: 20)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Flash Deal',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: isDark ? Colors.white : const Color(0xFF991B1B),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'LIVE',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      _deal!.title,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? Colors.white60 : Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              // Discount Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.error, const Color(0xFFDC2626)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.error.withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  _deal!.discountLabel,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Countdown Timer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark 
                  ? Colors.black.withValues(alpha: 0.3) 
                  : Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.timer_rounded, size: 16, color: AppColors.error),
                const SizedBox(width: 8),
                Text(
                  'Ends in: ',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white70 : Colors.grey[600],
                  ),
                ),
                Text(
                  _formatCountdown(timeRemaining),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.error,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Price Section with Deal Support
  Widget _buildPriceSection(bool isDark) {
    final displayPrice = _hasDeal ? _deal!.dealPrice : widget.product.price;
    final originalPrice = _hasDeal ? _deal!.originalPrice : widget.product.originalPrice;
    final hasDiscount = originalPrice != null && originalPrice > displayPrice;
    final discountLabel = _hasDeal 
        ? _deal!.discountLabel
        : '${widget.product.discount}% OFF';

    return Row(
      children: [
        Text(
          '₹${displayPrice.toStringAsFixed(0)}',
          style: AppTextStyles.headlineMedium.copyWith(
            fontWeight: FontWeight.bold,
            color: _hasDeal ? AppColors.error : AppColors.primary,
          ),
        ),
        if (hasDiscount) ...[
          const SizedBox(width: 12),
          Text(
            '₹${originalPrice.toStringAsFixed(0)}',
            style: AppTextStyles.titleMedium.copyWith(
              decoration: TextDecoration.lineThrough,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: _hasDeal 
                  ? AppColors.error 
                  : AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              discountLabel,
              style: TextStyle(
                color: _hasDeal ? Colors.white : AppColors.error,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ],
    );
  }

  String _formatCountdown(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h ${duration.inMinutes % 60}m';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m ${duration.inSeconds % 60}s';
    } else if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m ${duration.inSeconds % 60}s';
    } else {
      return '${duration.inSeconds}s';
    }
  }
}
