// lib/services/product_export_service.dart
// Product Export Service for PDF and CSV generation

import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:csv/csv.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class ProductExportService {
  /// Export products to PDF
  static Future<void> exportToPdf({
    required BuildContext context,
    required List<Map<String, dynamic>> products,
    required String storeName,
  }) async {
    final pdf = pw.Document();
    final dateFormat = DateFormat('MMM dd, yyyy');
    final currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    // Calculate totals
    double totalValue = 0;
    int totalStock = 0;
    for (final p in products) {
      totalValue += ((p['price'] ?? 0) as num).toDouble() * ((p['stock'] ?? 0) as int);
      totalStock += (p['stock'] ?? 0) as int;
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        build: (context) => [
          // Header
          pw.Container(
            padding: const pw.EdgeInsets.only(bottom: 20),
            decoration: const pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey300, width: 2)),
            ),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Container(
                  width: 50,
                  height: 50,
                  decoration: pw.BoxDecoration(
                    color: PdfColor.fromHex('#0F5257'),
                    borderRadius: pw.BorderRadius.circular(8),
                  ),
                  child: pw.Center(
                    child: pw.Text('LB', style: pw.TextStyle(color: PdfColors.white, fontSize: 20, fontWeight: pw.FontWeight.bold)),
                  ),
                ),
                pw.SizedBox(width: 16),
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('PRODUCT INVENTORY REPORT', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
                      pw.SizedBox(height: 4),
                      pw.Text('Store: $storeName', style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey600)),
                      pw.Text('Date: ${dateFormat.format(DateTime.now())}', style: const pw.TextStyle(fontSize: 12, color: PdfColors.grey600)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          pw.SizedBox(height: 20),

          // Summary Box
          pw.Container(
            padding: const pw.EdgeInsets.all(16),
            decoration: pw.BoxDecoration(
              color: PdfColor.fromHex('#F0F9FF'),
              borderRadius: pw.BorderRadius.circular(8),
              border: pw.Border.all(color: PdfColor.fromHex('#0F5257'), width: 1),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
              children: [
                _buildSummaryItem('Total Products', '${products.length}'),
                _buildSummaryItem('Total Value', currencyFormat.format(totalValue)),
                _buildSummaryItem('Total Stock', '$totalStock units'),
              ],
            ),
          ),

          pw.SizedBox(height: 24),

          // Table Header
          pw.Text('PRODUCT DETAILS', style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 12),

          // Table
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey300),
            columnWidths: {
              0: const pw.FixedColumnWidth(30),
              1: const pw.FlexColumnWidth(3),
              2: const pw.FixedColumnWidth(70),
              3: const pw.FixedColumnWidth(50),
              4: const pw.FixedColumnWidth(60),
              5: const pw.FixedColumnWidth(60),
            },
            children: [
              // Header row
              pw.TableRow(
                decoration: pw.BoxDecoration(color: PdfColor.fromHex('#0F5257')),
                children: [
                  _buildTableHeader('#'),
                  _buildTableHeader('Product'),
                  _buildTableHeader('Price'),
                  _buildTableHeader('Stock'),
                  _buildTableHeader('SKU'),
                  _buildTableHeader('Status'),
                ],
              ),
              // Data rows
              ...products.asMap().entries.map((entry) {
                final i = entry.key;
                final p = entry.value;
                return pw.TableRow(
                  decoration: pw.BoxDecoration(
                    color: i % 2 == 0 ? PdfColors.white : PdfColors.grey100,
                  ),
                  children: [
                    _buildTableCell('${i + 1}'),
                    _buildTableCell(p['name'] ?? 'Unnamed', align: pw.TextAlign.left),
                    _buildTableCell(currencyFormat.format(p['price'] ?? 0)),
                    _buildTableCell('${p['stock'] ?? 0}'),
                    _buildTableCell(p['sku'] ?? '-'),
                    _buildTableCell((p['isActive'] ?? true) ? 'Active' : 'Inactive'),
                  ],
                );
              }),
            ],
          ),

          pw.SizedBox(height: 30),

          // Footer
          pw.Container(
            alignment: pw.Alignment.center,
            child: pw.Text(
              'Generated by LetBuyy Seller App',
              style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey500),
            ),
          ),
        ],
      ),
    );

    // Print/Share the PDF
    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Products_${DateFormat('yyyyMMdd').format(DateTime.now())}.pdf',
    );
  }

  static pw.Widget _buildSummaryItem(String label, String value) {
    return pw.Column(
      children: [
        pw.Text(value, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: PdfColor.fromHex('#0F5257'))),
        pw.SizedBox(height: 4),
        pw.Text(label, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
      ],
    );
  }

  static pw.Widget _buildTableHeader(String text) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      child: pw.Text(
        text,
        style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
        textAlign: pw.TextAlign.center,
      ),
    );
  }

  static pw.Widget _buildTableCell(String text, {pw.TextAlign align = pw.TextAlign.center}) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(8),
      child: pw.Text(text, style: const pw.TextStyle(fontSize: 9), textAlign: align),
    );
  }

  /// Export products to CSV
  static Future<void> exportToCsv({
    required BuildContext context,
    required List<Map<String, dynamic>> products,
    required String storeName,
  }) async {
    final dateFormat = DateFormat('yyyy-MM-dd');

    // Build CSV data
    final List<List<dynamic>> rows = [
      // Header row
      ['Product Name', 'SKU', 'Price', 'Stock', 'Status', 'Orders', 'Revenue', 'Category', 'Created'],
    ];

    for (final p in products) {
      rows.add([
        p['name'] ?? '',
        p['sku'] ?? '',
        p['price'] ?? 0,
        p['stock'] ?? 0,
        (p['isActive'] ?? true) ? 'Active' : 'Inactive',
        p['totalOrders'] ?? 0,
        p['totalRevenue'] ?? 0,
        p['categoryName'] ?? p['categoryId'] ?? '',
        p['createdAt'] != null ? dateFormat.format((p['createdAt'] as dynamic).toDate()) : '',
      ]);
    }

    final csvContent = const ListToCsvConverter().convert(rows);

    if (kIsWeb) {
      // Web: Show download dialog through share
      await Share.share(csvContent, subject: 'Products Export');
    } else {
      // Mobile: Save and share file
      final directory = await getApplicationDocumentsDirectory();
      final fileName = 'Products_${DateFormat('yyyyMMdd').format(DateTime.now())}.csv';
      final file = File('${directory.path}/$fileName');
      await file.writeAsString(csvContent);

      await Share.shareXFiles([XFile(file.path)], subject: 'Products Export');
    }
  }
}
