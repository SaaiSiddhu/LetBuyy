import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

import '../../app/store_context.dart';
import '../../app/routes.dart';
import '../../services/api_client.dart';
import '../../services/staff_service.dart';
import '../../widgets/shared/merchant_store_view.dart';

const _staffRoles = [
  'manager',
  'editor',
  'fulfillment',
  'viewer',
  'support',
  'marketing',
  'staff',
];

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  List<StaffMemberContract> _members = const [];
  Object? _viewKey;
  String? _storeId;
  String? _error;
  bool _loading = true;
  bool _busy = false;
  bool _commandRunning = false;
  int _generation = 0;
  MerchantStoreView? get _view =>
      _storeId == null ? null : (key: _viewKey, storeId: _storeId!);
  bool _current(MerchantStoreView? view) =>
      merchantStoreViewCurrent(context, view);
  bool get _canEdit => !_loading && !_busy && _error == null && _current(_view);

  @override
  void initState() {
    super.initState();
    _viewKey = context.read<StoreContext>().requestContextKey;
    _load();
  }

  Future<void> _load() async {
    if (!mounted || _busy) return;
    final generation = ++_generation;
    final stores = context.read<StoreContext>();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await stores.ensureSelectedStore();
      if (!mounted || generation != _generation) return;
      _viewKey = stores.requestContextKey;
      _storeId = stores.selectedStoreId;
      final view = _view;
      if (view == null) {
        setState(() {
          _members = const [];
          _error = 'Select a store to manage staff.';
          _loading = false;
        });
        return;
      }
      final rows = await context.read<StaffService>().fetchStaff(view.storeId);
      if (!_current(view) || generation != _generation) return;
      setState(() {
        _members = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted ||
          generation != _generation ||
          _viewKey != stores.requestContextKey)
        return;
      setState(() {
        _members = const [];
        _error = _staffError(error, loading: true);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final stores = context.watch<StoreContext>();
    if (_viewKey != stores.requestContextKey) {
      _viewKey = stores.requestContextKey;
      ++_generation;
      _storeId = null;
      _members = const [];
      _error = null;
      _loading = true;
      _busy = false;
      _commandRunning = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Users & Permissions'),
        actions: [
          IconButton(
            tooltip: 'Review staff invitation',
            onPressed: _busy
                ? null
                : () => Navigator.pushNamed(
                    context,
                    AppRoutes.acceptStaffInvitation,
                  ),
            icon: const Icon(Icons.mail_outline),
          ),
          IconButton(
            tooltip: 'Refresh staff',
            onPressed: _busy || _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stores.selectedStore?.name ?? 'Staff access',
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space8),
                  Text(
                    'Manage invitations and access for this store.',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            if (_commandRunning)
              const LinearProgressIndicator(semanticsLabel: 'Updating staff'),
            if (_loading)
              const LinearProgressIndicator(semanticsLabel: 'Loading staff'),
            Expanded(child: _body()),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        minimum: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        child: FilledButton.icon(
          onPressed: _canEdit ? _inviteStaff : null,
          icon: const Icon(Icons.person_add_alt_1_outlined),
          label: const Text('Add staff'),
        ),
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return ErrorView(
        title: 'Could not load staff',
        message: _error!,
        onRetry: _load,
      );
    }
    if (_loading && _members.isEmpty) {
      return const Center(child: Text('Loading staff…'));
    }
    if (_members.isEmpty) {
      return const EmptyState(
        title: 'No staff users',
        message: 'Invite staff when you need shared store operations.',
        icon: Icons.manage_accounts_outlined,
      );
    }
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        itemCount: _members.length + 1,
        separatorBuilder: (_, __) =>
            const SizedBox(height: LetbuyySpacingTokens.space12),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Text(
              '${_members.length} loaded staff records',
              style: theme.textTheme.bodySmall,
            );
          }
          return _memberCard(_members[index - 1]);
        },
      ),
    );
  }

  Widget _memberCard(StaffMemberContract member) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(member.displayName, style: theme.textTheme.titleMedium),
            const SizedBox(height: LetbuyySpacingTokens.space8),
            SelectableText(member.email, style: theme.textTheme.bodyMedium),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Wrap(
              spacing: LetbuyySpacingTokens.space8,
              runSpacing: LetbuyySpacingTokens.space8,
              children: [
                Chip(
                  avatar: const Icon(Icons.badge_outlined),
                  label: Text(_titleCase(member.role)),
                ),
                Chip(
                  avatar: const Icon(Icons.info_outline),
                  label: Text(_titleCase(member.status)),
                ),
                if (!member.isActive)
                  const Chip(label: Text('Access inactive')),
                for (final permission in member.granted)
                  Chip(label: Text(staffPermissionLabel(permission))),
              ],
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Wrap(
              spacing: LetbuyySpacingTokens.space8,
              runSpacing: LetbuyySpacingTokens.space8,
              children: [
                if (member.status == 'invited')
                  TextButton(
                    onPressed: _canEdit ? () => _renewInvitation(member) : null,
                    child: const Text('Renew invitation'),
                  ),
                OutlinedButton.icon(
                  onPressed: _canEdit && member.status == 'active'
                      ? () => _changeRole(member)
                      : null,
                  icon: const Icon(Icons.admin_panel_settings_outlined),
                  label: const Text('Role'),
                ),
                TextButton.icon(
                  onPressed: _canEdit ? () => _remove(member) : null,
                  icon: const Icon(Icons.person_remove_outlined),
                  label: const Text('Remove'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _inviteStaff() async {
    final view = _view;
    if (!_canEdit || view == null) return;
    final service = context.read<StaffService>();
    setState(() => _busy = true);
    try {
      final result = await showLetbuyyFormSheet<StaffInvitationResult>(
        context: context,
        builder: (_) => guardMerchantStoreView(
          view,
          _StaffEditor<StaffInvitationResult>(
            title: 'Add staff',
            actionLabel: 'Send staff invitation',
            showEmail: true,
            initialEmail: '',
            initialRole: 'staff',
            submit: (email, role) => service.inviteStaff(
              StaffInviteInput(storeId: view.storeId, email: email, role: role),
            ),
          ),
        ),
      );
      if (!_current(view) || result == null) return;
      await _showInvitation(result, view);
    } finally {
      if (_current(view)) {
        setState(() => _busy = false);
        await _load();
      }
    }
  }

  Future<void> _showInvitation(
    StaffInvitationResult result,
    MerchantStoreView view,
  ) async {
    if (!_current(view)) return;
    await showDialog<void>(
      context: context,
      builder: (dialog) => guardMerchantStoreView(
        view,
        AlertDialog(
          title: const Text('Staff invitation created'),
          content: SingleChildScrollView(
            child: Text(
              'Acceptance is required before access starts. This does not confirm email delivery. '
              '${result.expiresAt.isEmpty ? 'Expiry unavailable.' : 'Expires: ${result.expiresAt}'}',
            ),
          ),
          actions: [
            if (result.url.isNotEmpty)
              TextButton(
                onPressed: () async {
                  if (!_current(view)) return;
                  await Clipboard.setData(ClipboardData(text: result.url));
                  if (dialog.mounted && _current(view)) Navigator.pop(dialog);
                },
                child: const Text('Copy invitation link'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(dialog),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _renewInvitation(StaffMemberContract member) async {
    final view = _view;
    if (!_canEdit || view == null || member.storeId != view.storeId) return;
    final service = context.read<StaffService>();
    setState(() {
      _busy = true;
      _commandRunning = true;
    });
    try {
      final result = await service.inviteStaff(
        StaffInviteInput(
          storeId: member.storeId,
          email: member.email,
          role: member.role,
        ),
        renew: member,
      );
      if (_current(view)) {
        setState(() => _commandRunning = false);
        await _showInvitation(result, view);
      }
    } catch (error) {
      if (_current(view)) setState(() => _error = _staffError(error));
    } finally {
      if (_current(view)) {
        setState(() {
          _busy = false;
          _commandRunning = false;
        });
        // Keep actionable failure visible; refresh is explicit.
        if (_error == null) await _load();
      }
    }
  }

  Future<void> _changeRole(StaffMemberContract member) async {
    final view = _view;
    if (!_canEdit || view == null || member.storeId != view.storeId) return;
    final service = context.read<StaffService>();
    setState(() => _busy = true);
    try {
      final result = await showLetbuyyFormSheet<StaffMemberContract>(
        context: context,
        builder: (_) => guardMerchantStoreView(
          view,
          _StaffEditor<StaffMemberContract>(
            title: 'Change role',
            actionLabel: 'Save role',
            showEmail: false,
            initialEmail: member.email,
            initialRole: member.role,
            submit: (_, role) => service.updateRole(member, role),
          ),
        ),
      );
      if (_current(view) && result != null) {
        showLetbuyyOperationFeedback(context, message: 'Role updated');
      }
    } finally {
      if (_current(view)) {
        setState(() => _busy = false);
        await _load();
      }
    }
  }

  Future<void> _remove(StaffMemberContract member) async {
    final view = _view;
    if (!_canEdit || view == null || member.storeId != view.storeId) return;
    final service = context.read<StaffService>();
    // Guard the confirmation itself as well as the final action.
    setState(() => _busy = true);
    try {
      final confirmed = await showLetbuyyConfirmation(
        context: context,
        title: 'Remove staff',
        message: 'Remove access for ${member.email}?',
        confirmLabel: 'Remove',
        destructive: true,
        guard: (_, child) => guardMerchantStoreView(view, child),
      );
      if (confirmed != true || !_current(view)) return;
      setState(() => _commandRunning = true);
      await service.removeStaff(member);
      if (_current(view))
        showLetbuyyOperationFeedback(context, message: 'Staff removed');
    } catch (error) {
      if (_current(view)) setState(() => _error = _staffError(error));
    } finally {
      if (_current(view)) {
        setState(() {
          _busy = false;
          _commandRunning = false;
        });
        if (_error == null) await _load();
      }
    }
  }
}

/// One form body for invitation and role editing. Draft and operation identity
/// remain in their existing owners; an uncertain response keeps the exact input.
class _StaffEditor<T> extends StatefulWidget {
  const _StaffEditor({
    required this.title,
    required this.actionLabel,
    required this.showEmail,
    required this.initialEmail,
    required this.initialRole,
    required this.submit,
  });
  final String title, actionLabel, initialEmail, initialRole;
  final bool showEmail;
  final Future<T> Function(String email, String role) submit;
  @override
  State<_StaffEditor<T>> createState() => _StaffEditorState<T>();
}

class _StaffEditorState<T> extends State<_StaffEditor<T>> {
  final _form = GlobalKey<FormState>();
  late final _email = TextEditingController(text: widget.initialEmail);
  late String _role = widget.initialRole;
  bool _saving = false, _uncertain = false;
  String? _error;
  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || !_form.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await widget.submit(_email.text, _role);
      if (mounted) Navigator.pop(context, result);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _uncertain =
            error is! ApiException ||
            error.statusCode == 0 ||
            error.statusCode >= 500;
        _error = _staffError(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) => LetbuyyFormSheet(
    title: widget.title,
    description: widget.showEmail
        ? 'Access starts only after the invited person accepts.'
        : widget.initialEmail,
    canDismiss: !_saving,
    actions: [
      TextButton(
        onPressed: _saving ? null : () => Navigator.maybePop(context),
        child: const Text('Cancel'),
      ),
      FilledButton.icon(
        onPressed: _saving || (!widget.showEmail && _role == widget.initialRole)
            ? null
            : _save,
        icon: _saving
            ? SizedBox.square(
                dimension: LetbuyySpacingTokens.space20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Theme.of(context).colorScheme.onPrimary,
                ),
              )
            : const Icon(Icons.check),
        label: Text(
          _saving
              ? 'Saving…'
              : _uncertain
              ? 'Retry same request'
              : widget.actionLabel,
        ),
      ),
    ],
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.showEmail) ...[
            CustomTextField(
              controller: _email,
              label: 'Email',
              enabled: !_saving && !_uncertain,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              autovalidateMode: AutovalidateMode.onUserInteraction,
              autocorrect: false,
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Enter an email address.'
                  : null,
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
          ],
          LetbuyyChoiceField<String>(
            value: _staffRoles.contains(_role) ? _role : null,
            label: 'Role',
            choices: [
              for (final role in _staffRoles)
                LetbuyyChoice(value: role, label: _titleCase(role)),
            ],
            onChanged: _saving || _uncertain
                ? null
                : (value) {
                    setState(() => _role = value);
                  },
            validator: (value) =>
                value == null ? 'Choose a supported role.' : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: LetbuyySpacingTokens.space16),
            Semantics(liveRegion: true, child: Text(_error!)),
            if (_uncertain)
              const Text(
                'These details are kept unchanged. Retry to reconcile the same request, '
                'or close and refresh staff before starting another action.',
              ),
          ],
        ],
      ),
    ),
  );
}

String _staffError(Object error, {bool loading = false}) {
  if (error is ApiException) {
    if (error.statusCode == 401)
      return 'Your session expired. Sign in again to continue.';
    if (error.statusCode == 403)
      return 'Staff management is unavailable with your current store permissions.';
    if (error.statusCode == 409)
      return 'Staff access or this record changed. Close this form and refresh staff before continuing.';
    if (error.statusCode == 400 || error.statusCode == 422)
      return 'The request was rejected. Check the email and role, then try again.';
  }
  return loading
      ? 'Staff could not be loaded. Check your connection and current store permissions, then retry.'
      : 'The result could not be confirmed. Check your connection and refresh staff, or retry the same request.';
}

String _titleCase(String value) => value
    .split(RegExp(r'[\s_-]+'))
    .where((part) => part.isNotEmpty)
    .map((part) => part[0].toUpperCase() + part.substring(1))
    .join(' ');
