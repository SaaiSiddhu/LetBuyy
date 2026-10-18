import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';

import '../../app/routes.dart';
import '../../services/subscription_service.dart';
import '../../theme/app_theme_colors.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

import '../subscription/razorpay_checkout_screen.dart';

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  MerchantBillingState? _subscription;
  List<BillingHistoryEntry> _history = const [];
  bool _isLoading = true;
  bool _isRecovering = false;
  String? _storeId;
  int _loadVersion = 0;
  int? _loadedEpoch;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final version = ++_loadVersion;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final storeContext = context.read<StoreContext>(),
          epoch = storeContext.requestContextVersion;
      final store = await storeContext.ensureSelectedStore();
      if (!mounted || version != _loadVersion) return;
      _storeId = store?.id;
      if (_storeId == null) {
        setState(() {
          _subscription = null;
          _history = const [];
          _isLoading = false;
        });
        return;
      }

      final subscriptionService = context.read<SubscriptionService>();
      final results = await Future.wait<Object?>([
        subscriptionService.fetchBillingState(_storeId!),
        subscriptionService.fetchBillingHistory(_storeId!),
      ]);
      if (mounted && version == _loadVersion) {
        if (storeContext.requestContextVersion != epoch ||
            storeContext.selectedStoreId != _storeId)
          throw StateError('Store changed');
        setState(() {
          _loadedEpoch = epoch;
          _subscription = results[0] as MerchantBillingState?;
          _history = results[1] as List<BillingHistoryEntry>;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted && version == _loadVersion) {
        setState(() {
          _error =
              'Billing details could not load. Pull to refresh or try again.';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _recoverFailedPayment() async {
    final subscription = _subscription;
    if (_storeId == null || subscription == null || _isRecovering) return;

    setState(() => _isRecovering = true);
    try {
      final checkout = await context
          .read<SubscriptionService>()
          .recoverFailedPayment(storeId: _storeId!);

      if (checkout['activated'] == true) {
        _showMessage('Payment recovered.', isSuccess: true);
        await _load();
        return;
      }

      final verified = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => RazorpayCheckoutScreen(
            storeId: _storeId!,
            planSlug:
                (checkout['plan'] as Map?)?['slug'] as String? ??
                subscription.planSlug ??
                '',
            billingPeriod:
                checkout['billing_period'] as String? ??
                subscription.billingPeriod ??
                'monthly',
            checkout: checkout,
          ),
        ),
      );

      if (!mounted) return;
      if (verified == true) {
        _showMessage('Payment recovered.', isSuccess: true);
        await _load();
      } else if (verified == false) {
        _showMessage('Payment recovery did not complete.', isError: true);
      }
    } catch (_) {
      if (mounted) {
        _showMessage(
          'Payment recovery is unavailable right now.',
          isError: true,
        );
      }
    } finally {
      if (mounted) setState(() => _isRecovering = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final storeContext = context.watch<StoreContext>();
    final changed =
        _storeId != null &&
        (_storeId != storeContext.selectedStoreId ||
            _loadedEpoch != storeContext.requestContextVersion);
    if (changed && !_isLoading && _error == null)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_isLoading) _load();
      });
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Expanded(
                child: _isLoading || (changed && _error == null)
                    ? _loading()
                    : _body(),
              ),
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
                  'Billing',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Subscription and invoices',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh billing',
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
        Icons.error_outline_rounded,
        'Could not load billing',
        _error!,
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _subscriptionCard(),
          const SizedBox(height: 14),
          _sectionTitle('Invoices'),
          if (_history.isEmpty)
            _emptyHistory()
          else
            for (final entry in _history) _historyCard(entry),
        ],
      ),
    );
  }

  Widget _subscriptionCard() {
    final status = _subscription?.status ?? 'unknown';
    final amount = _subscription?.amountPaidMinor;
    final nextBilling = _subscription?.periodEnd;
    final recoverable = _subscription?.recoverable == true;
    final statusTone = recoverable
        ? colors.warning
        : _subscription?.active == true
        ? colors.success
        : colors.textTertiary;

    return Container(
      padding: const EdgeInsets.all(16),
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
              Icon(
                Icons.diamond_outlined,
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  _subscription?.planName ?? 'Billing unavailable',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                'Provider status unavailable',
                style: TextStyle(color: colors.textSecondary, fontSize: 10),
              ),
              const SizedBox(width: 8),
              _statusChip(_statusLabel(status), statusTone),
            ],
          ),
          if (recoverable) ...[const SizedBox(height: 14), _recoveryBanner()],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _metric(
                  'Last payment',
                  amount == null
                      ? 'Not recorded'
                      : subscriptionMoney(
                          amount,
                          symbol: 'INR ',
                          decimals: true,
                        ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metric(
                  'Next billing',
                  nextBilling == null ? 'Not set' : _dateLabel(nextBilling),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () async {
              await Navigator.pushNamed(context, AppRoutes.pricing);
              if (mounted) await _load();
            },
            icon: const Icon(Icons.rocket_launch_outlined),
            label: const Text('Manage plan'),
          ),
        ],
      ),
    );
  }

  Widget _recoveryBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: colors.warning.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.error_outline_rounded, color: colors.warning),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Payment needs attention',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Retry checkout to keep this store active.',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _isRecovering ? null : _recoverFailedPayment,
            icon: _isRecovering
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
            label: Text(_isRecovering ? 'Starting recovery' : 'Retry payment'),
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        title,
        style: TextStyle(
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _historyCard(BillingHistoryEntry entry) {
    final paid = entry.status.toLowerCase() == 'paid';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Row(
        children: [
          Icon(
            Icons.receipt_long_outlined,
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.amountLabel,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${entry.invoiceNumber ?? _titleCase(entry.billingPeriod)} - ${entry.createdAt}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
                if (entry.taxAmount != null)
                  Text(
                    'Recorded tax: ${subscriptionMoney(entry.taxAmount!, decimals: true)}',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
                if (entry.totalAmount != null)
                  Text(
                    'Recorded total: ${subscriptionMoney(entry.totalAmount!, decimals: true)}',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
              ],
            ),
          ),
          _statusChip(entry.status, paid ? colors.success : colors.warning),
        ],
      ),
    );
  }

  Widget _emptyHistory() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.receipt_long_outlined, color: colors.textTertiary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'No invoices yet',
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
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

  void _showMessage(
    String message, {
    bool isSuccess = false,
    bool isError = false,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : (isSuccess ? colors.success : colors.card),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

String _dateLabel(DateTime value) {
  return '${value.year}-${_two(value.month)}-${_two(value.day)}';
}

String _two(int value) => value.toString().padLeft(2, '0');

String _titleCase(String value) {
  if (value.isEmpty) return value;
  return value
      .split(RegExp(r'[\s_-]+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}

String _statusLabel(String value) {
  if (value == 'pastDue') return 'Past due';
  return _titleCase(value);
}
