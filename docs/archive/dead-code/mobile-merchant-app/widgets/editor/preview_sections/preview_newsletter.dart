import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../../models/store_model.dart';

/// Preview of newsletter section in website preview
/// Applies theme colors from store.templateConfig.themeSettings
class PreviewNewsletter extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;

  const PreviewNewsletter({
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
    final title = settings['title'] as String? ?? 'Stay Updated';
    final subtitle = settings['subtitle'] as String? ?? 'Subscribe to our newsletter for exclusive offers and updates.';
    final buttonText = settings['buttonText'] as String? ?? 'Subscribe';
    
    // Theme colors
    final themeSettings = store?.templateConfig?.themeSettings;
    final primaryColor = _hexToColor(themeSettings?.primaryColor ?? '#8B5CF6');
    final fontFamily = themeSettings?.fontFamily ?? 'Inter';
    
    // Light background derived from primary
    final bgColor = primaryColor.withValues(alpha: 0.05);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      color: bgColor,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: primaryColor.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.mail, color: primaryColor, size: 28),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF1F2937),
              fontFamily: fontFamily,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
              fontFamily: fontFamily,
            ),
          ),
          const SizedBox(height: 24),
          
          // Newsletter form mock
          Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'Enter your email',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[400],
                        fontFamily: fontFamily,
                      ),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: primaryColor,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    buttonText,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: fontFamily,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 16),
          Text(
            'We respect your privacy. Unsubscribe at any time.',
            style: TextStyle(
              fontSize: 10,
              color: Colors.grey[400],
              fontFamily: fontFamily,
            ),
          ),
        ],
      ),
    );
  }
}
