import 'dart:async';

import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_observability/agrimore_observability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/rider_providers.dart';

final shiftControllerProvider =
    StateNotifierProvider<ShiftController, ShiftState>((ref) {
  final controller = ShiftController(
    repository: ref.watch(riderRepositoryProvider),
    traceFactory: ref.watch(riderTraceFactoryProvider),
    presencePolicy: ref.watch(riderPresencePolicyProvider),
  );
  return controller;
});

final class ShiftState {
  const ShiftState({
    this.profile,
    this.status = RiderStatus.offline,
    this.location,
    this.loading = false,
    this.failure,
    this.nextHeartbeatIn,
  });

  final RiderProfile? profile;
  final RiderStatus status;
  final GeoPoint? location;
  final bool loading;
  final AppFailure? failure;
  final Duration? nextHeartbeatIn;

  ShiftState copyWith({
    RiderProfile? profile,
    RiderStatus? status,
    GeoPoint? location,
    bool? loading,
    AppFailure? failure,
    Duration? nextHeartbeatIn,
    bool clearFailure = false,
  }) {
    return ShiftState(
      profile: profile ?? this.profile,
      status: status ?? this.status,
      location: location ?? this.location,
      loading: loading ?? this.loading,
      failure: clearFailure ? null : failure ?? this.failure,
      nextHeartbeatIn: nextHeartbeatIn ?? this.nextHeartbeatIn,
    );
  }
}

final class ShiftController extends StateNotifier<ShiftState> {
  ShiftController({
    required RiderRepository repository,
    required TraceFactory traceFactory,
    required PresencePolicy presencePolicy,
  })  : _repository = repository,
        _traceFactory = traceFactory,
        _presencePolicy = presencePolicy,
        super(const ShiftState());

  final RiderRepository _repository;
  final TraceFactory _traceFactory;
  final PresencePolicy _presencePolicy;
  Timer? _heartbeatTimer;

  Future<void> loadProfile() async {
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.getProfile();
    state = result.fold(
      ok: (profile) => state.copyWith(
        loading: false,
        profile: profile,
        status: profile.status,
      ),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> goOnline(GeoPoint location) async {
    await _setAvailability(RiderStatus.available, location);
  }

  Future<void> pause(GeoPoint location) async {
    await _setAvailability(RiderStatus.paused, location);
  }

  Future<void> goOffline(GeoPoint location) async {
    await _setAvailability(RiderStatus.offline, location);
  }

  Future<void> _setAvailability(RiderStatus status, GeoPoint location) async {
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.setAvailability(
      SetAvailabilityCommand(
        metadata: CommandMetadata(
          traceId: _traceFactory.createTraceId(),
          idempotencyKey:
              _traceFactory.createIdempotencyKey('rider-availability'),
        ),
        status: status,
        location: location,
      ),
    );
    state = result.fold(
      ok: (_) {
        _scheduleHeartbeat(status, location);
        return state.copyWith(
            loading: false, status: status, location: location);
      },
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  void _scheduleHeartbeat(RiderStatus status, GeoPoint location) {
    _heartbeatTimer?.cancel();
    final interval = _presencePolicy.heartbeatInterval(
      status: status,
      assignmentOfferActive: false,
      lowBattery: false,
    );
    state = state.copyWith(nextHeartbeatIn: interval);
    if (interval.inDays > 1) return;
    _heartbeatTimer = Timer.periodic(interval, (_) {
      _repository.sendHeartbeat(
        RiderHeartbeatCommand(
          traceId: _traceFactory.createTraceId(),
          location: location,
          status: status,
        ),
      );
    });
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    super.dispose();
  }
}
