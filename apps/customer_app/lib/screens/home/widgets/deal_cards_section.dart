// Deal Cards Section — discounted listings from the canonical marketplace feed.
//
// FB-2 (2026-09-05): this section read Firestore directly, ordering `products` by `viewCount`. The
// canonical feed has no popularity signal — it is keyset-ordered by `approved_at` — so the section
// now shows the newest approved listings that carry a discount. That is an honest degradation, not
// an equivalent: "trending" is a capability the canonical backend does not have yet, recorded in
// CAPABILITY_BACKLOG rather than faked with a different sort presented as the same thing.
//
// The discount is now COMPUTED from the gateway's `price` and `compare_price` instead of read from a
// stored `discount` field. Server-authoritative pricing is the rule for money everywhere else in
// this platform; a discount a client reads from a document is a number nobody recomputed.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

import '../../../data/marketplace_repository.dart';

/// Percent off, derived from the canonical pair. Returns 0 whenever a discount cannot be
/// established, and is never negative or above 100.
///
/// The `comparePrice <= 0 || price < 0` guard is load-bearing and not defensive noise: a compare
/// price of 0 makes the division Infinity, and `Infinity.floor()` THROWS rather than returning a
/// number, so a single bad row would take down the whole section. A negative price would otherwise
/// read as a confident "100% off" after clamping. Both are covered by their own tests, each
/// observed failing with that guard removed.
///
/// `comparePrice <= price` is redundant with the clamp — an inverted pair already floors to a
/// negative and clamps to 0 — and is kept only because it states the intent at the point of the
/// check. Do not read it as the thing preventing negative output; the clamp is.
int discountPercent({num? price, num? comparePrice}) {
  if (price == null || comparePrice == null) return 0;
  if (comparePrice <= 0 || price < 0) return 0;
  if (comparePrice <= price) return 0;
  final pct = ((comparePrice - price) / comparePrice) * 100;
  return pct.floor().clamp(0, 100);
}

class DealCardsSection extends StatefulWidget {
  const DealCardsSection({super.key, this.repository});

  /// Injected in tests. Production builds resolve the canonical repository from the provider tree.
  final MarketplaceRepository? repository;

  @override
  State<DealCardsSection> createState() => _DealCardsSectionState();
}

class _DealCardsSectionState extends State<DealCardsSection> {
  Future<List<MarketplaceFeedItem>>? _deals;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _deals ??= _load();
  }

  Future<List<MarketplaceFeedItem>> _load() async {
    final repo = widget.repository ?? context.read<MarketplaceRepository>();
    // Ask for more than we render: the discount filter runs client-side because the gateway has no
    // "on sale" predicate, so a page of 10 could come back with nothing to show.
    final page = await repo.feed(limit: 30);
    return page.items
        .where((item) => discountPercent(price: item.price, comparePrice: item.comparePrice) > 0)
        .take(10)
        .toList(growable: false);
  }

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
    return FutureBuilder<List<MarketplaceFeedItem>>(
      future: _deals,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(strokeWidth: 2));
        }

        // A failed read is shown as a failed read. Falling through to the empty state would tell a
        // shopper there are no deals when the truth is that we could not find out.
        if (snapshot.hasError) {
          return Center(
            child: Text(
              "Couldn't load deals",
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 12,
              ),
            ),
          );
        }

        final deals = snapshot.data ?? const <MarketplaceFeedItem>[];
        if (deals.isEmpty) {
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
          itemCount: deals.length,
          itemBuilder: (context, index) {
            return _buildDealCard(deals[index], isDark, context);
          },
        );
      },
    );
  }

  Widget _buildDealCard(MarketplaceFeedItem deal, bool isDark, BuildContext context) {
    final discount = discountPercent(price: deal.price, comparePrice: deal.comparePrice);

    // Deterministic per-listing tint. `abs()` matters: hashCode is signed, and a negative index
    // throws rather than wrapping.
    final colors = [
      Colors.pink.shade100,
      AppColors.infoLight.withValues(alpha: 0.3),
      AppColors.successLight.withValues(alpha: 0.3),
      AppColors.warningLight.withValues(alpha: 0.3),
      AppColors.accentLight.withValues(alpha: 0.3),
      AppColors.primaryLighter.withValues(alpha: 0.3),
    ];
    final bgColor = colors[deal.listingId.hashCode.abs() % colors.length];

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.pushNamed(
          context,
          AppRoutes.productDetails,
          // The canonical detail route is addressed by LISTING id — that is what
          // GET /storefront/marketplace/listings/:id takes, and it is what carries the
          // marketplace fence. A product id would identify the merchant's product without
          // saying anything about whether it is publicly listed.
          arguments: deal.listingId,
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
                    imageUrl: deal.images.isNotEmpty ? deal.images.first : '',
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
                  if (discount > 0)
                    Text(
                      'Up to $discount% Off',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: AppColors.success,
                      ),
                    ),
                  const SizedBox(height: 2),
                  // Category/Name
                  Text(
                    deal.name,
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
