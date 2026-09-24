// lib/screens/user/shop/seller_profile_screen.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class SellerProfileScreen extends StatefulWidget {
  final String sellerId;

  const SellerProfileScreen({
    super.key,
    required this.sellerId,
  });

  @override
  State<SellerProfileScreen> createState() => _SellerProfileScreenState();
}

class _SellerProfileScreenState extends State<SellerProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  SellerModel? _seller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadSellerData();
  }

  Future<void> _loadSellerData() async {
    try {
      final doc = await FirebaseFirestore.instance
          .collection('sellers')
          .doc(widget.sellerId)
          .get();

      if (doc.exists && mounted) {
        setState(() {
          _seller = SellerModel.fromMap(
            doc.data() as Map<String, dynamic>,
            widget.sellerId,
          );
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading seller: $e');
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: _isLoading
          ? _buildLoadingState(isDark)
          : _seller == null
              ? _buildErrorState(isDark)
              : NestedScrollView(
                  headerSliverBuilder: (context, innerBoxIsScrolled) {
                    return [
                      _buildSliverAppBar(isDark, innerBoxIsScrolled),
                      SliverToBoxAdapter(
                        child: Column(
                          children: [
                            _buildSellerHeader(isDark),
                            _buildStatsRow(isDark),
                            _buildTabBar(isDark),
                          ],
                        ),
                      ),
                    ];
                  },
                  body: _buildTabContent(isDark),
                ),
    );
  }

  Widget _buildSliverAppBar(bool isDark, bool innerBoxIsScrolled) {
    return SliverAppBar(
      floating: true,
      pinned: true,
      elevation: 0,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
      leading: IconButton(
        icon: Icon(
          Icons.arrow_back_rounded,
          color: isDark ? AppColors.textLight : AppColors.textPrimary,
        ),
        onPressed: () {
          HapticFeedback.mediumImpact();
          Navigator.pop(context);
        },
      ),
      title: Text(
        _seller?.storeName ?? 'Seller Profile',
        style: TextStyle(
          color: isDark ? AppColors.textLight : AppColors.textPrimary,
          fontWeight: FontWeight.bold,
        ),
      ),
      actions: [
        IconButton(
          icon: Icon(
            Icons.share_outlined,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
          onPressed: () {
            HapticFeedback.mediumImpact();
            // Implement share functionality
          },
        ),
      ],
    );
  }

  Widget _buildSellerHeader(bool isDark) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
      ),
      child: Column(
        children: [
          // Store Icon
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.1),
              shape: BoxShape.circle,
              border: Border.all(
                color: accentColor.withValues(alpha: 0.3),
                width: 2,
              ),
            ),
            child: Icon(
              Icons.store_rounded,
              size: 40,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 16),

          // Store Name
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  _seller!.storeName,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              if (_seller!.isVerified) ...[
                const SizedBox(width: 8),
                Icon(
                  Icons.verified,
                  size: 24,
                  color: AppColors.success,
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),

          // Rating
          if (_seller!.rating > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.star, size: 16, color: accentColor),
                  const SizedBox(width: 4),
                  Text(
                    _seller!.rating.toStringAsFixed(1),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '(${_seller!.reviewCount} reviews)',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppColors.textLightSecondary
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),

          // Location
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 16,
                color: isDark
                    ? AppColors.textLightTertiary
                    : AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Text(
                '${_seller!.businessCity}, ${_seller!.businessState}',
                style: TextStyle(
                  fontSize: 14,
                  color: isDark
                      ? AppColors.textLightSecondary
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        border: Border(
          bottom: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildStatColumn(
            label: 'Products',
            value: _seller!.totalProducts.toString(),
            isDark: isDark,
          ),
          _buildStatDivider(isDark),
          _buildStatColumn(
            label: 'Orders',
            value: _seller!.totalOrders.toString(),
            isDark: isDark,
          ),
          _buildStatDivider(isDark),
          _buildStatColumn(
            label: 'Revenue',
            value: '₹${(_seller!.totalRevenue / 1000).toStringAsFixed(0)}K',
            isDark: isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildStatColumn({
    required String label,
    required String value,
    required bool isDark,
  }) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color:
                isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildStatDivider(bool isDark) {
    return Container(
      height: 40,
      width: 1,
      color: isDark ? AppColors.borderDark : AppColors.border,
    );
  }

  Widget _buildTabBar(bool isDark) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      color: isDark ? AppColors.backgroundDark : AppColors.background,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        child: TabBar(
          controller: _tabController,
          labelColor: isDark ? AppColors.textPrimary : AppColors.white,
          unselectedLabelColor:
              isDark ? AppColors.textLightTertiary : AppColors.textSecondary,
          indicator: BoxDecoration(
            color: accentColor,
            borderRadius: BorderRadius.circular(10),
          ),
          tabs: const [
            Tab(text: 'Products'),
            Tab(text: 'About'),
            Tab(text: 'Reviews'),
          ],
        ),
      ),
    );
  }

  Widget _buildTabContent(bool isDark) {
    return TabBarView(
      controller: _tabController,
      children: [
        _buildProductsTab(isDark),
        _buildAboutTab(isDark),
        _buildReviewsTab(isDark),
      ],
    );
  }

  Widget _buildProductsTab(bool isDark) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('products')
          .where('sellerId', isEqualTo: widget.sellerId)
          .where('isActive', isEqualTo: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(
            child: CircularProgressIndicator(
              color: isDark ? AppColors.primaryLight : AppColors.primary,
            ),
          );
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.inventory_2_outlined,
                  size: 64,
                  color: isDark
                      ? AppColors.textLightTertiary
                      : AppColors.textSecondary,
                ),
                const SizedBox(height: 16),
                Text(
                  'No products available',
                  style: TextStyle(
                    fontSize: 16,
                    color: isDark
                        ? AppColors.textLightSecondary
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          );
        }

        final products = snapshot.data!.docs
            .map((doc) =>
                ProductModel.fromMap(doc.data() as Map<String, dynamic>, doc.id))
            .toList();

        return GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 0.7,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: products.length,
          itemBuilder: (context, index) {
            return _buildProductCard(products[index], isDark);
          },
        );
      },
    );
  }

  // ✅ INLINE PRODUCT CARD WIDGET
  Widget _buildProductCard(ProductModel product, bool isDark) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return GestureDetector(
      onTap: () {
        Navigator.pushNamed(context, AppRoutes.productDetails, arguments: product.id);
      },
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Product Image
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.surfaceDarkVariant
                      : AppColors.surfaceVariant,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(12),
                  ),
                ),
                child: Stack(
                  children: [
                    Center(
                      child: product.images.isNotEmpty
                          ? Image.network(
                              product.images.first,
                              fit: BoxFit.cover,
                              width: double.infinity,
                            )
                          : Icon(
                              Icons.image_outlined,
                              size: 48,
                              color: isDark
                                  ? AppColors.textLightTertiary
                                  : AppColors.textSecondary,
                            ),
                    ),
                    if (product.discount > 0)
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '-${product.discount}%',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Product Details
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '₹${product.price.toStringAsFixed(0)}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: accentColor,
                        ),
                      ),
                      if (product.originalPrice != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          '₹${product.originalPrice!.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontSize: 12,
                            decoration: TextDecoration.lineThrough,
                            color: isDark
                                ? AppColors.textLightTertiary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (product.rating > 0) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.star, size: 14, color: accentColor),
                        const SizedBox(width: 4),
                        Text(
                          product.rating.toStringAsFixed(1),
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark
                                ? AppColors.textLightSecondary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAboutTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildInfoCard(
            title: 'Business Information',
            isDark: isDark,
            children: [
              _buildInfoRow('Legal Name', _seller!.businessLegalName, isDark),
              _buildInfoRow('Type', _seller!.businessType, isDark),
              _buildInfoRow('Address', _seller!.businessAddress, isDark),
              _buildInfoRow('City', _seller!.businessCity, isDark),
              _buildInfoRow('State', _seller!.businessState, isDark),
              _buildInfoRow('Pincode', _seller!.businessPincode, isDark),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoCard(
            title: 'Contact Information',
            isDark: isDark,
            children: [
              _buildInfoRow('Phone', _seller!.businessContact, isDark),
              _buildInfoRow('Email', _seller!.email, isDark),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoCard(
            title: 'Verification',
            isDark: isDark,
            children: [
              _buildInfoRow('Status', _seller!.verificationBadge, isDark),
              _buildInfoRow('PAN', _seller!.panNumber, isDark),
              _buildInfoRow('GST', _seller!.gstNumber, isDark),
              _buildInfoRow(
                  'Member Since',
                  '${_seller!.createdAt.day}/${_seller!.createdAt.month}/${_seller!.createdAt.year}',
                  isDark),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required String title,
    required bool isDark,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
              ),
            ),
          ),
          Divider(
            height: 1,
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: isDark
                    ? AppColors.textLightSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewsTab(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.rate_review_outlined,
            size: 64,
            color:
                isDark ? AppColors.textLightTertiary : AppColors.textSecondary,
          ),
          const SizedBox(height: 16),
          Text(
            'Seller reviews coming soon',
            style: TextStyle(
              fontSize: 16,
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: CircularProgressIndicator(
        color: isDark ? AppColors.primaryLight : AppColors.primary,
      ),
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.error_outline,
            size: 64,
            color: AppColors.error,
          ),
          const SizedBox(height: 16),
          Text(
            'Seller not found',
            style: TextStyle(
              fontSize: 16,
              color: isDark
                  ? AppColors.textLightSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
