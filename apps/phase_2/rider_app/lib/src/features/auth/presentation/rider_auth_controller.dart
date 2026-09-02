import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_observability/agrimore_observability.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/rider_providers.dart';

final riderAuthControllerProvider =
    StateNotifierProvider<RiderAuthController, RiderAuthState>((ref) {
  return RiderAuthController(
    repository: ref.watch(riderAuthRepositoryProvider),
    traceFactory: ref.watch(riderTraceFactoryProvider),
  );
});

final class RiderAuthState {
  const RiderAuthState({
    this.phone = '',
    this.otp = '',
    this.otpRequested = false,
    this.loading = false,
    this.failure,
  });

  final String phone;
  final String otp;
  final bool otpRequested;
  final bool loading;
  final AppFailure? failure;

  RiderAuthState copyWith({
    String? phone,
    String? otp,
    bool? otpRequested,
    bool? loading,
    AppFailure? failure,
    bool clearFailure = false,
  }) {
    return RiderAuthState(
      phone: phone ?? this.phone,
      otp: otp ?? this.otp,
      otpRequested: otpRequested ?? this.otpRequested,
      loading: loading ?? this.loading,
      failure: clearFailure ? null : failure ?? this.failure,
    );
  }
}

final class RiderAuthController extends StateNotifier<RiderAuthState> {
  RiderAuthController({
    required AuthRepository repository,
    required TraceFactory traceFactory,
  })  : _repository = repository,
        _traceFactory = traceFactory,
        super(const RiderAuthState());

  final AuthRepository _repository;
  final TraceFactory _traceFactory;

  void setPhone(String value) =>
      state = state.copyWith(phone: value, clearFailure: true);
  void setOtp(String value) =>
      state = state.copyWith(otp: value, clearFailure: true);

  Future<void> requestOtp() async {
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.requestPhoneOtp(
      phone: state.phone,
      traceId: _traceFactory.createTraceId(),
    );
    state = result.fold(
      ok: (_) => state.copyWith(loading: false, otpRequested: true),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }

  Future<void> verifyOtp() async {
    state = state.copyWith(loading: true, clearFailure: true);
    final result = await _repository.signInWithPhoneOtp(
      phone: state.phone,
      otp: state.otp,
      traceId: _traceFactory.createTraceId(),
    );
    state = result.fold(
      ok: (_) => state.copyWith(loading: false),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }
}
