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

  // C3 corrective ("Complete ALL remaining Phase 1R work" task, guest-transfer durability):
  // the previous transferGuestCartToBuyer wrote the merged buyer cart, then cleared the guest
  // basket as a second, independent write -- if the clear failed, or execution stopped between
  // the two writes (a killed app, not just a caught exception), a retry re-merged the SAME guest
  // quantities into the buyer cart a second time, silently double-counting them. That contradicted
  // the method's own idempotency claim.
  //
  // This version records a durable receipt BEFORE either destination write: {transferId, buyerId,
  // guestSnapshot, buyerSnapshot}, where both snapshots are frozen at receipt-creation time. Phase
  // B (merge into the buyer's cart) is then a PURE function of those two frozen snapshots --
  // `buyerSnapshot.addItems(guestSnapshot)` -- so writing that same computed value again on any
  // retry is a genuine no-op in effect, never a second application. Phase C (removing exactly the
  // transferred quantities from the CURRENT guest cart, which may have gained new items since the
  // snapshot was taken) is guarded by its own completion marker so a retry never subtracts twice.
  // The one residual, disclosed risk: if phase C's subtraction write itself succeeds but the
  // marker write immediately after it fails or the process dies in that exact window, AND the
  // guest independently re-adds the identical product+variant in that same narrow window, a
  // resumed transfer could subtract it again. This is a deliberately bounded receipt/state-machine
  // design, not a distributed transaction -- accepting that narrow, disclosed window is
  // appropriate for a local on-device cart; eliminating it entirely is not.
  static const _transferReceiptKey = 'local_cart_v1:transfer_receipt';
  static const _guestSubtractionMarkerKey = 'local_cart_v1:transfer_subtracted';

  final Uuid _uuid = const Uuid();

  CartModel _cart = _empty();
  bool _isLoading = true;
  String? _error;

  /// null = the shared guest basket; non-null = this one buyer's own local cart. Never derived
  /// from a session token or an email address (both reviewed and rejected as namespace keys: a
  /// token rotates per session, and email is not this app's canonical buyer identifier).
  String? _activeBuyerId;
  int _identityGeneration = 0;

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
  /// Local UI continuation guard; never authentication or backend authority.
  int get identityRevision => _identityGeneration;
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

  String _keyFor(String? buyerId) =>
      buyerId == null ? _guestPrefsKey : '$_guestPrefsKey:buyer:$buyerId';

  /// D-BUYER-SCOPE: switches this provider's active local namespace to [buyerId]'s own cart (or
  /// back to the shared guest basket, for `null`). A no-op if already active, so a rebuild that
  /// re-notifies with the same identity never forces a redundant reload. The visible identity switches
  /// immediately; its read waits in the queue. Generation-bound mutations refuse
  /// stale results and can never write through the replacement buyer’s key.
  void updateUserId(String? buyerId) {
    if (buyerId == _activeBuyerId) return;
    _activeBuyerId = buyerId;
    _identityGeneration++;
    // Consumers such as badges/product cards read getters without isLoading.
    // Clear the prior buyer immediately, before notifying the new identity.
    _cart = _empty();
    _error = null;
    _isLoading = true;
    _notify();
    _ready = _enqueue(_loadActive);
  }

  Future<void> _loadActive() async {
    final buyerId = _activeBuyerId;
    final generation = _identityGeneration;
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_keyFor(buyerId));
      if (generation != _identityGeneration) return;
      _cart = jsonString != null
          ? CartModel.fromMap(jsonDecode(jsonString) as Map<String, dynamic>, _localCartId)
          : _empty();
      _error = null;
    } catch (e) {
      if (generation != _identityGeneration) return;
      _cart = _empty();
      _error = 'Could not load your cart on this device.';
    } finally {
      if (generation == _identityGeneration) {
        _isLoading = false;
        _notify();
      }
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
  Future<bool> _mutate(
    CartModel Function(CartModel current) transform, {
    String? expectedBuyerId,
    bool requireBuyerMatch = false,
  }) {
    // Bind at submission, not when an earlier queued write happens to finish.
    final buyerId = _activeBuyerId;
    final generation = _identityGeneration;
    bool currentIdentity() =>
        generation == _identityGeneration && buyerId == _activeBuyerId;
    return _enqueue(() async {
      if (!currentIdentity() ||
          (requireBuyerMatch && buyerId != expectedBuyerId)) {
        return false;
      }
      final candidate = transform(_cart);
      try {
        final prefs = await SharedPreferences.getInstance();
        if (!currentIdentity()) return false;
        final persisted = await prefs.setString(
          _keyFor(buyerId),
          jsonEncode(candidate.toMap()),
        );
        // A write already handed to the platform may finish after logout. Its
        // captured storage key stays with its original buyer; its late result
        // must never repopulate or report success in the replacement identity.
        if (!currentIdentity()) return false;
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
        if (currentIdentity()) {
          _error = 'Could not save your cart on this device.';
          _notify();
        }
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
    String? variantId,
    bool replaceExisting = false,
  }) {
    final cartItem = CartItemModel(
      id: _uuid.v4(),
      productId: product.id,
      marketplaceListingId: product.marketplaceListingId,
      catalogProductId: product.catalogProductId,
      variantId: variantId,
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
      discountPercentage:
          product.originalPrice != null &&
              product.originalPrice! > product.salePrice
          ? ((product.originalPrice! - product.salePrice) /
                product.originalPrice! *
                100)
          : 0.0,
    );
    return _mutate((current) => (replaceExisting ? _empty() : current).addItem(cartItem));
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
        cart = cart.addItem(
          orderItem.copyWith(
            id: _uuid.v4(),
            userId: _localCartId,
            addedAt: DateTime.now(),
          ),
        );
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
    return _mutate(
      (current) => current.removeItem(productId, variant: variant),
    );
  }

  Future<bool> updateQuantity(
    String productId,
    int quantity, {
    String? variant,
  }) {
    if (quantity <= 0) return removeItem(productId, variant: variant);
    return _mutate(
      (current) =>
          current.updateItemQuantity(productId, quantity, variant: variant),
    );
  }

  Future<bool> incrementQuantity(String productId, {String? variant}) async {
    final currentQuantity = getItemQuantity(productId, variant: variant);
    return await updateQuantity(
      productId,
      currentQuantity + 1,
      variant: variant,
    );
  }

  Future<bool> decrementQuantity(String productId, {String? variant}) async {
    final currentQuantity = getItemQuantity(productId, variant: variant);
    if (currentQuantity <= 1) {
      return await removeItem(productId, variant: variant);
    }
    return await updateQuantity(
      productId,
      currentQuantity - 1,
      variant: variant,
    );
  }

  Future<bool> clearCart() => _mutate((current) => current.clearCart());

  /// Removes exactly the quantities captured when checkout began. Items added or changed while
  /// the server request was in flight remain in the local cart.
  Future<bool> removeSnapshot(
    List<CartItemModel> snapshot, {
    required String? expectedBuyerId,
  }) =>
      _mutate(
        (current) => current.subtractSnapshot(snapshot),
        expectedBuyerId: expectedBuyerId,
        requireBuyerMatch: true,
      );

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

  bool isInCart(String productId, {String? variant}) =>
      _cart.hasProduct(productId, variant: variant);

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
  /// Retry-safe and restart-safe: see this file's own top-of-class doc comment for the full
  /// receipt/snapshot design. A caller can call this repeatedly (after a failure, after an app
  /// restart, or just to be sure) without ever double-applying an already-merged quantity.
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

        var receipt = await _readReceipt(prefs);
        if (receipt != null && receipt.buyerId != requestedBuyerId) {
          // A previous buyer's transfer never finished (they signed out mid-transfer, or the app
          // died) before this buyer signed in. Finish IT, for its own buyer, honoring D-BUYER-SCOPE
          // -- never silently apply a stale receipt meant for a different buyer to this one.
          await _completeReceipt(prefs, receipt);
          receipt = null;
        }

        if (receipt == null) {
          final guestCart = await _readCart(prefs, _guestPrefsKey);
          if (guestCart.isEmpty) return true;

          final buyerCart = await _readCart(prefs, _keyFor(requestedBuyerId));
          receipt = _TransferReceipt(
            transferId: _uuid.v4(),
            buyerId: requestedBuyerId,
            guestSnapshot: guestCart.items,
            buyerSnapshot: buyerCart.items,
          );
          final written = await prefs.setString(
            _transferReceiptKey,
            jsonEncode(receipt.toMap()),
          );
          if (!written) {
            _error = 'Could not start moving your guest cart on this device.';
            _notify();
            return false;
          }
        }

        final done = await _completeReceipt(prefs, receipt);
        _error = done
            ? null
            : 'Your guest cart is being moved -- try again to finish.';
        _notify();
        return done;
      } catch (e) {
        debugPrint('❌ CartProvider: error transferring guest cart: $e');
        _error = e.toString();
        _notify();
        return false;
      }
    });
  }

  Future<_TransferReceipt?> _readReceipt(SharedPreferences prefs) async {
    final json = prefs.getString(_transferReceiptKey);
    if (json == null) return null;
    try {
      return _TransferReceipt.fromMap(jsonDecode(json) as Map<String, dynamic>);
    } catch (e) {
      // A corrupt receipt is not safe to act on in either direction (resuming it could replay an
      // unknown operation; ignoring it could strand a real pending transfer). Drop it and let a
      // fresh transferGuestCartToBuyer() call start clean rather than get stuck forever.
      debugPrint('❌ CartProvider: corrupt transfer receipt, dropping: $e');
      await prefs.remove(_transferReceiptKey);
      return null;
    }
  }

  Future<CartModel> _readCart(SharedPreferences prefs, String key) async {
    final json = prefs.getString(key);
    if (json == null) return _empty();
    try {
      return CartModel.fromMap(
        jsonDecode(json) as Map<String, dynamic>,
        _localCartId,
      );
    } catch (e) {
      debugPrint('❌ CartProvider: corrupt cart at $key, treating as empty: $e');
      return _empty();
    }
  }

  /// Resumes (or completes, for the first time) [receipt] to its own buyer -- never
  /// `_activeBuyerId` blindly, since a stale receipt may belong to a buyer who has since signed
  /// out. Phase B (merge) is a pure function of the receipt's two frozen snapshots, so it is safe
  /// to recompute and rewrite on every call. Phase C (guest subtraction) is guarded by its own
  /// completion marker so it only ever runs once per transferId.
  Future<bool> _completeReceipt(
    SharedPreferences prefs,
    _TransferReceipt receipt,
  ) async {
    var merged = CartModel(
      id: _localCartId,
      userId: _localCartId,
      items: receipt.buyerSnapshot,
      updatedAt: DateTime.now(),
    );
    for (final item in receipt.guestSnapshot) {
      merged = merged.addItem(item);
    }
    final buyerWritten = await prefs.setString(
      _keyFor(receipt.buyerId),
      jsonEncode(merged.toMap()),
    );
    if (!buyerWritten) return false;
    if (receipt.buyerId == _activeBuyerId) {
      _cart = merged;
      _notify();
    }

    final subtractionMarker = prefs.getString(_guestSubtractionMarkerKey);
    if (subtractionMarker != receipt.transferId) {
      final currentGuestCart = await _readCart(prefs, _guestPrefsKey);
      final newGuestCart = currentGuestCart.subtractSnapshot(
        receipt.guestSnapshot,
      );
      final guestWritten = await prefs.setString(
        _guestPrefsKey,
        jsonEncode(newGuestCart.toMap()),
      );
      if (!guestWritten) return false;
      final markerWritten = await prefs.setString(
        _guestSubtractionMarkerKey,
        receipt.transferId,
      );
      if (!markerWritten) return false;
    }

    // Both phases confirmed done for this transferId -- best-effort cleanup; if this fails, the
    // next call resumes here (marker already matches, so it just retries this removal).
    await prefs.remove(_transferReceiptKey);
    return true;
  }

  /// Whether the shared guest basket has anything worth offering to transfer, OR a previous
  /// transfer never finished, for a UI entry point to decide whether to show that action at all.
  /// Reads storage directly rather than `_cart` (which holds whichever namespace is currently
  /// ACTIVE, not necessarily the guest one).
  Future<bool> hasGuestCartToTransfer() async {
    if (_activeBuyerId == null) return false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final receipt = await _readReceipt(prefs);
      if (receipt != null && receipt.buyerId == _activeBuyerId) return true;
      final guestCart = await _readCart(prefs, _guestPrefsKey);
      return guestCart.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}

