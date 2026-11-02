import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:share_plus/share_plus.dart';

import '../../models/store_model.dart';
import '../../services/custom_domains.dart';
import '../../theme/app_theme_colors.dart';
import 'connected_domains_section.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class DomainSettingsScreen extends StatefulWidget {
  const DomainSettingsScreen({super.key});

  @override
  State<DomainSettingsScreen> createState() => _DomainSettingsScreenState();
}

class _DomainSettingsScreenState extends State<DomainSettingsScreen> {
  final _customDomainController = TextEditingController();
  final _domainOwnerNameController = TextEditingController();
  final _domainOwnerEmailController = TextEditingController();
  final _accessMessageController = TextEditingController();
  final _passwordController = TextEditingController();

  StoreModel? _store;
  DomainSettingsSnapshot? _snapshot;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isChecking = false;
  bool _isSavingAccess = false;
  bool _isCreatingPreview = false;
  bool _isSearchingDomain = false;
  bool _isBuyingDomain = false;
  String _accessMode = 'public';
  String? _previewUrl;
  DomainPurchaseQuote? _domainQuote;
  CheckoutDomainSetup? _checkout;
  String? _checkoutError;
  bool _checkoutBusy = false;
  int _checkoutRequest = 0;
  Object? _loadedContext;
  int _domainsRevision = 0;

