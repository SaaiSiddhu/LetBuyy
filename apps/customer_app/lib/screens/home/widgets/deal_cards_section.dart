// Deal Cards Section - Products with highest views
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

class DealCardsSection extends StatelessWidget {
  const DealCardsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 20,
                    decoration: BoxDecoration(
                      color: AppColors.warning,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Trending Deals 🔥',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, AppRoutes.shop),
                child: Text(
                  'See All',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark ? AppColors.primaryLight : AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Deal Cards - Products with highest views
        SizedBox(
          height: 160,
          child: _buildDealsStream(isDark, context),
        ),
      ],
    );
  }

  Widget _buildDealsStream(bool isDark, BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('products')
          .where('approvalStatus', isEqualTo: 'approved')
          .where('inStock', isEqualTo: true)
          .orderBy('viewCount', descending: true)
          .limit(10)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator(strokeWidth: 2));
        }

        final products = snapshot.data!.docs
            .map((doc) => ProductModel.fromFirestore(doc))
            .where((p) => p.discount > 0) // Only show products with discount
            .toList();

        if (products.isEmpty) {
          return Center(
            child: Text(
              'No deals available',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 12,
              ),
            ),
          );
        }

        return ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          itemCount: products.length,
          itemBuilder: (context, index) {
            return _buildDealCard(products[index], isDark, context);
          },
        );
      },
    );
  }

  Widget _buildDealCard(ProductModel product, bool isDark, BuildContext context) {
    // Generate a random background color based on product
    final colors = [
      Colors.pink.shade100,
      AppColors.infoLight.withValues(alpha: 0.3),
      AppColors.successLight.withValues(alpha: 0.3),
      AppColors.warningLight.withValues(alpha: 0.3),
      AppColors.accentLight.withValues(alpha: 0.3),
      AppColors.primaryLighter.withValues(alpha: 0.3),
    ];
    final bgColor = colors[product.id.hashCode % colors.length];

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(
          context,
          AppRoutes.productDetails,
          arguments: product.id,
        );
      },
      child: Container(
        width: 130,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : bgColor,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.1),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            // Product Image
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: product.images.isNotEmpty ? product.images.first : '',
                    fit: BoxFit.contain,
                    placeholder: (context, url) => const Center(
                      child: Icon(Icons.image, size: 32),
                    ),
                    errorWidget: (context, url, error) => const Center(
                      child: Icon(Icons.broken_image, size: 32),
                    ),
                  ),
                ),
              ),
            ),

            // Deal Info
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isDark ? Colors.black.withValues(alpha: 0.3) : Colors.white,
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Discount Label
                  if (product.discount > 0)
                    Text(
                      'Up to ${product.discount.toInt()}% Off',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppColors.success,
                      ),
                    ),
                  const SizedBox(height: 2),
                  // Category/Name
                  Text(
                    product.name,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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
