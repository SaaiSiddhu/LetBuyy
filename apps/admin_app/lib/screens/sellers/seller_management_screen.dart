// lib/screens/sellers/seller_management_screen.dart
// ADVANCED SELLER MANAGEMENT - TOP GRADE PROFESSIONAL

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';

import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import '../../providers/admin_provider.dart';
import '../../app/themes/app_colors.dart';

class SellerManagementScreen extends StatefulWidget {
  const SellerManagementScreen({super.key});

  @override
  State<SellerManagementScreen> createState() => _SellerManagementScreenState();
}

class _SellerManagementScreenState extends State<SellerManagementScreen>
    with TickerProviderStateMixin {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  late AnimationController _pulseController;
  
  String _searchQuery = '';
  String _selectedStatus = 'all';
  String _sortBy = 'newest';
  bool _sortAscending = false;
  RangeValues _ratingRange = const RangeValues(0, 5);
  bool _showAdvancedFilters = false;
  final Set<String> _selectedSellers = {};

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  List<SellerModel> _filterAndSortSellers(List<SellerModel> sellers) {
    var filtered = sellers.where((s) {
      final matchesSearch = _searchQuery.isEmpty ||
          s.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.storeName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.email.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          s.phone.contains(_searchQuery);

      final matchesStatus = _selectedStatus == 'all' ||
          (_selectedStatus == 'verified' && s.verificationStatus == VerificationStatus.verified) ||
          (_selectedStatus == 'pending' && s.verificationStatus == VerificationStatus.pending) ||
          (_selectedStatus == 'rejected' && s.verificationStatus == VerificationStatus.rejected) ||
          (_selectedStatus == 'suspended' && !s.isActive);

      final matchesRating = s.rating >= _ratingRange.start && s.rating <= _ratingRange.end;

      return matchesSearch && matchesStatus && matchesRating;
    }).toList();

    // Sort
    filtered.sort((a, b) {
      int compare;
      switch (_sortBy) {
        case 'name':
          compare = a.name.compareTo(b.name);
          break;
        case 'revenue':
          compare = a.totalRevenue.compareTo(b.totalRevenue);
          break;
        case 'orders':
          compare = a.totalOrders.compareTo(b.totalOrders);
          break;
        case 'rating':
          compare = a.rating.compareTo(b.rating);
          break;
        case 'newest':
        default:
          compare = a.createdAt.compareTo(b.createdAt);
      }
      return _sortAscending ? compare : -compare;
    });

    return filtered;
  }

  List<SellerModel> _mapToSellers(List<Map<String, dynamic>> raw) {
    return raw.map((data) {
      final id = data['sellerId'] ?? data['id'] ?? '';
      return SellerModel.fromMap(data, id);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.watch<ThemeProvider>().isDarkMode;
    final provider = context.watch<AdminProvider>();
    final allSellers = _mapToSellers(provider.sellers);
    final sellers = _filterAndSortSellers(allSellers);

    // Stats
    final total = allSellers.length;
    final verified = allSellers.where((s) => s.verificationStatus == VerificationStatus.verified).length;
    final pending = allSellers.where((s) => s.verificationStatus == VerificationStatus.pending).length;
    final rejected = allSellers.where((s) => s.verificationStatus == VerificationStatus.rejected).length;
    final totalRevenue = allSellers.fold(0.0, (sum, s) => sum + s.totalRevenue);

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // ═══════════════════════════════════════════════════════════════════
          // PREMIUM APP BAR
          // ═══════════════════════════════════════════════════════════════════
          SliverAppBar(
            expandedHeight: 140,
            floating: true,
            pinned: true,
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.primary, AppColors.secondary],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(Icons.store_mall_directory_rounded, color: Colors.white, size: 28),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Seller Management', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                              Text('$total sellers registered', style: TextStyle(color: Colors.white70, fontSize: 13)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            actions: [
              IconButton(
                icon: Badge(
                  label: Text('$pending'),
                  isLabelVisible: pending > 0,
                  backgroundColor: AppColors.warning,
                  child: const Icon(Icons.pending_actions_rounded),
                ),
                onPressed: () => setState(() => _selectedStatus = 'pending'),
                tooltip: 'Pending KYC',
              ),
              IconButton(
                icon: const Icon(Icons.refresh_rounded),
                onPressed: () => provider.listenToSellers(),
                tooltip: 'Refresh',
              ),
              const SizedBox(width: 8),
            ],
          ),

          // ═══════════════════════════════════════════════════════════════════
          // PREMIUM STATS CARDS
          // ═══════════════════════════════════════════════════════════════════
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(child: _buildStatCard('Total', total, Icons.groups_rounded, AppColors.primary, isDark)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildStatCard('Verified', verified, Icons.verified_rounded, AppColors.success, isDark)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildStatCard('Pending', pending, Icons.pending_rounded, AppColors.warning, isDark)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildStatCard('Rejected', rejected, Icons.cancel_rounded, AppColors.error, isDark)),
                ].animate(interval: 100.ms).fadeIn(duration: 300.ms).slideX(begin: 0.1),
              ),
            ),
          ),

          // Revenue Card
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.accent],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10)),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 28),
                    ),
                    const SizedBox(width: 20),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Total Seller Revenue', style: TextStyle(color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(
                            NumberFormat.currency(symbol: '₹', decimalDigits: 0, locale: 'en_IN').format(totalRevenue),
                            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.trending_up_rounded, color: Colors.white.withValues(alpha: 0.5), size: 48),
                  ],
                ),
              ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),
            ),
          ),

          // ═══════════════════════════════════════════════════════════════════
          // SEARCH & FILTERS
          // ═══════════════════════════════════════════════════════════════════
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Search Bar
                  Container(
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.surfaceDark : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 10, offset: const Offset(0, 4)),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      onChanged: (v) => setState(() => _searchQuery = v),
                      decoration: InputDecoration(
                        hintText: 'Search by name, store, email, phone...',
                        prefixIcon: Icon(Icons.search_rounded, color: AppColors.primary),
                        suffixIcon: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (_searchQuery.isNotEmpty)
                              IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 20),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              ),
                            IconButton(
                              icon: Icon(
                                _showAdvancedFilters ? Icons.filter_list_off_rounded : Icons.tune_rounded,
                                color: _showAdvancedFilters ? AppColors.primary : null,
                              ),
                              onPressed: () => setState(() => _showAdvancedFilters = !_showAdvancedFilters),
                              tooltip: 'Advanced Filters',
                            ),
                          ],
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All', 'all', Icons.all_inclusive_rounded, isDark),
                        _buildFilterChip('Verified', 'verified', Icons.verified_rounded, isDark),
                        _buildFilterChip('Pending', 'pending', Icons.pending_rounded, isDark),
                        _buildFilterChip('Rejected', 'rejected', Icons.cancel_rounded, isDark),
                        _buildFilterChip('Suspended', 'suspended', Icons.block_rounded, isDark),
                        const SizedBox(width: 16),
                        // Sort Dropdown
                        _buildSortDropdown(isDark),
                      ],
                    ),
                  ),

                  // Advanced Filters
                  if (_showAdvancedFilters) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.surfaceDark : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Rating Range', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
                          RangeSlider(
                            values: _ratingRange,
                            min: 0,
                            max: 5,
                            divisions: 10,
                            labels: RangeLabels(_ratingRange.start.toStringAsFixed(1), _ratingRange.end.toStringAsFixed(1)),
                            activeColor: AppColors.primary,
                            onChanged: (v) => setState(() => _ratingRange = v),
                          ),
                        ],
                      ),
                    ).animate().fadeIn().slideY(begin: -0.1),
                  ],
                ],
              ),
            ),
          ),

          // ═══════════════════════════════════════════════════════════════════
          // SELLER LIST
          // ═══════════════════════════════════════════════════════════════════
          if (provider.isLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (sellers.isEmpty)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.store_mall_directory_outlined, size: 80, color: isDark ? Colors.white24 : Colors.grey[300]),
                    const SizedBox(height: 16),
                    Text('No sellers found', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: isDark ? Colors.white60 : Colors.grey[600])),
                    const SizedBox(height: 8),
                    Text('Try adjusting your filters', style: TextStyle(color: isDark ? Colors.white38 : Colors.grey[400])),
                  ],
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _buildEnhancedSellerCard(sellers[index], isDark, index),
                  childCount: sellers.length,
                ),
              ),
            ),

          // Bottom padding
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
      
      // Bulk Actions FAB
      floatingActionButton: _selectedSellers.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: () => _showBulkActionsSheet(isDark),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.checklist_rounded, color: Colors.white),
              label: Text('${_selectedSellers.length} Selected', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ).animate().scale()
          : null,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════
  
  Widget _buildStatCard(String label, int value, IconData icon, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 10),
          Text(
            value.toString(),
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87),
          ),
          Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.white60 : Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, IconData icon, bool isDark) {
    final isSelected = _selectedStatus == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.grey[700])),
            const SizedBox(width: 6),
            Text(label),
          ],
        ),
        selected: isSelected,
        onSelected: (_) => setState(() => _selectedStatus = value),
        selectedColor: AppColors.primary,
        backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.grey[700]),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        side: BorderSide(color: isSelected ? AppColors.primary : (isDark ? AppColors.borderDark : AppColors.border)),
        elevation: isSelected ? 4 : 0,
        shadowColor: AppColors.primary.withValues(alpha: 0.3),
      ),
    );
  }

  Widget _buildSortDropdown(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _sortBy,
          icon: Icon(
            _sortAscending ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            size: 18,
            color: AppColors.primary,
          ),
          items: [
            DropdownMenuItem(value: 'newest', child: Text('Date')),
            DropdownMenuItem(value: 'name', child: Text('Name')),
            DropdownMenuItem(value: 'revenue', child: Text('Revenue')),
            DropdownMenuItem(value: 'orders', child: Text('Orders')),
            DropdownMenuItem(value: 'rating', child: Text('Rating')),
          ],
          onChanged: (v) {
            if (v == _sortBy) {
              setState(() => _sortAscending = !_sortAscending);
            } else {
              setState(() {
                _sortBy = v!;
                _sortAscending = false;
              });
            }
          },
          style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 14),
          dropdownColor: isDark ? AppColors.surfaceDark : Colors.white,
        ),
      ),
    );
  }

  Widget _buildEnhancedSellerCard(SellerModel seller, bool isDark, int index) {
    final isSelected = _selectedSellers.contains(seller.sellerId);
    final statusColor = _getStatusColor(seller.verificationStatus.name);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          // Use go_router for URL-based navigation
          // context.go() is required for routes with parentNavigatorKey to update URL
          context.go('/sellers/${seller.sellerId}', extra: seller);
        },
        onLongPress: () {
          HapticFeedback.mediumImpact();
          setState(() {
            if (isSelected) {
              _selectedSellers.remove(seller.sellerId);
            } else {
              _selectedSellers.add(seller.sellerId);
            }
          });
        },
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? AppColors.primary : (isDark ? AppColors.borderDark : AppColors.border),
              width: isSelected ? 2 : 1,
            ),
            boxShadow: [
              BoxShadow(
                color: isSelected ? AppColors.primary.withValues(alpha: 0.2) : Colors.black.withValues(alpha: 0.05),
                blurRadius: 15,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                children: [
                  // Avatar with status
                  Stack(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: statusColor, width: 3),
                        ),
                        child: CircleAvatar(
                          radius: 30,
                          backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                          backgroundImage: seller.photoUrl != null ? NetworkImage(seller.photoUrl!) : null,
                          child: seller.photoUrl == null
                              ? Text(seller.name.isNotEmpty ? seller.name[0].toUpperCase() : 'S',
                                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.primary))
                              : null,
                        ),
                      ),
                      if (seller.verificationStatus == VerificationStatus.verified)
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                              border: Border.all(color: isDark ? AppColors.surfaceDark : Colors.white, width: 2),
                            ),
                            child: const Icon(Icons.check, color: Colors.white, size: 12),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 14),

                  // Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                seller.name,
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: isDark ? Colors.white : Colors.black87),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            _buildStatusBadge(seller.verificationStatus.name),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(seller.storeName, style: TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w500)),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.email_outlined, size: 12, color: isDark ? Colors.white38 : Colors.grey[400]),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(seller.email, style: TextStyle(fontSize: 11, color: isDark ? Colors.white54 : Colors.grey[600]), overflow: TextOverflow.ellipsis),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Selection checkbox
                  if (_selectedSellers.isNotEmpty)
                    Checkbox(
                      value: isSelected,
                      onChanged: (v) {
                        setState(() {
                          if (v == true) {
                            _selectedSellers.add(seller.sellerId);
                          } else {
                            _selectedSellers.remove(seller.sellerId);
                          }
                        });
                      },
                      activeColor: AppColors.primary,
                    )
                  else
                    Icon(Icons.chevron_right_rounded, color: isDark ? Colors.white30 : Colors.grey[400]),
                ],
              ),

              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 14),

              // Stats Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildMiniStat(Icons.inventory_2_outlined, seller.totalProducts.toString(), 'Products', isDark),
                  _buildMiniStat(Icons.shopping_bag_outlined, seller.totalOrders.toString(), 'Orders', isDark),
                  _buildMiniStat(Icons.currency_rupee, '₹${(seller.totalRevenue / 1000).toStringAsFixed(1)}K', 'Revenue', isDark),
                  _buildMiniStat(Icons.star_rounded, seller.rating.toStringAsFixed(1), 'Rating', isDark, isRating: true, rating: seller.rating),
                ],
              ),
            ],
          ),
        ),
      ),
    ).animate(delay: Duration(milliseconds: index * 50)).fadeIn().slideX(begin: 0.05);
  }

  Widget _buildMiniStat(IconData icon, String value, String label, bool isDark, {bool isRating = false, double rating = 0}) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: isRating ? _getRatingColor(rating) : AppColors.primary),
            const SizedBox(width: 4),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: isRating ? _getRatingColor(rating) : (isDark ? Colors.white : Colors.black87))),
          ],
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10, color: isDark ? Colors.white38 : Colors.grey[500])),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    final color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color, letterSpacing: 0.5),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'verified': return AppColors.success;
      case 'rejected': return AppColors.error;
      case 'pending': return AppColors.warning;
      case 'suspended': return Colors.grey;
      default: return AppColors.textSecondary;
    }
  }

  Color _getRatingColor(double rating) {
    if (rating >= 4.5) return AppColors.success;
    if (rating >= 3.5) return AppColors.primary;
    if (rating >= 2.5) return AppColors.warning;
    return AppColors.error;
  }

  void _showBulkActionsSheet(bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Bulk Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
            const SizedBox(height: 8),
            Text('${_selectedSellers.length} sellers selected', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600])),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _buildBulkActionButton('Verify All', Icons.verified_rounded, AppColors.success, () {
                    Navigator.pop(context);
                    _bulkAction(VerificationStatus.verified);
                  }),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildBulkActionButton('Suspend All', Icons.block_rounded, AppColors.error, () {
                    Navigator.pop(context);
                    _bulkAction(VerificationStatus.suspended);
                  }),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                setState(() => _selectedSellers.clear());
              },
              child: Text('Clear Selection', style: TextStyle(color: isDark ? Colors.white60 : Colors.grey[600])),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBulkActionButton(String label, IconData icon, Color color, VoidCallback onTap) {
    return ElevatedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, color: Colors.white),
      label: Text(label, style: const TextStyle(color: Colors.white)),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _bulkAction(VerificationStatus status) async {
    final provider = context.read<AdminProvider>();
    for (var id in _selectedSellers) {
      await provider.updateSellerVerification(id, status);
    }
    if (mounted) {
      setState(() => _selectedSellers.clear());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Updated ${_selectedSellers.length} sellers'), backgroundColor: AppColors.success),
      );
    }
  }
}