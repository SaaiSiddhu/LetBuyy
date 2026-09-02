// Deals Section - Red-themed promotional deals on marketplace home
// OPTIMIZED: No flickering from countdown timer
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

class DealsSection extends StatefulWidget {
  const DealsSection({super.key});

  @override
  State<DealsSection> createState() => _DealsSectionState();
}

class _DealsSectionState extends State<DealsSection> {
  final DealService _dealService = DealService();
  
  // Cache deals to prevent stream refetching
  List<DealModel>? _cachedDeals;
  late Stream<List<DealModel>> _dealsStream;

  @override
  void initState() {
    super.initState();
    _dealsStream = _dealService.getActiveDeals(limit: 10);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return StreamBuilder<List<DealModel>>(
      stream: _dealsStream,
      builder: (context, snapshot) {
        // Use cached deals while stream is loading to prevent flicker
        List<DealModel> deals;
        if (snapshot.hasData && snapshot.data!.isNotEmpty) {
          deals = snapshot.data!;
          _cachedDeals = deals;
        } else if (_cachedDeals != null && _cachedDeals!.isNotEmpty) {
          deals = _cachedDeals!;
        } else {
          return const SizedBox.shrink();
        }

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          decoration: BoxDecoration(
            // RED THEME - Glassmorphic background
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [
                      const Color(0xFF450A0A).withValues(alpha: 0.8), // Dark red
                      const Color(0xFF7F1D1D).withValues(alpha: 0.6),
                    ]
                  : [
                      const Color(0xFFFEF2F2), // Light red tint
                      Colors.white,
                    ],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark 
                  ? const Color(0xFF991B1B).withValues(alpha: 0.5) 
                  : const Color(0xFFFECACA),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.error.withValues(alpha: isDark ? 0.3 : 0.1),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Premium Header with Fire Icon
              _buildSectionHeader(isDark, deals.length),
              
              // Horizontal Carousel - wrapped in RepaintBoundary
              RepaintBoundary(
                child: SizedBox(
                  height: 240,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    physics: const BouncingScrollPhysics(),
                    itemCount: deals.length,
                    itemBuilder: (context, index) {
                      // Each deal card has its own countdown timer
                      return _DealCard(deal: deals[index], isDark: isDark);
                    },
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSectionHeader(bool isDark, int count) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          // Fire Icon with Pulse Animation
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Text('🔥', style: TextStyle(fontSize: 18)),
          ),
          const SizedBox(width: 12),
          
          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        'Hot Deals',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : const Color(0xFF991B1B),
                          letterSpacing: -0.3,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'LIVE',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Limited time offers • Grab now!',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white38 : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          
          // View All Button
          TextButton(
            onPressed: () {
              // TODO: Navigate to all deals page
            },
            child: Text(
              'View All',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.error,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Separate stateful widget for each deal card with its own timer
class _DealCard extends StatefulWidget {
  final DealModel deal;
  final bool isDark;

  const _DealCard({required this.deal, required this.isDark});

  @override
  State<_DealCard> createState() => _DealCardState();
}

class _DealCardState extends State<_DealCard> {
  Timer? _countdownTimer;
  late Duration _timeRemaining;

  @override
  void initState() {
    super.initState();
    _timeRemaining = widget.deal.timeRemaining;
    // Each card manages its own countdown
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _timeRemaining = widget.deal.timeRemaining;
        });
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(
          context,
          AppRoutes.productDetails,
          arguments: widget.deal.productId,
        );
      },
      child: Container(
        width: 160,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: widget.isDark ? const Color(0xFF1A0A0A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: widget.isDark 
                ? AppColors.error.withValues(alpha: 0.3) 
                : const Color(0xFFFECACA),
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.error.withValues(alpha: widget.isDark ? 0.2 : 0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product Image with Badges
            Stack(
              children: [
                // Image
                Container(
                  height: 120,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: widget.isDark ? Colors.grey[900] : Colors.grey[50],
                  ),
                  child: CachedNetworkImage(
                    imageUrl: widget.deal.productImage,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Center(
                      child: Icon(Icons.shopping_bag_outlined, 
                        size: 32, 
                        color: Colors.grey[400],
                      ),
                    ),
                    errorWidget: (_, __, ___) => Center(
                      child: Icon(Icons.broken_image_outlined, 
                        size: 32, 
                        color: Colors.grey[400],
                      ),
                    ),
                  ),
                ),
                
                // DEAL Badge (top-left)
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.error, const Color(0xFFDC2626)],
                      ),
                      borderRadius: BorderRadius.circular(6),
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
                        const SizedBox(width: 4),
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
                
                // Discount Badge (top-right)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      widget.deal.discountLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            
            // Product Info
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Name
                    Text(
                      widget.deal.productName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: widget.isDark ? Colors.white : Colors.black87,
                        height: 1.2,
                      ),
                    ),
                    const Spacer(),
                    
                    // Price Row
                    Row(
                      children: [
                        // Deal Price
                        Text(
                          '₹${widget.deal.dealPrice.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.error,
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Original Price (strikethrough)
                        Text(
                          '₹${widget.deal.originalPrice.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                            color: widget.isDark ? Colors.white38 : Colors.grey[500],
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    
                    // Countdown Timer - only this part updates
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: widget.isDark 
                            ? AppColors.error.withValues(alpha: 0.2) 
                            : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: AppColors.error.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.timer_rounded, size: 12, color: AppColors.error),
                          const SizedBox(width: 4),
                          Text(
                            _formatCountdown(_timeRemaining),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.error,
                            ),
                          ),
                        ],
                      ),
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

  String _formatCountdown(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d ${duration.inHours % 24}h left';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h ${duration.inMinutes % 60}m left';
    } else if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m ${duration.inSeconds % 60}s left';
    } else {
      return '${duration.inSeconds}s left';
    }
  }
}
