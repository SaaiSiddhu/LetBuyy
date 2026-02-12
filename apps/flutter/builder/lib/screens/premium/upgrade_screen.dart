import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Upgrade to Premium Screen
class UpgradeScreen extends StatelessWidget {
  const UpgradeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Header
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.amber[400]!, Colors.amber[600]!],
                ),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.workspace_premium,
                size: 40,
                color: Colors.white,
              ),
            ).animate().fadeIn().scale(
              begin: const Offset(0.8, 0.8),
              duration: 400.ms,
            ),
            
            const SizedBox(height: 24),
            
            const Text(
              'Upgrade to Premium',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ).animate(delay: 100.ms).fadeIn().slideY(begin: 0.3),
            
            const SizedBox(height: 8),
            
            Text(
              'Unlock all features and grow your business',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 16,
              ),
              textAlign: TextAlign.center,
            ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.3),
            
            const SizedBox(height: 32),
            
            // Plans
            _buildPlanCard(
              context,
              title: 'Monthly',
              price: '₹499',
              period: '/month',
              isPopular: false,
            ).animate(delay: 300.ms).fadeIn().slideX(begin: -0.2),
            
            const SizedBox(height: 16),
            
            _buildPlanCard(
              context,
              title: 'Yearly',
              price: '₹4,999',
              period: '/year',
              savings: 'Save ₹989',
              isPopular: true,
            ).animate(delay: 400.ms).fadeIn().slideX(begin: 0.2),
            
            const SizedBox(height: 32),
            
            // Features
            const Text(
              'Premium Features',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ).animate(delay: 500.ms).fadeIn(),
            
            const SizedBox(height: 16),
            
            _buildFeatureItem(Icons.store, 'Up to 5 stores'),
            _buildFeatureItem(Icons.palette, 'All premium themes'),
            _buildFeatureItem(Icons.language, 'Custom domain support'),
            _buildFeatureItem(Icons.analytics, 'Advanced analytics'),
            _buildFeatureItem(Icons.hide_source, 'Remove LetBuyy branding'),
            _buildFeatureItem(Icons.support_agent, 'Priority support'),
            _buildFeatureItem(Icons.font_download, 'Custom font upload'),
            _buildFeatureItem(Icons.search, 'SEO tools'),
            
            const SizedBox(height: 32),
            
            // CTA Button
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () {
                  _showPaymentDialog(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber[600],
                  foregroundColor: Colors.white,
                ),
                child: const Text(
                  'Subscribe Now',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ).animate(delay: 600.ms).fadeIn().slideY(begin: 0.3),
            
            const SizedBox(height: 16),
            
            Text(
              'Cancel anytime. No questions asked.',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard(
    BuildContext context, {
    required String title,
    required String price,
    required String period,
    String? savings,
    required bool isPopular,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isPopular ? AppColors.primary.withValues(alpha: 0.1) : Colors.grey[50],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPopular ? AppColors.primary : Colors.grey[200]!,
          width: isPopular ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (isPopular) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'POPULAR',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (savings != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    savings,
                    style: TextStyle(
                      color: Colors.green[600],
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                price,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: isPopular ? AppColors.primary : Colors.black87,
                ),
              ),
              Text(
                period,
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Radio<bool>(
            value: isPopular,
            groupValue: true,
            onChanged: (_) {},
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureItem(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: Colors.green[50],
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.check,
              size: 16,
              color: Colors.green[600],
            ),
          ),
          const SizedBox(width: 12),
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 8),
          Text(
            text,
            style: const TextStyle(fontSize: 15),
          ),
        ],
      ),
    );
  }

  void _showPaymentDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Payment'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.payment,
                    size: 48,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Razorpay Integration',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Payment gateway will be connected here',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 12,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Integrate Razorpay
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Razorpay integration coming soon!'),
                ),
              );
            },
            child: const Text('Proceed'),
          ),
        ],
      ),
    );
  }
}
