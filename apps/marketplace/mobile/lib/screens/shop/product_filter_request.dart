import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

/// Reloads the canonical feed after the shop filter drawer is applied.
///
/// Search text on a category shop is intentionally applied locally to the returned category
/// products. Sending it through [ProductProvider.searchProducts] would replace the category query,
/// because that compatibility method has no category argument. Keep both server-side constraints
/// (category and origin) on the feed request and leave the existing local text search intact.
Future<void> reloadShopProductsForFilters({
  required ProductProvider provider,
  required String? categoryId,
  required String searchQuery,
  required String? countryOfOrigin,
}) {
  final hasCategory =
      categoryId != null &&
      categoryId.isNotEmpty &&
      categoryId != 'all' &&
      categoryId != 'All' &&
      categoryId != 'uncategorized';

  if (hasCategory) {
    return provider.loadProducts(
      categoryId: categoryId,
      countryOfOrigin: countryOfOrigin,
      forceReload: true,
    );
  }

  if (searchQuery.trim().isNotEmpty) {
    return provider.searchProducts(
      searchQuery,
      countryOfOrigin: countryOfOrigin,
    );
  }

  return provider.loadProducts(
    countryOfOrigin: countryOfOrigin,
    forceReload: true,
  );
}
