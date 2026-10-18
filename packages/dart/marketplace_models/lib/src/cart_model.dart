import 'cart_item_model.dart';

class CartModel {
  final String id;
  final String userId;
  final List<CartItemModel> items;
  final DateTime updatedAt;

  CartModel({
    required this.id,
    required this.userId,
    required this.items,
    required this.updatedAt,
  });

  // C3 (Firebase SDK removal): fromFirestore(DocumentSnapshot) removed -- CartProvider is now a
  // local-only (SharedPreferences-backed) cart; see CartItemModel's own doc comment on the
  // updatedAt/addedAt serialization convention this now shares.
  factory CartModel.fromMap(Map<String, dynamic> map, String id) {
    return CartModel(
      id: id,
      userId: map['userId'] ?? '',
      items: (map['items'] as List?)
              ?.map((item) => CartItemModel.fromMap(item as Map<String, dynamic>))
              .toList() ??
          [],
      updatedAt: map['updatedAt'] is int
          ? DateTime.fromMillisecondsSinceEpoch(map['updatedAt'] as int)
          : DateTime.now(),
    );
  }

  // Convert to Map for local storage.
  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'items': items.map((item) => item.toMap()).toList(),
      'updatedAt': updatedAt.millisecondsSinceEpoch,
    };
  }

  // Calculate total items count
  int get totalItems => items.fold(0, (sum, item) => sum + item.quantity);

  // Calculate subtotal
  double get subtotal => items.fold(0.0, (sum, item) => sum + item.subtotal);

  // Calculate total discount
  double get totalDiscount => items.fold(0.0, (sum, item) => sum + item.totalDiscount);

  // Calculate total with discount applied
  double get total => subtotal;

  // Check if cart is empty
  bool get isEmpty => items.isEmpty;

  // Check if cart has items
  bool get isNotEmpty => items.isNotEmpty;

  // ✅ UPDATED: Get item by product ID and variant
  CartItemModel? getItemByProductId(String productId, {String? variant}) {
    try {
      return items.firstWhere((item) {
        if (variant != null && variant.isNotEmpty) {
          // Match both productId and variant
          return item.productId == productId && item.variant == variant;
        }
        // Match only productId
        return item.productId == productId && (item.variant == null || item.variant!.isEmpty);
      });
    } catch (e) {
      return null;
    }
  }

  // ✅ UPDATED: Check if product exists in cart with specific variant
  bool hasProduct(String productId, {String? variant}) {
    return items.any((item) {
      if (variant != null && variant.isNotEmpty) {
        return item.productId == productId && item.variant == variant;
      }
      return item.productId == productId && (item.variant == null || item.variant!.isEmpty);
    });
  }

  // ✅ UPDATED: Add item to cart with variant support
  CartModel addItem(CartItemModel item) {
    // Find existing item with same productId AND variant
    final existingItemIndex = items.indexWhere(
      (cartItem) => 
        cartItem.productId == item.productId && 
        ((cartItem.variantId != null || item.variantId != null)
            ? cartItem.variantId == item.variantId
            : cartItem.variant == item.variant),
    );

    List<CartItemModel> newItems;
    if (existingItemIndex >= 0) {
      // Item with same variant exists, update quantity
      newItems = List.from(items);
      newItems[existingItemIndex] = items[existingItemIndex].copyWith(
        quantity: items[existingItemIndex].quantity + item.quantity,
      );
    } else {
      // New item or different variant, add to list
      newItems = [...items, item];
    }

    return copyWith(
      items: newItems,
      updatedAt: DateTime.now(),
    );
  }

  // ✅ UPDATED: Remove item from cart by productId and variant
  CartModel removeItem(String productId, {String? variant}) {
    final newItems = items.where((item) {
      if (variant != null && variant.isNotEmpty) {
        return !(item.productId == productId && item.variant == variant);
      }
      return item.productId != productId;
    }).toList();
    
    return copyWith(
      items: newItems,
      updatedAt: DateTime.now(),
    );
  }

  // ✅ UPDATED: Update item quantity with variant support
  CartModel updateItemQuantity(String productId, int quantity, {String? variant}) {
    final newItems = items.map((item) {
      if (variant != null && variant.isNotEmpty) {
        // Match both productId and variant
        if (item.productId == productId && item.variant == variant) {
          return item.copyWith(quantity: quantity);
        }
      } else {
        // Match only productId
        if (item.productId == productId && (item.variant == null || item.variant!.isEmpty)) {
          return item.copyWith(quantity: quantity);
        }
      }
      return item;
    }).toList();

    return copyWith(
      items: newItems,
      updatedAt: DateTime.now(),
    );
  }

  /// Removes exactly the quantities in [snapshot] from this cart, item by item, never going below
  /// zero and never touching an item this cart doesn't have (e.g. it was already removed, or its
  /// variant changed, since the snapshot was taken). Used to complete a guest-to-buyer transfer
  /// without blindly clearing the whole guest basket -- see
  /// CartProvider.transferGuestCartToBuyer's own doc comment for why a blind clear is unsafe if
  /// the guest added something new while the transfer was in flight.
  CartModel subtractSnapshot(List<CartItemModel> snapshot) {
    var result = this;
    for (final snapshotItem in snapshot) {
      final index = result.items.indexWhere((item) =>
          item.productId == snapshotItem.productId &&
          (snapshotItem.variantId != null
              ? item.variantId == snapshotItem.variantId
              : item.variantId == null && item.variant == snapshotItem.variant));
      if (index < 0) continue;
      final remaining = result.items[index].quantity - snapshotItem.quantity;
      final nextItems = [...result.items];
      if (remaining > 0) {
        nextItems[index] = nextItems[index].copyWith(quantity: remaining);
      } else {
        nextItems.removeAt(index);
      }
      result = result.copyWith(items: nextItems, updatedAt: DateTime.now());
    }
    return result;
  }

  // Clear all items
  CartModel clearCart() {
    return copyWith(
      items: [],
      updatedAt: DateTime.now(),
    );
  }

  // Copy with method
  CartModel copyWith({
    String? id,
    String? userId,
    List<CartItemModel>? items,
    DateTime? updatedAt,
  }) {
    return CartModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      items: items ?? this.items,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() {
    return 'CartModel(id: $id, userId: $userId, itemCount: ${items.length}, subtotal: $subtotal)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CartModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
