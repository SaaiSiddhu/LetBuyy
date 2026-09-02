import 'dart:async';
import 'dart:convert';

import 'package:agrimore_api/agrimore_api.dart';
import 'package:agrimore_domain/agrimore_domain.dart';
import 'package:agrimore_observability/agrimore_observability.dart';
import 'package:agrimore_realtime/agrimore_realtime.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/bootstrap/store_environment.dart';
import '../data/store_ops_repositories.dart';

final storeEnvironmentProvider = Provider<StoreEnvironment>((ref) {
  return StoreEnvironment.fromCompileTime();
});

final storeTraceFactoryProvider =
    Provider<TraceFactory>((ref) => TraceFactory());
final storeLoggerProvider = Provider<StructuredLogger>((ref) => _StoreLogger());

final storeApiClientProvider = Provider<AgrimoreApiClient>((ref) {
  return AgrimoreApiClient(
    environment: ref.watch(storeEnvironmentProvider).toApiEnvironment(),
    authTokenProvider: const EmptyApiAuthTokenProvider(),
    logger: ref.watch(storeLoggerProvider),
  );
});

final storeRealtimeClientProvider = Provider<RealtimeClient>((ref) {
  final client = GatewayRealtimeClient(
    realtimeUrl: ref.watch(storeEnvironmentProvider).realtimeUrl,
    tokenProvider: const _EmptyRealtimeTokenProvider(),
    logger: ref.watch(storeLoggerProvider),
  );
  ref.onDispose(() => unawaited(client.disconnect()));
  return client;
});

final storeQueueRepositoryProvider = Provider<StoreQueueRepository>((ref) {
  return ApiStoreQueueRepository(
    api: ref.watch(storeApiClientProvider),
    realtimeClient: ref.watch(storeRealtimeClientProvider),
  );
});

final storeLoadPolicyProvider = Provider<StoreLoadPolicy>((ref) {
  return const StoreLoadPolicy();
});

final storeSlaPolicyProvider = Provider<SlaPolicy>((ref) {
  return const SlaPolicy();
});

final selectedStoreIdProvider = Provider<EntityId>((ref) {
  return EntityId(ref.watch(storeEnvironmentProvider).defaultStoreId);
});

final class _StoreLogger implements StructuredLogger {
  @override
  void write(StructuredLogEvent event) {
    debugPrint(jsonEncode(event.toJson()));
  }
}

final class _EmptyRealtimeTokenProvider implements RealtimeAuthTokenProvider {
  const _EmptyRealtimeTokenProvider();

  @override
  Future<String?> accessToken() async => null;
}