/// A frozen, durable record of one in-flight guest -> buyer transfer -- see CartProvider's own
/// top-of-class doc comment for the full design this exists to support.
class _TransferReceipt {
  _TransferReceipt({
    required this.transferId,
    required this.buyerId,
    required this.guestSnapshot,
    required this.buyerSnapshot,
  });

  final String transferId;
  final String buyerId;
  final List<CartItemModel> guestSnapshot;
  final List<CartItemModel> buyerSnapshot;

  Map<String, dynamic> toMap() => {
    'transferId': transferId,
    'buyerId': buyerId,
    'guestSnapshot': guestSnapshot.map((i) => i.toMap()).toList(),
    'buyerSnapshot': buyerSnapshot.map((i) => i.toMap()).toList(),
  };

  factory _TransferReceipt.fromMap(Map<String, dynamic> map) {
    return _TransferReceipt(
      transferId: map['transferId'] as String,
      buyerId: map['buyerId'] as String,
      guestSnapshot: (map['guestSnapshot'] as List)
          .map((m) => CartItemModel.fromMap(m as Map<String, dynamic>))
          .toList(),
      buyerSnapshot: (map['buyerSnapshot'] as List)
          .map((m) => CartItemModel.fromMap(m as Map<String, dynamic>))
          .toList(),
    );
  }
}
