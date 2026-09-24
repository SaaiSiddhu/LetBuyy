import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/store_ops_repositories.dart';
import '../../../core/providers/store_providers.dart';

final pickPackControllerProvider =
    StateNotifierProvider<PickPackController, PickPackState>((ref) {
  return PickPackController(
    repository: ref.watch(storeQueueRepositoryProvider),
    traceFactory: ref.watch(storeTraceFactoryProvider),
  );
});

final class PickPackState {
  const PickPackState({
    this.loading = false,
    this.failure,
    this.lastAction,
    this.items = const [],
  });

  final bool loading;
  final AppFailure? failure;
  final String? lastAction;
  final List<PickListItem> items;

  int get pickedCount => items.where((item) => item.isPicked).length;
  bool get allPicked => items.isNotEmpty && pickedCount == items.length;

  PickPackState copyWith(
      {bool? loading,
      AppFailure? failure,
      String? lastAction,
      List<PickListItem>? items}) {
    return PickPackState(
      loading: loading ?? this.loading,
      failure: failure ?? this.failure,
      lastAction: lastAction ?? this.lastAction,
      items: items ?? this.items,
    );
  }
}

final class PickPackController extends StateNotifier<PickPackState> {
  PickPackController({
    required StoreQueueRepository repository,
    required TraceFactory traceFactory,
  })  : _repository = repository,
        _traceFactory = traceFactory,
        super(const PickPackState());

  final StoreQueueRepository _repository;
  final TraceFactory _traceFactory;

  Future<void> load(EntityId orderId) async {
    state = state.copyWith(loading: true);
    final result = await _repository.getPickList(orderId);
    state = result.fold(
      ok: (items) => state.copyWith(loading: false, items: items),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> confirmItem(
    EntityId orderId,
    EntityId itemId,
    int quantity,
  ) async {
    state = state.copyWith(loading: true);
    final result = await _repository.confirmItem(
      ConfirmPickItemCommand(
        metadata: CommandMetadata(
          traceId: _traceFactory.createTraceId(),
          idempotencyKey: _traceFactory.createIdempotencyKey('store-pick-item'),
        ),
        orderId: orderId,
        itemId: itemId,
        quantity: quantity,
      ),
    );
    state = result.fold(
      ok: (_) {
        final items = state.items
            .map(
              (item) => item.itemId == itemId
                  ? PickListItem(
                      itemId: item.itemId,
                      variantId: item.variantId,
                      name: item.name,
                      quantity: item.quantity,
                      pickedQuantity: quantity,
                      barcode: item.barcode,
                      shelfCode: item.shelfCode,
                    )
                  : item,
            )
            .toList(growable: false);
        return state.copyWith(
          loading: false,
          items: items,
          lastAction: 'item_confirmed',
        );
      },
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> pick(EntityId orderId, int version) async {
    await _run('picked', _repository.pickOrder, orderId, version);
  }

  Future<void> pack(EntityId orderId, int version) async {
    await _run('packed', _repository.packOrder, orderId, version);
  }

  Future<void> ready(EntityId orderId, int version) async {
    await _run('ready_for_pickup', _repository.readyOrder, orderId, version);
  }

  Future<void> _run(
    String action,
    Future<Result<void, AppFailure>> Function(PickPackCommand) command,
    EntityId orderId,
    int version,
  ) async {
    state = state.copyWith(loading: true);
    final result = await command(
      PickPackCommand(
        metadata: CommandMetadata(
          traceId: _traceFactory.createTraceId(),
          idempotencyKey: _traceFactory.createIdempotencyKey('store-$action'),
        ),
        orderId: orderId,
        expectedVersion: version,
      ),
    );
    state = result.fold(
      ok: (_) => state.copyWith(loading: false, lastAction: action),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }
}
