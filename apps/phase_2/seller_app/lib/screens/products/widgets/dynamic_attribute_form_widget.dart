// lib/screens/products/widgets/dynamic_attribute_form_widget.dart
// 💎 PREMIUM Dynamic Attribute Form Widget for Seller Product Form

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

/// A premium widget that displays dynamic product attributes based on category schema
class DynamicAttributeFormWidget extends StatefulWidget {
  final String? categoryId;
  final Map<String, dynamic> attributes;
  final Map<String, dynamic>? pendingAttributes;
  final Function(Map<String, dynamic> attributes, Map<String, dynamic>? pending) onChanged;
  final String? sellerId;
  final bool isDark;

  const DynamicAttributeFormWidget({
    super.key,
    required this.categoryId,
    required this.attributes,
    this.pendingAttributes,
    required this.onChanged,
    this.sellerId,
    required this.isDark,
  });

  @override
  State<DynamicAttributeFormWidget> createState() => _DynamicAttributeFormWidgetState();
}

class _DynamicAttributeFormWidgetState extends State<DynamicAttributeFormWidget> {
  final CategoryAttributeService _service = CategoryAttributeService();
  
  CategoryAttributeSchema? _schema;
  bool _isLoading = false;
  String? _error;
  
  late Map<String, dynamic> _localAttributes;
  late Map<String, dynamic> _localPendingAttributes;
  
