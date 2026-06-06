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
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          ..._faqs.map((faq) => _FaqTile(
            question: faq['q']!,
            answer: faq['a']!,
          )),
          const SizedBox(height: 24),

          // Links
          const Text(
            'Resources',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _buildLinkTile(
            context,
            icon: Icons.menu_book_rounded,
            title: 'Documentation',
            subtitle: 'Learn how to use LetBuyy Store',
            url: 'https://docs.letbuyy.store',
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
            url: 'https://letbuyy.store/terms',
          ),
          _buildLinkTile(
            context,
            icon: Icons.privacy_tip_rounded,
            title: 'Privacy Policy',
            subtitle: 'How we handle your data',
            url: 'https://letbuyy.store/privacy',
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
          colors: [
            AppColors.primary,
            AppColors.primaryLight,
          ],
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
            'Our support team is available 24/7 to help you',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _launchWhatsApp(context),
                  icon: const Icon(Icons.chat_rounded, size: 18),
                  label: const Text('Chat'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _launchEmail(context),
                  icon: const Icon(Icons.email_rounded, size: 18),
                  label: const Text('Email'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ],
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
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
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

  Future<void> _launchWhatsApp(BuildContext context) async {
    final uri = Uri.parse('https://wa.me/919876543210?text=Hi, I need help with LetBuyy Store');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _launchEmail(BuildContext context) async {
    final uri = Uri.parse('mailto:support@letbuyy.store?subject=LetBuyy Store Support');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  static const _faqs = [
    {
      'q': 'How do I publish my store?',
      'a': 'Go to the Home tab and toggle the Publish switch. Your store will be live at your subdomain within seconds.',
    },
    {
      'q': 'How do I add products to my store?',
      'a': 'Go to the Products tab, search for your products, and tap to select which ones to show on your store.',
    },
    {
      'q': 'Can I use my own domain?',
      'a': 'Yes! Premium users can connect a custom domain. Go to Settings > Domain Settings to set it up.',
    },
    {
      'q': 'How do I customize my store theme?',
      'a': 'Go to the Theme tab to choose a preset theme or customize colors and fonts.',
    },
    {
      'q': 'How do I add sections to my store?',
      'a': 'Go to the Editor tab and tap "Add Section" to choose from 13 different section types.',
    },
  ];
}

class _FaqTile extends StatefulWidget {
  final String question;
  final String answer;

  const _FaqTile({
    required this.question,
    required this.answer,
  });

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Text(
            widget.question,
            style: const TextStyle(
              fontWeight: FontWeight.w500,
              fontSize: 14,
            ),
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
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey[600],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
