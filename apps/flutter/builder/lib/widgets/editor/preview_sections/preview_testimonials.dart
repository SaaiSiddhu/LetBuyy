import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../../models/store_model.dart';

/// Preview of testimonials section in website preview
/// Applies theme colors from store.templateConfig.themeSettings
class PreviewTestimonials extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;

  const PreviewTestimonials({
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
    final title = settings['title'] as String? ?? 'Customer Reviews';

    // Theme colors
    final themeSettings = store?.templateConfig?.themeSettings;
    final primaryColor = _hexToColor(themeSettings?.primaryColor ?? '#6366F1');
    final accentColor = _hexToColor(themeSettings?.accentColor ?? '#FFD700');
    final fontFamily = themeSettings?.fontFamily ?? 'Inter';

    return Container(
      padding: const EdgeInsets.all(20),
      color: primaryColor.withValues(alpha: 0.03),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: const Color(0xFF1F2937),
              fontFamily: fontFamily,
            ),
          ),
          const SizedBox(height: 16),
          
          // Review cards
          SizedBox(
            height: 120,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: 3,
              itemBuilder: (context, index) => _buildReviewCard(index, primaryColor, accentColor, fontFamily),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewCard(int index, Color primaryColor, Color accentColor, String fontFamily) {
    final names = ['John D.', 'Sarah M.', 'Alex K.'];
    final reviews = [
      'Amazing products and fast delivery!',
      'Best quality I have ever seen.',
      'Highly recommend this store!',
    ];

    // Star color - use accent if it's yellow-ish, otherwise use amber
    final starColor = _isYellowish(accentColor) ? accentColor : Colors.amber[600]!;

    return Container(
      width: 200,
      margin: EdgeInsets.only(right: index < 2 ? 12 : 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: primaryColor.withValues(alpha: 0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(
              5,
              (i) => Icon(Icons.star, size: 14, color: starColor),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            reviews[index],
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[700],
              fontFamily: fontFamily,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const Spacer(),
          Text(
            '— ${names[index]}',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: primaryColor.withValues(alpha: 0.6),
              fontFamily: fontFamily,
            ),
          ),
        ],
      ),
    );
  }

  bool _isYellowish(Color color) {
    final hsl = HSLColor.fromColor(color);
    return hsl.hue >= 40 && hsl.hue <= 70 && hsl.saturation > 0.3;
  }
}
