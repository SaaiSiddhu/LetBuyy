// lib/screens/settings/terms_screen.dart
// 📜 TERMS & CONDITIONS SCREEN

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../l10n/generated/app_localizations.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded,
              color: isDark ? AppColors.textLight : AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          AppLocalizations.of(context)?.termsConditions ?? 'Terms & Conditions',
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),

      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(isDark),
            const SizedBox(height: 24),
            _buildSection('1. Acceptance of Terms', _acceptance, isDark),
            _buildSection('2. Seller Eligibility', _eligibility, isDark),
            _buildSection('3. Seller Obligations', _obligations, isDark),
            _buildSection('4. Product Listings', _listings, isDark),
            _buildSection('5. Payments & Fees', _payments, isDark),
            _buildSection('6. Order Fulfillment', _fulfillment, isDark),
            _buildSection('7. Prohibited Items', _prohibited, isDark),
            _buildSection('8. Account Termination', _termination, isDark),
            _buildSection('9. Limitation of Liability', _liability, isDark),
            _buildSection('10. Updates to Terms', _updates, isDark),
            const SizedBox(height: 32),
            _buildFooter(isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.gavel_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Seller Agreement',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Last updated: December 2024',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, String content, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            content,
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 14,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(bool isDark) {
    return Center(
      child: Column(
        children: [
          Icon(
            Icons.verified_user_rounded,
            color: AppColors.primary,
            size: 40,
          ),
          const SizedBox(height: 12),
          Text(
            'By using LetBuyy Seller, you agree to these terms.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  // Content
  static const _acceptance = '''
By registering as a seller on LetBuyy, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our platform.''';

  static const _eligibility = '''
To become a seller, you must:
• Be at least 18 years old
• Have a valid PAN card and bank account
• Complete KYC verification
• Provide accurate business information
• Have legal authority to sell your products''';

  static const _obligations = '''
As a seller, you agree to:
• Provide accurate product information
• Maintain adequate inventory
• Ship orders within the promised timeframe
• Respond to customer queries within 24 hours
• Comply with all applicable laws and regulations''';

  static const _listings = '''
Product listings must:
• Have accurate descriptions and images
• Display correct pricing and availability
• Not infringe on any trademarks or copyrights
• Comply with our content guidelines
• Be updated regularly for accuracy''';

  static const _payments = '''
• Commission fees will be deducted from each sale
• Payments are processed weekly to your registered bank account
• Minimum payout threshold: ₹500
• GST and other taxes are the seller's responsibility
• Refunds may be deducted from future payouts''';

  static const _fulfillment = '''
• Orders must be shipped within 2 business days
• Accurate tracking information must be provided
• Proper packaging is mandatory
• Delivery timelines must be honored
• Returns must be processed within 7 days''';

  static const _prohibited = '''
The following items are prohibited:
• Counterfeit or replica products
• Illegal substances or weapons
• Adult content
• Hazardous materials
• Items that violate intellectual property''';

  static const _termination = '''
We reserve the right to suspend or terminate your account for:
• Violation of these terms
• Fraudulent activity
• Poor seller performance
• Customer complaints
• Failure to complete KYC''';

  static const _liability = '''
LetBuyy is not liable for:
• Loss of business or profits
• Product defects or quality issues
• Shipping damages or delays
• Third-party claims
• Force majeure events''';

  static const _updates = '''
We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify you of significant changes via email.''';
}
