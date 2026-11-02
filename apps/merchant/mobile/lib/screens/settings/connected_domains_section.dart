import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import '../../services/custom_domains.dart';

/// Uses the same site_domains registry and commands as Merchant web.
class ConnectedDomainsSection extends StatefulWidget {
  const ConnectedDomainsSection({
    super.key,
    required this.siteId,
    required this.onChanged,
  });
  final String siteId;
  final VoidCallback onChanged;
  @override
  State<ConnectedDomainsSection> createState() =>
      _ConnectedDomainsSectionState();
}

class _ConnectedDomainsSectionState extends State<ConnectedDomainsSection> {
  List<SiteDomainRecord>? _domains;
  String? _error;
  bool _busy = false;
  Object? _contextKey;
  bool get _current =>
      mounted &&
      context.read<StoreContext>().requestContextKey == _contextKey &&
      context.read<StoreContext>().selectedStoreId == widget.siteId;
  @override
  void initState() {
    super.initState();
    _contextKey = context.read<StoreContext>().requestContextKey;
    _load();
  }

  Future<void> _load() async {
    if (!_current) return;
    setState(() => _busy = true);
    try {
      final rows = await context.read<DomainService>().connectedDomains(
        widget.siteId,
      );
      if (!_current) return;
      setState(() {
        _domains = rows;
        _error = null;
      });
    } catch (_) {
      if (_current)
        setState(() {
          _domains = null;
          _error = 'Connected domains could not be loaded. Please retry.';
        });
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  void _message(String text) {
    if (_current)
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(text)));
  }

