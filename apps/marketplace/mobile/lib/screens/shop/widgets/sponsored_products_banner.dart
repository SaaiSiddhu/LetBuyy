// Compact Sponsored Products Banner for Product Details Screen
// Shows a tiny horizontal carousel of sponsored products at the top

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:carousel_slider/carousel_slider.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/providers/marketplace_ad_provider.dart';
import 'package:firebase_auth/firebase_auth.dart';

class SponsoredProductsBanner extends StatelessWidget {
  final String? excludeProductId; // Don't show the current product in ads
  
  const SponsoredProductsBanner({
    super.key,
    this.excludeProductId,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8F9FA),
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade200,
          ),
        ),
      ),
      child: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('ad_products')
            .where('status', isEqualTo: 'active')
            .orderBy('bidAmount', descending: true)
            .limit(10)
            .snapshots(),
        builder: (context, snapshot) {
          if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
            return const SizedBox.shrink();
          }

          final adProducts = snapshot.data!.docs
              .map((doc) => AdProductModel.fromFirestore(doc))
              .where((ad) => ad.productId != excludeProductId)
              .toList();

          if (adProducts.isEmpty) return const SizedBox.shrink();

          return Row(
            children: [
              // "Sponsored" label
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    Icon(
                      Icons.campaign_outlined,
                      size: 14,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Sponsored',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.grey[400] : Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              
              // Divider
              Container(
                width: 1,
                height: 30,
                color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade300,
              ),
              
              // Scrollable ads (Carousel)
              Expanded(
                child: CarouselSlider.builder(
                  itemCount: adProducts.length,
                  itemBuilder: (context, index, realIndex) {
                    return _buildAdItem(adProducts[index], isDark, context);
                  },
                  options: CarouselOptions(
                    height: 50,
                    viewportFraction: 1.0,
                    autoPlay: true,
                    autoPlayInterval: const Duration(seconds: 4),
                    scrollDirection: Axis.vertical, // Vertical scrolling for "ticker" effect like Amazon
                    scrollPhysics: const NeverScrollableScrollPhysics(), // Only auto-scroll
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildAdItem(AdProductModel ad, bool isDark, BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        
        // Track the click (with deduplication and placement info)
        try {
          final adProvider = Provider.of<MarketplaceAdProvider>(context, listen: false);
          final userId = FirebaseAuth.instance.currentUser?.uid;
          adProvider.recordClickWithPlacement(
            ad.productId,
            AdPlacement.productPage, // Seller sees: "Click from Product page"
            userId: userId,
          );
        } catch (e) {
          debugPrint('⚠️ Could not track sponsored click: $e');
        }
        
        // Navigate to the sponsored product with ads source for analytics
        Navigator.pushNamed(
          context,
          '/product/${ad.productId}',
          arguments: {
            'source': 'ads',
            'adCampaignId': ad.id,
          },
        );
      },
      child: Center( // Center content vertically
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(horizontal: 0, vertical: 0),
          color: Colors.transparent, // Transparent for seamless look
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Product Image
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: CachedNetworkImage(
                  imageUrl: ad.productImage ?? '',
                  width: 36,
                  height: 36,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(
                    width: 36,
                    height: 36,
                    color: isDark ? Colors.grey[800] : Colors.grey[200],
                  ),
                  errorWidget: (_, __, ___) => Container(
                    width: 36,
                    height: 36,
                    color: isDark ? Colors.grey[800] : Colors.grey[200],
                    child: Icon(Icons.image, size: 14, color: Colors.grey[400]),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              
              // Product Name
              Expanded(
                child: Text(
                  ad.productName ?? 'Product',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white70 : Colors.black87,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              
              const SizedBox(width: 4),
              
              // Arrow
              Icon(
                Icons.arrow_forward_ios,
                size: 10,
                color: isDark ? AppColors.primaryLight : AppColors.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
