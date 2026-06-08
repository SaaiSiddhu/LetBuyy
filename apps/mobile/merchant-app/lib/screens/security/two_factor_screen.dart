import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/two_factor_service.dart';
import '../../theme/app_theme_colors.dart';

class TwoFactorScreen extends StatefulWidget {
  const TwoFactorScreen({super.key});

  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<TwoFactorService>().fetchOverview();
    } catch (_) {
      _error = 'Security settings are temporarily unavailable.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _startEnrollment() async {
    try {
      final result = await context.read<TwoFactorService>().enrollTotp();
      if (!mounted) return;
      await _showVerifySheet(result);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Two-factor setup is unavailable right now.'),
        ),
      );
    }
  }

  Future<void> _showVerifySheet(Map<String, dynamic> enrollment) async {
    final factor = enrollment['factor'];
    if (factor is! Map || factor['id'] == null) return;
    final factorId = factor['id'].toString();
    final secret = enrollment['secret']?.toString() ?? '';
    final uri = enrollment['otpauth_uri']?.toString() ?? '';
    final controller = TextEditingController();
    var submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) {
          Future<void> verify() async {
            if (submitting) return;
            setSheetState(() => submitting = true);
            try {
              final result = await context.read<TwoFactorService>().verifyTotp(
                factorId: factorId,
                code: controller.text.trim(),
              );
              if (!mounted) return;
              Navigator.pop(sheetContext);
              await _showRecoveryCodes(result['recovery_codes']);
            } catch (_) {
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Verification code is invalid.')),
              );
            } finally {
              if (mounted) setSheetState(() => submitting = false);
            }
          }

          return SafeArea(
            child: Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Set up authenticator',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 12),
                  SelectableText(secret),
                  const SizedBox(height: 8),
                  Text(
                    uri.isEmpty
                        ? 'Add this key in your authenticator app.'
                        : 'Use this setup URI in your authenticator app.',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: '6-digit code',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: submitting ? null : verify,
                      icon: const Icon(Icons.verified_user_outlined),
                      label: const Text('Verify and enable'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _showRecoveryCodes(Object? rawCodes) async {
    final codes = rawCodes is List
        ? rawCodes.map((value) => value.toString()).toList(growable: false)
        : const <String>[];
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Recovery codes'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Store these codes somewhere safe.'),
            const SizedBox(height: 12),
            ...codes.map((code) => SelectableText(code)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Future<void> _disable(Map<String, dynamic> factor) async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Turn off two-factor'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: '6-digit code',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Disable'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await context.read<TwoFactorService>().disable(
        factorId: factor['id'].toString(),
        code: controller.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Two-factor authentication disabled.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not disable two-factor.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: const Text('Two-factor authentication'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_outlined),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _EmptyState(message: _error!, actionLabel: 'Retry', onTap: _load)
          : Consumer<TwoFactorService>(
              builder: (context, security, _) {
                final factors = security.factors;
                final sessions = security.sessions;
                return RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _StatusPanel(enabled: security.isEnabled),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: security.isEnabled ? null : _startEnrollment,
                        icon: const Icon(Icons.add_moderator_outlined),
                        label: const Text('Set up authenticator app'),
                      ),
                      const SizedBox(height: 20),
                      const _SectionTitle('Factors'),
                      if (factors.isEmpty)
                        const _EmptyState(
                          message: 'No factors enrolled yet.',
                          detail:
                              'Add an authenticator app to protect sign-in.',
                        )
                      else
                        ...factors.map(
                          (factor) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.security_outlined),
                            title: Text(factor['label']?.toString() ?? 'TOTP'),
                            subtitle: Text(factor['status']?.toString() ?? ''),
                            trailing: factor['status'] == 'active'
                                ? TextButton(
                                    onPressed: () => _disable(factor),
                                    child: const Text('Disable'),
                                  )
                                : null,
                          ),
                        ),
                      const SizedBox(height: 20),
                      const _SectionTitle('Active sessions'),
                      if (sessions.isEmpty)
                        const _EmptyState(message: 'No active sessions found.')
                      else
                        ...sessions.map(
                          (session) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.devices_outlined),
                            title: Text(
                              session['device_id']?.toString() ??
                                  'Current device',
                            ),
                            subtitle: Text(
                              'Last active ${session['last_active'] ?? 'recently'}',
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.enabled});

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.glassLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.verified_user_outlined : Icons.shield_outlined,
            color: enabled ? const Color(0xFF047857) : colors.textSecondary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              enabled
                  ? 'Two-factor authentication is enabled.'
                  : 'Add an authenticator app for stronger account protection.',
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.message,
    this.detail,
    this.actionLabel,
    this.onTap,
  });

  final String message;
  final String? detail;
  final String? actionLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        children: [
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (detail != null) ...[
            const SizedBox(height: 6),
            Text(
              detail!,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
          if (actionLabel != null && onTap != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onTap, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
