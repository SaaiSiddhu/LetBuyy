import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../providers/seller_provider.dart';

class AdWalletScreen extends StatefulWidget {
  const AdWalletScreen({super.key});

  @override
  State<AdWalletScreen> createState() => _AdWalletScreenState();
}

class _AdWalletScreenState extends State<AdWalletScreen> {
  final AdService _adService = AdService();
  
  AdWalletModel? _wallet;
  List<AdWalletTransaction> _transactions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
    if (sellerId == null) return;

    setState(() => _isLoading = true);

    try {
      _wallet = await _adService.getOrCreateAdWallet(sellerId);
      
      // Get transactions
      final transStream = _adService.getWalletTransactions(sellerId);
      _transactions = await transStream.first;
    } catch (e) {
      debugPrint('Error loading wallet: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded,
              color: isDark ? Colors.white : const Color(0xFF111827)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Ads Wallet',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBalanceCard(isDark),
                    const SizedBox(height: 20),
                    _buildQuickActions(isDark),
                    const SizedBox(height: 24),
                    _buildStatsRow(isDark),
                    const SizedBox(height: 24),
                    _buildTransactionsSection(isDark),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildBalanceCard(bool isDark) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFF6366F1),
                const Color(0xFF8B5CF6),
                const Color(0xFFA855F7),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6366F1).withValues(alpha: 0.4),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Available Balance',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.account_balance_wallet_rounded, 
                            color: Colors.white, size: 14),
                        SizedBox(width: 4),
                        Text(
                          'ADS',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '₹${_wallet?.balance.toStringAsFixed(2) ?? '0.00'}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -2,
                    ),
                  ),
                  if (_wallet != null && _wallet!.isLowBalance)
                    Container(
                      margin: const EdgeInsets.only(left: 12, bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.warning_rounded, color: Colors.orange, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'LOW',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Colors.orange,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.info_outline_rounded, 
                      color: Colors.white54, size: 14),
                  const SizedBox(width: 6),
                  Text(
                    'Only for sponsored ads • ₹0.5 per click',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn().slideY(begin: -0.1);
  }

  Widget _buildQuickActions(bool isDark) {
    return Row(
      children: [
        Expanded(
          child: _buildActionButton(
            icon: Icons.add_rounded,
            label: 'Top Up',
            color: const Color(0xFF10B981),
            onTap: () => _showTopUpDialog(),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildActionButton(
            icon: Icons.swap_horiz_rounded,
            label: 'Transfer',
            color: const Color(0xFF3B82F6),
            onTap: () => _showTransferDialog(),
          ),
        ),
      ],
    ).animate().fadeIn(delay: 100.ms);
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow(bool isDark) {
    return Row(
      children: [
        _buildStatItem('Total Top-ups', '₹${_wallet?.totalTopUp.toStringAsFixed(0) ?? '0'}', isDark),
        const SizedBox(width: 12),
        _buildStatItem('Total Spent', '₹${_wallet?.totalSpent.toStringAsFixed(0) ?? '0'}', isDark),
        const SizedBox(width: 12),
        _buildStatItem('Transferred', '₹${_wallet?.totalTransferredIn.toStringAsFixed(0) ?? '0'}', isDark),
      ],
    ).animate().fadeIn(delay: 150.ms);
  }

  Widget _buildStatItem(String label, String value, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionsSection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent Transactions',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),
        if (_transactions.isEmpty)
          Container(
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.receipt_long_outlined, 
                      size: 40, color: Colors.grey.withValues(alpha: 0.5)),
                  const SizedBox(height: 12),
                  Text(
                    'No transactions yet',
                    style: TextStyle(
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _transactions.length,
            itemBuilder: (context, index) {
              final tx = _transactions[index];
              return _buildTransactionItem(tx, isDark, index);
            },
          ),
      ],
    );
  }

  Widget _buildTransactionItem(AdWalletTransaction tx, bool isDark, int index) {
    final isCredit = tx.isCredit;
    final color = isCredit ? const Color(0xFF10B981) : const Color(0xFFEF4444);
    
    final icons = {
      AdWalletTransactionType.topUp: Icons.add_circle_rounded,
      AdWalletTransactionType.transferIn: Icons.swap_horiz_rounded,
      AdWalletTransactionType.adSpend: Icons.campaign_rounded,
      AdWalletTransactionType.refund: Icons.replay_rounded,
      AdWalletTransactionType.adjustment: Icons.tune_rounded,
    };

    final labels = {
      AdWalletTransactionType.topUp: 'Top Up',
      AdWalletTransactionType.transferIn: 'Transfer In',
      AdWalletTransactionType.adSpend: 'Ad Click',
      AdWalletTransactionType.refund: 'Refund',
      AdWalletTransactionType.adjustment: 'Adjustment',
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icons[tx.type], color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  labels[tx.type] ?? 'Transaction',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF111827),
                  ),
                ),
                if (tx.description != null)
                  Text(
                    tx.description!,
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : '-'}₹${tx.amount.toStringAsFixed(2)}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
              Text(
                _formatDate(tx.createdAt),
                style: TextStyle(
                  fontSize: 10,
                  color: isDark ? Colors.grey[600] : Colors.grey[500],
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate(delay: (30 * index).ms).fadeIn().slideX(begin: 0.1);
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  void _showTopUpDialog() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Payment integration coming soon')),
    );
  }

  void _showTransferDialog() {
    final controller = TextEditingController();
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
    
    if (sellerId == null) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _TransferSheet(
        sellerId: sellerId,
        adService: _adService,
        currentAdBalance: _wallet?.balance ?? 0,
        onTransferComplete: () {
          _loadData();
        },
      ),
    );
  }
}

