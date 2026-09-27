import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_models/src/wishlist_model.dart';
import 'package:letbuyy_marketplace_models/src/product_model.dart';

// C3 (Firebase SDK removal, 27 September 2026 review finding 5) -- the same bug as CartProvider
// (see that file's own doc comment for the full account, including the two later correctives this
// file mirrors exactly): addItem/removeItem/clearWishlist all required a userId that was always
// null, so the wishlist could never actually hold anything. Per the owner's direction, this is a
// real, working local (SharedPreferences-backed, device-scoped) wishlist.
//
// C3 second corrective (27 September 2026 review continuation) -- see CartProvider's own doc
// comment for the exact rollback-stomping bug this closes: every mutation is now `_enqueue`d as a
// whole read-current -> compute candidate -> persist -> commit-only-on-success unit, never an
// optimistic mutate-then-rollback.
//
// D-BUYER-SCOPE (same task) -- see CartProvider's own doc comment: a separate wishlist per
// canonical buyer ID, plus one separate shared guest wishlist, switched via `updateUserId`.
class WishlistProvider with ChangeNotifier {
  static const _guestPrefsKey = 'local_wishlist_v1';
  static const _localWishlistId = 'local-device-wishlist';

  WishlistModel _wishlist = _empty();
  bool _isLoading = true;
  String? _error;

  /// null = the shared guest wishlist; non-null = this one buyer's own local wishlist. Never
  /// derived from a session token or an email address -- see CartProvider._activeBuyerId's own
  /// doc comment for why.
  String? _activeBuyerId;

  late Future<void> _ready;

  /// Every mutation, load and namespace switch is chained through this single pending future --
  /// see CartProvider._enqueue's own doc comment for exactly what this closes.
  Future<void>? _queue;

  bool _disposed = false;

  static WishlistModel _empty() => WishlistModel(
        id: _localWishlistId,
        userId: _localWishlistId,
        productIds: const [],
        updatedAt: DateTime.now(),
      );

  WishlistModel? get wishlist => _wishlist;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get itemCount => _wishlist.totalItems;
  bool get isEmpty => _wishlist.isEmpty;
  List<String> get productIds => _wishlist.productIds;

  WishlistProvider() {
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

  /// D-BUYER-SCOPE: switches this provider's active local namespace -- see CartProvider's own
  /// method of the same name for the full reasoning; identical pattern, this wishlist's own keys.
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
      _wishlist = jsonString != null
          ? WishlistModel.fromMap(jsonDecode(jsonString) as Map<String, dynamic>, _localWishlistId)
          : _empty();
      _error = null;
    } catch (e) {
      debugPrint('❌ WishlistProvider: error loading local wishlist: $e');
      _wishlist = _empty();
      _error = e.toString();
    } finally {
      _isLoading = false;
      _notify();
    }
  }

  /// See CartProvider._enqueue's own doc comment for the full reasoning -- identical pattern.
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

  /// See CartProvider._mutate's own doc comment for the full reasoning -- identical pattern, this
  /// wishlist's own disk key.
  Future<bool> _mutate(WishlistModel Function(WishlistModel current) transform) {
    return _enqueue(() async {
      final candidate = transform(_wishlist);
      try {
        final prefs = await SharedPreferences.getInstance();
        final persisted = await prefs.setString(_keyFor(_activeBuyerId), jsonEncode(candidate.toMap()));
        if (persisted) {
          _wishlist = candidate;
          _error = null;
          _notify();
          return true;
        }
        _error = 'Could not save your wishlist on this device.';
        _notify();
        return false;
      } catch (e) {
        debugPrint('❌ WishlistProvider: error saving local wishlist: $e');
        _error = e.toString();
        _notify();
        return false;
      }
    });
  }

  void loadWishlist() {
    // C3: was a Firestore listen() keyed on a userId that was always null -- see
    // CartProvider.loadCart's own doc comment for the identical reasoning.
  }

  Future<bool> addItem(ProductModel product) {
    return _mutate((current) {
      if (current.contains(product.id)) return current;
      return current.copyWith(
        productIds: [...current.productIds, product.id],
        updatedAt: DateTime.now(),
      );
    });
  }

  Future<void> addToWishlist(ProductModel product) async {
    await addItem(product);
  }

  Future<bool> removeItem(String productId) {
    return _mutate((current) => current.copyWith(
          productIds: current.productIds.where((id) => id != productId).toList(),
          updatedAt: DateTime.now(),
        ));
  }

  Future<void> removeFromWishlist(String productId) async {
    await removeItem(productId);
  }

  Future<bool> toggleItem(ProductModel product) async {
    if (isInWishlist(product.id)) {
      return await removeItem(product.id);
    } else {
      return await addItem(product);
    }
  }

  Future<bool> toggleItemById(String productId, ProductModel product) async {
    return await toggleItem(product);
  }

  bool isInWishlist(String productId) => _wishlist.contains(productId);

  Future<bool> clearWishlist() {
    return _mutate((current) => current.copyWith(productIds: const [], updatedAt: DateTime.now()));
  }

  Future<void> refreshWishlist() async {
    _ready = _enqueue(_loadActive);
    await _ready;
  }

  void clearError() {
    _error = null;
    _notify();
  }

  /// D-BUYER-SCOPE explicit guest -> buyer transfer -- see CartProvider.transferGuestCartToBuyer's
  /// own doc comment for the full reasoning. Merges using product-ID identity (a Set union): the
  /// wishlist's own canonical existing dedup rule (WishlistModel.contains), not a new one invented
  /// for this path.
  Future<bool> transferGuestWishlistToBuyer() {
    final requestedBuyerId = _activeBuyerId;
    if (requestedBuyerId == null) return Future.value(false);
    return _enqueue(() async {
      if (_activeBuyerId != requestedBuyerId) return false;
      try {
        final prefs = await SharedPreferences.getInstance();
        final guestJson = prefs.getString(_guestPrefsKey);
        if (guestJson == null) return true;
        final guestWishlist = WishlistModel.fromMap(jsonDecode(guestJson) as Map<String, dynamic>, _localWishlistId);
        if (guestWishlist.isEmpty) return true;

        final mergedIds = <String>{..._wishlist.productIds, ...guestWishlist.productIds}.toList();
        final merged = _wishlist.copyWith(productIds: mergedIds, updatedAt: DateTime.now());
        final persisted = await prefs.setString(_keyFor(requestedBuyerId), jsonEncode(merged.toMap()));
        if (!persisted) {
          _error = 'Could not move your guest wishlist to your account on this device.';
          _notify();
          return false;
        }
        _wishlist = merged;
        final guestCleared = await prefs.setString(_guestPrefsKey, jsonEncode(_empty().toMap()));
        if (!guestCleared) {
          _error = 'Your guest wishlist was moved, but couldn’t be cleared on this device.';
          _notify();
          return false;
        }
        _error = null;
        _notify();
        return true;
      } catch (e) {
        debugPrint('❌ WishlistProvider: error transferring guest wishlist: $e');
        _error = e.toString();
        _notify();
        return false;
      }
    });
  }

  /// Whether the shared guest wishlist currently has anything worth offering to transfer.
  Future<bool> hasGuestWishlistToTransfer() async {
    if (_activeBuyerId == null) return false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final guestJson = prefs.getString(_guestPrefsKey);
      if (guestJson == null) return false;
      final guestWishlist = WishlistModel.fromMap(jsonDecode(guestJson) as Map<String, dynamic>, _localWishlistId);
      return !guestWishlist.isEmpty;
    } catch (_) {
      return false;
    }
  }
}
