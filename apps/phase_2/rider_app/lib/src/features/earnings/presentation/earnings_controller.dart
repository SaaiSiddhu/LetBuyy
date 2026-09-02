import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/rider_providers.dart';

final earningsControllerProvider =
    StateNotifierProvider<EarningsController, EarningsState>((ref) {
  return EarningsController(repository: ref.watch(riderRepositoryProvider));
});

final class EarningsState {
  const EarningsState({
    this.period = 'today',
    this.summary,
    this.loading = false,
    this.failure,
  });

  final String period;
  final RiderEarningsSummary? summary;
  final bool loading;
  final AppFailure? failure;

  EarningsState copyWith({
    String? period,
    RiderEarningsSummary? summary,
    bool? loading,
    AppFailure? failure,
    bool clearFailure = false,
  }) {
    return EarningsState(
      period: period ?? this.period,
      summary: summary ?? this.summary,
      loading: loading ?? this.loading,
      failure: clearFailure ? null : failure ?? this.failure,
    );
  }
}

final class EarningsController extends StateNotifier<EarningsState> {
  EarningsController({required RiderRepository repository})
      : _repository = repository,
        super(const EarningsState());

  final RiderRepository _repository;

  Future<void> load({String? period}) async {
    final nextPeriod = period ?? state.period;
    state = state.copyWith(
      period: nextPeriod,
      loading: true,
      clearFailure: true,
    );
    final result = await _repository.getEarnings(
      RiderEarningsQuery(period: nextPeriod),
    );
    state = result.fold(
      ok: (summary) => state.copyWith(loading: false, summary: summary),
      err: (failure) => state.copyWith(loading: false, failure: failure),
    );
  }
}
