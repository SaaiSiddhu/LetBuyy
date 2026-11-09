import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import '../config/app_config.dart';

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
  ) : intent = SecurityCommandStore.freezeIntent(intent);
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
    String environment = AppConfig.environment,
  }) : _storage = storage,
       _namespace = AppConfig.persistenceNamespace(
         environmentName: environment,
       );
  final FlutterSecureStorage _storage;
  final String _namespace;
  static Future<void>? _tail;
  String _name(MerchantSecurityContext c, String command) =>
      'letbuyy.security.command.v1:$_namespace${c.actorId}:${c.storeId}:$command';
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

  static JsonMap freezeIntent(JsonMap value) {
    Object? freeze(Object? item) => item is Map
        ? Map<String, dynamic>.unmodifiable(
            item.map((key, value) => MapEntry(key.toString(), freeze(value))),
          )
        : item is List
        ? List<Object?>.unmodifiable(item.map(freeze))
        : item;
    return freeze(captureIntent(value)) as JsonMap;
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
    return _decode(c, command, raw);
  }

  PendingSecurityCommand? _decode(
    MerchantSecurityContext c,
    String command,
    String? raw,
  ) {
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

  /// Discover existing recovery records in this exact environment/actor/store.
  /// Other storage values never become results or diagnostics. Callers still
  /// reconcile every operation through the server under current authority.
  Future<List<PendingSecurityCommand>> readPrefix(
    MerchantSecurityContext c,
    String prefix, {
    required void Function() check,
  }) async {
    if (!RegExp(r'^[a-z][a-z0-9-]*:$').hasMatch(prefix))
      throw const FormatException('Choose a valid saved request family.');
    check();
    final values = await _storage.readAll();
    check();
    final base = _name(c, ''),
        names =
            values.keys
                .where((key) => key.startsWith(_name(c, prefix)))
                .toList()
              ..sort();
    return List<PendingSecurityCommand>.unmodifiable([
      for (final name in names)
        _decode(c, name.substring(base.length), values[name])!,
    ]);
  }

  Future<PendingSecurityCommand> prepare(
    MerchantSecurityContext c,
    String command,
    JsonMap intent, {
    required void Function() check,
    String? proposedKey,
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
    if (proposedKey != null &&
        !RegExp(r'^[a-zA-Z0-9-]{8,200}$').hasMatch(proposedKey)) {
      throw const FormatException('The request key could not be confirmed.');
    }
    final pending = PendingSecurityCommand(
      c.actorId,
      c.storeId,
      command,
      proposedKey ?? const Uuid().v4(),
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

  /// Atomically retain progress for the same logical request. Call from the
  /// existing serialized boundary; never delete the old intent before writing.
  Future<PendingSecurityCommand> replaceIntent(
    MerchantSecurityContext c,
    PendingSecurityCommand previous,
    JsonMap intent, {
    required void Function() check,
  }) async {
    final old = await read(c, previous.command, check: check);
    if (old?.encoded != previous.encoded) {
      throw const ApiException(
        message: 'The saved request changed. Reload before continuing.',
        statusCode: 409,
        code: 'PENDING_SECURITY_COMMAND_CHANGED',
      );
    }
    final next = PendingSecurityCommand(
      c.actorId,
      c.storeId,
      previous.command,
      previous.key,
      intent,
    );
    check();
    await _storage.write(key: _name(c, previous.command), value: next.encoded);
    check();
    return next;
  }
}
