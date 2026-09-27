import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

// C3 (Firebase SDK removal, 27 September 2026 review continuation): this was a full Firestore
// CRUD service (create/cancel/approve/reject a seller deal, seller/pending/active deal streams,
// stock-sold increments, scheduled activation/expiry) -- of its 13 public methods, grepping every
// real (non-comment) caller anywhere in the app found exactly one still reachable:
// getActiveDealForProduct, called from 7 product-card-shaped widgets (product_card.dart,
// compact_product_card.dart, product_info_section.dart, seller_store_screen.dart,
// suggested_for_you_section.dart, related_products_section.dart, recently_viewed_widget.dart) as an
// optional "does this product have an active deal to badge?" check -- every one of those 7 already
// wraps the call in its own try/catch, so with no Firebase app ever initialized they were already
// silently, safely resolving to "no deal" (Firestore throws before any network round trip). The
// other 12 methods (including getActiveDeals(), the Firestore stream "2.5 Hot Deals Section" built
// directly and unguarded in initState -- a real crash risk, unlike this one -- see
// mobile_home_screen.dart's own doc comment for that section's deletion) had zero callers anywhere.
// Deals as a distinct entity have no canonical successor; "discounted listings" as a concept is
// otherwise already served canonically by DealCardsSection (deal_cards_section.dart), which computes
// it from ProductModel's own price fields, not from a separate DealModel/Firestore collection. This
// keeps only the one reachable method, with its exact original signature (so none of its 7 callers
// need to change), returning the same honest "no deal" every one of them already always got.
class DealService {
  Future<DealModel?> getActiveDealForProduct(String productId) async => null;
}
