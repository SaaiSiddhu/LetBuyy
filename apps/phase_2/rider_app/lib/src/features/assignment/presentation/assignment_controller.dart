import 'dart:async';

import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/rider_providers.dart';

final assignmentControllerProvider =
    StateNotifierProvider<AssignmentController, AssignmentState>((ref) {
  final controller = AssignmentController(
    riderRepository: ref.watch(riderRepositoryProvider),
    deliveryRepository: ref.watch(riderDeliveryRepositoryProvider),
    traceFactory: ref.watch(riderTraceFactoryProvider),
    presencePolicy: ref.watch(riderPresencePolicyProvider),
  );
  return controller;
});

final class AssignmentState {
  const AssignmentState({
    this.offer,
    this.loading = false,
    this.failure,
    this.remaining,
    this.acceptedDelivery,
  });

  final RiderAssignmentOffer? offer;
  final bool loading;
  final AppFailure? failure;
  final Duration? remaining;
  final Delivery? acceptedDelivery;

  AssignmentState copyWith({
    RiderAssignmentOffer? offer,
    bool? loading,
    AppFailure? failure,
    Duration? remaining,
    Delivery? acceptedDelivery,
    bool clearFailure = false,
  }) {
    return AssignmentState(
      offer: offer ?? this.offer,
      loading: loading ?? this.loading,
      failure: clearFailure ? null : failure ?? this.failure,
      remaining: remaining ?? this.remaining,
      acceptedDelivery: acceptedDelivery ?? this.acceptedDelivery,
    );
  }
}

final class AssignmentController extends StateNotifier<AssignmentState> {
  AssignmentController({
    required RiderRepository riderRepository,
    required DeliveryRepository deliveryRepository,
    required TraceFactory traceFactory,
    required PresencePolicy presencePolicy,
  })  : _riderRepository = riderRepository,
        _deliveryRepository = deliveryRepository,
        _traceFactory = traceFactory,
        _presencePolicy = presencePolicy,
        super(const AssignmentState()) {
    _subscription = _riderRepository.watchAssignmentOffers().listen(_onOffer);
  }

  final RiderRepository _riderRepository;
  final DeliveryRepository _deliveryRepository;
  final TraceFactory _traceFactory;
  final PresencePolicy _presencePolicy;
  StreamSubscription<RiderAssignmentOffer>? _subscription;
  Timer? _timer;

  Future<void> accept() async {
    final offer = state.offer;
    if (offer == null) return;
    if (_presencePolicy.shouldRejectOffer(
      now: DateTime.now(),
      expiresAt: offer.expiresAt,
      expectedVersion: 0,
      currentVersion: 0,
    )) {
      state = state.copyWith(
        failure: const DeliveryFailure(
          code: ErrorCodes.deliveryAssignmentExpired,
          message: 'Assignment offer expired.',
        ),
      );
      return;
    }
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _deliveryRepository.acceptAssignment(
      AcceptAssignmentCommand(
        metadata: _metadata('assignment-accept'),
        offerId: offer.offerId,
        deliveryId: offer.deliveryId,
      ),
    );
    state = result.fold(
      ok: (delivery) => state.copyWith(
        loading: false,
        acceptedDelivery: delivery,
        offer: offer,
      ),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> reject(String reason) async {
    final offer = state.offer;
    if (offer == null) return;
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _deliveryRepository.rejectAssignment(
      RejectAssignmentCommand(
        metadata: _metadata('assignment-reject'),
        offerId: offer.offerId,
        deliveryId: offer.deliveryId,
        reason: reason,
      ),
    );
    state = result.fold(
      ok: (_) => const AssignmentState(),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  void _onOffer(RiderAssignmentOffer offer) {
    _timer?.cancel();
    state = AssignmentState(
      offer: offer,
      remaining: offer.expiresAt.difference(DateTime.now()),
    );
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      final remaining = offer.expiresAt.difference(DateTime.now());
      if (remaining.isNegative) {
        _timer?.cancel();
        state = state.copyWith(
          remaining: Duration.zero,
          failure: const DeliveryFailure(
            code: ErrorCodes.deliveryAssignmentExpired,
            message: 'Assignment offer expired.',
          ),
        );
      } else {
        state = state.copyWith(remaining: remaining);
      }
    });
  }

  CommandMetadata _metadata(String prefix) => CommandMetadata(
        traceId: _traceFactory.createTraceId(),
        idempotencyKey: _traceFactory.createIdempotencyKey(prefix),
      );

  @override
  void dispose() {
    _subscription?.cancel();
    _timer?.cancel();
    super.dispose();
  }
}