/// Enhanced Transfer Bottom Sheet with Balance Display
class _TransferSheet extends StatefulWidget {
  final String sellerId;
  final AdService adService;
  final double currentAdBalance;
  final VoidCallback onTransferComplete;

  const _TransferSheet({
    required this.sellerId,
    required this.adService,
    required this.currentAdBalance,
    required this.onTransferComplete,
  });

  @override
  State<_TransferSheet> createState() => _TransferSheetState();
}

class _TransferSheetState extends State<_TransferSheet> {
  final TextEditingController _controller = TextEditingController();
  double _mainBalance = 0;
  bool _isLoading = true;
  bool _isTransferring = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadMainBalance();
  }

  Future<void> _loadMainBalance() async {
    final balance = await widget.adService.getMainWalletBalance(widget.sellerId);
    if (mounted) {
      setState(() {
        _mainBalance = balance;
        _isLoading = false;
      });
    }
  }

  void _setAmount(double amount) {
    _controller.text = amount.toStringAsFixed(0);
    setState(() => _errorMessage = null);
  }

  Future<void> _transfer() async {
    final amount = double.tryParse(_controller.text);
    if (amount == null || amount <= 0) {
      setState(() => _errorMessage = 'Enter valid amount');
      return;
    }

    if (amount > _mainBalance) {
      setState(() => _errorMessage = 'Insufficient balance');
      return;
    }

    setState(() {
      _isTransferring = true;
      _errorMessage = null;
    });

    final result = await widget.adService.transferFromMainWallet(
      sellerId: widget.sellerId,
      amount: amount,
    );

    if (mounted) {
      if (result['success'] == true) {
        Navigator.pop(context);
        widget.onTransferComplete();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ ${result['message']}'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        setState(() {
          _isTransferring = false;
          _errorMessage = result['message'] ?? 'Transfer failed';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final quickAmounts = [100.0, 500.0, 1000.0, 2000.0];

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: _isLoading
          ? const SizedBox(
              height: 200,
              child: Center(child: CircularProgressIndicator()),
            )
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.swap_horiz_rounded, 
                            color: Color(0xFF3B82F6), size: 24),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Transfer to Ads Wallet',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : const Color(0xFF111827),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Main Wallet Balance Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF10B981).withValues(alpha: 0.1),
                          const Color(0xFF059669).withValues(alpha: 0.05),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.account_balance_wallet_rounded, 
                              color: Color(0xFF10B981), size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Available in Main Wallet',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark ? Colors.grey[400] : Colors.grey[600],
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '₹${_mainBalance.toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: isDark ? Colors.white : const Color(0xFF111827),
                                ),
                              ),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: _mainBalance > 0 ? () => _setAmount(_mainBalance) : null,
                          child: const Text('MAX', style: TextStyle(fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Quick Amount Buttons
                  Text(
                    'Quick Select',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: quickAmounts.map((amt) {
                      final canAfford = _mainBalance >= amt;
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: amt != quickAmounts.last ? 8 : 0),
                          child: GestureDetector(
                            onTap: canAfford ? () => _setAmount(amt) : null,
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: canAfford
                                    ? const Color(0xFF3B82F6).withValues(alpha: 0.1)
                                    : (isDark ? Colors.grey[800] : Colors.grey[200]),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: canAfford 
                                      ? const Color(0xFF3B82F6).withValues(alpha: 0.3)
                                      : Colors.transparent,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  '₹${amt.toInt()}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: canAfford
                                        ? const Color(0xFF3B82F6)
                                        : (isDark ? Colors.grey[600] : Colors.grey[400]),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // Amount Input
                  TextField(
                    controller: _controller,
                    keyboardType: TextInputType.number,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                    decoration: InputDecoration(
                      prefixText: '₹ ',
                      prefixStyle: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : const Color(0xFF111827),
                      ),
                      hintText: '0',
                      hintStyle: TextStyle(color: Colors.grey[500]),
                      errorText: _errorMessage,
                      filled: true,
                      fillColor: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none,
                      ),
                    ),
                    onChanged: (_) => setState(() => _errorMessage = null),
                  ),
                  const SizedBox(height: 24),

                  // Transfer Button
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isTransferring ? null : _transfer,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        disabledBackgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.5),
                      ),
                      child: _isTransferring
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation(Colors.white),
                              ),
                            )
                          : const Text(
                              'Transfer Now',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                            ),
                    ),
                  ),
                  SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
                ],
              ),
            ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
