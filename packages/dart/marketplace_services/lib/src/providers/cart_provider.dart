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
// the result and ignored it or didn't even await it, so the cart could never actually hold
// anything while every one of those call sites told the buyer it just had.
//
// Per the owner's direction, this is a real, working LOCAL cart: SharedPreferences-backed, scoped
// to this device, no cross-device sync, no server-side authority.
//
// C3 corrective (27 September 2026 review, findings 1-2) closed a dishonest persistence contract
// and unordered initialization/concurrent writes; see git history for that intermediate design.
//
// C3 second corrective (27 September 2026 review continuation, "Complete ALL remaining Phase 1R
// work" task) -- that intermediate design still had a real bug of its own: every mutation mutated
// _cart OPTIMISTICALLY (synchronously, before its own disk write was even queued), then rolled
// back to a snapshot taken before it ran if that write failed. Two overlapping mutations made that
// rollback wrong: if mutation A's snapshot predates mutation B's own (already-applied, maybe
// already-persisted) change, A failing would reset _cart to A's stale pre-mutation snapshot,
// silently erasing B's change too -- one operation's failure rolling back a DIFFERENT, later
// operation's success. This version never takes a snapshot and never rolls back. Every mutation is
// now `_enqueue`d as a whole read-current -> compute candidate -> persist -> commit-only-on-success
// unit, strictly serialized behind every other mutation, load and namespace switch. Because a
// mutation's closure only ever runs once it is alone at the front of that queue, it always reads
// the true, fully-committed state left by whatever ran immediately before it -- never a stale
// snapshot -- and a failure just means "don't commit," never "undo something else."
//
// D-BUYER-SCOPE (same task): local persistence was device-wide -- one fixed key regardless of who,
// if anyone, was signed in -- and `updateUserId` was a no-op with zero callers. This provider now
// keeps a separate cart per canonical buyer ID (never per access token or email, both of which can
// rotate independently of the underlying account) plus one separate shared guest basket, switched
// via `updateUserId` (wired from a ChangeNotifierProxyProvider<BuyerSignInController, CartProvider>
// in main.dart, keyed on BuyerSignInController.buyerId). A guest's local items are never silently
// attributed to whichever buyer signs in next -- see `transferGuestCartToBuyer`'s own doc comment.
class CartProvider with ChangeNotifier {
  static const _guestPrefsKey = 'local_cart_v1';
  static const _localCartId = 'local-device-cart';

  final Uuid _uuid = const Uuid();

  CartModel _cart = _empty();
  bool _isLoading = true;
  String? _error;

  /// null = the shared guest basket; non-null = this one buyer's own local cart. Never derived
  /// from a session token or an email address (both reviewed and rejected as namespace keys: a
  /// token rotates per session, and email is not this app's canonical buyer identifier).
  String? _activeBuyerId;

  late Future<void> _ready;

  /// Every mutation, load and namespace switch is chained through this single pending future, so
  /// they always execute strictly one at a time, in request order -- see `_enqueue`'s own doc
  /// comment for exactly what this closes.
  Future<void>? _queue;

  bool _disposed = false;

  static CartModel _empty() => CartModel(
        id: _localCartId,
        userId: _localCartId,
        items: const [],
        updatedAt: DateTime.now(),
      );

  CartModel? get cart => _cart;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get itemCount => _cart.totalItems;
  double get subtotal => _cart.subtotal;
  bool get isEmpty => _cart.isEmpty;
  List<CartItemModel> get items => _cart.items;

  CartProvider() {
    _ready = _loadActive();
  }

  /// Exposed so a test (or a future caller) can deterministically wait for the same readiness
  /// every mutation method already waits for internally.
  Future<void> get ready => _ready;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  String _keyFor(String? buyerId) => buyerId == null ? _guestPrefsKey : '$_guestPrefsKey:buyer:$buyerId';

