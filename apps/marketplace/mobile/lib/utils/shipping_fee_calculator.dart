import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

// Phase 1R shipping-semantics correction (owner-requested completion, same day): the previous
// version of this file (which itself had only just consolidated cart/checkout's two independently
// -written totals into one shared function) still defaulted a missing shipping price to ₹40, a
// missing delivery estimate to "2-3" days, and derived an express fee from a fabricated +₹9 on top
// of that same fallback -- three unsupported claims layered on top of each other, all producing a
// number/date that LOOKED authoritative but was invented client-side. Today's canonical gateway
// response (see product_provider.dart's own _productFromListingDetail) never actually returns
// shippingPrice/shippingDays/isFreeDelivery/expressDelivery for a real product at all, so every one
// of those fallbacks fired on every single real cart, 100% of the time -- this was not a rare edge
// case, it was the only case. The fix is not a different default: it is not defaulting. "We don't
// know" and "it's confirmed free" must never collapse into the same plain double.

/// The shipping-relevant state of one cart line's product lookup. A sealed type so every
/// consumer must handle every case explicitly, rather than a `??` silently picking one.
sealed class ItemShippingFee {
  const ItemShippingFee();
}

/// A real fee from the product's own data -- including exactly ₹0 for a product the backend has
/// confirmed is free delivery. This is the ONLY path to a zero value; nothing else on this page
/// ever produces a zero as a stand-in for "unknown."
final class KnownFee extends ItemShippingFee {
  final double amount;
  const KnownFee(this.amount);

  @override
  bool operator ==(Object other) => other is KnownFee && other.amount == amount;
  @override
  int get hashCode => amount.hashCode;
}

/// The product hasn't been fetched yet (or its fetch is still in flight). Distinct from
/// [UnknownShippingFee] (fetched successfully, but the response carried no shipping data) so a
/// screen can show a loading state instead of silently treating "not checked yet" as "free."
final class LoadingShippingFee extends ItemShippingFee {
  const LoadingShippingFee();
}

/// The product was fetched successfully but its shipping price is genuinely absent from the
/// response. An honest "we don't know," never defaulted to a number.
final class UnknownShippingFee extends ItemShippingFee {
  const UnknownShippingFee();
}

/// The product fetch itself failed (network error, non-2xx, etc.) rather than succeeding with an
/// empty result. Distinct from [UnknownShippingFee] because it is retry-shaped, not a permanent
/// "this product carries no shipping data" fact.
final class FailedShippingFee extends ItemShippingFee {
  const FailedShippingFee();
}

/// One cart item's product-lookup outcome, as tracked by whichever screen is driving
/// [cartShippingFees] (`_productCache` in mobile_cart_screen.dart / checkout_screen.dart). A key
/// simply absent from the lookup map means "still loading" -- there is deliberately no explicit
/// "loading" variant here to store, since a screen only ever writes an entry once a fetch has
/// actually settled.
sealed class ProductLookup {
  const ProductLookup();
}

final class ProductLoaded extends ProductLookup {
  final ProductModel product;
  const ProductLoaded(this.product);
}

final class ProductLookupFailed extends ProductLookup {
  const ProductLookupFailed();
}

/// One cart item's shipping fee, given its product lookup (or the lack of one).
ItemShippingFee itemShippingFee(ProductLookup? lookup) {
  switch (lookup) {
    case null:
      return const LoadingShippingFee();
    case ProductLookupFailed():
      return const FailedShippingFee();
    case ProductLoaded(:final product):
      if (product.isFreeDelivery == true) return const KnownFee(0);
      final price = product.shippingPrice;
      return price != null ? KnownFee(price) : const UnknownShippingFee();
  }
}

/// The one true shipping-fee computation every screen (cart, checkout, payment) calls, keyed by
/// each cart line's own unique [CartItemModel.id] -- never by product display name (two different
/// products can share a name) and never by product id alone (two different cart lines of the same
/// product, e.g. different variants, must not overwrite each other's entry; the underlying product
/// *fetch* is still deduplicated by product id in [lookups], but each line gets its own fee here).
/// Item order in [items] never affects the result -- this returns a Map, not an accumulator that
/// picks its "standard" fee from whichever item happens to be seen first.
Map<String, ItemShippingFee> cartShippingFees(
  List<CartItemModel> items,
  Map<String, ProductLookup> lookups,
) {
  final result = <String, ItemShippingFee>{};
  for (final item in items) {
    // A free promotional/bundled item has no shipping charge of its own by construction, not
    // because its product lookup happened to come back empty -- this is a KnownFee(0), same as
    // any other backend-confirmed free-delivery line.
    result[item.id] = item.isFreeItem ? const KnownFee(0) : itemShippingFee(lookups[item.productId]);
  }
  return result;
}

/// The cart-wide shipping summary every screen renders.
class CartShippingSummary {
  final Map<String, ItemShippingFee> perItem;
  const CartShippingSummary(this.perItem);

  factory CartShippingSummary.compute(
    List<CartItemModel> items,
    Map<String, ProductLookup> lookups,
  ) =>
      CartShippingSummary(cartShippingFees(items, lookups));

  bool get isEmpty => perItem.isEmpty;
  bool get anyLoading => perItem.values.any((f) => f is LoadingShippingFee);
  bool get anyFailed => perItem.values.any((f) => f is FailedShippingFee);
  bool get anyUnknown => perItem.values.any((f) => f is UnknownShippingFee);

  /// True only when every line has a real, backend-confirmed fee (including a confirmed ₹0).
  /// This is the ONLY condition under which a single combined "Total Amount" may honestly be
  /// shown -- mixing known and unknown/loading/failed lines and presenting their partial sum as
  /// if it were the complete shipping cost is exactly the fabrication this file exists to stop.
  bool get allKnown => perItem.isNotEmpty && perItem.values.every((f) => f is KnownFee);

  /// The sum of whichever lines happen to be [KnownFee] so far. Only meaningful to *display* as
  /// "the shipping total" when [allKnown] is also true -- callers must check [allKnown] first;
  /// this getter itself does not enforce that, so it can still be used for e.g. "at least ₹X so
  /// far" wording if a screen ever wants it, without silently being mistaken for a complete total.
  double get knownSoFar =>
      perItem.values.whereType<KnownFee>().fold(0.0, (sum, f) => sum + f.amount);
}
