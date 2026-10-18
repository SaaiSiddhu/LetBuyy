import 'package:flutter/material.dart';

class ProductOriginDisclosure extends StatelessWidget {
  const ProductOriginDisclosure({
    super.key,
    this.countryOfOrigin,
    this.importerDetails,
  });

  final String? countryOfOrigin;
  final String? importerDetails;

  @override
  Widget build(BuildContext context) {
    final origin = countryOfOrigin?.trim();
    final importer = importerDetails?.trim();
    if ((origin == null || origin.isEmpty) &&
        (importer == null || importer.isEmpty)) {
      return const SizedBox.shrink();
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final secondaryColor = isDark ? Colors.grey[300] : Colors.grey[700];
    final mutedColor = isDark ? Colors.grey[400] : Colors.grey[600];

    return Semantics(
      container: true,
      label: 'Origin and importer information',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? Colors.grey[800]! : Colors.grey[200]!,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Origin and importer information',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            if (origin != null && origin.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Country of origin',
                style: TextStyle(
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                origin,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: secondaryColor,
                ),
              ),
            ],
            if (importer != null && importer.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Importer details',
                style: TextStyle(
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                importer,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: secondaryColor,
                ),
              ),
            ],
            const SizedBox(height: 10),
            Text(
              'Provided by the seller; not independently verified by LetBuyy.',
              style: TextStyle(fontSize: 12, height: 1.4, color: mutedColor),
            ),
          ],
        ),
      ),
    );
  }
}
