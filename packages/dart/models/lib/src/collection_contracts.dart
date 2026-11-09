// Canonical Dart mirror of the collection summary/membership contracts in
// @letbuyy/shared-types. No missing count or revision becomes a fabricated zero.
Never _bad() => throw const FormatException(
  'The collection identity, contents or count could not be confirmed.',
);
bool _id(Object? value) =>
    value is String &&
    RegExp(
      r'^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$',
    ).hasMatch(value);
int _count(Object? value, {int min = 0, int max = 9007199254740991}) {
  if (value is! num ||
      !value.isFinite ||
      value < min ||
      value > max ||
      value != value.roundToDouble())
    _bad();
  return value.toInt();
}

Map<String, dynamic> _object(Object? value) {
  if (value is! Map || value.keys.any((k) => k is! String)) _bad();
  return Map<String, dynamic>.from(value);
}

List<String> collectionProductIds(Object? value) {
  if (value is! List || value.length > 500 || value.any((v) => !_id(v))) _bad();
  final ids = value.cast<String>();
  if (ids.toSet().length != ids.length) _bad();
  return List.unmodifiable(ids);
}

class ProductCollectionContract {
  const ProductCollectionContract({
    required this.id,
    required this.storeId,
    required this.title,
    this.description,
    this.imageUrl,
    this.handle,
    this.isActive = true,
    this.productCount,
    this.membershipVersion,
    this.createdAt,
    this.updatedAt,
  });

  factory ProductCollectionContract.fromJson(Map<String, dynamic> data) {
    final name = data['title'] ?? data['name'];
    return ProductCollectionContract(
      id: '${data['id'] ?? ''}',
      storeId: '${data['store_id'] ?? data['storeId'] ?? ''}',
      title: name == null ? '' : '$name',
      description: data['description'] as String?,
      imageUrl: data['image_url'] as String? ?? data['imageUrl'] as String?,
      handle: data['handle'] as String? ?? data['slug'] as String?,
      isActive: data['is_active'] as bool? ?? data['isActive'] as bool? ?? true,
      productCount:
          data['product_count'] == null && data['products_count'] == null
          ? null
          : _count(data['product_count'] ?? data['products_count']),
      membershipVersion: data['membership_version'] == null
          ? null
          : _count(data['membership_version'], min: 1),
      createdAt: data['created_at'] as String? ?? data['createdAt'] as String?,
      updatedAt: data['updated_at'] as String? ?? data['updatedAt'] as String?,
    );
  }

  factory ProductCollectionContract.fromSummaryJson(Map<String, dynamic> data) {
    const required = [
      'id',
      'store_id',
      'title',
      'description',
      'created_at',
      'is_active',
      'membership_version',
      'product_count',
    ];
    if (!required.every(data.containsKey) ||
        data.keys.any((key) => !{...required, 'image_url'}.contains(key)) ||
        !_id(data['id']) ||
        !_id(data['store_id']) ||
        data['title'] is! String ||
        (data['title'] as String).isEmpty ||
        (data['title'] as String).length > 160 ||
        data['is_active'] is! bool ||
        data['created_at'] is! String ||
        DateTime.tryParse(data['created_at']) == null ||
        !RegExp(r'(?:Z|[+-]\d\d:\d\d)$').hasMatch(data['created_at']) ||
        data['description'] != null &&
            (data['description'] is! String ||
                (data['description'] as String).length > 1000) ||
        data['image_url'] != null &&
            (data['image_url'] is! String ||
                Uri.tryParse(data['image_url'])?.hasScheme != true))
      _bad();
    _count(data['membership_version'], min: 1);
    _count(data['product_count']);
    return ProductCollectionContract.fromJson(data);
  }

  final String id;
  final String storeId;
  final String title;
  final String? description;
  final String? imageUrl;
  final String? handle;
  final bool isActive;
  final int? productCount, membershipVersion;
  final String? createdAt;
  final String? updatedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'store_id': storeId,
    'title': title,
    'description': description,
    'image_url': imageUrl,
    'handle': handle,
    'is_active': isActive,
    if (productCount != null) 'product_count': productCount,
    if (membershipVersion != null) 'membership_version': membershipVersion,
    'created_at': createdAt,
    'updated_at': updatedAt,
  };
}

