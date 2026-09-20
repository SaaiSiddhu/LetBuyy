// lib/screens/products/widgets/export_options_sheet.dart
// Export Options Bottom Sheet for PDF and CSV export

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import '../../../providers/seller_provider.dart';
import '../../../services/product_export_service.dart';

/// Export Options Bottom Sheet
class ExportOptionsSheet extends StatefulWidget {
  final Set<String> selectedProductIds;
  final bool isDark;

  const ExportOptionsSheet({
    super.key,
    required this.selectedProductIds,
    required this.isDark,
  });

  static Future<void> show(
    BuildContext context, {
    required Set<String> selectedProductIds,
    required bool isDark,
  }) {
    return showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => ExportOptionsSheet(
        selectedProductIds: selectedProductIds,
        isDark: isDark,
      ),
    );
  }

  @override
  State<ExportOptionsSheet> createState() => _ExportOptionsSheetState();
}

class _ExportOptionsSheetState extends State<ExportOptionsSheet> {
  bool _isExporting = false;
  String _exportStatus = '';

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
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
            width: 48,
            height: 5,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: widget.isDark ? Colors.grey[700] : Colors.grey[300],
              borderRadius: BorderRadius.circular(3),
            ),
          ),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.blue.shade400, Colors.indigo.shade600],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.file_download_rounded, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Export Products',
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

          const SizedBox(height: 24),

          // Export Options
          if (_isExporting)
            _buildExportProgress()
          else
            Row(
              children: [
                Expanded(
                  child: _buildExportOption(
                    icon: Icons.picture_as_pdf_rounded,
                    label: 'PDF',
                    subtitle: 'Professional Report',
                    color: Colors.red,
                    onTap: () => _exportPdf(context),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildExportOption(
                    icon: Icons.table_chart_rounded,
                    label: 'CSV',
                    subtitle: 'Spreadsheet Data',
                    color: Colors.green,
                    onTap: () => _exportCsv(context),
                  ),
                ),
              ],
            ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildExportOption({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.mediumImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: color.withValues(alpha: widget.isDark ? 0.15 : 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.3), width: 1.5),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 32, color: color),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: widget.isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildExportProgress() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(
            _exportStatus,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: widget.isDark ? Colors.white : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _exportPdf(BuildContext context) async {
    setState(() {
      _isExporting = true;
      _exportStatus = 'Fetching products...';
    });

    try {
      final products = await _fetchProducts();
      final sellerName = Provider.of<SellerProvider>(context, listen: false).storeName ?? 'My Store';

      setState(() => _exportStatus = 'Generating PDF...');

      await ProductExportService.exportToPdf(
        context: context,
        products: products,
        storeName: sellerName,
      );

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Export failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isExporting = false);
      }
    }
  }

  Future<void> _exportCsv(BuildContext context) async {
    setState(() {
      _isExporting = true;
      _exportStatus = 'Fetching products...';
    });

    try {
      final products = await _fetchProducts();
      final sellerName = Provider.of<SellerProvider>(context, listen: false).storeName ?? 'My Store';

      setState(() => _exportStatus = 'Generating CSV...');

      await ProductExportService.exportToCsv(
        context: context,
        products: products,
        storeName: sellerName,
      );

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Export failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isExporting = false);
      }
    }
  }

  Future<List<Map<String, dynamic>>> _fetchProducts() async {
    final List<Map<String, dynamic>> products = [];
    
    for (final id in widget.selectedProductIds) {
      final doc = await FirebaseFirestore.instance.collection('products').doc(id).get();
      if (doc.exists) {
        products.add({...doc.data()!, 'id': doc.id});
      }
    }
    
    return products;
  }
}
