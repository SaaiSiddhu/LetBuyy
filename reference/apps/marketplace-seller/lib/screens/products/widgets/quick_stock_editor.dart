// lib/screens/products/widgets/quick_stock_editor.dart
// ⚡ QUICK STOCK EDIT - Inline editing without opening full product form
// ✨ Ultra-compact, professional design

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

class QuickStockEditor extends StatefulWidget {
  final ProductModel product;
  final VoidCallback? onUpdated;

  const QuickStockEditor({
    super.key,
    required this.product,
    this.onUpdated,
  });

  @override
  State<QuickStockEditor> createState() => _QuickStockEditorState();
}

class _QuickStockEditorState extends State<QuickStockEditor> {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  late TextEditingController _stockController;
  late TextEditingController _priceController;
  late TextEditingController _mrpController;
  bool _isUpdating = false;
  bool _hasChanges = false;

  @override
  void initState() {
    super.initState();
    _stockController = TextEditingController(text: '${widget.product.stock}');
    _priceController = TextEditingController(text: '${widget.product.salePrice.toInt()}');
    _mrpController = TextEditingController(text: '${widget.product.originalPrice?.toInt() ?? widget.product.salePrice.toInt()}');
    
    _stockController.addListener(_checkChanges);
    _priceController.addListener(_checkChanges);
    _mrpController.addListener(_checkChanges);
  }

  @override
  void dispose() {
    _stockController.dispose();
    _priceController.dispose();
    _mrpController.dispose();
    super.dispose();
  }

  void _checkChanges() {
    final newStock = int.tryParse(_stockController.text) ?? 0;
    final newPrice = double.tryParse(_priceController.text) ?? 0;
    final newMrp = double.tryParse(_mrpController.text) ?? 0;
    
    setState(() {
      _hasChanges = newStock != widget.product.stock ||
          newPrice != widget.product.salePrice ||
          newMrp != (widget.product.originalPrice ?? widget.product.salePrice);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.edit_note_rounded, color: AppColors.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Quick Edit',
                  style: TextStyle(
                    color: isDark ? Colors.white : const Color(0xFF111827),
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Icon(Icons.close_rounded, color: Colors.grey[500], size: 22),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            widget.product.name,
            style: TextStyle(color: Colors.grey[500], fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 20),
          
          // Stock Input
          Row(
            children: [
              Expanded(child: _buildField('Stock', _stockController, Icons.inventory_2_rounded, isDark)),
            ],
          ),
          const SizedBox(height: 14),
          
          // Price Row
          Row(
            children: [
              Expanded(child: _buildField('Price (₹)', _priceController, Icons.sell_rounded, isDark)),
              const SizedBox(width: 12),
              Expanded(child: _buildField('MRP (₹)', _mrpController, Icons.local_offer_rounded, isDark)),
            ],
          ),
          const SizedBox(height: 20),
          
          // Quick Stock Buttons
          Text('Quick Stock Adjust:', style: TextStyle(color: Colors.grey[500], fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildQuickButton('-10', -10, isDark),
              const SizedBox(width: 8),
              _buildQuickButton('-5', -5, isDark),
              const SizedBox(width: 8),
              _buildQuickButton('+5', 5, isDark),
              const SizedBox(width: 8),
              _buildQuickButton('+10', 10, isDark),
              const SizedBox(width: 8),
              _buildQuickButton('+50', 50, isDark),
            ],
          ),
          const SizedBox(height: 20),
          
          // Save Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _hasChanges && !_isUpdating ? _saveChanges : null,
              icon: _isUpdating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_rounded, size: 18),
              label: Text(_isUpdating ? 'Saving...' : 'Save Changes'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                disabledBackgroundColor: Colors.grey[400],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, IconData icon, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.grey[500], fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: TextStyle(color: isDark ? Colors.white : Colors.black, fontSize: 16, fontWeight: FontWeight.w700),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppColors.primary, size: 18),
            filled: true,
            fillColor: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.grey[50],
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: AppColors.primary, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuickButton(String label, int delta, bool isDark) {
    final isNegative = delta < 0;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          final current = int.tryParse(_stockController.text) ?? 0;
          final newVal = (current + delta).clamp(0, 999999);
          _stockController.text = '$newVal';
          HapticFeedback.lightImpact();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: (isNegative ? const Color(0xFFEF4444) : const Color(0xFF10B981)).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: (isNegative ? const Color(0xFFEF4444) : const Color(0xFF10B981)).withValues(alpha: 0.3),
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isNegative ? const Color(0xFFEF4444) : const Color(0xFF10B981),
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveChanges() async {
    setState(() => _isUpdating = true);
    
    try {
      final newStock = int.tryParse(_stockController.text) ?? widget.product.stock;
      final newPrice = double.tryParse(_priceController.text) ?? widget.product.salePrice;
      final newMrp = double.tryParse(_mrpController.text) ?? widget.product.originalPrice;
      
      await _firestore.collection('products').doc(widget.product.id).update({
        'stock': newStock,
        'salePrice': newPrice,
        'originalPrice': newMrp,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      // Log stock change
      await _firestore
          .collection('products')
          .doc(widget.product.id)
          .collection('stockHistory')
          .add({
        'previousStock': widget.product.stock,
        'newStock': newStock,
        'change': newStock - widget.product.stock,
        'reason': 'Quick Edit',
        'timestamp': FieldValue.serverTimestamp(),
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white),
                SizedBox(width: 10),
                Text('Product updated!'),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        widget.onUpdated?.call();
        Navigator.pop(context);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }
}

// Helper to show quick editor as bottom sheet
void showQuickStockEditor(BuildContext context, ProductModel product, {VoidCallback? onUpdated}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.dark 
              ? const Color(0xFF1E293B) 
              : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: QuickStockEditor(product: product, onUpdated: onUpdated),
      ),
    ),
  );
}
