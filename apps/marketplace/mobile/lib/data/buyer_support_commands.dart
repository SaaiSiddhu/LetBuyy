import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';

abstract interface class BuyerSupportCommandStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class _SecureCommands implements BuyerSupportCommandStore {
  const _SecureCommands(this.storage);
  final FlutterSecureStorage storage;
  @override
  Future<String?> read(String key) => storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => storage.delete(key: key);
}

/// Immutable intent in the existing OS secure-storage boundary. No session token
/// is stored, and no private text is written to general preferences or logs.
class BuyerSupportCommand {
  const BuyerSupportCommand._(
    this.buyerId,
    this.key,
    this.ticketId,
    this.subject,
    this.body,
    this.siteId,
    this.orderId,
  );
  final String buyerId;
  final String key;
  final String? ticketId;
  final String? subject;
  final String body;
  final String? siteId;
  final String? orderId;
  bool get isCreate => ticketId == null;
  Map<String, dynamic> _json() => {
    'version': 1,
    'buyer_id': buyerId,
    'key': key,
    'ticket_id': ticketId,
    'subject': subject,
    'body': body,
    'site_id': siteId,
    'order_id': orderId,
  };
  bool _sameIntent(BuyerSupportCommand other) =>
      buyerId == other.buyerId &&
      ticketId == other.ticketId &&
      subject == other.subject &&
      body == other.body &&
      siteId == other.siteId &&
      orderId == other.orderId;
}

class BuyerSupportCommandResult {
  const BuyerSupportCommandResult._(
    this.receipt, {
    this.ticket,
    this.complaintCopy,
    this.message,
  });
  final BuyerSupportReceipt receipt;
  final JsonMap? ticket;
  final JsonMap? complaintCopy;
  final JsonMap? message;
}