  /// D-BUYER-SCOPE: switches this provider's active local namespace to [buyerId]'s own cart (or
  /// back to the shared guest basket, for `null`). A no-op if already active, so a rebuild that
  /// re-notifies with the same identity never forces a redundant reload. The actual switch is
  /// enqueued behind whatever is already pending -- it can never interleave with (and neither
  /// stomp nor be stomped by) an in-flight mutation for the previous identity.
  void updateUserId(String? buyerId) {
    if (buyerId == _activeBuyerId) return;
    _activeBuyerId = buyerId;
    _isLoading = true;
    _notify();
    _ready = _enqueue(_loadActive);
  }

  Future<void> _loadActive() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_keyFor(_activeBuyerId));
      _cart = jsonString != null
          ? CartModel.fromMap(jsonDecode(jsonString) as Map<String, dynamic>, _localCartId)
          : _empty();
      _error = null;
    } catch (e) {
      // Corrupt persisted data (or any other read failure) falls back to an honestly empty cart
      // for this namespace rather than crashing or surfacing garbage.
      debugPrint('❌ CartProvider: error loading local cart: $e');
      _cart = _empty();
      _error = e.toString();
    } finally {
      _isLoading = false;
      _notify();
    }
  }

  /// Chains [op] behind every previously enqueued mutation, load or namespace switch, so they
  /// always run strictly one at a time in request order, never interleaved -- this is the one
  /// mechanism that makes rollback-free mutation correct (see this file's own top-of-file doc
  /// comment) and that makes an account-transition-while-writes-are-pending well-defined: a switch
  /// enqueued after a mutation simply waits for that mutation to fully finish (persist and commit,
  /// or fail without committing) before it starts loading the new namespace.
  Future<T> _enqueue<T>(Future<T> Function() op) {
    final previousTurn = _queue ?? _ready;
    final completer = Completer<T>();
    _queue = previousTurn.catchError((_) {}).then((_) async {
      try {
        completer.complete(await op());
      } catch (e, st) {
        completer.completeError(e, st);
      }
    });
    return completer.future;
  }

  /// The one place every real mutation goes through: [transform] runs only once it is this
  /// operation's turn in `_enqueue`'s strict queue (so it always reads the true, fully-committed
  /// _cart left by whatever ran immediately before it), its result is persisted BEFORE _cart is
  /// touched, and _cart only ever moves forward to a candidate that is confirmed durably saved. A
  /// failure never touches _cart at all -- it just doesn't commit -- so it can never erase a
  /// different, already-committed operation's result.
  Future<bool> _mutate(CartModel Function(CartModel current) transform) {
    return _enqueue(() async {
      final candidate = transform(_cart);
      try {
        final prefs = await SharedPreferences.getInstance();
        final persisted = await prefs.setString(_keyFor(_activeBuyerId), jsonEncode(candidate.toMap()));
        if (persisted) {
          _cart = candidate;
          _error = null;
          _notify();
          return true;
        }
        _error = 'Could not save your cart on this device.';
        _notify();
        return false;
      } catch (e) {
        debugPrint('❌ CartProvider: error saving local cart: $e');
        _error = e.toString();
        _notify();
        return false;
      }
    });
  }

  void loadCart() {
    // C3: was a Firestore listen() keyed on a userId that was always null. _loadActive() (called
    // once from the constructor, and again on every updateUserId switch) already establishes the
    // current namespace's cart -- there is no other writer of this cart to catch up with.
  }

  Future<bool> addItem(
    ProductModel product, {
    int quantity = 1,
    String? variant,
  }) {
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
    return _mutate((current) => current.addItem(cartItem));
  }

  Future<bool> addOrderItems(List<CartItemModel> orderItems) {
    if (orderItems.isEmpty) {
      _error = 'No items to add';
      _notify();
      return Future.value(false);
    }
    return _mutate((current) {
      var cart = current;
      for (final orderItem in orderItems) {
        cart = cart.addItem(orderItem.copyWith(
          id: _uuid.v4(),
          userId: _localCartId,
          addedAt: DateTime.now(),
        ));
      }
      return cart;
    });
  }

  Future<void> addToCart(
    ProductModel product, {
    int quantity = 1,
    String? variant,
  }) async {
    await addItem(product, quantity: quantity, variant: variant);
  }

  Future<bool> removeItem(String productId, {String? variant}) {
    return _mutate((current) => current.removeItem(productId, variant: variant));
  }

  Future<bool> updateQuantity(String productId, int quantity, {String? variant}) {
    if (quantity <= 0) return removeItem(productId, variant: variant);
    return _mutate((current) => current.updateItemQuantity(productId, quantity, variant: variant));
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

  Future<bool> clearCart() => _mutate((current) => current.clearCart());

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
    _ready = _enqueue(_loadActive);
    await _ready;
  }

  void clearError() {
    _error = null;
    _notify();
  }

  /// D-BUYER-SCOPE explicit guest -> buyer transfer. Never automatic: signing in never merges the
  /// guest basket into a buyer's own cart by itself (see `updateUserId` -- it only switches which
  /// namespace is active). This is the one path that does merge, and only when a caller invokes it
  /// explicitly (a UI action the buyer chooses), while a buyer is the active namespace.
  ///
  /// Merges using CartModel.addItem's own existing (productId, variant) identity and quantity-sum
  /// behavior -- the same canonical merge every other mutation already relies on, not a new dedup
  /// rule invented for this one path. Idempotent and failure-safe: the guest basket is read but
  /// left completely untouched unless the merged result is confirmed durably saved under the
  /// buyer's own key first, so a destination save failure never loses guest items, and calling
  /// this again after a success finds nothing left to transfer (reports true having changed
  /// nothing).
  Future<bool> transferGuestCartToBuyer() {
    final requestedBuyerId = _activeBuyerId;
    if (requestedBuyerId == null) return Future.value(false);
    return _enqueue(() async {
      // The active buyer changed again while this call was queued (a rapid sign-out/sign-in
      // during the wait) -- refuse rather than merge into, or clear the guest basket for, an
      // identity that is no longer the one this call was actually made for. The caller can retry.
      if (_activeBuyerId != requestedBuyerId) return false;
      try {
        final prefs = await SharedPreferences.getInstance();
        final guestJson = prefs.getString(_guestPrefsKey);
        if (guestJson == null) return true;
        final guestCart = CartModel.fromMap(jsonDecode(guestJson) as Map<String, dynamic>, _localCartId);
        if (guestCart.isEmpty) return true;

        var merged = _cart;
        for (final item in guestCart.items) {
          merged = merged.addItem(item);
        }
        final persisted = await prefs.setString(_keyFor(requestedBuyerId), jsonEncode(merged.toMap()));
        if (!persisted) {
          _error = 'Could not move your guest cart to your account on this device.';
          _notify();
          return false;
        }
        _cart = merged;
        // Only cleared now that the merge is confirmed durably saved under the buyer's own key.
        final guestCleared = await prefs.setString(_guestPrefsKey, jsonEncode(_empty().toMap()));
        if (!guestCleared) {
          // The merge itself is visible to the buyer and durably saved; the guest basket failing
          // to clear only risks a future transfer re-merging already-merged items, which
          // CartModel.addItem's own quantity-sum would double-count -- a disclosed, narrow risk,
          // not silent data loss, so it is reported honestly rather than as a full success.
          _error = 'Your guest cart was moved, but couldn’t be cleared on this device.';
          _notify();
          return false;
        }
        _error = null;
        _notify();
        return true;
      } catch (e) {
        debugPrint('❌ CartProvider: error transferring guest cart: $e');
        _error = e.toString();
        _notify();
        return false;
      }
    });
  }

  /// Whether the shared guest basket currently has anything worth offering to transfer, for a UI
  /// entry point to decide whether to show that action at all. Reads storage directly rather than
  /// `_cart` (which holds whichever namespace is currently ACTIVE, not necessarily the guest one).
  Future<bool> hasGuestCartToTransfer() async {
    if (_activeBuyerId == null) return false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final guestJson = prefs.getString(_guestPrefsKey);
      if (guestJson == null) return false;
      final guestCart = CartModel.fromMap(jsonDecode(guestJson) as Map<String, dynamic>, _localCartId);
      return guestCart.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}
