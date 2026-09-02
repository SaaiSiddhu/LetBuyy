import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class ExportButton extends StatelessWidget {
  final Function(String format) onExport;
  final bool isDark;

  const ExportButton({super.key, required this.onExport, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: Icon(Icons.file_download_rounded, color: isDark ? AppColors.textPrimary : AppColors.white),
      tooltip: 'Export',
      onSelected: onExport,
      itemBuilder: (context) => const [
        PopupMenuItem(value: 'pdf', child: Row(children: [Icon(Icons.picture_as_pdf_rounded, size: 20), SizedBox(width: 12), Text('Export as PDF')])),
        PopupMenuItem(value: 'csv', child: Row(children: [Icon(Icons.table_chart_rounded, size: 20), SizedBox(width: 12), Text('Export as CSV')])),
        PopupMenuItem(value: 'excel', child: Row(children: [Icon(Icons.grid_on_rounded, size: 20), SizedBox(width: 12), Text('Export as Excel')])),
        PopupMenuItem(value: 'json', child: Row(children: [Icon(Icons.code_rounded, size: 20), SizedBox(width: 12), Text('Export as JSON')])),
      ],
    );
  }
}