import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/presentation/store_scaffold.dart';
import 'store_onboarding_controller.dart';

class StoreOnboardingPage extends ConsumerWidget {
  const StoreOnboardingPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(storeOnboardingViewStateProvider);
    return StoreScaffold(
      title: 'Store readiness',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.flag_circle_outlined),
              title: const Text('Store assignment'),
              subtitle: Text(state.assignedStore),
              trailing: Text(state.readinessLabel),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.verified_outlined),
              title: const Text('Operational configuration'),
              subtitle: Text(state.configurationNotes.join('\n')),
            ),
          ),
          for (final note in state.configurationNotes)
            CheckboxListTile(
              value: true,
              onChanged: null,
              title: Text(note),
              subtitle: const Text('Backed by gateway and Postgres state'),
            ),
        ],
      ),
    );
  }
}
