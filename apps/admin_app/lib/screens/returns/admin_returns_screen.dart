// apps/admin/lib/screens/returns/admin_returns_screen.dart
// 🔧 ADMIN RETURNS MANAGEMENT
// View all returns, override decisions, manage policies
// ✅ UPDATED: Theme-consistent UI matching other admin screens

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import '../../app/themes/app_colors.dart';

class AdminReturnsScreen extends StatefulWidget {
  const AdminReturnsScreen({super.key});

  @override
  State<AdminReturnsScreen> createState() => _AdminReturnsScreenState();
}

class _AdminReturnsScreenState extends State<AdminReturnsScreen>
    with SingleTickerProviderStateMixin {
  final ReturnService _returnService = ReturnService();
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  
  String _searchQuery = '';
  ReturnStatus? _statusFilter;
  
  // Bulk selection
  bool _isSelectionMode = false;
  final Set<String> _selectedIds = {};
  
  // Advanced filters
  DateTimeRange? _dateRange;
  String? _sellerFilter;
  final String _sortBy = 'newest'; // newest, oldest, amount_high, amount_low, priority
  
  // Priority thresholds (in days)
  static const int _urgentDays = 3;
  static const int _highPriorityDays = 5;

  final List<String> _tabs = ['All', 'Pending', 'In Progress', 'Completed', 'Disputed'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: Stack(
        children: [
          Column(
            children: [
              // Stats Cards
              _buildStatsCards(isDark, accentColor),
              
              // Search & Filters
              _buildSearchAndFilters(isDark, accentColor),
              
              // Tab Bar
              _buildTabBar(isDark, accentColor),
              
              // Returns Table/List
              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildReturnsTable(null, isDark, accentColor),
                    _buildReturnsTable(ReturnStatus.requested, isDark, accentColor),
                    _buildReturnsTable(null, isDark, accentColor, inProgress: true),
                    _buildReturnsTable(null, isDark, accentColor, completed: true),
                    _buildReturnsTable(null, isDark, accentColor, disputed: true),
                  ],
                ),
              ),
            ],
          ),
          
          // Bulk Action Bar (appears when items selected)
          if (_isSelectionMode)
            Positioned(
              left: 16, right: 16, bottom: 24,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black26,
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                  border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    // Selection count
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${_selectedIds.length} selected',
                        style: TextStyle(
                          color: accentColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const Spacer(),
                    // Clear button
                    TextButton.icon(
                      onPressed: _clearSelection,
                      icon: Icon(Icons.close, size: 18, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                      label: Text('Clear', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
                    ),
                    const SizedBox(width: 8),
                    // Actions button
                    ElevatedButton.icon(
                      onPressed: () => _showBulkActionsSheet(isDark),
                      icon: const Icon(Icons.flash_on_rounded, size: 18),
                      label: const Text('Actions'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 200.ms).slideY(begin: 0.3, end: 0),
            ),
        ],
      ),
    );
  }

  Widget _buildStatsCards(bool isDark, Color accentColor) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _getGlobalStats(),
      builder: (context, snapshot) {
        final stats = snapshot.data ?? {};
        final isLoading = snapshot.connectionState == ConnectionState.waiting;

        return Container(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _buildStatCard(
                  'Total Returns',
                  '${stats['total'] ?? 0}',
                  Icons.assignment_return_rounded,
                  AppColors.info,
                  isDark,
                  isLoading,
                ),
                const SizedBox(width: 12),
                _buildStatCard(
                  'Pending Review',
                  '${stats['pending'] ?? 0}',
                  Icons.hourglass_top_rounded,
                  AppColors.pending,
                  isDark,
                  isLoading,
                ),
                const SizedBox(width: 12),
                _buildStatCard(
                  'In Progress',
                  '${stats['inProgress'] ?? 0}',
                  Icons.local_shipping_rounded,
                  AppColors.processing,
                  isDark,
                  isLoading,
                ),
                const SizedBox(width: 12),
                _buildStatCard(
                  'Refunded',
                  '₹${NumberFormat.compact().format(stats['totalRefundAmount'] ?? 0)}',
                  Icons.currency_rupee_rounded,
                  AppColors.success,
                  isDark,
                  isLoading,
                ),
                const SizedBox(width: 12),
                _buildStatCard(
                  'Rejected',
                  '${stats['rejected'] ?? 0}',
                  Icons.cancel_rounded,
                  AppColors.error,
                  isDark,
                  isLoading,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatCard(
    String label,
    String value,
    IconData icon,
    Color color,
    bool isDark,
    bool isLoading,
  ) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      constraints: const BoxConstraints(minWidth: 160),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: isLoading
          ? Shimmer.fromColors(
              baseColor: isDark ? AppColors.shimmerBaseDark : AppColors.shimmerBase,
              highlightColor: isDark ? AppColors.shimmerHighlightDark : AppColors.shimmerHighlight,
              child: Row(
                children: [
                  Container(width: 44, height: 44, decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  )),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(width: 50, height: 20, color: Colors.white),
                      const SizedBox(height: 4),
                      Container(width: 70, height: 14, color: Colors.white),
                    ],
                  ),
                ],
              ),
            )
          : Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 22),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      value,
                      style: TextStyle(
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: TextStyle(
                        color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _buildSearchAndFilters(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        children: [
          // Search Field
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _searchQuery = v),
            style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: 'Search by order ID, customer, product...',
              hintStyle: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint),
              prefixIcon: Icon(Icons.search, color: isDark ? AppColors.textLightHint : AppColors.textHint),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: Icon(Icons.clear, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              filled: true,
              fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: accentColor, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Filter Row - Responsive
          LayoutBuilder(
            builder: (context, constraints) {
              final isMobile = constraints.maxWidth < 500;
              
              if (isMobile) {
                // Mobile: Stack vertically
                return Column(
                  children: [
                    // Status Dropdown
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDark : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<ReturnStatus?>(
                          value: _statusFilter,
                          hint: Text(
                            'All Status',
                            style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                          ),
                          dropdownColor: isDark ? AppColors.surfaceDark : AppColors.surface,
                          icon: Icon(Icons.arrow_drop_down, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                          isExpanded: true,
                          items: [
                            DropdownMenuItem(
                              value: null,
                              child: Text('All Status', style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary)),
                            ),
                            ...ReturnStatus.values.map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(s.displayName, style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary)),
                            )),
                          ],
                          onChanged: (v) => setState(() => _statusFilter = v),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    // Action buttons - horizontal scroll
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _buildActionButton(
                            icon: Icons.refresh_rounded,
                            label: 'Refresh',
                            onTap: () => setState(() {}),
                            isDark: isDark,
                            color: accentColor,
                          ),
                          const SizedBox(width: 8),
                          _buildActionButton(
                            icon: Icons.download_rounded,
                            label: 'Export',
                            onTap: _exportReturns,
                            isDark: isDark,
                            color: AppColors.success,
                            isPrimary: true,
                          ),
                          const SizedBox(width: 8),
                          _buildActionButton(
                            icon: Icons.data_array_rounded,
                            label: 'Seed',
                            onTap: _seedDefaultReasons,
                            isDark: isDark,
                            color: AppColors.warning,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }
              
              // Desktop: Horizontal row
              return Row(
                children: [
                  // Status Dropdown
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDark : AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<ReturnStatus?>(
                          value: _statusFilter,
                          hint: Text(
                            'All Status',
                            style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                          ),
                          dropdownColor: isDark ? AppColors.surfaceDark : AppColors.surface,
                          icon: Icon(Icons.arrow_drop_down, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                          isExpanded: true,
                          items: [
                            DropdownMenuItem(
                              value: null,
                              child: Text('All Status', style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary)),
                            ),
                            ...ReturnStatus.values.map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(s.displayName, style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary)),
                            )),
                          ],
                          onChanged: (v) => setState(() => _statusFilter = v),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  _buildActionButton(
                    icon: Icons.refresh_rounded,
                    label: 'Refresh',
                    onTap: () => setState(() {}),
                    isDark: isDark,
                    color: accentColor,
                  ),
                  const SizedBox(width: 8),
                  _buildActionButton(
                    icon: Icons.download_rounded,
                    label: 'Export',
                    onTap: _exportReturns,
                    isDark: isDark,
                    color: AppColors.success,
                    isPrimary: true,
                  ),
                  const SizedBox(width: 8),
                  _buildActionButton(
                    icon: Icons.data_array_rounded,
                    label: 'Seed',
                    onTap: _seedDefaultReasons,
                    isDark: isDark,
                    color: AppColors.warning,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    required bool isDark,
    required Color color,
    bool isPrimary = false,
  }) {
    return Material(
      color: isPrimary ? color : (isDark ? AppColors.surfaceDark : AppColors.surface),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: isPrimary ? null : Border.all(
              color: isDark ? AppColors.borderDark : AppColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: isPrimary ? Colors.white : (isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isPrimary ? Colors.white : (isDark ? AppColors.textLight : AppColors.textPrimary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar(bool isDark, Color accentColor) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: accentColor,
          borderRadius: BorderRadius.circular(10),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: Colors.white,
        unselectedLabelColor: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
        dividerColor: Colors.transparent,
        indicatorPadding: const EdgeInsets.all(4),
        tabs: _tabs.map((t) => Tab(text: t)).toList(),
      ),
    );
  }

  Widget _buildReturnsTable(
    ReturnStatus? status,
    bool isDark,
    Color accentColor, {
    bool inProgress = false,
    bool completed = false,
    bool disputed = false,
  }) {
    return StreamBuilder<List<ReturnRequestModel>>(
      stream: _returnService.getAllReturns(statusFilter: status),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return _buildShimmerList(isDark);
        }

        var returns = snapshot.data ?? [];

        // Apply filters
        if (inProgress) {
          returns = returns.where((r) => [
            ReturnStatus.approved,
            ReturnStatus.pickupScheduled,
            ReturnStatus.pickupInProgress,
            ReturnStatus.pickupCompleted,
            ReturnStatus.refundInitiated,
          ].contains(r.status)).toList();
        }

        if (completed) {
          returns = returns.where((r) => r.isResolved).toList();
        }

        if (disputed) {
          returns = returns.where((r) =>
            r.status == ReturnStatus.qcFailed ||
            r.status == ReturnStatus.rejected).toList();
        }

        if (_searchQuery.isNotEmpty) {
          returns = returns.where((r) =>
            r.orderNumber.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            r.userName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            r.productName.toLowerCase().contains(_searchQuery.toLowerCase())
          ).toList();
        }

        if (returns.isEmpty) {
          return _buildEmptyState(isDark);
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: returns.length,
          itemBuilder: (context, index) {
            return _buildReturnCard(returns[index], index, isDark, accentColor);
          },
        );
      },
    );
  }

  Widget _buildShimmerList(bool isDark) {
    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.shimmerBaseDark : AppColors.shimmerBase,
      highlightColor: isDark ? AppColors.shimmerHighlightDark : AppColors.shimmerHighlight,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (_, __) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(width: 50, height: 50, decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(width: 150, height: 16, color: Colors.white),
                        const SizedBox(height: 6),
                        Container(width: 100, height: 12, color: Colors.white),
                      ],
                    ),
                  ),
                  Container(width: 80, height: 28, decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  )),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(width: 100, height: 14, color: Colors.white),
                  Container(width: 80, height: 14, color: Colors.white),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.inbox_rounded,
              size: 64,
              color: isDark ? AppColors.textLightDisabled : AppColors.textDisabled,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'No returns found',
            style: TextStyle(
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Returns will appear here once customers request them',
            style: TextStyle(
              color: isDark ? AppColors.textLightHint : AppColors.textHint,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReturnCard(ReturnRequestModel request, int index, bool isDark, Color accentColor) {
    final statusConfig = _getStatusConfig(request.status);
    final priorityInfo = _getPriorityInfo(request);
    final dateFormat = DateFormat('dd MMM yyyy');
    final isSelected = _selectedIds.contains(request.id);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isSelected 
            ? accentColor.withValues(alpha: 0.08)
            : (isDark ? AppColors.surfaceDark : AppColors.surface),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? accentColor : (isDark ? AppColors.borderDark : AppColors.border),
          width: isSelected ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _isSelectionMode 
              ? () => _toggleSelection(request.id)
              : () => _showDetailDialog(request, isDark, accentColor),
          onLongPress: () => _toggleSelection(request.id),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Row
                Row(
                  children: [
                    // Selection Checkbox (when in selection mode)
                    if (_isSelectionMode) ...[
                      Checkbox(
                        value: isSelected,
                        onChanged: (_) => _toggleSelection(request.id),
                        activeColor: accentColor,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    // Product Image with Priority Indicator
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            request.productImage ?? '',
                            width: 56,
                            height: 56,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                Icons.image_rounded,
                                size: 24,
                                color: isDark ? AppColors.textLightHint : AppColors.textHint,
                              ),
                            ),
                          ),
                        ),
                        // Priority indicator
                        if (priorityInfo['level'] != 'resolved' && priorityInfo['level'] != 'normal')
                          Positioned(
                            top: -4, right: -4,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: priorityInfo['color'],
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isDark ? AppColors.surfaceDark : AppColors.surface,
                                  width: 2,
                                ),
                              ),
                              child: Icon(
                                priorityInfo['icon'],
                                size: 10,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    // Product Info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            request.productName,
                            style: TextStyle(
                              color: isDark ? AppColors.textLight : AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(
                                Icons.receipt_long_rounded,
                                size: 14,
                                color: isDark ? AppColors.textLightHint : AppColors.textHint,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '#${request.orderNumber}',
                                style: TextStyle(
                                  color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Icon(
                                Icons.person_rounded,
                                size: 14,
                                color: isDark ? AppColors.textLightHint : AppColors.textHint,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  request.userName,
                                  style: TextStyle(
                                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Status Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: statusConfig['color'].withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: statusConfig['color'].withValues(alpha: 0.4),
                        ),
                      ),
                      child: Text(
                        request.status.displayName,
                        style: TextStyle(
                          color: statusConfig['color'],
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                // Footer Row
                Row(
                  children: [
                    // Type Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (request.type == ReturnType.refund ? AppColors.info : AppColors.primaryLight).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            request.type == ReturnType.refund ? Icons.currency_rupee_rounded : Icons.swap_horiz_rounded,
                            size: 14,
                            color: request.type == ReturnType.refund ? AppColors.info : AppColors.primaryLight,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            request.type.displayName,
                            style: TextStyle(
                              color: request.type == ReturnType.refund ? AppColors.info : AppColors.primaryLight,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Image Count Badge
                    if (request.customerImages.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.photo_camera_rounded, size: 12, color: accentColor),
                            const SizedBox(width: 4),
                            Text(
                              '${request.customerImages.length}',
                              style: TextStyle(
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(width: 12),
                    // Reason
                    Expanded(
                      child: Text(
                        request.reasonTitle,
                        style: TextStyle(
                          color: isDark ? AppColors.textLightHint : AppColors.textHint,
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    // Amount
                    Text(
                      '₹${NumberFormat('#,##,###').format(request.refundAmount)}',
                      style: TextStyle(
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Date
                    Text(
                      dateFormat.format(request.createdAt),
                      style: TextStyle(
                        color: isDark ? AppColors.textLightHint : AppColors.textHint,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate(delay: (index * 50).ms).fadeIn(duration: 300.ms).slideY(begin: 0.05, end: 0);
  }

  void _showDetailDialog(ReturnRequestModel request, bool isDark, Color accentColor) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Container(
          width: 600,
          constraints: const BoxConstraints(maxHeight: 700),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.assignment_return_rounded, color: accentColor, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Return Request Details',
                          style: TextStyle(
                            color: isDark ? AppColors.textLight : AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '#${request.orderNumber}',
                          style: TextStyle(
                            color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    IconButton(
                      icon: Icon(Icons.close, color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              // Content
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product Info
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              request.productImage ?? '',
                              width: 100,
                              height: 100,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 100,
                                height: 100,
                                decoration: BoxDecoration(
                                  color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(Icons.image, color: isDark ? AppColors.textLightHint : AppColors.textHint),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  request.productName,
                                  style: TextStyle(
                                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                _detailRow('Customer', request.userName, isDark),
                                _detailRow('Seller', request.sellerName, isDark),
                                _detailRow('Type', request.type.displayName, isDark),
                                _detailRow('Reason', request.reasonTitle, isDark),
                                _detailRow('Amount', '₹${NumberFormat('#,##,###').format(request.refundAmount)}', isDark),
                                _detailRow('Status', request.status.displayName, isDark),
                              ],
                            ),
                          ),
                        ],
                      ),

                      // Notes
                      if (request.customerNotes != null) ...[
                        const SizedBox(height: 16),
                        _buildNotesSection('Customer Notes', request.customerNotes!, isDark, Icons.person_rounded),
                      ],
                      if (request.adminNotes != null) ...[
                        const SizedBox(height: 12),
                        _buildNotesSection('Admin Notes', request.adminNotes!, isDark, Icons.admin_panel_settings_rounded),
                      ],

                      // Evidence Photos - Enhanced Gallery
                      if (request.customerImages.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Icon(
                              Icons.photo_library_rounded,
                              size: 18,
                              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Evidence Photos',
                              style: TextStyle(
                                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: accentColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '${request.customerImages.length}',
                                style: TextStyle(
                                  color: accentColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const Spacer(),
                            TextButton.icon(
                              onPressed: () => _showFullScreenImage(request.customerImages, 0, isDark),
                              icon: Icon(Icons.fullscreen_rounded, size: 16, color: accentColor),
                              label: Text('View All', style: TextStyle(fontSize: 12, color: accentColor)),
                              style: TextButton.styleFrom(padding: EdgeInsets.zero),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 100,
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: request.customerImages.length,
                            itemBuilder: (context, index) => GestureDetector(
                              onTap: () => _showFullScreenImage(request.customerImages, index, isDark),
                              child: Container(
                                margin: const EdgeInsets.only(right: 10),
                                width: 100,
                                height: 100,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isDark ? AppColors.borderDark : AppColors.border,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: isDark ? AppColors.shadowDark : AppColors.shadowLight,
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Stack(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(11),
                                      child: Image.network(
                                        request.customerImages[index],
                                        width: 100,
                                        height: 100,
                                        fit: BoxFit.cover,
                                        loadingBuilder: (_, child, progress) {
                                          if (progress == null) return child;
                                          return Container(
                                            color: isDark ? AppColors.surfaceDark : AppColors.surface,
                                            child: Center(
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: accentColor,
                                              ),
                                            ),
                                          );
                                        },
                                        errorBuilder: (_, __, ___) => Container(
                                          color: isDark ? AppColors.surfaceDark : AppColors.surface,
                                          child: Icon(
                                            Icons.broken_image_rounded,
                                            color: isDark ? AppColors.textLightHint : AppColors.textHint,
                                          ),
                                        ),
                                      ),
                                    ),
                                    // Zoom overlay
                                    Positioned(
                                      right: 4, bottom: 4,
                                      child: Container(
                                        padding: const EdgeInsets.all(4),
                                        decoration: BoxDecoration(
                                          color: Colors.black54,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: const Icon(
                                          Icons.zoom_in_rounded,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              // Actions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.backgroundDark : AppColors.background,
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      // Add Note Button
                      OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showAddNoteDialog(request, isDark);
                        },
                        icon: const Icon(Icons.note_add_rounded, size: 16),
                        label: const Text('Note', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                          side: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Change Status
                      OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showChangeStatusDialog(request, isDark);
                        },
                        icon: const Icon(Icons.swap_horiz_rounded, size: 16),
                        label: const Text('Status', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.warning,
                          side: const BorderSide(color: AppColors.warning),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                      if (request.status == ReturnStatus.requested) ...[
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            _forceApprove(request);
                          },
                          icon: const Icon(Icons.check_circle_rounded, size: 16),
                          label: const Text('Approve', style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.success,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                      if (!request.isResolved) ...[
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            _forceRefund(request);
                          },
                          icon: const Icon(Icons.payments_rounded, size: 16),
                          label: const Text('Refund', style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: accentColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotesSection(String title, String content, bool isDark, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.backgroundDark : AppColors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: isDark ? AppColors.textLightHint : AppColors.textHint),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  content,
                  style: TextStyle(
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
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

  Widget _detailRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: TextStyle(
                color: isDark ? AppColors.textLightHint : AppColors.textHint,
                fontSize: 12,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showChangeStatusDialog(ReturnRequestModel request, bool isDark) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.swap_horiz_rounded, color: AppColors.warning, size: 24),
            const SizedBox(width: 10),
            Text(
              'Change Status',
              style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
            ),
          ],
        ),
        content: SizedBox(
          width: 350,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: ReturnStatus.values.map((status) {
              final isSelected = status == request.status;
              final config = _getStatusConfig(status);
              return Material(
                color: Colors.transparent,
                child: ListTile(
                  title: Text(
                    status.displayName,
                    style: TextStyle(
                      color: isDark ? AppColors.textLight : AppColors.textPrimary,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  leading: Icon(
                    isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: isSelected ? config['color'] : (isDark ? AppColors.textLightHint : AppColors.textHint),
                  ),
                  selected: isSelected,
                  selectedTileColor: config['color'].withValues(alpha: 0.1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  onTap: () async {
                    Navigator.pop(context);
                    await _returnService.updateStatus(
                      returnId: request.id,
                      newStatus: status,
                      adminId: 'admin',
                      adminNotes: 'Status changed by admin',
                    );
                    _showSuccessSnackbar('Status updated to ${status.displayName}');
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  void _showAddNoteDialog(ReturnRequestModel request, bool isDark) {
    final controller = TextEditingController(text: request.adminNotes ?? '');
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(Icons.note_add_rounded, color: accentColor, size: 24),
            const SizedBox(width: 10),
            Text(
              'Admin Notes',
              style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
            ),
          ],
        ),
        content: TextField(
          controller: controller,
          maxLines: 4,
          style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'Enter notes for this return...',
            hintStyle: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint),
            filled: true,
            fillColor: isDark ? AppColors.backgroundDark : AppColors.background,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: accentColor, width: 2),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Cancel',
              style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              // TODO: Save admin notes
              _showSuccessSnackbar('Note saved');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: accentColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _forceApprove(ReturnRequestModel request) async {
    try {
      await _returnService.forceApprove(
        returnId: request.id,
        adminId: 'admin', // TODO: Get actual admin ID
        adminNotes: 'Force approved by admin',
      );
      _showSuccessSnackbar('Return force approved successfully');
    } catch (e) {
      _showErrorSnackbar('Failed to approve: $e');
    }
  }

  Future<void> _forceRefund(ReturnRequestModel request) async {
    try {
      await _returnService.initiateRefund(
        returnId: request.id,
        amount: request.refundAmount,
      );
      _showSuccessSnackbar('Refund initiated successfully');
    } catch (e) {
      _showErrorSnackbar('Failed to initiate refund: $e');
    }
  }

  Future<void> _seedDefaultReasons() async {
    try {
      await _returnService.seedDefaultReasons();
      _showSuccessSnackbar('Default return reasons seeded successfully');
    } catch (e) {
      _showErrorSnackbar('Failed to seed reasons: $e');
    }
  }

  void _exportReturns() {
    // TODO: Implement CSV export
    _showSuccessSnackbar('Export started...');
  }

  Future<Map<String, dynamic>> _getGlobalStats() async {
    // Aggregate stats from all sellers
    // For now, return mock data structure
    return {
      'total': 0,
      'pending': 0,
      'inProgress': 0,
      'totalRefundAmount': 0,
      'rejected': 0,
    };
  }

  void _showSuccessSnackbar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Text(message),
          ],
        ),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _showErrorSnackbar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  Map<String, dynamic> _getStatusConfig(ReturnStatus status) {
    switch (status) {
      case ReturnStatus.requested:
        return {'color': AppColors.pending};
      case ReturnStatus.approved:
        return {'color': AppColors.success};
      case ReturnStatus.rejected:
        return {'color': AppColors.error};
      case ReturnStatus.pickupScheduled:
        return {'color': AppColors.info};
      case ReturnStatus.pickupInProgress:
        return {'color': AppColors.processing};
      case ReturnStatus.pickupCompleted:
        return {'color': AppColors.shipped};
      case ReturnStatus.qcFailed:
        return {'color': AppColors.error};
      case ReturnStatus.refundInitiated:
        return {'color': AppColors.primaryLight};
      case ReturnStatus.refundCompleted:
        return {'color': AppColors.delivered};
      case ReturnStatus.exchangeShipped:
        return {'color': AppColors.shipped};
      case ReturnStatus.exchangeDelivered:
        return {'color': AppColors.delivered};
      case ReturnStatus.closed:
        return {'color': AppColors.returned};
      case ReturnStatus.cancelled:
        return {'color': AppColors.cancelled};
    }
  }

  // Priority & SLA Helpers
  Map<String, dynamic> _getPriorityInfo(ReturnRequestModel request) {
    if (request.isResolved) {
      return {'level': 'resolved', 'color': AppColors.success, 'icon': Icons.check_circle};
    }
    
    final daysElapsed = DateTime.now().difference(request.createdAt).inDays;
    
    if (daysElapsed >= _urgentDays && request.status == ReturnStatus.requested) {
      return {
        'level': 'urgent',
        'color': AppColors.error,
        'icon': Icons.warning_rounded,
        'label': 'URGENT',
        'days': daysElapsed,
      };
    } else if (daysElapsed >= _highPriorityDays) {
      return {
        'level': 'high',
        'color': AppColors.warning,
        'icon': Icons.priority_high_rounded,
        'label': 'HIGH',
        'days': daysElapsed,
      };
    }
    return {
      'level': 'normal',
      'color': AppColors.info,
      'icon': Icons.schedule_rounded,
      'label': 'NORMAL',
      'days': daysElapsed,
    };
  }

  String _getTimeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    return '${diff.inMinutes}m ago';
  }

  // Bulk Actions
  void _toggleSelection(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
      _isSelectionMode = _selectedIds.isNotEmpty;
    });
  }

  void _selectAll(List<ReturnRequestModel> returns) {
    setState(() {
      _selectedIds.addAll(returns.map((r) => r.id));
      _isSelectionMode = true;
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedIds.clear();
      _isSelectionMode = false;
    });
  }

  Future<void> _bulkUpdateStatus(ReturnStatus newStatus) async {
    if (_selectedIds.isEmpty) return;
    
    try {
      for (final id in _selectedIds) {
        await _returnService.updateStatus(
          returnId: id,
          newStatus: newStatus,
          adminId: 'admin',
          adminNotes: 'Bulk status update',
        );
      }
      _showSuccessSnackbar('Updated ${_selectedIds.length} returns');
      _clearSelection();
    } catch (e) {
      _showErrorSnackbar('Bulk update failed: $e');
    }
  }

  void _showBulkActionsSheet(bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.borderDark : AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                '${_selectedIds.length} Returns Selected',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 20),
              _BulkActionTile(
                icon: Icons.check_circle_rounded,
                label: 'Approve All',
                color: AppColors.success,
                onTap: () {
                  Navigator.pop(context);
                  _bulkUpdateStatus(ReturnStatus.approved);
                },
              ),
              _BulkActionTile(
                icon: Icons.local_shipping_rounded,
                label: 'Schedule Pickup',
                color: AppColors.info,
                onTap: () {
                  Navigator.pop(context);
                  _bulkUpdateStatus(ReturnStatus.pickupScheduled);
                },
              ),
              _BulkActionTile(
                icon: Icons.payments_rounded,
                label: 'Initiate Refund',
                color: AppColors.primaryLight,
                onTap: () {
                  Navigator.pop(context);
                  _bulkUpdateStatus(ReturnStatus.refundInitiated);
                },
              ),
              _BulkActionTile(
                icon: Icons.cancel_rounded,
                label: 'Reject All',
                color: AppColors.error,
                onTap: () {
                  Navigator.pop(context);
                  _bulkUpdateStatus(ReturnStatus.rejected);
                },
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  _clearSelection();
                },
                child: Text('Cancel', style: TextStyle(color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Full-screen image viewer
  void _showFullScreenImage(List<String> images, int initialIndex, bool isDark) {
    Navigator.push(
      context,
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black87,
        pageBuilder: (_, __, ___) => _FullScreenImageViewer(
          images: images,
          initialIndex: initialIndex,
          isDark: isDark,
        ),
      ),
    );
  }
}

// Full-Screen Image Viewer with Zoom & Navigation
class _FullScreenImageViewer extends StatefulWidget {
  final List<String> images;
  final int initialIndex;
  final bool isDark;

  const _FullScreenImageViewer({
    required this.images,
    required this.initialIndex,
    required this.isDark,
  });

  @override
  State<_FullScreenImageViewer> createState() => _FullScreenImageViewerState();
}

class _FullScreenImageViewerState extends State<_FullScreenImageViewer> {
  late PageController _pageController;
  late int _currentIndex;
  final TransformationController _transformController = TransformationController();

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black87,
      body: Stack(
        children: [
          // Image PageView with Zoom
          PageView.builder(
            controller: _pageController,
            itemCount: widget.images.length,
            onPageChanged: (i) => setState(() {
              _currentIndex = i;
              _transformController.value = Matrix4.identity();
            }),
            itemBuilder: (context, index) {
              return InteractiveViewer(
                transformationController: _transformController,
                minScale: 0.5,
                maxScale: 4.0,
                child: Center(
                  child: Image.network(
                    widget.images[index],
                    fit: BoxFit.contain,
                    loadingBuilder: (_, child, progress) {
                      if (progress == null) return child;
                      return Center(
                        child: CircularProgressIndicator(
                          value: progress.expectedTotalBytes != null
                              ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                              : null,
                          color: AppColors.primaryLight,
                        ),
                      );
                    },
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.broken_image_rounded,
                      size: 64,
                      color: Colors.white54,
                    ),
                  ),
                ),
              );
            },
          ),
          
          // Top Bar
          Positioned(
            top: 0, left: 0, right: 0,
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 8,
                left: 16, right: 16, bottom: 12,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black54, Colors.transparent],
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white, size: 28),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${_currentIndex + 1} / ${widget.images.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.zoom_in, color: Colors.white, size: 28),
                    onPressed: () {
                      final currentScale = _transformController.value.getMaxScaleOnAxis();
                      final newScale = (currentScale * 1.5).clamp(0.5, 4.0);
                      _transformController.value = Matrix4.diagonal3Values(newScale, newScale, 1.0);
                    },
                  ),
                ],
              ),
            ),
          ),
          
          // Navigation Arrows (Desktop)
          if (widget.images.length > 1) ...[
            Positioned(
              left: 16, top: 0, bottom: 0,
              child: Center(
                child: _currentIndex > 0
                    ? _NavButton(
                        icon: Icons.chevron_left_rounded,
                        onTap: () => _pageController.previousPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
            Positioned(
              right: 16, top: 0, bottom: 0,
              child: Center(
                child: _currentIndex < widget.images.length - 1
                    ? _NavButton(
                        icon: Icons.chevron_right_rounded,
                        onTap: () => _pageController.nextPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ],
          
          // Bottom Thumbnails
          if (widget.images.length > 1)
            Positioned(
              bottom: 0, left: 0, right: 0,
              child: Container(
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(context).padding.bottom + 16,
                  top: 16,
                ),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [Colors.black54, Colors.transparent],
                  ),
                ),
                child: SizedBox(
                  height: 60,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: widget.images.length,
                    itemBuilder: (context, index) {
                      final isSelected = index == _currentIndex;
                      return GestureDetector(
                        onTap: () => _pageController.animateToPage(
                          index,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        ),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.only(right: 10),
                          width: 60, height: 60,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: isSelected ? AppColors.primaryLight : Colors.white30,
                              width: isSelected ? 3 : 1,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              widget.images[index],
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                color: Colors.grey[800],
                                child: const Icon(Icons.image, color: Colors.white54, size: 24),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _NavButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black38,
      borderRadius: BorderRadius.circular(30),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(30),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Icon(icon, color: Colors.white, size: 32),
        ),
      ),
    );
  }
}

// Bulk Action Tile Widget
class _BulkActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _BulkActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: color, size: 22),
      ),
      title: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
      trailing: Icon(Icons.arrow_forward_ios_rounded, size: 16, color: color),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}

// Status Timeline Widget for Detail Dialog
class _StatusTimeline extends StatelessWidget {
  final List<Map<String, dynamic>> history;
  final bool isDark;

  const _StatusTimeline({required this.history, required this.isDark});

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return Center(
        child: Text(
          'No history available',
          style: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint),
        ),
      );
    }

    return Column(
      children: List.generate(history.length, (index) {
        final item = history[index];
        final isLast = index == history.length - 1;
        
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Timeline indicator
            Column(
              children: [
                Container(
                  width: 24, height: 24,
                  decoration: BoxDecoration(
                    color: (item['color'] as Color).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                    border: Border.all(color: item['color'], width: 2),
                  ),
                  child: Icon(item['icon'] as IconData, size: 12, color: item['color']),
                ),
                if (!isLast)
                  Container(
                    width: 2, height: 40,
                    color: isDark ? AppColors.borderDark : AppColors.border,
                  ),
              ],
            ),
            const SizedBox(width: 12),
            // Content
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['title'] as String,
                      style: TextStyle(
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item['subtitle'] as String,
                      style: TextStyle(
                        color: isDark ? AppColors.textLightHint : AppColors.textHint,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      }),
    );
  }
}

// Priority Badge Widget
class _PriorityBadge extends StatelessWidget {
  final String level;
  final Color color;
  final IconData icon;
  final int days;

  const _PriorityBadge({
    required this.level,
    required this.color,
    required this.icon,
    required this.days,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            '${days}d',
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}
