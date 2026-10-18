import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace/app/routes.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../shop/widgets/product_card.dart';
import 'widgets/empty_wishlist.dart';
import '../../widgets/premium_scaffold.dart';

class MobileWishlistScreen extends StatefulWidget {
  const MobileWishlistScreen({super.key});

  @override
  State<MobileWishlistScreen> createState() => _MobileWishlistScreenState();
}

class _MobileWishlistScreenState extends State<MobileWishlistScreen>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  
  // 🚀 WEB OPTIMIZATION: Keep state alive when switching tabs
  @override
  bool get wantKeepAlive => true;
  
  late AnimationController _animationController;
  bool _hasGuestWishlistToTransfer = false;
  bool _isTransferringGuestWishlist = false;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _animationController.forward();
    _loadWishlist();
    _checkGuestWishlistTransfer();
  }

  void _loadWishlist() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final wishlistProvider = Provider.of<WishlistProvider>(context, listen: false);
      wishlistProvider.loadWishlist();
      // Wishlist cards are resolved from ProductProvider's canonical eligible feed.
      // Bypass its loaded-feed deduplication so a revoked listing is not kept on
      // screen just because this provider already had a cached page.
      context.read<ProductProvider>().loadProducts(forceReload: true);
    });
  }

  // D-BUYER-SCOPE (guest-transfer UI wiring, "Complete ALL remaining Phase 1R work" task) --
  // see mobile_cart_screen.dart's own doc comment on _checkGuestCartTransfer for the full
  // reasoning; this screen is behind the identical AuthGatedWidget, so only a signed-in buyer
  // ever reaches here.
  Future<void> _checkGuestWishlistTransfer() async {
    final hasGuestWishlist = await context.read<WishlistProvider>().hasGuestWishlistToTransfer();
    if (mounted) setState(() => _hasGuestWishlistToTransfer = hasGuestWishlist);
  }

  Future<void> _transferGuestWishlist() async {
    if (_isTransferringGuestWishlist) return;
    setState(() => _isTransferringGuestWishlist = true);
    HapticFeedback.mediumImpact();

    final wishlistProvider = context.read<WishlistProvider>();
    final succeeded = await wishlistProvider.transferGuestWishlistToBuyer();
    final stillPending = !succeeded && await wishlistProvider.hasGuestWishlistToTransfer();

    if (!mounted) return;
    setState(() {
      _isTransferringGuestWishlist = false;
      _hasGuestWishlistToTransfer = stillPending;
    });

    if (succeeded) {
      SnackbarHelper.showSuccess(context, 'Moved your items from before you signed in');
    } else {
      SnackbarHelper.showError(
        context,
        stillPending
            ? 'Could not finish moving your items on this device -- tap to try again'
            : 'Could not move your items on this device',
      );
    }
  }

  Widget _buildGuestTransferBanner(bool isDark, Color accentColor) {
    if (!_hasGuestWishlistToTransfer) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: isDark ? 0.15 : 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: accentColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.move_to_inbox_rounded, color: accentColor, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'You have wishlist items from before you signed in.',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
          const SizedBox(width: 8),
          _isTransferringGuestWishlist
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: accentColor),
                )
              : TextButton(
                  onPressed: _transferGuestWishlist,
                  style: TextButton.styleFrom(foregroundColor: accentColor),
                  child: const Text('Move to my wishlist', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // 🚀 Required for AutomaticKeepAlive
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? AppColors.surfaceDark : AppColors.surface;
    final backgroundColor = isDark ? AppColors.scaffoldDark : AppColors.scaffoldLight;

    return PremiumScaffold(
      // backgroundColor handled by PremiumScaffold
      appBar: _buildAppBar(isDark, cardColor, accentColor),
      body: Consumer2<WishlistProvider, ProductProvider>(
        builder: (context, wishlistProvider, productProvider, child) {
          if (wishlistProvider.isLoading) {
            return Center(
              child: CircularProgressIndicator(color: accentColor),
            );
          }

          if (wishlistProvider.isEmpty) {
            if (_hasGuestWishlistToTransfer) {
              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: _buildGuestTransferBanner(isDark, accentColor),
                  ),
                  const Expanded(child: EmptyWishlist()),
                ],
              );
            }
            return const EmptyWishlist();
          }

          final wishlistProductIds = wishlistProvider.productIds;
          final products = productProvider.products
              .where((product) => wishlistProductIds.contains(product.id))
              .toList();

          return RefreshIndicator(
            color: accentColor,
            onRefresh: () async {
              HapticFeedback.lightImpact();
              wishlistProvider.loadWishlist();
              await productProvider.loadProducts(forceReload: true);
            },
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                if (_hasGuestWishlistToTransfer)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: _buildGuestTransferBanner(isDark, accentColor),
                    ),
                  ),
                // Header Stats Card
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: _buildStatsCard(
                      wishlistProvider,
                      isDark,
                      cardColor,
                      accentColor,
                    ),
                  ),
                ),

                // Grid View with ProductCard
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.65,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        return FadeTransition(
                          opacity: Tween<double>(begin: 0.0, end: 1.0).animate(
                            CurvedAnimation(
                              parent: _animationController,
                              curve: Interval(
                                (index / products.length) * 0.5,
                                1.0,
                                curve: Curves.easeOut,
                              ),
                            ),
                          ),
                          child: ProductCard(
                            product: products[index],
                            isGridView: true,
                          ),
                        );
                      },
                      childCount: products.length,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color cardColor, Color accentColor) {
    return AppBar(
      backgroundColor: cardColor,
      elevation: 0,
      automaticallyImplyLeading: false,
      title: Text(
        'My Wishlist',
        style: TextStyle(
          color: isDark ? AppColors.textLight : AppColors.textPrimary,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          letterSpacing: -0.3,
        ),
      ),
      centerTitle: true,
      actions: [
        Consumer<WishlistProvider>(
          builder: (context, wishlistProvider, child) {
            if (wishlistProvider.itemCount > 0) {
              return IconButton(
                onPressed: () => _showClearConfirmation(context),
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.delete_outline_rounded,
                    color: AppColors.error,
                    size: 18,
                  ),
                ),
                tooltip: 'Clear All',
              );
            }
            return const SizedBox.shrink();
          },
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildStatsCard(
    WishlistProvider wishlistProvider,
    bool isDark,
    Color cardColor,
    Color accentColor,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.favorite_rounded,
              color: AppColors.error,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),

          // Text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Saved Items',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${wishlistProvider.itemCount} ${wishlistProvider.itemCount == 1 ? 'Product' : 'Products'}',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
          ),

          // Move All Button
          ElevatedButton(
            onPressed: () => _moveAllToCart(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: accentColor,
              foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
              padding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 12,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              elevation: 0,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.shopping_cart_rounded,
                  size: 16,
                ),
                const SizedBox(width: 6),
                Text(
                  'Move All',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showClearConfirmation(BuildContext context) {
    final isDark = context.read<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? AppColors.surfaceDark : AppColors.surface;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        contentPadding: EdgeInsets.zero,
        content: Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.error,
                      AppColors.error.withValues(alpha: 0.8),
                    ],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.error.withValues(alpha: 0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.delete_forever_rounded,
                  color: AppColors.white,
                  size: 32,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Clear Wishlist?',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Remove all items from your wishlist?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: BorderSide(
                          color: isDark ? AppColors.borderDark : AppColors.borderLight,
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _clearWishlist(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.error,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Clear All',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.3,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _clearWishlist(BuildContext context) async {
    final wishlistProvider = Provider.of<WishlistProvider>(context, listen: false);

    HapticFeedback.heavyImpact();
    await wishlistProvider.clearWishlist();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                Icons.check_circle_outline_rounded,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Wishlist cleared',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          margin: const EdgeInsets.all(16),
          elevation: 4,
        ),
      );
    }
  }

  void _moveAllToCart(BuildContext context) async {
    final wishlistProvider = Provider.of<WishlistProvider>(context, listen: false);
    final cartProvider = Provider.of<CartProvider>(context, listen: false);
    final productProvider = Provider.of<ProductProvider>(context, listen: false);
    final isDark = context.read<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;

    final wishlistProductIds = wishlistProvider.productIds;
    final products = productProvider.products
        .where((product) => wishlistProductIds.contains(product.id))
        .toList();

    if (products.isEmpty) return;

    HapticFeedback.mediumImpact();

    // Show loading
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Center(
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.1),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: accentColor),
              const SizedBox(height: 16),
              Text(
                'Moving to cart...',
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    // Only a product that actually made it into the cart leaves the wishlist -- addItem can
    // genuinely fail now (a real device storage error), and clearing the whole wishlist
    // regardless used to silently lose any product whose add failed: gone from the wishlist,
    // never in the cart either.
    var movedCount = 0;
    for (var product in products) {
      final added = await cartProvider.addItem(product, quantity: 1);
      if (added) {
        movedCount++;
        await wishlistProvider.removeItem(product.id);
      }
    }

    // Close loading
    if (mounted) Navigator.pop(context);

    if (mounted) {
      final allMoved = movedCount == products.length;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                allMoved ? Icons.shopping_cart_rounded : Icons.error_outline_rounded,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  allMoved
                      ? '$movedCount items moved to cart'
                      : (movedCount == 0
                          ? 'Could not move items to cart'
                          : '$movedCount of ${products.length} items moved to cart'),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          backgroundColor: allMoved ? AppColors.success : (movedCount == 0 ? AppColors.error : AppColors.warning),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          margin: const EdgeInsets.all(16),
          elevation: 4,
          action: movedCount > 0
              ? SnackBarAction(
                  label: 'View Cart',
                  textColor: Colors.white,
                  onPressed: () {
                    AppRoutes.navigateTo(context, AppRoutes.cart);
                  },
                )
              : null,
        ),
      );
    }
  }
}
