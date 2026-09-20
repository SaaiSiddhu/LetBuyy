// lib/screens/settings/privacy_screen.dart
// 🔒 PRIVACY POLICY SCREEN

import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../l10n/generated/app_localizations.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

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
          AppLocalizations.of(context)?.privacyPolicy ?? 'Privacy Policy',
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
            _buildSection('Information We Collect', _collect, Icons.folder_rounded, isDark),
            _buildSection('How We Use Your Data', _usage, Icons.analytics_rounded, isDark),
            _buildSection('Data Sharing', _sharing, Icons.share_rounded, isDark),
            _buildSection('Data Security', _security, Icons.security_rounded, isDark),
            _buildSection('Your Rights', _rights, Icons.person_rounded, isDark),
            _buildSection('Cookies & Tracking', _cookies, Icons.cookie_rounded, isDark),
            _buildSection('Data Retention', _retention, Icons.schedule_rounded, isDark),
            _buildSection('Contact Us', _contact, Icons.contact_mail_rounded, isDark),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.secondary, AppColors.secondaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
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
            child: const Icon(Icons.privacy_tip_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your Privacy Matters',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Effective: December 2024',
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

  Widget _buildSection(String title, String content, IconData icon, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
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

  // Content
  static const _collect = '''
We collect the following information:
• Personal details: Name, email, phone number
• Business information: Store name, address, GSTIN
• KYC documents: PAN, Aadhaar, selfie
• Financial data: Bank account details
• Device information: IP address, device type
• Usage data: App activity, preferences''';

  static const _usage = '''
Your data is used to:
• Verify your identity and business
• Process orders and payments
• Improve our services
• Send important notifications
• Prevent fraud and abuse
• Comply with legal requirements''';

  static const _sharing = '''
We may share your data with:
• Payment processors for transactions
• Logistics partners for deliveries
• Government authorities when required by law
• Service providers who assist our operations

We never sell your personal data to third parties.''';

  static const _security = '''
We protect your data through:
• 256-bit SSL encryption
• Secure data centers
• Regular security audits
• Access controls and authentication
• Employee training on data protection''';

  static const _rights = '''
You have the right to:
• Access your personal data
• Correct inaccurate information
• Delete your account and data
• Export your data
• Opt-out of marketing communications
• Lodge complaints with authorities''';

  static const _cookies = '''
We use cookies and similar technologies to:
• Remember your preferences
• Analyze app usage patterns
• Improve user experience
• Secure your sessions

You can manage cookie preferences in your device settings.''';

  static const _retention = '''
We retain your data:
• Account data: Until you delete your account
• Transaction records: 7 years (legal requirement)
• KYC documents: 5 years after account closure
• Analytics data: 2 years anonymized''';

  static const _contact = '''
For privacy-related queries:

📧 Email: privacy@letbuyy.com
📞 Phone: 1800-XXX-XXXX
📍 Address: LetBuyy Technologies Pvt. Ltd.
    Chennai, Tamil Nadu, India

Data Protection Officer: dpo@letbuyy.com''';
}