/// One pending action per buyer and target. Persist-before-send and explicit
/// acknowledgement preserve the key across response loss, route disposal and
/// app restart. Changed input cannot silently replace an ambiguous action.
class BuyerSupportCommands {
  BuyerSupportCommands({
    BuyerSupportCommandStore? store,
    FlutterSecureStorage? secureStorage,
    String Function()? keyFactory,
  }) : _store =
           store ??
           _SecureCommands(secureStorage ?? const FlutterSecureStorage()),
       _keyFactory = keyFactory ?? _newKey;
  final BuyerSupportCommandStore _store;
  final String Function() _keyFactory;
  Future<void> _tail = Future<void>.value();
  static final _uuid = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  Future<T> _serial<T>(Future<T> Function() work) {
    final result = _tail.then((_) => work());
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace __) {});
    return result;
  }

  String _slot(String buyerId, String? ticketId) {
    _id(buyerId);
    if (ticketId != null) _id(ticketId);
    return 'letbuyy.buyer.support-command.v1.${buyerId.toLowerCase()}.${ticketId?.toLowerCase() ?? 'new'}';
  }

  Future<BuyerSupportCommand?> restore(String buyerId, {String? ticketId}) =>
      _serial(() => _read(buyerId, ticketId));

  Future<BuyerSupportCommand?> _read(String buyerId, String? ticketId) async {
    final value = await _store.read(_slot(buyerId, ticketId));
    if (value == null) return null;
    try {
      final data = jsonDecode(value);
      if (data is! Map ||
          data['version'] != 1 ||
          data['buyer_id'] != buyerId.toLowerCase() ||
          data['ticket_id'] != ticketId?.toLowerCase() ||
          data['key'] is! String ||
          data['body'] is! String)
        throw const FormatException();
      final command = _validated(
        buyerId,
        data['key'] as String,
        ticketId,
        data['subject'] as String?,
        data['body'] as String,
        data['site_id'] as String?,
        data['order_id'] as String?,
      );
      if (command.body != data['body'] || command.subject != data['subject'])
        throw const FormatException();
      return command;
    } catch (_) {
      throw const ApiException(
        message:
            'The saved support request could not be read. It has been kept safely; no new request was sent.',
        statusCode: 409,
        code: 'SUPPORT_PENDING_INVALID',
      );
    }
  }

  Future<BuyerSupportCommand> prepare({
    required String buyerId,
    String? ticketId,
    String? subject,
    required String body,
    String? siteId,
    String? orderId,
  }) => _serial(() async {
    final intent = _validated(
      buyerId,
      'validation-key',
      ticketId,
      subject,
      body,
      siteId,
      orderId,
    );
    final prior = await _read(buyerId, ticketId);
    if (prior != null) {
      if (!prior._sameIntent(intent))
        throw const ApiException(
          message:
              'A different support request is awaiting confirmation. Recover that saved request before sending different text.',
          statusCode: 409,
          code: 'SUPPORT_PENDING_CHANGED',
        );
      return prior;
    }
    final command = _validated(
      buyerId,
      _keyFactory(),
      ticketId,
      subject,
      body,
      siteId,
      orderId,
    );
    await _store.write(_slot(buyerId, ticketId), jsonEncode(command._json()));
    return command;
  });

  Future<BuyerSupportCommandResult> send(
    BuyerSupportCommand command,
    BuyerSupportApi api, {
    required String buyerId,
    required String token,
    required bool Function() isCurrent,
  }) async {
    void check() {
      if (buyerId.toLowerCase() != command.buyerId || !isCurrent())
        throw const ApiException(
          message:
              'Your support session changed. Return from Profile to recover your saved request.',
          statusCode: 409,
          code: 'SUPPORT_CONTEXT_CHANGED',
        );
    }

    check();
    await _serial(() async {
      final saved = await _read(command.buyerId, command.ticketId);
      if (saved == null ||
          saved.key != command.key ||
          !saved._sameIntent(command))
        throw const ApiException(
          message: 'Save this support request before sending it.',
          statusCode: 409,
          code: 'SUPPORT_PENDING_MISSING',
        );
    });
    check();
    if (command.isCreate) {
      final result = await api.createTicket(
        token,
        key: command.key,
        subject: command.subject!,
        body: command.body,
        siteId: command.siteId,
        orderId: command.orderId,
      );
      check();
      return BuyerSupportCommandResult._(
        result.receipt,
        ticket: result.ticket,
        complaintCopy: result.complaintCopy,
      );
    }
    final result = await api.reply(
      token,
      command.ticketId!,
      key: command.key,
      body: command.body,
    );
    check();
    return BuyerSupportCommandResult._(result.receipt, message: result.message);
  }

  /// A late answer can never erase a newer pending action. Call only after the
  /// current screen has accepted the server-confirmed receipt.
  Future<bool> acknowledge(
    BuyerSupportCommand command,
    BuyerSupportReceipt receipt,
  ) => _serial(() async {
    if (receipt.key != command.key ||
        receipt.operation != (command.isCreate ? 'create' : 'reply') ||
        (!command.isCreate && receipt.ticketId != command.ticketId))
      return false;
    final saved = await _read(command.buyerId, command.ticketId);
    if (saved == null ||
        saved.key != command.key ||
        !saved._sameIntent(command))
      return false;
    await _store.delete(_slot(command.buyerId, command.ticketId));
    return true;
  });

  static BuyerSupportCommand _validated(
    String buyerId,
    String key,
    String? ticketId,
    String? subject,
    String body,
    String? siteId,
    String? orderId,
  ) {
    _id(buyerId);
    if (ticketId != null) _id(ticketId);
    if (siteId != null) _id(siteId);
    if (orderId != null) _id(orderId);
    final text = body.trim(), title = subject?.trim();
    if (key.length < 8 ||
        key.length > 200 ||
        key.trim() != key ||
        RegExp(r'[\x00-\x1f\x7f]').hasMatch(key) ||
        text.isEmpty ||
        text.length > 4000 ||
        (ticketId == null &&
            (title == null || title.isEmpty || title.length > 200)) ||
        (ticketId != null &&
            (subject != null || siteId != null || orderId != null)))
      throw ArgumentError(
        'Enter a subject and message within the support limits.',
      );
    return BuyerSupportCommand._(
      buyerId.toLowerCase(),
      key,
      ticketId?.toLowerCase(),
      title,
      text,
      siteId?.toLowerCase(),
      orderId?.toLowerCase(),
    );
  }

  static void _id(String value) {
    if (!_uuid.hasMatch(value))
      throw ArgumentError('Invalid support account or resource.');
  }

  static String _newKey() {
    final random = Random.secure();
    return 'support-${base64UrlEncode(List<int>.generate(24, (_) => random.nextInt(256))).replaceAll('=', '')}';
  }
}
