// lib/models/category_model.dart

/// Commission settings for a category
class CategoryCommission {
  final double? percent;       // null = inherit from parent
  final double? adDiscount;    // null = use global default
  final bool inheritFromParent;

  const CategoryCommission({
    this.percent,
    this.adDiscount,
    this.inheritFromParent = true,
  });

  factory CategoryCommission.fromMap(Map<String, dynamic>? map) {
    if (map == null) return const CategoryCommission();
    return CategoryCommission(
      percent: (map['percent'] as num?)?.toDouble(),
      adDiscount: (map['adDiscount'] as num?)?.toDouble(),
      inheritFromParent: map['inheritFromParent'] ?? true,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'percent': percent,
      'adDiscount': adDiscount,
      'inheritFromParent': inheritFromParent,
    };
  }

  CategoryCommission copyWith({
    double? percent,
    double? adDiscount,
    bool? inheritFromParent,
  }) {
    return CategoryCommission(
      percent: percent ?? this.percent,
      adDiscount: adDiscount ?? this.adDiscount,
      inheritFromParent: inheritFromParent ?? this.inheritFromParent,
    );
  }
}

class CategoryModel {
  final String id;
  final String name;
  final String description;

  // C2 (canonical rewire): the live platform taxonomy identifies a category by slug for feed
  // filtering (marketplace_feed's `category` param is a slug) and by id for hierarchy (parent_id
  // is the categories table's own id, a different keyspace). `id` above carries the slug end to
  // end -- it is the value every screen already uses to select/filter/compare categories, and the
  // feed filter needs a slug -- so `slug` here is the same value as `id` for a canonical category,
  // kept as a distinct field only so a caller that specifically needs "the slug" never has to
  // wonder whether `id` happens to be one.
  final String slug;

  // Hierarchy fields
  final String? parentId;
  final int level;  // 0 = main, 1 = sub, 2 = sub-sub

  // Image fields
  final String? iconImageUrl;
  final String? bannerImageUrl;
  final String? iconName;

  // Display settings
  final int displayOrder;
  final bool isActive;
  final DateTime createdAt;
  final int productCount;

  // ✅ Commission settings
  final CategoryCommission commission;

  CategoryModel({
    required this.id,
    required this.name,
    required this.description,
    String? slug,
    this.parentId,
    this.level = 0,
    this.iconImageUrl,
    this.bannerImageUrl,
    this.iconName,
    this.displayOrder = 0,
    this.isActive = true,
    required this.createdAt,
    this.productCount = 0,
    this.commission = const CategoryCommission(),
  }) : slug = slug ?? id;

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): fromMap(map, id)/toMap()
  // (Firestore document <-> model) deleted -- zero callers anywhere in the app or services.
  // CategoryProvider/cache_service.dart/web_shop_screen.dart all construct CategoryModel directly
  // from canonical/cached data via the plain constructor above, never through these.

  CategoryModel copyWith({
    String? name,
    String? description,
    String? slug,
    String? parentId,
    int? level,
    String? iconImageUrl,
    String? bannerImageUrl,
    String? iconName,
    int? displayOrder,
    bool? isActive,
    int? productCount,
    CategoryCommission? commission,
  }) {
    return CategoryModel(
      id: id,
      name: name ?? this.name,
      description: description ?? this.description,
      slug: slug ?? this.slug,
      parentId: parentId ?? this.parentId,
      level: level ?? this.level,
      iconImageUrl: iconImageUrl ?? this.iconImageUrl,
      bannerImageUrl: bannerImageUrl ?? this.bannerImageUrl,
      iconName: iconName ?? this.iconName,
      displayOrder: displayOrder ?? this.displayOrder,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt,
      productCount: productCount ?? this.productCount,
      commission: commission ?? this.commission,
    );
  }

  /// Check if this category has explicit commission (not inherited)
  bool get hasExplicitCommission => commission.percent != null;

  /// Get effective commission percent (null if needs to inherit)
  double? get effectiveCommissionPercent => commission.percent;
}