// lib/screens/orders/widgets/shipping_label_generator.dart
// Professional E-Commerce Shipping Label Generator (Amazon/Flipkart Grade)
// VERSION 4.0 - Final Compact 4x6 Thermal Label

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:barcode/barcode.dart';
import 'package:intl/intl.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../../providers/seller_provider.dart';

// ═══════════════════════════════════════════════════════════════════════════
// SHIPPING LABEL GENERATOR - AMAZON/FLIPKART CARRIER-GRADE (COMPACT)
// ═══════════════════════════════════════════════════════════════════════════

class ShippingLabelGenerator {
  final OrderModel order;
  final SellerModel seller;

  // Standard thermal label size: 4x6 inches
  static const double labelWidth = 4 * PdfPageFormat.inch;
  static const double labelHeight = 6 * PdfPageFormat.inch;

  ShippingLabelGenerator({
    required this.order,
    required this.seller,
  });

  Future<void> printLabel({bool preview = true}) async {
    final pdfBytes = await generateLabelPdf();
    
    if (preview) {
      await Printing.layoutPdf(
        onLayout: (format) => pdfBytes,
        name: 'ShippingLabel_${order.orderNumber}',
        format: PdfPageFormat(labelWidth, labelHeight),
      );
    } else {
      await Printing.sharePdf(
        bytes: pdfBytes,
        filename: 'ShippingLabel_${order.orderNumber}.pdf',
      );
    }
  }

