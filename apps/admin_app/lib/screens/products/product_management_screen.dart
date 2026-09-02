// lib/screens/admin/products/product_management_screen.dart
// Production-level product management with advanced features

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import '../../../providers/admin_provider.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'add_product_screen.dart';

class ProductManagementScreen extends StatefulWidget {
  const ProductManagementScreen({super.key});

  @override
  State<ProductManagementScreen> createState() => _ProductManagementScreenState();
}

class _ProductManagementScreenState extends State<ProductManagementScreen> {
  
  final TextEditingController _searchController = TextEditingController();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  // Search & Filters
  String _searchQuery = '';
  String _sortBy = 'newest';
  bool _isGridView = true;
  bool _showFilters = false;
  String _statusFilter = 'all'; // all, pending, approved, rejected
  
  // Filter state
  String? _filterCategory;
  String? _filterSeller;
  String _filterStock = 'all'; // all, inStock, lowStock, outOfStock
  bool? _filterFeatured;
  final RangeValues _priceRange = const RangeValues(0, 100000);
  
  // Selection
  final Set<String> _selectedIds = {};
  bool get _selectionMode => _selectedIds.isNotEmpty;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AdminProvider>(context, listen: false).listenToCategories();
      Provider.of<AdminProvider>(context, listen: false).listenToSellers(); // helpful for other features too
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final bgColor = isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA);
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width > 1000;
    final isMobile = width < 768;

    return Scaffold(
      backgroundColor: bgColor,
      appBar: isMobile ? null : _buildAppBar(isDark, accentColor, cardColor),
      body: isDesktop 
          ? _buildDesktopLayout(isDark, accentColor, cardColor)
          : SafeArea(child: _buildMobileLayout(isDark, accentColor, cardColor)),
      floatingActionButton: _selectionMode ? null : FloatingActionButton.extended(
        onPressed: () => Navigator.push(context, 
          MaterialPageRoute(builder: (_) => const AddProductScreen())),
        backgroundColor: accentColor,
        foregroundColor: isDark ? Colors.black : Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Product', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color accentColor, Color cardColor) {
    return AppBar(
      backgroundColor: cardColor,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back_ios_new_rounded, color: isDark ? Colors.white : Colors.black87),
        onPressed: () => Navigator.pop(context),
      ),
      title: Text('Product Management', style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
      actions: [
        IconButton(
          icon: Icon(Icons.filter_list, color: _showFilters ? accentColor : (isDark ? Colors.white54 : Colors.black54)),
          tooltip: 'Filters',
          onPressed: () => setState(() => _showFilters = !_showFilters),
        ),
        IconButton(
          icon: Icon(_isGridView ? Icons.view_list_rounded : Icons.grid_view_rounded, color: isDark ? Colors.white54 : Colors.black54),
          tooltip: _isGridView ? 'List View' : 'Grid View',
          onPressed: () => setState(() => _isGridView = !_isGridView),
        ),
        PopupMenuButton<String>(
          icon: Icon(Icons.sort_rounded, color: isDark ? Colors.white54 : Colors.black54),
          tooltip: 'Sort',
          onSelected: (v) => setState(() => _sortBy = v),
          itemBuilder: (_) => [
            _sortMenuItem('Newest First', 'newest'),
            _sortMenuItem('Price: High to Low', 'price_high'),
            _sortMenuItem('Price: Low to High', 'price_low'),
            _sortMenuItem('Name: A-Z', 'name'),
            _sortMenuItem('Low Stock', 'stock'),
          ],
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  Widget _buildDesktopLayout(bool isDark, Color accentColor, Color cardColor) {
    return Row(
      children: [
        // Sidebar Filters
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: _showFilters ? 280 : 0,
          child: _showFilters ? _buildFilterSidebar(isDark, accentColor, cardColor) : null,
        ),
        // Main Content
        Expanded(
          child: Column(
            children: [
              _buildStatsHeader(isDark, accentColor, cardColor),
              _buildSearchAndTabs(isDark, accentColor, cardColor),
              if (_selectionMode) _buildBulkActionsBar(isDark, accentColor),
              Expanded(
                child: _buildProductList(_statusFilter, isDark, accentColor),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMobileLayout(bool isDark, Color accentColor, Color cardColor) {
    return Column(
      children: [
        // Premium Mobile Header
        _buildMobileHeader(isDark, accentColor, cardColor),
        // Stats Row
        _buildMobileStatsRow(isDark, accentColor, cardColor),
        // Search bar
        _buildSearchBar(isDark, accentColor),
        if (_showFilters) _buildFilterChips(isDark, accentColor),
        if (_selectionMode) _buildBulkActionsBar(isDark, accentColor),
        Expanded(
          child: _buildProductList(_statusFilter, isDark, accentColor),
        ),
      ],
    );
  }

  // Premium Mobile Header
  Widget _buildMobileHeader(bool isDark, Color accentColor, Color cardColor) {
    // Get display label for current filter
    String getStatusLabel() {
      switch (_statusFilter) {
        case 'pending': return 'Pending';
        case 'approved': return 'Approved';
        case 'rejected': return 'Rejected';
        default: return 'All';
      }
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
      decoration: BoxDecoration(
        color: cardColor,
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
          ),
        ),
      ),
      child: Row(
        children: [
          // Title
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Products',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : Colors.black87,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Manage your inventory',
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.white54 : Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          // Status dropdown
          Container(
            decoration: BoxDecoration(
              color: _statusFilter != 'all' 
                  ? accentColor.withValues(alpha: 0.15) 
                  : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.1)),
              borderRadius: BorderRadius.circular(12),
              border: _statusFilter != 'all' 
                  ? Border.all(color: accentColor.withValues(alpha: 0.3)) 
                  : null,
            ),
            child: PopupMenuButton<String>(
              onSelected: (v) => setState(() => _statusFilter = v),
              tooltip: 'Filter by status',
              icon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.filter_alt_rounded, 
                    color: _statusFilter != 'all' ? accentColor : (isDark ? Colors.white54 : Colors.black54),
                    size: 20,
                  ),
                  if (_statusFilter != 'all') ...[
                    const SizedBox(width: 4),
                    Text(
                      getStatusLabel(),
                      style: TextStyle(fontSize: 12, color: accentColor, fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
              itemBuilder: (_) => [
                _buildStatusMenuItem('All', 'all', Icons.all_inbox_rounded),
                _buildStatusMenuItem('Pending', 'pending', Icons.hourglass_empty_rounded),
                _buildStatusMenuItem('Approved', 'approved', Icons.check_circle_rounded),
                _buildStatusMenuItem('Rejected', 'rejected', Icons.cancel_rounded),
              ],
            ),
          ),
          const SizedBox(width: 4),
          // Filter button
          Container(
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: Icon(Icons.tune_rounded, color: _showFilters ? accentColor : (isDark ? Colors.white54 : Colors.black54), size: 22),
              onPressed: () => setState(() => _showFilters = !_showFilters),
            ),
          ),
          const SizedBox(width: 4),
          // Grid/List toggle
          Container(
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: Icon(_isGridView ? Icons.view_list_rounded : Icons.grid_view_rounded, 
                color: isDark ? Colors.white54 : Colors.black54, size: 22),
              onPressed: () => setState(() => _isGridView = !_isGridView),
            ),
          ),
        ],
      ),
    );
  }

  PopupMenuItem<String> _buildStatusMenuItem(String label, String value, IconData icon) {
    final isSelected = _statusFilter == value;
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Icon(icon, size: 18, color: isSelected ? AppColors.primary : Colors.grey),
          const SizedBox(width: 12),
          Text(label, style: TextStyle(fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
          const Spacer(),
          if (isSelected) Icon(Icons.check, size: 18, color: AppColors.primary),
        ],
      ),
    );
  }

  // Mobile Stats Row
  Widget _buildMobileStatsRow(bool isDark, Color accentColor, Color cardColor) {
    return StreamBuilder<QuerySnapshot>(
      stream: _firestore.collection('products').snapshots(),
      builder: (ctx, snap) {
        final docs = snap.data?.docs ?? [];
        final total = docs.length;
        final pending = docs.where((d) => (d.data() as Map)['approvalStatus'] == 'pending').length;
        final lowStock = docs.where((d) => ((d.data() as Map)['stock'] ?? 0) < 10).length;
        
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              _buildMobileStat('$total', 'Total', Icons.inventory_2_rounded, accentColor, isDark),
              const SizedBox(width: 12),
              _buildMobileStat('$pending', 'Pending', Icons.hourglass_empty_rounded, Colors.orange, isDark),
              const SizedBox(width: 12),
              _buildMobileStat('$lowStock', 'Low Stock', Icons.warning_amber_rounded, Colors.red, isDark),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMobileStat(String value, String label, IconData icon, Color color, bool isDark) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: isDark ? Colors.white : Colors.black87)),
                Text(label, style: TextStyle(fontSize: 10, color: color)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsHeader(bool isDark, Color accentColor, Color cardColor) {
    return StreamBuilder<QuerySnapshot>(
      stream: _firestore.collection('products').snapshots(),
      builder: (ctx, snap) {
        final docs = snap.data?.docs ?? [];
        final total = docs.length;
        final pending = docs.where((d) => (d.data() as Map)['approvalStatus'] == 'pending').length;
        final lowStock = docs.where((d) => ((d.data() as Map)['stock'] ?? 0) < 10).length;
        
        return Container(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              _buildStatCard('Total', '$total', Icons.inventory_2, accentColor, isDark, cardColor),
              const SizedBox(width: 12),
              _buildStatCard('Pending', '$pending', Icons.hourglass_empty, Colors.orange, isDark, cardColor),
              const SizedBox(width: 12),
              _buildStatCard('Low Stock', '$lowStock', Icons.warning_amber, Colors.red, isDark, cardColor),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color, bool isDark, Color cardColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: isDark ? Colors.white : Colors.black87)),
                Text(label, style: TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterSidebar(bool isDark, Color accentColor, Color cardColor) {
    return Container(
      color: cardColor,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.filter_list, color: accentColor),
              const SizedBox(width: 8),
              Text('Filters', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: isDark ? Colors.white : Colors.black87)),
              const Spacer(),
              TextButton(onPressed: _clearFilters, child: const Text('Clear')),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 16),
          
          // Stock Filter
          Text('Stock Status', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : Colors.black54)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            _buildFilterChip('All', _filterStock == 'all', () => setState(() => _filterStock = 'all'), isDark),
            _buildFilterChip('In Stock', _filterStock == 'inStock', () => setState(() => _filterStock = 'inStock'), isDark),
            _buildFilterChip('Low Stock', _filterStock == 'lowStock', () => setState(() => _filterStock = 'lowStock'), isDark),
            _buildFilterChip('Out', _filterStock == 'outOfStock', () => setState(() => _filterStock = 'outOfStock'), isDark),
          ]),
          const SizedBox(height: 20),
          
          // Featured Filter
          Text('Featured', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : Colors.black54)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            _buildFilterChip('All', _filterFeatured == null, () => setState(() => _filterFeatured = null), isDark),
            _buildFilterChip('Featured', _filterFeatured == true, () => setState(() => _filterFeatured = true), isDark),
            _buildFilterChip('Regular', _filterFeatured == false, () => setState(() => _filterFeatured = false), isDark),
          ]),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, bool selected, VoidCallback onTap, bool isDark) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.15) : (isDark ? Colors.white10 : Colors.grey[200]),
          borderRadius: BorderRadius.circular(20),
          border: selected ? Border.all(color: AppColors.primary) : null,
        ),
        child: Text(label, style: TextStyle(
          color: selected ? AppColors.primary : (isDark ? Colors.white70 : Colors.black54),
          fontWeight: selected ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        )),
      ),
    );
  }

  Widget _buildFilterChips(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildFilterChip('All Stock', _filterStock == 'all', () => setState(() => _filterStock = 'all'), isDark),
            const SizedBox(width: 8),
            _buildFilterChip('Low Stock', _filterStock == 'lowStock', () => setState(() => _filterStock = 'lowStock'), isDark),
            const SizedBox(width: 8),
            _buildFilterChip('Out of Stock', _filterStock == 'outOfStock', () => setState(() => _filterStock = 'outOfStock'), isDark),
            const SizedBox(width: 8),
            _buildFilterChip('Featured', _filterFeatured == true, () => setState(() => _filterFeatured = _filterFeatured == true ? null : true), isDark),
            if (_hasActiveFilters) ...[
              const SizedBox(width: 8),
              TextButton.icon(
                onPressed: _clearFilters,
                icon: const Icon(Icons.clear, size: 16),
                label: const Text('Clear'),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
              ),
            ],
          ],
        ),
      ),
    );
  }

  bool get _hasActiveFilters => _filterStock != 'all' || _filterFeatured != null || _filterCategory != null;

  void _clearFilters() {
    setState(() {
      _filterStock = 'all';
      _filterFeatured = null;
      _filterCategory = null;
      _filterSeller = null;
    });
  }

  Widget _buildSearchAndTabs(bool isDark, Color accentColor, Color cardColor) {
    return Container(
      color: cardColor,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildSearchBar(isDark, accentColor),
          const SizedBox(height: 12),
          _buildTabBar(isDark, accentColor, cardColor),
        ],
      ),
    );
  }

  Widget _buildTabBar(bool isDark, Color accentColor, Color cardColor) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white10 : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _buildDesktopTab('All', 'all', isDark, accentColor),
          _buildDesktopTab('Pending', 'pending', isDark, accentColor),
          _buildDesktopTab('Approved', 'approved', isDark, accentColor),
          _buildDesktopTab('Rejected', 'rejected', isDark, accentColor),
        ],
      ),
    );
  }

  Widget _buildDesktopTab(String label, String value, bool isDark, Color accentColor) {
    final isSelected = _statusFilter == value;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _statusFilter = value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected ? accentColor : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : (isDark ? Colors.white54 : Colors.black54),
            ),
          ),
        ),
      ),
    );
  }


  PopupMenuItem<String> _sortMenuItem(String label, String value) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          if (_sortBy == value) const Icon(Icons.check, size: 18, color: Colors.green),
          if (_sortBy == value) const SizedBox(width: 8),
          Text(label),
        ],
      ),
    );
  }

  Widget _buildTab(String label, IconData icon, [Color? color]) {
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildSearchBar(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.grey.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05),
          ),
        ),
        child: TextField(
          controller: _searchController,
          onChanged: (v) => setState(() => _searchQuery = v.trim().toLowerCase()),
          style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 15),
          decoration: InputDecoration(
            hintText: 'Search products...',
            hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.black38, fontSize: 15),
            prefixIcon: Icon(Icons.search_rounded, color: isDark ? Colors.white38 : Colors.black38, size: 22),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.clear_rounded, size: 20, color: isDark ? Colors.white38 : Colors.black38),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  )
                : null,
            filled: false,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ),
    );
  }

  Widget _buildBulkActionsBar(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.1),
        border: Border(bottom: BorderSide(color: accentColor.withValues(alpha: 0.3))),
      ),
      child: Row(
        children: [
          // Close selection
          Container(
            decoration: BoxDecoration(color: isDark ? Colors.white10 : Colors.white, borderRadius: BorderRadius.circular(8)),
            child: IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => setState(() => _selectedIds.clear()),
              tooltip: 'Cancel selection',
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: accentColor, borderRadius: BorderRadius.circular(20)),
            child: Text('${_selectedIds.length} selected', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
          const Spacer(),
          
          // Action buttons
          _buildBulkAction(Icons.check_circle, 'Approve', Colors.green, () => _bulkUpdateStatus('approved')),
          _buildBulkAction(Icons.pause_circle, 'Pause', Colors.orange, _showPauseDialog),
          _buildBulkAction(Icons.notifications, 'Notify', Colors.blue, _showNotifySellerDialog),
          _buildBulkAction(Icons.delete_outline, 'Delete', Colors.red, _confirmBulkDelete),
        ],
      ),
    );
  }

  Widget _buildBulkAction(IconData icon, String label, Color color, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  void _showPauseDialog() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Pause Products',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, _, __) => Container(),
      transitionBuilder: (ctx, anim1, _, __) => ScaleTransition(
        scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
        child: AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.orange.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: const Icon(Icons.pause_circle, color: Colors.orange),
            ),
            const SizedBox(width: 12),
            Text('Pause ${_selectedIds.length} Products?', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
          ]),
          content: Text('Paused products will not be visible to customers.', style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                Navigator.pop(ctx);
                await _bulkUpdateField('isActive', false);
                if (mounted) SnackbarHelper.showSuccess(context, 'Products paused');
              },
              style: FilledButton.styleFrom(backgroundColor: Colors.orange),
              child: const Text('Pause All'),
            ),
          ],
        ),
      ),
    );
  }

  void _showNotifySellerDialog() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    final messageController = TextEditingController();
    String notifyType = 'warning';
    
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Notify Seller',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, _, __) => Container(),
      transitionBuilder: (ctx, anim1, _, __) => ScaleTransition(
        scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
        child: StatefulBuilder(
          builder: (ctx, setDialogState) => AlertDialog(
            backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.1), shape: BoxShape.circle),
                child: const Icon(Icons.notifications, color: Colors.blue),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text('Notify Sellers', style: TextStyle(color: isDark ? Colors.white : Colors.black87))),
            ]),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Notification Type', style: TextStyle(fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : Colors.black54)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, children: [
                    ChoiceChip(label: const Text('Warning'), selected: notifyType == 'warning', onSelected: (_) => setDialogState(() => notifyType = 'warning')),
                    ChoiceChip(label: const Text('Info'), selected: notifyType == 'info', onSelected: (_) => setDialogState(() => notifyType = 'info')),
                    ChoiceChip(label: const Text('Action'), selected: notifyType == 'action', onSelected: (_) => setDialogState(() => notifyType = 'action')),
                  ]),
                  const SizedBox(height: 16),
                  TextField(
                    controller: messageController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: 'Message',
                      hintText: 'Enter notification message...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              FilledButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  SnackbarHelper.showSuccess(context, 'Notifications sent to sellers');
                  setState(() => _selectedIds.clear());
                },
                icon: const Icon(Icons.send, size: 18),
                label: const Text('Send'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _bulkUpdateField(String field, dynamic value) async {
    HapticFeedback.mediumImpact();
    try {
      final batch = _firestore.batch();
      for (final id in _selectedIds) {
        batch.update(_firestore.collection('products').doc(id), {
          field: value,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      setState(() => _selectedIds.clear());
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to update products');
    }
  }


  Widget _buildProductList(String statusFilter, bool isDark, Color accentColor) {
    return StreamBuilder<QuerySnapshot>(
      stream: _buildQuery(statusFilter),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
                const SizedBox(height: 12),
                Text('Error loading products', style: TextStyle(color: Colors.red[300])),
              ],
            ),
          );
        }

        final docs = snapshot.data?.docs ?? [];
        
        // Apply filters
        List<QueryDocumentSnapshot> filtered = docs.where((doc) {
          final data = doc.data() as Map<String, dynamic>;
          
          // Search filter
          if (_searchQuery.isNotEmpty) {
            final name = (data['name'] ?? '').toString().toLowerCase();
            final id = doc.id.toLowerCase();
            final category = (data['categoryId'] ?? '').toString().toLowerCase();
            if (!name.contains(_searchQuery) && !id.contains(_searchQuery) && !category.contains(_searchQuery)) {
              return false;
            }
          }
          
          // Stock filter
          final stock = (data['stock'] ?? 0) as int;
          if (_filterStock == 'inStock' && stock < 10) return false;
          if (_filterStock == 'lowStock' && (stock >= 10 || stock == 0)) return false;
          if (_filterStock == 'outOfStock' && stock > 0) return false;
          
          // Featured filter
          if (_filterFeatured != null) {
            final isFeatured = data['isFeatured'] ?? false;
            if (_filterFeatured != isFeatured) return false;
          }
          
          return true;
        }).toList();

        // Sort
        filtered = _sortProducts(filtered);

        if (filtered.isEmpty) {
          return _buildEmptyState(statusFilter, isDark);
        }

        if (_isGridView) {
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: MediaQuery.of(context).size.width > 1200 ? 4 
                  : MediaQuery.of(context).size.width > 800 ? 3 : 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 0.75,
            ),
            itemCount: filtered.length,
            itemBuilder: (context, index) {
              final data = filtered[index].data() as Map<String, dynamic>;
              final product = ProductModel.fromMap(data, filtered[index].id);
              return _buildProductCard(product, isDark, accentColor)
                  .animate()
                  .fadeIn(duration: 200.ms, delay: (50 * index).ms)
                  .slideY(begin: 0.1, end: 0, duration: 200.ms);
            },
          );
        } else {
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: filtered.length,
            itemBuilder: (context, index) {
              final data = filtered[index].data() as Map<String, dynamic>;
              final product = ProductModel.fromMap(data, filtered[index].id);
              return _buildListTile(product, isDark, accentColor)
                  .animate()
                  .fadeIn(duration: 200.ms, delay: (30 * index).ms);
            },
          );
        }
      },
    );
  }

  Stream<QuerySnapshot> _buildQuery(String statusFilter) {
    Query query = _firestore.collection('products');
    
    if (statusFilter != 'all') {
      query = query.where('approvalStatus', isEqualTo: statusFilter);
    }
    
    return query.orderBy('createdAt', descending: true).snapshots();
  }

  List<QueryDocumentSnapshot> _sortProducts(List<QueryDocumentSnapshot> products) {
    switch (_sortBy) {
      case 'price_high':
        products.sort((a, b) {
          final aPrice = ((a.data() as Map)['salePrice'] ?? 0).toDouble();
          final bPrice = ((b.data() as Map)['salePrice'] ?? 0).toDouble();
          return bPrice.compareTo(aPrice);
        });
        break;
      case 'price_low':
        products.sort((a, b) {
          final aPrice = ((a.data() as Map)['salePrice'] ?? 0).toDouble();
          final bPrice = ((b.data() as Map)['salePrice'] ?? 0).toDouble();
          return aPrice.compareTo(bPrice);
        });
        break;
      case 'name':
        products.sort((a, b) {
          final aName = (a.data() as Map)['name'] ?? '';
          final bName = (b.data() as Map)['name'] ?? '';
          return aName.compareTo(bName);
        });
        break;
      case 'stock':
        products.sort((a, b) {
          final aStock = ((a.data() as Map)['stock'] ?? 0).toInt();
          final bStock = ((b.data() as Map)['stock'] ?? 0).toInt();
          return aStock.compareTo(bStock);
        });
        break;
    }
    return products;
  }

  Widget _buildEmptyState(String statusFilter, bool isDark) {
    String message;
    IconData icon;
    
    switch (statusFilter) {
      case 'pending':
        message = 'No pending products';
        icon = Icons.hourglass_empty;
        break;
      case 'approved':
        message = 'No approved products';
        icon = Icons.check_circle_outline;
        break;
      case 'rejected':
        message = 'No rejected products';
        icon = Icons.cancel_outlined;
        break;
      default:
        message = 'No products found';
        icon = Icons.inventory_2_outlined;
    }
    
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: isDark ? Colors.white24 : Colors.grey[400]),
          const SizedBox(height: 16),
          Text(message, style: TextStyle(
            fontSize: 18, 
            color: isDark ? Colors.white54 : Colors.grey[600],
          )),
          if (_searchQuery.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Try a different search term',
                style: TextStyle(color: isDark ? Colors.white38 : Colors.grey)),
            ),
        ],
      ),
    );
  }

  Widget _buildProductCard(ProductModel product, bool isDark, Color accentColor) {
    final isSelected = _selectedIds.contains(product.id);
    
    return GestureDetector(
      onTap: () => _selectionMode 
          ? _toggleSelection(product.id) 
          : _showProductActions(product, isDark),
      onLongPress: () => _toggleSelection(product.id),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isSelected 
              ? Border.all(color: accentColor, width: 2) 
              : null,
          boxShadow: [
            BoxShadow(
              color: isSelected 
                  ? accentColor.withValues(alpha: 0.2) 
                  : Colors.black.withValues(alpha: 0.05),
              blurRadius: isSelected ? 12 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              flex: 3,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                    child: product.images.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: product.primaryImage,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => _imagePlaceholder(isDark),
                            errorWidget: (_, __, ___) => _imagePlaceholder(isDark),
                          )
                        : _imagePlaceholder(isDark),
                  ),
                  // Selection checkbox
                  if (_selectionMode)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSelected ? accentColor : Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isSelected ? Icons.check : Icons.circle_outlined,
                          color: isSelected ? Colors.white : Colors.grey,
                          size: 24,
                        ),
                      ),
                    ),
                  // Status badge
                  Positioned(
                    top: 8,
                    left: 8,
                    child: _buildStatusBadge(product.approvalStatus),
                  ),
                  // Low stock badge
                  if (product.stock < 10)
                    Positioned(
                      bottom: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          product.stock == 0 ? 'Out of Stock' : 'Low: ${product.stock}',
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Info
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    const Spacer(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '₹${product.salePrice.toStringAsFixed(0)}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: accentColor,
                          ),
                        ),
                        _buildQuickActions(product, isDark),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListTile(ProductModel product, bool isDark, Color accentColor) {
    final isSelected = _selectedIds.contains(product.id);
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: isSelected ? Border.all(color: accentColor, width: 2) : null,
      ),
      child: ListTile(
        onTap: () => _selectionMode 
            ? _toggleSelection(product.id) 
            : _showProductActions(product, isDark),
        onLongPress: () => _toggleSelection(product.id),
        contentPadding: const EdgeInsets.all(12),
        leading: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: product.images.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: product.primaryImage,
                      width: 60,
                      height: 60,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      width: 60,
                      height: 60,
                      color: isDark ? Colors.grey[800] : Colors.grey[200],
                      child: const Icon(Icons.image_not_supported),
                    ),
            ),
            if (_selectionMode)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: isSelected ? accentColor : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: accentColor),
                  ),
                  child: isSelected 
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : null,
                ),
              ),
          ],
        ),
        title: Text(
          product.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        subtitle: Row(
          children: [
            Text('₹${product.salePrice.toStringAsFixed(0)}',
              style: TextStyle(color: accentColor, fontWeight: FontWeight.bold)),
            const SizedBox(width: 12),
            Text('Stock: ${product.stock}',
              style: TextStyle(
                color: product.stock < 10 ? Colors.red : 
                       (isDark ? Colors.white54 : Colors.black45),
              )),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatusBadge(product.approvalStatus),
            const SizedBox(width: 8),
            _buildQuickActions(product, isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(ProductApprovalStatus status) {
    Color color;
    String label;
    
    switch (status) {
      case ProductApprovalStatus.pending:
        color = Colors.orange;
        label = 'Pending';
        break;
      case ProductApprovalStatus.approved:
        color = Colors.green;
        label = 'Approved';
        break;
      case ProductApprovalStatus.rejected:
        color = Colors.red;
        label = 'Rejected';
        break;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(
        color: color, 
        fontSize: 10, 
        fontWeight: FontWeight.bold,
      )),
    );
  }

  Widget _buildQuickActions(ProductModel product, bool isDark) {
    return PopupMenuButton<String>(
      icon: Icon(Icons.more_vert, size: 20, color: isDark ? Colors.white54 : Colors.black45),
      padding: EdgeInsets.zero,
      onSelected: (action) => _handleQuickAction(action, product),
      itemBuilder: (_) => [
        if (product.isPending) ...[
          const PopupMenuItem(value: 'approve', child: Row(children: [
            Icon(Icons.check_circle, color: Colors.green, size: 18),
            SizedBox(width: 8),
            Text('Approve'),
          ])),
          const PopupMenuItem(value: 'reject', child: Row(children: [
            Icon(Icons.cancel, color: Colors.red, size: 18),
            SizedBox(width: 8),
            Text('Reject'),
          ])),
        ],
        const PopupMenuItem(value: 'edit', child: Row(children: [
          Icon(Icons.edit_outlined, color: Colors.blue, size: 18),
          SizedBox(width: 8),
          Text('Edit'),
        ])),
        const PopupMenuItem(value: 'delete', child: Row(children: [
          Icon(Icons.delete_outline, color: Colors.red, size: 18),
          SizedBox(width: 8),
          Text('Delete'),
        ])),
      ],
    );
  }

  Widget _imagePlaceholder(bool isDark) {
    return Container(
      color: isDark ? Colors.grey[800] : Colors.grey[200],
      child: Center(child: Icon(Icons.image_not_supported, 
        color: isDark ? Colors.white24 : Colors.grey[400])),
    );
  }

  void _toggleSelection(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  void _handleQuickAction(String action, ProductModel product) {
    switch (action) {
      case 'approve':
        _updateProductStatus(product.id, 'approved');
        break;
      case 'reject':
        _showRejectDialog(product);
        break;
      case 'edit':
        Navigator.push(context, 
          MaterialPageRoute(builder: (_) => AddProductScreen(product: product)));
        break;
      case 'delete':
        _confirmDeleteProduct(product);
        break;
    }
  }

  void _showProductActions(ProductModel product, bool isDark) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final adminProvider = Provider.of<AdminProvider>(context, listen: false);

    // Helper to get category name with full tree hierarchy
    String getCategoryName(String id) {
      if (id.isEmpty) return 'Uncategorized';
      
      final List<String> path = [];
      String? currentId = id;
      int safetyCounter = 0; // Prevent infinite loops
      
      while (currentId != null && currentId.isNotEmpty && safetyCounter < 10) {
        try {
          final category = adminProvider.categories.firstWhere(
            (c) => c['id'] == currentId,
            orElse: () => {},
          );
          
          if (category.isEmpty) break;
          
          // Add name to start of list
          path.insert(0, category['name'] ?? 'Unknown');
          
          // Move up to parent
          final parentId = category['parentId'];
          if (parentId != null && parentId is String && parentId.isNotEmpty) {
            currentId = parentId;
          } else {
            currentId = null; // Reached root
          }
        } catch (e) {
          break;
        }
        safetyCounter++;
      }
      
      if (path.isEmpty) return id; // Fallback to ID if not found
      
      // Join with > for tree view style
      return path.join(' > ');
    }

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Product Details',
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (ctx, _, __) => Container(),
      transitionBuilder: (ctx, anim1, _, __) {
        return SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
              .animate(CurvedAnimation(parent: anim1, curve: Curves.easeOutCubic)),
          child: Dialog(
            backgroundColor: Colors.transparent, // Use transparent for glass effect
            insetPadding: EdgeInsets.symmetric(
              horizontal: MediaQuery.of(context).size.width > 600 ? 100 : 16,
              vertical: 24,
            ),
            child: GlassContainer( // Wrap in GlassContainer
              borderRadius: BorderRadius.circular(24),
              color: isDark ? const Color(0xFF1E1E1E).withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.9),
              blur: 15,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header with image and close button
                    Stack(
                      children: [
                        Container(
                           height: 250, // Slightly taller for better view
                           width: double.infinity,
                           decoration: BoxDecoration(
                             color: isDark ? Colors.black26 : Colors.grey[100], // Background for "contain" fit
                             borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                           ),
                           child: ClipRRect(
                             borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                             child: product.images.isNotEmpty
                                 ? CachedNetworkImage(
                                     imageUrl: product.primaryImage,
                                     fit: BoxFit.contain, // FIT IS NOW CONTAIN
                                     errorWidget: (_, __, ___) => _imagePlaceholder(isDark),
                                   )
                                 : Center(child: Icon(Icons.image, size: 60, color: isDark ? Colors.white24 : Colors.grey)),
                           ),
                        ),
                        
                        // Gradient overlay for text readability at bottom if we had text there, 
                        // but since we moved text out or kept it, let's keep a subtle gradient for the top controls
                        Positioned(
                          top: 0, left: 0, right: 0,
                          height: 80,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.black.withValues(alpha: 0.5),
                                  Colors.transparent,
                                ],
                              ),
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                            ),
                          ),
                        ),

                        // Close button (Top Right)
                        Positioned(
                          top: 12, right: 12,
                          child: IconButton(
                            onPressed: () => Navigator.pop(ctx),
                            icon: const Icon(Icons.close, color: Colors.white),
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.white.withValues(alpha: 0.2), 
                              hoverColor: Colors.white.withValues(alpha: 0.4)
                            ),
                          ),
                        ),
                        
                        // Status badge (Top Left)
                        Positioned(
                          top: 12, left: 12,
                          child: _buildStatusBadge(product.approvalStatus),
                        ),

                        // Stock Badge (Bottom Right on Image)
                        Positioned(
                          bottom: 12, right: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: product.stock < 10 ? Colors.red : Colors.green,
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4, offset:const Offset(0, 2))
                              ]
                            ),
                            child: Text(
                              product.stock == 0 ? 'Out of Stock' : 'Stock: ${product.stock}',
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ],
                    ),
                    
                    // Content Body
                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Title & Price
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  product.name, 
                                  style: TextStyle(
                                    color: isDark ? Colors.white : Colors.black87, 
                                    fontWeight: FontWeight.w800, 
                                    fontSize: 20
                                  )
                                ),
                              ),
                              const SizedBox(width: 16),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '₹${product.salePrice.toStringAsFixed(0)}', 
                                    style: TextStyle(
                                      color: accentColor, 
                                      fontWeight: FontWeight.w800, 
                                      fontSize: 20
                                    )
                                  ),
                                  if (product.originalPrice != null)
                                    Text(
                                      '₹${product.originalPrice!.toStringAsFixed(0)}', 
                                      style: TextStyle(
                                        color: isDark ? Colors.white38 : Colors.grey, 
                                        decoration: TextDecoration.lineThrough, 
                                        fontSize: 14
                                      )
                                    ),
                                ],
                              ),
                            ],
                          ),
                          
                          const SizedBox(height: 24),
                          
                          // Info Grid (Category, Rating, Reviews) using easier readable layout
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: isDark ? Colors.white10 : Colors.black.withValues(alpha: 0.05)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceAround,
                              children: [
                                _buildDetailItem(
                                  Icons.category_outlined, 
                                  'Category', 
                                  getCategoryName(product.categoryId), // USE HELPER HERE
                                  isDark
                                ),
                                _buildDetailItem(
                                  Icons.star_rounded, 
                                  'Rating', 
                                  product.rating.toStringAsFixed(1), 
                                  isDark
                                ),
                                _buildDetailItem(
                                  Icons.chat_bubble_outline, 
                                  'Reviews', 
                                  '${product.reviewCount}', 
                                  isDark
                                ),
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 24),

                          // Action Buttons
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                                // Special Approval Actions if pending
                                if (product.isPending) ...[
                                    _buildActionButtonLarge(
                                      Icons.check_circle_rounded, 'Approve', Colors.green, 
                                      () {
                                        Navigator.pop(ctx);
                                        _updateProductStatus(product.id, 'approved');
                                      }
                                    ),
                                    _buildActionButtonLarge(
                                      Icons.cancel_rounded, 'Reject', Colors.red, 
                                      () {
                                        Navigator.pop(ctx);
                                        _showRejectDialog(product);
                                      }
                                    ),
                                ],

                                _buildActionButtonLarge(
                                  Icons.edit_rounded, 'Edit', Colors.blue, 
                                  () {
                                    Navigator.pop(ctx);
                                    Navigator.push(context, MaterialPageRoute(builder: (_) => AddProductScreen(product: product)));
                                  },
                                  isOutlined: true,
                                ),

                                _buildActionButtonLarge(
                                  product.isActive ? Icons.pause_rounded : Icons.play_arrow_rounded, 
                                  product.isActive ? 'Pause' : 'Activate', 
                                  Colors.orange, 
                                  () {
                                    Navigator.pop(ctx);
                                    _firestore.collection('products').doc(product.id).update({'isActive': !product.isActive});
                                    SnackbarHelper.showSuccess(context, product.isActive ? 'Product paused' : 'Product activated');
                                  },
                                  isOutlined: true,
                                ),
                                
                                _buildActionButtonLarge(
                                  Icons.notifications_active_rounded, 'Notify Seller', Colors.purple, 
                                  () {
                                    Navigator.pop(ctx);
                                    _selectedIds.add(product.id);
                                    _showNotifySellerDialog();
                                  },
                                  isOutlined: true,
                                ),

                                _buildActionButtonLarge(
                                  Icons.delete_rounded, 'Delete', Colors.red, 
                                  () {
                                    Navigator.pop(ctx);
                                    _confirmDeleteProduct(product);
                                  },
                                  isOutlined: true,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailItem(IconData icon, String label, String value, bool isDark) {
    return Column(
      children: [
        Icon(icon, size: 22, color: isDark ? Colors.white54 : Colors.black54),
        const SizedBox(height: 8),
        Text(value, 
          style: TextStyle(
            fontWeight: FontWeight.bold, 
            color: isDark ? Colors.white : Colors.black87,
            fontSize: 13
          ),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(label, 
          style: TextStyle(fontSize: 11, color: isDark ? Colors.white38 : Colors.black38)
        ),
      ],
    );
  }

  Widget _buildActionButtonLarge(IconData icon, String label, Color color, VoidCallback onTap, {bool isOutlined = false}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isOutlined ? color.withValues(alpha: 0.1) : color,
            borderRadius: BorderRadius.circular(12),
            border: isOutlined ? Border.all(color: color.withValues(alpha: 0.5)) : null,
            boxShadow: isOutlined ? null : [
              BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 4))
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: isOutlined ? color : Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                label, 
                style: TextStyle(
                  color: isOutlined ? color : Colors.white, 
                  fontWeight: FontWeight.bold, 
                  fontSize: 14
                )
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickStat(IconData icon, String label, String value, bool isDark) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: isDark ? Colors.white54 : Colors.black45),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87)),
          Text(label, style: TextStyle(fontSize: 11, color: isDark ? Colors.white38 : Colors.black38)),
        ],
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _actionTile(IconData icon, String label, Color color, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: color),
      title: Text(label),
      onTap: onTap,
      contentPadding: EdgeInsets.zero,
    );
  }

  Future<void> _updateProductStatus(String productId, String status) async {
    HapticFeedback.mediumImpact();
    try {
      await _firestore.collection('products').doc(productId).update({
        'approvalStatus': status,
        if (status == 'approved') 'approvedAt': FieldValue.serverTimestamp(),
        if (status == 'approved') 'approvedBy': 'admin',
        'updatedAt': FieldValue.serverTimestamp(),
      });
      if (mounted) {
        SnackbarHelper.showSuccess(context, 
          status == 'approved' ? 'Product approved!' : 'Product status updated');
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to update status');
    }
  }

  void _showRejectDialog(ProductModel product) {
    final reasonController = TextEditingController();
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        title: Text('Reject Product', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(
            labelText: 'Reason for rejection',
            hintText: 'Enter reason...',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _firestore.collection('products').doc(product.id).update({
                'approvalStatus': 'rejected',
                'rejectionReason': reasonController.text.trim(),
                'updatedAt': FieldValue.serverTimestamp(),
              });
              if (mounted) SnackbarHelper.showSuccess(context, 'Product rejected');
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteProduct(ProductModel product) {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        title: Text('Delete Product?', style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
        content: Text('This will permanently delete "${product.name}". This cannot be undone.',
          style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await _firestore.collection('products').doc(product.id).delete();
              if (mounted) SnackbarHelper.showSuccess(context, 'Product deleted');
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _bulkUpdateStatus(String status) async {
    HapticFeedback.mediumImpact();
    try {
      final batch = _firestore.batch();
      for (final id in _selectedIds) {
        batch.update(_firestore.collection('products').doc(id), {
          'approvalStatus': status,
          if (status == 'approved') 'approvedAt': FieldValue.serverTimestamp(),
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      setState(() => _selectedIds.clear());
      if (mounted) {
        SnackbarHelper.showSuccess(context, '${_selectedIds.length} products updated');
      }
    } catch (e) {
      if (mounted) SnackbarHelper.showError(context, 'Failed to update products');
    }
  }

  void _confirmBulkDelete() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        title: Text('Delete ${_selectedIds.length} Products?', 
          style: TextStyle(color: isDark ? Colors.white : Colors.black87)),
        content: Text('This action cannot be undone.',
          style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final batch = _firestore.batch();
              for (final id in _selectedIds) {
                batch.delete(_firestore.collection('products').doc(id));
              }
              await batch.commit();
              setState(() => _selectedIds.clear());
              if (mounted) SnackbarHelper.showSuccess(context, 'Products deleted');
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Delete All'),
          ),
        ],
      ),
    );
  }
}