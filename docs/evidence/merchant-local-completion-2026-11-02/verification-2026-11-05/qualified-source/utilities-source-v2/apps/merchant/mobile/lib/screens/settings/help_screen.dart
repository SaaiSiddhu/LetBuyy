import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Support resources retain their existing native app/browser ownership.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});
  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  Object? _opening;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Leaving this route retires a held native check even if the person returns
    // before it finishes. It never authorizes a delayed external launch.
    if (ModalRoute.of(context)?.isCurrent != true) _opening = null;
  }

  bool _alive(Object operation, BuildContext origin) =>
      mounted &&
      identical(_opening, operation) &&
      isLetbuyySurfaceCurrent(origin);

  Future<void> _openResource(
    BuildContext origin,
    Uri uri, {
    required LaunchMode mode,
  }) async {
    if (!mounted || _opening != null || !isLetbuyySurfaceCurrent(origin))
      return;
    final operation = Object();
    setState(() => _opening = operation);
    void unavailable() {
      if (!_alive(operation, origin)) return;
      showLetbuyyOperationFeedback(
        origin,
        message:
            'Could not open this resource. Check your device apps and try again.',
        isError: true,
      );
    }

    try {
      final supported = await canLaunchUrl(uri);
      if (!_alive(operation, origin)) return;
      if (!supported) {
        unavailable();
        return;
      }
      final opened = await launchUrl(uri, mode: mode);
      if (!opened) unavailable();
    } catch (_) {
      unavailable();
    } finally {
      if (mounted && identical(_opening, operation)) {
        setState(() => _opening = null);
      }
    }
  }

  Future<void> _launchUrl(BuildContext context, String url) => _openResource(
    context,
    Uri.parse(url),
    mode: LaunchMode.externalApplication,
  );

  Future<void> _launchEmail(BuildContext context) => _openResource(
    context,
    Uri.parse('mailto:support@letbuyy.com?subject=LetBuyy Store Support'),
    mode: LaunchMode.platformDefault,
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: CustomAppBar.responsive(context: context, title: 'Help & Support'),
    body: SafeArea(
      top: false,
      child: Column(
        children: [
          if (_opening != null)
              Semantics(
              label: 'Opening support resource',
              liveRegion: true,
                child: const LinearProgressIndicator(),
            ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
              children: [
                _buildContactCard(context),
                const SizedBox(height: LetbuyySpacingTokens.space24),
                Text(
                  'Frequently Asked Questions',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: LetbuyySpacingTokens.space12),
                ..._faqs.map(
                  (faq) => _FaqTile(question: faq['q']!, answer: faq['a']!),
                ),
                const SizedBox(height: LetbuyySpacingTokens.space24),
                Text(
                  'Resources',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: LetbuyySpacingTokens.space12),
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
          ),
        ],
      ),
    ),
  );

  Widget _buildContactCard(BuildContext context) {
    final theme = Theme.of(context), scheme = theme.colorScheme;
    return Card(
      color: scheme.primaryContainer,
      child: Padding(
        padding: const EdgeInsets.all(LetbuyySpacingTokens.space20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                ExcludeSemantics(
                  child: Icon(
                    Icons.support_agent_rounded,
                    color: scheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: LetbuyySpacingTokens.space12),
                Expanded(
                  child: Text(
                    'Need Help?',
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: scheme.onPrimaryContainer,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: LetbuyySpacingTokens.space8),
            Text(
              'Contact the LetBuyy support team for help with your store',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onPrimaryContainer,
              ),
            ),
            const SizedBox(height: LetbuyySpacingTokens.space16),
            FilledButton.icon(
              onPressed: _opening == null ? () => _launchEmail(context) : null,
              icon: const Icon(Icons.email_rounded),
              label: const Text('Email support'),
            ),
          ],
        ),
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
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: LetbuyySpacingTokens.space8),
      child: ListTile(
        leading: ExcludeSemantics(
          child: Icon(icon, color: theme.colorScheme.primary),
        ),
        title: Text(title, style: theme.textTheme.titleMedium),
        subtitle: Text(subtitle, style: theme.textTheme.bodyMedium),
        trailing: const Icon(Icons.open_in_new_rounded),
        onTap: _opening == null ? () => _launchUrl(context, url) : null,
      ),
    );
  }

  static const _faqs = [
    {
      'q': 'How do I publish my store?',
      'a':
          'Open Home and use the Publish control. Review the saved visibility and storefront before sharing your address.',
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
            style: Theme.of(context).textTheme.titleSmall,
          ),
          trailing: Icon(
            _isExpanded
                ? Icons.keyboard_arrow_up_rounded
                : Icons.keyboard_arrow_down_rounded,
            color: Theme.of(context).colorScheme.primary,
          ),
          onExpansionChanged: (expanded) {
            setState(() => _isExpanded = expanded);
          },
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                widget.answer,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
