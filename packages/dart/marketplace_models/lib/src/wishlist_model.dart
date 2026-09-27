class WishlistModel {
  final String id;
  final String userId;
  final List<String> productIds;
  final DateTime updatedAt;

  WishlistModel({
    required this.id,
    required this.userId,
    required this.productIds,
    required this.updatedAt,
  });

  // C3 (Firebase SDK removal): WishlistProvider is now a local-only (SharedPreferences-backed)
  // wishlist -- updatedAt round-trips as milliseconds-since-epoch, the same convention
  // CacheService/CartModel already use for their own local serialization.
  factory WishlistModel.fromMap(Map<String, dynamic> map, String id) {
    return WishlistModel(
      id: id,
      userId: map['userId'] ?? '',
      productIds: List<String>.from(map['productIds'] ?? []),
      updatedAt: map['updatedAt'] is int
          ? DateTime.fromMillisecondsSinceEpoch(map['updatedAt'] as int)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'productIds': productIds,
      'updatedAt': updatedAt.millisecondsSinceEpoch,
    };
  }

  // Check if product is in wishlist
  bool contains(String productId) => productIds.contains(productId);

  // Get total items count
  int get totalItems => productIds.length;

  // Check if wishlist is empty
  bool get isEmpty => productIds.isEmpty;

  WishlistModel copyWith({
    String? id,
    String? userId,
    List<String>? productIds,
    DateTime? updatedAt,
  }) {
    return WishlistModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      productIds: productIds ?? this.productIds,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
