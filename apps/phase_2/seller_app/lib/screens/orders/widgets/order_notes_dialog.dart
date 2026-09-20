// lib/screens/orders/widgets/order_notes_dialog.dart
// Order Notes & Internal Tags Dialog

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:intl/intl.dart';

/// Order notes and tags model
class OrderNote {
  final String text;
  final DateTime createdAt;
  final String? createdBy;

  OrderNote({
    required this.text,
    required this.createdAt,
    this.createdBy,
  });

  Map<String, dynamic> toMap() => {
    'text': text,
    'createdAt': Timestamp.fromDate(createdAt),
    'createdBy': createdBy,
  };

  factory OrderNote.fromMap(Map<String, dynamic> map) => OrderNote(
    text: map['text'] ?? '',
    createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    createdBy: map['createdBy'],
  );
}

/// Predefined tags for orders
class OrderTags {
  static const List<TagInfo> available = [
    TagInfo('VIP', Icons.star_rounded, Colors.amber),
    TagInfo('Risky', Icons.warning_rounded, Colors.red),
    TagInfo('Fragile', Icons.warning_amber_rounded, Colors.orange),
    TagInfo('High Return', Icons.replay_rounded, Colors.purple),
    TagInfo('Gift', Icons.card_giftcard_rounded, Colors.pink),
    TagInfo('Verified', Icons.verified_rounded, Colors.green),
    TagInfo('Priority', Icons.priority_high_rounded, Colors.blue),
    TagInfo('Repeat Issue', Icons.error_rounded, Colors.deepOrange),
  ];
}

class TagInfo {
  final String name;
  final IconData icon;
  final Color color;

  const TagInfo(this.name, this.icon, this.color);
}

/// Order Notes Dialog
class OrderNotesDialog extends StatefulWidget {
  final String orderId;
  final List<String> currentTags;
  final List<OrderNote> currentNotes;
  final Function(List<String> tags, OrderNote? newNote) onSave;

  const OrderNotesDialog({
    super.key,
    required this.orderId,
    required this.currentTags,
    required this.currentNotes,
    required this.onSave,
  });

  static Future<void> show(
    BuildContext context, {
    required String orderId,
    required List<String> currentTags,
    required List<OrderNote> currentNotes,
    required Function(List<String> tags, OrderNote? newNote) onSave,
  }) {
    return showDialog(
      context: context,
      builder: (context) => OrderNotesDialog(
        orderId: orderId,
        currentTags: currentTags,
        currentNotes: currentNotes,
        onSave: onSave,
      ),
    );
  }

  @override
  State<OrderNotesDialog> createState() => _OrderNotesDialogState();
}

class _OrderNotesDialogState extends State<OrderNotesDialog> {
  late List<String> _selectedTags;
  final TextEditingController _noteController = TextEditingController();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _selectedTags = List.from(widget.currentTags);
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: isDark ? const Color(0xFF1A1A2E) : Colors.white,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 400, maxHeight: 600),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  Icon(Icons.notes_rounded, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Text(
                    'Order Notes & Tags',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: Icon(
                      Icons.close_rounded,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),

            // Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Quick Tags
                    _buildSectionHeader('Quick Tags', Icons.label_rounded, isDark),
                    const SizedBox(height: 12),
                    _buildTagsGrid(isDark),
                    
                    const SizedBox(height: 24),
                    
                    // Add Note
                    _buildSectionHeader('Add Note', Icons.edit_note_rounded, isDark),
                    const SizedBox(height: 12),
                    _buildNoteInput(isDark),
                    
                    const SizedBox(height: 24),
                    
                    // Note History
                    if (widget.currentNotes.isNotEmpty) ...[
                      _buildSectionHeader('History', Icons.history_rounded, isDark),
                      const SizedBox(height: 12),
                      _buildNoteHistory(isDark),
                    ],
                  ],
                ),
              ),
            ),
            
            // Actions
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(
                    color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
                  ),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _isSaving ? null : _saveNotes,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.save_rounded, size: 18),
                                SizedBox(width: 8),
                                Text('Save Notes'),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildTagsGrid(bool isDark) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: OrderTags.available.map((tag) {
        final isSelected = _selectedTags.contains(tag.name);
        return GestureDetector(
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() {
              if (isSelected) {
                _selectedTags.remove(tag.name);
              } else {
                _selectedTags.add(tag.name);
              }
            });
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isSelected 
                  ? tag.color.withValues(alpha: 0.15)
                  : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100]),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isSelected ? tag.color : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isSelected ? Icons.check_circle_rounded : tag.icon,
                  size: 16,
                  color: isSelected ? tag.color : Colors.grey,
                ),
                const SizedBox(width: 6),
                Text(
                  tag.name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    color: isSelected ? tag.color : (isDark ? Colors.grey[400] : Colors.grey[600]),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildNoteInput(bool isDark) {
    return TextField(
      controller: _noteController,
      maxLines: 3,
      decoration: InputDecoration(
        hintText: 'Add an internal note about this order...',
        hintStyle: TextStyle(color: Colors.grey[500]),
        filled: true,
        fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.primary),
        ),
        contentPadding: const EdgeInsets.all(14),
      ),
      style: TextStyle(color: isDark ? Colors.white : Colors.black87),
    );
  }

  Widget _buildNoteHistory(bool isDark) {
    return Column(
      children: widget.currentNotes.take(5).map((note) {
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50],
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.1),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                note.text,
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                _formatNoteTime(note.createdAt),
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey[500],
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  String _formatNoteTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    }
    return DateFormat('MMM d').format(date);
  }

  void _saveNotes() async {
    setState(() => _isSaving = true);
    
    OrderNote? newNote;
    if (_noteController.text.trim().isNotEmpty) {
      newNote = OrderNote(
        text: _noteController.text.trim(),
        createdAt: DateTime.now(),
      );
    }
    
    widget.onSave(_selectedTags, newNote);
    
    await Future.delayed(const Duration(milliseconds: 300));
    if (mounted) {
      Navigator.pop(context);
    }
  }
}

/// Display selected tags as chips
class OrderTagsDisplay extends StatelessWidget {
  final List<String> tags;
  final bool compact;

  const OrderTagsDisplay({
    super.key,
    required this.tags,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (tags.isEmpty) return const SizedBox.shrink();

    final displayTags = tags.take(compact ? 2 : 4).toList();
    final remaining = tags.length - displayTags.length;

    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        ...displayTags.map((tagName) {
          final tagInfo = OrderTags.available.firstWhere(
            (t) => t.name == tagName,
            orElse: () => TagInfo(tagName, Icons.label_rounded, Colors.grey),
          );
          return Container(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 6 : 8,
              vertical: compact ? 2 : 4,
            ),
            decoration: BoxDecoration(
              color: tagInfo.color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(tagInfo.icon, size: compact ? 10 : 12, color: tagInfo.color),
                SizedBox(width: compact ? 2 : 4),
                Text(
                  tagName,
                  style: TextStyle(
                    fontSize: compact ? 9 : 10,
                    fontWeight: FontWeight.w600,
                    color: tagInfo.color,
                  ),
                ),
              ],
            ),
          );
        }),
        if (remaining > 0)
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 6 : 8,
              vertical: compact ? 2 : 4,
            ),
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '+$remaining',
              style: TextStyle(
                fontSize: compact ? 9 : 10,
                fontWeight: FontWeight.w600,
                color: Colors.grey[600],
              ),
            ),
          ),
      ],
    );
  }
}
