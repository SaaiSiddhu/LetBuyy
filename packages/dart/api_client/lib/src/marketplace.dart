// CUS-1 — the canonical marketplace surface for the customer app.
//
// These models mirror exactly what the gateway returns and nothing more. Deliberately absent:
// cost_price, cost_per_item, sku and barcode. SEC-1 removed the first three from the public product
// read and SEC-2 removed the variant-level ones after they survived nested inside `variants`; a Dart
// model naming any of them would be a standing invitation to widen the endpoint to match the client.
// If a field is missing here, the correct move is to ask whether a shopper may see it, not to add it.
//
// Endpoints (services/api-gateway/src/routes/storefront):
//   GET /storefront/marketplace/feed          MKT-1  — approved listings across merchants, keyset paged
//   GET /storefront/marketplace/categories    MKT-1  — the live platform taxonomy
//   GET /storefront/marketplace/listings/:id  MKT-2/3 — one approved listing, with its variants

import 'types.dart';

/// One card in the marketplace grid. `subdomain` is how a shopper reaches the merchant's own
/// storefront for cart and checkout, so it is not decoration — it is the link to the buying path.
class MarketplaceFeedItem {
  const MarketplaceFeedItem({
    required this.listingId,
    required this.productId,
    required this.siteId,
    required this.name,
    required this.approvedAt,
    this.storeName,
    this.subdomain,
    this.slug,
    this.images = const <String>[],
    this.price,
    this.comparePrice,
    this.categorySlug,
    this.countryOfOrigin,
  });

  factory MarketplaceFeedItem.fromJson(JsonMap json) {
    return MarketplaceFeedItem(
      listingId: _string(json['listing_id']) ?? '',
      productId: _string(json['product_id']) ?? '',
      siteId: _string(json['site_id']) ?? '',
      name: _string(json['name']) ?? '',
      approvedAt: _string(json['approved_at']) ?? '',
      storeName: _string(json['store_name']),
      subdomain: _string(json['subdomain']),
      slug: _string(json['slug']),
      images: _stringList(json['images']),
      price: _number(json['price']),
      comparePrice: _number(json['compare_price']),
      categorySlug: _string(json['category_slug']),
      countryOfOrigin: _string(json['country_of_origin']),
    );
  }

  final String listingId;
  final String productId;
  final String siteId;
  final String name;
  final String approvedAt;
  final String? storeName;
  final String? subdomain;
  final String? slug;
  final List<String> images;
  final num? price;
  final num? comparePrice;
  final String? categorySlug;
  final String? countryOfOrigin;
}

/// The keyset cursor the feed hands back. Both halves travel together or not at all — the gateway
/// rejects a half cursor, and reconstructing one from the last item is how a client drifts out of
/// step with the server's ordering.
class MarketplaceFeedCursor {
  const MarketplaceFeedCursor({
    required this.afterApprovedAt,
    required this.afterId,
  });

  static MarketplaceFeedCursor? fromJson(Object? json) {
    if (json is! Map) return null;
    final afterApprovedAt = _string(json['after_approved_at']);
    final afterId = _string(json['after_id']);
    if (afterApprovedAt == null || afterId == null) return null;
    return MarketplaceFeedCursor(
      afterApprovedAt: afterApprovedAt,
      afterId: afterId,
    );
  }

  final String afterApprovedAt;
  final String afterId;
}

/// A page of the feed. `nextCursor` is null on the last page — that is the end signal, not an empty
/// item list, because a full page can still be the last one.
class MarketplaceFeedPage {
  const MarketplaceFeedPage({required this.items, this.nextCursor, this.limit});

  final List<MarketplaceFeedItem> items;
  final MarketplaceFeedCursor? nextCursor;
  final int? limit;

  bool get hasMore => nextCursor != null;
}

class MarketplaceCategory {
  const MarketplaceCategory({
    required this.id,
    required this.slug,
    required this.name,
    this.parentId,
    this.position = 0,
  });

  factory MarketplaceCategory.fromJson(JsonMap json) {
    return MarketplaceCategory(
      id: _string(json['id']) ?? '',
      slug: _string(json['slug']) ?? '',
      name: _string(json['name']) ?? '',
      parentId: _string(json['parent_id']),
      position: _number(json['position'])?.toInt() ?? 0,
    );
  }

