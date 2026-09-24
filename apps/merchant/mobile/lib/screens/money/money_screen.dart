import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../services/money_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../widgets/shared/provider_mode_badge.dart';

class MoneyScreen extends StatefulWidget {
  const MoneyScreen({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<MoneyScreen> createState() => _MoneyScreenState();
}

class _MoneyScreenState extends State<MoneyScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  String? _storeId;
  String? _error;
  bool _loading = true;
  final Set<String> _pendingMoneyActions = <String>{};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 4,
      vsync: this,
      initialIndex: widget.initialTab.clamp(0, 3),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        _error = 'Select a store to view money details.';
        return;
      }
      _storeId = store.id;
      if (!mounted) return;
      await context.read<MoneyService>().refreshMoney(store.id);
    } catch (_) {
      _error = 'Money details are temporarily unavailable.';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createPayout() async {
    final storeId = _storeId;
    if (storeId == null) return;
    await _runMoneyAction('create-payout', () async {
      try {
        await context.read<MoneyService>().createPayoutStatement(storeId);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout statement created.')),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No paid orders are ready for payout.')),
        );
      }
    });
  }

  Future<void> _settlePayout(String payoutId) async {
    final storeId = _storeId;
    if (storeId == null) return;
    await _runMoneyAction('settle-payout:$payoutId', () async {
      try {
        await context.read<MoneyService>().settlePayout(payoutId, storeId);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout settlement updated.')),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Payout could not be settled now.')),
        );
      }
    });
  }

  Future<void> _reconcileCommission() async {
    final storeId = _storeId;
    if (storeId == null) return;
    await _runMoneyAction('reconcile-commission', () async {
      final result = await context.read<MoneyService>().reconcileCommission(
        storeId,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${result['created'] ?? 0} entries reconciled.'),
        ),
      );
    });
  }

  Future<void> _collectCodOrder(String orderId, int expectedAmountMinor) async {
    final storeId = _storeId;
    if (storeId == null) return;
    await _runMoneyAction('collect-cod:$orderId', () async {
      try {
        await context.read<MoneyService>().collectCodOrder(
          storeId,
          orderId,
          collectedAmountMinor: expectedAmountMinor,
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('COD collection recorded.')),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('COD collection could not be recorded.'),
          ),
        );
      }
    });
  }

  Future<void> _reconcileCodEntry(
    String entryId,
    int collectedAmountMinor,
  ) async {
    final storeId = _storeId;
    if (storeId == null) return;
    await _runMoneyAction('reconcile-cod:$entryId', () async {
      try {
        await context.read<MoneyService>().reconcileCodEntry(
          storeId,
          entryId,
          depositedAmountMinor: collectedAmountMinor,
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('COD remittance reconciled.')),
        );
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('COD remittance could not be reconciled.'),
          ),
        );
      }
    });
  }

  Future<void> _runMoneyAction(
    String actionKey,
    Future<void> Function() action,
  ) async {
    if (_pendingMoneyActions.contains(actionKey)) return;
    setState(() => _pendingMoneyActions.add(actionKey));
    try {
      await action();
    } finally {
      if (mounted) setState(() => _pendingMoneyActions.remove(actionKey));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.card,
      appBar: AppBar(
        title: const Text('Money'),
        backgroundColor: colors.card,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Payouts'),
            Tab(text: 'Wallet'),
            Tab(text: 'Commission'),
            Tab(text: 'COD'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _EmptyState(message: _error!, actionLabel: 'Retry', onTap: _load)
          : Consumer<MoneyService>(
              builder: (context, money, _) {
                final providerMode = ProviderMode.parse(
                  money.payoutSummary?['provider_mode'],
                );
                return TabBarView(
                  controller: _tabController,
                  children: [
                    _PayoutsTab(
                      payouts: money.payouts,
                      summary: money.payoutSummary,
                      providerMode: providerMode,
                      pendingActionKeys: _pendingMoneyActions,
                      onCreate: _createPayout,
                      onSettle: _settlePayout,
                    ),
                    _WalletTab(
                      wallet: money.wallet,
                      providerMode: providerMode,
                    ),
                    _CommissionTab(
                      commission: money.commission,
                      providerMode: providerMode,
                      isReconciling: _pendingMoneyActions.contains(
                        'reconcile-commission',
                      ),
                      onReconcile: _reconcileCommission,
                    ),
                    _CodTab(
                      cod: money.cod,
                      providerMode: providerMode,
                      pendingActionKeys: _pendingMoneyActions,
                      onCollect: _collectCodOrder,
                      onReconcile: _reconcileCodEntry,
                    ),
                  ],
                );
              },
            ),
    );
  }
}

class _PayoutsTab extends StatelessWidget {
  const _PayoutsTab({
    required this.payouts,
    required this.summary,
    required this.providerMode,
    required this.pendingActionKeys,
    required this.onCreate,
    required this.onSettle,
  });

  final List<Map<String, dynamic>> payouts;
  final Map<String, dynamic>? summary;
  final ProviderMode? providerMode;
  final Set<String> pendingActionKeys;
  final Future<void> Function() onCreate;
  final Future<void> Function(String payoutId) onSettle;

  @override
  Widget build(BuildContext context) {
    final next = summary?['next_payout'];
    final nextPayout = next is Map ? Map<String, dynamic>.from(next) : null;

    return RefreshIndicator(
      onRefresh: onCreate,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ProviderModeHeader(mode: providerMode),
          _SummaryCard(
            title: 'Next payout',
            value: nextPayout == null
                ? 'No payout scheduled'
                : _formatMinor(nextPayout['net_amount_minor']),
            subtitle: nextPayout == null
                ? 'Paid orders will appear here when ready.'
                : '${nextPayout['status']} · ${nextPayout['available_on'] ?? 'available soon'}',
            actionLabel: 'Create statement',
            actionBusy: pendingActionKeys.contains('create-payout'),
            onAction: () {
              onCreate();
            },
          ),
          const SizedBox(height: 16),
          if (payouts.isEmpty)
            const _EmptyState(
              message: 'No payout statements yet.',
              detail: 'Paid orders will be grouped into settlement statements.',
            )
          else
            ...payouts.map((payout) {
              final payoutId = payout['id']?.toString() ?? '';
              return _MoneyTile(
                title: payout['statement_number']?.toString() ?? 'Payout',
                subtitle: payout['status']?.toString() ?? 'pending',
                amount: _formatMinor(payout['net_amount_minor']),
                trailing: payout['status'] == 'pending'
                    ? TextButton(
                        onPressed:
                            pendingActionKeys.contains(
                                  'settle-payout:$payoutId',
                                ) ||
                                payoutId.isEmpty
                            ? null
                            : () {
                                onSettle(payoutId);
                              },
                        child: const Text('Settle'),
                      )
                    : null,
              );
            }),
        ],
      ),
    );
  }
}

