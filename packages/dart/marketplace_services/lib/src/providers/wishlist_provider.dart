import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_marketplace_models/src/wishlist_model.dart';
import 'package:letbuyy_marketplace_models/src/product_model.dart';

// C3 (Firebase SDK removal, 27 September 2026 review finding 5) -- the same bug as CartProvider
// (see that file's own doc comment for the full account): addItem/removeItem/clearWishlist all
// required a userId that was always null (the updateUserId hook that would have supplied one had
// zero callers anywhere in the app; AuthService.currentUserId is FirebaseAuth-backed and always
// null under canonical auth), so the wishlist could never actually hold anything -- isInWishlist
// would never return true even right after "successfully" adding something, since _wishlist itself
// never loaded past its initial null. Per the owner's direction on the identical CartProvider bug,
// this is now a real, working local (SharedPreferences-backed, device-scoped) wishlist.
//
// C3 corrective (27 September 2026 review, findings 1-2): the same two gaps CartProvider had, and
// the same two fixes -- see that file's own doc comment for the full reasoning behind each:
// 1. _save() now inspects SharedPreferences.setString's own returned bool (never just its thrown
//    exceptions), and every mutation rolls back its in-memory change and returns false when the
//    underlying write did not durably succeed, so a returned `true` always means both applied AND
//    persisted.
// 2. Every mutation awaits `_ready` (resolved once, by the constructor's own load) before touching
//    _wishlist, closing the window where a mutation issued before the initial disk read resolves
//    could be silently discarded the moment that read completes and replaces _wishlist wholesale.
//    Every save request is chained through a single pending future so overlapping writes to this
//    wishlist's one disk key always execute in the order they were requested, never interleaved.
class WishlistProvider with ChangeNotifier {
  static const _prefsKey = 'local_wishlist_v1';
  static const _localWishlistId = 'local-device-wishlist';

  WishlistModel _wishlist = WishlistModel(
    id: _localWishlistId,
    userId: _localWishlistId,
    productIds: const [],
    updatedAt: DateTime.now(),
  );
  bool _isLoading = true;
  String? _error;
  late Future<void> _ready;
  Future<void>? _pendingSave;

  WishlistModel? get wishlist => _wishlist;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get itemCount => _wishlist.totalItems;
  bool get isEmpty => _wishlist.isEmpty;
  List<String> get productIds => _wishlist.productIds;

  WishlistProvider() {
    _ready = _load();
  }

  /// Exposed so a test (or a future caller) can deterministically wait for the same readiness
  /// every mutation method already waits for internally.
  Future<void> get ready => _ready;

  // C3: was a hook for the old multi-user Firestore wishlist with zero callers anywhere in the
  // app (grepped) -- there is now exactly one wishlist, this device's. Kept as a harmless no-op;
  // see CartProvider.updateUserId's own doc comment for the same reasoning.
  void updateUserId(String? userId) {}

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonString = prefs.getString(_prefsKey);
      if (jsonString != null) {
        final map = jsonDecode(jsonString) as Map<String, dynamic>;
        _wishlist = WishlistModel.fromMap(map, _localWishlistId);
      }
    } catch (e) {
      debugPrint('❌ WishlistProvider: error loading local wishlist: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// See CartProvider._save's own doc comment for the full reasoning -- identical pattern, this
  /// wishlist's own disk key.
  Future<bool> _save() {
    final previousTurn = _pendingSave ?? _ready;
    final resultCompleter = Completer<bool>();
    _pendingSave = previousTurn.catchError((_) {}).then((_) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final persisted = await prefs.setString(_prefsKey, jsonEncode(_wishlist.toMap()));
        if (!persisted) _error = 'Could not save your wishlist on this device.';
        resultCompleter.complete(persisted);
      } catch (e) {
        debugPrint('❌ WishlistProvider: error saving local wishlist: $e');
        _error = e.toString();
        resultCompleter.complete(false);
      }
    });
    return resultCompleter.future;
  }

  void loadWishlist() {
    // C3: was a Firestore listen() keyed on a userId that was always null. _load() (called once,
    // from the constructor) already established this device's wishlist -- see
    // CartProvider.loadCart's own doc comment for the identical reasoning.
  }

  Future<bool> addItem(ProductModel product) async {
    await _ready;
    final previousWishlist = _wishlist;
    try {
      if (!_wishlist.productIds.contains(product.id)) {
        _wishlist = _wishlist.copyWith(
          productIds: [..._wishlist.productIds, product.id],
          updatedAt: DateTime.now(),
        );
      }
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _wishlist = previousWishlist;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      _wishlist = previousWishlist;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> addToWishlist(ProductModel product) async {
    await addItem(product);
  }

  Future<bool> removeItem(String productId) async {
    await _ready;
    final previousWishlist = _wishlist;
    try {
      _wishlist = _wishlist.copyWith(
        productIds: _wishlist.productIds.where((id) => id != productId).toList(),
        updatedAt: DateTime.now(),
      );
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _wishlist = previousWishlist;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      _wishlist = previousWishlist;
      _error = e.toString();
      notifyListeners();
      return false;
    }
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

  Future<bool> clearWishlist() async {
    await _ready;
    final previousWishlist = _wishlist;
    try {
      _wishlist = _wishlist.copyWith(productIds: const [], updatedAt: DateTime.now());
      _error = null;
      notifyListeners();
      final saved = await _save();
      if (!saved) {
        _wishlist = previousWishlist;
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      _wishlist = previousWishlist;
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> refreshWishlist() async {
    _ready = _load();
    await _ready;
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