  // Controllers for custom attribute dialog
  final _customKeyController = TextEditingController();
  final _customLabelController = TextEditingController();
  final _customValueController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _localAttributes = Map.from(widget.attributes);
    _localPendingAttributes = Map.from(widget.pendingAttributes ?? {});
    if (widget.categoryId != null) {
      _loadSchema();
    }
  }

  @override
  void didUpdateWidget(DynamicAttributeFormWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    if (oldWidget.categoryId != widget.categoryId) {
      _loadSchema();
    }
    
    // Sync local state when parent props change (e.g., after Firestore update)
    if (oldWidget.attributes != widget.attributes) {
      _localAttributes = Map.from(widget.attributes);
    }
    if (oldWidget.pendingAttributes != widget.pendingAttributes) {
      _localPendingAttributes = Map.from(widget.pendingAttributes ?? {});
    }
  }

  @override
  void dispose() {
    _customKeyController.dispose();
    _customLabelController.dispose();
    _customValueController.dispose();
    super.dispose();
  }

  Future<void> _loadSchema() async {
    if (widget.categoryId == null) return;
    
    setState(() {
      _isLoading = true;
      _error = null;
    });
    
    try {
      _schema = await _service.getCategorySchema(widget.categoryId!);
    } catch (e) {
      _error = 'Failed to load attributes: $e';
      debugPrint('Error loading schema: $e');
    }
    
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  void _notifyChange() {
    widget.onChanged(_localAttributes, _localPendingAttributes.isEmpty ? null : _localPendingAttributes);
  }

  Color get _accentColor => widget.isDark ? const Color(0xFF6C63FF) : const Color(0xFF4A42E8);
  Color get _cardColor => widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white;
  Color get _textColor => widget.isDark ? Colors.white : Colors.black87;
  Color get _subtextColor => widget.isDark ? Colors.white60 : Colors.black54;

  @override
  Widget build(BuildContext context) {
    if (widget.categoryId == null) {
      return _buildNoCategoryState();
    }

    if (_isLoading) {
      return _buildLoadingState();
    }

    if (_error != null) {
      return _buildErrorState();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header Section
        _buildHeader(),
        const SizedBox(height: 20),

        // Schema Attributes Section
        if (_schema != null && _schema!.attributes.isNotEmpty)
          _buildSchemaAttributesSection()
        else
          _buildEmptySchemaState(),

        // Pending Attributes Section
        if (_localPendingAttributes.isNotEmpty) ...[
          const SizedBox(height: 24),
          _buildPendingAttributesSection(),
        ],

        // Add Custom Attribute Button
        const SizedBox(height: 20),
        _buildAddCustomButton(),
      ],
    );
  }

  Widget _buildNoCategoryState() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.amber.withValues(alpha: widget.isDark ? 0.15 : 0.1),
            Colors.orange.withValues(alpha: widget.isDark ? 0.1 : 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.category_outlined, color: Colors.amber, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Select a Category First',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.amber[700],
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Category-specific attributes will appear here once you select a category above.',
                  style: TextStyle(color: Colors.amber[600], fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn().slideX(begin: -0.1);
  }

  Widget _buildLoadingState() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              valueColor: AlwaysStoppedAnimation(_accentColor),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Loading category attributes...',
            style: TextStyle(color: _subtextColor),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.red.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 48),
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _loadSchema,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final filledCount = _localAttributes.values.where((v) => v != null && v.toString().isNotEmpty).length;
    final totalCount = _schema?.attributes.length ?? 0;
    final requiredCount = _schema?.attributes.where((a) => a.isRequired).length ?? 0;
    final filledRequired = _schema?.attributes.where((a) => 
        a.isRequired && _localAttributes[a.key] != null && _localAttributes[a.key].toString().isNotEmpty
    ).length ?? 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            _accentColor.withValues(alpha: 0.15),
            _accentColor.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _accentColor.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _accentColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.tune, color: _accentColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Product Attributes',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: _textColor,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Fill in details for better search visibility',
                  style: TextStyle(color: _subtextColor, fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: filledCount == totalCount 
                      ? Colors.green.withValues(alpha: 0.2)
                      : _accentColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '$filledCount / $totalCount',
                  style: TextStyle(
                    color: filledCount == totalCount ? Colors.green : _accentColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              if (requiredCount > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    '$filledRequired/$requiredCount required',
                    style: TextStyle(
                      color: filledRequired == requiredCount ? Colors.green : Colors.orange,
                      fontSize: 10,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: -0.1);
  }

  Widget _buildSchemaAttributesSection() {
    return Column(
      children: _schema!.sortedAttributes.asMap().entries.map((entry) {
        final index = entry.key;
        final attr = entry.value;
        return _buildAttributeCard(attr, index);
      }).toList(),
    );
  }

  Widget _buildAttributeCard(AttributeField attr, int index) {
    final currentValue = _localAttributes[attr.key];
    final isFilled = currentValue != null && currentValue.toString().isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isFilled 
              ? Colors.green.withValues(alpha: 0.4)
              : (widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: widget.isDark ? 0.2 : 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: attr.isRequired || isFilled,
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isFilled 
                  ? Colors.green.withValues(alpha: 0.1)
                  : _accentColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              _getAttributeIcon(attr),
              color: isFilled ? Colors.green : _accentColor,
              size: 20,
            ),
          ),
          title: Row(
            children: [
              Expanded(
                child: Text(
                  attr.label,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: _textColor,
                    fontSize: 14,
                  ),
                ),
              ),
              if (attr.isRequired)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Required',
                    style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              if (isFilled) ...[
                const SizedBox(width: 8),
                const Icon(Icons.check_circle, color: Colors.green, size: 18),
              ],
            ],
          ),
          subtitle: isFilled
              ? Text(
                  _formatValue(currentValue),
                  style: TextStyle(color: Colors.green[600], fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                )
              : Text(
                  'Tap to ${attr.type == AttributeType.enum_ || attr.type == AttributeType.multiSelect ? 'select' : 'enter'}',
                  style: TextStyle(color: _subtextColor, fontSize: 12),
                ),
          children: [
            _buildFieldByType(attr, currentValue),
          ],
        ),
      ),
    ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: 0.05);
  }

  IconData _getAttributeIcon(AttributeField attr) {
    switch (attr.key.toLowerCase()) {
      case 'color':
        return Icons.palette_outlined;
      case 'size':
        return Icons.straighten_outlined;
      case 'ram':
        return Icons.memory_outlined;
      case 'storage':
        return Icons.sd_storage_outlined;
      case 'material':
        return Icons.texture_outlined;
      case 'brand':
        return Icons.label_outline;
      case 'weight':
        return Icons.fitness_center_outlined;
      default:
        return Icons.label_outline;
    }
  }

  String _formatValue(dynamic value) {
    if (value is List) {
      return value.join(', ');
    }
    return value.toString();
  }

  Widget _buildFieldByType(AttributeField attr, dynamic currentValue) {
    switch (attr.type) {
      case AttributeType.enum_:
        return _buildEnumField(attr, currentValue as String?);
      case AttributeType.multiSelect:
        return _buildMultiSelectField(attr, (currentValue as List<dynamic>?)?.cast<String>() ?? []);
      case AttributeType.boolean_:
        return _buildBooleanField(attr, currentValue as bool?);
      case AttributeType.range:
      case AttributeType.text:
      default:
        return _buildTextField(attr, currentValue?.toString());
    }
  }

  Widget _buildEnumField(AttributeField attr, String? currentValue) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: attr.options.map((option) {
        final isSelected = currentValue == option;
        return ChoiceChip(
          label: Text(option),
          selected: isSelected,
          onSelected: (selected) {
            setState(() {
              _localAttributes[attr.key] = selected ? option : null;
            });
            _notifyChange();
            HapticFeedback.selectionClick();
          },
          selectedColor: _accentColor.withValues(alpha: 0.2),
          backgroundColor: widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
          labelStyle: TextStyle(
            color: isSelected ? _accentColor : _textColor,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(
              color: isSelected ? _accentColor : Colors.transparent,
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildMultiSelectField(AttributeField attr, List<String> selectedValues) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: attr.options.map((option) {
        final isSelected = selectedValues.contains(option);
        return FilterChip(
          label: Text(option),
          selected: isSelected,
          onSelected: (selected) {
            setState(() {
              if (selected) {
                _localAttributes[attr.key] = [...selectedValues, option];
              } else {
                _localAttributes[attr.key] = selectedValues.where((v) => v != option).toList();
              }
            });
            _notifyChange();
            HapticFeedback.selectionClick();
          },
          selectedColor: _accentColor.withValues(alpha: 0.2),
          backgroundColor: widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
          checkmarkColor: _accentColor,
          labelStyle: TextStyle(
            color: isSelected ? _accentColor : _textColor,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(
              color: isSelected ? _accentColor : Colors.transparent,
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildBooleanField(AttributeField attr, bool? currentValue) {
    return SwitchListTile(
      value: currentValue ?? false,
      onChanged: (value) {
        setState(() => _localAttributes[attr.key] = value);
        _notifyChange();
        HapticFeedback.selectionClick();
      },
      title: Text('Enable ${attr.label}', style: TextStyle(color: _textColor)),
      activeThumbColor: _accentColor,
      contentPadding: EdgeInsets.zero,
    );
  }

  Widget _buildTextField(AttributeField attr, String? currentValue) {
    return TextFormField(
      initialValue: currentValue ?? '',
      decoration: InputDecoration(
        hintText: 'Enter ${attr.label.toLowerCase()}',
        hintStyle: TextStyle(color: _subtextColor),
        filled: true,
        fillColor: widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: _accentColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      style: TextStyle(color: _textColor),
      onChanged: (value) {
        _localAttributes[attr.key] = value.isEmpty ? null : value;
        _notifyChange();
      },
    );
  }

  Widget _buildEmptySchemaState() {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: widget.isDark ? Colors.white10 : Colors.grey[200]!),
      ),
      child: Column(
        children: [
          Icon(Icons.inventory_2_outlined, size: 56, color: _subtextColor),
          const SizedBox(height: 16),
          Text(
            'No Attributes Defined',
            style: TextStyle(fontWeight: FontWeight.bold, color: _textColor, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'This category doesn\'t have specific attributes yet.\nYou can add custom attributes below.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _subtextColor, fontSize: 13),
          ),
        ],
      ),
    ).animate().fadeIn();
  }

  Widget _buildPendingAttributesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.orange.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.pending_actions, color: Colors.orange, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Pending Approval',
                      style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange, fontSize: 14),
                    ),
                    Text(
                      '${_localPendingAttributes.length} attribute(s) awaiting admin review',
                      style: TextStyle(color: Colors.orange[600], fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        
        // Pending Items
        ..._localPendingAttributes.entries.map((entry) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.orange.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.orange.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.hourglass_top, color: Colors.orange, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.key,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: _textColor,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.value.toString(),
                      style: TextStyle(color: _subtextColor, fontSize: 12),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                onPressed: () {
                  setState(() => _localPendingAttributes.remove(entry.key));
                  _notifyChange();
                  HapticFeedback.lightImpact();
                },
                tooltip: 'Remove',
              ),
            ],
          ),
        )),
      ],
    ).animate().fadeIn().slideY(begin: 0.05);
  }

  Widget _buildAddCustomButton() {
    return OutlinedButton.icon(
      onPressed: _showAddCustomAttributeDialog,
      icon: Icon(Icons.add_circle_outline, color: _accentColor),
      label: Text('Add Custom Attribute', style: TextStyle(color: _accentColor)),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(double.infinity, 52),
        side: BorderSide(color: _accentColor.withValues(alpha: 0.5)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ).animate().fadeIn(delay: 200.ms);
  }

  Future<void> _showAddCustomAttributeDialog() async {
    _customKeyController.clear();
    _customLabelController.clear();
    _customValueController.clear();

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: widget.isDark ? const Color(0xFF2A2A2A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: _accentColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.add_box, color: _accentColor, size: 24),
            ),
            const SizedBox(width: 12),
            const Text('Add Custom Attribute'),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _customKeyController,
                decoration: InputDecoration(
                  labelText: 'Attribute Key',
                  hintText: 'e.g., refresh_rate',
                  prefixIcon: const Icon(Icons.key),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[a-z0-9_]')),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _customLabelController,
                decoration: InputDecoration(
                  labelText: 'Display Name',
                  hintText: 'e.g., Refresh Rate',
                  prefixIcon: const Icon(Icons.label_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _customValueController,
                decoration: InputDecoration(
                  labelText: 'Value',
                  hintText: 'e.g., 120Hz',
                  prefixIcon: const Icon(Icons.text_fields),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.amber[700], size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Custom attributes require admin approval before appearing in marketplace filters.',
                        style: TextStyle(color: Colors.amber[700], fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: _subtextColor)),
          ),
          ElevatedButton(
            onPressed: () async {
              final key = _customKeyController.text.trim();
              final label = _customLabelController.text.trim();
              final value = _customValueController.text.trim();

              if (key.isEmpty || label.isEmpty || value.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('All fields are required'), backgroundColor: Colors.red),
                );
                return;
              }

              // Add to pending attributes (use key, not label)
              setState(() {
                _localPendingAttributes[key] = value;
              });
              
              // Create pending request in Firestore
              if (widget.sellerId != null && widget.categoryId != null) {
                await _service.createPendingRequest(
                  categoryId: widget.categoryId!,
                  sellerId: widget.sellerId!,
                  attributeKey: key,
                  attributeLabel: label,
                  attributeType: AttributeType.text,
                  suggestedOptions: [],
                  sampleValue: value,
                );
              }
              
              _notifyChange();
              Navigator.pop(context);
              
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Custom attribute added! Awaiting admin approval.'),
                  backgroundColor: Colors.orange,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _accentColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Add Attribute'),
          ),
        ],
      ),
    );
  }
}