class _WalletTab extends StatelessWidget {
  const _WalletTab({required this.wallet, required this.providerMode});

  final Map<String, dynamic>? wallet;
  final ProviderMode? providerMode;

  @override
  Widget build(BuildContext context) {
    final ledger = _listOfMaps(wallet?['ledger']);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ProviderModeHeader(mode: providerMode),
        _SummaryCard(
          title: 'Available balance',
          value: _formatMinor(wallet?['available_minor']),
          subtitle:
              'Pending ${_formatMinor(wallet?['pending_minor'])} · Released ${_formatMinor(wallet?['released_minor'])}',
        ),
        const SizedBox(height: 16),
        if (ledger.isEmpty)
          const _EmptyState(
            message: 'No wallet activity yet.',
            detail: 'Payout credits and releases will appear here.',
          )
        else
          ...ledger.map(
            (entry) => _MoneyTile(
              title: entry['description']?.toString() ?? 'Wallet entry',
              subtitle:
                  '${entry['entry_type'] ?? 'entry'} · ${entry['status'] ?? 'posted'}',
              amount: _formatMinor(entry['amount_minor']),
            ),
          ),
      ],
    );
  }
}

class _CommissionTab extends StatelessWidget {
  const _CommissionTab({
    required this.commission,
    required this.providerMode,
    required this.isReconciling,
    required this.onReconcile,
  });

  final Map<String, dynamic>? commission;
  final ProviderMode? providerMode;
  final bool isReconciling;
  final Future<void> Function() onReconcile;

  @override
  Widget build(BuildContext context) {
    final schedule = commission?['schedule'];
    final scheduleMap = schedule is Map
        ? Map<String, dynamic>.from(schedule)
        : {};
    final summary = commission?['summary'];
    final summaryMap = summary is Map ? Map<String, dynamic>.from(summary) : {};
    final entries = _listOfMaps(commission?['entries']);
    final bps = (scheduleMap['commission_bps'] as num?)?.toDouble() ?? 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ProviderModeHeader(mode: providerMode),
        _SummaryCard(
          title: 'Commission schedule',
          value: '${(bps / 100).toStringAsFixed(2)}%',
          subtitle:
              'GST on platform fee: ${(((scheduleMap['gst_bps'] as num?)?.toDouble() ?? 0) / 100).toStringAsFixed(2)}%',
          actionLabel: 'Reconcile',
          actionBusy: isReconciling,
          onAction: () {
            onReconcile();
          },
        ),
        const SizedBox(height: 12),
        _SummaryCard(
          title: 'Reconciled net payable',
          value: _formatMinor(summaryMap['net_payable_minor']),
          subtitle:
              'Fees ${_formatMinor(summaryMap['commission_amount_minor'])} · GST ${_formatMinor(summaryMap['gst_amount_minor'])}',
        ),
        const SizedBox(height: 16),
        if (entries.isEmpty)
          const _EmptyState(
            message: 'No commission entries yet.',
            detail: 'Reconcile after paid orders are recorded.',
          )
        else
          ...entries.map(
            (entry) => _MoneyTile(
              title: 'Order ${entry['order_id'] ?? ''}',
              subtitle: entry['status']?.toString() ?? 'pending',
              amount: _formatMinor(entry['commission_amount_minor']),
            ),
          ),
      ],
    );
  }
}

