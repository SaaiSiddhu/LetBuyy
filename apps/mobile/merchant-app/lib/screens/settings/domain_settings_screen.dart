import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/store_model.dart';
import '../../services/custom_domains.dart';
import '../../services/skip_needs_backend_exception.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart';

class DomainSettingsScreen extends StatefulWidget {
  const DomainSettingsScreen({super.key});

  @override
  State<DomainSettingsScreen> createState() => _DomainSettingsScreenState();
}

class _DomainSettingsScreenState extends State<DomainSettingsScreen> {
  final _customDomainController = TextEditingController();

  StoreModel? _store;
  DomainSettingsSnapshot? _snapshot;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isChecking = false;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  @override
  void dispose() {
    _customDomainController.dispose();
    super.dispose();
  }

  Future<void> _loadStore() async {
    setState(() => _isLoading = true);
    try {
      final domainService = context.read<DomainService>();
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (!mounted) return;
      setState(() {
        _store = store;
        _snapshot = store == null
            ? null
            : domainService.snapshotForStore(store);
        _customDomainController.text = store?.customDomain ?? '';
      });
    } catch (error) {
      _showSnackBar('Could not load domain settings: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveDomain() async {
    final store = _store;
    if (store == null) return;
    final normalized = DomainService.normalizeDomain(
      _customDomainController.text,
    );
    if (normalized == null) {
      _showSnackBar('Enter a domain or clear the current one.');
      return;
    }
    await _persistDomain(store, normalized);
  }

  Future<void> _clearDomain() async {
    final store = _store;
    if (store == null) return;
    await _persistDomain(store, null);
  }

  Future<void> _persistDomain(StoreModel store, String? domain) async {
    setState(() => _isSaving = true);
    try {
      final domainService = context.read<DomainService>();
      final updated = await domainService.saveCustomDomain(store, domain);
      if (!mounted) return;
      setState(() {
        _store = updated;
        _snapshot = domainService.snapshotForStore(updated);
        _customDomainController.text = updated.customDomain ?? '';
      });
      _showSnackBar(
        domain == null
            ? 'Custom domain cleared.'
            : 'Custom domain saved. Add the DNS record, then verify.',
      );
    } catch (error) {
      _showSnackBar('Could not save domain: $error');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _checkAvailability() async {
    setState(() => _isChecking = true);
    try {
      final result = await context.read<DomainService>().checkAvailability(
        _customDomainController.text,
      );
      _showSnackBar(result.message);
    } on SkipNeedsBackendException catch (error) {
      _showSnackBar(error.toString());
    } catch (error) {
      _showSnackBar('Could not check domain: $error');
    } finally {
      if (mounted) setState(() => _isChecking = false);
    }
  }

  Future<void> _verifyDomain() async {
    final store = _store;
    if (store == null) return;
    try {
      final updated = await context.read<DomainService>().verifyDomain(store);
      if (!mounted) return;
      setState(() {
        _store = updated;
        _snapshot = context.read<DomainService>().snapshotForStore(updated);
      });
    } on SkipNeedsBackendException catch (error) {
      _showSnackBar(error.toString());
    } catch (error) {
      _showSnackBar('Could not verify domain: $error');
    }
  }

  Future<void> _refreshSslStatus() async {
    final store = _store;
    if (store == null) return;
    try {
      final updated = await context.read<DomainService>().refreshSslStatus(
        store,
      );
      if (!mounted) return;
      setState(() {
        _store = updated;
        _snapshot = context.read<DomainService>().snapshotForStore(updated);
      });
    } on SkipNeedsBackendException catch (error) {
      _showSnackBar(error.toString());
    } catch (error) {
      _showSnackBar('Could not refresh SSL status: $error');
    }
  }

  Future<void> _copy(String label, String value) async {
    await Clipboard.setData(ClipboardData(text: value));
    _showSnackBar('$label copied.');
  }

  Future<void> _shareDnsRecords() async {
    final snapshot = _snapshot;
    if (snapshot == null || snapshot.records.isEmpty) return;
    final domain = snapshot.customDomain ?? snapshot.defaultDomain;
    final lines = [
      'LetBuyy DNS records for $domain',
      '',
      ...snapshot.records.map(
        (record) => '${record.type} ${record.host} -> ${record.value}',
      ),
    ];
    await Share.share(lines.join('\n'), subject: 'LetBuyy DNS records');
  }

  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final snapshot = _snapshot;

    return Scaffold(
      backgroundColor: colors.bgStart,
      appBar: AppBar(
        title: const Text('Domain settings'),
        backgroundColor: colors.bgStart,
        surfaceTintColor: colors.bgStart,
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(
                color: LetbuyyColorTokens.brandPrimary,
              ),
            )
          : snapshot == null
          ? _buildEmptyStore(colors)
          : RefreshIndicator(
              color: LetbuyyColorTokens.brandPrimary,
              onRefresh: _loadStore,
              child: ListView(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
                children: [
                  _buildHeader(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildDefaultDomain(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildCustomDomain(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildDnsRecords(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space48),
                ],
              ),
            ),
    );
  }

  Widget _buildHeader(AppThemeColors colors, DomainSettingsSnapshot snapshot) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Domains',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          'Connect a branded domain to this store and keep the default LetBuyy domain active as a fallback.',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space16),
        Row(
          children: [
            _statusPill(colors, snapshot.statusLabel, snapshot.hasCustomDomain),
            const SizedBox(width: LetbuyySpacingTokens.space8),
            _statusPill(colors, snapshot.sslLabel, snapshot.sslActive),
          ],
        ),
      ],
    );
  }

  Widget _buildDefaultDomain(
    AppThemeColors colors,
    DomainSettingsSnapshot snapshot,
  ) {
    return _section(
      colors,
      title: 'Default domain',
      description: 'Always active for storefront preview and fallback access.',
      child: _panel(
        colors,
        child: Row(
          children: [
            _iconTile(Icons.link_rounded, colors.accentBlue),
            const SizedBox(width: LetbuyySpacingTokens.space16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    snapshot.defaultDomain,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space4),
                  Text(
                    'https://${snapshot.defaultDomain}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Copy default domain',
              onPressed: () =>
                  _copy('Default domain', 'https://${snapshot.defaultDomain}'),
              icon: const Icon(Icons.copy_rounded),
              color: colors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomDomain(
    AppThemeColors colors,
    DomainSettingsSnapshot snapshot,
  ) {
    return _section(
      colors,
      title: 'Custom domain',
      description:
          'Save the hostname first. Verification and SSL polling need the domain lifecycle gateway route.',
      child: _panel(
        colors,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _customDomainController,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.done,
              decoration: _inputDecoration(colors, 'www.yourstore.com'),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Wrap(
              spacing: LetbuyySpacingTokens.space8,
              runSpacing: LetbuyySpacingTokens.space8,
              children: [
                _primaryAction(
                  label: _isSaving ? 'Saving...' : 'Save domain',
                  icon: Icons.save_rounded,
                  enabled: !_isSaving,
                  onPressed: _saveDomain,
                ),
                _secondaryAction(
                  colors,
                  label: _isChecking ? 'Checking...' : 'Check',
                  icon: Icons.search_rounded,
                  enabled: !_isChecking,
                  onPressed: _checkAvailability,
                ),
                _secondaryAction(
                  colors,
                  label: 'Verify',
                  icon: Icons.verified_rounded,
                  enabled: snapshot.hasCustomDomain,
                  onPressed: _verifyDomain,
                ),
                _secondaryAction(
                  colors,
                  label: 'Refresh SSL',
                  icon: Icons.lock_rounded,
                  enabled: snapshot.hasCustomDomain,
                  onPressed: _refreshSslStatus,
                ),
                if (snapshot.hasCustomDomain)
                  _secondaryAction(
                    colors,
                    label: 'Clear',
                    icon: Icons.close_rounded,
                    enabled: !_isSaving,
                    onPressed: _clearDomain,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDnsRecords(
    AppThemeColors colors,
    DomainSettingsSnapshot snapshot,
  ) {
    return _section(
      colors,
      title: 'DNS records',
      description:
          'Add these records at your DNS provider. Copy a value or share the full record set with the domain owner.',
      child: _panel(
        colors,
        child: snapshot.records.isEmpty
            ? _buildNoRecords(colors)
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ...snapshot.records.map(
                    (record) => _dnsRecordRow(colors, record),
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space12),
                  OutlinedButton.icon(
                    onPressed: _shareDnsRecords,
                    icon: const Icon(Icons.forward_to_inbox_rounded),
                    label: const Text('Email DNS records'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: LetbuyyColorTokens.brandPrimary,
                      side: BorderSide(color: colors.border),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildNoRecords(AppThemeColors colors) {
    return Column(
      children: [
        Icon(Icons.dns_outlined, color: colors.textTertiary, size: 36),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          'Save a custom domain to generate CNAME guidance.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _dnsRecordRow(AppThemeColors colors, DomainDnsRecord record) {
    return Container(
      margin: const EdgeInsets.only(bottom: LetbuyySpacingTokens.space12),
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _recordBadge(record.type),
              const SizedBox(width: LetbuyySpacingTokens.space8),
              Expanded(
                child: Text(
                  record.status,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
              ),
              IconButton(
                tooltip: 'Copy DNS value',
                onPressed: () => _copy('DNS value', record.value),
                icon: const Icon(Icons.copy_rounded),
                color: colors.textSecondary,
              ),
            ],
          ),
          const SizedBox(height: LetbuyySpacingTokens.space8),
          _dnsLine(colors, 'Host', record.host),
          _dnsLine(colors, 'Value', record.value),
        ],
      ),
    );
  }

  Widget _dnsLine(AppThemeColors colors, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: LetbuyySpacingTokens.space4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 56,
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: colors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: SelectableText(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colors.textPrimary,
                fontFamily: 'monospace',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(
    AppThemeColors colors, {
    required String title,
    required String description,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space4),
        Text(
          description,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: LetbuyySpacingTokens.space12),
        child,
      ],
    );
  }

  Widget _panel(AppThemeColors colors, {required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: colors.textPrimary.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _iconTile(IconData icon, Color accent) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icon, color: accent),
    );
  }

  Widget _statusPill(AppThemeColors colors, String label, bool active) {
    final accent = active ? colors.success : colors.warning;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: LetbuyySpacingTokens.space12,
        vertical: LetbuyySpacingTokens.space6,
      ),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: accent,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _recordBadge(String type) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: LetbuyySpacingTokens.space8,
        vertical: LetbuyySpacingTokens.space4,
      ),
      decoration: BoxDecoration(
        color: LetbuyyColorTokens.brandPrimary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        type,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: LetbuyyColorTokens.brandPrimary,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(AppThemeColors colors, String hint) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: const Icon(Icons.language_rounded),
      filled: true,
      fillColor: colors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: LetbuyyColorTokens.brandPrimary),
      ),
    );
  }

  Widget _primaryAction({
    required String label,
    required IconData icon,
    required bool enabled,
    required VoidCallback onPressed,
  }) {
    return ElevatedButton.icon(
      onPressed: enabled ? onPressed : null,
      icon: Icon(icon),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: LetbuyyColorTokens.brandPrimary,
        foregroundColor: LetbuyyColorTokens.white,
        disabledBackgroundColor: LetbuyyColorTokens.slate300,
        disabledForegroundColor: LetbuyyColorTokens.slate600,
      ),
    );
  }

  Widget _secondaryAction(
    AppThemeColors colors, {
    required String label,
    required IconData icon,
    required bool enabled,
    required VoidCallback onPressed,
  }) {
    return OutlinedButton.icon(
      onPressed: enabled ? onPressed : null,
      icon: Icon(icon),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: colors.textPrimary,
        disabledForegroundColor: colors.textTertiary,
        side: BorderSide(color: colors.border),
      ),
    );
  }

  Widget _buildEmptyStore(AppThemeColors colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space24),
        child: _panel(
          colors,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.store_mall_directory_rounded, color: colors.warning),
              const SizedBox(height: LetbuyySpacingTokens.space12),
              Text(
                'Create a store before connecting domains.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
