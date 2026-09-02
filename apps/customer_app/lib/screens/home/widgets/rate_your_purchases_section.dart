// Rate Your Purchases Section - Compact Carousel Style
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:intl/intl.dart';

class RateYourPurchasesSection extends StatefulWidget {
  const RateYourPurchasesSection({super.key});

  @override
  State<RateYourPurchasesSection> createState() => _RateYourPurchasesSectionState();
}

class _RateYourPurchasesSectionState extends State<RateYourPurchasesSection>
    with SingleTickerProviderStateMixin {
  final Map<String, int> _ratings = {}; // productId -> rating (0 = not rated)
  final Map<String, bool> _isSubmitting = {};
  final ImagePicker _picker = ImagePicker();
  AnimationController? _shimmerController;

  @override
  void initState() {
    super.initState();
    // Initialize safely
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final userId = FirebaseAuth.instance.currentUser?.uid;

    if (userId == null) return const SizedBox.shrink();

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('orders')
          .where('userId', isEqualTo: userId)
          .where('orderStatus', isEqualTo: 'delivered')
          .orderBy('createdAt', descending: true)
          .limit(10)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return const SizedBox.shrink();
        }

        // Extract all products from delivered orders
        final List<_ProductToRate> productsToRate = [];
        for (final doc in snapshot.data!.docs) {
          final order = OrderModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
          for (final item in order.items) {
            productsToRate.add(_ProductToRate(
              productId: item.productId,
              productName: item.productName,
              productImage: item.imageUrl,
              deliveredDate: order.deliveryDate ?? order.createdAt,
              orderId: order.id,
            ));
          }
        }

        if (productsToRate.isEmpty) return const SizedBox.shrink();

        // Filter out already reviewed products
        return FutureBuilder<List<_ProductToRate>>(
          future: _filterUnreviewedProducts(productsToRate, userId),
          builder: (context, futureSnapshot) {
            if (!futureSnapshot.hasData || futureSnapshot.data!.isEmpty) {
              return const SizedBox.shrink();
            }

            final unreviewedProducts = futureSnapshot.data!.take(8).toList();

            return Container(
              margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              decoration: BoxDecoration(
                // Professional glassmorphic background using AppColors
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
                  // Premium Header
                  _buildSectionHeader(isDark, unreviewedProducts.length),
                  
                  // Horizontal Carousel
                  SizedBox(
                    height: 120, // Adjusted height for the new layout
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                      physics: const BouncingScrollPhysics(),
                      itemCount: unreviewedProducts.length,
                      itemBuilder: (context, index) {
                        return _buildAdvancedRatingCard(
                          unreviewedProducts[index], 
                          isDark, 
                          userId,
                        );
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
          // Animated Pulse Indicator
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.star_rounded,
              size: 18,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 12),
          
          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Review Purchases',
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
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '$count Pending',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: AppColors.error,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'Share your experience',
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

  Future<List<_ProductToRate>> _filterUnreviewedProducts(
      List<_ProductToRate> products, String userId) async {
    final unreviewed = <_ProductToRate>[];
    final checkedIds = <String>{};

    for (final p in products) {
      if (checkedIds.contains(p.productId)) continue;
      checkedIds.add(p.productId);

      try {
        final reviewQuery = await FirebaseFirestore.instance
            .collection('products')
            .doc(p.productId)
            .collection('reviews')
            .where('userId', isEqualTo: userId)
            .limit(1)
            .get();

        if (reviewQuery.docs.isEmpty) {
          unreviewed.add(p);
        }
      } catch (e) {
        debugPrint('Error checking review: $e');
      }
    }
    return unreviewed;
  }

  Widget _buildAdvancedRatingCard(_ProductToRate product, bool isDark, String userId) {
    final currentRating = _ratings[product.productId] ?? 0;
    final isSubmitting = _isSubmitting[product.productId] ?? false;
    final hasRated = currentRating > 0;

    return Container(
      width: 300, // Wide card as per screenshot
      margin: const EdgeInsets.only(right: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.04),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Top Section: Image & Text
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  // Product Image (Square, Contained)
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isDark ? Colors.white10 : Colors.grey.shade200,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(4.0),
                      child: CachedNetworkImage(
                        imageUrl: product.productImage,
                        fit: BoxFit.contain,
                        placeholder: (_, __) => Center(child: Icon(Icons.shopping_bag, size: 20, color: Colors.grey[300])),
                        errorWidget: (_, __, ___) => const Icon(Icons.broken_image, size: 20),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Text Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          product.productName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Delivered on ${DateFormat('MMM dd, yyyy').format(product.deliveredDate)}',
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
            ),
          ),

          // Bottom Section: Grey Bar with Rating
          Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFF5F7FA),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "Rate this product",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white54 : Colors.grey[700],
                  ),
                ),
                if (isSubmitting)
                  const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                else if (hasRated)
                   Row(
                      children: [
                        const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 16),
                        const SizedBox(width: 6),
                        Text(
                          "Rated $currentRating",
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    )
                else
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(5, (index) {
                      return GestureDetector(
                        onTap: () => _submitRating(product, index + 1),
                        child: Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: Icon(
                            Icons.star_outline_rounded,
                            size: 22,
                            color: isDark ? Colors.white60 : Colors.black54,
                          ),
                        ),
                      );
                    }),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submitRating(_ProductToRate product, int rating) async {
    setState(() {
      _isSubmitting[product.productId] = true;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return;

      // Get user name
      final userDoc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final userName = userDoc.data()?['name'] ?? 'Customer';
      final userAvatar = userDoc.data()?['profilePicture'] ?? '';

      // Submit review via ReviewProvider
      await Provider.of<ReviewProvider>(context, listen: false).addReview(
        productId: product.productId,
        userId: user.uid,
        userName: userName,
        userAvatar: userAvatar,
        rating: rating,
        title: _getRatingTitle(rating),
        comment: '',
        isVerifiedPurchase: true,
      );

      setState(() {
        _ratings[product.productId] = rating;
        _isSubmitting[product.productId] = false;
      });

      HapticFeedback.mediumImpact();
    } catch (e) {
      debugPrint('Error submitting rating: $e');
      setState(() {
        _isSubmitting[product.productId] = false;
      });
    }
  }

  String _getRatingTitle(int rating) {
    if (rating == 5) return 'Excellent!';
    if (rating == 4) return 'Very Good';
    if (rating == 3) return 'Average';
    if (rating == 2) return 'Below Average';
    return 'Poor';
  }
}

// Helper class for product data
class _ProductToRate {
  final String productId;
  final String productName;
  final String productImage;
  final DateTime deliveredDate;
  final String orderId;

  _ProductToRate({
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.deliveredDate,
    required this.orderId,
  });
}