  final String id;
  final String slug;
  final String name;
  final String? parentId;
  final int position;
}

/// One purchasable variant. No sku, no barcode: SEC-2 removed both from every public variant shape.
class MarketplaceVariant {
  const MarketplaceVariant({
    required this.id,
    required this.title,
    this.price,
    this.comparePrice,
    this.stock,
    this.option1,
    this.option2,
    this.option3,
    this.imageUrl,
    this.position = 0,
  });

  factory MarketplaceVariant.fromJson(JsonMap json) {
    return MarketplaceVariant(
      id: _string(json['id']) ?? '',
      title: _string(json['title']) ?? '',
      price: _number(json['price']),
      comparePrice: _number(json['compare_price']),
      stock: _number(json['stock'])?.toInt(),
      option1: _string(json['option1']),
      option2: _string(json['option2']),
      option3: _string(json['option3']),
      imageUrl: _string(json['image_url']),
      position: _number(json['position'])?.toInt() ?? 0,
    );
  }

  final String id;
  final String title;
  final num? price;
  final num? comparePrice;
  final int? stock;
  final String? option1;
  final String? option2;
  final String? option3;
  final String? imageUrl;
  final int position;
}

class MarketplaceListingDetail {
  const MarketplaceListingDetail({
    required this.listingId,
    required this.productId,
    required this.siteId,
    required this.name,
    this.storeName,
    this.subdomain,
    this.slug,
    this.description,
    this.images = const <String>[],
    this.price,
    this.comparePrice,
    this.productType,
    this.tags = const <String>[],
    this.thumbnailUrl,
    this.stock,
    this.trackInventory,
    this.seoTitle,
    this.seoDescription,
    this.categorySlug,
    this.countryOfOrigin,
    this.importerDetails,
    this.approvedAt,
    this.variants = const <MarketplaceVariant>[],
  });

  factory MarketplaceListingDetail.fromJson(JsonMap json) {
    final rawVariants = json['variants'];
    return MarketplaceListingDetail(
      listingId: _string(json['listing_id']) ?? '',
      productId: _string(json['product_id']) ?? '',
      siteId: _string(json['site_id']) ?? '',
      name: _string(json['name']) ?? '',
      storeName: _string(json['store_name']),
      subdomain: _string(json['subdomain']),
      slug: _string(json['slug']),
      description: _string(json['description']),
      images: _stringList(json['images']),
      price: _number(json['price']),
      comparePrice: _number(json['compare_price']),
      productType: _string(json['product_type']),
      tags: _stringList(json['tags']),
      thumbnailUrl: _string(json['thumbnail_url']),
      stock: _number(json['stock'])?.toInt(),
      trackInventory: json['track_inventory'] is bool
          ? json['track_inventory'] as bool
          : null,
      seoTitle: _string(json['seo_title']),
      seoDescription: _string(json['seo_description']),
      categorySlug: _string(json['category_slug']),
      countryOfOrigin: _string(json['country_of_origin']),
      importerDetails: _string(json['importer_details']),
      approvedAt: _string(json['approved_at']),
      variants: rawVariants is List
          ? rawVariants
                .whereType<Map>()
                .map(
                  (variant) => MarketplaceVariant.fromJson(
                    Map<String, dynamic>.from(variant),
                  ),
                )
                .toList(growable: false)
          : const <MarketplaceVariant>[],
    );
  }

  final String listingId;
  final String productId;
  final String siteId;
  final String name;
  final String? storeName;
  final String? subdomain;
  final String? slug;
  final String? description;
  final List<String> images;
  final num? price;
  final num? comparePrice;
  final String? productType;
  final List<String> tags;
  final String? thumbnailUrl;
  final int? stock;
  final bool? trackInventory;
  final String? seoTitle;
  final String? seoDescription;
  final String? categorySlug;
  final String? countryOfOrigin;
  final String? importerDetails;
  final String? approvedAt;
  final List<MarketplaceVariant> variants;
}

String? _string(Object? value) {
  if (value == null) return null;
  final text = value.toString();
  return text.isEmpty ? null : text;
}

num? _number(Object? value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value);
  return null;
}

List<String> _stringList(Object? value) {
  if (value is! List) return const <String>[];
  return value.map(_string).whereType<String>().toList(growable: false);
}
