import 'dart:async';

import 'package:quickcommerce_api/quickcommerce_api.dart';
import 'package:quickcommerce_domain/quickcommerce_domain.dart';
import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:quickcommerce_realtime/quickcommerce_realtime.dart';

import '../session/rider_session_store.dart';

final class RiderAuthRepository implements AuthRepository {
  RiderAuthRepository({
    required QuickcommerceApiClient api,
    required RiderSessionStore sessionStore,
    required TraceFactory traceFactory,
  })  : _api = api,
        _sessionStore = sessionStore,
        _traceFactory = traceFactory;

  final QuickcommerceApiClient _api;
  final RiderSessionStore _sessionStore;
  final TraceFactory _traceFactory;
  final StreamController<AuthSession?> _sessions =
      StreamController<AuthSession?>.broadcast();

  @override
  Future<Result<void, AppFailure>> requestPhoneOtp({
    required String phone,
    required TraceId traceId,
  }) async {
    final result = await _api.postCommand(
      ApiRoutes.authOtp,
      trace: TraceContext(traceId: traceId.value, requestId: traceId.value),
      idempotencyKey: _traceFactory.createIdempotencyKey('rider-auth-otp'),
      payload: {'phone': phone, 'role': UserRole.rider.toJson()},
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Future<Result<AuthSession, AppFailure>> signInWithPhoneOtp({
    required String phone,
    required String otp,
    required TraceId traceId,
  }) async {
    final result = await _api.postCommand(
      ApiRoutes.authOtpVerify,
      trace: TraceContext(traceId: traceId.value, requestId: traceId.value),
      idempotencyKey: _traceFactory.createIdempotencyKey('rider-auth-verify'),
      payload: {'phone': phone, 'otp': otp, 'role': UserRole.rider.toJson()},
    );
    return result.fold(
      ok: (json) async {
        final session = _sessionFromJson(json, UserRole.rider);
        await _sessionStore.writeSession(session);
        _sessions.add(session);
        return Ok(session);
      },
      err: (failure) async => Err(failure),
    );
  }

  @override
  Future<Result<AuthSession, AppFailure>> refreshSession() async {
    final session = await _sessionStore.readSession();
    if (session == null) return const Err(AuthFailure());
    if (!session.isExpired) return Ok(session);
    final trace = _traceFactory.createContext();
    final result = await _api.postCommand(
      ApiRoutes.authRefresh,
      trace: trace,
      idempotencyKey: _traceFactory.createIdempotencyKey('rider-auth-refresh'),
      payload: {'refreshToken': session.refreshToken},
    );
    return result.fold(
      ok: (json) async {
        final refreshed = _sessionFromJson(json, UserRole.rider);
        await _sessionStore.writeSession(refreshed);
        _sessions.add(refreshed);
        return Ok(refreshed);
      },
      err: (failure) async => Err(failure),
    );
  }

  @override
  Future<Result<void, AppFailure>> signOut() async {
    await _sessionStore.clear();
    _sessions.add(null);
    return const Ok(null);
  }

  @override
  Stream<AuthSession?> watchSession() async* {
    yield await _sessionStore.readSession();
    yield* _sessions.stream;
  }
}

final class ApiRiderRepository implements RiderRepository {
  ApiRiderRepository({
    required QuickcommerceApiClient api,
    required RealtimeClient realtimeClient,
    required RiderSessionStore sessionStore,
    required TraceFactory traceFactory,
  })  : _api = api,
        _realtimeClient = realtimeClient,
        _sessionStore = sessionStore,
        _traceFactory = traceFactory;

  final QuickcommerceApiClient _api;
  final RealtimeClient _realtimeClient;
  final RiderSessionStore _sessionStore;
  final TraceFactory _traceFactory;

  @override
  Future<Result<RiderProfile, AppFailure>> getProfile() async {
    final result = await _api.getMap(
      ApiRoutes.riderProfile,
      trace: _traceFactory.createContext(),
    );
    return result.fold(
        ok: (json) => Ok(_riderProfileFromJson(json)), err: Err.new);
  }

  @override
  Future<Result<void, AppFailure>> setAvailability(
    SetAvailabilityCommand command,
  ) async {
    final result = await _api.patchCommand(
      ApiRoutes.riderStatus,
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'status': command.status.toJson(),
        'location': command.location.toJson(),
      },
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Future<Result<RiderEarningsSummary, AppFailure>> getEarnings(
    RiderEarningsQuery query,
  ) async {
    final result = await _api.getMap(
      ApiRoutes.riderEarnings,
      trace: _traceFactory.createContext(),
      queryParameters: {'period': query.period},
    );
    return result.fold(
      ok: (json) => Ok(_riderEarningsFromJson(json)),
      err: Err.new,
    );
  }

  @override
  Future<Result<void, AppFailure>> sendHeartbeat(
    RiderHeartbeatCommand command,
  ) async {
    final trace = TraceContext(
      traceId: command.traceId.value,
      requestId: command.traceId.value,
    );
    final result = await _api.postCommand(
      ApiRoutes.riderHeartbeat,
      trace: trace,
      idempotencyKey: _traceFactory.createIdempotencyKey('rider-heartbeat'),
      payload: {
        'status': command.status.toJson(),
        'location': command.location.toJson(),
        'activeDeliveryId': command.activeDeliveryId?.value,
        'batteryPercent': command.batteryPercent,
      },
    );
    return result.fold(ok: (_) => const Ok(null), err: Err.new);
  }

  @override
  Stream<RiderAssignmentOffer> watchAssignmentOffers() async* {
    final session = await _sessionStore.readSession();
    if (session == null) return;
    yield* _realtimeClient
        .subscribe(RealtimeChannels.riderOffer(session.userId.value))
        .map((message) => RiderAssignmentOffer(
              offerId: EntityId(message.payload['offerId'] as String),
              deliveryId: EntityId(message.payload['deliveryId'] as String),
              expiresAt: DateTime.parse(message.payload['expiresAt'] as String),
            ));
  }
}

final class ApiRiderDeliveryRepository implements DeliveryRepository {
  ApiRiderDeliveryRepository({
    required QuickcommerceApiClient api,
    required RealtimeClient realtimeClient,
  })  : _api = api,
        _realtimeClient = realtimeClient;

  final QuickcommerceApiClient _api;
  final RealtimeClient _realtimeClient;

  @override
  Future<Result<Delivery, AppFailure>> getActiveDelivery() async {
    final result = await _api.getMap(
      ApiRoutes.riderDeliveries,
      trace: TraceContext(
        traceId: 'rider-active-delivery',
        requestId: 'rider-active-delivery',
      ),
      queryParameters: const {'active': true},
    );
    return result.fold(
      ok: (json) {
        final deliveryJson = _firstDeliveryJson(json);
        if (deliveryJson == null) {
          return const Err(DeliveryFailure(message: 'No active delivery.'));
        }
        return Ok(_deliveryFromJson(deliveryJson));
      },
      err: Err.new,
    );
  }

  @override
  Future<Result<Delivery, AppFailure>> acceptAssignment(
    AcceptAssignmentCommand command,
  ) async {
    final result = await _api.postCommand(
      ApiRoutes.deliveryTransition(command.deliveryId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'offerId': command.offerId.value,
        'targetStatus': DeliveryStatus.accepted.toJson(),
      },
    );
    return result.fold(ok: (json) => Ok(_deliveryFromJson(json)), err: Err.new);
  }

  @override
  Future<Result<Delivery, AppFailure>> rejectAssignment(
    RejectAssignmentCommand command,
  ) async {
    final result = await _api.postCommand(
      ApiRoutes.deliveryTransition(command.deliveryId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'offerId': command.offerId.value,
        'targetStatus': DeliveryStatus.rejected.toJson(),
        'reason': command.reason,
      },
    );
    return result.fold(ok: (json) => Ok(_deliveryFromJson(json)), err: Err.new);
  }

  @override
  Future<Result<Delivery, AppFailure>> transitionDelivery(
    DeliveryTransitionCommand command,
  ) async {
    final result = await _api.postCommand(
      ApiRoutes.deliveryTransition(command.deliveryId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {
        'targetStatus': command.targetStatus.toJson(),
        'expectedVersion': command.expectedVersion,
      },
    );
    return result.fold(ok: (json) => Ok(_deliveryFromJson(json)), err: Err.new);
  }

  @override
  Future<Result<ProofUploadIntent, AppFailure>> createProofUpload(
    CreateProofUploadCommand command,
  ) async {
    final result = await _api.postCommand(
      ApiRoutes.riderDeliveryProof(command.deliveryId.value),
      trace: _traceFromCommand(command.metadata),
      idempotencyKey: command.metadata.idempotencyKey,
      payload: {'content_type': command.contentType},
    );
    return result.fold(
      ok: (json) => Ok(_proofUploadFromJson(command.deliveryId, json)),
      err: Err.new,
    );
  }

  @override
  Stream<LiveDeliveryState> watchLiveDelivery(EntityId deliveryId) {
    return _realtimeClient
        .subscribe(RealtimeChannels.deliveryLive(deliveryId.value))
        .map((message) => _liveDeliveryFromJson(message.payload));
  }
}

AuthSession _sessionFromJson(Map<String, Object?> json, UserRole defaultRole) {
  return AuthSession(
    userId: EntityId(json['userId'] as String),
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    expiresAt: DateTime.parse(json['expiresAt'] as String),
    roles: ((json['roles'] as List?) ?? [defaultRole.toJson()])
        .cast<String>()
        .map(UserRole.fromJson)
        .toList(growable: false),
  );
}

RiderProfile _riderProfileFromJson(Map<String, Object?> json) {
  return RiderProfile(
    userId: EntityId(_stringField(json, 'userId', 'user_id')),
    cityId: EntityId(_stringField(json, 'cityId', 'city_id')),
    vehicleType:
        _nullableStringField(json, 'vehicleType', 'vehicle_type') ?? 'bike',
    status:
        RiderStatus.fromJson(json['status'] ?? RiderStatus.offline.toJson()),
    isVerified: _nullableBoolField(json, 'isVerified', 'is_verified') ?? false,
  );
}

RiderEarningsSummary _riderEarningsFromJson(Map<String, Object?> json) {
  final deliveries = _listField(json, 'deliveries')
      .whereType<Map>()
      .map((item) => item.cast<String, Object?>())
      .map(_riderEarningLineFromJson)
      .toList(growable: false);
  return RiderEarningsSummary(
    period: _nullableStringField(json, 'period') ?? 'today',
    totalEarnings: _moneyFromJson(
      json['totalEarnings'] ?? json['total_earnings'],
    ),
    totalOrders:
        _intField(json, 'totalOrders', 'total_orders') ?? deliveries.length,
    totalDistanceMeters:
        _intField(json, 'totalDistanceMeters', 'total_distance_meters') ?? 0,
    deliveries: deliveries,
  );
}

RiderEarningLine _riderEarningLineFromJson(Map<String, Object?> json) {
  final deliveredAt = _nullableStringField(json, 'deliveredAt', 'delivered_at');
  return RiderEarningLine(
    deliveryId: EntityId(_stringField(json, 'deliveryId', 'id')),
    orderId: EntityId(_stringField(json, 'orderId', 'order_id')),
    amount: _moneyFromJson(json['amount'] ?? json['earning_amount']),
    deliveredAt: DateTime.tryParse(deliveredAt ?? '') ?? DateTime.now(),
    distanceMeters: _intField(json, 'distanceMeters', 'distance_meters'),
  );
}

Delivery _deliveryFromJson(Map<String, Object?> json) {
  return Delivery(
    id: EntityId(_stringField(json, 'id')),
    orderId: EntityId(_stringField(json, 'orderId', 'order_id')),
    storeId: EntityId(_stringField(json, 'storeId', 'store_id')),
    riderId: _nullableStringField(json, 'riderId', 'rider_id') == null
        ? null
        : EntityId(_nullableStringField(json, 'riderId', 'rider_id')!),
    status: DeliveryStatus.fromJson(
      json['status'] ?? DeliveryStatus.pendingAssignment.toJson(),
    ),
    pickupLocation:
        _geoFromJson(json['pickupLocation'] ?? json['pickup_location']),
    dropLocation: _geoFromJson(json['dropLocation'] ?? json['drop_location']),
    promisedEtaAt: (json['promisedEtaAt'] ?? json['promised_eta_at']) == null
        ? null
        : DateTime.parse(
            (json['promisedEtaAt'] ?? json['promised_eta_at']) as String,
          ),
    version: json['version'] as int? ?? 0,
  );
}

LiveDeliveryState _liveDeliveryFromJson(Map<String, Object?> json) {
  final payload = (json['snapshot'] as Map?)?.cast<String, Object?>() ?? json;
  final location = payload['riderLocation'] ??
      payload['rider_location'] ??
      payload['location'] ??
      payload;
  final updatedAt = _nullableStringField(payload, 'updatedAt', 'updated_at') ??
      _nullableStringField(payload, 'lastUpdated', 'last_updated');
  return LiveDeliveryState(
    deliveryId: EntityId(_stringField(payload, 'deliveryId', 'delivery_id')),
    riderId: EntityId(
      _nullableStringField(payload, 'riderId', 'rider_id') ??
          '00000000-0000-4000-8000-000000000000',
    ),
    location: _geoFromJson(location),
    etaSeconds: _nullableIntField(payload, 'etaSeconds', 'eta_seconds') ?? 0,
    updatedAt: DateTime.tryParse(updatedAt ?? '') ?? DateTime.now(),
  );
}

ProofUploadIntent _proofUploadFromJson(
  EntityId deliveryId,
  Map<String, Object?> json,
) {
  final skipped = json['skipped'] as bool? ?? false;
  final uploadUrl = _nullableStringField(json, 'uploadUrl', 'upload_url') ??
      (skipped ? 'about:blank' : '');
  return ProofUploadIntent(
    deliveryId: deliveryId,
    key: _nullableStringField(json, 'key') ?? '',
    uploadUrl: Uri.parse(uploadUrl),
    contentType: _nullableStringField(json, 'contentType', 'content_type') ??
        'image/jpeg',
    skipped: skipped,
    reason: _nullableStringField(json, 'reason'),
  );
}

GeoPoint _geoFromJson(Object? value) {
  final json = (value as Map?)?.cast<String, Object?>() ?? const {};
  return GeoPoint(
    latitude: _nullableDoubleField(json, 'latitude', 'lat') ?? 0,
    longitude: _nullableDoubleField(json, 'longitude', 'lng') ?? 0,
  );
}

Map<String, Object?>? _firstDeliveryJson(Map<String, Object?> json) {
  if (json['id'] != null) {
    return json;
  }
  final data = json['data'];
  if (data is List && data.isNotEmpty && data.first is Map) {
    return (data.first as Map).cast<String, Object?>();
  }
  final items = json['items'];
  if (items is List && items.isNotEmpty && items.first is Map) {
    return (items.first as Map).cast<String, Object?>();
  }
  return null;
}

String _stringField(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = _nullableStringField(json, key, fallbackKey);
  if (value == null || value.isEmpty) {
    throw StateError('Missing required field $key');
  }
  return value;
}

String? _nullableStringField(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = json[key] ?? (fallbackKey == null ? null : json[fallbackKey]);
  return value as String?;
}

int? _nullableIntField(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = json[key] ?? (fallbackKey == null ? null : json[fallbackKey]);
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value);
  }
  return null;
}

double? _nullableDoubleField(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = json[key] ?? (fallbackKey == null ? null : json[fallbackKey]);
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value);
  }
  return null;
}

bool? _nullableBoolField(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = json[key] ?? (fallbackKey == null ? null : json[fallbackKey]);
  return value as bool?;
}

int? _intField(
  Map<String, Object?> json,
  String key, [
  String? fallbackKey,
]) {
  final value = json[key] ?? (fallbackKey == null ? null : json[fallbackKey]);
  return (value as num?)?.toInt();
}

List<Object?> _listField(Map<String, Object?> json, String key) {
  return (json[key] as List?)?.cast<Object?>() ?? const [];
}

Money _moneyFromJson(Object? value) {
  if (value is Money) return value;
  if (value is int) return Money(paise: value);
  if (value is double) return Money(paise: value.round());
  if (value is Map) {
    final map = value.cast<String, Object?>();
    return Money(paise: (map['paise'] as num?)?.toInt() ?? 0);
  }
  return Money.zero();
}

TraceContext _traceFromCommand(CommandMetadata metadata) {
  return TraceContext(
    traceId: metadata.traceId.value,
    requestId: metadata.traceId.value,
  );
}
