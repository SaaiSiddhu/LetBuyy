import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/product_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;

class GiftCardsScreen extends StatefulWidget {
  const GiftCardsScreen({super.key});

  @override
  State<GiftCardsScreen> createState() => _GiftCardsScreenState();
}

class _GiftCardsScreenState extends State<GiftCardsScreen> {
  List<GiftCardContract> _cards = const [];
  String? _storeId;
  String? _error;
  bool _isLoading = true;

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
      _storeId ??=
          (await context.read<StoreContext>().ensureSelectedStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _cards = const [];
            _isLoading = false;
          });
        }
        return;
      }

      final cards = await context.read<ProductService>().fetchGiftCards(
        _storeId!,
      );
      if (mounted) {
        setState(() {
          _cards = cards;
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

  double get _totalBalance => _cards.fold(0, (sum, card) => sum + card.balance);

  int get _activeCount => _cards.where((card) => card.isActive).length;

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _storeId == null ? null : _issueGiftCard,
        backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.card_giftcard_outlined),
        label: const Text('Issue card'),
      ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              _stats(),
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
                  'Gift Cards',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Balances, issuance, and expiry',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh gift cards',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _stats() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _metric(
              'Cards',
              _cards.length.toString(),
              Icons.card_giftcard_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Active',
              _activeCount.toString(),
              Icons.toggle_on_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Balance',
              'INR ${_totalBalance.toStringAsFixed(2)}',
              Icons.account_balance_wallet_outlined,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            size: 18,
          ),
          const SizedBox(height: 8),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(color: colors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load gift cards',
        _error!,
      );
    }
    if (_cards.isEmpty) {
      return RefreshIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
          children: [
            _centerState(
              Icons.card_giftcard_outlined,
              'No gift cards',
              'Issue a gift card for customer goodwill or refunds.',
              compact: true,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        itemCount: _cards.length,
        itemBuilder: (context, index) => _cardTile(_cards[index]),
      ),
    );
  }

  Widget _cardTile(GiftCardContract card) {
    final tone = card.isActive ? colors.success : colors.textTertiary;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
              CircleAvatar(
                backgroundColor: tone.withValues(alpha: 0.12),
                child: Icon(Icons.card_giftcard_outlined, color: tone),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.code.isEmpty ? card.id : card.code,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Issued ${card.initialValueLabel}',
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _statusChip(_titleCase(card.status), tone),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _detailChip(card.balanceLabel, Icons.payments_outlined),
              if (card.expiresAt.isNotEmpty)
                _detailChip('Expires ${card.expiresAt}', Icons.event_outlined),
              if (card.createdAt.isNotEmpty)
                _detailChip('Created ${card.createdAt}', Icons.history),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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

  Widget _detailChip(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
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
        padding: EdgeInsets.all(compact ? 0 : 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 42),
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

  Future<void> _issueGiftCard() async {
    final amountController = TextEditingController(text: '500');
    final expiresController = TextEditingController();
    final input = await showDialog<GiftCardInput>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Issue gift card'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: amountController,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Initial value',
                  prefixText: 'INR ',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: expiresController,
                decoration: const InputDecoration(
                  labelText: 'Expiry ISO date (optional)',
                  hintText: '2026-12-31T23:59:59.000Z',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final amount = double.tryParse(amountController.text.trim());
                if (amount == null || amount <= 0 || _storeId == null) {
                  Navigator.pop(context);
                  return;
                }
                Navigator.pop(
                  context,
                  GiftCardInput(
                    storeId: _storeId!,
                    initialValue: amount,
                    expiresAt: expiresController.text.trim().isEmpty
                        ? null
                        : expiresController.text.trim(),
                  ),
                );
              },
              child: const Text('Issue'),
            ),
          ],
        );
      },
    );
    amountController.dispose();
    expiresController.dispose();
    if (input == null) return;

    try {
      final card = await context.read<ProductService>().issueGiftCard(input);
      setState(() => _cards = [card, ..._cards]);
      _showSnack('Gift card issued.');
    } catch (error) {
      _showSnack('Could not issue gift card: $error');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: colors.snackbarBackground,
      ),
    );
  }

  String _titleCase(String value) {
    if (value.isEmpty) return value;
    return '${value[0].toUpperCase()}${value.substring(1)}';
  }
}
