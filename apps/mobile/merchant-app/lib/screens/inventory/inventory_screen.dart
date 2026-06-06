import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/routes.dart';
import '../../services/inventory_service.dart';
import '../../services/store_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final TextEditingController _searchController = TextEditingController();

  List<InventoryLevel> _levels = [];
  bool _isLoading = true;
  bool _lowStockOnly = false;
  String _query = '';
  String? _storeId;
  String? _error;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _loadInventory();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInventory() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??= (await context.read<StoreService>().getFirstStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _levels = [];
            _isLoading = false;
          });
        }
        return;
      }

      final levels = await context.read<InventoryService>().fetchLevels(
        _storeId!,
        lowStockOnly: _lowStockOnly,
      );
      if (mounted) {
        setState(() {
          _levels = levels;
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

  List<InventoryLevel> get _filteredLevels {
    final query = _query.trim().toLowerCase();
    final levels = _lowStockOnly
        ? _levels.where((level) => level.isLowStock || level.isOutOfStock)
        : _levels;
    if (query.isEmpty) return levels.toList(growable: false);
    return levels
        .where(
          (level) =>
              level.productName.toLowerCase().contains(query) ||
              level.sku.toLowerCase().contains(query) ||
              level.locationId.toLowerCase().contains(query),
        )
        .toList(growable: false);
  }

  int get _availableUnits =>
      _levels.fold(0, (sum, level) => sum + level.available);
  int get _lowStockCount => _levels.where((level) => level.isLowStock).length;
  int get _outOfStockCount =>
      _levels.where((level) => level.isOutOfStock).length;

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
              _searchAndFilter(),
              _wmsShortcuts(),
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
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Inventory',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Adjust stock and monitor low inventory',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh inventory',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _loadInventory,
          ),
        ],
      ),
    );
  }

  Widget _searchAndFilter() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              style: TextStyle(color: colors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search SKU, product, location',
                hintStyle: TextStyle(color: colors.textTertiary),
                prefixIcon: Icon(
                  Icons.search_rounded,
                  color: colors.textTertiary,
                ),
                filled: true,
                fillColor: colors.surfaceVariant,
                border: _inputBorder(colors.divider),
                enabledBorder: _inputBorder(colors.divider),
                focusedBorder: _inputBorder(
                  mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Tooltip(
            message: 'Low stock only',
            child: FilterChip(
              selected: _lowStockOnly,
              label: const Text('Low'),
              avatar: const Icon(Icons.warning_amber_rounded, size: 18),
              selectedColor: colors.warning.withValues(alpha: 0.16),
              checkmarkColor: colors.warning,
              onSelected: (selected) {
                setState(() => _lowStockOnly = selected);
                _loadInventory();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _wmsShortcuts() {
    final items = [
      _WmsShortcut(
        label: 'Locations',
        icon: Icons.warehouse_outlined,
        route: AppRoutes.inventoryLocations,
      ),
      _WmsShortcut(
        label: 'Suppliers',
        icon: Icons.handshake_outlined,
        route: AppRoutes.inventorySuppliers,
      ),
      _WmsShortcut(
        label: 'Purchase orders',
        icon: Icons.add_box_outlined,
        route: AppRoutes.purchaseOrders,
      ),
      _WmsShortcut(
        label: 'Transfers',
        icon: Icons.swap_horiz_outlined,
        route: AppRoutes.inventoryTransfers,
      ),
    ];

    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final item = items[index];
          return ActionChip(
            avatar: Icon(item.icon, size: 18),
            label: Text(item.label),
            onPressed: () => Navigator.pushNamed(context, item.route),
            backgroundColor: colors.card,
            side: BorderSide(color: colors.cardBorder),
            labelStyle: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: items.length,
      ),
    );
  }

  OutlineInputBorder _inputBorder(Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: color),
    );
  }

  Widget _stats() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: _metric(
              'Available',
              _availableUnits.toString(),
              Icons.inventory_2_outlined,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Low',
              _lowStockCount.toString(),
              Icons.warning_amber_rounded,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _metric(
              'Out',
              _outOfStockCount.toString(),
              Icons.remove_shopping_cart_outlined,
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
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          Text(
            label,
            style: TextStyle(color: colors.textSecondary, fontSize: 11),
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

  Widget _body() {
    if (_error != null) {
      return _centerState(
        icon: Icons.error_outline_rounded,
        title: 'Could not load inventory',
        subtitle: _error!,
        action: TextButton.icon(
          onPressed: _loadInventory,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry'),
        ),
      );
    }

    if (_levels.isEmpty) {
      return _centerState(
        icon: Icons.inventory_2_outlined,
        title: 'No inventory levels',
        subtitle: 'Stock levels appear after products or variants are created.',
      );
    }

    final levels = _filteredLevels;
    if (levels.isEmpty) {
      return _centerState(
        icon: Icons.search_off_rounded,
        title: 'No matching stock',
        subtitle: 'Try another product, SKU, or clear low-stock filtering.',
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _loadInventory,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: levels.length,
        itemBuilder: (context, index) => _levelCard(levels[index]),
      ),
    );
  }

  Widget _levelCard(InventoryLevel level) {
    final tone = level.isOutOfStock
        ? colors.error
        : level.isLowStock
        ? colors.warning
        : colors.success;

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
                  level.productName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _stockChip(level, tone),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            runSpacing: 6,
            children: [
              _miniMetric(
                Icons.qr_code_2_rounded,
                level.sku.ifEmpty ?? 'No SKU',
              ),
              _miniMetric(Icons.place_outlined, level.locationId),
              _miniMetric(
                Icons.lock_outline_rounded,
                '${level.reserved} reserved',
              ),
              _miniMetric(
                Icons.shopping_cart_checkout_rounded,
                '${level.committed} committed',
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: (level.available.clamp(0, 20)) / 20,
                  minHeight: 6,
                  borderRadius: BorderRadius.circular(99),
                  color: tone,
                  backgroundColor: colors.surfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                onPressed: () => _adjust(level),
                icon: const Icon(Icons.add_task_rounded, size: 18),
                label: const Text('Adjust'),
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  side: BorderSide(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary
                        .withValues(alpha: 0.4),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stockChip(InventoryLevel level, Color tone) {
    final label = level.isOutOfStock
        ? 'Out'
        : level.isLowStock
        ? 'Low'
        : 'In stock';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '${level.available} $label',
        style: TextStyle(
          color: tone,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _miniMetric(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: colors.textTertiary),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }

  Widget _centerState({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 48),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
            if (action != null) ...[const SizedBox(height: 14), action],
          ],
        ),
      ),
    );
  }

  Future<void> _adjust(InventoryLevel level) async {
    final request = await _adjustmentDialog(level);
    if (request == null || _storeId == null) return;

    try {
      await context.read<InventoryService>().adjustStock(
        storeId: _storeId!,
        level: level,
        delta: request.delta,
        reason: request.reason,
        note: request.note,
      );
      if (mounted) {
        _showSnackBar('Stock adjusted by ${request.delta}');
        _loadInventory();
      }
    } catch (error) {
      if (mounted) _showSnackBar(error.toString(), isError: true);
    }
  }

  Future<_InventoryAdjustment?> _adjustmentDialog(InventoryLevel level) {
    final deltaController = TextEditingController();
    final noteController = TextEditingController();
    var reason = 'adjustment';

    return showDialog<_InventoryAdjustment>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: colors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Text(
            'Adjust ${level.productName}',
            style: TextStyle(color: colors.textPrimary),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: deltaController,
                keyboardType: const TextInputType.numberWithOptions(
                  signed: true,
                ),
                style: TextStyle(color: colors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Change quantity',
                  hintText: '+5 or -2',
                  labelStyle: TextStyle(color: colors.textSecondary),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: reason,
                dropdownColor: colors.card,
                style: TextStyle(color: colors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Reason',
                  labelStyle: TextStyle(color: colors.textSecondary),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'adjustment',
                    child: Text('Adjustment'),
                  ),
                  DropdownMenuItem(value: 'recount', child: Text('Recount')),
                  DropdownMenuItem(value: 'received', child: Text('Received')),
                  DropdownMenuItem(value: 'damaged', child: Text('Damaged')),
                  DropdownMenuItem(value: 'return', child: Text('Return')),
                  DropdownMenuItem(
                    value: 'correction',
                    child: Text('Correction'),
                  ),
                ],
                onChanged: (value) {
                  if (value != null) setDialogState(() => reason = value);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                minLines: 2,
                maxLines: 3,
                style: TextStyle(color: colors.textPrimary),
                decoration: InputDecoration(
                  labelText: 'Note',
                  labelStyle: TextStyle(color: colors.textSecondary),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Cancel',
                style: TextStyle(color: colors.textSecondary),
              ),
            ),
            TextButton(
              onPressed: () {
                final delta = int.tryParse(
                  deltaController.text.trim().replaceFirst('+', ''),
                );
                if (delta == null || delta == 0) {
                  _showSnackBar('Enter a non-zero adjustment', isError: true);
                  return;
                }
                Navigator.pop(
                  context,
                  _InventoryAdjustment(
                    delta: delta,
                    reason: reason,
                    note: noteController.text.trim(),
                  ),
                );
              },
              child: Text(
                'Apply',
                style: TextStyle(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

class _InventoryAdjustment {
  const _InventoryAdjustment({
    required this.delta,
    required this.reason,
    required this.note,
  });

  final int delta;
  final String reason;
  final String note;
}

class _WmsShortcut {
  const _WmsShortcut({
    required this.label,
    required this.icon,
    required this.route,
  });

  final String label;
  final IconData icon;
  final String route;
}

extension on String {
  String? get ifEmpty => isEmpty ? null : this;
}
