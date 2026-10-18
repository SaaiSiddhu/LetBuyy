import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';

class PendingLoyaltySave {
  PendingLoyaltySave({
    required this.actorId,
    required this.storeId,
    required this.key,
    required JsonMap intent,
  }) : intent = Map.unmodifiable(intent);
  final String actorId, storeId, key;
  final JsonMap intent;
  JsonMap toJson() => {
    'actor_id': actorId,
    'store_id': storeId,
    'key': key,
    'intent': intent,
  };
  String get encoded => jsonEncode(toJson());
  static PendingLoyaltySave parse(String raw, String actor, String store) {
    final data = jsonDecode(raw), intent = data is Map ? data['intent'] : null;
    if (data is! Map ||
        data['actor_id'] != actor ||
        data['store_id'] != store ||
        data['key'] is! String ||
        (data['key'] as String).length < 8 ||
        (data['key'] as String).length > 200 ||
        (data['key'] as String).trim() != data['key'] ||
        RegExp(r'[\x00-\x1f\x7f]').hasMatch(data['key'] as String) ||
        intent is! Map ||
        intent.keys.any(
          (key) => ![
            'expected_updated_at',
            'is_active',
            'earn_rate_bps',
            'redeem_cap_bps',
            'point_value_minor',
          ].contains(key),
        ) ||
        !intent.containsKey('expected_updated_at') ||
        (intent['expected_updated_at'] != null &&
            (intent['expected_updated_at'] is! String ||
                !(intent['expected_updated_at'] as String).contains('T') ||
                DateTime.tryParse(intent['expected_updated_at'] as String) ==
                    null)) ||
        intent['is_active'] is! bool ||
        !_bps(intent['earn_rate_bps']) ||
        !_bps(intent['redeem_cap_bps']) ||
        !validLoyaltyPointValue(intent['point_value_minor'])) {
      throw const FormatException(
        'The previous loyalty save could not be recovered. Reload current settings and discard the pending save.',
      );
    }
    return PendingLoyaltySave(
      actorId: actor,
      storeId: store,
      key: data['key'] as String,
      intent: asJsonMap(intent),
    );
  }

  static bool _bps(Object? value) =>
      value is int && value >= 0 && value <= 10000;
}

typedef LoyaltyLoaded = ({
  JsonMap snapshot,
  PendingLoyaltySave? pending,
  String actorId,
  Object? requestContext,
});
typedef _LoyaltyContext = ({String actor, String store, Object? version});