class CollectionListPage {
  CollectionListPage._(
    this.rows,
    this.page,
    this.limit,
    this.total,
    this.hasNext,
  );
  final List<ProductCollectionContract> rows;
  final int page, limit, total;
  final bool hasNext;
  factory CollectionListPage.fromParts(Object? data, Object? meta) {
    final m = _object(meta);
    if (m.keys.toSet().difference({
          'page',
          'per_page',
          'total',
          'total_pages',
          'has_next',
          'has_prev',
        }).isNotEmpty ||
        m.length != 6 ||
        data is! List ||
        data.length > 100 ||
        m['has_next'] is! bool ||
        m['has_prev'] is! bool)
      _bad();
    final page = _count(m['page'], min: 1, max: 10000),
        limit = _count(m['per_page'], min: 1, max: 100),
        total = _count(m['total']);
    final pages = _count(m['total_pages']);
    final rows = data
        .map((r) => ProductCollectionContract.fromSummaryJson(_object(r)))
        .toList();
    final remaining = total - (page - 1) * limit;
    final expected = remaining < 0
        ? 0
        : remaining > limit
        ? limit
        : remaining;
    if (rows.length != expected ||
        rows.map((r) => r.id).toSet().length != rows.length ||
        pages != (total / limit).ceil() ||
        m['has_next'] != (page < pages) ||
        m['has_prev'] != (page > 1))
      _bad();
    return CollectionListPage._(
      List.unmodifiable(rows),
      page,
      limit,
      total,
      m['has_next'],
    );
  }
}

class CollectionMembershipProduct {
  CollectionMembershipProduct._(
    this.id,
    this.name,
    this.price,
    this.isActive,
    this.thumbnailUrl,
  );
  final String id, name;
  final double price;
  final bool isActive;
  final String? thumbnailUrl;
  factory CollectionMembershipProduct.fromJson(Object? value) {
    final v = _object(value);
    if (!_id(v['id']) ||
        v['name'] is! String ||
        (v['name'] as String).isEmpty ||
        (v['name'] as String).length > 256 ||
        v['price'] is! num ||
        !(v['price'] as num).isFinite ||
        (v['price'] as num) < 0 ||
        (v['price'] as num) > 99999999.99 ||
        v['is_active'] is! bool ||
        v['thumbnail_url'] != null &&
            (v['thumbnail_url'] is! String ||
                (v['thumbnail_url'] as String).length > 2000 ||
                Uri.tryParse(v['thumbnail_url'])?.hasScheme != true))
      _bad();
    return CollectionMembershipProduct._(
      v['id'],
      v['name'],
      (v['price'] as num).toDouble(),
      v['is_active'],
      v['thumbnail_url'],
    );
  }
}

class CollectionMembershipSnapshot {
  CollectionMembershipSnapshot._(
    this.collectionId,
    this.storeId,
    this.version,
    this.productIds,
    this.products,
    this.unavailableIds,
  );
  final String collectionId, storeId;
  final int version;
  final List<String> productIds, unavailableIds;
  final List<CollectionMembershipProduct> products;
  factory CollectionMembershipSnapshot.fromJson(Object? value) {
    final v = _object(value);
    const fields = {
      'collection_id',
      'store_id',
      'membership_version',
      'product_ids',
      'products',
      'unavailable_product_ids',
    };
    if (v.length != fields.length ||
        !fields.every(v.containsKey) ||
        !_id(v['collection_id']) ||
        !_id(v['store_id']) ||
        v['products'] is! List ||
        (v['products'] as List).length > 500)
      _bad();
    final version = _count(v['membership_version'], min: 1),
        ids = collectionProductIds(v['product_ids']),
        unavailable = collectionProductIds(v['unavailable_product_ids']);
    final rows = (v['products'] as List)
        .map(CollectionMembershipProduct.fromJson)
        .toList();
    final represented = rows.map((r) => r.id).toSet(), assigned = ids.toSet();
    if (rows.length != represented.length ||
        !assigned.containsAll(represented) ||
        !assigned.containsAll(unavailable) ||
        unavailable.any(represented.contains) ||
        represented.length + unavailable.length != assigned.length)
      _bad();
    return CollectionMembershipSnapshot._(
      v['collection_id'],
      v['store_id'],
      version,
      ids,
      List.unmodifiable(rows),
      unavailable,
    );
  }
}

class ProductCollectionInput {
  const ProductCollectionInput({
    required this.storeId,
    required this.title,
    this.description,
    this.imageUrl,
    this.isActive,
  });

  factory ProductCollectionInput.fromContract(
    ProductCollectionContract collection,
  ) {
    return ProductCollectionInput(
      storeId: collection.storeId,
      title: collection.title,
      description: collection.description,
      imageUrl: collection.imageUrl,
      isActive: collection.isActive,
    );
  }

  final String storeId;
  final String title;
  final String? description;
  final String? imageUrl;
  final bool? isActive;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'title': title,
    if (description != null && description!.trim().isNotEmpty)
      'description': description,
    if (imageUrl != null && imageUrl!.trim().isNotEmpty) 'image_url': imageUrl,
  };

  Map<String, dynamic> toUpdateJson() => {
    'title': title,
    if (description != null) 'description': description,
    if (imageUrl != null)
      'image_url': imageUrl!.trim().isEmpty ? null : imageUrl,
    if (isActive != null) 'is_active': isActive,
  };
}