class _CodTab extends StatelessWidget {
  const _CodTab({
    required this.cod,
    required this.providerMode,
    required this.pendingActionKeys,
    required this.onCollect,
    required this.onReconcile,
  });

  final Map<String, dynamic>? cod;
  final ProviderMode? providerMode;
  final Set<String> pendingActionKeys;
  final Future<void> Function(String orderId, int expectedAmountMinor)
  onCollect;
  final Future<void> Function(String entryId, int collectedAmountMinor)
  onReconcile;

  @override
  Widget build(BuildContext context) {
    final summary = cod?['summary'];
    final summaryMap = summary is Map ? Map<String, dynamic>.from(summary) : {};
    final entries = _listOfMaps(cod?['entries']);
    final counts = summaryMap['counts'];
    final countMap = counts is Map ? Map<String, dynamic>.from(counts) : {};

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _ProviderModeHeader(mode: providerMode),
        _SummaryCard(
          title: 'COD expected',
          value: _formatMinor(summaryMap['expected_amount_minor']),
          subtitle:
              'Collected ${_formatMinor(summaryMap['collected_amount_minor'])} · Deposited ${_formatMinor(summaryMap['deposited_amount_minor'])}',
        ),
        const SizedBox(height: 12),
        _SummaryCard(
          title: 'COD reconciliation',
          value: _formatMinor(summaryMap['difference_amount_minor']),
          subtitle:
              '${countMap['pending'] ?? 0} pending · ${countMap['collected'] ?? 0} collected · ${countMap['reconciled'] ?? 0} reconciled',
        ),
        const SizedBox(height: 16),
        if (entries.isEmpty)
          const _EmptyState(
            message: 'No COD orders to reconcile.',
            detail: 'Cash-on-delivery orders will appear here after checkout.',
          )
        else
          ...entries.map((entry) {
            final metadata = entry['metadata'];
            final metadataMap = metadata is Map
                ? Map<String, dynamic>.from(metadata)
                : const <String, dynamic>{};
            final status = entry['status']?.toString() ?? 'pending';
            final expected = _intValue(entry['expected_amount_minor']);
            final collected = _intValue(entry['collected_amount_minor']);
            final orderId = entry['order_id']?.toString() ?? '';
            final entryId = entry['id']?.toString() ?? '';
            final title =
                metadataMap['order_number']?.toString().isNotEmpty == true
                ? 'Order ${metadataMap['order_number']}'
                : 'Order $orderId';
            final canCollect = status == 'pending';
            final canReconcile = status == 'collected';

            return _MoneyTile(
              title: title,
              subtitle:
                  '$status · expected ${_formatMinor(expected)} · deposited ${_formatMinor(entry['deposited_amount_minor'])}',
              amount: _formatMinor(collected > 0 ? collected : expected),
              trailing: canCollect
                  ? TextButton(
                      onPressed:
                          pendingActionKeys.contains('collect-cod:$orderId') ||
                              orderId.isEmpty
                          ? null
                          : () {
                              onCollect(orderId, expected);
                            },
                      child: const Text('Collect'),
                    )
                  : canReconcile
                  ? TextButton(
                      onPressed:
                          pendingActionKeys.contains(
                                'reconcile-cod:$entryId',
                              ) ||
                              entryId.isEmpty
                          ? null
                          : () {
                              onReconcile(entryId, collected);
                            },
                      child: const Text('Reconcile'),
                    )
                  : null,
            );
          }),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.subtitle,
    this.actionLabel,
    this.actionBusy = false,
    this.onAction,
  });

  final String title;
  final String value;
  final String subtitle;
  final String? actionLabel;
  final bool actionBusy;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: colors.textSecondary)),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(color: colors.textSecondary)),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 12),
            FilledButton(
              onPressed: actionBusy ? null : onAction,
              child: Text(actionBusy ? 'Working...' : actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProviderModeHeader extends StatelessWidget {
  const _ProviderModeHeader({required this.mode});

  final ProviderMode? mode;

  @override
  Widget build(BuildContext context) {
    if (mode == null) return const SizedBox.shrink();
    final colors = AppThemeColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Text(
            'Provider mode',
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          ProviderModeBadge(mode: mode, compact: true),
        ],
      ),
    );
  }
}

class _MoneyTile extends StatelessWidget {
  const _MoneyTile({
    required this.title,
    required this.subtitle,
    required this.amount,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final String amount;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(subtitle, style: TextStyle(color: colors.textSecondary)),
              ],
            ),
          ),
          Text(
            amount,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
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
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
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
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onTap, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

String _formatMinor(Object? value) {
  final amount = value is num ? value.toDouble() : 0;
  return '₹${(amount / 100).toStringAsFixed(2)}';
}

List<Map<String, dynamic>> _listOfMaps(Object? value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((row) => Map<String, dynamic>.from(row))
      .toList(growable: false);
}

int _intValue(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}