/// Pending commands are encrypted and account/store scoped, never a balance or
/// credential store. The Gateway remains the settings/audit/receipt authority.
class LoyaltyService {
  LoyaltyService({
    required ApiClient api,
    required String? Function() actorIdProvider,
    required String? Function() storeIdProvider,
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _api = api,
       _actorIdProvider = actorIdProvider,
       _storeIdProvider = storeIdProvider,
       _storage = storage;
  final ApiClient _api;
  final String? Function() _actorIdProvider, _storeIdProvider;
  final FlutterSecureStorage _storage;
  static Future<void>? _tail;
  String? get actorId => _actorIdProvider();
  Object? get requestContext => _api.captureRequestContext();
  String _name(_LoyaltyContext c) =>
      'letbuyy.loyalty.pending.v1:${c.actor}:${c.store}';
  _LoyaltyContext _capture(String store, {Object? expected}) {
    final actor = _actorIdProvider(), version = _api.captureRequestContext();
    if (actor == null ||
        actor.isEmpty ||
        _storeIdProvider() != store ||
        (expected != null && version != expected))
      throw _changed();
    return (actor: actor, store: store, version: version);
  }

  void _check(_LoyaltyContext c) {
    if (_actorIdProvider() != c.actor ||
        _storeIdProvider() != c.store ||
        _api.captureRequestContext() != c.version)
      throw _changed();
  }

  static ApiException _changed() => const ApiException(
    message: 'The account or store changed. Reload loyalty settings.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );
  Future<T> _serialized<T>(Future<T> Function() action) {
    final result = Completer<T>(), released = Completer<void>();
    final previous = _tail, gate = released.future;
    _tail = gate;
    void release() {
      if (identical(_tail, gate)) _tail = null;
      released.complete();
    }

    () async {
      try {
        if (previous != null) await previous;
        final value = await action();
        // Release the queue before notifying its consumer. An idle service must
        // not retain the scheduling zone of a disposed route or test binding.
        release();
        result.complete(value);
      } catch (error, stack) {
        release();
        result.completeError(error, stack);
      }
    }();
    return result.future;
  }

  Future<LoyaltyLoaded> load(
    String store, {
    bool discardPending = false,
    Object? expectedContext,
  }) {
    final c = _capture(store, expected: expectedContext);
    return _serialized(() async {
      _check(c);
      final name = _name(c), captured = await _storage.read(key: _name(c));
      _check(c);
      final snapshot = await _api.loyalty.program(
        store,
        options: ApiRequestOptions(expectedContextVersion: c.version),
      );
      _check(c);
      var current = await _storage.read(key: name);
      _check(c);
      if (discardPending && current == captured) {
        await _storage.delete(key: name);
        _check(c);
        current = null;
      }
      return (
        snapshot: snapshot,
        pending: current == null
            ? null
            : PendingLoyaltySave.parse(current, c.actor, c.store),
        actorId: c.actor,
        requestContext: c.version,
      );
    });
  }

  Future<JsonMap> save(
    String store,
    JsonMap intent, {
    required Object? expectedContext,
  }) {
    final c = _capture(store, expected: expectedContext);
    final capturedIntent = Map<String, dynamic>.unmodifiable(intent);
    return _serialized(() async {
      _check(c);
      final name = _name(c), raw = await _storage.read(key: _name(c));
      _check(c);
      final command = raw == null
          ? PendingLoyaltySave(
              actorId: c.actor,
              storeId: c.store,
              key: const Uuid().v4(),
              intent: capturedIntent,
            )
          : PendingLoyaltySave.parse(raw, c.actor, c.store);
      PendingLoyaltySave.parse(command.encoded, c.actor, c.store);
      await _storage.write(key: name, value: command.encoded);
      _check(c);
      Future<void> complete() async {
        final current = await _storage.read(key: name);
        _check(c);
        if (current != null &&
            PendingLoyaltySave.parse(current, c.actor, c.store).key ==
                command.key) {
          await _storage.delete(key: name);
          _check(c);
        }
      }

      try {
        final result = await _api.loyalty.setProgram(
          {...command.intent, 'store_id': store},
          idempotencyKey: command.key,
          options: ApiRequestOptions(
            expectedContextVersion: c.version,
            maxRetries: 0,
          ),
        );
        _check(c);
        await complete();
        return result;
      } on ApiException catch (error) {
        _check(c);
        if ([400, 409, 422].contains(error.statusCode) &&
            error.code != 'SESSION_CONTEXT_CHANGED')
          await complete();
        rethrow;
      }
    });
  }
}

int? loyaltyPercentageToBps(String value) {
  if (!RegExp(r'^(0|[1-9][0-9]?|100)(\.[0-9]{1,2})?$').hasMatch(value))
    return null;
  final pieces = value.split('.'),
      result =
          int.parse(pieces.first) * 100 +
          int.parse((pieces.length == 1 ? '' : pieces[1]).padRight(2, '0'));
  return result <= 10000 ? result : null;
}

String loyaltyBpsToPercentage(int value) =>
    (value / 100).toStringAsFixed(2).replaceFirst(RegExp(r'\.00$'), '');
bool validLoyaltyPointValue(Object? value) =>
    value is String &&
    RegExp(r'^[1-9][0-9]{0,18}$').hasMatch(value) &&
    BigInt.parse(value) <= BigInt.parse('9223372036854775807');
String loyaltyPaiseLabel(BigInt value) {
  final negative = value.isNegative,
      absolute = value.abs(),
      whole = (absolute ~/ BigInt.from(100)).toString();
  final groups = <String>[];
  var remaining = whole;
  if (remaining.length > 3) {
    groups.insert(0, remaining.substring(remaining.length - 3));
    remaining = remaining.substring(0, remaining.length - 3);
    while (remaining.length > 2) {
      groups.insert(0, remaining.substring(remaining.length - 2));
      remaining = remaining.substring(0, remaining.length - 2);
    }
    groups.insert(0, remaining);
  } else {
    groups.add(remaining);
  }
  return '${negative ? '-' : ''}₹${groups.join(',')}.${(absolute % BigInt.from(100)).toString().padLeft(2, '0')}';
}
