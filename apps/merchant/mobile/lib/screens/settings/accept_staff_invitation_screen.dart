import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../app/store_context.dart';
import '../../services/staff_service.dart';
import '../../services/store_auth_service.dart';

/// Explicit consent using the normal Identity session and canonical Gateway.
/// The retained invitation proof grants no access until the server accepts it.
class AcceptStaffInvitationScreen extends StatefulWidget {
  const AcceptStaffInvitationScreen({super.key});
  @override
  State<AcceptStaffInvitationScreen> createState() =>
      _AcceptStaffInvitationScreenState();
}

class _AcceptStaffInvitationScreenState
    extends State<AcceptStaffInvitationScreen> {
  final _link = TextEditingController();
  Map<String, dynamic>? _preview;
  String? _error;
  bool _busy = false;
  int _generation = 0;
  StreamSubscription<AuthState>? _authSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _authSub = context.read<StoreAuthService>().authStateChanges.listen(
        (_) => _load(),
      );
      _load();
    });
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _link.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    final staff = context.read<StaffService>(),
        auth = context.read<StoreAuthService>();
    setState(() {
      _preview = null;
      _error = null;
      _busy = staff.pendingInvitation != null && auth.isSignedIn;
    });
    if (staff.pendingInvitation == null || !auth.isSignedIn) return;
    try {
      final preview = await staff.previewInvitation();
      if (mounted && generation == _generation)
        setState(() => _preview = preview);
    } catch (_) {
      if (mounted && generation == _generation)
        setState(
          () => _error = 'This invitation is unavailable for this account, expired, revoked or changed.',
        );
    } finally {
      if (mounted && generation == _generation) setState(() => _busy = false);
    }
  }

  Future<void> _remember() async {
    try {
      await context.read<StaffService>().rememberInvitation(_link.text);
      _link.clear();
      if (mounted) await _load();
    } on FormatException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted)
        setState(
          () => _error = 'Unable to save the invitation. Retry this action.',
        );
    }
  }

  Future<void> _accept() async {
    final preview = _preview;
    if (preview == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final staff = context.read<StaffService>(),
          stores = context.read<StoreContext>();
      await staff.acceptInvitation(preview['id'] as String);
      // Refresh the live store list with no unrelated selected-store header.
      await stores.clearSelection();
      final visible = await stores.loadStores(force: true);
      final id = preview['store_id'];
      if (!visible.any((store) => store.id == id))
        throw StateError('Store readback unavailable');
      await stores.selectStoreById(id as String);
      await staff.clearInvitation();
      if (mounted)
        Navigator.pushNamedAndRemoveUntil(
          context,
          AppRoutes.auth,
          (_) => false,
        );
    } catch (_) {
      if (mounted)
        setState(() {
          _busy = false;
          _error = 'Acceptance or store readback did not finish. Retry; a committed acceptance is safe to repeat.';
        });
    }
  }

  Future<void> _switchAccount() async {
    setState(() {
      _busy = true;
      _preview = null;
    });
    await context.read<StoreAuthService>().signOut();
    if (mounted) Navigator.pushNamed(context, AppRoutes.login);
  }

  Future<void> _cancel() async {
    await context.read<StaffService>().clearInvitation();
    if (mounted)
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.auth, (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<StoreAuthService>();
    final staff = context.watch<StaffService>();
    final preview = _preview;
    final permissions = preview?['permissions'];
    final grants =
        (permissions is Map ? permissions['granted'] as List? : null) ??
        const [];
    return Scaffold(
      appBar: AppBar(title: const Text('Staff invitation')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (staff.pendingInvitation == null) ...[
              const Text(
                'Paste the complete invitation link from your store owner.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _link,
                obscureText: true,
                autocorrect: false,
                enableSuggestions: false,
                decoration: const InputDecoration(labelText: 'Invitation link'),
              ),
              FilledButton(
                onPressed: _busy ? null : _remember,
                child: const Text('Review invitation'),
              ),
            ] else ...[
              if (!auth.isSignedIn) ...[
                const Text(
                  'Sign in or create and verify the invited account to review access.',
                ),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => Navigator.pushNamed(context, AppRoutes.login),
                  child: const Text('Sign in to review invitation'),
                ),
              ] else ...[
                Text('Signed in as ${auth.currentUser?.email ?? ''}'),
                TextButton(
                  onPressed: _busy ? null : _switchAccount,
                  child: const Text('Use a different account'),
                ),
                if (preview != null) ...[
                  Text(
                    preview['store_name'] as String? ?? 'Store team',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text('Role: ${preview['role']}'),
                  const Text('Requested access:'),
                  for (final grant in grants.whereType<String>())
                    Text(staffPermissionLabel(grant)),
                  const SizedBox(height: 16),
                  const Text(
                    'Access starts after you accept with the invited verified account.',
                  ),
                  FilledButton(
                    onPressed: _busy ? null : _accept,
                    child: Text(
                      preview['status'] == 'accepted'
                          ? 'Continue to store'
                          : 'Accept staff invitation',
                    ),
                  ),
                ],
                TextButton(
                  onPressed: _busy ? null : _load,
                  child: const Text('Reload invitation'),
                ),
              ],
              TextButton(
                onPressed: _busy ? null : _cancel,
                child: const Text('Discard invitation'),
              ),
            ],
            if (_busy) const Center(child: CircularProgressIndicator()),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(_error!),
              ),
          ],
        ),
      ),
    );
  }
}
