// lib/models/team_member_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';

// Helper to safely parse timestamps (handles Firestore Timestamp and String)
DateTime? _parseTimestamp(dynamic value) {
  if (value == null) return null;
  if (value is Timestamp) return value.toDate();
  if (value is String) {
    try {
      return DateTime.parse(value);
    } catch (_) {
      return null;
    }
  }
  if (value is DateTime) return value;
  return null;
}

/// Role types for team members
enum TeamMemberRole {
  owner,    // Full access to everything
  manager,  // All except billing/subscription
  staff     // Orders & inventory only
}

/// Permission keys for granular access control
class TeamPermissions {
  static const String viewDashboard = 'view_dashboard';
  static const String manageProducts = 'manage_products';
  static const String manageOrders = 'manage_orders';
  static const String manageInventory = 'manage_inventory';
  static const String manageCoupons = 'manage_coupons';
  static const String viewAnalytics = 'view_analytics';
  static const String manageSettings = 'manage_settings';
  static const String manageBilling = 'manage_billing';
  static const String manageTeam = 'manage_team';
  static const String manageCustomers = 'manage_customers';

  /// Get default permissions for a role
  static Set<String> getPermissionsForRole(TeamMemberRole role) {
    switch (role) {
      case TeamMemberRole.owner:
        return {
          viewDashboard,
          manageProducts,
          manageOrders,
          manageInventory,
          manageCoupons,
          viewAnalytics,
          manageSettings,
          manageBilling,
          manageTeam,
          manageCustomers,
        };
      case TeamMemberRole.manager:
        return {
          viewDashboard,
          manageProducts,
          manageOrders,
          manageInventory,
          manageCoupons,
          viewAnalytics,
          manageSettings,
          manageCustomers,
        };
      case TeamMemberRole.staff:
        return {
          viewDashboard,
          manageOrders,
          manageInventory,
        };
    }
  }
}

/// Model for team member in Professional plan stores
class TeamMemberModel {
  final String id;
  final String storeId;
  final String userId;         // Firebase Auth UID
  final String email;
  final String? name;
  final String? photoUrl;
  final TeamMemberRole role;
  final Set<String> permissions;
  
  // Invitation status
  final bool isInvited;        // true if pending invitation
  final DateTime? invitedAt;
  final DateTime? acceptedAt;
  
  // Activity tracking
  final DateTime? lastActiveAt;
  final DateTime createdAt;
  final String? invitedBy;     // User ID who sent invitation

  const TeamMemberModel({
    required this.id,
    required this.storeId,
    required this.userId,
    required this.email,
    this.name,
    this.photoUrl,
    required this.role,
    required this.permissions,
    this.isInvited = false,
    this.invitedAt,
    this.acceptedAt,
    this.lastActiveAt,
    required this.createdAt,
    this.invitedBy,
  });

  // ============================================================
  // FACTORY: From Firestore
  // ============================================================
  factory TeamMemberModel.fromMap(Map<String, dynamic> map, String id) {
    return TeamMemberModel(
      id: id,
      storeId: map['storeId'] ?? '',
      userId: map['userId'] ?? '',
      email: map['email'] ?? '',
      name: map['name'],
      photoUrl: map['photoUrl'],
      role: _parseRole(map['role']),
      permissions: Set<String>.from(map['permissions'] ?? []),
      isInvited: map['isInvited'] ?? false,
      invitedAt: _parseTimestamp(map['invitedAt']),
      acceptedAt: _parseTimestamp(map['acceptedAt']),
      lastActiveAt: _parseTimestamp(map['lastActiveAt']),
      createdAt: _parseTimestamp(map['createdAt']) ?? DateTime.now(),
      invitedBy: map['invitedBy'],
    );
  }

  // ============================================================
  // TO FIRESTORE
  // ============================================================
  Map<String, dynamic> toMap() {
    return {
      'storeId': storeId,
      'userId': userId,
      'email': email,
      'name': name,
      'photoUrl': photoUrl,
      'role': role.name,
      'permissions': permissions.toList(),
      'isInvited': isInvited,
      'invitedAt': invitedAt != null ? Timestamp.fromDate(invitedAt!) : null,
      'acceptedAt': acceptedAt != null ? Timestamp.fromDate(acceptedAt!) : null,
      'lastActiveAt': lastActiveAt != null ? Timestamp.fromDate(lastActiveAt!) : null,
      'createdAt': Timestamp.fromDate(createdAt),
      'invitedBy': invitedBy,
    };
  }

  // ============================================================
  // COMPUTED PROPERTIES
  // ============================================================
  
  /// Check if member is owner
  bool get isOwner => role == TeamMemberRole.owner;

  /// Check if invitation is pending
  bool get isPending => isInvited && acceptedAt == null;

  /// Display name (email fallback)
  String get displayName => name?.isNotEmpty == true ? name! : email;

  /// Role display name
  String get roleDisplayName {
    switch (role) {
      case TeamMemberRole.owner: return 'Owner';
      case TeamMemberRole.manager: return 'Manager';
      case TeamMemberRole.staff: return 'Staff';
    }
  }

  /// Check if member has specific permission
  bool hasPermission(String permission) => permissions.contains(permission);

  /// Check if member can manage products
  bool get canManageProducts => hasPermission(TeamPermissions.manageProducts);

  /// Check if member can manage orders
  bool get canManageOrders => hasPermission(TeamPermissions.manageOrders);

  /// Check if member can manage billing
  bool get canManageBilling => hasPermission(TeamPermissions.manageBilling);

  // ============================================================
  // HELPER: Parse Role
  // ============================================================
  
  static TeamMemberRole _parseRole(String? role) {
    switch (role?.toLowerCase()) {
      case 'owner': return TeamMemberRole.owner;
      case 'manager': return TeamMemberRole.manager;
      case 'staff': return TeamMemberRole.staff;
      default: return TeamMemberRole.staff;
    }
  }

  // ============================================================
  // COPY WITH
  // ============================================================
  
  TeamMemberModel copyWith({
    String? name,
    String? photoUrl,
    TeamMemberRole? role,
    Set<String>? permissions,
    bool? isInvited,
    DateTime? acceptedAt,
    DateTime? lastActiveAt,
  }) {
    return TeamMemberModel(
      id: id,
      storeId: storeId,
      userId: userId,
      email: email,
      name: name ?? this.name,
      photoUrl: photoUrl ?? this.photoUrl,
      role: role ?? this.role,
      permissions: permissions ?? this.permissions,
      isInvited: isInvited ?? this.isInvited,
      invitedAt: invitedAt,
      acceptedAt: acceptedAt ?? this.acceptedAt,
      lastActiveAt: lastActiveAt ?? this.lastActiveAt,
      createdAt: createdAt,
      invitedBy: invitedBy,
    );
  }

  // ============================================================
  // FACTORY: Create Invitation
  // ============================================================
  
  factory TeamMemberModel.createInvitation({
    required String storeId,
    required String email,
    required TeamMemberRole role,
    required String invitedBy,
  }) {
    final now = DateTime.now();
    return TeamMemberModel(
      id: 'team_${storeId}_${now.millisecondsSinceEpoch}',
      storeId: storeId,
      userId: '', // Set when invitation is accepted
      email: email,
      role: role,
      permissions: TeamPermissions.getPermissionsForRole(role),
      isInvited: true,
      invitedAt: now,
      createdAt: now,
      invitedBy: invitedBy,
    );
  }

  @override
  String toString() => 'TeamMemberModel(email: $email, role: ${role.name})';
}
