import 'package:quickcommerce_domain/quickcommerce_domain.dart';

import 'offline_store.dart';

typedef MutationReplayHandler = Future<Result<void, AppFailure>> Function(
  PendingMutation mutation,
);

final class SyncReport {
  const SyncReport({
    required this.replayed,
    required this.failed,
    required this.expired,
  });

  final int replayed;
  final int failed;
  final int expired;
}

final class SyncCoordinator {
  const SyncCoordinator({
    required OfflineStore offlineStore,
    required MutationReplayHandler replayHandler,
  })  : _offlineStore = offlineStore,
        _replayHandler = replayHandler;

  final OfflineStore _offlineStore;
  final MutationReplayHandler _replayHandler;

  Future<SyncReport> replayPending({int limit = 50}) async {
    final mutations = await _offlineStore.pendingMutations(limit: limit);
    var replayed = 0;
    var failed = 0;
    var expired = 0;

    for (final mutation in mutations) {
      if (mutation.expiresAt.isBefore(DateTime.now())) {
        await _offlineStore.updateMutation(
          mutation.copyWith(status: PendingMutationStatus.expired),
        );
        expired++;
        continue;
      }

      await _offlineStore.updateMutation(mutation.markInFlight());
      final result = await _replayHandler(mutation);
      await result.fold(
        ok: (_) async {
          replayed++;
          await _offlineStore.updateMutation(mutation.markSucceeded());
        },
        err: (failure) async {
          failed++;
          await _offlineStore.updateMutation(mutation.markFailed(failure.code));
        },
      );
    }

    return SyncReport(replayed: replayed, failed: failed, expired: expired);
  }
}
