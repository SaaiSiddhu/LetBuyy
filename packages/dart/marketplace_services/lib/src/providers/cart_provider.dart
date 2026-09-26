import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:letbuyy_marketplace_models/src/cart_model.dart';
import 'package:letbuyy_marketplace_models/src/cart_item_model.dart';
import 'package:letbuyy_marketplace_models/src/product_model.dart';

// C3 (Firebase SDK removal, 27 September 2026 review finding 5) -- CartProvider used to require a
// real userId (from a `updateUserId(String? userId)` hook with zero callers anywhere in the app, or
// AuthService.currentUserId, FirebaseAuth-backed and always null under canonical auth) before any
// mutation would actually reach _databaseService. Every real add-to-cart call site either awaited
// the result and ignored it (product_details_screen.dart's _addToCart: `await
// cartProvider.addToCart(...)` then an unconditional 'Added to cart!' snackbar, and for Buy Now, an
// unconditional navigation straight to checkout) or didn't even await it (product_card.dart's grid
// button). So the cart could never actually hold anything, anywhere, while every one of those call
// sites told the buyer it just had. This was not introduced by this rewire -- it predates this
// whole corrective phase -- but it is exactly the "transport/logic failure presented as success"
// pattern the phase exists to catch, on the single most fundamental commerce action in the app.
//
// There is no canonical cart API to rewire onto (no cart concept exists anywhere in
// letbuyy_api_client/the gateway surface). Per the owner's explicit direction, this is now a real,
// working LOCAL cart instead: SharedPreferences-backed, scoped to this device, no cross-device
// sync, no server-side authority -- but Add to Cart, quantity changes and checkout navigation now
// genuinely reflect what's in it, rather than a permanently-empty cart behind a fake success
// message. CartModel/CartItemModel's own immutable addItem/removeItem/updateItemQuantity/clearCart
// methods (already pure, Firebase-independent value transforms) are reused as-is; only the
// persistence layer underneath changes. `userId` on both models is a vestigial field from their
// Firestore-multi-user era -- kept at a fixed, meaningless local sentinel rather than removed
// outright, since it is still part of their public shape and mobile_cart_screen.dart's BOGO
// free-item construction still plumbs it through unchanged.
//
// C3 corrective (27 September 2026 review, findings 1-2): the first version of this local rewrite
// still had two real gaps of its own, both closed here:
//
// 1. Dishonest persistence contract. _save() caught SharedPreferences.setString's own thrown
//    exceptions, but never inspected its RETURN VALUE (Future<bool> -- true only if the write
//    genuinely landed) and every mutation method's `return true` after `await _save()` was
//    unconditional, not derived from what _save() actually did. A platform-level failure that
//    setString reports as `false` rather than throwing (the two are different signals) was
//    invisible: the method still reported success, still notified listeners with the mutated
//    in-memory state, and any caller relying on that boolean (mobile_wishlist_screen.dart's/
//    web_wishlist_screen.dart's own "only remove from the wishlist once the cart add is confirmed"
//    logic, added in this same phase) would have wrongly believed the move succeeded. Every
//    mutation below now rolls back its in-memory change and returns false when the underlying save
//    did not durably succeed, so "true" always means both applied AND persisted, never one without
//    the other.
// 2. Unordered initialization and concurrent writes. The constructor started _load() without
//    awaiting it, and no mutation method awaited it either -- a mutation called before the initial
//    disk read resolves could have its in-memory change silently discarded the moment _load()
//    finally completes and unconditionally REPLACES _cart with whatever was on disk before that
//    mutation ran. Separately, two overlapping mutations each independently awaited their own
//    _save(), with no guarantee those two SharedPreferences.setString calls on the identical key
//    would not interleave and let an older write "win" over a newer one. Every mutation now awaits
//    _ready (resolved once, by the constructor's own load) before touching _cart, and every save
//    request is chained through a single pending future so writes to this cart's one disk key
//    always execute one at a time, in the order they were requested.
class CartProvider with ChangeNotifier {
  static const _prefsKey = 'local_cart_v1';
  static const _localCartId = 'local-device-cart';

  final Uuid _uuid = const Uuid();

  CartModel _cart = CartModel(
    id: _localCartId,
    userId: _localCartId,
    items: const [],
    updatedAt: DateTime.now(),
  );
  bool _isLoading = true;
  String? _error;
  late Future<void> _ready;
  Future<void>? _pendingSave;

  CartModel? get cart => _cart;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get itemCount => _cart.totalItems;
  double get subtotal => _cart.subtotal;
  bool get isEmpty => _cart.isEmpty;
  List<CartItemModel> get items => _cart.items;

  CartProvider() {
    _ready = _load();
  }

  /// Exposed so a test (or a future caller) can deterministically wait for the same readiness
  /// every mutation method already waits for internally.
  Future<void> get ready => _ready;

