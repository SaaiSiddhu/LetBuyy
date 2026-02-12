import 'package:flutter/material.dart';

/// Color picker row with swatch and edit button
class ColorPickerRow extends StatelessWidget {
  final String label;
  final String hexColor;
  final VoidCallback onTap;

  const ColorPickerRow({
    super.key,
    required this.label,
    required this.hexColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = _hexToColor(hexColor);
    
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey[300]!),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.3),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
      ),
      title: Text(label),
      subtitle: Text(hexColor.toUpperCase()),
      trailing: const Icon(Icons.edit_rounded, size: 20),
      onTap: onTap,
    );
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) {
      hex = 'FF$hex';
    }
    return Color(int.parse(hex, radix: 16));
  }
}

/// Color section with multiple color pickers
class ColorSection extends StatelessWidget {
  final String primaryColor;
  final String secondaryColor;
  final String accentColor;
  final ValueChanged<String> onPrimaryChange;
  final ValueChanged<String> onSecondaryChange;
  final ValueChanged<String> onAccentChange;

  const ColorSection({
    super.key,
    required this.primaryColor,
    required this.secondaryColor,
    required this.accentColor,
    required this.onPrimaryChange,
    required this.onSecondaryChange,
    required this.onAccentChange,
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
        children: [
          ColorPickerRow(
            label: 'Primary',
            hexColor: primaryColor,
            onTap: () => _showColorDialog(context, 'Primary', primaryColor, onPrimaryChange),
          ),
          const Divider(),
          ColorPickerRow(
            label: 'Secondary',
            hexColor: secondaryColor,
            onTap: () => _showColorDialog(context, 'Secondary', secondaryColor, onSecondaryChange),
          ),
          const Divider(),
          ColorPickerRow(
            label: 'Accent',
            hexColor: accentColor,
            onTap: () => _showColorDialog(context, 'Accent', accentColor, onAccentChange),
          ),
        ],
      ),
    );
  }

  void _showColorDialog(
    BuildContext context,
    String label,
    String currentHex,
    ValueChanged<String> onChange,
  ) {
    final controller = TextEditingController(text: currentHex);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$label Color'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Hex Color',
            hintText: '#00B3B3',
            prefixText: '#',
          ),
          maxLength: 6,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final hex = '#${controller.text.replaceAll('#', '')}';
              onChange(hex);
              Navigator.pop(context);
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }
}
