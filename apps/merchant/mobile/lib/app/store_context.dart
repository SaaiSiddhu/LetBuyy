import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/store_model.dart';
import '../services/store_service.dart';
import '../services/api_client.dart';
import '../config/app_config.dart';

class StoreContext extends ChangeNotifier {
  StoreContext({
    required StoreService storeService,
    SharedPreferences? prefs,
    String environment = AppConfig.environment,
  }) : _storeService = storeService,
       _prefs = prefs,
       _selectedStoreIdKey = environment == 'staging'
           ? 'letbuyy.selected_store_id.staging'
           : 'letbuyy.selected_store_id';

  final String _selectedStoreIdKey;

  final StoreService _storeService;
  SharedPreferences? _prefs;

  List<StoreModel> _stores = const <StoreModel>[];
  StoreModel? _selectedStore;
  bool _isLoading = false;
  String? _error;
  int _sessionEpoch = 0;
  int _selectionVersion = 0;
  Future<void> _selectionPersistence = Future<void>.value();
  Future<List<StoreModel>>? _storesLoading;
  int? _storesLoadingEpoch;
  int get requestContextVersion => _sessionEpoch;

  /// Account and selected-store changes both invalidate captured HTTP work.
  Object get requestContextKey =>
      (_sessionEpoch, _selectionVersion, _actorId, _selectedStore?.id);
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
  Future<StoreModel?> ensureSelectedStoreForActor(
    String actor, {
    bool force = false,
  }) async {
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
    final store = await ensureSelectedStore(force: force);
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
    StoreModel? availableStore;
    for (final available in _stores) {
      if (available.id == store.id) {
        availableStore = available;
        break;
      }
    }
    if (availableStore == null) {
      throw const ApiException(
        message: 'This store is not available to the signed-in account.',
        statusCode: 403,
        code: 'STORE_ACCESS_UNAVAILABLE',
      );
    }
    if (_selectedStore?.id != availableStore.id) _selectionVersion++;
    _selectedStore = availableStore;
    _storeService.setCurrentStore(availableStore);
    // Retire the old visible/private context before asynchronous preferences.
    notifyListeners();
    await _persistSelection(availableStore.id, requestContextKey);
  }

  Future<void> selectStoreById(String storeId) async {
    if (_stores.isEmpty) {
      await loadStores();
    }
    StoreModel? store;
    for (final available in _stores) {
      if (available.id == storeId) {
        store = available;
        break;
      }
    }
    if (store == null) {
      throw const ApiException(
        message: 'This store is not available to the signed-in account.',
        statusCode: 403,
        code: 'STORE_ACCESS_UNAVAILABLE',
      );
    }
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
    final pendingSelection = _selectionPersistence;
    _reset = _reset.then((_) async {
      await resetService;
      await pendingSelection;
      final prefs = await _preferences();
      await prefs.remove(_selectedStoreIdKey);
    });
    notifyListeners();
    return _reset;
  }

  Future<void> _selectInitialStore(List<StoreModel> stores, int epoch) async {
    _checkEpoch(epoch);
    if (stores.isEmpty) {
      if (_selectedStore != null) _selectionVersion++;
      _selectedStore = null;
      return;
    }

    final prefs = await _preferences();
    _checkEpoch(epoch);
    final savedId = prefs.getString(_selectedStoreIdKey);
    final targetId =
        _selectedStore?.id ??
        (savedId?.isNotEmpty == true
            ? savedId
            : _storeService.currentStore?.id);
    final selected = stores.firstWhere(
      (store) => store.id == targetId,
      orElse: () => stores.first,
    );
    if (_selectedStore?.id != selected.id) _selectionVersion++;
    _selectedStore = selected;
    _storeService.setCurrentStore(selected);
    await _persistSelection(selected.id, requestContextKey);
    _checkEpoch(epoch);
  }

  Future<void> _persistSelection(String id, Object contextKey) {
    final reset = _reset;
    final write = _selectionPersistence.then((_) async {
      await reset;
      final prefs = await _preferences();
      if (requestContextKey != contextKey) return;
      await prefs.setString(_selectedStoreIdKey, id);
    });
    // Keep later persistence usable even if this caller observes an I/O error.
    _selectionPersistence = write.catchError((Object _) {});
    return write;
  }

  Future<SharedPreferences> _preferences() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }
}