  Widget _guardedDialog(BuildContext c, Widget child) => Consumer<StoreContext>(
    builder: (_, stores, __) => _current
        ? child
        : AlertDialog(
            title: const Text('Store access changed'),
            content: const Text(
              'Close this dialog and reload the selected store.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Close'),
              ),
            ],
          ),
  );

  Future<void> _command(
    SiteDomainRecord row,
    String action, {
    String? redirectTo,
  }) async {
    if (!_current || _busy) return;
    if (action == 'remove') {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (c) => _guardedDialog(
          c,
          AlertDialog(
            title: Text('Remove ${row.domain}?'),
            content: const Text(
              'This address will stop serving this store. Existing checkout links may need time to drain safely.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('Remove domain'),
              ),
            ],
          ),
        ),
      );
      if (confirmed != true || !_current) return;
    }
    setState(() => _busy = true);
    try {
      final service = context.read<DomainService>();
      String? status;
      if (action == 'primary')
        await service.makePrimaryDomain(widget.siteId, row.domain);
      if (action == 'remove')
        await service.removeConnectedDomain(widget.siteId, row.domain);
      if (action == 'verify')
        status = await service.verifyConnectedDomain(widget.siteId, row.domain);
      if (action == 'redirect')
        await service.setDomainRedirect(widget.siteId, row.domain, redirectTo);
      if (!_current) return;
      final rows = await service.connectedDomains(widget.siteId);
      if (!_current) return;
      setState(() {
        _domains = rows;
        _error = null;
      });
      final matching = rows.where((value) => value.domain == row.domain);
      _message(
        action == 'verify'
            ? status == 'active'
                  ? 'Domain verification is active. Check HTTPS readiness below.'
                  : 'Verification is still ${status ?? 'pending'}. Review DNS setup and check again.'
            : action == 'primary'
            ? matching.any((value) => value.isPrimary)
                  ? 'Primary domain updated.'
                  : 'Primary domain has not changed. Refresh and retry.'
            : action == 'redirect'
            ? matching.any(
                    (value) =>
                        value.role == 'redirect' &&
                        value.redirectTo == redirectTo,
                  )
                  ? 'Redirect target updated.'
                  : 'Redirect update could not be confirmed. Refresh and retry.'
            : matching.isEmpty
            ? 'Domain removed.'
            : 'Removal is still processing. Refresh to check.',
      );
      widget.onChanged();
    } catch (_) {
      _message(
        'Domain update could not be confirmed. Refresh its status before retrying.',
      );
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _history(SiteDomainRecord row) async {
    if (!_current || _busy) return;
    setState(() => _busy = true);
    try {
      final events = await context.read<DomainService>().domainHistory(
        widget.siteId,
        row.domain,
      );
      if (!_current) return;
      setState(() => _busy = false);
      await showDialog<void>(
        context: context,
        builder: (c) => _guardedDialog(
          c,
          AlertDialog(
            title: Text('History · ${row.domain}'),
            content: SizedBox(
              width: 400,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (events.isEmpty)
                      const Text('No verification history yet.'),
                    for (final event in events)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${event.checkType.replaceAll('_', ' ')} · ${event.status}',
                            ),
                            Text(
                              'TXT ${event.txtVerified ? 'verified' : 'unverified'} · Routing ${event.cnameVerified ? 'verified' : 'unverified'} · HTTPS ${event.sslActive ? 'active' : 'unverified'}',
                            ),
                            if (event.createdAt != null) Text(event.createdAt!),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      );
    } catch (_) {
      _message('Domain history is unavailable. Please retry.');
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Future<void> _redirect(SiteDomainRecord row) async {
    if (!_current || _busy || row.isPrimary) return;
    final targets = (_domains ?? <SiteDomainRecord>[])
        .where((value) => value.domain != row.domain && value.isReady)
        .map((value) => value.domain)
        .toSet();
    var target = targets.contains(row.redirectTo) ? row.redirectTo! : '';
    final chosen = await showDialog<String>(
      context: context,
      builder: (c) => _guardedDialog(
        c,
        StatefulBuilder(
          builder: (c, setDialogState) => AlertDialog(
            title: Text('Redirect ${row.domain}'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Choose the primary address or another verified domain connected to this store.',
                ),
                DropdownButtonFormField<String>(
                  initialValue: target,
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('Current primary domain'),
                    ),
                    ...targets.map(
                      (value) =>
                          DropdownMenuItem(value: value, child: Text(value)),
                    ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => target = value ?? ''),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(c, target),
                child: const Text('Save redirect'),
              ),
            ],
          ),
        ),
      ),
    );
    if (chosen == null || !_current) return;
    await _command(row, 'redirect', redirectTo: chosen.isEmpty ? null : chosen);
  }

  Future<void> _instructions(SiteDomainRecord row) async {
    if (!_current || _busy) return;
    setState(() => _busy = true);
    try {
      final result = await context.read<DomainService>().domainInstructions(
        widget.siteId,
        row.domain,
      );
      if (!_current) return;
      setState(() => _busy = false);
      await showDialog<void>(
        context: context,
        builder: (c) => _guardedDialog(
          c,
          AlertDialog(
            title: Text('Set up ${result.domain}'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Add these exact records at your DNS provider. Keep existing mail and other application records.',
                  ),
                  for (final record in result.records)
                    _record(record.type, record.name, record.value),
                  if (result.checkout != null) ...[
                    const SizedBox(height: 16),
                    const Text(
                      'Secure checkout',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(result.checkout!.hostname ?? 'Address unavailable'),
                    const Text(
                      'Your current secure checkout remains available while this address is prepared.',
                    ),
                    for (final record in result.checkout!.dnsRecords)
                      _record(record.type, record.name, record.value),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      );
    } catch (_) {
      _message('Domain setup instructions could not load. Please retry.');
    } finally {
      if (_current) setState(() => _busy = false);
    }
  }

  Widget _record(String type, String name, String value) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$type · $name'),
        SelectableText(value),
        TextButton.icon(
          onPressed: () {
            if (_current) Clipboard.setData(ClipboardData(text: value));
          },
          icon: const Icon(Icons.copy_rounded),
          label: Text('Copy $type value'),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    context.watch<StoreContext>();
    if (!_current) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Connected domains',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                ),
                IconButton(
                  tooltip: 'Refresh connected domains',
                  onPressed: _busy ? null : _load,
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
            if (_busy) const LinearProgressIndicator(),
            if (_error != null) Text(_error!),
            if (_domains?.isEmpty == true)
              const Text('No custom domains connected.'),
            for (final row in _domains ?? <SiteDomainRecord>[])
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      row.domain,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${row.isPrimary ? 'Primary' : 'Redirect'} · ${row.status} · HTTPS ${row.sslStatus}',
                    ),
                    if (row.provider != null)
                      Text('DNS provider: ${row.provider}'),
                    if (row.redirectTo != null)
                      Text('Redirects to ${row.redirectTo}'),
                    Wrap(
                      spacing: 8,
                      children: [
                        TextButton(
                          onPressed: _busy ? null : () => _instructions(row),
                          child: const Text('DNS setup'),
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => _command(row, 'verify'),
                          child: const Text('Verify domain'),
                        ),
                        if (!row.isPrimary && row.isReady)
                          TextButton(
                            onPressed: _busy
                                ? null
                                : () => _command(row, 'primary'),
                            child: const Text('Make primary'),
                          ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => _command(row, 'remove'),
                          child: const Text('Remove'),
                        ),
                        TextButton(
                          onPressed: _busy ? null : () => _history(row),
                          child: const Text('History'),
                        ),
                        if (!row.isPrimary)
                          TextButton(
                            onPressed: _busy ? null : () => _redirect(row),
                            child: const Text('Redirect target'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