  bool _isCurrentStore(StoreModel? store) =>
      mounted &&
      store != null &&
      context.read<StoreContext>().selectedStoreId == store.id &&
      context.read<StoreContext>().requestContextKey == _loadedContext;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  @override
  void dispose() {
    _customDomainController.dispose();
    _domainOwnerNameController.dispose();
    _domainOwnerEmailController.dispose();
    _accessMessageController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadStore({bool force = false}) async {
    setState(() => _isLoading = true);
    try {
      final domainService = context.read<DomainService>();
      final stores = context.read<StoreContext>();
      final epoch = stores.requestContextVersion;
      final store = await stores.ensureSelectedStore(force: force);
      if (!mounted) return;
      if (epoch != stores.requestContextVersion ||
          stores.selectedStoreId != store?.id)
        return;
      setState(() {
        _loadedContext = stores.requestContextKey;
        _store = store;
        _checkout = null;
        _checkoutError = null;
        _snapshot = store == null
            ? null
            : domainService.snapshotForStore(store);
        _domainQuote = null;
        _previewUrl = null;
        _customDomainController.text = store?.customDomain ?? '';
        _accessMode = store?.accessMode ?? 'public';
        _accessMessageController.text = store?.accessMessage ?? '';
      });
      if (store != null) unawaited(_loadCheckout());
    } catch (_) {
      _showSnackBar('Domain settings could not load. Refresh to try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadCheckout({bool prepare = false}) async {
    final store = _store;
    if (store == null || !_isCurrentStore(store)) return;
    final request = ++_checkoutRequest;
    setState(() {
      _checkoutBusy = true;
      _checkoutError = null;
    });
    try {
      final setup = await context.read<DomainService>().checkoutSetup(
        store.id,
        prepare: prepare,
      );
      if (!_isCurrentStore(store) || request != _checkoutRequest) return;
      setState(() => _checkout = setup);
    } catch (_) {
      if (!_isCurrentStore(store) || request != _checkoutRequest) return;
      setState(() {
        _checkout = null;
        _checkoutError = 'Checkout address could not be loaded. Please retry.';
      });
    } finally {
      if (_isCurrentStore(store) && request == _checkoutRequest)
        setState(() => _checkoutBusy = false);
    }
  }

  Future<void> _saveDomain() async {
    final store = _store;
    if (store == null || !_isCurrentStore(store)) return;
    final normalized = DomainService.normalizeDomain(
      _customDomainController.text,
    );
    if (normalized == null) {
      _showSnackBar('Enter a domain or clear the current one.');
      return;
    }
    await _persistDomain(store, normalized);
  }

  Future<void> _persistDomain(StoreModel store, String? domain) async {
    if (!_isCurrentStore(store)) return;
    setState(() => _isSaving = true);
    try {
      final domainService = context.read<DomainService>();
      final updated = await domainService.saveCustomDomain(store, domain);
      if (!_isCurrentStore(store)) return;
      setState(() {
        _store = updated;
        _snapshot = domainService.snapshotForStore(updated);
        _customDomainController.text = domain ?? '';
        _domainsRevision++;
      });
      _showSnackBar(
        domain == null
            ? 'Custom domain cleared.'
            : 'Domain saved. Review connected domains and DNS setup.',
      );
      unawaited(_loadCheckout());
    } catch (_) {
      _showSnackBar(
        'Domain setup could not be confirmed. Refresh connected domains before retrying.',
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _checkAvailability() async {
    if (!_isCurrentStore(_store)) return;
    setState(() => _isChecking = true);
    try {
      final result = await context.read<DomainService>().checkAvailability(
        _customDomainController.text,
      );
      _showSnackBar(result.message);
    } catch (_) {
      _showSnackBar(
        'Domain format could not be checked. Review the hostname and try again.',
      );
    } finally {
      if (mounted) setState(() => _isChecking = false);
    }
  }

  Future<void> _searchDomainToBuy() async {
    final store = _store;
    if (!_isCurrentStore(store)) return;
    setState(() => _isSearchingDomain = true);
    try {
      final quote = await context.read<DomainService>().searchDomainToBuy(
        _customDomainController.text,
      );
      if (!_isCurrentStore(store)) return;
      setState(() => _domainQuote = quote);
      _showSnackBar(
        quote.available
            ? '${quote.domain} is available for ${quote.priceLabel}.'
            : '${quote.domain} is unavailable.',
      );
    } catch (_) {
      _showSnackBar('Domain search could not complete.');
    } finally {
      if (mounted) setState(() => _isSearchingDomain = false);
    }
  }

  Future<void> _buyDomain() async {
    final store = _store;
    final quote = _domainQuote;
    if (store == null ||
        !_isCurrentStore(store) ||
        quote == null ||
        !quote.available ||
        quote.provider != 'sandbox')
      return;
    final ownerName = _domainOwnerNameController.text.trim();
    final ownerEmail = _domainOwnerEmailController.text.trim();
    if (ownerName.isEmpty || !ownerEmail.contains('@')) {
      _showSnackBar('Enter registrant name and email.');
      return;
    }
    setState(() => _isBuyingDomain = true);
    try {
      final result = await context.read<DomainService>().purchaseDomain(
        store,
        quote: quote,
        ownerName: ownerName,
        ownerEmail: ownerEmail,
      );
      if (!_isCurrentStore(store)) return;
      setState(() {
        _customDomainController.text = result.domain;
        _store = store.copyWith(
          customDomain: result.domain,
          customDomainStatus: result.status,
        );
        _snapshot = context.read<DomainService>().snapshotForStore(_store!);
      });
      _showSnackBar(result.merchantMessage);
    } catch (_) {
      _showSnackBar('Domain purchase could not complete.');
    } finally {
      if (mounted) setState(() => _isBuyingDomain = false);
    }
  }

  Future<void> _verifyDomain() async {
    final store = _store;
    if (store == null || !_isCurrentStore(store)) return;
    try {
      final updated = await context.read<DomainService>().verifyDomain(store);
      if (!_isCurrentStore(store)) return;
      setState(() {
        _store = updated;
        _snapshot = context.read<DomainService>().snapshotForStore(updated);
      });
      unawaited(_loadCheckout());
    } catch (_) {
      _showSnackBar('Domain verification could not complete.');
    }
  }

  Future<void> _refreshSslStatus() async {
    final store = _store;
    if (store == null || !_isCurrentStore(store)) return;
    try {
      final updated = await context.read<DomainService>().refreshSslStatus(
        store,
      );
      if (!_isCurrentStore(store)) return;
      setState(() {
        _store = updated;
        _snapshot = context.read<DomainService>().snapshotForStore(updated);
      });
    } catch (_) {
      _showSnackBar('Domain health could not refresh.');
    }
  }

  Future<void> _saveAccess() async {
    final store = _store;
    if (store == null || !_isCurrentStore(store)) return;
    setState(() => _isSavingAccess = true);
    try {
      final updated = await context.read<DomainService>().updateStoreAccess(
        store,
        accessMode: _accessMode,
        password: _passwordController.text,
        message: _accessMessageController.text,
      );
      if (!_isCurrentStore(store)) return;
      setState(() {
        _store = updated;
        _snapshot = context.read<DomainService>().snapshotForStore(updated);
        _passwordController.clear();
      });
      _showSnackBar('Store access updated.');
    } catch (_) {
      _showSnackBar(
        'Store access could not be confirmed. Refresh its settings before retrying.',
      );
    } finally {
      if (mounted) setState(() => _isSavingAccess = false);
    }
  }

  Future<void> _createPreviewLink() async {
    final store = _store;
    final snapshot = _snapshot;
    if (store == null || !_isCurrentStore(store) || snapshot == null) return;
    setState(() => _isCreatingPreview = true);
    try {
      final host = snapshot.customDomain ?? snapshot.defaultDomain;
      final result = await context.read<DomainService>().createPreviewLink(
        store,
        host: host,
      );
      if (!_isCurrentStore(store)) return;
      setState(() => _previewUrl = result.url);
      _showSnackBar('Preview link created.');
    } catch (_) {
      _showSnackBar('Preview link could not be created. Please retry.');
    } finally {
      if (mounted) setState(() => _isCreatingPreview = false);
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
    final stores = context.watch<StoreContext>();
    final storeChanged =
        _store != null &&
        (_store!.id != stores.selectedStoreId ||
            _loadedContext != stores.requestContextKey);

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
          : storeChanged
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'The selected store changed. Refresh domains before editing.',
                    ),
                    const SizedBox(height: LetbuyySpacingTokens.space12),
                    FilledButton(
                      onPressed: _loadStore,
                      child: const Text('Refresh domains'),
                    ),
                  ],
                ),
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
                  ConnectedDomainsSection(
                    key: ValueKey((_loadedContext, _domainsRevision)),
                    siteId: snapshot.storeId,
                    onChanged: () => unawaited(_loadStore(force: true)),
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildCheckoutDomain(colors),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildDomainHealth(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildBuyDomain(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildDnsRecords(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space24),
                  _buildAccessControls(colors, snapshot),
                  const SizedBox(height: LetbuyySpacingTokens.space48),
                ],
              ),
            ),
    );
  }

  Widget _buildCheckoutDomain(AppThemeColors colors) {
    final setup = _checkout;
    final explanation = switch (setup?.reason) {
      'PARENT_NOT_VERIFIED' =>
        'Verify the storefront domain and HTTPS before this checkout address can become active.',
      'PRIMARY_REQUIRED' =>
        'This domain must be the verified primary storefront domain before checkout can use it.',
      'NOT_CONFIGURED' || 'PROVIDER_UNAVAILABLE' =>
        'Provisioning is temporarily unavailable. Your current secure checkout remains available.',
      _ =>
        setup?.isReady == true
            ? 'Checkout links use this verified address and follow your published theme.'
            : setup?.source == 'custom'
            ? 'Add the exact DNS records below, then check status. Your current secure checkout stays available during setup.'
            : 'LetBuyy prepares this address automatically. No DNS changes are needed for your LetBuyy subdomain.',
    };
    return _section(
      colors,
      title: 'Secure checkout',
      description: 'The verified address used by your store’s checkout links.',
      child: _panel(
        colors,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_checkoutBusy) const LinearProgressIndicator(),
            if (_checkoutError != null)
              Text(
                _checkoutError!,
                style: TextStyle(color: colors.textSecondary),
              ),
            if (setup != null) ...[
              Text(
                setup.hostname ?? 'Address unavailable',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: LetbuyySpacingTokens.space8),
              _statusPill(
                colors,
                setup.isReady
                    ? 'HTTPS ready'
                    : setup.status == 'unavailable' || setup.status == 'error'
                    ? 'Needs attention'
                    : 'Preparing',
                setup.isReady,
              ),
              const SizedBox(height: LetbuyySpacingTokens.space12),
              Text(explanation, style: TextStyle(color: colors.textSecondary)),
              const SizedBox(height: LetbuyySpacingTokens.space12),
              _dnsLine(colors, 'Currently used address', setup.checkoutOrigin),
              if (setup.checkoutOrigin != setup.fallbackOrigin)
                _dnsLine(colors, 'Secure fallback', setup.fallbackOrigin),
              for (final record in setup.dnsRecords) ...[
                const SizedBox(height: LetbuyySpacingTokens.space12),
                Text(
                  '${record.type} · ${record.name}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: SelectableText(
                        record.value,
                        style: TextStyle(color: colors.textSecondary),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Copy checkout ${record.type} value',
                      onPressed: () =>
                          _copy('Checkout ${record.type} value', record.value),
                      icon: const Icon(Icons.copy_rounded),
                    ),
                  ],
                ),
              ],
            ],
            const SizedBox(height: LetbuyySpacingTokens.space12),
            _secondaryAction(
              colors,
              label: _checkoutBusy
                  ? 'Checking…'
                  : _checkoutError != null
                  ? 'Retry checkout status'
                  : 'Check checkout status',
              icon: Icons.refresh_rounded,
              enabled: !_checkoutBusy,
              onPressed: () => _loadCheckout(prepare: setup != null),
            ),
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
          'Connect a branded domain to this store. Your assigned LetBuyy address remains available subject to store visibility and access settings.',
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
      description:
          'Your assigned LetBuyy address. Store visibility and access settings control what shoppers can see.',
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
          'Save the hostname first. Verification checks ownership, DNS, and Vercel readiness through the gateway.',
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
                  label: 'Verify primary',
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
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDomainHealth(
    AppThemeColors colors,
    DomainSettingsSnapshot snapshot,
  ) {
    final health = snapshot.health;
    return _section(
      colors,
      title: 'Domain health',
      description:
          'Review DNS verification, SSL readiness, and renewal state before publication.',
      child: _panel(
        colors,
        child: snapshot.hasCustomDomain
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _healthStatusRow(
                    colors,
                    icon: Icons.dns_rounded,
                    label: 'DNS',
                    value: snapshot.dnsLabel,
                    status: snapshot.dnsVerified ? 'ready' : 'attention',
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space12),
                  _healthStatusRow(
                    colors,
                    icon: Icons.lock_rounded,
                    label: 'SSL',
                    value: snapshot.sslLabel,
                    status: snapshot.sslActive
                        ? 'ready'
                        : health?.providerUnavailable == true
                        ? 'unknown'
                        : 'attention',
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space12),
                  _healthStatusRow(
                    colors,
                    icon: Icons.event_repeat_rounded,
                    label: 'Renewal',
                    value: snapshot.renewalLabel,
                    status: health?.renewalStatus == 'managed'
                        ? 'ready'
                        : health?.renewalStatus == 'action_required'
                        ? 'attention'
                        : 'unknown',
                  ),
                  const SizedBox(height: LetbuyySpacingTokens.space12),
                  _healthStatusRow(
                    colors,
                    icon: Icons.verified_user_rounded,
                    label: 'Customer verification',
                    value: switch (health?.customerVerification?.status) {
                      'ready' => 'Ready for customer verification',
                      'pending' => 'Waiting for domain readiness',
                      'capacity_reached' => 'Platform setup needs attention',
                      'configuration_required' =>
                        'Platform configuration required',
                      _ => 'Verification status unavailable',
                    },
                    status: health?.customerVerification?.status == 'ready'
                        ? 'ready'
                        : 'unknown',
                  ),
                  if (snapshot.checkedAtLabel != null) ...[
                    const SizedBox(height: LetbuyySpacingTokens.space12),
                    Text(
                      snapshot.checkedAtLabel!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ] else ...[
                    const SizedBox(height: LetbuyySpacingTokens.space12),
                    Text(
                      'Tap Refresh SSL to check the latest DNS and SSL state.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ],
              )
            : _buildNoHealth(colors),
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
                  if (snapshot.apexMxWarning) ...[
                    _warningPanel(
                      colors,
                      'Your domain has email (MX) records. Use www or an ALIAS at the apex, or your email may stop working.',
                    ),
                    const SizedBox(height: LetbuyySpacingTokens.space12),
                  ],
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

  Widget _buildBuyDomain(
    AppThemeColors colors,
    DomainSettingsSnapshot snapshot,
  ) {
    final quote = _domainQuote;
    return _section(
      colors,
      title: 'Buy a domain',
      description:
          'Search for a domain. Registration is available only in the development sandbox until LetBuyy verifies payment on the server.',
      child: _panel(
        colors,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _customDomainController,
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.search,
              decoration: _inputDecoration(colors, 'yourbrand.in'),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            _secondaryAction(
              colors,
              label: _isSearchingDomain ? 'Searching...' : 'Search domain',
              icon: Icons.manage_search_rounded,
              enabled: !_isSearchingDomain,
              onPressed: _searchDomainToBuy,
            ),
            if (quote != null) ...[
              const SizedBox(height: LetbuyySpacingTokens.space12),
              _domainQuotePanel(colors, quote),
              if (quote.available && quote.provider == 'sandbox') ...[
                const SizedBox(height: LetbuyySpacingTokens.space12),
                TextField(
                  controller: _domainOwnerNameController,
                  textInputAction: TextInputAction.next,
                  decoration: _inputDecoration(colors, 'Registrant name'),
                ),
                const SizedBox(height: LetbuyySpacingTokens.space12),
                TextField(
                  controller: _domainOwnerEmailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  decoration: _inputDecoration(colors, 'Registrant email'),
                ),
                const SizedBox(height: LetbuyySpacingTokens.space12),
                _primaryAction(
                  label: _isBuyingDomain ? 'Buying...' : 'Buy and connect',
                  icon: Icons.shopping_cart_checkout_rounded,
                  enabled: !_isBuyingDomain && snapshot.storeId.isNotEmpty,
                  onPressed: _buyDomain,
                ),
              ],
              if (quote.available && quote.provider != 'sandbox') ...[
                const SizedBox(height: LetbuyySpacingTokens.space12),
                _warningPanel(
                  colors,
                  'Live domain registration is unavailable until payment verification is ready.',
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAccessControls(
    AppThemeColors colors,
    DomainSettingsSnapshot snapshot,
  ) {
    final modes = const ['public', 'password', 'preview_only', 'offline'];
    return _section(
      colors,
      title: 'Store access',
      description:
          'Control whether shoppers can browse, use a shared password, or only open signed previews with ?lb_preview= links.',
      child: _panel(
        colors,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: LetbuyySpacingTokens.space8,
              runSpacing: LetbuyySpacingTokens.space8,
              children: modes
                  .map((mode) {
                    final selected = _accessMode == mode;
                    return ChoiceChip(
                      label: Text(mode.replaceAll('_', ' ')),
                      selected: selected,
                      onSelected: (_) => setState(() => _accessMode = mode),
                      selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
                        alpha: 0.16,
                      ),
                      labelStyle: TextStyle(
                        color: selected
                            ? LetbuyyColorTokens.brandPrimary
                            : colors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    );
                  })
                  .toList(growable: false),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            if (_accessMode == 'password')
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: _inputDecoration(colors, 'Shared store password'),
              ),
            if (_accessMode == 'password')
              const SizedBox(height: LetbuyySpacingTokens.space12),
            TextField(
              controller: _accessMessageController,
              decoration: _inputDecoration(colors, 'Optional access message'),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space12),
            Wrap(
              spacing: LetbuyySpacingTokens.space8,
              runSpacing: LetbuyySpacingTokens.space8,
              children: [
                _primaryAction(
                  label: _isSavingAccess ? 'Saving...' : 'Save access',
                  icon: Icons.shield_rounded,
                  enabled: !_isSavingAccess,
                  onPressed: _saveAccess,
                ),
                _secondaryAction(
                  colors,
                  label: _isCreatingPreview
                      ? 'Creating...'
                      : 'Create preview link',
                  icon: Icons.link_rounded,
                  enabled: !_isCreatingPreview,
                  onPressed: _createPreviewLink,
                ),
              ],
            ),
            if (_previewUrl != null) ...[
              const SizedBox(height: LetbuyySpacingTokens.space12),
              _dnsLine(colors, 'Preview', _previewUrl!),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _copy('Preview link', _previewUrl!),
                  icon: const Icon(Icons.copy_rounded),
                  label: const Text('Copy preview link'),
                ),
              ),
            ],
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(
              'Current mode: ${snapshot.accessMode.replaceAll('_', ' ')}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colors.textSecondary,
                fontWeight: FontWeight.w700,
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

  Widget _buildNoHealth(AppThemeColors colors) {
    return Column(
      children: [
        Icon(
          Icons.health_and_safety_outlined,
          color: colors.textTertiary,
          size: 36,
        ),
        const SizedBox(height: LetbuyySpacingTokens.space8),
        Text(
          'Connect a custom domain to see DNS, SSL, and renewal health.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _healthStatusRow(
    AppThemeColors colors, {
    required IconData icon,
    required String label,
    required String value,
    required String status,
  }) {
    final accent = switch (status) {
      'ready' => colors.success,
      'attention' => colors.warning,
      _ => colors.textTertiary,
    };
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: accent, size: 20),
        ),
        const SizedBox(width: LetbuyySpacingTokens.space12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
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
          if (record.actual.isNotEmpty)
            _dnsLine(colors, 'Seen', record.actual.join(', ')),
          if (record.message != null && record.message!.isNotEmpty) ...[
            const SizedBox(height: LetbuyySpacingTokens.space6),
            Text(
              record.message!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _domainQuotePanel(AppThemeColors colors, DomainPurchaseQuote quote) {
    final accent = quote.available ? colors.success : colors.error;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accent.withValues(alpha: 0.32)),
      ),
      child: Row(
        children: [
          Icon(
            quote.available ? Icons.check_circle_rounded : Icons.cancel_rounded,
            color: accent,
          ),
          const SizedBox(width: LetbuyySpacingTokens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  quote.domain,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  quote.available ? quote.priceLabel : 'Unavailable',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
                if (quote.available) ...[
                  const SizedBox(height: LetbuyySpacingTokens.space4),
                  Text(
                    quote.provider == 'sandbox'
                        ? 'Test checkout is ready for this domain.'
                        : 'Registrar checkout will record the provider payment reference.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _warningPanel(AppThemeColors colors, String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(LetbuyySpacingTokens.space12),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.warning.withValues(alpha: 0.32)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, color: colors.warning),
          const SizedBox(width: LetbuyySpacingTokens.space8),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
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
