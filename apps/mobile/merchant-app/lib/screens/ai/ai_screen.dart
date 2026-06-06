import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/ai_studio_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class AiScreen extends StatefulWidget {
  const AiScreen({super.key});

  @override
  State<AiScreen> createState() => _AiScreenState();
}

class _AiScreenState extends State<AiScreen> {
  AiCreditsContract? _credits;
  List<AiUsageContract> _usage = const [];
  String? _storeId;
  String? _error;
  bool _isLoading = true;
  bool _isBusy = false;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??= (await context.read<StoreService>().getFirstStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _credits = null;
            _usage = const [];
            _isLoading = false;
          });
        }
        return;
      }

      final snapshot = await context.read<AiStudioService>().fetchStudio(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _credits = snapshot.credits;
          _usage = snapshot.usage;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Expanded(child: _isLoading ? _loading() : _body()),
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
                  'AI Studio',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Credits, tools, and usage',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Buy credits',
            icon: Icon(Icons.add_card_outlined, color: colors.textSecondary),
            onPressed: _storeId == null ? null : _purchaseCredits,
          ),
          IconButton(
            tooltip: 'Refresh AI Studio',
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
        'Could not load AI Studio',
        _error!,
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _creditSummary(),
          const SizedBox(height: 14),
          _sectionTitle('AI tools'),
          const SizedBox(height: 8),
          ...AiStudioService.tools.map(_toolCard),
          const SizedBox(height: 14),
          _sectionTitle('Recent usage'),
          const SizedBox(height: 8),
          if (_usage.isEmpty) _emptyUsage() else ..._usage.map(_usageTile),
        ],
      ),
    );
  }

  Widget _creditSummary() {
    final credits = _credits;
    final remaining = credits?.balance ?? 0;
    final used = credits?.totalUsed ?? 0;
    final total = credits?.totalCredits ?? 0;
    final percent = credits?.percentUsed ?? 0;

    return Container(
      padding: const EdgeInsets.all(14),
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
              _metric('Credits remaining', remaining.toStringAsFixed(0)),
              const SizedBox(width: 10),
              _metric('Credits used', used.toStringAsFixed(0)),
              const SizedBox(width: 10),
              _metric('Generations', _usage.length.toString()),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: total <= 0 ? 0 : (used / total).clamp(0, 1).toDouble(),
              minHeight: 8,
              color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              backgroundColor: colors.surfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$percent% used',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: colors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String value) {
    return Text(
      value,
      style: TextStyle(
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: FontWeight.w800,
      ),
    );
  }

  Widget _toolCard(AiToolContract tool) {
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
          CircleAvatar(
            backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                .withValues(alpha: 0.12),
            child: Icon(
              _iconFor(tool.iconName),
              color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              tool.label,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          FilledButton.tonalIcon(
            onPressed: _isBusy ? null : () => _showGenerateSheet(tool),
            icon: const Icon(Icons.auto_awesome_outlined, size: 18),
            label: const Text('Generate'),
          ),
        ],
      ),
    );
  }

  Widget _usageTile(AiUsageContract item) {
    final failed = item.status == 'failed';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
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
              Expanded(
                child: Text(
                  item.featureLabel,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _statusPill(item.status, failed ? colors.error : colors.success),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            item.prompt,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _miniMeta(Icons.token_outlined, '${item.totalTokens} tokens'),
              const SizedBox(width: 8),
              _miniMeta(
                Icons.bolt_outlined,
                '${item.creditsUsed.toStringAsFixed(0)} credits',
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Rate positive',
                onPressed: () => _rate(item, 5),
                icon: Icon(Icons.thumb_up_alt_outlined, color: colors.success),
              ),
              IconButton(
                tooltip: 'Rate negative',
                onPressed: () => _rate(item, 1),
                icon: Icon(Icons.thumb_down_alt_outlined, color: colors.error),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusPill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _miniMeta(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: colors.textSecondary),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }

  Widget _emptyUsage() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: _centerState(
        Icons.auto_awesome_outlined,
        'No AI usage yet',
        'Generated content will appear here.',
        compact: true,
      ),
    );
  }

  Future<void> _showGenerateSheet(AiToolContract tool) async {
    final storeId = _storeId;
    if (storeId == null) return;
    final promptController = TextEditingController();
    final prompt = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tool.label,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: promptController,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Prompt',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => Navigator.pop(context, promptController.text),
                icon: const Icon(Icons.auto_awesome_outlined),
                label: const Text('Generate'),
              ),
            ],
          ),
        );
      },
    );
    promptController.dispose();

    if (prompt == null || prompt.trim().isEmpty) return;
    setState(() => _isBusy = true);
    try {
      await context.read<AiStudioService>().generateContent(
        storeId: storeId,
        feature: tool.feature,
        prompt: prompt,
      );
    } catch (error) {
      _showSnack(error.toString());
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<void> _purchaseCredits() async {
    final storeId = _storeId;
    if (storeId == null) return;
    try {
      await context.read<AiStudioService>().purchaseCredits(
        storeId: storeId,
        amount: 100,
      );
    } catch (error) {
      _showSnack(error.toString());
    }
  }

  Future<void> _rate(AiUsageContract item, int rating) async {
    try {
      final updated = await context.read<AiStudioService>().rateUsage(
        item,
        rating: rating,
      );
      if (mounted) {
        setState(() {
          _usage = _usage
              .map((usage) => usage.id == updated.id ? updated : usage)
              .toList(growable: false);
        });
        _showSnack('Rating saved.');
      }
    } catch (error) {
      _showSnack('Could not save rating: $error');
    }
  }

  IconData _iconFor(String iconName) {
    return switch (iconName) {
      'description' => Icons.description_outlined,
      'seo' => Icons.search_outlined,
      'blog' => Icons.edit_note_outlined,
      'share' => Icons.share_outlined,
      'email' => Icons.mail_outline_rounded,
      'campaign' => Icons.campaign_outlined,
      _ => Icons.auto_awesome_outlined,
    };
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(
    IconData icon,
    String title,
    String message, {
    bool compact = false,
  }) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? 4 : 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: compact ? 34 : 44),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}
