// lib/screens/settings/help_support_screen.dart
// 🆘 HELP & SUPPORT SCREEN

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../l10n/generated/app_localizations.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  final List<bool> _expanded = List.generate(8, (_) => false);

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
          AppLocalizations.of(context)?.helpSupport ?? 'Help & Support',
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
            _buildContactOptions(isDark),
            const SizedBox(height: 24),
            _buildSectionTitle('Frequently Asked Questions', isDark),
            const SizedBox(height: 16),
            ..._buildFAQList(isDark),
            const SizedBox(height: 24),
            _buildQuickLinks(isDark),
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
            child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 32),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'How can we help?',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'We\'re here to support you 24/7',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactOptions(bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _buildContactCard(
            Icons.email_rounded,
            'Email',
            'support@letbuyy.com',
            AppColors.primary,
            () => _launchEmail(),
            isDark,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildContactCard(
            Icons.phone_rounded,
            'Call Us',
            '1800-XXX-XXXX',
            AppColors.success,
            () => _launchPhone(),
            isDark,
          ),
        ),
      ],
    );
  }

  Widget _buildContactCard(IconData icon, String title, String subtitle, 
      Color color, VoidCallback onTap, bool isDark) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Text(
      title,
      style: TextStyle(
        color: isDark ? AppColors.textLight : AppColors.textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  List<Widget> _buildFAQList(bool isDark) {
    final faqs = [
      {'q': 'How do I add a new product?', 'a': 'Go to Products tab → Tap the + button → Fill in product details including name, price, description, and images → Submit for approval.'},
      {'q': 'When will I receive my payment?', 'a': 'Payments are processed every Monday for orders delivered in the previous week. Minimum payout is ₹500. Funds are transferred to your registered bank account within 2-3 business days.'},
      {'q': 'How can I track my orders?', 'a': 'Navigate to the Orders tab to see all your orders. Tap on any order to view detailed tracking information and update the status.'},
      {'q': 'What are the commission rates?', 'a': 'Commission varies by category, typically 5-15%. You can view the exact commission for each category in Settings → Commission Structure.'},
      {'q': 'How do I update my bank details?', 'a': 'Go to Settings → Bank Details → Update your information. Changes require re-verification and may take 24-48 hours to process.'},
      {'q': 'What if customer wants a return?', 'a': 'When a return is initiated, you\'ll receive a notification. Approve or reject within 48 hours. If approved, arrange pickup or provide return address.'},
      {'q': 'How to improve my seller rating?', 'a': 'Focus on: fast shipping, quality products, responsive communication, and accurate listings. Positive reviews boost your visibility.'},
      {'q': 'My KYC is rejected, what next?', 'a': 'Check the rejection reason in Settings → KYC Verification. Ensure documents are clear, valid, and match your registered details. Resubmit for review.'},
    ];

    return faqs.asMap().entries.map((entry) {
      final i = entry.key;
      final faq = entry.value;
      return _buildFAQItem(i, faq['q']!, faq['a']!, isDark);
    }).toList();
  }

  Widget _buildFAQItem(int index, String question, String answer, bool isDark) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _expanded[index] 
            ? AppColors.primary.withValues(alpha: 0.5)
            : (isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.help_outline_rounded, 
              color: AppColors.primary, size: 20),
          ),
          title: Text(
            question,
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          trailing: Icon(
            _expanded[index] ? Icons.remove : Icons.add,
            color: AppColors.primary,
          ),
          onExpansionChanged: (expanded) {
            setState(() => _expanded[index] = expanded);
          },
          children: [
            Text(
              answer,
              style: TextStyle(
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickLinks(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surfaceVariant,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick Links',
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 16),
          _buildQuickLink(Icons.description_rounded, 'Seller Guidelines', isDark),
          _buildQuickLink(Icons.video_library_rounded, 'Video Tutorials', isDark),
          _buildQuickLink(Icons.article_rounded, 'Blog & Updates', isDark),
          _buildQuickLink(Icons.group_rounded, 'Seller Community', isDark),
        ],
      ),
    );
  }

  Widget _buildQuickLink(IconData icon, String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          Text(
            title,
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontSize: 14,
            ),
          ),
          const Spacer(),
          Icon(
            Icons.arrow_forward_ios_rounded,
            color: isDark ? AppColors.textLightHint : AppColors.textHint,
            size: 14,
          ),
        ],
      ),
    );
  }

  void _launchEmail() async {
    final uri = Uri.parse('mailto:support@letbuyy.com?subject=Seller Support Request');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _launchPhone() async {
    final uri = Uri.parse('tel:1800XXXXXXX');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
