import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import 'api_client.dart';
import '../config/app_config.dart';

class StaffMemberContract {
  const StaffMemberContract({
    required this.id,
    required this.storeId,
    required this.email,
    required this.fullName,
    required this.role,
    required this.status,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
    this.granted = const [],
  });

  factory StaffMemberContract.fromJson(Map<String, dynamic> json) {
    return StaffMemberContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      email: _stringValue(json['email']),
      fullName: _stringValue(
        json['full_name'] ?? json['name'],
        fallback: _stringValue(json['email']),
      ),
      role: _stringValue(json['role'], fallback: 'staff'),
      status: _stringValue(json['status'], fallback: 'active'),
      isActive: _boolValue(json['is_active'], fallback: true),
      createdAt: _stringValue(json['created_at']),
      updatedAt: _stringValue(json['updated_at']),
      granted:
          ((json['permissions'] is Map ? json['permissions']['granted'] : null)
                      as List? ??
                  const [])
              .whereType<String>()
              .toList(growable: false),
    );
  }

  final String id;
  final String storeId;
  final String email;
  final String fullName;
  final String role;
  final String status;
  final bool isActive;
  final String createdAt;
  final String updatedAt;
  final List<String> granted;

  String get displayName => fullName.isEmpty ? email : fullName;
}

class StaffInviteInput {
  const StaffInviteInput({
    required this.storeId,
    required this.email,
    required this.role,
  });

  final String storeId;
  final String email;
  final String role;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'email': email.trim().toLowerCase(),
    'role': role,
  };
}

class StaffInvitationResult {
  StaffInvitationResult.fromJson(Map<String, dynamic> json)
    : member = StaffMemberContract.fromJson(json),
      url = _stringValue((json['invitation'] as Map?)?['accept_url']),
      expiresAt = _stringValue((json['invitation'] as Map?)?['expires_at']);
  final StaffMemberContract member;
  final String url;
  final String expiresAt;
}

/// Parse only this purpose's proof or the configured Merchant invitation URL.
/// This validates shape/destination only; account, expiry and grants are server-owned.
String? staffInvitationProof(String input) {
  var proof = input.trim();
  if (!proof.startsWith('lb-staff-invite-v1.')) {
    final uri = Uri.tryParse(proof),
        admin = Uri.tryParse(AppConfig.adminBaseUrl);
    if (uri == null ||
        admin == null ||
        !uri.hasScheme ||
        !uri.hasAuthority ||
        !admin.hasScheme ||
        !admin.hasAuthority ||
        uri.origin != admin.origin ||
        uri.path != '/accept-invite' ||
        uri.userInfo.isNotEmpty)
      return null;
    proof = uri.queryParameters['token'] ?? '';
  }
  return RegExp(
        r'^lb-staff-invite-v1\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{64}$',
      ).hasMatch(proof)
      ? proof
      : null;
}

class StaffService extends ChangeNotifier {
  StaffService({required ApiClient api}) : _api = api;

  final ApiClient _api;
  static const _storage = FlutterSecureStorage();
  static const _pendingKey = 'letbuyy.staff.mutations.v1';
  Future<void> _mutationTail = Future<void>.value();
  static const _invitationKey = 'letbuyy.staff.pending-invitation.v1';
  String? _pendingInvitation;
  String? get pendingInvitation => _pendingInvitation;

  Future<void> restorePendingInvitation() async {
    final raw = await _storage.read(key: _invitationKey);
    _pendingInvitation = raw == null ? null : staffInvitationProof(raw);
  }

  Future<void> rememberInvitation(String input) async {
    final proof = staffInvitationProof(input);
    if (proof == null)
      throw const FormatException(
        'Open the complete invitation link from your store owner.',
      );
    await _storage.write(key: _invitationKey, value: proof);
    _pendingInvitation = proof;
    notifyListeners();
  }

  Future<void> clearInvitation() async {
    await _storage.delete(key: _invitationKey);
    _pendingInvitation = null;
    notifyListeners();
  }

  Future<Map<String, dynamic>> previewInvitation() async {
    final proof = _pendingInvitation;
    if (proof == null) throw StateError('Invitation link is missing.');
    return _api.employees.previewInvite(proof);
  }

  Future<Map<String, dynamic>> acceptInvitation(String invitationId) async {
    final proof = _pendingInvitation;
    if (proof == null) throw StateError('Invitation link is missing.');
    return _withRetryKey('accept:$invitationId', '', {
      'token': proof,
    }, (options) => _api.employees.acceptInvite(proof, options: options));
  }

