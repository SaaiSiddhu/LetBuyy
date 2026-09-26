// Mobile Home Screen - Professional Home with Glassmorphic Design
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/screens/home/widgets/web_mobile_footer.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

import 'widgets/banner_carousel_section.dart';
import 'widgets/rate_your_purchases_section.dart';
import 'widgets/sponsored_products_section.dart';
import 'widgets/deal_cards_section.dart';
import 'widgets/deals_section.dart';
import 'widgets/suggested_for_you_section.dart';
import 'widgets/all_products_grid.dart';
import 'widgets/address_selection_sheet.dart';
import 'widgets/home_app_bar.dart';
import '../../widgets/premium_scaffold.dart';

class MobileHomeScreen extends StatefulWidget {
  const MobileHomeScreen({super.key});

  @override
  State<MobileHomeScreen> createState() => _MobileHomeScreenState();
}

class _MobileHomeScreenState extends State<MobileHomeScreen>
    with TickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  
  // 🚀 WEB OPTIMIZATION: Keep state alive when switching tabs
  @override
  bool get wantKeepAlive => true;
  
  final ScrollController _scrollController = ScrollController();
  
  // Animation Controllers
  // Animation Controllers
  // Moving animations to PremiumScaffold
  
  String? _selectedCategoryId;
  AddressModel? _selectedAddress;
  bool _isRefreshing = false;
  double _scrollOffset = 0;

  // ✅ LAZY LOADING: Section visibility flags (only render when scrolled into view)
  bool _showSponsoredProducts = false;
  bool _showDealCards = false;
  bool _showSuggestedForYou = false;
  bool _showAllProducts = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadData();
  }

  @override
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    final offset = _scrollController.offset;
    setState(() {
      _scrollOffset = offset;
      
      // ✅ LAZY LOADING: Progressively show sections as user scrolls
      // Thresholds are approximate heights where sections would become visible
      if (offset > 100 && !_showSponsoredProducts) _showSponsoredProducts = true;
      if (offset > 300 && !_showDealCards) _showDealCards = true;
      if (offset > 500 && !_showSuggestedForYou) _showSuggestedForYou = true;
      if (offset > 700 && !_showAllProducts) _showAllProducts = true;
    });
  }

  void _loadData() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      
      // 🚀 PERFORMANCE: Load from cache first for instant UI
      final productProvider = Provider.of<ProductProvider>(context, listen: false);
      final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);
      
      // Load from cache (instant) → then refresh from Firestore in background
      productProvider.initializeFromCache();
      categoryProvider.initializeFromCache();
    });
  }


  void _showAddressSheet() async {
    HapticFeedback.mediumImpact();
    final selectedAddress = await AddressSelectionSheet.show(context);
    if (selectedAddress != null && mounted) {
      setState(() => _selectedAddress = selectedAddress);
    }
  }


  @override
  Widget build(BuildContext context) {
    super.build(context); // 🚀 Required for AutomaticKeepAlive
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final statusBarHeight = MediaQuery.of(context).padding.top;
    
    // Calculate collapse progress (0 = expanded, 1 = collapsed)
    final double collapseProgress = (_scrollOffset / 80).clamp(0.0, 1.0);
    
    // Header heights
    final double addressBarHeight = 44 * (1 - collapseProgress);
    
    // 🌐 WEB FIX: Skip PremiumScaffold on web (WebMainScreen provides the Scaffold)
    final content = Stack(
      children: [
        // Main Scrollable Content
        RefreshIndicator(
          onRefresh: _handleRefresh,
          color: AppColors.primary,
          child: CustomScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            slivers: [
              // Spacer for sticky header (only on native mobile)
              if (!kIsWeb) SliverToBoxAdapter(
                child: SizedBox(
                  height: statusBarHeight + 52 + addressBarHeight + 16,
                ),
              ),

              // 1. Banner Carousel
              // 🚀 WEB OPTIMIZATION: Skip animations on web
              SliverToBoxAdapter(
                child: kIsWeb 
                    ? const BannerCarouselSection()
                    : const BannerCarouselSection().animate().fadeIn(duration: 600.ms, delay: 200.ms),
              ),


              // 2. Rate Your Purchases Section
              SliverToBoxAdapter(
                child: kIsWeb 
                    ? const RateYourPurchasesSection()
                    : const RateYourPurchasesSection().animate().fadeIn(duration: 600.ms, delay: 300.ms),
              ),

              // 2.5 Hot Deals Section (Seller Promotional Deals)
              SliverToBoxAdapter(
                child: kIsWeb 
                    ? const DealsSection()
                    : const DealsSection().animate().fadeIn(duration: 600.ms, delay: 350.ms),
              ),

              // 3. Sponsored Products - LAZY LOADED
              if (_showSponsoredProducts)
                SliverToBoxAdapter(
                  child: kIsWeb 
                      ? const SponsoredProductsSection()
                      : const SponsoredProductsSection().animate().fadeIn(duration: 400.ms),
                )
              else
                const SliverToBoxAdapter(child: SizedBox(height: 200)),

              // 4. Deal Cards - LAZY LOADED
              if (_showDealCards)
                SliverToBoxAdapter(
                  child: kIsWeb 
                      ? const DealCardsSection()
                      : const DealCardsSection().animate().fadeIn(duration: 400.ms),
                )
              else
                const SliverToBoxAdapter(child: SizedBox(height: 200)),

              // 5. Suggested For You - LAZY LOADED
              if (_showSuggestedForYou)
                SliverToBoxAdapter(
                  child: kIsWeb 
                      ? const SuggestedForYouSection()
                      : const SuggestedForYouSection().animate().fadeIn(duration: 400.ms),
                )
              else
                const SliverToBoxAdapter(child: SizedBox(height: 200)),

              // 6. All Products Grid - LAZY LOADED (already a sliver - no animate())
              if (_showAllProducts)
                const AllProductsGrid()
              else
                const SliverToBoxAdapter(child: SizedBox(height: 300)),

              // Bottom Padding & Footer
              const SliverToBoxAdapter(
                child: SizedBox(height: 40),
              ),

              if (kIsWeb)
                const SliverToBoxAdapter(
                  child: WebMobileFooter(),
                ),

              const SliverToBoxAdapter(
                child: SizedBox(height: 100),
              ),
            ],
          ),
        ),

        // Sticky Header Overlay with Glassmorphism
        // 🌐 Web: Skip internal header (WebMainScreen provides WebMobileHeader)
        if (!kIsWeb)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: HomeAppBar(
              scrollOffset: _scrollOffset,
            ),
          ),
      ],
    );

    // 🌐 On web, return content directly (WebMainScreen provides Scaffold)
    // On native mobile, wrap with PremiumScaffold
    if (kIsWeb) {
      return content;
    }

    return PremiumScaffold(body: content);
  }

  Future<void> _handleRefresh() async {
    setState(() => _isRefreshing = true);
    HapticFeedback.mediumImpact();

    // 🚀 Use forceReload: true for pull-to-refresh to bypass cache
    await Future.wait([
      Provider.of<ProductProvider>(context, listen: false).loadProducts(forceReload: true),
      Provider.of<CategoryProvider>(context, listen: false).loadCategories(forceReload: true),
    ]);

    setState(() => _isRefreshing = false);
  }
}
