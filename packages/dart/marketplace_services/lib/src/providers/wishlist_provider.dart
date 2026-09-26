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

  WishlistModel? get wishlist => _wishlist;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get itemCount => _wishlist.totalItems;
  bool get isEmpty => _wishlist.isEmpty;
  List<String> get productIds => _wishlist.productIds;

  WishlistProvider() {
    _load();
  }

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

  Future<void> _save() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, jsonEncode(_wishlist.toMap()));
    } catch (e) {
      debugPrint('❌ WishlistProvider: error saving local wishlist: $e');
      _error = e.toString();
    }
  }

  void loadWishlist() {
    // C3: was a Firestore listen() keyed on a userId that was always null. _load() (called once,
    // from the constructor) already established this device's wishlist -- see
    // CartProvider.loadCart's own doc comment for the identical reasoning.
  }

  Future<bool> addItem(ProductModel product) async {
    try {
      if (!_wishlist.productIds.contains(product.id)) {
        _wishlist = _wishlist.copyWith(
          productIds: [..._wishlist.productIds, product.id],
          updatedAt: DateTime.now(),
        );
      }
      _error = null;
      notifyListeners();
      await _save();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> addToWishlist(ProductModel product) async {
    await addItem(product);
  }

  Future<bool> removeItem(String productId) async {
    try {
      _wishlist = _wishlist.copyWith(
        productIds: _wishlist.productIds.where((id) => id != productId).toList(),
        updatedAt: DateTime.now(),
      );
      _error = null;
      notifyListeners();
      await _save();
      return true;
    } catch (e) {
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
    try {
      _wishlist = _wishlist.copyWith(productIds: const [], updatedAt: DateTime.now());
      _error = null;
      notifyListeners();
      await _save();
      return true;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> refreshWishlist() async {
    await _load();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
