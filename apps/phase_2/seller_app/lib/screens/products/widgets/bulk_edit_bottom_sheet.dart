// lib/screens/products/widgets/bulk_edit_bottom_sheet.dart
// Bulk Edit Bottom Sheet for Multi-Product Updates

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Bulk Edit Bottom Sheet for editing multiple products at once
class BulkEditBottomSheet extends StatefulWidget {
  final Set<String> selectedProductIds;
  final bool isDark;
  final VoidCallback? onComplete;

  const BulkEditBottomSheet({
    super.key,
    required this.selectedProductIds,
    required this.isDark,
    this.onComplete,
  });

  static Future<void> show(
    BuildContext context, {
    required Set<String> selectedProductIds,
    required bool isDark,
    VoidCallback? onComplete,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => BulkEditBottomSheet(
        selectedProductIds: selectedProductIds,
        isDark: isDark,
        onComplete: onComplete,
      ),
    );
  }

  @override
  State<BulkEditBottomSheet> createState() => _BulkEditBottomSheetState();
}

class _BulkEditBottomSheetState extends State<BulkEditBottomSheet> {
  // Field toggles
  bool _updatePrice = false;
  bool _updateStock = false;
  bool _updateStatus = false;

  // Field values
  final _priceController = TextEditingController();
  String _priceMode = 'set'; // 'set', 'increase_percent', 'decrease_percent'
  
  final _stockController = TextEditingController();
  String _stockMode = 'set'; // 'set', 'increase', 'decrease'
  
  bool _newStatus = true;

  bool _isProcessing = false;

