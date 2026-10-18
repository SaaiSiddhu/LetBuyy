import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';

typedef MerchantSecurityContext = ({
  String actorId,
  String storeId,
  Object? version,
});

class PendingSecurityCommand {
  PendingSecurityCommand(
    this.actor,
    this.store,
    this.command,
    this.key,
    JsonMap intent,
  ) : intent = Map.unmodifiable(SecurityCommandStore.captureIntent(intent));
  final String actor, store, command, key;
  final JsonMap intent;
  String get encoded => jsonEncode({
    'actor': actor,
    'store': store,
    'command': command,
    'key': key,
    'intent': intent,
  });
}

/// Encrypted, account/store-bound logical requests. Never store factor secrets,
/// verification codes or approval tokens. The Gateway owns all effect receipts.
class SecurityCommandStore {
  SecurityCommandStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _storage = storage;
  final FlutterSecureStorage _storage;
  static Future<void>? _tail;
  String _name(MerchantSecurityContext c, String command) =>
      'letbuyy.security.command.v1:${c.actorId}:${c.storeId}:$command';
  static Object? _ordered(Object? value) => value is Map
      ? {
          for (final key
              in value.keys.map((k) => k.toString()).toList()..sort())
            key: _ordered(value[key]),
        }
      : value is List
      ? value.map(_ordered).toList()
      : value;
  static String _intent(JsonMap value) => jsonEncode(_ordered(value));
  static JsonMap captureIntent(JsonMap value) {
    _noCredentials(value);
    return asJsonMap(jsonDecode(_intent(value)));
  }

  static void _noCredentials(Object? value) {
    if (value is Map) {
      for (final entry in value.entries) {
        if ([
          'code',
          'recovery_code',
          'secret',
          'otpauth_uri',
          'step_up_token',
          'step_up_verified_at',
          'password',
          'token',
          'authorization',
        ].contains(entry.key.toString().toLowerCase()))
          throw const FormatException(
            'Credentials cannot be stored in a pending request.',
          );
        _noCredentials(entry.value);
      }
    } else if (value is List) {
      for (final item in value) {
        _noCredentials(item);
      }
    }
  }

  Future<T> serialized<T>(Future<T> Function() action) {
    final result = Completer<T>(),
        released = Completer<void>(),
        previous = _tail,
        gate = released.future;
    _tail = gate;
    void release() {
      if (identical(_tail, gate)) _tail = null;
      released.complete();
    }

    () async {
      try {
        if (previous != null) await previous;
        final value = await action();
        release();
        result.complete(value);
      } catch (error, stack) {
        release();
        result.completeError(error, stack);
      }
    }();
    return result.future;
  }

  Future<PendingSecurityCommand?> read(
    MerchantSecurityContext c,
    String command, {
    required void Function() check,
  }) async {
    check();
    final raw = await _storage.read(key: _name(c, command));
    check();
    if (raw == null) return null;
    final value = jsonDecode(raw);
    if (value is! Map ||
        value['actor'] != c.actorId ||
        value['store'] != c.storeId ||
        value['command'] != command ||
        value['key'] is! String ||
        !RegExp(r'^[a-zA-Z0-9-]{8,200}$').hasMatch(value['key']) ||
        value['intent'] is! Map)
      throw const FormatException('The saved security request needs review.');
    final intent = asJsonMap(value['intent']);
    _noCredentials(intent);
    return PendingSecurityCommand(
      c.actorId,
      c.storeId,
      command,
      value['key'],
      intent,
    );
  }

  Future<PendingSecurityCommand> prepare(
    MerchantSecurityContext c,
    String command,
    JsonMap intent, {
    required void Function() check,
  }) async {
    final captured = captureIntent(intent);
    final old = await read(c, command, check: check);
    if (old != null) {
      if (_intent(old.intent) != _intent(captured))
        throw const ApiException(
          message:
              'A previous request needs confirmation. Retry its original details before changing this action.',
          statusCode: 409,
          code: 'PENDING_SECURITY_COMMAND',
        );
      return old;
    }
    final pending = PendingSecurityCommand(
      c.actorId,
      c.storeId,
      command,
      const Uuid().v4(),
      captured,
    );
    check();
    await _storage.write(key: _name(c, command), value: pending.encoded);
    check();
    return pending;
  }

  Future<void> complete(
    MerchantSecurityContext c,
    PendingSecurityCommand command, {
    required void Function() check,
  }) async {
    final old = await read(c, command.command, check: check);
    if (old?.encoded != command.encoded) return;
    check();
    await _storage.delete(key: _name(c, command.command));
    check();
  }
}