  Future<StaffInvitationResult> inviteStaff(
    StaffInviteInput input, {
    StaffMemberContract? renew,
  }) async {
    final body = {
      ...input.toJson(),
      if (renew != null) ...{
        'employee_id': renew.id,
        'expected_updated_at': renew.updatedAt,
        'permissions': {'granted': renew.granted},
      },
    };
    final result = StaffInvitationResult.fromJson(
      await _withRetryKey(
        renew == null ? 'invite' : 'renew:${renew.id}',
        input.storeId,
        body,
        (options) => _api.employees.invite(body, options: options),
      ),
    );
    _members = [
      result.member,
      ..._members.where((item) => item.id != result.member.id),
    ];
    notifyListeners();
    return result;
  }

  Future<T> _withRetryKey<T>(
    String operation,
    String storeId,
    Map<String, dynamic> body,
    Future<T> Function(ApiRequestOptions) send,
  ) {
    final result = Completer<T>();
    _mutationTail = _mutationTail.then((_) async {
      try {
        final raw = await _storage.read(key: _pendingKey);
        final pending = raw == null
            ? <String, dynamic>{}
            : Map<String, dynamic>.from(jsonDecode(raw) as Map);
        final intent = jsonEncode([operation, storeId, body]);
        final key = pending[intent] is String
            ? pending[intent] as String
            : const Uuid().v4();
        pending[intent] = key;
        await _storage.write(key: _pendingKey, value: jsonEncode(pending));
        final value = await send(
          ApiRequestOptions(idempotencyKey: key, body: body),
        );
        pending.remove(intent);
        await _storage.write(key: _pendingKey, value: jsonEncode(pending));
        result.complete(value);
      } catch (error, stack) {
        result.completeError(error, stack);
      }
    });
    return result.future;
  }

  List<StaffMemberContract> _members = [];
  List<StaffMemberContract> get members => List.unmodifiable(_members);

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<List<StaffMemberContract>> fetchStaff(String storeId) async {
    _isLoading = true;
    notifyListeners();
    try {
      final rows = await _api.employees.list(storeId: storeId);
      _members = rows.map(StaffMemberContract.fromJson).toList(growable: false);
      return _members;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<StaffMemberContract> createStaff(StaffInviteInput input) async {
    final member = StaffMemberContract.fromJson(
      await _withRetryKey(
        'create',
        input.storeId,
        input.toJson(),
        (options) => _api.employees.create(input.toJson(), options: options),
      ),
    );
    _members = [member, ..._members.where((item) => item.id != member.id)];
    notifyListeners();
    return member;
  }

  Future<StaffMemberContract> updateRole(
    StaffMemberContract member,
    String role,
  ) async {
    final updated = StaffMemberContract.fromJson(
      await _withRetryKey(
        'update:${member.id}',
        member.storeId,
        {
          'role': role,
          'expected_updated_at': member.updatedAt,
          'store_id': member.storeId,
        },
        (options) => _api.employees.update(
          member.id,
          options.body as Map<String, dynamic>,
          options: options,
        ),
      ),
    );
    _members = _members
        .map((item) => item.id == updated.id ? updated : item)
        .toList(growable: false);
    notifyListeners();
    return updated;
  }

  Future<void> removeStaff(StaffMemberContract member) async {
    await _withRetryKey('remove:${member.id}', member.storeId, {
      'expected_updated_at': member.updatedAt,
      'store_id': member.storeId,
    }, (options) => _api.employees.remove(member.id, options: options));
    _members = _members.where((item) => item.id != member.id).toList();
    notifyListeners();
  }
}

bool _boolValue(Object? value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}

String _stringValue(Object? value, {String fallback = ''}) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? fallback : text;
}

String staffPermissionLabel(String key) =>
    const {
      'products:read': 'View products',
      'products:write': 'Manage products & collections',
      'orders:read': 'View orders',
      'orders:write': 'Manage & fulfil orders',
      'customers:read': 'View customers',
      'customers:write': 'Manage customers',
      'content:write': 'Edit pages, blog & theme content',
      'marketing:write': 'Run campaigns & discounts',
      'shipping:write': 'Manage shipping & delivery',
      'returns:write': 'Process returns & refunds',
      'reports:read': 'View analytics & reports',
      'settings:write': 'Change store settings',
    }[key] ??
    key;
