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

  // C3 corrective ("Complete ALL remaining Phase 1R work" task, guest-transfer durability): see
  // CartProvider's own top-of-class doc comment for the full account of the bug this closes (a
  // blind second write -- clearing the guest basket -- that could be lost or duplicated across a
  // retry). This provider's merge is a set union (WishlistModel.contains-based), which is already
  // naturally idempotent -- re-writing the same union twice is a genuine no-op, no snapshot of the
  // buyer's own wishlist needs to be frozen the way CartProvider must freeze quantities. Only the
  // guest-side clear needs a durable receipt: it must remove exactly the transferred product ids,
  // not blindly clear the whole guest wishlist (which would lose an id the guest added after the
  // snapshot was taken), and set difference is idempotent by construction -- no completion marker
  // is needed the way CartProvider's quantity subtraction requires one.
  static const _transferReceiptKey = 'local_wishlist_v1:transfer_receipt';

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
  /// own doc comment and this file's own top-of-class doc comment for the full reasoning. Merges
  /// using product-ID identity (a Set union): the wishlist's own canonical existing dedup rule
  /// (WishlistModel.contains), not a new one invented for this path. Retry-safe and restart-safe.
  Future<bool> transferGuestWishlistToBuyer() {
    final requestedBuyerId = _activeBuyerId;
    if (requestedBuyerId == null) return Future.value(false);
    return _enqueue(() async {
      if (_activeBuyerId != requestedBuyerId) return false;
      try {
        final prefs = await SharedPreferences.getInstance();

        var receipt = _readReceipt(prefs);
        if (receipt != null && receipt.buyerId != requestedBuyerId) {
          // A previous buyer's transfer never finished before this buyer signed in. Finish IT,
          // for its own buyer -- never silently apply a stale receipt to this one.
          await _completeReceipt(prefs, receipt);
          receipt = null;
        }

        if (receipt == null) {
          final guestWishlist = await _readWishlist(prefs, _guestPrefsKey);
          if (guestWishlist.isEmpty) return true;

          receipt = _TransferReceipt(transferId: '', buyerId: requestedBuyerId, guestSnapshot: guestWishlist.productIds);
          final written = await prefs.setString(_transferReceiptKey, jsonEncode(receipt.toMap()));
          if (!written) {
            _error = 'Could not start moving your guest wishlist on this device.';
            _notify();
            return false;
          }
        }

        final done = await _completeReceipt(prefs, receipt);
        _error = done ? null : 'Your guest wishlist is being moved -- try again to finish.';
        _notify();
        return done;
      } catch (e) {
        debugPrint('❌ WishlistProvider: error transferring guest wishlist: $e');
        _error = e.toString();
        _notify();
        return false;
      }
    });
  }

  _TransferReceipt? _readReceipt(SharedPreferences prefs) {
    final json = prefs.getString(_transferReceiptKey);
    if (json == null) return null;
    try {
      return _TransferReceipt.fromMap(jsonDecode(json) as Map<String, dynamic>);
    } catch (e) {
      debugPrint('❌ WishlistProvider: corrupt transfer receipt, dropping: $e');
      return null;
    }
  }

  Future<WishlistModel> _readWishlist(SharedPreferences prefs, String key) async {
    final json = prefs.getString(key);
    if (json == null) return _empty();
    try {
      return WishlistModel.fromMap(jsonDecode(json) as Map<String, dynamic>, _localWishlistId);
    } catch (e) {
      debugPrint('❌ WishlistProvider: corrupt wishlist at $key, treating as empty: $e');
      return _empty();
    }
  }

  /// Resumes (or completes, for the first time) [receipt] to its own buyer -- never
  /// `_activeBuyerId` blindly. Both phases are idempotent by construction (set union, set
  /// difference), so no completion marker is needed -- see this file's own top-of-class doc
  /// comment.
  Future<bool> _completeReceipt(SharedPreferences prefs, _TransferReceipt receipt) async {
    final buyerWishlist = await _readWishlist(prefs, _keyFor(receipt.buyerId));
    final mergedIds = <String>{...buyerWishlist.productIds, ...receipt.guestSnapshot}.toList();
    final merged = buyerWishlist.copyWith(productIds: mergedIds, updatedAt: DateTime.now());
    final buyerWritten = await prefs.setString(_keyFor(receipt.buyerId), jsonEncode(merged.toMap()));
    if (!buyerWritten) return false;
    if (receipt.buyerId == _activeBuyerId) {
      _wishlist = merged;
      _notify();
    }

    final currentGuestWishlist = await _readWishlist(prefs, _guestPrefsKey);
    final remainingIds = currentGuestWishlist.productIds
        .where((id) => !receipt.guestSnapshot.contains(id))
        .toList();
    final newGuestWishlist = currentGuestWishlist.copyWith(productIds: remainingIds, updatedAt: DateTime.now());
    final guestWritten = await prefs.setString(_guestPrefsKey, jsonEncode(newGuestWishlist.toMap()));
    if (!guestWritten) return false;

    await prefs.remove(_transferReceiptKey);
    return true;
  }

  /// Whether the shared guest wishlist has anything worth offering to transfer, OR a previous
  /// transfer never finished.
  Future<bool> hasGuestWishlistToTransfer() async {
    if (_activeBuyerId == null) return false;
    try {
      final prefs = await SharedPreferences.getInstance();
      final receipt = _readReceipt(prefs);
      if (receipt != null && receipt.buyerId == _activeBuyerId) return true;
      final guestWishlist = await _readWishlist(prefs, _guestPrefsKey);
      return !guestWishlist.isEmpty;
    } catch (_) {
      return false;
    }
  }
}

/// A frozen, durable record of one in-flight guest -> buyer transfer -- see WishlistProvider's own
/// top-of-class doc comment. `transferId` is unused here (both phases are idempotent without one)
/// but kept for shape-symmetry with CartProvider's own receipt.
class _TransferReceipt {
  _TransferReceipt({required this.transferId, required this.buyerId, required this.guestSnapshot});

  final String transferId;
  final String buyerId;
  final List<String> guestSnapshot;

  Map<String, dynamic> toMap() => {
        'transferId': transferId,
        'buyerId': buyerId,
        'guestSnapshot': guestSnapshot,
      };

  factory _TransferReceipt.fromMap(Map<String, dynamic> map) {
    return _TransferReceipt(
      transferId: map['transferId'] as String? ?? '',
      buyerId: map['buyerId'] as String,
      guestSnapshot: (map['guestSnapshot'] as List).cast<String>(),
    );
  }
}