  @override
  void dispose() {
    _priceController.dispose();
    _stockController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: BoxDecoration(
        color: widget.isDark ? const Color(0xFF1A1A2E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 48,
            height: 5,
            decoration: BoxDecoration(
              color: widget.isDark ? Colors.grey[700] : Colors.grey[300],
              borderRadius: BorderRadius.circular(3),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.blue.shade400, Colors.indigo.shade600],
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.edit_note_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bulk Edit',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: widget.isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Text(
                        '${widget.selectedProductIds.length} products selected',
                        style: TextStyle(
                          fontSize: 13,
                          color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(
                    Icons.close_rounded,
                    color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Edit Fields
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Price Field
                  _buildEditField(
                    title: 'Update Price',
                    isEnabled: _updatePrice,
                    onToggle: (v) => setState(() => _updatePrice = v),
                    icon: Icons.attach_money_rounded,
                    color: Colors.green,
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildDropdown(
                            value: _priceMode,
                            items: [
                              ('set', 'Set to'),
                              ('increase_percent', 'Increase %'),
                              ('decrease_percent', 'Decrease %'),
                            ],
                            onChanged: (v) => setState(() => _priceMode = v!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: _buildTextField(
                            controller: _priceController,
                            hint: _priceMode == 'set' ? '₹0.00' : '%',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Stock Field
                  _buildEditField(
                    title: 'Update Stock',
                    isEnabled: _updateStock,
                    onToggle: (v) => setState(() => _updateStock = v),
                    icon: Icons.inventory_2_rounded,
                    color: Colors.orange,
                    child: Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildDropdown(
                            value: _stockMode,
                            items: [
                              ('set', 'Set to'),
                              ('increase', 'Increase by'),
                              ('decrease', 'Decrease by'),
                            ],
                            onChanged: (v) => setState(() => _stockMode = v!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: _buildTextField(
                            controller: _stockController,
                            hint: '0',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Status Field
                  _buildEditField(
                    title: 'Update Status',
                    isEnabled: _updateStatus,
                    onToggle: (v) => setState(() => _updateStatus = v),
                    icon: Icons.toggle_on_rounded,
                    color: Colors.purple,
                    child: Row(
                      children: [
                        _buildStatusOption(true, 'Active', Colors.green),
                        const SizedBox(width: 12),
                        _buildStatusOption(false, 'Inactive', Colors.grey),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Action Buttons
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: widget.isDark ? Colors.black26 : Colors.grey.shade50,
              border: Border(
                top: BorderSide(
                  color: widget.isDark ? Colors.white10 : Colors.grey.shade200,
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: _canApply ? _applyChanges : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isProcessing
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Apply Changes',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  bool get _canApply => (_updatePrice || _updateStock || _updateStatus) && !_isProcessing;

  Widget _buildEditField({
    required String title,
    required bool isEnabled,
    required ValueChanged<bool> onToggle,
    required IconData icon,
    required Color color,
    required Widget child,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isEnabled
            ? color.withValues(alpha: widget.isDark ? 0.15 : 0.08)
            : (widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isEnabled ? color.withValues(alpha: 0.4) : Colors.transparent,
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: isEnabled ? color : Colors.grey),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: isEnabled
                        ? (widget.isDark ? Colors.white : Colors.black87)
                        : Colors.grey[600],
                  ),
                ),
              ),
              Switch(
                value: isEnabled,
                onChanged: onToggle,
                activeThumbColor: color,
              ),
            ],
          ),
          if (isEnabled) ...[
            const SizedBox(height: 12),
            child,
          ],
        ],
      ),
    );
  }

  Widget _buildDropdown({
    required String value,
    required List<(String, String)> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: widget.isDark ? Colors.white24 : Colors.grey.shade300,
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          dropdownColor: widget.isDark ? const Color(0xFF2A2A3E) : Colors.white,
          style: TextStyle(
            color: widget.isDark ? Colors.white : Colors.black87,
            fontSize: 14,
          ),
          items: items.map((item) {
            return DropdownMenuItem(value: item.$1, child: Text(item.$2));
          }).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      style: TextStyle(color: widget.isDark ? Colors.white : Colors.black87),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey[500]),
        filled: true,
        fillColor: widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: widget.isDark ? Colors.white24 : Colors.grey.shade300,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(
            color: widget.isDark ? Colors.white24 : Colors.grey.shade300,
          ),
        ),
      ),
    );
  }

  Widget _buildStatusOption(bool value, String label, Color color) {
    final isSelected = _newStatus == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _newStatus = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? color.withValues(alpha: 0.2) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? color : Colors.grey.withValues(alpha: 0.3),
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                size: 18,
                color: isSelected ? color : Colors.grey,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? color : Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _applyChanges() async {
    if (!_canApply) return;

    setState(() => _isProcessing = true);
    HapticFeedback.mediumImpact();

    try {
      final firestore = FirebaseFirestore.instance;
      final batch = firestore.batch();

      for (final productId in widget.selectedProductIds) {
        final ref = firestore.collection('products').doc(productId);
        final updates = <String, dynamic>{};

        // Price update
        if (_updatePrice && _priceController.text.isNotEmpty) {
          final value = double.tryParse(_priceController.text) ?? 0;
          if (_priceMode == 'set') {
            updates['price'] = value;
          } else {
            // For percentage changes, we need to get current price first
            final doc = await ref.get();
            if (doc.exists) {
              final currentPrice = (doc.data()?['price'] ?? 0).toDouble();
              if (_priceMode == 'increase_percent') {
                updates['price'] = currentPrice * (1 + value / 100);
              } else {
                updates['price'] = currentPrice * (1 - value / 100);
              }
            }
          }
        }

        // Stock update
        if (_updateStock && _stockController.text.isNotEmpty) {
          final value = int.tryParse(_stockController.text) ?? 0;
          if (_stockMode == 'set') {
            updates['stock'] = value;
          } else {
            final doc = await ref.get();
            if (doc.exists) {
              final currentStock = (doc.data()?['stock'] ?? 0) as int;
              if (_stockMode == 'increase') {
                updates['stock'] = currentStock + value;
              } else {
                updates['stock'] = (currentStock - value).clamp(0, 999999);
              }
            }
          }
        }

        // Status update
        if (_updateStatus) {
          updates['isActive'] = _newStatus;
        }

        if (updates.isNotEmpty) {
          updates['updatedAt'] = FieldValue.serverTimestamp();
          batch.update(ref, updates);
        }
      }

      await batch.commit();

      if (mounted) {
        Navigator.pop(context);
        widget.onComplete?.call();
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Updated ${widget.selectedProductIds.length} products'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }
}
