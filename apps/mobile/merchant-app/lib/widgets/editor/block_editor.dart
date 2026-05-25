import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

/// Block editor widget for editing individual blocks
class BlockEditor extends StatelessWidget {
  final BlockModel block;
  final ValueChanged<BlockModel> onUpdate;
  final VoidCallback? onDelete;

  const BlockEditor({
    super.key,
    required this.block,
    required this.onUpdate,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Row(
        children: [
          // Drag handle
          Icon(
            Icons.drag_indicator_rounded,
            color: Colors.grey[400],
            size: 20,
          ),
          const SizedBox(width: 8),
          // Icon
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              block.type.icon,
              color: AppColors.primary,
              size: 16,
            ),
          ),
          const SizedBox(width: 12),
          // Content preview
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  block.type.displayName,
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                  ),
                ),
                if (_getPreviewText() != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    _getPreviewText()!,
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey[600],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          // Edit button
          IconButton(
            icon: const Icon(Icons.edit_rounded, size: 18),
            onPressed: () => _showEditDialog(context),
            color: AppColors.primary,
            constraints: const BoxConstraints(),
            padding: const EdgeInsets.all(8),
          ),
          // Delete button
          if (onDelete != null)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18),
              onPressed: onDelete,
              color: Colors.red[400],
              constraints: const BoxConstraints(),
              padding: const EdgeInsets.all(8),
            ),
        ],
      ),
    );
  }

  String? _getPreviewText() {
    final content = block.settings['content'];
    if (content != null && content is String && content.isNotEmpty) {
      return content.length > 50 ? '${content.substring(0, 50)}...' : content;
    }
    return null;
  }

  void _showEditDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => _BlockEditDialog(
        block: block,
        onSave: onUpdate,
      ),
    );
  }
}

class _BlockEditDialog extends StatefulWidget {
  final BlockModel block;
  final ValueChanged<BlockModel> onSave;

  const _BlockEditDialog({
    required this.block,
    required this.onSave,
  });

  @override
  State<_BlockEditDialog> createState() => _BlockEditDialogState();
}

class _BlockEditDialogState extends State<_BlockEditDialog> {
  late Map<String, dynamic> _settings;

  @override
  void initState() {
    super.initState();
    _settings = Map.from(widget.block.settings);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              widget.block.type.icon,
              color: AppColors.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Text(widget.block.type.displayName),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: _buildFields(),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            final updated = widget.block.copyWith(settings: _settings);
            widget.onSave(updated);
            Navigator.pop(context);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
          ),
          child: Text('Save'),
        ),
      ],
    );
  }

  List<Widget> _buildFields() {
    final fields = <Widget>[];

    switch (widget.block.type) {
      case BlockType.text:
        fields.add(_textField('content', 'Content', maxLines: 3));
        break;
      case BlockType.heading:
        fields.add(_textField('content', 'Heading'));
        fields.add(const SizedBox(height: 16));
        fields.add(_dropdown('level', 'Level', {
          'h1': 'H1 - Large',
          'h2': 'H2 - Medium',
          'h3': 'H3 - Small',
        }));
        break;
      case BlockType.image:
        fields.add(_textField('url', 'Image URL'));
        fields.add(const SizedBox(height: 16));
        fields.add(_textField('alt', 'Alt Text'));
        break;
      case BlockType.button:
        fields.add(_textField('label', 'Button Text'));
        fields.add(const SizedBox(height: 16));
        fields.add(_textField('url', 'Link URL'));
        break;
      case BlockType.socialLink:
        fields.add(_textField('text', 'Link Text'));
        fields.add(const SizedBox(height: 16));
        fields.add(_textField('url', 'URL'));
        break;
      default:
        fields.add(_textField('content', 'Content'));
    }

    return fields;
  }

  Widget _textField(String key, String label, {int maxLines = 1}) {
    return TextField(
      controller: TextEditingController(text: _settings[key]?.toString() ?? ''),
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      maxLines: maxLines,
      onChanged: (value) {
        _settings[key] = value;
      },
    );
  }

  Widget _dropdown(String key, String label, Map<String, String> options) {
    return DropdownButtonFormField<String>(
      initialValue: _settings[key]?.toString() ?? options.keys.first,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      items: options.entries.map((e) => DropdownMenuItem(
        value: e.key,
        child: Text(e.value),
      )).toList(),
      onChanged: (value) {
        setState(() {
          _settings[key] = value;
        });
      },
    );
  }
}
