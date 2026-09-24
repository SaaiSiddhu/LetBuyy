import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:quickcommerce_api/quickcommerce_api.dart';
import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:quickcommerce_offline/quickcommerce_offline.dart';
import 'package:quickcommerce_realtime/quickcommerce_realtime.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../../app/bootstrap/rider_environment.dart';
import '../data/rider_repositories.dart';
import '../session/rider_session_store.dart';

final riderEnvironmentProvider = Provider<RiderEnvironment>((ref) {
  return RiderEnvironment.fromCompileTime();
});

final riderTraceFactoryProvider =
    Provider<TraceFactory>((ref) => TraceFactory());

final riderLoggerProvider = Provider<StructuredLogger>((ref) {
  return _RiderDebugLogger();
});

final riderSecureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final riderSessionStoreProvider = Provider<RiderSessionStore>((ref) {
  return SecureRiderSessionStore(ref.watch(riderSecureStorageProvider));
});

final riderOfflineStoreProvider = Provider<OfflineStore>((ref) {
  final executor = LazyDatabase(() async {
    final directory = await getApplicationSupportDirectory();
    final file = File(p.join(directory.path, 'quickcommerce_rider.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
  final store = DriftOfflineStore(executor);
  unawaited(store.initialize());
  return store;
});

final riderApiClientProvider = Provider<QuickcommerceApiClient>((ref) {
  return QuickcommerceApiClient(
    environment: ref.watch(riderEnvironmentProvider).toApiEnvironment(),
    authTokenProvider: ref.watch(riderSessionStoreProvider),
    logger: ref.watch(riderLoggerProvider),
  );
});

final riderRealtimeClientProvider = Provider<RealtimeClient>((ref) {
  final client = GatewayRealtimeClient(
    realtimeUrl: ref.watch(riderEnvironmentProvider).realtimeUrl,
    tokenProvider: ref.watch(riderSessionStoreProvider),
    logger: ref.watch(riderLoggerProvider),
  );
  ref.onDispose(() => unawaited(client.disconnect()));
  unawaited(client.connect());
  return client;
});

final riderAuthRepositoryProvider = Provider<AuthRepository>((ref) {
  return RiderAuthRepository(
    api: ref.watch(riderApiClientProvider),
    sessionStore: ref.watch(riderSessionStoreProvider),
    traceFactory: ref.watch(riderTraceFactoryProvider),
  );
});

final riderSessionProvider = StreamProvider<AuthSession?>((ref) {
  return ref.watch(riderAuthRepositoryProvider).watchSession();
});

final riderRepositoryProvider = Provider<RiderRepository>((ref) {
  return ApiRiderRepository(
    api: ref.watch(riderApiClientProvider),
    realtimeClient: ref.watch(riderRealtimeClientProvider),
    sessionStore: ref.watch(riderSessionStoreProvider),
    traceFactory: ref.watch(riderTraceFactoryProvider),
  );
});

final riderDeliveryRepositoryProvider = Provider<DeliveryRepository>((ref) {
  return ApiRiderDeliveryRepository(
    api: ref.watch(riderApiClientProvider),
    realtimeClient: ref.watch(riderRealtimeClientProvider),
  );
});

final riderPresencePolicyProvider = Provider<PresencePolicy>((ref) {
  return const PresencePolicy();
});

final class _RiderDebugLogger implements StructuredLogger {
  @override
  void write(StructuredLogEvent event) {
    debugPrint(jsonEncode(event.toJson()));
  }
}
