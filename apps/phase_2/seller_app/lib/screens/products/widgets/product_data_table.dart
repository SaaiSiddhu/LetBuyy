// lib/screens/products/widgets/product_data_table.dart
// Professional Product Data Table Widget

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import '../seller_product_form_screen.dart';

/// Professional Data Table for Products
class ProductDataTable extends StatefulWidget {
  final List<DocumentSnapshot> products;
  final bool isDark;
  final Set<String> selectedIds;
  final Function(String) onSelect;
  final Function(List<String>) onSelectAll;
  final VoidCallback? onClearSelection;

  const ProductDataTable({
    super.key,
    required this.products,
    required this.isDark,
    required this.selectedIds,
    required this.onSelect,
    required this.onSelectAll,
    this.onClearSelection,
  });

  @override
  State<ProductDataTable> createState() => _ProductDataTableState();
}

class _ProductDataTableState extends State<ProductDataTable> {
  int _sortColumnIndex = 0;
  bool _sortAscending = true;

  @override
  Widget build(BuildContext context) {
    final sortedProducts = List<DocumentSnapshot>.from(widget.products);
    _sortProducts(sortedProducts);

    return Container(
      margin: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF1E1E2E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: widget.isDark 
              ? Colors.white.withValues(alpha: 0.1) 
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: widget.isDark ? 0.3 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minWidth: MediaQuery.of(context).size.width - 24,
            ),
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(
                widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade50,
              ),
              dataRowColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return AppColors.primary.withValues(alpha: 0.1);
                }
                return null;
              }),
              headingRowHeight: 52,
              dataRowMinHeight: 64,
              dataRowMaxHeight: 72,
              horizontalMargin: 16,
              columnSpacing: 20,
              showCheckboxColumn: true,
              sortColumnIndex: _sortColumnIndex,
              sortAscending: _sortAscending,
              columns: [
                DataColumn(
                  label: _buildHeaderText('Product'),
                  onSort: (i, asc) => _onSort(i, asc),
                ),
                DataColumn(
                  label: _buildHeaderText('Price'),
                  numeric: true,
                  onSort: (i, asc) => _onSort(i, asc),
                ),
                DataColumn(
                  label: _buildHeaderText('Stock'),
                  numeric: true,
                  onSort: (i, asc) => _onSort(i, asc),
                ),
                DataColumn(
                  label: _buildHeaderText('Orders'),
                  numeric: true,
                  onSort: (i, asc) => _onSort(i, asc),
                ),
                DataColumn(
                  label: _buildHeaderText('Status'),
                ),
                DataColumn(
                  label: _buildHeaderText('Actions'),
                ),
              ],
              rows: sortedProducts.map((doc) {
                final data = doc.data() as Map<String, dynamic>;
                final isSelected = widget.selectedIds.contains(doc.id);
                return _buildDataRow(doc.id, data, isSelected);
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderText(String text) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 11,
        letterSpacing: 0.5,
        color: widget.isDark ? Colors.grey[400] : Colors.grey[700],
      ),
    );
  }

  DataRow _buildDataRow(String id, Map<String, dynamic> data, bool isSelected) {
    final name = data['name'] ?? 'Unnamed';
    final price = (data['price'] ?? 0).toDouble();
    final stock = (data['stock'] ?? 0) as int;
    final orders = (data['totalOrders'] ?? 0) as int;
    final isActive = data['isActive'] ?? true;
    final images = List<String>.from(data['images'] ?? []);
    final imageUrl = images.isNotEmpty ? images.first : null;

    return DataRow(
      selected: isSelected,
      onSelectChanged: (selected) {
        HapticFeedback.selectionClick();
        widget.onSelect(id);
      },
      cells: [
        // Product (Image + Name)
        DataCell(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: imageUrl != null
                    ? Image.network(
                        imageUrl,
                        width: 40,
                        height: 40,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildPlaceholder(),
                      )
                    : _buildPlaceholder(),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 150,
                child: Text(
                  name,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: widget.isDark ? Colors.white : Colors.black87,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),

        // Price
        DataCell(
          Text(
            '₹${price.toStringAsFixed(0)}',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: widget.isDark ? Colors.white : Colors.black87,
            ),
          ),
        ),

        // Stock
        DataCell(_buildStockBadge(stock)),

        // Orders
        DataCell(
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.shopping_bag_outlined,
                size: 14,
                color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
              ),
              const SizedBox(width: 4),
              Text(
                '$orders',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: widget.isDark ? Colors.white70 : Colors.black87,
                ),
              ),
            ],
          ),
        ),

        // Status
        DataCell(_buildStatusBadge(isActive)),

        // Actions
        DataCell(_buildActionsMenu(id, data)),
      ],
    );
  }

  Widget _buildPlaceholder() {
    return Container(
      width: 40,
      height: 40,
      color: widget.isDark ? Colors.grey[800] : Colors.grey[200],
      child: Icon(
        Icons.image_rounded,
        size: 20,
        color: widget.isDark ? Colors.grey[600] : Colors.grey[400],
      ),
    );
  }

  Widget _buildStockBadge(int stock) {
    Color color;
    String label;
    IconData icon;

    if (stock == 0) {
      color = Colors.red;
      label = 'Out';
      icon = Icons.error_rounded;
    } else if (stock < 5) {
      color = Colors.orange;
      label = '$stock';
      icon = Icons.warning_rounded;
    } else if (stock < 15) {
      color = Colors.amber;
      label = '$stock';
      icon = Icons.info_rounded;
    } else {
      color = Colors.green;
      label = '$stock';
      icon = Icons.check_circle_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isActive 
            ? Colors.green.withValues(alpha: 0.15) 
            : Colors.grey.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: isActive ? Colors.green : Colors.grey,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isActive ? 'Active' : 'Inactive',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isActive ? Colors.green[700] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionsMenu(String id, Map<String, dynamic> data) {
    return PopupMenuButton<String>(
      icon: Icon(
        Icons.more_vert_rounded,
        color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: widget.isDark ? const Color(0xFF2A2A3E) : Colors.white,
      itemBuilder: (context) => [
        _buildMenuItem('edit', Icons.edit_rounded, 'Edit Product', Colors.blue),
        _buildMenuItem('preview', Icons.visibility_rounded, 'Preview', Colors.purple),
        const PopupMenuDivider(),
        _buildMenuItem(
          'toggle', 
          data['isActive'] == true ? Icons.pause_rounded : Icons.play_arrow_rounded, 
          data['isActive'] == true ? 'Deactivate' : 'Activate',
          data['isActive'] == true ? Colors.orange : Colors.green,
        ),
        _buildMenuItem('duplicate', Icons.copy_rounded, 'Duplicate', Colors.teal),
        const PopupMenuDivider(),
        _buildMenuItem('delete', Icons.delete_rounded, 'Delete', Colors.red),
      ],
      onSelected: (action) => _handleAction(action, id, data),
    );
  }

  PopupMenuItem<String> _buildMenuItem(String value, IconData icon, String label, Color color) {
    return PopupMenuItem<String>(
      value: value,
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 12),
          Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w500,
              color: widget.isDark ? Colors.white : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  void _handleAction(String action, String id, Map<String, dynamic> data) async {
    HapticFeedback.mediumImpact();
    
    switch (action) {
      case 'edit':
        final doc = await FirebaseFirestore.instance.collection('products').doc(id).get();
        if (doc.exists && mounted) {
          final product = ProductModel.fromMap(doc.data()!, doc.id);
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => SellerProductFormScreen(product: product)),
          );
        }
        break;
      case 'toggle':
        await FirebaseFirestore.instance.collection('products').doc(id).update({
          'isActive': !(data['isActive'] ?? true),
        });
        break;
      case 'delete':
        _showDeleteConfirmation(id, data['name'] ?? 'this product');
        break;
    }
  }

  void _showDeleteConfirmation(String id, String name) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: widget.isDark ? const Color(0xFF2A2A3E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Delete Product?',
          style: TextStyle(color: widget.isDark ? Colors.white : Colors.black87),
        ),
        content: Text(
          'Are you sure you want to delete "$name"? This action cannot be undone.',
          style: TextStyle(color: widget.isDark ? Colors.grey[400] : Colors.grey[700]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await FirebaseFirestore.instance.collection('products').doc(id).delete();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _sortProducts(List<DocumentSnapshot> products) {
    products.sort((a, b) {
      final aData = a.data() as Map<String, dynamic>;
      final bData = b.data() as Map<String, dynamic>;
      
      int result;
      switch (_sortColumnIndex) {
        case 0: // Name
          result = (aData['name'] ?? '').toString().compareTo((bData['name'] ?? '').toString());
          break;
        case 1: // Price
          result = ((aData['price'] ?? 0) as num).compareTo((bData['price'] ?? 0) as num);
          break;
        case 2: // Stock
          result = ((aData['stock'] ?? 0) as int).compareTo((bData['stock'] ?? 0) as int);
          break;
        case 3: // Orders
          result = ((aData['totalOrders'] ?? 0) as int).compareTo((bData['totalOrders'] ?? 0) as int);
          break;
        default:
          result = 0;
      }
      
      return _sortAscending ? result : -result;
    });
  }

  void _onSort(int columnIndex, bool ascending) {
    setState(() {
      _sortColumnIndex = columnIndex;
      _sortAscending = ascending;
    });
  }
}
