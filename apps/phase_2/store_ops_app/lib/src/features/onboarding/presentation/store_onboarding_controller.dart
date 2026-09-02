import 'package:flutter_riverpod/flutter_riverpod.dart';

final storeOnboardingViewStateProvider =
    Provider<StoreOnboardingViewState>((ref) {
  return const StoreOnboardingViewState(
    assignedStore: 'Bengaluru Indiranagar DS-01',
    readinessLabel: 'Assigned',
    configurationNotes: [
      'Queue, pick-pack, and inventory actions use the store gateway routes.',
      'Service radius and SLA targets are managed from the admin app.',
      'Inventory truth remains in Postgres; local state is display-only.',
    ],
  );
});

final class StoreOnboardingViewState {
  const StoreOnboardingViewState({
    required this.assignedStore,
    required this.readinessLabel,
    required this.configurationNotes,
  });

  final String assignedStore;
  final String readinessLabel;
  final List<String> configurationNotes;
}
