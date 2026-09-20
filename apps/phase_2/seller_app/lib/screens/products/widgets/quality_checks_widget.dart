// lib/screens/products/widgets/quality_checks_widget.dart
// Quality Validation Widget for Pre-Submit Checks

import 'package:flutter/material.dart';
import '../../../services/hsn_gst_service.dart';

/// Quality Check Result
class QualityCheck {
  final String label;
  final bool passed;
  final String? errorMessage;
  final IconData icon;

  const QualityCheck({
    required this.label,
    required this.passed,
    this.errorMessage,
    required this.icon,
  });
}

/// Quality Checks Widget
class QualityChecksWidget extends StatelessWidget {
  final String? productName;
  final List<String> images;
  final double sellingPrice;
  final double originalPrice;
  final int stock;
  final String? hsnCode;
  final GstRateInfo? gstInfo;
  final SellerGstStatus sellerGstStatus;
  final String? manufacturer;
  final String? countryOfOrigin;
  final bool isDark;

  const QualityChecksWidget({
    super.key,
    required this.productName,
    required this.images,
    required this.sellingPrice,
    required this.originalPrice,
    required this.stock,
    required this.hsnCode,
    required this.gstInfo,
    required this.sellerGstStatus,
    required this.manufacturer,
    required this.countryOfOrigin,
    required this.isDark,
  });

  List<QualityCheck> get _checks => [
    // Product Name
    QualityCheck(
      label: 'Product Name',
      passed: productName != null && productName!.isNotEmpty && productName!.length >= 3,
      errorMessage: productName == null || productName!.isEmpty ? 'Name required' : 'Name too short',
      icon: Icons.title,
    ),
    
    // Primary Image
    QualityCheck(
      label: 'Primary Image (1:1)',
      passed: images.isNotEmpty,
      errorMessage: 'At least 1 image required',
      icon: Icons.image,
    ),
    
    // Price Valid
    QualityCheck(
      label: 'Price Valid',
      passed: sellingPrice > 0 && (originalPrice == 0 || sellingPrice <= originalPrice),
      errorMessage: sellingPrice <= 0 ? 'Price required' : 'Selling price > MRP',
      icon: Icons.attach_money,
    ),
    
    // Stock
    QualityCheck(
      label: 'Stock Quantity',
      passed: stock >= 1,
      errorMessage: 'Stock must be at least 1',
      icon: Icons.inventory_2,
    ),
    
    // HSN Code
    QualityCheck(
      label: 'HSN Code',
      passed: hsnCode != null && hsnCode!.length >= 4,
      errorMessage: 'Valid HSN code required',
      icon: Icons.numbers,
    ),
    
    // GST Eligibility
    QualityCheck(
      label: 'GST Status',
      passed: gstInfo == null || HsnGstService.canSellerListProduct(
        sellerStatus: sellerGstStatus,
        gstInfo: gstInfo!,
      ),
      errorMessage: HsnGstService.getValidationMessage(
        sellerStatus: sellerGstStatus,
        gstInfo: gstInfo ?? GstRateInfo.unknown(''),
      ),
      icon: Icons.receipt_long,
    ),
    
    // Manufacturer
    QualityCheck(
      label: 'Manufacturer Name',
      passed: manufacturer != null && manufacturer!.isNotEmpty,
      errorMessage: 'Manufacturer required',
      icon: Icons.factory,
    ),
    
    // Country of Origin
    QualityCheck(
      label: 'Country of Origin',
      passed: countryOfOrigin != null && countryOfOrigin!.isNotEmpty,
      errorMessage: 'Country of origin required',
      icon: Icons.flag,
    ),
  ];

  int get passedCount => _checks.where((c) => c.passed).length;
  int get totalCount => _checks.length;
  bool get allPassed => passedCount == totalCount;

  @override
  Widget build(BuildContext context) {
    final checks = _checks;
    final failedChecks = checks.where((c) => !c.passed).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: allPassed
            ? (isDark ? Colors.green.withValues(alpha: 0.1) : Colors.green.shade50)
            : (isDark ? Colors.red.withValues(alpha: 0.1) : Colors.red.shade50),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: allPassed ? Colors.green.withValues(alpha: 0.3) : Colors.red.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(
                allPassed ? Icons.check_circle : Icons.warning_rounded,
                color: allPassed ? Colors.green : Colors.red,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'Quality Validation',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: allPassed ? Colors.green : Colors.red,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$passedCount/$totalCount',
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Checks List
          ...checks.map((check) => _buildCheckRow(check)),
          
          // Failed Summary
          if (!allPassed) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Fix ${failedChecks.length} issue${failedChecks.length > 1 ? 's' : ''} before submitting',
                      style: TextStyle(color: Colors.red.shade700, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],
          
          // Ready message
          if (allPassed) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.green, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'All checks passed! Ready to submit.',
                      style: TextStyle(color: Colors.green.shade700, fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCheckRow(QualityCheck check) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: check.passed ? Colors.green.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: Icon(
              check.passed ? Icons.check : Icons.close,
              size: 14,
              color: check.passed ? Colors.green : Colors.red,
            ),
          ),
          const SizedBox(width: 12),
          Icon(check.icon, size: 16, color: isDark ? Colors.grey[400] : Colors.grey[600]),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  check.label,
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontSize: 13,
                  ),
                ),
                if (!check.passed && check.errorMessage != null)
                  Text(
                    check.errorMessage!,
                    style: TextStyle(color: Colors.red.shade400, fontSize: 11),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
