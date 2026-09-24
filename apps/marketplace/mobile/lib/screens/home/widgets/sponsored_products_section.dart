// Sponsored Products Section - Vertical Product Cards with DEAL Support
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace/providers/marketplace_ad_provider.dart';

class SponsoredProductsSection extends StatefulWidget {
  const SponsoredProductsSection({super.key});

  @override
  State<SponsoredProductsSection> createState() => _SponsoredProductsSectionState();
}

class _SponsoredProductsSectionState extends State<SponsoredProductsSection> {
  // Deal cache
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
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('ad_products')
          .where('status', isEqualTo: 'active')
          .orderBy('bidAmount', descending: true)
          .limit(20)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return const SizedBox.shrink();
        }

        final adProducts = snapshot.data!.docs
            .map((doc) => AdProductModel.fromFirestore(doc))
            .where((ad) => ad.status == AdProductStatus.active)
            .toList();

        if (adProducts.isEmpty) return const SizedBox.shrink();

        return FutureBuilder<List<AdProductModel>>(
          future: _filterByCampaignValidity(adProducts),
          builder: (context, validSnapshot) {
            if (!validSnapshot.hasData || validSnapshot.data!.isEmpty) {
              return const SizedBox.shrink();
            }

            final validAds = validSnapshot.data!.take(10).toList();

            return Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              decoration: BoxDecoration(
                color: isDark 
                    ? AppColors.backgroundDark.withValues(alpha: 0.5)
                    : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark ? Colors.white10 : Colors.grey.withValues(alpha: 0.1),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSectionHeader(isDark, validAds.length),
                  
                  SizedBox(
                    height: 240, // Slightly taller for deal badge
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      physics: const BouncingScrollPhysics(),
                      itemCount: validAds.length,
                      itemBuilder: (context, index) {
                        return _buildVerticalProductCard(validAds[index], isDark, context);
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSectionHeader(bool isDark, int count) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.campaign_rounded,
              size: 18,
              color: AppColors.primary,
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
                      'Sponsored',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.black87,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'AD',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Products you may like',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.white38 : Colors.grey[500],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<List<AdProductModel>> _filterByCampaignValidity(List<AdProductModel> ads) async {
    final validAds = <AdProductModel>[];
    final now = DateTime.now();
    
    final campaignIds = ads.map((ad) => ad.campaignId).toSet();
    
    final campaignDocs = await Future.wait(
      campaignIds.map((id) => FirebaseFirestore.instance
          .collection('ad_campaigns')
          .doc(id)
          .get()),
    );
    
    final validCampaigns = <String, bool>{};
    for (final doc in campaignDocs) {
      if (!doc.exists) continue;
      
      final data = doc.data() as Map<String, dynamic>;
      final status = data['status']?.toString().toLowerCase();
      final spentToday = (data['spentToday'] as num?)?.toDouble() ?? 0;
      final dailyBudget = (data['dailyBudget'] as num?)?.toDouble() ?? 0;
      final spentTotal = (data['spentTotal'] as num?)?.toDouble() ?? 0;
      final totalBudget = (data['totalBudget'] as num?)?.toDouble() ?? 0;
      final endDateTs = data['endDate'];
      
      DateTime? endDate;
      if (endDateTs != null && endDateTs is Timestamp) {
        endDate = endDateTs.toDate();
      }
      
      final isActive = status == 'active';
      final hasDailyBudget = spentToday < dailyBudget;
      final hasTotalBudget = spentTotal < totalBudget;
      final notExpired = endDate == null || now.isBefore(endDate);
      
      validCampaigns[doc.id] = isActive && hasDailyBudget && hasTotalBudget && notExpired;
    }
    
    for (final ad in ads) {
      if (validCampaigns[ad.campaignId] == true) {
        validAds.add(ad);
      }
    }
    
    return validAds;
  }

  Widget _buildVerticalProductCard(AdProductModel adProduct, bool isDark, BuildContext context) {
    return FutureBuilder<DocumentSnapshot>(
      future: FirebaseFirestore.instance
          .collection('products')
          .doc(adProduct.productId)
          .get(),
      builder: (context, productSnapshot) {
        if (!productSnapshot.hasData || !productSnapshot.data!.exists) {
          return const SizedBox.shrink();
        }

        final product = ProductModel.fromFirestore(productSnapshot.data!);

        // Check for deal
        return FutureBuilder<DealModel?>(
          future: _getDealForProduct(product.id),
          builder: (context, dealSnapshot) {
            final deal = dealSnapshot.data;
            final hasDeal = deal != null && deal.isActive;
            
            final hasDiscount = product.originalPrice != null && product.originalPrice! > product.salePrice;
            final discountPercent = hasDeal
                ? deal.discountValue.round()
                : (hasDiscount 
                    ? (((product.originalPrice! - product.salePrice) / product.originalPrice!) * 100).round()
                    : 0);

            // Deal-specific colors
            final dealBorderColor = hasDeal 
                ? (isDark ? const Color(0xFF991B1B) : const Color(0xFFFECACA))
                : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade200);
            final dealBgColor = hasDeal
                ? (isDark ? const Color(0xFF1A0A0A) : const Color(0xFFFEF2F2))
                : (isDark ? AppColors.surfaceDark : Colors.white);

            return GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                _trackAdClick(context, adProduct);
                Navigator.pushNamed(
                  context,
                  AppRoutes.productDetails,
                  arguments: product.id,
                );
              },
              child: Container(
                width: 140,
                margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(
                  color: dealBgColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: dealBorderColor,
                    width: hasDeal ? 2 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: hasDeal 
                          ? AppColors.error.withValues(alpha: isDark ? 0.2 : 0.1)
                          : Colors.black.withValues(alpha: isDark ? 0.15 : 0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
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
                        Container(
                          height: 120,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: isDark ? Colors.grey[800] : Colors.grey[50],
                          ),
                          child: CachedNetworkImage(
                            imageUrl: product.images.isNotEmpty ? product.images.first : '',
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
                        
                        // 🔥 DEAL Badge (top-left) - Priority over AD badge
                        if (hasDeal)
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
                        else
                          // AD Badge (when no deal)
                          Positioned(
                            top: 8,
                            left: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'AD',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        
                        // Discount Badge (top-right)
                        if (hasDeal || hasDiscount)
                          Positioned(
                            top: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: hasDeal ? AppColors.error : AppColors.success,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                hasDeal ? deal.discountLabel : '$discountPercent% OFF',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
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
                              product.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white : Colors.black87,
                                height: 1.2,
                              ),
                            ),
                            const Spacer(),
                            
                            // Price Row
                            Row(
                              children: [
                                Text(
                                  '₹${(hasDeal ? deal.dealPrice : product.salePrice).toStringAsFixed(0)}',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: hasDeal ? AppColors.error : AppColors.primary,
                                  ),
                                ),
                                if (hasDeal || hasDiscount) ...[
                                  const SizedBox(width: 4),
                                  Text(
                                    '₹${(hasDeal ? deal.originalPrice : product.originalPrice!).toStringAsFixed(0)}',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w500,
                                      color: isDark ? Colors.white38 : Colors.grey[500],
                                      decoration: TextDecoration.lineThrough,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            
                            // Deal Timer
                            if (hasDeal)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.error.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.timer_rounded, size: 10, color: AppColors.error),
                                      const SizedBox(width: 2),
                                      Text(
                                        _formatDealTime(deal.timeRemaining),
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.error,
                                        ),
                                      ),
                                    ],
                                  ),
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
          },
        );
      },
    );
  }

  void _trackAdClick(BuildContext context, AdProductModel adProduct) {
    try {
      final adProvider = Provider.of<MarketplaceAdProvider>(context, listen: false);
      final userId = FirebaseAuth.instance.currentUser?.uid;
      
      adProvider.recordClickWithPlacement(
        adProduct.productId,
        AdPlacement.home,
        userId: userId,
      );
    } catch (e) {
      debugPrint('⚠️ Error tracking ad click: $e');
      try {
        FirebaseFirestore.instance
            .collection('ad_products')
            .doc(adProduct.id)
            .update({
          'clicks': FieldValue.increment(1),
        });
      } catch (_) {}
    }
  }

  String _formatDealTime(Duration duration) {
    if (duration.inDays > 0) {
      return '${duration.inDays}d left';
    } else if (duration.inHours > 0) {
      return '${duration.inHours}h left';
    } else if (duration.inMinutes > 0) {
      return '${duration.inMinutes}m left';
    } else {
      return '${duration.inSeconds}s';
    }
  }
}
