import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/role_gate.dart';
import '../../services/staff_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  static const _roles = [
    'admin',
    'manager',
    'editor',
    'support',
    'marketing',
    'staff',
  ];

  List<StaffMemberContract> _members = const [];
  bool _isLoading = true;
  String? _storeId;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??= (await context.read<StoreService>().getFirstStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _members = const [];
            _isLoading = false;
          });
        }
        return;
      }

      final members = await context.read<StaffService>().fetchStaff(_storeId!);
      if (mounted) {
        setState(() {
          _members = members;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _storeId == null ? null : _inviteStaff,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_alt_1_outlined),
        label: const Text('Invite staff'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              _roleSummary(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Users & Permissions',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Staff invites, roles, and access',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh staff',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _roleSummary() {
    final roleCounts = <String, int>{};
    for (final member in _members) {
      roleCounts[member.role] = (roleCounts[member.role] ?? 0) + 1;
    }

    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final role = _roles[index];
          return Chip(
            avatar: const Icon(Icons.verified_user_outlined, size: 18),
            label: Text('${_titleCase(role)} ${roleCounts[role] ?? 0}'),
            backgroundColor: colors.card,
            side: BorderSide(color: colors.cardBorder),
            labelStyle: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _roles.length,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load staff',
        _error!,
      );
    }
    if (_members.isEmpty) {
      return _centerState(
        Icons.manage_accounts_outlined,
        'No staff users',
        'Invite staff when you need shared store operations.',
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _members.length,
        itemBuilder: (context, index) => _memberCard(_members[index]),
      ),
    );
  }

  Widget _memberCard(StaffMemberContract member) {
    final labels = StaffRoleGate.labelsFor(member.role);
    final statusTone = member.isActive && member.status != 'removed'
        ? colors.success
        : colors.error;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                    .withValues(alpha: 0.12),
                child: Icon(
                  Icons.person_outline_rounded,
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      member.email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _statusChip(member.status, statusTone),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _accessChip(_titleCase(member.role), Icons.badge_outlined),
              for (final label in labels) _accessChip(label, Icons.lock_open),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton.icon(
                onPressed: () => _changeRole(member),
                icon: const Icon(Icons.admin_panel_settings_outlined, size: 18),
                label: const Text('Role'),
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
              const SizedBox(width: 8),
              TextButton.icon(
                onPressed: () => _remove(member),
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Remove'),
                style: TextButton.styleFrom(foregroundColor: colors.error),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String label, Color tone) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _titleCase(label),
        style: TextStyle(
          color: tone,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _accessChip(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textTertiary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _inviteStaff() async {
    final input = await showModalBottomSheet<StaffInviteInput>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) =>
          _InviteStaffForm(storeId: _storeId!, colors: colors, roles: _roles),
    );
    if (input == null) return;

    try {
      await context.read<StaffService>().inviteStaff(input);
      if (mounted) {
        _showSnackBar('Invite created for ${input.email}');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _changeRole(StaffMemberContract member) async {
    var selected = member.role;
    final role = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Change role',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                value: _roles.contains(selected) ? selected : 'staff',
                dropdownColor: colors.card,
                style: TextStyle(color: colors.textPrimary),
                items: [
                  for (final role in _roles)
                    DropdownMenuItem(
                      value: role,
                      child: Text(_titleCase(role)),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) setSheetState(() => selected = value);
                },
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => Navigator.pop(context, selected),
                icon: const Icon(Icons.save_outlined),
                label: const Text('Save role'),
              ),
            ],
          ),
        ),
      ),
    );
    if (role == null || role == member.role) return;

    try {
      await context.read<StaffService>().updateRole(member, role);
      if (mounted) {
        _showSnackBar('Role updated');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<void> _remove(StaffMemberContract member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          'Remove staff',
          style: TextStyle(color: colors.textPrimary),
        ),
        content: Text(
          member.email,
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: colors.error),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await context.read<StaffService>().removeStaff(member);
      if (mounted) {
        _showSnackBar('Staff removed');
        _load();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(IconData icon, String title, String subtitle) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 48),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _InviteStaffForm extends StatefulWidget {
  const _InviteStaffForm({
    required this.storeId,
    required this.colors,
    required this.roles,
  });

  final String storeId;
  final AppThemeColors colors;
  final List<String> roles;

  @override
  State<_InviteStaffForm> createState() => _InviteStaffFormState();
}

class _InviteStaffFormState extends State<_InviteStaffForm> {
  final _email = TextEditingController();
  String _role = 'staff';

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        18,
        18,
        18,
        MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Invite staff',
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            style: TextStyle(color: colors.textPrimary),
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: _role,
            dropdownColor: colors.card,
            style: TextStyle(color: colors.textPrimary),
            decoration: const InputDecoration(labelText: 'Role'),
            items: [
              for (final role in widget.roles)
                DropdownMenuItem(value: role, child: Text(_titleCase(role))),
            ],
            onChanged: (value) {
              if (value != null) setState(() => _role = value);
            },
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () {
              if (_email.text.trim().isEmpty) return;
              Navigator.pop(
                context,
                StaffInviteInput(
                  storeId: widget.storeId,
                  email: _email.text,
                  role: _role,
                ),
              );
            },
            icon: const Icon(Icons.send_outlined),
            label: const Text('Send invite'),
          ),
        ],
      ),
    );
  }
}

String _titleCase(String value) {
  if (value.isEmpty) return value;
  return value
      .split(RegExp(r'[\s_-]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}
