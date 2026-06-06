import 'package:flutter/foundation.dart';

import 'api_client.dart';

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

  String get displayName => fullName.isEmpty ? email : fullName;
}

class StaffInviteContract {
  const StaffInviteContract({
    required this.id,
    required this.storeId,
    required this.email,
    required this.role,
    required this.status,
    required this.token,
    required this.expiresAt,
  });

  factory StaffInviteContract.fromJson(Map<String, dynamic> json) {
    return StaffInviteContract(
      id: _stringValue(json['id']),
      storeId: _stringValue(json['store_id'] ?? json['site_id']),
      email: _stringValue(json['email']),
      role: _stringValue(json['role'], fallback: 'staff'),
      status: _stringValue(json['status'], fallback: 'pending'),
      token: _stringValue(json['token']),
      expiresAt: _stringValue(json['expires_at']),
    );
  }

  final String id;
  final String storeId;
  final String email;
  final String role;
  final String status;
  final String token;
  final String expiresAt;
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

class StaffService extends ChangeNotifier {
  StaffService({required ApiClient api}) : _api = api;

  final ApiClient _api;

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
      await _api.employees.create(input.toJson()),
    );
    _members = [member, ..._members];
    notifyListeners();
    return member;
  }

  Future<StaffInviteContract> inviteStaff(StaffInviteInput input) async {
    return StaffInviteContract.fromJson(
      await _api.employees.invite(input.toJson()),
    );
  }

  Future<StaffMemberContract> updateRole(
    StaffMemberContract member,
    String role,
  ) async {
    final updated = StaffMemberContract.fromJson(
      await _api.employees.update(member.id, {'role': role}),
    );
    _members = _members
        .map((item) => item.id == updated.id ? updated : item)
        .toList(growable: false);
    notifyListeners();
    return updated;
  }

  Future<void> removeStaff(StaffMemberContract member) async {
    await _api.employees.remove(member.id);
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
