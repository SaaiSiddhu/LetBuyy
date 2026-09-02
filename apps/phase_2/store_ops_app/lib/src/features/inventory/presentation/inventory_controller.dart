import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_observability/agrimore_observability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/store_ops_repositories.dart';
import '../../../core/providers/store_providers.dart';

final inventoryControllerProvider =
    StateNotifierProvider<InventoryController, InventoryState>((ref) {
  return InventoryController(
    repository: ref.watch(storeQueueRepositoryProvider),
    storeId: ref.watch(selectedStoreIdProvider),
    traceFactory: ref.watch(storeTraceFactoryProvider),
  );
});

final class InventoryState {
  const InventoryState({
    this.loading = false,
    this.items = const [],
    this.failure,
    this.lastAdjustedVariantId,
  });

  final bool loading;
  final List<InventorySnapshot> items;
  final AppFailure? failure;
  final EntityId? lastAdjustedVariantId;

  InventoryState copyWith({
    bool? loading,
    List<InventorySnapshot>? items,
    AppFailure? failure,
    EntityId? lastAdjustedVariantId,
  }) {
    return InventoryState(
      loading: loading ?? this.loading,
      items: items ?? this.items,
      failure: failure ?? this.failure,
      lastAdjustedVariantId:
          lastAdjustedVariantId ?? this.lastAdjustedVariantId,
    );
  }
}

final class InventoryController extends StateNotifier<InventoryState> {
  InventoryController({
    required StoreQueueRepository repository,
    required EntityId storeId,
    required TraceFactory traceFactory,
  })  : _repository = repository,
        _storeId = storeId,
        _traceFactory = traceFactory,
        super(const InventoryState());

  final StoreQueueRepository _repository;
  final EntityId _storeId;
  final TraceFactory _traceFactory;

  Future<void> load() async {
    state = state.copyWith(loading: true);
    final result = await _repository.listInventory(_storeId);
    state = result.fold(
      ok: (items) => state.copyWith(loading: false, items: items),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> adjust(
    EntityId variantId, {
    required int delta,
    required String reason,
  }) async {
    state = state.copyWith(loading: true);
    final result = await _repository.adjustInventory(
      StoreInventoryCommand(
        metadata: CommandMetadata(
          traceId: _traceFactory.createTraceId(),
          idempotencyKey: _traceFactory.createIdempotencyKey('store-inventory'),
        ),
        storeId: _storeId,
        variantId: variantId,
        delta: delta,
        reason: reason,
      ),
    );
    state = result.fold(
      ok: (_) {
        final items = state.items
            .map(
              (item) => item.variantId == variantId
                  ? InventorySnapshot(
                      storeId: item.storeId,
                      variantId: item.variantId,
                      onHand: item.onHand + delta,
                      reserved: item.reserved,
                      safetyStock: item.safetyStock,
                      version: item.version + 1,
                    )
                  : item,
            )
            .toList(growable: false);
        return state.copyWith(
          loading: false,
          items: items,
          lastAdjustedVariantId: variantId,
        );
      },
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }
}