  // C3: was `updateUserId`, a hook for the old multi-user Firestore cart with zero callers
  // anywhere in the app (grepped) -- there is now exactly one cart, this device's, so there is
  // nothing to switch. Kept as a harmless no-op rather than deleted outright: main.dart and any
  // other call site referencing it during a future canonical-account cart (a real, later-phase
  // capability, not this one) would otherwise need rediscovering this method never existed.
  void updateUserId(String? userId) {}

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_prefsKey);
      if (jsonString != null) {
        final map = jsonDecode(jsonString) as Map<String, dynamic>;
        _cart = CartModel.fromMap(map, _localCartId);
      }
    } catch (e) {
      debugPrint('❌ CartProvider: error loading local cart: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Chains every write behind the last one (and, on the very first call, behind the initial
  /// load) so two nearly-simultaneous mutations can never let their disk writes interleave and
  /// silently drop one of them -- SharedPreferences.setString gives no ordering guarantee across
  /// overlapping calls on the same key, so this provides the one this cart's single disk key
  /// needs. Reads _cart fresh when its OWN turn in the queue arrives rather than when it was
  /// queued: since _cart only ever moves forward to each mutation's cumulative result, whichever
  /// write actually runs next always persists the fully up-to-date state, not a stale snapshot.
  Future<bool> _save() {
    final previousTurn = _pendingSave ?? _ready;
    final resultCompleter = Completer<bool>();
    _pendingSave = previousTurn.catchError((_) {}).then((_) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final persisted = await prefs.setString(_prefsKey, jsonEncode(_cart.toMap()));
        if (!persisted) _error = 'Could not save your cart on this device.';
        resultCompleter.complete(persisted);
      } catch (e) {
        debugPrint('❌ CartProvider: error saving local cart: $e');
        _error = e.toString();
        resultCompleter.complete(false);
      }
    });
    return resultCompleter.future;
  }

  void loadCart() {
    // C3: was a Firestore listen() keyed on a userId that was always null. _load() (called once,
    // from the constructor) already established this device's cart; a caller expecting a fresh
    // read after some external change has nothing further to fetch -- there is no other writer of
    // this cart to catch up with.
  }

  Future<bool> addItem(
    ProductModel product, {
    int quantity = 1,
    String? variant,
  }) async {
    await _ready;
    final previousCart = _cart;
    try {
      final cartItem = CartItemModel(
        id: _uuid.v4(),
        productId: product.id,
        productName: product.name,
        productImage: product.primaryImage,
        price: product.salePrice,
        quantity: quantity,
        userId: _localCartId,
        addedAt: DateTime.now(),
        sellerId: product.sellerId,
        sellerName: product.storeName,
        variant: variant,
        originalPrice: product.originalPrice,
        discountPercentage: product.originalPrice != null && product.originalPrice! > product.salePrice
            ? ((product.originalPrice! - product.salePrice) / product.originalPrice! * 100)
            : 0.0,
      );

      _cart = _cart.addItem(cartItem);
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _cart = previousCart;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('❌ addItem error: $e');
      _cart = previousCart;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> addOrderItems(List<CartItemModel> orderItems) async {
    await _ready;
    final previousCart = _cart;
    try {
      if (orderItems.isEmpty) {
        _error = 'No items to add';
        notifyListeners();
        return false;
      }

      var cart = _cart;
      for (final orderItem in orderItems) {
        cart = cart.addItem(orderItem.copyWith(
          id: _uuid.v4(),
          userId: _localCartId,
          addedAt: DateTime.now(),
        ));
      }

      _cart = cart;
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _cart = previousCart;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('❌ addOrderItems error: $e');
      _cart = previousCart;
      _error = 'Error adding items: ${e.toString()}';
      notifyListeners();
      return false;
    }
  }

  Future<void> addToCart(
    ProductModel product, {
    int quantity = 1,
    String? variant,
  }) async {
    await addItem(product, quantity: quantity, variant: variant);
  }

  Future<bool> removeItem(String productId, {String? variant}) async {
    await _ready;
    final previousCart = _cart;
    try {
      _cart = _cart.removeItem(productId, variant: variant);
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _cart = previousCart;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('❌ removeItem error: $e');
      _cart = previousCart;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateQuantity(String productId, int quantity, {String? variant}) async {
    if (quantity <= 0) {
      return await removeItem(productId, variant: variant);
    }
    await _ready;
    final previousCart = _cart;
    try {
      _cart = _cart.updateItemQuantity(productId, quantity, variant: variant);
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _cart = previousCart;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('❌ updateQuantity error: $e');
      _cart = previousCart;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> incrementQuantity(String productId, {String? variant}) async {
    final currentQuantity = getItemQuantity(productId, variant: variant);
    return await updateQuantity(productId, currentQuantity + 1, variant: variant);
  }

  Future<bool> decrementQuantity(String productId, {String? variant}) async {
    final currentQuantity = getItemQuantity(productId, variant: variant);
    if (currentQuantity <= 1) {
      return await removeItem(productId, variant: variant);
    }
    return await updateQuantity(productId, currentQuantity - 1, variant: variant);
  }

  Future<bool> clearCart() async {
    await _ready;
    final previousCart = _cart;
    try {
      _cart = _cart.clearCart();
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _cart = previousCart;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('❌ clearCart error: $e');
      _cart = previousCart;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  double calculateTotal({
    double discount = 0.0,
    double deliveryCharge = 0.0,
    double tax = 0.0,
  }) {
    return subtotal - discount + deliveryCharge + tax;
  }

  double getTotalSavings() {
    double savings = 0.0;
    for (final item in items) {
      if (item.originalPrice != null && item.originalPrice! > item.price) {
        savings += (item.originalPrice! - item.price) * item.quantity;
      }
    }
    return savings;
  }

  bool isInCart(String productId, {String? variant}) => _cart.hasProduct(productId, variant: variant);

  int getItemQuantity(String productId, {String? variant}) =>
      _cart.getItemByProductId(productId, variant: variant)?.quantity ?? 0;

  CartItemModel? getCartItem(String productId, {String? variant}) =>
      _cart.getItemByProductId(productId, variant: variant);

  Future<void> refreshCart() async {
    _ready = _load();
    await _ready;
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
