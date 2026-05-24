import 'package:flutter/material.dart';

/// Font selector dropdown
class FontSelector extends StatelessWidget {
  final String label;
  final String selectedFont;
  final ValueChanged<String> onChanged;

  const FontSelector({
    super.key,
    required this.label,
    required this.selectedFont,
    required this.onChanged,
  });

  static const _fonts = [
    'Inter',
    'Poppins',
    'Roboto',
    'Nunito',
    'Outfit',
    'Playfair Display',
    'Montserrat',
    'Open Sans',
    'Lato',
    'Raleway',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _fonts.contains(selectedFont) ? selectedFont : _fonts.first,
          decoration: InputDecoration(
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
          ),
          items: _fonts.map((font) => DropdownMenuItem(
            value: font,
            child: Text(
              font,
              style: TextStyle(fontFamily: font),
            ),
          )).toList(),
          onChanged: (value) {
            if (value != null) {
              onChanged(value);
            }
          },
        ),
      ],
    );
  }
}

/// Typography section with body and heading font selectors
class TypographySection extends StatelessWidget {
  final String bodyFont;
  final String headingFont;
  final ValueChanged<String> onBodyFontChange;
  final ValueChanged<String> onHeadingFontChange;

  const TypographySection({
    super.key,
    required this.bodyFont,
    required this.headingFont,
    required this.onBodyFontChange,
    required this.onHeadingFontChange,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FontSelector(
            label: 'Body Font',
            selectedFont: bodyFont,
            onChanged: onBodyFontChange,
          ),
          const SizedBox(height: 16),
          FontSelector(
            label: 'Heading Font',
            selectedFont: headingFont,
            onChanged: onHeadingFontChange,
          ),
        ],
      ),
    );
  }
}
