import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/marketing_service.dart';
import '../../theme/app_theme_colors.dart';

class EmailCampaignsScreen extends StatefulWidget {
  const EmailCampaignsScreen({super.key});

  @override
  State<EmailCampaignsScreen> createState() => _EmailCampaignsScreenState();
}

class _EmailCampaignsScreenState extends State<EmailCampaignsScreen> {
  List<Map<String, dynamic>> _campaigns = const [];
  String? _storeId;
  String? _error;
  bool _isLoading = true;

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
      _storeId ??=
          (await context.read<StoreContext>().ensureSelectedStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _campaigns = const [];
            _isLoading = false;
          });
        }
        return;
      }

      final campaigns = await context.read<MarketingService>().fetchCampaigns(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _campaigns = campaigns;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error is MarketingUnavailableException
              ? error.message
              : 'Email campaigns could not be loaded.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _openComposer() async {
    final storeId = _storeId;
    if (storeId == null) return;
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: colors.card,
      builder: (_) => _EmailCampaignComposer(storeId: storeId),
    );
    if (sent == true) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _storeId == null ? null : _openComposer,
        icon: const Icon(Icons.add_rounded),
        label: const Text('New campaign'),
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
                  'Email Campaigns',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Send to subscribed customers',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh campaigns',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        icon: Icons.mark_email_unread_outlined,
        title: 'Campaigns unavailable',
        subtitle: _error!,
        actionLabel: 'Retry',
        onAction: _load,
      );
    }
    if (_storeId == null) {
      return _centerState(
        icon: Icons.storefront_outlined,
        title: 'Select a store',
        subtitle: 'Choose a store before creating campaigns.',
      );
    }
    if (_campaigns.isEmpty) {
      return _centerState(
        icon: Icons.campaign_outlined,
        title: 'No campaigns yet',
        subtitle: 'Create a campaign for subscribed customers.',
        actionLabel: 'Create campaign',
        onAction: _openComposer,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      itemCount: _campaigns.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) => _campaignCard(_campaigns[index]),
    );
  }

  Widget _campaignCard(Map<String, dynamic> campaign) {
    final status = _label(campaign['status']?.toString() ?? 'draft');
    final recipients = _intValue(campaign['recipient_count']);
    final sent = _intValue(campaign['sent_count']);
    final failed = _intValue(campaign['failed_count']);
    final sandbox = campaign['delivery_mode'] == 'sandbox';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.glassMediumBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  campaign['name']?.toString() ?? 'Email campaign',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _pill(status, sandbox ? colors.warning : colors.accentBlue),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            campaign['subject']?.toString() ?? '',
            style: TextStyle(color: colors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _metric('Audience', '$recipients'),
              _metric('Sent', '$sent'),
              if (failed > 0) _metric('Failed', '$failed'),
              if (sandbox) _metric('Mode', 'Sandbox'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: colors.glassLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.glassMediumBorder),
      ),
      child: Text(
        '$label $value',
        style: TextStyle(
          color: colors.textPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _pill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _centerState({
    required IconData icon,
    required String title,
    required String subtitle,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: colors.textSecondary),
            const SizedBox(height: 16),
            Text(
              title,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: onAction, child: Text(actionLabel)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _loading() => const Center(child: CircularProgressIndicator());
}

class _EmailCampaignComposer extends StatefulWidget {
  const _EmailCampaignComposer({required this.storeId});

  final String storeId;

  @override
  State<_EmailCampaignComposer> createState() => _EmailCampaignComposerState();
}

class _EmailCampaignComposerState extends State<_EmailCampaignComposer> {
  final _name = TextEditingController(text: 'Subscriber update');
  final _subject = TextEditingController();
  final _preview = TextEditingController();
  final _body = TextEditingController();

  bool _isSending = false;
  int? _audienceCount;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _previewAudience());
  }

  @override
  void dispose() {
    _name.dispose();
    _subject.dispose();
    _preview.dispose();
    _body.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _audience => const {
    'type': 'all_marketing',
    'recipients': <String>[],
  };

  Future<void> _previewAudience() async {
    try {
      final preview = await context.read<MarketingService>().previewAudience(
        storeId: widget.storeId,
        audience: _audience,
      );
      if (mounted) {
        setState(() => _audienceCount = _intValue(preview['customer_count']));
      }
    } catch (_) {
      if (mounted) setState(() => _audienceCount = 0);
    }
  }

  Future<void> _saveAndSend() async {
    if (_subject.text.trim().isEmpty || _body.text.trim().isEmpty) {
      setState(() => _error = 'Subject and message are required.');
      return;
    }

    setState(() {
      _isSending = true;
      _error = null;
    });

    try {
      final service = context.read<MarketingService>();
      final campaign = await service.createCampaign(
        storeId: widget.storeId,
        name: _name.text.trim().isEmpty ? _subject.text.trim() : _name.text,
        subject: _subject.text,
        previewText: _preview.text,
        bodyText: _body.text,
        audience: _audience,
      );
      final response = await service.sendCampaign(
        storeId: widget.storeId,
        campaignId: campaign['id'].toString(),
      );
      if (!mounted) return;
      final sandbox = response['sandbox'] == true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(sandbox ? 'Campaign sent in sandbox' : 'Campaign sent'),
        ),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _isSending = false;
          _error = error is MarketingUnavailableException
              ? error.message
              : 'Campaign could not be sent.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'New email campaign',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: _isSending ? null : () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Campaign name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _subject,
              decoration: const InputDecoration(labelText: 'Subject'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _preview,
              decoration: const InputDecoration(labelText: 'Preview text'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _body,
              maxLines: 5,
              decoration: const InputDecoration(labelText: 'Message'),
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colors.glassLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.glassMediumBorder),
              ),
              child: Row(
                children: [
                  Icon(Icons.group_outlined, color: colors.textSecondary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _audienceCount == null
                          ? 'Checking subscribed audience'
                          : 'Subscribed customers: $_audienceCount',
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: colors.error, fontSize: 13),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _isSending ? null : _saveAndSend,
                icon: _isSending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(_isSending ? 'Sending' : 'Send campaign'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

String _label(String value) {
  return value
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}
