import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/store_model.dart';
import '../services/store_service.dart';
import '../services/api_client.dart';

class StoreContext extends ChangeNotifier {
  StoreContext({required StoreService storeService, SharedPreferences? prefs})
    : _storeService = storeService,
      _prefs = prefs;

  static const String _selectedStoreIdKey = 'letbuyy.selected_store_id';

  final StoreService _storeService;
  SharedPreferences? _prefs;

  List<StoreModel> _stores = const <StoreModel>[];
  StoreModel? _selectedStore;
  bool _isLoading = false;
  String? _error;
  int _sessionEpoch = 0;
  Future<List<StoreModel>>? _storesLoading;
  int? _storesLoadingEpoch;
  int get requestContextVersion => _sessionEpoch;

  /// Account and selected-store changes both invalidate captured HTTP work.
  Object get requestContextKey => (_sessionEpoch, _actorId, _selectedStore?.id);
  Future<void> _reset = Future<void>.value();
  bool _actorBound = false;
  String? _actorId;

  void _checkEpoch(int epoch) {
    if (epoch != _sessionEpoch)
      throw const ApiException(
        message: 'The signed-in account changed. Reload store access.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
  }

  Future<void> bindActor(String? actorId) {
    final changed = _actorBound && _actorId != actorId;
    _actorBound = true;
    _actorId = actorId;
    return changed ? clearSelection() : _reset;
  }

  List<StoreModel> get stores => List.unmodifiable(_stores);
  StoreModel? get selectedStore => _selectedStore;
  String? get selectedStoreId => _selectedStore?.id;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasStores => _stores.isNotEmpty;

  Future<List<StoreModel>> loadStores({bool force = false}) {
    final epoch = _sessionEpoch, pending = _storesLoading;
    if (pending != null && _storesLoadingEpoch == epoch) return pending;
    late final Future<List<StoreModel>> request;
    request = _loadStores(epoch, force: force).whenComplete(() {
      if (identical(_storesLoading, request)) {
        _storesLoading = null;
        _storesLoadingEpoch = null;
      }
    });
    _storesLoading = request;
    _storesLoadingEpoch = epoch;
    return request;
  }

  Future<List<StoreModel>> _loadStores(int epoch, {required bool force}) async {
    await _reset;
    _checkEpoch(epoch);
    if (_stores.isNotEmpty && !force) {
      if (_selectedStore == null) await _selectInitialStore(_stores, epoch);
      return _stores;
    }

    _isLoading = true;
    _error = null;

    try {
      final stores = await _storeService.fetchStores();
      _checkEpoch(epoch);
      _stores = stores;
      await _selectInitialStore(stores, epoch);
      return _stores;
    } catch (error) {
      _checkEpoch(epoch);
      if (error is ApiException &&
          error.statusCode >= 400 &&
          error.statusCode < 500) {
        await clearSelection();
        rethrow;
      }
      _error = error.toString();
      if (_storeService.stores.isNotEmpty) {
        _stores = _storeService.stores;
        await _selectInitialStore(_stores, epoch);
        return _stores;
      }
      rethrow;
    } finally {
      if (epoch == _sessionEpoch) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  /// Bind the authenticated actor and finish its reset before store discovery.
  /// A valid empty response alone means onboarding; errors remain errors.
  Future<StoreModel?> ensureSelectedStoreForActor(String actor) async {
    if (actor.isEmpty)
      throw const ApiException(
        message: 'Sign in again to load store access.',
        statusCode: 401,
        code: 'MERCHANT_IDENTITY_REQUIRED',
      );
    await bindActor(actor);
    final epoch = _sessionEpoch;
    if (_actorId != actor)
      throw const ApiException(
        message: 'The signed-in account changed. Reload store access.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    final store = await ensureSelectedStore();
    _checkEpoch(epoch);
    if (_actorId != actor)
      throw const ApiException(
        message: 'The signed-in account changed. Reload store access.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    return store;
  }

  Future<StoreModel?> ensureSelectedStore({bool force = false}) async {
    if (_selectedStore != null && !force) return _selectedStore;
    await loadStores(force: force || _stores.isEmpty);
    return _selectedStore;
  }

  Future<StoreModel> reloadSelectedStore(String expectedStoreId) async {
    await _reset;
    final epoch = _sessionEpoch;
    if (_selectedStore?.id != expectedStoreId) {
      throw const ApiException(
        message: 'The selected store changed. Open its settings again.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    }
    late final StoreModel fresh;
    try {
      fresh = await _storeService.fetchStoreFresh(expectedStoreId);
    } catch (error) {
      _checkEpoch(epoch);
      if (error is ApiException &&
          error.statusCode >= 400 &&
          error.statusCode < 500) {
        await clearSelection();
      }
      rethrow;
    }
    _checkEpoch(epoch);
    if (_selectedStore?.id != expectedStoreId) {
      throw const ApiException(
        message: 'The selected store changed. Open its settings again.',
        statusCode: 409,
        code: 'SESSION_CONTEXT_CHANGED',
      );
    }
    _stores = [..._stores.where((item) => item.id != expectedStoreId), fresh];
    await selectStore(fresh);
    return fresh;
  }

  Future<void> selectStore(StoreModel store) async {
    _selectedStore = store;
    _storeService.setCurrentStore(store);
    final prefs = await _preferences();
    await prefs.setString(_selectedStoreIdKey, store.id);
    notifyListeners();
  }

  Future<void> selectStoreById(String storeId) async {
    if (_stores.isEmpty) {
      await loadStores();
    }
    final store = _stores.firstWhere(
      (store) => store.id == storeId,
      orElse: () => _stores.first,
    );
    await selectStore(store);
  }

  Future<void> adoptCreatedStore(StoreModel store) async {
    _stores = [..._stores.where((item) => item.id != store.id), store];
    await selectStore(store);
  }

  Future<void> clearSelection() {
    _sessionEpoch++;
    _storesLoading = null;
    _storesLoadingEpoch = null;
    _selectedStore = null;
    _stores = const [];
    _error = null;
    _isLoading = false;
    // Invalidate memory synchronously. All subsequent reads await cache reset.
    final resetService = _storeService.clearSessionStores();
    _reset = _reset.then((_) async {
      await resetService;
      final prefs = await _preferences();
      await prefs.remove(_selectedStoreIdKey);
    });
    notifyListeners();
    return _reset;
  }

  Future<void> _selectInitialStore(List<StoreModel> stores, int epoch) async {
    _checkEpoch(epoch);
    if (stores.isEmpty) {
      _selectedStore = null;
      return;
    }

    final prefs = await _preferences();
    _checkEpoch(epoch);
    final savedId = prefs.getString(_selectedStoreIdKey);
    final currentId = _selectedStore?.id ?? _storeService.currentStore?.id;
    final targetId = savedId?.isNotEmpty == true ? savedId : currentId;
    final selected = stores.firstWhere(
      (store) => store.id == targetId,
      orElse: () => stores.first,
    );
    _selectedStore = selected;
    _storeService.setCurrentStore(selected);
    await prefs.setString(_selectedStoreIdKey, selected.id);
  }

  Future<SharedPreferences> _preferences() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }
}
