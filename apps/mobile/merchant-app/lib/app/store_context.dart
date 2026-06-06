import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/store_model.dart';
import '../services/store_service.dart';

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

  List<StoreModel> get stores => List.unmodifiable(_stores);
  StoreModel? get selectedStore => _selectedStore;
  String? get selectedStoreId => _selectedStore?.id;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasStores => _stores.isNotEmpty;

  Future<List<StoreModel>> loadStores({bool force = false}) async {
    if (_stores.isNotEmpty && !force) return _stores;

    _isLoading = true;
    _error = null;

    try {
      final stores = await _storeService.fetchStores();
      _stores = stores;
      await _selectInitialStore(stores);
      return _stores;
    } catch (error) {
      _error = error.toString();
      if (_storeService.stores.isNotEmpty) {
        _stores = _storeService.stores;
        await _selectInitialStore(_stores);
        return _stores;
      }
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<StoreModel?> ensureSelectedStore({bool force = false}) async {
    if (_selectedStore != null && !force) return _selectedStore;
    await loadStores(force: force || _stores.isEmpty);
    return _selectedStore;
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

  Future<void> clearSelection() async {
    _selectedStore = null;
    final prefs = await _preferences();
    await prefs.remove(_selectedStoreIdKey);
    notifyListeners();
  }

  Future<void> _selectInitialStore(List<StoreModel> stores) async {
    if (stores.isEmpty) {
      _selectedStore = null;
      return;
    }

    final prefs = await _preferences();
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
