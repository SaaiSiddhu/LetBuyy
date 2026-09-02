// lib/screens/payouts/admin_payouts_dashboard.dart
// 💰 ADMIN PAYOUT MANAGEMENT DASHBOARD
// Production-grade payout processing with stats, filters, and batch actions

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:flutter_animate/flutter_animate.dart';

class AdminPayoutsDashboard extends StatefulWidget {
  const AdminPayoutsDashboard({super.key});

  @override
  State<AdminPayoutsDashboard> createState() => _AdminPayoutsDashboardState();
}

class _AdminPayoutsDashboardState extends State<AdminPayoutsDashboard> with SingleTickerProviderStateMixin {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;
  final _currencyFormat = NumberFormat('#,##,###', 'en_IN');
  
  late TabController _tabController;
  
  String _selectedStatus = 'all';
  String _selectedType = 'all';
  String _searchQuery = '';
  final _searchController = TextEditingController();
  
  bool _isProcessingBatch = false;
  final Set<String> _selectedPayouts = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isMobile = MediaQuery.of(context).size.width < 768;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: _buildAppBar(isDark),
      body: Column(
        children: [
          // Stats Cards
          _buildStatsSection(isDark, isMobile),
          
          // Filters & Search
          _buildFiltersSection(isDark),
          
          // Tab Bar
          _buildTabBar(isDark),
          
          // Payout List
          Expanded(
            child: _buildPayoutsList(isDark, isMobile),
          ),
        ],
      ),
      floatingActionButton: _selectedPayouts.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: _showBatchActionsSheet,
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.checklist_rounded),
              label: Text('${_selectedPayouts.length} Selected'),
            )
          : null,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // APP BAR
  // ═══════════════════════════════════════════════════════════════════════
  
  PreferredSizeWidget _buildAppBar(bool isDark) {
    return AppBar(
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
      elevation: 0,
      title: Text(
        'Payout Management',
        style: AppTextStyles.headlineSmall.copyWith(
          color: isDark ? AppColors.textLight : AppColors.textPrimary,
          fontWeight: FontWeight.w800,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.download_rounded),
          tooltip: 'Export Report',
          onPressed: _exportReport,
        ),
        IconButton(
          icon: const Icon(Icons.refresh_rounded),
          tooltip: 'Refresh',
          onPressed: () => setState(() {}),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATS SECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildStatsSection(bool isDark, bool isMobile) {
    return StreamBuilder<QuerySnapshot>(
      stream: _firestore.collection('payout_requests').snapshots(),
      builder: (context, snapshot) {
        int totalPending = 0;
        int totalProcessing = 0;
        int totalCompleted = 0;
        int totalFailed = 0;
        double pendingAmount = 0;
        double processingAmount = 0;
        double completedAmount = 0;
        
        if (snapshot.hasData) {
          for (final doc in snapshot.data!.docs) {
            final data = doc.data() as Map<String, dynamic>;
            final status = data['status'] ?? '';
            final amount = (data['amount'] ?? 0).toDouble();
            
            switch (status) {
              case 'pending':
                totalPending++;
                pendingAmount += amount;
                break;
              case 'processing':
                totalProcessing++;
                processingAmount += amount;
                break;
              case 'completed':
                totalCompleted++;
                completedAmount += amount;
                break;
              case 'failed':
                totalFailed++;
                break;
            }
          }
        }

        return Container(
          padding: const EdgeInsets.all(16),
          child: isMobile
              ? Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: _buildStatCard(
                          'Pending', totalPending, pendingAmount,
                          Icons.schedule_rounded, AppColors.warning, isDark,
                        )),
                        const SizedBox(width: 12),
                        Expanded(child: _buildStatCard(
                          'Processing', totalProcessing, processingAmount,
                          Icons.sync_rounded, AppColors.info, isDark,
                        )),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(child: _buildStatCard(
                          'Completed', totalCompleted, completedAmount,
                          Icons.check_circle_rounded, AppColors.success, isDark,
                        )),
                        const SizedBox(width: 12),
                        Expanded(child: _buildStatCard(
                          'Failed', totalFailed, 0,
                          Icons.error_rounded, AppColors.error, isDark,
                          showAmount: false,
                        )),
                      ],
                    ),
                  ],
                )
              : Row(
                  children: [
                    Expanded(child: _buildStatCard(
                      'Pending', totalPending, pendingAmount,
                      Icons.schedule_rounded, AppColors.warning, isDark,
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: _buildStatCard(
                      'Processing', totalProcessing, processingAmount,
                      Icons.sync_rounded, AppColors.info, isDark,
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: _buildStatCard(
                      'Completed', totalCompleted, completedAmount,
                      Icons.check_circle_rounded, AppColors.success, isDark,
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: _buildStatCard(
                      'Failed', totalFailed, 0,
                      Icons.error_rounded, AppColors.error, isDark,
                      showAmount: false,
                    )),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildStatCard(
    String label, int count, double amount,
    IconData icon, Color color, bool isDark, {
    bool showAmount = true,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              Text(
                count.toString(),
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
          if (showAmount) ...[
            const SizedBox(height: 4),
            Text(
              '₹${_currencyFormat.format(amount)}',
              style: TextStyle(
                color: color,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTERS SECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildFiltersSection(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          // Search
          Expanded(
            flex: 2,
            child: TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _searchQuery = value),
              decoration: InputDecoration(
                hintText: 'Search by seller name...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.borderDark : AppColors.border,
                  ),
                ),
                filled: true,
                fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 12),
          
          // Type Filter
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.border,
              ),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedType,
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All Types')),
                  DropdownMenuItem(value: 'manual', child: Text('Manual')),
                  DropdownMenuItem(value: 'auto', child: Text('Auto')),
                ],
                onChanged: (value) => setState(() => _selectedType = value ?? 'all'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TAB BAR
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildTabBar(bool isDark) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        onTap: (index) {
          setState(() {
            switch (index) {
              case 0:
                _selectedStatus = 'all';
                break;
              case 1:
                _selectedStatus = 'pending';
                break;
              case 2:
                _selectedStatus = 'processing';
                break;
              case 3:
                _selectedStatus = 'completed';
                break;
              case 4:
                _selectedStatus = 'failed';
                break;
            }
          });
        },
        indicatorColor: AppColors.primary,
        indicatorWeight: 3,
        labelColor: AppColors.primary,
        unselectedLabelColor: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        tabs: const [
          Tab(text: 'All'),
          Tab(text: 'Pending'),
          Tab(text: 'Processing'),
          Tab(text: 'Completed'),
          Tab(text: 'Failed'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAYOUTS LIST
  // ═══════════════════════════════════════════════════════════════════════
  
  Widget _buildPayoutsList(bool isDark, bool isMobile) {
    Query<Map<String, dynamic>> query = _firestore
        .collection('payout_requests')
        .orderBy('createdAt', descending: true);
    
    if (_selectedStatus != 'all') {
      query = query.where('status', isEqualTo: _selectedStatus);
    }
    
    if (_selectedType != 'all') {
      query = query.where('type', isEqualTo: _selectedType);
    }

    return StreamBuilder<QuerySnapshot>(
      stream: query.snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
          return _buildEmptyState(isDark);
        }

        var docs = snapshot.data!.docs;
        
        // Apply search filter
        if (_searchQuery.isNotEmpty) {
          docs = docs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final sellerName = (data['sellerName'] ?? '').toString().toLowerCase();
            final storeName = (data['storeName'] ?? '').toString().toLowerCase();
            final query = _searchQuery.toLowerCase();
            return sellerName.contains(query) || storeName.contains(query);
          }).toList();
        }

        if (docs.isEmpty) {
          return _buildEmptyState(isDark);
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: docs.length,
          itemBuilder: (context, index) {
            final doc = docs[index];
            final data = doc.data() as Map<String, dynamic>;
            return _buildPayoutCard(doc.id, data, isDark, isMobile);
          },
        );
      },
    );
  }

  Widget _buildPayoutCard(String id, Map<String, dynamic> data, bool isDark, bool isMobile) {
    final isSelected = _selectedPayouts.contains(id);
    final status = data['status'] ?? 'pending';
    final type = data['type'] ?? 'manual';
    final amount = (data['amount'] ?? 0).toDouble();
    final sellerName = data['sellerName'] ?? 'Unknown';
    final storeName = data['storeName'] ?? '';
    final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
    final bankDetails = data['bankDetails'] as Map<String, dynamic>?;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected 
              ? AppColors.primary 
              : (isDark ? AppColors.borderDark : AppColors.border),
          width: isSelected ? 2 : 1,
        ),
      ),
      child: Column(
        children: [
          // Header Row
          Row(
            children: [
              // Checkbox
              Checkbox(
                value: isSelected,
                onChanged: (value) {
                  setState(() {
                    if (value == true) {
                      _selectedPayouts.add(id);
                    } else {
                      _selectedPayouts.remove(id);
                    }
                  });
                },
                activeColor: AppColors.primary,
              ),
              
              // Type Icon
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: (type == 'manual' ? AppColors.info : AppColors.warning).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  type == 'manual' ? Icons.account_balance_rounded : Icons.autorenew_rounded,
                  color: type == 'manual' ? AppColors.info : AppColors.warning,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              
              // Seller Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      storeName.isNotEmpty ? storeName : sellerName,
                      style: TextStyle(
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      sellerName,
                      style: TextStyle(
                        color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Amount
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '₹${_currencyFormat.format(amount)}',
                    style: TextStyle(
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  _buildStatusBadge(status),
                ],
              ),
            ],
          ),
          
          // Divider
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(
              color: isDark ? AppColors.borderDark : AppColors.border,
              height: 1,
            ),
          ),
          
          // Details Row
          Row(
            children: [
              // Bank Info
              if (bankDetails != null) ...[
                Icon(
                  Icons.account_balance_outlined,
                  size: 14,
                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Text(
                  '${bankDetails['bankName'] ?? 'Bank'} • ${_maskAccount(bankDetails['accountNumber'])}',
                  style: TextStyle(
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(width: 16),
              ],
              
              // Date
              Icon(
                Icons.schedule_rounded,
                size: 14,
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
              Text(
                createdAt != null 
                    ? DateFormat('dd MMM, hh:mm a').format(createdAt)
                    : 'Unknown',
                style: TextStyle(
                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              
              const Spacer(),
              
              // Actions
              if (status == 'pending') ...[
                TextButton(
                  onPressed: () => _processPayoutAction(id, 'approve'),
                  child: const Text('Process'),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => _processPayoutAction(id, 'hold'),
                  style: TextButton.styleFrom(foregroundColor: AppColors.warning),
                  child: const Text('Hold'),
                ),
              ] else if (status == 'processing') ...[
                TextButton(
                  onPressed: () => _showCompleteDialog(id, amount),
                  style: TextButton.styleFrom(foregroundColor: AppColors.success),
                  child: const Text('Complete'),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: () => _showFailDialog(id),
                  style: TextButton.styleFrom(foregroundColor: AppColors.error),
                  child: const Text('Fail'),
                ),
              ],
              IconButton(
                icon: const Icon(Icons.visibility_rounded, size: 18),
                onPressed: () => _showPayoutDetails(id, data),
                tooltip: 'View Details',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String label;
    
    switch (status) {
      case 'pending':
        color = AppColors.warning;
        label = 'Pending';
        break;
      case 'processing':
        color = AppColors.info;
        label = 'Processing';
        break;
      case 'completed':
        color = AppColors.success;
        label = 'Completed';
        break;
      case 'failed':
        color = AppColors.error;
        label = 'Failed';
        break;
      case 'onHold':
        color = AppColors.textSecondary;
        label = 'On Hold';
        break;
      default:
        color = AppColors.textHint;
        label = status;
    }

    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  String _maskAccount(String? account) {
    if (account == null || account.length < 4) return 'XXXX';
    return 'XXXX${account.substring(account.length - 4)}';
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.payments_outlined,
            size: 64,
            color: isDark ? AppColors.textLightHint : AppColors.textHint,
          ),
          const SizedBox(height: 16),
          Text(
            'No payouts found',
            style: TextStyle(
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Payout requests will appear here',
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  Future<void> _processPayoutAction(String payoutId, String action) async {
    try {
      final callable = _functions.httpsCallable('adminProcessPayout');
      await callable.call({
        'payoutRequestId': payoutId,
        'action': action,
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Payout $action successfully'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _showCompleteDialog(String payoutId, double amount) {
    final utrController = TextEditingController();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        title: Text(
          'Complete Payout',
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Amount: ₹${_currencyFormat.format(amount)}',
              style: TextStyle(
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: utrController,
              decoration: InputDecoration(
                labelText: 'UTR Number (Optional)',
                hintText: 'Enter bank reference number',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
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
            onPressed: () async {
              Navigator.pop(context);
              try {
                final callable = _functions.httpsCallable('adminProcessPayout');
                await callable.call({
                  'payoutRequestId': payoutId,
                  'action': 'complete',
                  'utrNumber': utrController.text.isNotEmpty ? utrController.text : null,
                });
                
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('✅ Payout completed successfully!'),
                      backgroundColor: AppColors.success,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: $e'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.success,
            ),
            child: const Text('Mark Complete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showFailDialog(String payoutId) {
    final reasonController = TextEditingController();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        title: Text(
          'Mark as Failed',
          style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
        ),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: 'Failure Reason',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              final callable = _functions.httpsCallable('adminProcessPayout');
              await callable.call({
                'payoutRequestId': payoutId,
                'action': 'fail',
                'failureReason': reasonController.text.isNotEmpty 
                    ? reasonController.text 
                    : 'Bank transfer failed',
              });
              
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Payout marked as failed'),
                    backgroundColor: AppColors.error,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Mark Failed'),
          ),
        ],
      ),
    );
  }

  void _showPayoutDetails(String id, Map<String, dynamic> data) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scrollController) {
          final bankDetails = data['bankDetails'] as Map<String, dynamic>?;
          final createdAt = (data['createdAt'] as Timestamp?)?.toDate();
          final processedAt = (data['processedAt'] as Timestamp?)?.toDate();
          final completedAt = (data['completedAt'] as Timestamp?)?.toDate();
          
          return ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(24),
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.borderDark : AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              
              Text(
                'Payout Details',
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 20),
              
              _buildDetailRow('ID', id, isDark),
              _buildDetailRow('Seller', data['sellerName'] ?? 'Unknown', isDark),
              _buildDetailRow('Store', data['storeName'] ?? 'N/A', isDark),
              _buildDetailRow('Amount', '₹${_currencyFormat.format(data['amount'] ?? 0)}', isDark),
              _buildDetailRow('Type', data['type'] == 'manual' ? 'Manual' : 'Auto', isDark),
              _buildDetailRow('Status', data['status'] ?? 'Unknown', isDark),
              
              if (bankDetails != null) ...[
                const SizedBox(height: 16),
                Text(
                  'Bank Details',
                  style: TextStyle(
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                _buildDetailRow('Bank', bankDetails['bankName'] ?? 'N/A', isDark),
                _buildDetailRow('Account', _maskAccount(bankDetails['accountNumber']), isDark),
                _buildDetailRow('IFSC', bankDetails['ifscCode'] ?? 'N/A', isDark),
                _buildDetailRow('Holder', bankDetails['accountHolderName'] ?? 'N/A', isDark),
              ],
              
              const SizedBox(height: 16),
              Text(
                'Timeline',
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              if (createdAt != null)
                _buildDetailRow('Created', DateFormat('dd MMM yyyy, hh:mm a').format(createdAt), isDark),
              if (processedAt != null)
                _buildDetailRow('Processed', DateFormat('dd MMM yyyy, hh:mm a').format(processedAt), isDark),
              if (completedAt != null)
                _buildDetailRow('Completed', DateFormat('dd MMM yyyy, hh:mm a').format(completedAt), isDark),
              
              if (data['utrNumber'] != null)
                _buildDetailRow('UTR', data['utrNumber'], isDark),
              if (data['failureReason'] != null)
                _buildDetailRow('Failure Reason', data['failureReason'], isDark),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontWeight: FontWeight.w500,
                fontSize: 13,
              ),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }

  void _showBatchActionsSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Batch Actions (${_selectedPayouts.length} selected)',
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 20),
            
            ListTile(
              leading: const Icon(Icons.play_circle_rounded, color: AppColors.info),
              title: const Text('Process All'),
              subtitle: const Text('Start processing selected payouts'),
              onTap: () async {
                Navigator.pop(context);
                await _processBatchAction('approve');
              },
            ),
            ListTile(
              leading: const Icon(Icons.check_circle_rounded, color: AppColors.success),
              title: const Text('Mark All Complete'),
              subtitle: const Text('Mark selected as completed'),
              onTap: () async {
                Navigator.pop(context);
                await _processBatchAction('complete');
              },
            ),
            ListTile(
              leading: const Icon(Icons.pause_circle_rounded, color: AppColors.warning),
              title: const Text('Hold All'),
              subtitle: const Text('Put selected on hold'),
              onTap: () async {
                Navigator.pop(context);
                await _processBatchAction('hold');
              },
            ),
            ListTile(
              leading: const Icon(Icons.deselect_rounded),
              title: const Text('Clear Selection'),
              onTap: () {
                Navigator.pop(context);
                setState(() => _selectedPayouts.clear());
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _processBatchAction(String action) async {
    setState(() => _isProcessingBatch = true);
    
    int success = 0;
    int failed = 0;
    
    for (final payoutId in _selectedPayouts) {
      try {
        final callable = _functions.httpsCallable('adminProcessPayout');
        await callable.call({
          'payoutRequestId': payoutId,
          'action': action,
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    
    if (mounted) {
      setState(() {
        _isProcessingBatch = false;
        _selectedPayouts.clear();
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Processed: $success success, $failed failed'),
          backgroundColor: failed == 0 ? AppColors.success : AppColors.warning,
        ),
      );
    }
  }

  void _exportReport() {
    // TODO: Implement export functionality
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Export feature coming soon'),
      ),
    );
  }
}
