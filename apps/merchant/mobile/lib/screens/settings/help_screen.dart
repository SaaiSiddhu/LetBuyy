import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Help and support screen
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Help & Support'),
        backgroundColor: AppColors.background,
        surfaceTintColor: AppColors.background,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Contact card
          _buildContactCard(context),
          const SizedBox(height: 24),

          // FAQs
          const Text(
            'Frequently Asked Questions',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
          const SizedBox(height: 12),
          ..._faqs.map(
            (faq) => _FaqTile(question: faq['q']!, answer: faq['a']!),
          ),
          const SizedBox(height: 24),

          // Links
          const Text(
            'Resources',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
          const SizedBox(height: 12),
          _buildLinkTile(
            context,
            icon: Icons.menu_book_rounded,
            title: 'Documentation',
            subtitle: 'Learn how to use LetBuyy Store',
            url: 'https://docs.letbuyy.com',
          ),
          _buildLinkTile(
            context,
            icon: Icons.video_library_rounded,
            title: 'Video Tutorials',
            subtitle: 'Watch step-by-step guides',
            url: 'https://youtube.com/letbuyy',
          ),
          _buildLinkTile(
            context,
            icon: Icons.policy_rounded,
            title: 'Terms of Service',
            subtitle: 'Read our terms and conditions',
            url: 'https://letbuyy.com/terms',
          ),
          _buildLinkTile(
            context,
            icon: Icons.privacy_tip_rounded,
            title: 'Privacy Policy',
            subtitle: 'How we handle your data',
            url: 'https://letbuyy.com/privacy',
          ),
        ],
      ),
    );
  }

  Widget _buildContactCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.support_agent_rounded, color: Colors.white, size: 28),
              SizedBox(width: 12),
              Text(
                'Need Help?',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Contact the LetBuyy support team for help with your store',
            style: TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _launchEmail(context),
            icon: const Icon(Icons.email_rounded, size: 18),
            label: const Text('Email support'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLinkTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required String url,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: Theme.of(context).colorScheme.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.primary, size: 20),
        ),
        title: Text(title),
        subtitle: Text(
          subtitle,
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
        trailing: const Icon(Icons.open_in_new_rounded, size: 18),
        onTap: () => _launchUrl(context, url),
      ),
    );
  }

  Future<void> _launchUrl(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchEmail(BuildContext context) async {
    final uri = Uri.parse(
      'mailto:support@letbuyy.com?subject=LetBuyy Store Support',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  static const _faqs = [
    {
      'q': 'How do I publish my store?',
      'a':
          'Go to the Home tab and toggle the Publish switch. Your store will be published at your subdomain within seconds.',
    },
    {
      'q': 'How do I add products to my store?',
      'a':
          'Open Products and tap Add to create a product, or tap an existing product to edit it.',
    },
    {
      'q': 'Can I use my own domain?',
      'a':
          'Open More > Domain Settings to check eligibility and configure your domain.',
    },
    {
      'q': 'How do I customize my store theme?',
      'a':
          'Open Home > Customize Design to choose a theme and edit its settings.',
    },
    {
      'q': 'How do I add sections to my store?',
      'a':
          'Open Customize Design, choose your theme, and use the theme editor to manage its supported sections.',
    },
  ];
}

class _FaqTile extends StatefulWidget {
  final String question;
  final String answer;

  const _FaqTile({required this.question, required this.answer});

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: Theme.of(context).colorScheme.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Text(
            widget.question,
            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
          ),
          trailing: Icon(
            _isExpanded
                ? Icons.keyboard_arrow_up_rounded
                : Icons.keyboard_arrow_down_rounded,
            color: AppColors.primary,
          ),
          onExpansionChanged: (expanded) {
            setState(() => _isExpanded = expanded);
          },
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                widget.answer,
                style: TextStyle(fontSize: 13, color: Colors.grey[600]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
