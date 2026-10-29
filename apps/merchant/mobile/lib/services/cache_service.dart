import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

/// Small read-through cache for mobile merchant data that must remain useful
/// when the device is offline.
class CacheService {
  CacheService._(this._box, this._actorIdProvider);

  CacheService.memory({String? Function()? actorIdProvider})
    : _box = null,
      _actorIdProvider = actorIdProvider;

  static const String boxName = 'letbuyy_mobile_cache_v1';

  static bool _hiveInitialized = false;

  final Box<String>? _box;
  final String? Function()? _actorIdProvider;
  String? _keyForActor(String key) {
    if (_actorIdProvider == null) return key; // Explicit in-memory test caches.
    final actor = _actorIdProvider()?.trim();
    if (actor == null || actor.isEmpty) return null;
    // Never adopt a legacy unscoped private snapshot into another account.
    return 'merchant-account-v1:${Uri.encodeComponent(actor)}:$key';
  }

  final Map<String, String> _memory = <String, String>{};

  static Future<CacheService> open({
    required String? Function() actorIdProvider,
  }) async {
    if (!_hiveInitialized) {
      await Hive.initFlutter();
      _hiveInitialized = true;
    }
    final box = await Hive.openBox<String>(boxName);
    return CacheService._(box, actorIdProvider);
  }

  Future<void> writeJson(String key, Object? value) async {
    final scopedKey = _keyForActor(key);
    if (scopedKey == null) return;
    final encoded = jsonEncode(value);
    final box = _box;
    if (box == null) {
      _memory[scopedKey] = encoded;
      return;
    }
    await box.put(scopedKey, encoded);
  }

  Map<String, dynamic>? readJsonMap(String key) {
    final decoded = _readDecoded(key);
    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }
    return null;
  }

  List<Map<String, dynamic>> readJsonList(String key) {
    final decoded = _readDecoded(key);
    if (decoded is! List) return const <Map<String, dynamic>>[];
    return decoded
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<void> remove(String key) async {
    final scopedKey = _keyForActor(key);
    if (scopedKey == null) return;
    final box = _box;
    if (box == null) {
      _memory.remove(scopedKey);
      return;
    }
    await box.delete(scopedKey);
  }

  Future<void> clear() async {
    _memory.clear();
    await _box?.clear();
  }

  Object? _readDecoded(String key) {
    final scopedKey = _keyForActor(key);
    if (scopedKey == null) return null;
    final encoded = _box?.get(scopedKey) ?? _memory[scopedKey];
    if (encoded == null || encoded.isEmpty) return null;
    try {
      return jsonDecode(encoded);
    } catch (error) {
      debugPrint('Invalid cache payload for $key: $error');
      return null;
    }
  }

  static String storesKey = 'stores:list';

  static String storeDetailKey(String storeId) => 'stores:detail:$storeId';

  static String _cursorSegment(String? cursor) {
    final trimmed = cursor?.trim();
    return trimmed == null || trimmed.isEmpty
        ? 'none'
        : Uri.encodeComponent(trimmed);
  }

  static String productsKey(
    String storeId,
    int page,
    int limit, {
    String? cursor,
    String? search,
    String status = 'all',
    String sort = 'display_order',
    String order = 'asc',
    String? stockFilter,
  }) =>
      'products:$storeId:$page:$limit:${_cursorSegment(cursor)}:${Uri.encodeComponent(search?.trim() ?? '')}:$status:$sort:$order:${stockFilter ?? 'all'}';

  static String productDetailKey(String productId, {required String storeId}) =>
      'products:detail:$storeId:$productId';

  static String ordersKey(
    String storeId, {
    String? status,
    String? customerEmail,
    String? cursor,
    required int page,
    required int limit,
  }) =>
      'orders:$storeId:${status ?? 'all'}:${customerEmail ?? 'all'}:$page:$limit:${_cursorSegment(cursor)}';

  static String orderDetailKey(String orderId) => 'orders:detail:$orderId';

  static String customersKey(
    String storeId, {
    String? search,
    String? cursor,
    required int page,
    required int limit,
  }) =>
      'customers:$storeId:${search?.trim().toLowerCase() ?? 'all'}:$page:$limit:${_cursorSegment(cursor)}';

  static String customerDetailKey(String storeId, String email) =>
      'customers:detail:$storeId:${Uri.encodeComponent(email.trim().toLowerCase())}';
}
