import 'dart:async';

import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_observability/agrimore_observability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/rider_providers.dart';

final activeDeliveryControllerProvider =
    StateNotifierProvider<ActiveDeliveryController, ActiveDeliveryState>((ref) {
  final controller = ActiveDeliveryController(
    repository: ref.watch(riderDeliveryRepositoryProvider),
    traceFactory: ref.watch(riderTraceFactoryProvider),
  );
  return controller;
});

final class ActiveDeliveryState {
  const ActiveDeliveryState({
    this.delivery,
    this.liveState,
    this.proofUpload,
    this.loading = false,
    this.failure,
    this.staleLiveState = true,
  });

  final Delivery? delivery;
  final LiveDeliveryState? liveState;
  final ProofUploadIntent? proofUpload;
  final bool loading;
  final AppFailure? failure;
  final bool staleLiveState;

  ActiveDeliveryState copyWith({
    Delivery? delivery,
    LiveDeliveryState? liveState,
    ProofUploadIntent? proofUpload,
    bool? loading,
    AppFailure? failure,
    bool? staleLiveState,
    bool clearFailure = false,
  }) {
    return ActiveDeliveryState(
      delivery: delivery ?? this.delivery,
      liveState: liveState ?? this.liveState,
      proofUpload: proofUpload ?? this.proofUpload,
      loading: loading ?? this.loading,
      failure: clearFailure ? null : failure ?? this.failure,
      staleLiveState: staleLiveState ?? this.staleLiveState,
    );
  }
}

final class ActiveDeliveryController
    extends StateNotifier<ActiveDeliveryState> {
  ActiveDeliveryController({
    required DeliveryRepository repository,
    required TraceFactory traceFactory,
  })  : _repository = repository,
        _traceFactory = traceFactory,
        super(const ActiveDeliveryState());

  final DeliveryRepository _repository;
  final TraceFactory _traceFactory;
  StreamSubscription<LiveDeliveryState>? _liveSubscription;
  Timer? _staleTimer;

  Future<void> load() async {
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.getActiveDelivery();
    state = result.fold(
      ok: (delivery) {
        _subscribeLive(delivery.id);
        return state.copyWith(loading: false, delivery: delivery);
      },
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> transition(DeliveryStatus status) async {
    final delivery = state.delivery;
    if (delivery == null) return;
    final validation = DeliveryStateMachine.validate(delivery.status, status);
    if (validation.isErr) {
      state = state.copyWith(
        failure: validation.fold(
          ok: (_) => null,
          err: (failure) => failure,
        ),
      );
      return;
    }
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.transitionDelivery(
      DeliveryTransitionCommand(
        metadata: CommandMetadata(
          traceId: _traceFactory.createTraceId(),
          idempotencyKey:
              _traceFactory.createIdempotencyKey('delivery-transition'),
        ),
        deliveryId: delivery.id,
        targetStatus: status,
        expectedVersion: delivery.version,
      ),
    );
    state = result.fold(
      ok: (next) => state.copyWith(loading: false, delivery: next),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> requestProofUpload({String contentType = 'image/jpeg'}) async {
    final delivery = state.delivery;
    if (delivery == null) return;
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.createProofUpload(
      CreateProofUploadCommand(
        metadata: CommandMetadata(
          traceId: _traceFactory.createTraceId(),
          idempotencyKey: _traceFactory.createIdempotencyKey('delivery-proof'),
        ),
        deliveryId: delivery.id,
        contentType: contentType,
      ),
    );
    state = result.fold(
      ok: (intent) => state.copyWith(loading: false, proofUpload: intent),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  void _subscribeLive(EntityId deliveryId) {
    _liveSubscription?.cancel();
    _liveSubscription =
        _repository.watchLiveDelivery(deliveryId).listen((live) {
      _staleTimer?.cancel();
      _staleTimer = Timer(const Duration(seconds: 70), () {
        state = state.copyWith(staleLiveState: true);
      });
      state = state.copyWith(liveState: live, staleLiveState: false);
    });
  }

  @override
  void dispose() {
    _liveSubscription?.cancel();
    _staleTimer?.cancel();
    super.dispose();
  }
}
