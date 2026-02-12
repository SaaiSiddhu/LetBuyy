import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../../models/store_model.dart';

/// Preview of about section in website preview
/// Applies theme colors from store.templateConfig.themeSettings
class PreviewAbout extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;

  const PreviewAbout({
    super.key,
    required this.section,
    this.store,
  });

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final settings = section.settings;
    final title = settings['title'] as String? ?? 'About Us';
    final content = settings['content'] as String? ?? 
        'We are passionate about bringing you the best products with exceptional quality and service.';

    // Theme colors
    final themeSettings = store?.templateConfig?.themeSettings;
    final primaryColor = _hexToColor(themeSettings?.primaryColor ?? '#6366F1');
    final fontFamily = themeSettings?.fontFamily ?? 'Inter';

    return Container(
      padding: const EdgeInsets.all(24),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Decorative line
          Container(
            width: 40,
            height: 3,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: primaryColor,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Text(
            title,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF1F2937),
              fontFamily: fontFamily,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            content,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
              height: 1.6,
              fontFamily: fontFamily,
            ),
            textAlign: TextAlign.center,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
