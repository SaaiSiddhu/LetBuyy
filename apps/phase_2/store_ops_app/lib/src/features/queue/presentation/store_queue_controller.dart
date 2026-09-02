import 'dart:async';

import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/store_ops_repositories.dart';
import '../../../core/providers/store_providers.dart';

final storeQueueControllerProvider =
    StateNotifierProvider<StoreQueueController, StoreQueueState>((ref) {
  final controller = StoreQueueController(
    repository: ref.watch(storeQueueRepositoryProvider),
    storeId: ref.watch(selectedStoreIdProvider),
    loadPolicy: ref.watch(storeLoadPolicyProvider),
    slaPolicy: ref.watch(storeSlaPolicyProvider),
  );
  return controller;
});

final class StoreQueueState {
  const StoreQueueState({
    this.loading = false,
    this.items = const [],
    this.loadState = StoreLoadState.normal,
    this.failure,
  });

  final bool loading;
  final List<StoreQueueItem> items;
  final StoreLoadState loadState;
  final AppFailure? failure;

  StoreQueueState copyWith({
    bool? loading,
    List<StoreQueueItem>? items,
    StoreLoadState? loadState,
    AppFailure? failure,
  }) {
    return StoreQueueState(
      loading: loading ?? this.loading,
      items: items ?? this.items,
      loadState: loadState ?? this.loadState,
      failure: failure ?? this.failure,
    );
  }
}

final class StoreQueueController extends StateNotifier<StoreQueueState> {
  StoreQueueController({
    required StoreQueueRepository repository,
    required EntityId storeId,
    required StoreLoadPolicy loadPolicy,
    required SlaPolicy slaPolicy,
  })  : _repository = repository,
        _storeId = storeId,
        _loadPolicy = loadPolicy,
        _slaPolicy = slaPolicy,
        super(const StoreQueueState()) {
    _subscription = _repository.watchQueue(storeId).listen(_upsertItem);
  }

  final StoreQueueRepository _repository;
  final EntityId _storeId;
  final StoreLoadPolicy _loadPolicy;
  final SlaPolicy _slaPolicy;
  StreamSubscription<StoreQueueItem>? _subscription;

  Future<void> load() async {
    state = state.copyWith(loading: true);
    final result = await _repository.listQueue(_storeId);
    state = result.fold(
      ok: (items) => _stateFor(items).copyWith(loading: false),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  void _upsertItem(StoreQueueItem item) {
    final items = [
      ...state.items.where((existing) => existing.orderId != item.orderId),
      item,
    ];
    state = _stateFor(items);
  }

  StoreQueueState _stateFor(List<StoreQueueItem> items) {
    final now = DateTime.now();
    final sorted = [...items]..sort(
        (a, b) => _slaPolicy.priorityScore(b, now).compareTo(
              _slaPolicy.priorityScore(a, now),
            ),
      );
    final delayed =
        sorted.where((item) => item.slaRemaining(now).isNegative).length;
    return StoreQueueState(
      items: sorted,
      loadState: _loadPolicy.classify(
        queueDepth: sorted.length,
        delayedOrders: delayed,
        manuallyPaused: false,
      ),
    );
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
