import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';
import 'security_command_store.dart';

class MerchantStepUpProof {
  const MerchantStepUpProof._(
    this.context,
    this.action,
    this.token,
    this.verifiedAt,
  );
  final MerchantSecurityContext context;
  final String action, token, verifiedAt;
  void ensureCurrent(ApiClient api, {String forAction = 'refund.approve'}) {
    if (action != forAction ||
        context.version == null ||
        api.captureRequestContext() != context.version)
      throw TwoFactorService.changed();
  }

  ApiRequestOptions options(String key) => ApiRequestOptions(
    idempotencyKey: key,
    storeId: context.storeId,
    expectedContextVersion: context.version,
    headers: {'X-Step-Up-Token': token, 'X-Step-Up-Verified-At': verifiedAt},
  );
}

class TwoFactorService extends ChangeNotifier {
  TwoFactorService({
    required ApiClient api,
    required String? Function() actorIdProvider,
    required String? Function() storeIdProvider,
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _api = api,
       _actor = actorIdProvider,
       _store = storeIdProvider,
       _commands = SecurityCommandStore(storage: storage);
  final ApiClient _api;
  final String? Function() _actor, _store;
  final SecurityCommandStore _commands;
  bool _isLoading = false, _disposed = false;
  int _read = 0;
  JsonMap? _overview;
  MerchantSecurityContext? _overviewContext;
  bool get isLoading => _isLoading;
  String? get actorId => _actor();
  Object? get requestContext => _api.captureRequestContext();
  JsonMap? get overview =>
      _overviewContext != null &&
          isCurrent(_overviewContext!) &&
          _overview != null
      ? Map.unmodifiable(_overview!)
      : null;
  List<JsonMap> get factors => _maps(overview?['factors']);
  List<JsonMap> get sessions => _maps(overview?['sessions']);
  bool get isEnabled => overview?['mfa_enabled'] == true;
  MerchantSecurityContext capture({Object? expectedContext}) {
    final actor = _actor(), store = _store(), version = requestContext;
    if (actor == null ||
        actor.isEmpty ||
        store == null ||
        store.isEmpty ||
        version == null ||
        (expectedContext != null && version != expectedContext))
      throw changed();
    return (actorId: actor, storeId: store, version: version);
  }

  bool isCurrent(MerchantSecurityContext c) =>
      !_disposed &&
      _actor() == c.actorId &&
      _store() == c.storeId &&
      requestContext == c.version;
  void check(MerchantSecurityContext c) {
    if (!isCurrent(c)) throw changed();
  }

  static ApiException changed() => const ApiException(
    message: 'The account or store changed. Reopen security before continuing.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  ApiRequestOptions _options(MerchantSecurityContext c, {String? key}) =>
      ApiRequestOptions(
        storeId: c.storeId,
        expectedContextVersion: c.version,
        idempotencyKey: key,
      );
  Future<JsonMap> fetchOverview({Object? expectedContext}) async {
    final c = capture(expectedContext: expectedContext), generation = ++_read;
    _isLoading = true;
    _notify();
    try {
      final result = await _api.twoFactor.overview(options: _options(c));
      check(c);
      if (generation != _read)
        throw const ApiException(
          message: 'A newer security read replaced this request.',
          statusCode: 409,
          code: 'SECURITY_READ_SUPERSEDED',
        );
      if (result['factors'] is! List ||
          _maps(result['factors']).length != (result['factors'] as List).length)
        throw const FormatException(
          'Security status is incomplete. Retry loading.',
        );
      String? pendingFactor;
      for (final factor in _maps(result['factors'])) {
        if (factor['factor_type'] == 'totp' && factor['status'] == 'active') {
          final pending = await _commands.read(
            c,
            'verify:${factor['id']}',
            check: () => check(c),
          );
          if (pending != null) pendingFactor = factor['id'] as String;
        }
      }
      check(c);
      if (generation != _read) throw changed();
      _overview = {
        ...result,
        if (pendingFactor != null)
          'pending_activation_factor_id': pendingFactor,
      };
      _overviewContext = c;
      return Map.from(_overview!);
    } finally {
      if (generation == _read) {
        _isLoading = false;
        _notify();
      }
    }
  }

  Future<JsonMap> enrollTotp({Object? expectedContext}) {
    final c = capture(expectedContext: expectedContext);
    return _commands.serialized(() async {
      check(c);
      final command = await _commands.prepare(
        c,
        'enroll',
        {},
        check: () => check(c),
      );
      final result = await _api.twoFactor.enrollTotp(
        options: _options(c, key: command.key),
      );
      check(c);
      if (result['factor'] is! Map ||
          asJsonMap(result['factor'])['id'] is! String ||
          result['secret'] is! String ||
          (result['secret'] as String).isEmpty)
        throw const FormatException(
          'Enrollment is incomplete. Retry the same setup.',
        );
      return Map.from(result);
    });
  }

  Future<JsonMap> verifyTotp({
    required String factorId,
    required String code,
    Object? expectedContext,
  }) {
    final c = capture(expectedContext: expectedContext);
    return _commands.serialized(() async {
      check(c);
      final command = await _commands.prepare(c, 'verify:$factorId', {
        'factor_id': factorId,
      }, check: () => check(c));
      final result = await _api.twoFactor.verifyTotp({
        'factor_id': factorId,
        'code': code,
      }, options: _options(c, key: command.key));
      check(c);
      final factor = asJsonMap(result['factor']),
          codes = result['recovery_codes'];
      if (factor['id'] != factorId ||
          factor['status'] != 'active' ||
          codes is! List ||
          codes.isEmpty ||
          codes.any((value) => value is! String))
        throw const FormatException(
          'Recovery codes were not received. Retry activation with a current authenticator code.',
        );
      _overview = {
        ...?overview,
        'mfa_enabled': true,
        'factors': [factor],
        'sessions': sessions,
        'pending_activation_factor_id': factorId,
      };
      _overviewContext = c;
      _notify();
      return Map.from(result);
    });
  }

  Future<void> acknowledgeRecovery(
    String factorId, {
    required Object? expectedContext,
  }) {
    final c = capture(expectedContext: expectedContext);
    return _commands.serialized(() async {
      for (final name in ['verify:$factorId', 'enroll']) {
        final pending = await _commands.read(c, name, check: () => check(c));
        if (pending != null)
          await _commands.complete(c, pending, check: () => check(c));
      }
      check(c);
      _overview?.remove('pending_activation_factor_id');
      _notify();
    });
  }

  Future<JsonMap> disable({
    required String factorId,
    String? code,
    String? recoveryCode,
    Object? expectedContext,
  }) {
    final c = capture(expectedContext: expectedContext);
    return _commands.serialized(() async {
      final pending = await _commands.prepare(c, 'disable:$factorId', {
        'factor_id': factorId,
      }, check: () => check(c));
      final result = await _api.twoFactor.disable({
        'factor_id': factorId,
        if (code != null && code.isNotEmpty) 'code': code,
        if (recoveryCode != null && recoveryCode.isNotEmpty)
          'recovery_code': recoveryCode,
      }, options: _options(c, key: pending.key));
      check(c);
      if (asJsonMap(result['factor'])['status'] != 'disabled')
        throw const FormatException(
          'Disable is incomplete. Retry the same request.',
        );
      await _commands.complete(c, pending, check: () => check(c));
      for (final name in ['verify:$factorId', 'enroll']) {
        final old = await _commands.read(c, name, check: () => check(c));
        if (old != null)
          await _commands.complete(c, old, check: () => check(c));
      }
      check(c);
      _overview = {
        ...?overview,
        'mfa_enabled': false,
        'factors': [asJsonMap(result['factor'])],
        'sessions': sessions,
      };
      _overviewContext = c;
      _notify();
      return Map.from(result);
    });
  }

  Future<MerchantStepUpProof> challenge({
    required String action,
    required String factorId,
    required String code,
    required String idempotencyKey,
    required Object? expectedContext,
  }) async {
    final c = capture(expectedContext: expectedContext);
    if (!['refund.approve', 'payout.release'].contains(action))
      throw const FormatException('Unsupported approval action.');
    final result = await _api.security.challenge({
      'store_id': c.storeId,
      'action': action,
      'factor_id': factorId,
      'code': code,
      'idempotency_key': idempotencyKey,
    }, options: _options(c, key: idempotencyKey));
    check(c);
    if (result['step_up_token'] is! String ||
        (result['step_up_token'] as String).isEmpty ||
        result['verified_at'] is! String ||
        DateTime.tryParse(result['verified_at']) == null)
      throw const FormatException(
        'Approval was incomplete. Retry the same verification.',
      );
    return MerchantStepUpProof._(
      c,
      action,
      result['step_up_token'],
      result['verified_at'],
    );
  }

  static List<JsonMap> _maps(Object? value) => value is List
      ? value
            .whereType<Map>()
            .map((row) => Map<String, dynamic>.from(row))
            .toList(growable: false)
      : const [];
  @override
  void dispose() {
    _disposed = true;
    _overview = null;
    _overviewContext = null;
    super.dispose();
  }
}
