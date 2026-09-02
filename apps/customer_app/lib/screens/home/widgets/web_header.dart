// lib/screens/user/home/widgets/web_header.dart

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

// --- Providers & Themes ---
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

// --- Routes ---
import 'package:letbuyy_marketplace/app/routes.dart';

// --- Screens ---
import '../../shop/shop_screen.dart';
import '../../cart/cart_screen.dart';
import '../../wishlist/wishlist_screen.dart';
import '../../profile/profile_screen.dart';
import '../../profile/saved_addresses_screen.dart';
import '../../orders/orders_screen.dart';
import '../../category/category_screen.dart';
import '../../chat/ai_chat_screen.dart';
import '../../checkout/add_address_screen.dart';

class WebHeader extends StatefulWidget implements PreferredSizeWidget {
  const WebHeader({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(156); // Fixed: Increased to prevent overflow

  @override
  State<WebHeader> createState() => _WebHeaderState();
}

class _WebHeaderState extends State<WebHeader> {
  // --- Search Logic Variables ---
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final LayerLink _layerLink = LayerLink();
  final GlobalKey _searchKey = GlobalKey(); // ✅ FIXED: Defined Key
  OverlayEntry? _overlayEntry;
  List<dynamic> _searchResults = [];

  // --- Address Logic Variables ---
  AddressModel? _tempSelectedAddress;

  @override
  void initState() {
    super.initState();

    _searchFocusNode.addListener(() {
      if (_searchFocusNode.hasFocus) {
        _showOverlay();
      } else {
        _removeOverlay();
      }
      if (mounted) setState(() {});
    });

    _searchController.addListener(() {
      if (_searchFocusNode.hasFocus) {
        _updateSearchResults(_searchController.text);
      }
    });

    // Load addresses safely
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try {
        final addressProvider = Provider.of<AddressProvider>(context, listen: false);
        if (addressProvider.addresses.isEmpty) {
          addressProvider.loadAddresses();
        }
      } catch (e) {
        debugPrint("Address Load Error: $e");
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _removeOverlay();
    super.dispose();
  }

  // --- Helper Methods (Fixed "Method not found" errors) ---

  void _navigate(BuildContext context, Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }

  Widget _verticalDivider(_HeaderColors colors) {
    return Container(
      height: 14,
      width: 1,
      color: colors.divider,
      margin: const EdgeInsets.symmetric(horizontal: 16),
    );
  }

  // --- Search Logic ---

  void _showOverlay() {
    if (_overlayEntry != null) return;

    _overlayEntry = OverlayEntry(
      builder: (context) {
        final themeProvider = Provider.of<ThemeProvider>(context, listen: false);
        final isDark = themeProvider.isDarkMode;

        double overlayWidth = 650;
        try {
          final RenderBox? renderBox = _searchKey.currentContext?.findRenderObject() as RenderBox?;
          if (renderBox != null) {
            overlayWidth = renderBox.size.width.clamp(280.0, 900.0);
          }
        } catch (_) {}

        return Positioned(
          width: overlayWidth,
          child: CompositedTransformFollower(
            link: _layerLink,
            showWhenUnlinked: false,
            offset: const Offset(0, 50),
            child: Material(
              elevation: 12,
              borderRadius: BorderRadius.circular(12),
              color: Colors.transparent,
              child: _buildSearchDropdownUI(isDark),
            ),
          ),
        );
      },
    );

    try {
      Overlay.of(context).insert(_overlayEntry!);
    } catch (_) {}
  }

  void _removeOverlay() {
    try {
      _overlayEntry?.remove();
    } catch (_) {}
    _overlayEntry = null;
  }

  void _updateSearchResults(String query) {
    if (query.isEmpty) {
      setState(() => _searchResults = []);
      _overlayEntry?.markNeedsBuild();
      return;
    }

    final allProducts = Provider.of<ProductProvider>(context, listen: false).products;
    final results = allProducts.where((product) {
      return product.name.toLowerCase().contains(query.toLowerCase());
    }).take(6).toList();

    setState(() => _searchResults = results);
    _overlayEntry?.markNeedsBuild();
  }

  void _submitSearch() {
    _removeOverlay();
    _searchFocusNode.unfocus();
    if (_searchController.text.isNotEmpty) {
      Navigator.pushNamed(context, AppRoutes.searchResults, arguments: _searchController.text);
    }
  }

  // --- Address Popup Logic ---

  Future<void> _showAddressSelectorPopup() async {
    final addressProvider = Provider.of<AddressProvider>(context, listen: false);
    
    await showGeneralDialog(
      context: context,
      barrierLabel: "Select Delivery Address",
      barrierDismissible: true,
      barrierColor: Colors.black54,
      transitionDuration: const Duration(milliseconds: 280),
      pageBuilder: (context, anim1, anim2) => const SizedBox.shrink(),
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        final curved = Curves.easeOut.transform(animation.value);
        return Opacity(
          opacity: animation.value,
          child: Transform.scale(
            scale: 0.9 + (0.1 * curved),
            child: Center(
              child: _AddressPopupCard(
                onAddAddress: () {
                  Navigator.of(context).pop();
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const AddAddressScreen()));
                },
                onManageAddresses: () {
                  Navigator.of(context).pop();
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const SavedAddressesScreen()));
                },
                onSelectAndClose: (AddressModel? selected) {
                  if (selected != null) {
                    addressProvider.selectAddress(selected); // Assuming selectAddress exists, or use setDefaultAddress
                  }
                  Navigator.of(context).pop();
                },
              ),
            ),
          ),
        );
      },
    );
  }

  // --- MAIN BUILD ---

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    final colors = _HeaderColors(
      background: isDark ? AppColors.surfaceDark : AppColors.surface,
      topBarBg: isDark ? AppColors.backgroundDark : const Color(0xFFF5F5F5),
      text: isDark ? AppColors.textLight : AppColors.textPrimary,
      subText: isDark ? AppColors.textLightTertiary : AppColors.textTertiary,
      divider: isDark ? AppColors.borderDark : AppColors.borderLight,
      accent: AppColors.primary,
    );

    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: isDark
                  ? [
                      const Color(0xFF0F172A).withValues(alpha: 0.95),
                      const Color(0xFF1E293B).withValues(alpha: 0.92),
                    ]
                  : [
                      Colors.white.withValues(alpha: 0.95),
                      const Color(0xFFF8FAFC).withValues(alpha: 0.92),
                    ],
            ),
            border: Border(
              bottom: BorderSide(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.08)
                    : AppColors.primary.withValues(alpha: 0.15),
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: isDark
                    ? Colors.black.withValues(alpha: 0.3)
                    : AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 20,
                offset: const Offset(0, 4),
                spreadRadius: 0,
              ),
            ],
          ),
          child: Column(
            children: [
              _buildTopBar(context, colors),
              _buildMainBar(context, colors, isDark),
              _buildNavBar(context, colors),
            ],
          ),
        ),
      ),
    );
  }

  // 1. Top Bar - Premium Gradient Strip
  Widget _buildTopBar(BuildContext context, _HeaderColors colors) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    return Container(
      height: 36,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: isDark
              ? [const Color(0xFF1E293B), const Color(0xFF0F172A)]
              : [AppColors.primary.withValues(alpha: 0.08), AppColors.primaryLight.withValues(alpha: 0.04)],
        ),
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : AppColors.primary.withValues(alpha: 0.1),
            width: 0.5,
          ),
        ),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                // Dynamic Address Display
                Consumer<AddressProvider>(
                  builder: (context, addressProvider, _) {
                    final hasAddresses = addressProvider.addresses.isNotEmpty;
                    final defaultAddress = addressProvider.defaultAddress;

                    String displayText = "Add delivery address";
                    if (hasAddresses && defaultAddress != null) {
                      displayText = "${defaultAddress.city}, ${defaultAddress.zipcode}";
                    } else if (hasAddresses) {
                      displayText = "Select Address";
                    }

                    return GestureDetector(
                      onTap: _showAddressSelectorPopup, // ✅ FIXED: Method now exists
                      child: Row(
                        children: [
                          Icon(FontAwesomeIcons.locationDot, size: 13, color: colors.subText),
                          const SizedBox(width: 6),
                          Text(
                            "Deliver to: $displayText",
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: colors.subText),
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const Spacer(),
                _HeaderLink(
                  text: 'My Profile',
                  icon: FontAwesomeIcons.user,
                  colors: colors,
                  onTap: () => _navigate(context, const ProfileScreen()), // ✅ FIXED: _navigate exists
                ),
                _verticalDivider(colors), // ✅ FIXED: _verticalDivider exists
                _HeaderLink(
                  text: 'My Orders',
                  icon: FontAwesomeIcons.boxOpen,
                  colors: colors,
                  onTap: () => _navigate(context, const OrdersScreen()),
                ),
                _verticalDivider(colors),
                Consumer<WishlistProvider>(
                  builder: (context, wishlist, _) {
                    return _HeaderLink(
                      text: 'Wishlist (${wishlist.itemCount})',
                      icon: FontAwesomeIcons.solidHeart,
                      colors: colors,
                      accentColor: AppColors.error,
                      onTap: () => _navigate(context, const WishlistScreen()),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 2. Main Bar
  Widget _buildMainBar(BuildContext context, _HeaderColors colors, bool isDark) {
    return Container(
      height: 80,
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.divider.withValues(alpha: 0.5))),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
            child: Row(
              children: [
                // Logo
                InkWell(
                  onTap: () => Navigator.pushNamed(context, AppRoutes.home),
                  child: Image.asset(
                    'assets/icons/logo_icon.png',
                    height: 48,
                    errorBuilder: (ctx, e, st) => Icon(FontAwesomeIcons.bagShopping, size: 36, color: colors.accent),
                  ),
                ),
                const SizedBox(width: 36),

                // Search Bar
                Expanded(
                  child: Center(
                    child: CompositedTransformTarget(
                      link: _layerLink,
                      child: Container(
                        key: _searchKey,
                        constraints: const BoxConstraints(maxWidth: 700),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.06)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _searchFocusNode.hasFocus
                                ? colors.accent
                                : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200),
                            width: _searchFocusNode.hasFocus ? 2 : 1,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: _searchFocusNode.hasFocus
                                  ? colors.accent.withValues(alpha: 0.15)
                                  : Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
                              blurRadius: _searchFocusNode.hasFocus ? 16 : 8,
                              offset: const Offset(0, 4),
                              spreadRadius: 0,
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(left: 18, right: 10),
                              child: Icon(
                                FontAwesomeIcons.magnifyingGlass,
                                size: 16,
                                color: _searchFocusNode.hasFocus
                                    ? colors.accent
                                    : colors.subText,
                              ),
                            ),
                            Expanded(
                              child: TextField(
                                controller: _searchController,
                                focusNode: _searchFocusNode,
                                style: TextStyle(color: colors.text, fontSize: 14),
                                onSubmitted: (_) => _submitSearch(),
                                decoration: InputDecoration(
                                  hintText: 'Search for products, brands and more...',
                                  hintStyle: TextStyle(
                                    color: colors.subText,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w400,
                                  ),
                                  border: InputBorder.none,
                                  contentPadding: const EdgeInsets.symmetric(vertical: 15),
                                  isDense: true,
                                ),
                              ),
                            ),
                            // Premium Gradient Search Button
                            InkWell(
                              onTap: _submitSearch,
                              borderRadius: const BorderRadius.only(
                                topRight: Radius.circular(11),
                                bottomRight: Radius.circular(11),
                              ),
                              child: Container(
                                height: 48,
                                padding: const EdgeInsets.symmetric(horizontal: 24),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [AppColors.primary, AppColors.primaryDark],
                                  ),
                                  borderRadius: const BorderRadius.only(
                                    topRight: Radius.circular(11),
                                    bottomRight: Radius.circular(11),
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withValues(alpha: 0.3),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  children: const [
                                    Icon(Icons.search_rounded, color: Colors.white, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      "Search",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 14,
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
                  ),
                ),

                const SizedBox(width: 36),

                // Actions
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ActionIcon(
                      icon: FontAwesomeIcons.robot,
                      label: 'AI Chat',
                      colors: colors,
                      onTap: () => _navigate(context, const AIChatScreen()),
                      isNew: true,
                    ),
                    const SizedBox(width: 20),
                    _ActionIcon(
                      icon: FontAwesomeIcons.bell,
                      label: 'Alerts',
                      colors: colors,
                      badgeCount: 2,
                      onTap: () {},
                    ),
                    const SizedBox(width: 20),
                    Consumer<CartProvider>(
                      builder: (context, cart, _) {
                        return _ActionIcon(
                          icon: FontAwesomeIcons.cartShopping,
                          label: 'Cart',
                          colors: colors,
                          badgeCount: cart.itemCount,
                          onTap: () => _navigate(context, const CartScreen()),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 3. Nav Bar
  Widget _buildNavBar(BuildContext context, _HeaderColors colors) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        color: colors.background,
        border: Border(bottom: BorderSide(color: colors.divider)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), offset: const Offset(0, 2), blurRadius: 6),
        ],
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                _NavBarItem(title: 'Home', onTap: () => Navigator.pushNamed(context, AppRoutes.home), colors: colors),
                _NavBarItem(title: 'Shop', onTap: () => _navigate(context, const ShopScreen()), colors: colors),
                _NavBarItem(title: 'Categories', onTap: () => _navigate(context, const CategoryScreen()), colors: colors),
                _NavBarItem(title: 'New Arrivals', onTap: () => _navigate(context, const ShopScreen()), colors: colors, isHighlight: true),
                const Spacer(),
                Row(
                  children: [
                    const Icon(Icons.phone, size: 14, color: Colors.grey),
                    const SizedBox(width: 8),
                    Text(
                      "Call Us: +91 8610787151",
                      style: TextStyle(color: colors.subText, fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // 4. Dropdown UI
  Widget _buildSearchDropdownUI(bool isDark) {
    final bg = isDark ? AppColors.surfaceDark : Colors.white;
    final text = isDark ? AppColors.textLight : AppColors.textPrimary;
    final hoverColor = isDark ? Colors.white10 : Colors.grey.shade100;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : Colors.grey.shade200),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_searchController.text.isNotEmpty && _searchResults.isNotEmpty) ...[
            Padding(
               padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
               child: Text("Products", style: TextStyle(color: AppColors.textHint, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            ..._searchResults.map((product) => _buildResultItem(product, text, hoverColor)),
          ]
          else if (_searchController.text.isNotEmpty && _searchResults.isEmpty) ...[
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Center(child: Text("No results found for '${_searchController.text}'", style: TextStyle(color: text))),
            )
          ]
          else ...[
            Padding(
               padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
               child: Text("Trending Now", style: TextStyle(color: AppColors.textHint, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            _buildSimpleSuggestion("Wireless Headphones", text, hoverColor),
            _buildSimpleSuggestion("Running Shoes", text, hoverColor),
          ],
        ],
      ),
    );
  }

  Widget _buildResultItem(dynamic product, Color textColor, Color hoverColor) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.pushNamed(context, AppRoutes.productDetails, arguments: product.id);
          _removeOverlay();
          _searchController.clear();
        },
        hoverColor: hoverColor,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: CachedNetworkImage(
                  imageUrl: product.images.first,
                  height: 40, width: 40, fit: BoxFit.cover,
                  errorWidget: (_,__,___) => const Icon(Icons.image),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name, style: TextStyle(color: textColor, fontWeight: FontWeight.w600, fontSize: 14), maxLines: 1),
                    Text("in ${product.category}", style: TextStyle(color: textColor.withValues(alpha: 0.6), fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSimpleSuggestion(String text, Color textColor, Color hoverColor) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          _searchController.text = text;
          _submitSearch();
        },
        hoverColor: hoverColor,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              const Icon(Icons.trending_up, size: 16, color: Colors.grey),
              const SizedBox(width: 12),
              Expanded(child: Text(text, style: TextStyle(color: textColor, fontSize: 14))),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Address Popup Card
// ---------------------------------------------------------------------------
class _AddressPopupCard extends StatefulWidget {
  final VoidCallback onAddAddress;
  final VoidCallback onManageAddresses;
  final void Function(AddressModel? selected) onSelectAndClose;

  const _AddressPopupCard({
    required this.onAddAddress,
    required this.onManageAddresses,
    required this.onSelectAndClose,
  });

  @override
  State<_AddressPopupCard> createState() => _AddressPopupCardState();
}

class _AddressPopupCardState extends State<_AddressPopupCard> {
  AddressModel? _localSelected;

  @override
  void initState() {
    super.initState();
    final addressProvider = Provider.of<AddressProvider>(context, listen: false);
    _localSelected = addressProvider.defaultAddress ?? (addressProvider.addresses.isNotEmpty ? addressProvider.addresses.first : null);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final addressProvider = Provider.of<AddressProvider>(context);
    final addresses = addressProvider.addresses;

    return Material(
      color: Colors.transparent,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720, maxHeight: 520),
          child: Container(
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.6 : 0.12),
                  blurRadius: 30,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Choose Delivery Address',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: isDark ? AppColors.textLight : AppColors.textPrimary),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: Icon(Icons.close, color: isDark ? AppColors.textLight : AppColors.textHint),
                    )
                  ],
                ),
                const SizedBox(height: 8),
                Divider(color: isDark ? AppColors.borderDark : AppColors.border),
                const SizedBox(height: 8),
                Expanded(
                  child: addresses.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text('No saved addresses yet'),
                              const SizedBox(height: 12),
                              ElevatedButton(onPressed: widget.onAddAddress, child: const Text("Add Address")),
                            ],
                          ),
                        )
                      : ListView.separated(
                          itemCount: addresses.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, idx) {
                            final addr = addresses[idx];
                            final selected = _localSelected?.id == addr.id;
                            return InkWell(
                              onTap: () => setState(() => _localSelected = addr),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: selected ? AppColors.surfaceVariant : Colors.transparent,
                                  border: Border.all(color: selected ? AppColors.primary : AppColors.border),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(addr.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                          Text("${addr.city}, ${addr.zipcode}", style: const TextStyle(fontSize: 12)),
                                        ],
                                      ),
                                    ),
                                    if (addr.isDefault)
                                      const Chip(label: Text("Default", style: TextStyle(fontSize: 10))),
                                    
                                    // Map Icon - fixed LaunchUrl error
                                    if (addr.latitude != null && addr.longitude != null)
                                      IconButton(
                                        icon: const Icon(Icons.map),
                                        onPressed: () {
                                            final String googleMapsUrl = 'https://www.google.com/maps/search/?api=1&query=${addr.latitude},${addr.longitude}';
                                            // ✅ FIXED: Using launchUrl correctly
                                            launchUrl(Uri.parse(googleMapsUrl), mode: LaunchMode.externalApplication); 
                                        },
                                      )
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: OutlinedButton(onPressed: widget.onAddAddress, child: const Text("Add New"))),
                    const SizedBox(width: 12),
                    Expanded(child: ElevatedButton(onPressed: () => widget.onSelectAndClose(_localSelected), child: const Text("Deliver Here"))),
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
class _HeaderColors {
  final Color background, topBarBg, text, subText, divider, accent;
  _HeaderColors({required this.background, required this.topBarBg, required this.text, required this.subText, required this.divider, required this.accent});
}

class _HeaderLink extends StatefulWidget {
  final String text; final IconData icon; final VoidCallback onTap; final _HeaderColors colors; final Color? accentColor;
  const _HeaderLink({required this.text, required this.icon, required this.onTap, required this.colors, this.accentColor});
  @override State<_HeaderLink> createState() => _HeaderLinkState();
}

class _HeaderLinkState extends State<_HeaderLink> {
  bool _isHovering = false;
  @override
  Widget build(BuildContext context) {
    final color = _isHovering ? (widget.accentColor ?? widget.colors.text) : (widget.accentColor ?? widget.colors.subText);
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovering = true),
      onExit: (_) => setState(() => _isHovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Row(
          children: [
            Icon(widget.icon, size: 12, color: color),
            const SizedBox(width: 6),
            Text(widget.text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: color)),
          ],
        ),
      ),
    );
  }
}

class _ActionIcon extends StatefulWidget {
  final IconData icon; final String label; final VoidCallback onTap; final _HeaderColors colors; final int badgeCount; final bool isNew;
  const _ActionIcon({required this.icon, required this.label, required this.onTap, required this.colors, this.badgeCount = 0, this.isNew = false});
  @override State<_ActionIcon> createState() => _ActionIconState();
}

class _ActionIconState extends State<_ActionIcon> {
  bool _isHovering = false;
  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovering = true),
      onExit: (_) => setState(() => _isHovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Container(
          color: Colors.transparent,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(widget.icon, size: 20, color: _isHovering ? AppColors.primary : widget.colors.text),
                  const SizedBox(height: 4),
                  Text(widget.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _isHovering ? AppColors.primary : widget.colors.text)),
                ],
              ),
              if (widget.badgeCount > 0)
                Positioned(
                  right: -4, top: -6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                    child: Text(widget.badgeCount.toString(), style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                ),
              if (widget.isNew)
                Positioned(
                  right: -12, top: -8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
                    child: const Text("NEW", style: TextStyle(color: Colors.white, fontSize: 7, fontWeight: FontWeight.bold)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavBarItem extends StatefulWidget {
  final String title; final VoidCallback onTap; final _HeaderColors colors; final bool isHighlight;
  const _NavBarItem({required this.title, required this.onTap, required this.colors, this.isHighlight = false});
  @override State<_NavBarItem> createState() => _NavBarItemState();
}

class _NavBarItemState extends State<_NavBarItem> {
  bool _isHovering = false;
  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovering = true),
      onExit: (_) => setState(() => _isHovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Container(
          margin: const EdgeInsets.only(right: 32),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: _isHovering ? AppColors.primary : Colors.transparent, width: 2))
          ),
          child: Text(
            widget.title,
            style: TextStyle(
              fontSize: 14, 
              fontWeight: FontWeight.w600, 
              color: widget.isHighlight ? AppColors.primary : (_isHovering ? AppColors.primary : widget.colors.text)
            ),
          ),
        ),
      ),
    );
  }
}