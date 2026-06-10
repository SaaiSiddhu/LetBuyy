import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../services/subscription_service.dart';
import 'razorpay_checkout_screen.dart';

import '../../models/store_model.dart';
import '../../theme/app_theme_colors.dart';

/// Modern Pricing Page with all 4 subscription plans
/// Dark theme with glassmorphism, matching dashboard aesthetic
class PricingScreen extends StatefulWidget {
  const PricingScreen({super.key});

  @override
  State<PricingScreen> createState() => _PricingScreenState();
}

class _PricingScreenState extends State<PricingScreen> {
  SubscriptionPlan? _selectedPlan;
  StoreModel? _store;
  bool _isLoading = true;
  bool _isProcessing = false;
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadStore();
  }

  Future<void> _loadStore() async {
    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      setState(() {
        _store = store;
        _selectedPlan = store?.subscriptionPlan ?? SubscriptionPlan.trial;
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _selectPlan(SubscriptionPlan plan) async {
    if (_store == null || _isProcessing) return;
    if (plan == _store!.subscriptionPlan) return;

    setState(() => _isProcessing = true);
    HapticFeedback.mediumImpact();

    try {
      final subscriptionService = context.read<SubscriptionService>();

      if (plan == SubscriptionPlan.trial) {
        await subscriptionService.createSubscription(
          storeId: _store!.id,
          plan: plan,
        );
        _showSuccessDialog(plan);
      } else {
        // Show payment modal for paid plans
        _showPaymentModal(plan);
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  void _showSuccessDialog(SubscriptionPlan plan) {
    final planInfo = SubscriptionService.getPlanInfo(plan);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Text(planInfo['badge'], style: const TextStyle(fontSize: 28)),
            const SizedBox(width: 12),
            Text(
              'Welcome to ${planInfo['name']}!',
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        content: Text(
          'Your plan has been activated. Enjoy your new features!',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: Text(
              'Got it',
              style: TextStyle(color: Color(planInfo['color'] as int)),
            ),
          ),
        ],
      ),
    );
  }

  void _showPaymentModal(SubscriptionPlan plan) {
    final planInfo = SubscriptionService.getPlanInfo(plan);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              planInfo['badge'] as String,
              style: const TextStyle(fontSize: 48),
            ),
            const SizedBox(height: 16),
            Text(
              'Upgrade to ${planInfo['name']}',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  planInfo['priceLabel'] as String,
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.bold,
                    color: Color(planInfo['color'] as int),
                  ),
                ),
                Text(
                  planInfo['period'] as String,
                  style: TextStyle(fontSize: 16, color: colors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: (planInfo['features'] as List<String>)
                    .take(4)
                    .map(
                      (f) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Icon(
                              Icons.check_circle,
                              color: Color(planInfo['color'] as int),
                              size: 18,
                            ),
                            const SizedBox(width: 12),
                            Text(
                              f,
                              style: TextStyle(color: colors.textPrimary),
                            ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _initiatePayment(plan);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Color(planInfo['color'] as int),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Text(
                        'Continue to Payment',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Cancel anytime • Secure payment via Razorpay',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _initiatePayment(SubscriptionPlan plan) async {
    if (_store == null || _isProcessing) return;

    setState(() => _isProcessing = true);
    try {
      final subscriptionService = context.read<SubscriptionService>();
      final checkout = await subscriptionService.createSubscriptionOrder(
        storeId: _store!.id,
        plan: plan,
      );

      if (checkout['activated'] == true) {
        _showSuccessDialog(plan);
        return;
      }

      final verified = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => RazorpayCheckoutScreen(
            storeId: _store!.id,
            plan: plan,
            checkout: checkout,
          ),
        ),
      );

      if (!mounted) return;
      if (verified == true) {
        _showSuccessDialog(plan);
      } else if (verified == false) {
        _showError('Razorpay checkout did not complete.');
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red[700],
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          _buildCurrentPlanBanner(),
          const SizedBox(height: 24),
          ...SubscriptionPlan.values.map(
            (plan) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: _buildPlanCard(plan),
            ),
          ),
          const SizedBox(height: 24),
          _buildFAQ(),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Icon(Icons.arrow_back_ios, color: colors.textPrimary),
              ),
              const Spacer(),
              Text(
                'Choose Your Plan',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: colors.textPrimary,
                ),
              ),
              const Spacer(),
              const SizedBox(width: 48),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Scale your business with the right plan',
            style: TextStyle(fontSize: 14, color: colors.textSecondary),
          ),
        ],
      ).animate().fadeIn(duration: 300.ms),
    );
  }

  Widget _buildCurrentPlanBanner() {
    if (_store == null) return const SizedBox.shrink();

    final currentPlan = _store!.subscriptionPlan ?? SubscriptionPlan.trial;
    final planInfo = SubscriptionService.getPlanInfo(currentPlan);
    final daysLeft = _store!.daysLeftInTrial;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(planInfo['color'] as int).withValues(alpha: 0.2),
            Color(planInfo['color'] as int).withValues(alpha: 0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Color(planInfo['color'] as int).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Text(
            planInfo['badge'] as String,
            style: const TextStyle(fontSize: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Current: ${planInfo['name']}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                if (currentPlan == SubscriptionPlan.trial && daysLeft > 0)
                  Text(
                    '$daysLeft days remaining',
                    style: TextStyle(
                      fontSize: 12,
                      color: daysLeft <= 5
                          ? Colors.orange[300]
                          : colors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Color(planInfo['color'] as int),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'ACTIVE',
              style: TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1);
  }

  Widget _buildPlanCard(SubscriptionPlan plan) {
    final planInfo = SubscriptionService.getPlanInfo(plan);
    final isCurrentPlan = _store?.subscriptionPlan == plan;
    final isPopular = planInfo['isPopular'] == true;
    final color = Color(planInfo['color'] as int);

    return GestureDetector(
      onTap: isCurrentPlan ? null : () => _selectPlan(plan),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: colors.glassMedium,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isCurrentPlan
                ? color
                : isPopular
                ? color.withValues(alpha: 0.5)
                : colors.glassMediumBorder,
            width: isCurrentPlan || isPopular ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  planInfo['badge'] as String,
                  style: const TextStyle(fontSize: 24),
                ),
                const SizedBox(width: 12),
                Text(
                  planInfo['name'] as String,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                const Spacer(),
                if (isPopular)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'POPULAR',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                if (isCurrentPlan)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'CURRENT',
                      style: TextStyle(
                        color: color,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  planInfo['priceLabel'] as String,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
                Text(
                  planInfo['period'] as String,
                  style: TextStyle(fontSize: 14, color: colors.textSecondary),
                ),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      planInfo['productLimit'] == -1
                          ? 'Unlimited'
                          : '${planInfo['productLimit']} products',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: colors.textPrimary,
                      ),
                    ),
                    Text(
                      planInfo['commissionLabel'] as String? ??
                          '${planInfo['commission']}% commission',
                      style: TextStyle(
                        fontSize: 11,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: (planInfo['features'] as List<String>)
                  .take(3)
                  .map(
                    (f) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        f,
                        style: TextStyle(fontSize: 11, color: color),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    ).animate(delay: (100 + plan.index * 100).ms).fadeIn().slideX(begin: 0.1);
  }

  Widget _buildFAQ() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Frequently Asked',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _buildFAQItem(
            'Can I upgrade or downgrade anytime?',
            'Yes! You can change your plan anytime. Upgrades take effect immediately.',
          ),
          _buildFAQItem(
            'What happens when trial ends?',
            'Your store becomes read-only. Upgrade to any paid plan to continue.',
          ),
          _buildFAQItem(
            'Is there a setup fee?',
            'No setup fees. Pay only the monthly subscription.',
          ),
        ],
      ),
    ).animate(delay: 500.ms).fadeIn();
  }

  Widget _buildFAQItem(String question, String answer) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.glassMedium,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            answer,
            style: TextStyle(fontSize: 13, color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
