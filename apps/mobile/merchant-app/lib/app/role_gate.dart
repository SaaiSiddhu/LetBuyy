enum MerchantStaffRole {
  owner,
  admin,
  manager,
  editor,
  support,
  marketing,
  staff,
}

class StaffRoleGate {
  const StaffRoleGate._();

  static MerchantStaffRole parse(String role) {
    return switch (role.trim().toLowerCase()) {
      'owner' => MerchantStaffRole.owner,
      'admin' => MerchantStaffRole.admin,
      'manager' => MerchantStaffRole.manager,
      'editor' => MerchantStaffRole.editor,
      'support' => MerchantStaffRole.support,
      'marketing' => MerchantStaffRole.marketing,
      _ => MerchantStaffRole.staff,
    };
  }

  static bool canManageStaff(String role) {
    return switch (parse(role)) {
      MerchantStaffRole.owner ||
      MerchantStaffRole.admin ||
      MerchantStaffRole.manager => true,
      _ => false,
    };
  }

  static bool canManageCatalog(String role) {
    return switch (parse(role)) {
      MerchantStaffRole.owner ||
      MerchantStaffRole.admin ||
      MerchantStaffRole.manager ||
      MerchantStaffRole.editor => true,
      _ => false,
    };
  }

  static bool canManageOrders(String role) {
    return switch (parse(role)) {
      MerchantStaffRole.owner ||
      MerchantStaffRole.admin ||
      MerchantStaffRole.manager ||
      MerchantStaffRole.support => true,
      _ => false,
    };
  }

  static bool canReadAnalytics(String role) {
    return switch (parse(role)) {
      MerchantStaffRole.owner ||
      MerchantStaffRole.admin ||
      MerchantStaffRole.manager ||
      MerchantStaffRole.marketing => true,
      _ => false,
    };
  }

  static List<String> labelsFor(String role) {
    final labels = <String>[];
    if (canManageStaff(role)) labels.add('Staff');
    if (canManageCatalog(role)) labels.add('Catalog');
    if (canManageOrders(role)) labels.add('Orders');
    if (canReadAnalytics(role)) labels.add('Analytics');
    return labels.isEmpty ? const ['Limited'] : labels;
  }
}
