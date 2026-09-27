import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'widgets/cart_item_card.dart';
import 'widgets/empty_cart.dart';
import '../checkout/checkout_screen.dart';
import '../../widgets/premium_scaffold.dart';
import '../../utils/shipping_fee_calculator.dart';

/// Phase 1R shipping-semantics correction: [finalTotal] is deliberately nullable. See
/// CartShippingSummary.allKnown's own doc comment for why a partial/loading/failed shipping
/// state must never be summed into a number presented as the complete payable total.
class _CartPricing {
  final double subtotal;
  final CartShippingSummary shipping;
  const _CartPricing({required this.subtotal, required this.shipping});

  double? get finalTotal =>
      shipping.allKnown ? subtotal + shipping.knownSoFar : null;
}

class MobileCartScreen extends StatefulWidget {
  const MobileCartScreen({super.key});

  @override
  State<MobileCartScreen> createState() => _MobileCartScreenState();
}

class _MobileCartScreenState extends State<MobileCartScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _fabController;
  late Animation<double> _fabAnimation;
  final ScrollController _scrollController = ScrollController();
  bool _showFab = false;
  bool _hasGuestCartToTransfer = false;
  bool _isTransferringGuestCart = false;

  final Map<String, ProductLookup> _productCache = {};

  @override
  void initState() {
    super.initState();

    _fabController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );

    _fabAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fabController, curve: Curves.easeOut),
    );

    _scrollController.addListener(_scrollListener);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().loadCart();
      _loadProductDetails();
      _checkGuestCartTransfer();
    });
  }

  // D-BUYER-SCOPE (guest-transfer UI wiring, "Complete ALL remaining Phase 1R work" task):
  // CartScreen wraps this whole screen in AuthGatedWidget, so a guest can never see this screen
  // at all -- only a signed-in buyer reaches here, meaning this is exactly where "items you added
  // before signing in" should be offered, once, explicitly.
  Future<void> _checkGuestCartTransfer() async {
    final hasGuestCart = await context.read<CartProvider>().hasGuestCartToTransfer();
    if (mounted) setState(() => _hasGuestCartToTransfer = hasGuestCart);
  }

  Future<void> _transferGuestCart() async {
    if (_isTransferringGuestCart) return;
    setState(() => _isTransferringGuestCart = true);
    HapticFeedback.mediumImpact();

    final cartProvider = context.read<CartProvider>();
    final succeeded = await cartProvider.transferGuestCartToBuyer();
    final stillPending = !succeeded && await cartProvider.hasGuestCartToTransfer();

    if (!mounted) return;
    setState(() {
      _isTransferringGuestCart = false;
      // A failed attempt may still have durably completed part of the work (see
      // CartProvider.transferGuestCartToBuyer's own doc comment) -- re-check honestly rather than
      // assume "failed" means "nothing happened," so the banner only stays up while something
      // genuinely remains to finish.
      _hasGuestCartToTransfer = stillPending;
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
    if (!_hasGuestCartToTransfer) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
              'You have items from before you signed in.',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ),
          const SizedBox(width: 8),
          _isTransferringGuestCart
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: accentColor),
                )
              : TextButton(
                  onPressed: _transferGuestCart,
                  style: TextButton.styleFrom(foregroundColor: accentColor),
                  child: const Text('Move to my cart', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
        ],
      ),
    );
  }

  void _scrollListener() {
    if (_scrollController.offset > 200 && !_showFab) {
      setState(() => _showFab = true);
      _fabController.forward();
    } else if (_scrollController.offset <= 200 && _showFab) {
      setState(() => _showFab = false);
      _fabController.reverse();
    }
  }

  @override
  void dispose() {
    _fabController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadProductDetails() async {
    final cartProvider = context.read<CartProvider>();
    // C5 corrective (found via this session's own on-device testing, chasing an apparent
    // shipping-fee regression that turned out to be this, not the actual fix under test): this
    // used to read cartProvider.items immediately, racing CartProvider's own constructor-time
    // load of the persisted cart from SharedPreferences (loadCart() below is a documented no-op --
    // see its own comment -- CartProvider.ready is the real signal). On a cold app launch
    // navigated to this screen quickly, items was still empty at this exact synchronous moment,
    // so shipping silently stayed 0 forever after -- nothing ever re-triggered this method once
    // the cart itself finished loading a beat later. Awaiting readiness first closes that window.
    await cartProvider.ready;
    if (!mounted) return;
    final productProvider = context.read<ProductProvider>();

    for (final item in cartProvider.items) {
      if (!_productCache.containsKey(item.productId)) {
        final product = await productProvider.fetchProductById(item.productId);
        // Phase 1R shipping-semantics correction: a failed/empty lookup now records an explicit
        // ProductLookupFailed entry instead of leaving the key absent. cartShippingFees()
        // (shipping_fee_calculator.dart) treats "absent" as still-loading -- if a failure left no
        // entry, this item would look permanently "loading" forever rather than honestly failed,
        // and its shipping would never settle into any displayable state.
        _productCache[item.productId] =
            product != null ? ProductLoaded(product) : const ProductLookupFailed();
        if (product == null) {
          debugPrint('❌ Error loading product ${item.productId}: not found or unreachable');
        }
      }
    }

    if (mounted) setState(() {});
  }

  Future<void> _showClearCartDialog(CartProvider cartProvider) async {
    HapticFeedback.mediumImpact();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.delete_outline, color: AppColors.error),
            ),
            const SizedBox(width: 12),
            const Text('Clear Cart'),
          ],
        ),
        content: const Text(
          'Are you sure you want to remove all items from your cart? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('Clear All', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await cartProvider.clearCart();
      if (mounted) {
        HapticFeedback.heavyImpact();
        SnackbarHelper.showSuccess(context, 'Cart cleared successfully');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? AppColors.surfaceDark : AppColors.surface;
    final backgroundColor = isDark ? AppColors.scaffoldDark : AppColors.scaffoldLight;

    return PremiumScaffold(
      // backgroundColor handled by PremiumScaffold
      appBar: _buildAppBar(isDark, cardColor),
      // Phase 1R corrective (C2): was Consumer2<CartProvider, CouponProvider>. CouponProvider
      // was entirely FirebaseFirestore-backed with no canonical successor; appliedCoupon was
      // already always null (coupons could never load), so the BOGO auto-apply trigger below
      // never fired and _calculateAdvancedPricing's coupon branch never ran.
      body: Consumer<CartProvider>(
        builder: (context, cartProvider, child) {
          if (cartProvider.isLoading) {
            return _buildLoadingState(accentColor, isDark);
          }

          if (cartProvider.isEmpty) {
            if (_hasGuestCartToTransfer) {
              return Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: _buildGuestTransferBanner(isDark, accentColor),
                  ),
                  Expanded(child: EmptyCart(onStartShopping: () => Navigator.pop(context))),
                ],
              );
            }
            return EmptyCart(
              onStartShopping: () => Navigator.pop(context),
            );
          }

          final pricingData = _calculateAdvancedPricing(
            cartProvider,
          );

          return Stack(
            children: [
              Column(
                children: [
                  Expanded(
                    child: RefreshIndicator(
                      onRefresh: () async {
                        await Future.wait([
                          Future(() => cartProvider.loadCart()),
                          Future(() => _loadProductDetails()),
                          Future.delayed(const Duration(milliseconds: 500)),
                        ]);
                      },
                      color: accentColor,
                      child: SingleChildScrollView(
                        controller: _scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: Column(
                          children: [
                            _buildGuestTransferBanner(isDark, accentColor),
                            _buildCartItemsSection(
                              cartProvider,
                              const [],
                              isDark,
                              cardColor,
                              accentColor,
                            ),
                            const SizedBox(height: 12),

                            _buildDeliverySection(
                              cartProvider.items,
                              isDark,
                              cardColor,
                              accentColor,
                            ),
                            const SizedBox(height: 12),
                            
                            _buildAdvancedPriceSummary(
                              pricingData,
                              isDark,
                              cardColor,
                              accentColor,
                            ),
                            const SizedBox(height: 12),
                            
                            _buildSecurityBadge(isDark, accentColor),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _buildCheckoutButton(
                  pricingData.finalTotal,
                  isDark,
                  accentColor,
                  cardColor,
                ),
              ),
              if (_showFab) _buildScrollToTopFab(accentColor),
            ],
          );
        },
      ),
    );
  }

  // Phase 1R corrective (C2): CouponProvider was entirely FirebaseFirestore-backed with no
  // canonical successor, and coupons could never actually be fetched or applied (Firestore
  // unreachable) -- appliedCoupon was already always null, so couponDiscount/bogoValue/
  // flatDiscount/percentageDiscount already always evaluated to 0. This computes the same
  // always-true result directly instead of depending on the provider being in the tree.
  //
  // Phase 1R shipping-semantics correction (owner-requested completion, same day): 'finalTotal'
  // is now nullable. Every line's shipping fee must be a real, backend-confirmed KnownFee before
  // this screen will show one combined "Total Amount" -- see CartShippingSummary.allKnown's own
  // doc comment. When any line is still loading, failed, or genuinely has no shipping data, there
  // is no honest single number to show, so this returns null and _buildAdvancedPriceSummary/
  // _buildCheckoutButton render an explicit "shipping pending" state instead of a partial sum
  // dressed up as a complete payable total.
  _CartPricing _calculateAdvancedPricing(
    CartProvider cartProvider,
  ) {
    final subtotal = cartProvider.subtotal;
    final shipping = CartShippingSummary.compute(cartProvider.items, _productCache);
    return _CartPricing(subtotal: subtotal, shipping: shipping);
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color cardColor) {
    return AppBar(
      backgroundColor: cardColor,
      elevation: 0,
      title: Text(
        'Shopping Cart',
        style: TextStyle(
          color: isDark ? AppColors.textLight : AppColors.textPrimary,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          letterSpacing: -0.3,
        ),
      ),
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: isDark ? AppColors.backgroundDark : AppColors.background,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            size: 16,
          ),
        ),
        onPressed: () => Navigator.pop(context),
      ),
      centerTitle: true,
      actions: [
        Consumer<CartProvider>(
          builder: (context, cartProvider, child) {
            if (cartProvider.isEmpty) return const SizedBox.shrink();

            return IconButton(
              onPressed: () => _showClearCartDialog(cartProvider),
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Clear Cart',
            );
          },
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildCartItemsSection(
    CartProvider cartProvider,
    List<CartItemModel> freeItems,
    bool isDark,
    Color cardColor,
    Color accentColor,
  ) {
    final allItems = [...cartProvider.items, ...freeItems];
    final totalItemCount = cartProvider.itemCount + freeItems.length;

    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Cart Items',
      icon: Icons.shopping_bag_outlined,
      accentColor: accentColor,
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    FaIcon(FontAwesomeIcons.cartShopping, size: 12, color: accentColor),
                    const SizedBox(width: 6),
                    Text(
                      '$totalItemCount ${totalItemCount == 1 ? 'Item' : 'Items'}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: accentColor),
                    ),
                  ],
                ),
              ),
              if (freeItems.isNotEmpty) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: isDark ? 0.2 : 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FaIcon(FontAwesomeIcons.gift, size: 10, color: AppColors.success),
                      const SizedBox(width: 5),
                      Text(
                        '${freeItems.length} Free',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.success),
                      ),
                    ],
                  ),
                ),
              ],
              const Spacer(),
              Text(
                '₹${cartProvider.subtotal.toStringAsFixed(0)}',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: isDark ? AppColors.textLight : AppColors.textPrimary),
              ),
            ],
          ),
          
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 1),
          ),
          
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: allItems.length,
            separatorBuilder: (context, index) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 1),
            ),
            itemBuilder: (context, index) {
              final item = allItems[index];
              final isFree = item.isFreeItem;
              final lookup = _productCache[item.productId];
              final product = lookup is ProductLoaded ? lookup.product : null;
              
              return _buildCartItem(
                item: item,
                product: product,
                isFree: isFree,
                isDark: isDark,
                accentColor: accentColor,
                onRemove: isFree ? null : () async {
                  // ✅ FIXED: Pass variant to correctly identify item
                  final success = await cartProvider.removeItem(
                    item.productId, 
                    variant: item.variant,
                  );
                  if (success && mounted) {
                    SnackbarHelper.showSuccess(context, 'Item removed');
                    await _loadProductDetails();
                  }
                },
                onQuantityChanged: isFree ? null : (quantity) async {
                  // ✅ FIXED: Pass variant to correctly identify item
                  await cartProvider.updateQuantity(
                    item.productId, 
                    quantity, 
                    variant: item.variant,
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }

Widget _buildCartItem({
  required CartItemModel item,
  ProductModel? product,
  required bool isFree,
  required bool isDark,
  required Color accentColor,
  void Function()? onRemove,
  void Function(int)? onQuantityChanged,
}) {
  return Container(
    decoration: BoxDecoration(
      color: isFree ? AppColors.success.withValues(alpha: isDark ? 0.08 : 0.03) : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      border: isFree ? Border.all(color: AppColors.success.withValues(alpha: 0.2)) : null,
    ),
    padding: isFree ? const EdgeInsets.all(8) : EdgeInsets.zero,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isFree)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [AppColors.success, AppColors.successLight]),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const FaIcon(FontAwesomeIcons.gift, size: 10, color: Colors.white),
                      const SizedBox(width: 5),
                      Text(
                        item.freeItemLabel ?? 'FREE',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Added via BOGO offer',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.success),
                  ),
                ),
              ],
            ),
          ),
        
        // ✅ REMOVED: Separate variant display - CartItemCard handles it internally
        
        CartItemCard(
          item: item,
          onRemove: onRemove ?? () {},
          onQuantityChanged: onQuantityChanged ?? (int qty) {},
        ),
      ],
    ),
  );
}


  // Phase 1R corrective (C2): "Apply Coupon" card removed outright (not just disconnected).
  // CouponProvider was entirely FirebaseFirestore-backed with no canonical successor, so
  // appliedCoupon was already always null -- this card was always in its "no coupon, tap to
  // browse" state -- and tapping it opened coupon_selection_screen.dart, itself deleted this
  // same pass as fully orphaned (coupons could never actually load). Offering a tap target to
  // a screen that no longer exists would be worse than removing it from active navigation.

  // Phase 1R shipping-semantics correction (owner-requested completion, same day): this section
  // used to derive "Free Standard Delivery" / "Standard Delivery" / "Special Delivery" / an
  // Express Delivery toggle from calculateShippingFees()'s ShippingFeeInfo -- a function and type
  // that no longer exist, because their defaults (missing price -> Rs.40, missing days -> "2-3",
  // express -> +Rs.9 on top of that) were exactly the fabrication this correction removes. There
  // is also no express-PRICE field anywhere in ProductModel, so an express option can never have
  // an honest fee with today's data model regardless of defaults -- it is dropped here, not
  // reworked. What replaces all of it is one honest status row driven by CartShippingSummary:
  // a real amount only when every line has a backend-confirmed fee (KnownFee, including a
  // confirmed Rs.0), and an explicit loading/failed/unknown state otherwise -- never a delivery
  // -days promise, since today's canonical gateway never actually returns shippingDays for any
  // real product (see product_provider.dart's _productFromListingDetail).
  Widget _buildDeliverySection(
    List<CartItemModel> items,
    bool isDark,
    Color cardColor,
    Color accentColor,
  ) {
    final shipping = CartShippingSummary.compute(items, _productCache);
    if (shipping.isEmpty) return const SizedBox.shrink();

    Widget statusRow;
    if (shipping.anyFailed) {
      statusRow = _buildDeliveryStatusRow(
        icon: FontAwesomeIcons.triangleExclamation,
        color: AppColors.warning,
        isDark: isDark,
        title: "Couldn't calculate delivery charge",
        subtitle: 'Pull down to refresh and try again',
      );
    } else if (shipping.anyLoading) {
      statusRow = _buildDeliveryStatusRow(
        icon: FontAwesomeIcons.truck,
        color: isDark ? Colors.grey[400]! : Colors.grey[600]!,
        isDark: isDark,
        title: 'Calculating delivery charge…',
      );
    } else if (shipping.allKnown) {
      final total = shipping.knownSoFar;
      statusRow = _buildDeliveryStatusRow(
        icon: FontAwesomeIcons.truck,
        color: total == 0 ? AppColors.success : AppColors.info,
        isDark: isDark,
        title: total == 0 ? 'Free delivery' : 'Delivery charge',
        trailing: total == 0
            ? _buildFreeBadge()
            : Text(
                '₹${total.toStringAsFixed(0)}',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black87),
              ),
      );
    } else {
      // shipping.anyUnknown, with nothing loading or failed: fetched successfully, but the
      // backend genuinely carried no shipping data for at least one line.
      statusRow = _buildDeliveryStatusRow(
        icon: FontAwesomeIcons.truck,
        color: isDark ? Colors.grey[400]! : Colors.grey[600]!,
        isDark: isDark,
        title: 'Delivery charge will be confirmed at checkout',
      );
    }

    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Delivery',
      icon: Icons.local_shipping_outlined,
      accentColor: accentColor,
      child: statusRow,
    );
  }

  Widget _buildDeliveryStatusRow({
    required FaIconData icon,
    required Color color,
    required bool isDark,
    required String title,
    String? subtitle,
    Widget? trailing,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.grey[850] : Colors.grey[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: FaIcon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black87),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing,
        ],
      ),
    );
  }

  Widget _buildFreeBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AppColors.success, AppColors.successLight]),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'FREE',
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5),
      ),
    );
  }

  // Phase 1R shipping-semantics correction (owner-requested completion, same day): 'pricing' is
  // now the _CartPricing object computed above, not a Map -- see its own doc comment for why
  // 'finalTotal' is nullable. couponDiscount/bogoValue/flatDiscount/percentageDiscount stay
  // hardcoded to 0 here (unchanged behaviour from the prior C2 corrective, which established
  // CouponProvider has no reachable Firestore-backed data and never will inside this phase) --
  // only shippingFee/expressDeliveryFee/total change shape in this pass.
  Widget _buildAdvancedPriceSummary(
    _CartPricing pricing,
    bool isDark,
    Color cardColor,
    Color accentColor,
  ) {
    final subtotal = pricing.subtotal;
    const couponDiscount = 0.0;
    const bogoValue = 0.0;
    const flatDiscount = 0.0;
    const percentageDiscount = 0.0;
    final shipping = pricing.shipping;
    final total = pricing.finalTotal;
    // couponDiscount is always 0 (see above), so the savings banner below never renders and
    // never reads this -- kept as a typed null rather than removed, since the banner's text
    // still references `coupon` structurally.
    const CouponModel? coupon = null;

    return _buildCardSection(
      isDark: isDark,
      cardColor: cardColor,
      title: 'Price Summary',
      icon: Icons.receipt_long_rounded,
      accentColor: accentColor,
      child: Column(
        children: [
          _priceRow('Subtotal', subtotal, isDark),
          
          if (flatDiscount > 0) ...[
            const SizedBox(height: 10),
            _priceRow('Flat Discount', -flatDiscount, isDark, color: AppColors.success, icon: FontAwesomeIcons.tag),
          ],
          
          if (percentageDiscount > 0) ...[
            const SizedBox(height: 10),
            _priceRow('Percentage Discount', -percentageDiscount, isDark, color: AppColors.success, icon: FontAwesomeIcons.percent),
          ],
          
          if (bogoValue > 0) ...[
            const SizedBox(height: 10),
            _priceRow('BOGO Free Item Value', -bogoValue, isDark, color: AppColors.accent, icon: FontAwesomeIcons.gift),
          ],

          if (shipping.allKnown && shipping.knownSoFar > 0) ...[
            const SizedBox(height: 10),
            _priceRow('Shipping Fee', shipping.knownSoFar, isDark, color: AppColors.infoDark, icon: FontAwesomeIcons.truck),
          ] else if (!shipping.allKnown) ...[
            const SizedBox(height: 10),
            _priceStatusRow(
              'Shipping Fee',
              shipping.anyFailed ? 'Failed to load' : (shipping.anyLoading ? 'Calculating…' : 'Pending'),
              isDark,
              icon: FontAwesomeIcons.truck,
            ),
          ],

          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Divider(color: isDark ? Colors.grey[800] : Colors.grey[200], height: 1),
          ),

          if (total != null)
            _priceRow('Total Amount', total, isDark, isTotal: true, color: accentColor)
          else
            _priceStatusRow('Total Amount', 'Calculated at checkout', isDark, isTotal: true, color: accentColor),
          
          if (couponDiscount > 0) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: bogoValue > 0
                      ? [AppColors.accent.withValues(alpha: isDark ? 0.2 : 0.1), AppColors.success.withValues(alpha: isDark ? 0.2 : 0.1)]
                      : [AppColors.success.withValues(alpha: isDark ? 0.2 : 0.1), AppColors.success.withValues(alpha: isDark ? 0.15 : 0.05)],
                ),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: bogoValue > 0 ? AppColors.accent.withValues(alpha: 0.3) : AppColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: bogoValue > 0 ? AppColors.accent.withValues(alpha: 0.2) : AppColors.success.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: FaIcon(
                      bogoValue > 0 ? FontAwesomeIcons.gift : FontAwesomeIcons.piggyBank,
                      size: 16,
                      color: bogoValue > 0 ? AppColors.accent : AppColors.success,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          bogoValue > 0 ? '🎉 Total Savings (BOGO + Discount)' : '🎉 Total Savings',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: isDark ? Colors.white : Colors.black87),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          coupon != null ? coupon.displayText : '',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '₹${couponDiscount.toStringAsFixed(0)}',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: bogoValue > 0 ? AppColors.accent : AppColors.success),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSecurityBadge(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: isDark ? 0.15 : 0.08),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: FaIcon(FontAwesomeIcons.shieldHalved, color: AppColors.success, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('100% Safe & Secure', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: isDark ? Colors.white : Colors.black87)),
                const SizedBox(height: 3),
                Text('Your data is encrypted & protected', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600])),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCardSection({
    required Widget child,
    required bool isDark,
    required Color cardColor,
    required Color accentColor,
    String? title,
    IconData? icon,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!, width: 1),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!, width: 1)),
              ),
              child: Row(
                children: [
                  Icon(icon, color: accentColor, size: 18),
                  const SizedBox(width: 10),
                  Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: -0.2, color: isDark ? Colors.white : Colors.black87)),
                ],
              ),
            ),
          Padding(padding: const EdgeInsets.all(16), child: child),
        ],
      ),
    );
  }

  Widget _priceRow(String title, double value, bool isDark, {Color? color, bool isTotal = false, FaIconData? icon}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            if (icon != null) ...[
              FaIcon(icon, size: 12, color: color ?? (isDark ? Colors.grey[400] : Colors.grey[600])),
              const SizedBox(width: 8),
            ],
            Text(
              title,
              style: TextStyle(
                fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
                fontSize: isTotal ? 15 : 14,
                color: isDark ? (isTotal ? Colors.white : Colors.grey[300]) : (isTotal ? Colors.black87 : Colors.grey[700]),
              ),
            ),
          ],
        ),
        Text(
          '₹${value.abs().toStringAsFixed(0)}',
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w700,
            fontSize: isTotal ? 18 : 14,
            color: color ?? (isDark ? Colors.white : Colors.black87),
          ),
        ),
      ],
    );
  }

  // Phase 1R shipping-semantics correction: the text-status counterpart to [_priceRow], for a
  // line whose value genuinely isn't a number yet (loading/failed/pending) -- never a ₹ amount
  // standing in for "we don't know".
  Widget _priceStatusRow(String title, String status, bool isDark, {Color? color, bool isTotal = false, FaIconData? icon}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            if (icon != null) ...[
              FaIcon(icon, size: 12, color: color ?? (isDark ? Colors.grey[400] : Colors.grey[600])),
              const SizedBox(width: 8),
            ],
            Text(
              title,
              style: TextStyle(
                fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
                fontSize: isTotal ? 15 : 14,
                color: isDark ? (isTotal ? Colors.white : Colors.grey[300]) : (isTotal ? Colors.black87 : Colors.grey[700]),
              ),
            ),
          ],
        ),
        Text(
          status,
          style: TextStyle(
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600,
            fontSize: isTotal ? 15 : 13,
            fontStyle: FontStyle.italic,
            color: color ?? (isDark ? Colors.grey[400] : Colors.grey[600]),
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingState(Color accentColor, bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(strokeWidth: 2.5, valueColor: AlwaysStoppedAnimation<Color>(accentColor)),
          const SizedBox(height: 16),
          Text('Loading your cart...', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: isDark ? Colors.grey[400] : Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildCheckoutButton(double? total, bool isDark, Color accentColor, Color cardColor) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).padding.bottom),
      decoration: BoxDecoration(
        color: cardColor,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.1), blurRadius: 10, offset: const Offset(0, -2))],
        border: Border(top: BorderSide(color: isDark ? Colors.grey[800]! : Colors.grey[200]!)),
      ),
      child: ElevatedButton(
        onPressed: () {
          HapticFeedback.mediumImpact();
          Navigator.push(context, MaterialPageRoute(builder: (_) => const CheckoutScreen()));
        },
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 54),
          backgroundColor: accentColor,
          foregroundColor: isDark ? Colors.black : Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FaIcon(FontAwesomeIcons.arrowRight, size: 20),
            const SizedBox(width: 10),
            Text(
              total != null ? 'Continue to Checkout • ₹${total.toStringAsFixed(0)}' : 'Continue to Checkout',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScrollToTopFab(Color accentColor) {
    return Positioned(
      bottom: 100,
      right: 16,
      child: ScaleTransition(
        scale: _fabAnimation,
        child: FloatingActionButton(
          onPressed: () {
            HapticFeedback.selectionClick();
            _scrollController.animateTo(0, duration: const Duration(milliseconds: 500), curve: Curves.easeOut);
          },
          backgroundColor: accentColor,
          child: const Icon(Icons.arrow_upward, color: Colors.white),
        ),
      ),
    );
  }
}