  Future<Uint8List> generateLabelPdf() async {
    final pdf = pw.Document();
    
    final regularFont = await PdfGoogleFonts.robotoRegular();
    final boldFont = await PdfGoogleFonts.robotoBold();
    
    pw.MemoryImage? logoImage;
    try {
      final logoBytes = await rootBundle.load('assets/icons/app_icon.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}
    
    final barcodeData = order.orderNumber;
    final barcode = Barcode.code128();
    
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat(labelWidth, labelHeight),
        margin: const pw.EdgeInsets.all(3),
        build: (context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(5),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(width: 1), // Thinner border
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.stretch,
              children: [
                // ─────────────────────────────────────────────────────────
                // 1. HEADER (Logo smaller + Brand + Payment)
                // ─────────────────────────────────────────────────────────
                _buildHeader(logoImage, boldFont, regularFont),
                pw.Container(height: 1, color: PdfColors.black),
                
                // ─────────────────────────────────────────────────────────
                // 2. SHIP TO (Compact but prominent PIN)
                // ─────────────────────────────────────────────────────────
                _buildShipToSection(boldFont, regularFont),
                pw.Container(height: 0.5, color: PdfColors.grey400),
                
                // ─────────────────────────────────────────────────────────
                // 3. RETURN TO (Single line compact)
                // ─────────────────────────────────────────────────────────
                _buildReturnToSection(boldFont, regularFont),
                pw.Container(height: 1, color: PdfColors.black),
                
                // ─────────────────────────────────────────────────────────
                // 4. AWB BARCODE (Scannable)
                // ─────────────────────────────────────────────────────────
                _buildBarcodeSection(barcode, barcodeData, boldFont, regularFont),
                pw.Container(height: 0.5, color: PdfColors.grey400),
                
                // ─────────────────────────────────────────────────────────
                // 5. ORDER META BLOCK (Critical for operations)
                // ─────────────────────────────────────────────────────────
                _buildOrderMetaBlock(boldFont, regularFont),
                pw.Container(height: 0.5, color: PdfColors.grey400),
                
                // ─────────────────────────────────────────────────────────
                // 6. ROUTE / HUB / ZONE
                // ─────────────────────────────────────────────────────────
                _buildRoutingSection(boldFont, regularFont),
                
                // ─────────────────────────────────────────────────────────
                // 7. RTO FOOTER ("If undelivered...")
                // ─────────────────────────────────────────────────────────
                pw.Container(height: 0.5, color: PdfColors.grey300),
                _buildFooter(boldFont, regularFont),
              ],
            ),
          );
        },
      ),
    );

    return pdf.save();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION BUILDERS (Compact)
  // ═══════════════════════════════════════════════════════════════════════════

  pw.Widget _buildHeader(pw.MemoryImage? logo, pw.Font boldFont, pw.Font regularFont) {
    final isCod = order.paymentMethod.toUpperCase() == 'COD';
    
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 3),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          // Logo (SMALLER - 10-15% reduced) + Brand
          pw.Row(
            children: [
              if (logo != null)
                pw.Image(logo, width: 18, height: 18), // Reduced from 22
              pw.SizedBox(width: 5),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('LETBUYY', style: pw.TextStyle(font: boldFont, fontSize: 9)),
                  pw.Text('Standard Shipping', style: pw.TextStyle(font: regularFont, fontSize: 6, color: PdfColors.grey700)),
                ],
              ),
            ],
          ),
          
          // Payment Badge
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: pw.BoxDecoration(
              color: isCod ? PdfColors.black : PdfColors.white,
              border: pw.Border.all(width: 1),
            ),
            child: pw.Column(
              children: [
                pw.Text(isCod ? 'COD' : 'PREPAID', style: pw.TextStyle(font: boldFont, fontSize: 9, color: isCod ? PdfColors.white : PdfColors.black)),
                if (isCod)
                  pw.Text('₹${order.total.toInt()}', style: pw.TextStyle(font: boldFont, fontSize: 8, color: PdfColors.white)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  pw.Widget _buildShipToSection(pw.Font boldFont, pw.Font regularFont) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            color: PdfColors.black,
            child: pw.Text('SHIP TO', style: pw.TextStyle(color: PdfColors.white, fontSize: 6, font: boldFont)),
          ),
          pw.SizedBox(height: 3),
          pw.Text(order.deliveryAddress.name.toUpperCase(), style: pw.TextStyle(font: boldFont, fontSize: 11)),
          pw.SizedBox(height: 2),
          pw.Text(_formatDeliveryAddress(), style: pw.TextStyle(font: regularFont, fontSize: 8, lineSpacing: 1)),
          pw.SizedBox(height: 2),
          pw.Text('Tel: ${order.deliveryAddress.phone}', style: pw.TextStyle(font: boldFont, fontSize: 8)),
          pw.SizedBox(height: 4),
          // PIN - PROMINENT
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(width: 2),
              color: PdfColors.grey100,
            ),
            child: pw.Text('PIN: ${order.deliveryAddress.zipcode}', style: pw.TextStyle(font: boldFont, fontSize: 14, letterSpacing: 1)),
          ),
        ],
      ),
    );
  }

  pw.Widget _buildReturnToSection(pw.Font boldFont, pw.Font regularFont) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      color: PdfColors.grey100,
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('RETURN TO:', style: pw.TextStyle(font: boldFont, fontSize: 5, color: PdfColors.grey700)),
                pw.Text('${seller.storeName.toUpperCase()} | ${seller.businessCity}, ${seller.businessState} - ${seller.businessPincode}', 
                  style: pw.TextStyle(font: regularFont, fontSize: 6), maxLines: 1),
              ],
            ),
          ),
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text('Tel: ${seller.businessContact}', style: pw.TextStyle(font: regularFont, fontSize: 5)),
              if (seller.gstNumber.isNotEmpty)
                pw.Text('GST: ${seller.gstNumber}', style: pw.TextStyle(font: boldFont, fontSize: 5)),
            ],
          ),
        ],
      ),
    );
  }

  pw.Widget _buildBarcodeSection(Barcode barcode, String data, pw.Font boldFont, pw.Font regularFont) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Center(
        child: pw.Column(
          children: [
            // Barcode
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 3),
              color: PdfColors.white,
              child: pw.BarcodeWidget(
                barcode: barcode,
                data: data,
                height: 45,
                width: 180,
                drawText: false,
              ),
            ),
            pw.SizedBox(height: 2),
            pw.Text('Code128', style: pw.TextStyle(font: regularFont, fontSize: 4, color: PdfColors.grey500)),
            pw.SizedBox(height: 1),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
              child: pw.Text('AWB: $data', style: pw.TextStyle(font: boldFont, fontSize: 9, letterSpacing: 1)),
            ),
          ],
        ),
      ),
    );
  }

  pw.Widget _buildOrderMetaBlock(pw.Font boldFont, pw.Font regularFont) {
    final dateFormat = DateFormat('dd-MMM-yy');
    final itemCount = order.items.fold(0, (sum, item) => sum + item.quantity);
    final estimatedWeight = (itemCount * 0.5).toStringAsFixed(1);
    
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 3, horizontal: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
        children: [
          _buildMetaItem('Order ID', order.orderNumber, boldFont, regularFont),
          _buildMetaItem('Items', '$itemCount', boldFont, regularFont),
          _buildMetaItem('Weight', '$estimatedWeight kg', boldFont, regularFont),
          _buildMetaItem('Payment', order.paymentMethod.toUpperCase(), boldFont, regularFont),
          _buildMetaItem('Date', dateFormat.format(order.createdAt), boldFont, regularFont),
        ],
      ),
    );
  }

  pw.Widget _buildMetaItem(String label, String value, pw.Font bold, pw.Font regular) {
    return pw.Column(
      children: [
        pw.Text(label, style: pw.TextStyle(font: regular, fontSize: 4, color: PdfColors.grey600)),
        pw.Text(value, style: pw.TextStyle(font: bold, fontSize: 6)),
      ],
    );
  }

  pw.Widget _buildRoutingSection(pw.Font boldFont, pw.Font regularFont) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      color: PdfColors.grey200,
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text('Route: ${_generateRouteCode()}', style: pw.TextStyle(font: boldFont, fontSize: 6)),
          pw.Text('Hub: ${_generateHubCode()}', style: pw.TextStyle(font: boldFont, fontSize: 6)),
          pw.Text('Zone: ${_generateZoneCode()}', style: pw.TextStyle(font: boldFont, fontSize: 6)),
        ],
      ),
    );
  }

  pw.Widget _buildFooter(pw.Font boldFont, pw.Font regularFont) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          // RTO Instruction - TRUST SIGNAL
          pw.Text('If undelivered, return to sender.', style: pw.TextStyle(font: regularFont, fontSize: 5, color: PdfColors.grey600)),
          pw.Row(
            children: [
              pw.Text('LetBuyy', style: pw.TextStyle(font: regularFont, fontSize: 4, color: PdfColors.grey400)),
              pw.SizedBox(width: 6),
              pw.Text('1/1', style: pw.TextStyle(font: boldFont, fontSize: 5)),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  String _formatDeliveryAddress() {
    final addr = order.deliveryAddress;
    final parts = <String>[
      addr.addressLine1,
      if (addr.addressLine2.isNotEmpty) addr.addressLine2,
      if (addr.landmark != null && addr.landmark!.isNotEmpty) 'Nr ${addr.landmark}',
      '${addr.city}, ${addr.state}',
    ];
    return parts.join('\n');
  }

  String _generateRouteCode() {
    final state = order.deliveryAddress.state.length >= 2 ? order.deliveryAddress.state.substring(0, 2).toUpperCase() : order.deliveryAddress.state.toUpperCase();
    final city = order.deliveryAddress.city.length >= 3 ? order.deliveryAddress.city.substring(0, 3).toUpperCase() : order.deliveryAddress.city.toUpperCase();
    return '$state-$city';
  }

  String _generateHubCode() => order.deliveryAddress.city.toUpperCase();

  String _generateZoneCode() {
    final state = order.deliveryAddress.state.length >= 2 ? order.deliveryAddress.state.substring(0, 2).toUpperCase() : order.deliveryAddress.state.toUpperCase();
    final pin = order.deliveryAddress.zipcode;
    final region = pin.isNotEmpty ? pin.substring(0, 1) : 'X';
    return '$state-$region';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHIPPING LABEL PREVIEW DIALOG
// ═══════════════════════════════════════════════════════════════════════════

class ShippingLabelPreviewDialog extends StatefulWidget {
  final OrderModel order;

  const ShippingLabelPreviewDialog({super.key, required this.order});

  @override
  State<ShippingLabelPreviewDialog> createState() => _ShippingLabelPreviewDialogState();
}

class _ShippingLabelPreviewDialogState extends State<ShippingLabelPreviewDialog> {
  Uint8List? _pdfBytes;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _generatePreview();
  }

  Future<void> _generatePreview() async {
    try {
      final seller = Provider.of<SellerProvider>(context, listen: false).currentSeller;
      if (seller == null) {
        setState(() { _error = 'Seller details not available'; _isLoading = false; });
        return;
      }

      final generator = ShippingLabelGenerator(order: widget.order, seller: seller);
      final bytes = await generator.generateLabelPdf();
      
      if (mounted) setState(() { _pdfBytes = bytes; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final seller = Provider.of<SellerProvider>(context).currentSeller;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400, maxHeight: 700),
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildHeader(context, isDark),
            Flexible(child: _buildContent(isDark)),
            if (seller != null && _pdfBytes != null) _buildActions(context, isDark, seller),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceVariant : AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        border: Border(bottom: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border)),
      ),
      child: Row(
        children: [
          Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Shipping Label', style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontWeight: FontWeight.bold, fontSize: 16)),
                Text('#${widget.order.orderNumber}', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontSize: 12)),
              ],
            ),
          ),
          IconButton(onPressed: () => Navigator.pop(context), icon: Icon(Icons.close, color: isDark ? Colors.grey[400] : Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildContent(bool isDark) {
    if (_isLoading) {
      return const Center(child: Padding(padding: EdgeInsets.all(40), child: Column(mainAxisSize: MainAxisSize.min, children: [CircularProgressIndicator(), SizedBox(height: 16), Text('Generating label...')])));
    }
    if (_error != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.error_outline, color: Colors.red, size: 48), const SizedBox(height: 16), Text('Error', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: isDark ? Colors.white : Colors.black87)), const SizedBox(height: 8), Text(_error!, textAlign: TextAlign.center)])));
    }
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border), borderRadius: BorderRadius.circular(8)),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: PdfPreview(build: (format) => _pdfBytes!, canChangePageFormat: false, canChangeOrientation: false, canDebug: false, allowPrinting: false, allowSharing: false, maxPageWidth: 350, pdfPreviewPageDecoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8)])),
      ),
    );
  }

  Widget _buildActions(BuildContext context, bool isDark, SellerModel seller) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceVariant : AppColors.background,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
        border: Border(top: BorderSide(color: isDark ? AppColors.borderDark : AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () async { final gen = ShippingLabelGenerator(order: widget.order, seller: seller); await gen.printLabel(preview: false); },
              icon: const Icon(Icons.download_rounded, size: 18),
              label: const Text('Download'),
              style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () async { final gen = ShippingLabelGenerator(order: widget.order, seller: seller); await gen.printLabel(preview: true); },
              icon: const Icon(Icons.print_rounded, size: 18, color: Colors.white),
              label: const Text('Print', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, padding: const EdgeInsets.symmetric(vertical: 14), elevation: 2, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            ),
          ),
        ],
      ),
    );
  }
}
