import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

import '../../app/store_context.dart';
import '../../models/store_model.dart';
import '../../services/subscription_service.dart';
import '../../theme/app_theme_colors.dart';
import 'razorpay_checkout_screen.dart';

class PricingScreen extends StatefulWidget {
  const PricingScreen({super.key});
  @override
  State<PricingScreen> createState() => _PricingScreenState();
}

class _PricingScreenState extends State<PricingScreen> {
  StoreModel? _store;
  MerchantBillingState? _current;
  List<MerchantBillingPlan> _plans = const [];
  String _period = 'monthly';
  String? _error;
  bool _loading = true, _processing = false, _choosing = false;
  int _loadVersion = 0;
  int? _loadedEpoch;
  AppThemeColors get colors => AppThemeColors.of(context);
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final version = ++_loadVersion;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final storeContext = context.read<StoreContext>();
      final epoch = storeContext.requestContextVersion;
      final service = context.read<SubscriptionService>();
      final store = await storeContext.ensureSelectedStore();
      if (store == null)
        throw StateError('Choose a store before managing its plan.');
      final values = await Future.wait<Object>([
        service.fetchPlans(store.id),
        service.fetchBillingState(store.id),
      ]);
      if (!mounted || version != _loadVersion) return;
      if (storeContext.requestContextVersion != epoch ||
          storeContext.selectedStoreId != store.id)
        throw StateError('Store changed. Refresh plans for the current store.');
      setState(() {
        _loadedEpoch = epoch;
        _store = store;
        _plans = values[0] as List<MerchantBillingPlan>;
        _current = values[1] as MerchantBillingState;
        _loading = false;
      });
    } catch (_) {
      if (mounted && version == _loadVersion)
        setState(() {
          _loading = false;
          _error = 'Plans could not load. Refresh to try again.';
        });
    }
  }

  bool _isCurrent(MerchantBillingPlan plan) =>
      _current?.active == true &&
      _current?.planSlug == plan.slug &&
      _current?.billingPeriod == _period;

  Future<void> _selectPlan(MerchantBillingPlan plan) async {
    if (_store == null ||
        _processing ||
        _choosing ||
        !plan.purchasable ||
        _isCurrent(plan))
      return;
    final period = _period;
    setState(() => _choosing = true);
    HapticFeedback.mediumImpact();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      builder: (sheet) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Choose ${plan.name}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '${plan.priceLabel(period)} /${period == 'yearly' ? 'year' : 'month'}',
                  style: TextStyle(
                    color: colors.accent,
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                for (final feature in plan.features)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      feature,
                      style: TextStyle(color: colors.textPrimary),
                    ),
                  ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.pop(sheet, true),
                  child: const Text('Continue to Payment'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(sheet, false),
                  child: const Text('Back to plans'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _choosing = false);
    if (confirmed == true) await _initiatePayment(plan, period);
  }

  Future<void> _initiatePayment(MerchantBillingPlan plan, String period) async {
    final store = _store;
    if (store == null || _processing) return;
    setState(() => _processing = true);
    try {
      final checkout = await context
          .read<SubscriptionService>()
          .createCatalogCheckout(
            storeId: store.id,
            planSlug: plan.slug,
            billingPeriod: period,
          );
      if (!mounted) return;
      if (context.read<StoreContext>().selectedStoreId != store.id)
        throw StateError('Store changed. Open billing for the current store.');
      if (checkout['activated'] == true) {
        await _load();
        if (mounted) _showMessage('${plan.name} is activated.');
        return;
      }
      final amount = checkout['amount'];
      if (amount is! int || amount <= 0 || checkout['currency'] != 'INR')
        throw const FormatException('Checkout pricing is unavailable.');
      if (amount != plan.amountMinor(period)) {
        final accepted = await showDialog<bool>(
          context: context,
          builder: (dialog) => AlertDialog(
            title: const Text('Review updated price'),
            content: Text(
              'The saved checkout is ${subscriptionMoney(amount)} for this ${period == 'yearly' ? 'year' : 'month'}. Review this amount before continuing.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialog, false),
                child: const Text('Back'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialog, true),
                child: const Text('Continue'),
              ),
            ],
          ),
        );
        if (!mounted || accepted != true) return;
      }
      final verified = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => RazorpayCheckoutScreen(
            storeId: store.id,
            planSlug: plan.slug,
            billingPeriod: period,
            checkout: checkout,
          ),
        ),
      );
      if (!mounted) return;
      if (verified == true) {
        await _load();
        if (mounted) _showMessage('${plan.name} is activated.');
      }
    } catch (error) {
      if (mounted)
        _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  void _showMessage(String message) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
  @override
  Widget build(BuildContext context) {
    final storeContext = context.watch<StoreContext>();
    final changed =
        _store != null &&
        (_store?.id != storeContext.selectedStoreId ||
            _loadedEpoch != storeContext.requestContextVersion);
    if (changed && !_loading && _error == null)
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_loading) _load();
      });
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Back',
                      onPressed: () => Navigator.maybePop(context),
                      icon: Icon(
                        Icons.arrow_back_ios,
                        color: colors.textPrimary,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        'Choose Your Plan',
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Refresh plans',
                      onPressed: _processing ? null : _load,
                      icon: const Icon(Icons.refresh),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _loading || (changed && _error == null)
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _error!,
                                style: TextStyle(color: colors.textPrimary),
                              ),
                              const SizedBox(height: 12),
                              FilledButton(
                                onPressed: _load,
                                child: const Text('Retry loading plans'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _content(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _content() => RefreshIndicator(
    onRefresh: _load,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        if (_current != null)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.cardBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Current: ${_current!.planName}',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  _current!.status.replaceAll('_', ' '),
                  style: TextStyle(color: colors.textSecondary),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'monthly', label: Text('Monthly')),
            ButtonSegment(value: 'yearly', label: Text('Yearly')),
          ],
          selected: {_period},
          onSelectionChanged: _processing || _choosing
              ? null
              : (value) => setState(() => _period = value.single),
        ),
        const SizedBox(height: 20),
        if (_plans.isEmpty)
          Text(
            'No plans are available for this store.',
            style: TextStyle(color: colors.textPrimary),
          ),
        for (final plan in _plans)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _planCard(plan),
          ),
        const SizedBox(height: 8),
        Text(
          'Review the selected billing period and checkout amount before paying. Billing shows recorded payments and invoices.',
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
      ],
    ),
  );

  Widget _planCard(MerchantBillingPlan plan) {
    final current = _isCurrent(plan),
        selectable = plan.purchasable && !current && !_processing && !_choosing;
    final label = [
      '${plan.name} plan',
      plan.requiresContact
          ? 'Contact sales'
          : plan.comingSoon
          ? 'Coming soon'
          : '${plan.priceLabel(_period)} /${_period == 'yearly' ? 'year' : 'month'}',
      plan.productLimit == null
          ? 'Unlimited products'
          : '${plan.productLimit} products',
      ...plan.features,
      if (current) 'Current plan',
      if (!plan.purchasable) 'Unavailable for checkout',
    ].join(', ');
    return Semantics(
      key: ValueKey('subscription-plan-${plan.slug}'),
      container: true,
      button: true,
      enabled: selectable,
      selected: current,
      label: label,
      onTap: selectable ? () => _selectPlan(plan) : null,
      child: InkWell(
        excludeFromSemantics: true,
        onTap: selectable ? () => _selectPlan(plan) : null,
        borderRadius: BorderRadius.circular(20),
        child: ExcludeSemantics(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: colors.glassMedium,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: current ? colors.accent : colors.glassMediumBorder,
                width: current ? 2 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        plan.name,
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    if (current)
                      Text('CURRENT', style: TextStyle(color: colors.accent)),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  plan.requiresContact
                      ? 'Contact sales'
                      : plan.comingSoon
                      ? 'Coming soon'
                      : '${plan.priceLabel(_period)} /${_period == 'yearly' ? 'year' : 'month'}',
                  style: TextStyle(
                    color: colors.accent,
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  plan.productLimit == null
                      ? 'Unlimited products'
                      : '${plan.productLimit} products',
                  style: TextStyle(color: colors.textPrimary),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: plan.features
                      .take(3)
                      .map((f) => Chip(label: Text(f)))
                      .toList(),
                ),
                if (plan.features.length > 3)
                  Text(
                    'Review all ${plan.features.length} features',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
              ],
            ),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 200.ms);
  }
}
