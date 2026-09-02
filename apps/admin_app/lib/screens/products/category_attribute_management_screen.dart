// lib/screens/products/category_attribute_management_screen.dart
// Premium Admin screen for managing category attributes (faceted search)

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:provider/provider.dart';

class CategoryAttributeManagementScreen extends StatefulWidget {
  const CategoryAttributeManagementScreen({super.key});

  @override
  State<CategoryAttributeManagementScreen> createState() =>
      _CategoryAttributeManagementScreenState();
}

class _CategoryAttributeManagementScreenState
    extends State<CategoryAttributeManagementScreen>
    with SingleTickerProviderStateMixin {
  final CategoryAttributeService _service = CategoryAttributeService();
  late TabController _tabController;

  List<CategoryAttributeSchema> _schemas = [];
  List<PendingAttributeRequest> _pendingRequests = [];
  List<CategoryModel> _categories = [];

  bool _isLoading = true;
  String? _selectedCategoryId;
  CategoryAttributeSchema? _selectedSchema;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    try {
      final categoryProvider =
          Provider.of<CategoryProvider>(context, listen: false);
      if (categoryProvider.allCategories.isEmpty) {
        await categoryProvider.loadCategories();
      }
      _categories = categoryProvider.allCategories;

      _schemas = await _service.getAllCategorySchemas();
      
      try {
        _pendingRequests = await _service.getAllPendingRequests();
      } catch (e) {
        // Index may not exist yet
        debugPrint('Pending requests query failed (might need index): $e');
        _pendingRequests = [];
      }
    } catch (e) {
      debugPrint('Error loading data: $e');
    }

    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width > 800;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0A0A) : Colors.grey[50],
      appBar: _buildAppBar(isDark, accentColor),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildAttributesTab(isDark, accentColor, isDesktop),
                _buildPendingTab(isDark, accentColor),
              ],
            ),
      floatingActionButton: _tabController.index == 0 && _selectedCategoryId != null
          ? FloatingActionButton.extended(
              onPressed: () => _showAddAttributeDialog(context, isDark),
              icon: const Icon(Icons.add),
              label: const Text('Add Attribute'),
              backgroundColor: accentColor,
              foregroundColor: Colors.white,
            ).animate().scale(delay: 200.ms, duration: 300.ms)
          : null,
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color accentColor) {
    return AppBar(
      elevation: 0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Category Attributes'),
          Text(
            'Manage product filters & specifications',
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.white60 : Colors.white70,
            ),
          ),
        ],
      ),
      backgroundColor: accentColor,
      foregroundColor: Colors.white,
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded),
          tooltip: 'Refresh',
          onPressed: _loadData,
        ),
        const SizedBox(width: 8),
      ],
      bottom: TabBar(
        controller: _tabController,
        indicatorColor: Colors.white,
        indicatorWeight: 3,
        labelColor: Colors.white,
        unselectedLabelColor: Colors.white54,
        tabs: [
          const Tab(
            icon: Icon(Icons.tune),
            text: 'Attributes',
          ),
          Tab(
            icon: Badge(
              label: Text('${_pendingRequests.length}'),
              isLabelVisible: _pendingRequests.isNotEmpty,
              backgroundColor: Colors.orange,
              child: const Icon(Icons.pending_actions),
            ),
            text: 'Pending',
          ),
        ],
      ),
    );
  }

  // ============================================
  // ATTRIBUTES TAB
  // ============================================
  Widget _buildAttributesTab(bool isDark, Color accentColor, bool isDesktop) {
    if (isDesktop) {
      return Row(
        children: [
          // Left: Category List
          Container(
            width: 320,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
              border: Border(
                right: BorderSide(
                  color: isDark ? Colors.white10 : Colors.grey[200]!,
                ),
              ),
            ),
            child: _buildCategoryList(isDark, accentColor),
          ),
          // Right: Attributes for selected category
          Expanded(
            child: _selectedSchema != null
                ? _buildAttributeList(isDark, accentColor)
                : _buildSelectCategoryPrompt(isDark),
          ),
        ],
      );
    } else {
      // Mobile: Use drawer or bottom sheet pattern
      return Column(
        children: [
          // Category selector header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: InkWell(
              onTap: () => _showCategoryPicker(isDark, accentColor),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.category, color: accentColor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Selected Category',
                            style: TextStyle(
                              color: isDark ? Colors.white54 : Colors.black54,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            _selectedSchema?.displayName ?? 'Tap to select',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.arrow_drop_down, color: accentColor),
                  ],
                ),
              ),
            ),
          ),
          // Attributes list
          Expanded(
            child: _selectedSchema != null
                ? _buildAttributeList(isDark, accentColor)
                : _buildSelectCategoryPrompt(isDark),
          ),
        ],
      );
    }
  }

  Widget _buildSelectCategoryPrompt(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.touch_app_rounded,
              size: 64,
              color: isDark ? Colors.white24 : Colors.grey[400],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Select a Category',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Choose a category to manage its attributes',
            style: TextStyle(color: Colors.grey[600]),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms);
  }

  void _showCategoryPicker(bool isDark, Color accentColor) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return Column(
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Select Category',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final category = _categories[index];
                      final schema = _schemas.firstWhere(
                        (s) => s.categoryId == category.id,
                        orElse: () => CategoryAttributeSchema(
                          categoryId: category.id,
                          displayName: category.name,
                          attributes: [],
                          createdAt: DateTime.now(),
                          updatedAt: DateTime.now(),
                        ),
                      );
                      final isSelected = _selectedCategoryId == category.id;

                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: accentColor.withValues(alpha: 0.2),
                          child: Text(
                            '${schema.attributes.length}',
                            style: TextStyle(
                              color: accentColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        title: Text(
                          category.name,
                          style: TextStyle(
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        subtitle: Text(
                          schema.attributes.isEmpty
                              ? 'No attributes'
                              : '${schema.attributes.length} attributes',
                        ),
                        trailing: isSelected
                            ? Icon(Icons.check_circle, color: accentColor)
                            : null,
                        onTap: () {
                          setState(() {
                            _selectedCategoryId = category.id;
                            _selectedSchema = schema;
                          });
                          Navigator.pop(context);
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildCategoryList(bool isDark, Color accentColor) {
    return Column(
      children: [
        // Header
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark ? Colors.white10 : Colors.grey[200]!,
              ),
            ),
          ),
          child: Row(
            children: [
              Icon(Icons.category, color: accentColor, size: 20),
              const SizedBox(width: 8),
              Text(
                'Categories',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${_categories.length}',
                  style: TextStyle(
                    color: accentColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
        // List
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: _categories.length,
            itemBuilder: (context, index) {
              final category = _categories[index];
              final schema = _schemas.firstWhere(
                (s) => s.categoryId == category.id,
                orElse: () => CategoryAttributeSchema(
                  categoryId: category.id,
                  displayName: category.name,
                  attributes: [],
                  createdAt: DateTime.now(),
                  updatedAt: DateTime.now(),
                ),
              );
              final isSelected = _selectedCategoryId == category.id;

              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                color: isSelected
                    ? accentColor.withValues(alpha: 0.1)
                    : isDark
                        ? const Color(0xFF2A2A2A)
                        : Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                    color: isSelected ? accentColor : Colors.transparent,
                    width: 2,
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    setState(() {
                      _selectedCategoryId = category.id;
                      _selectedSchema = schema;
                    });
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: accentColor.withValues(alpha: 0.2),
                          child: Text(
                            '${schema.attributes.length}',
                            style: TextStyle(
                              color: accentColor,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                category.name,
                                style: TextStyle(
                                  fontWeight: isSelected
                                      ? FontWeight.bold
                                      : FontWeight.w500,
                                  color: isDark ? Colors.white : Colors.black87,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                schema.attributes.isEmpty
                                    ? 'No attributes'
                                    : '${schema.attributes.length} attrs',
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          Icon(Icons.chevron_right, color: accentColor),
                      ],
                    ),
                  ),
                ),
              ).animate().fadeIn(delay: (index * 50).ms);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildAttributeList(bool isDark, Color accentColor) {
    if (_selectedSchema == null) return const SizedBox.shrink();

    final attributes = _selectedSchema!.sortedAttributes;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedSchema!.displayName,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    Text(
                      '${attributes.length} attributes defined',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.filter_list, size: 16, color: Colors.green[700]),
                    const SizedBox(width: 4),
                    Text(
                      '${attributes.where((a) => a.isFilterable).length} Filterable',
                      style: TextStyle(
                        color: Colors.green[700],
                        fontWeight: FontWeight.w500,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          // Content
          if (attributes.isEmpty)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.playlist_add, size: 64, color: Colors.grey[400]),
                    const SizedBox(height: 16),
                    Text(
                      'No attributes defined',
                      style: TextStyle(color: Colors.grey[600], fontSize: 16),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () => _showAddAttributeDialog(context, isDark),
                      icon: const Icon(Icons.add),
                      label: const Text('Add First Attribute'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: accentColor,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                itemCount: attributes.length,
                itemBuilder: (context, index) {
                  final attr = attributes[index];
                  return _buildAttributeCard(attr, isDark, accentColor, index);
                },
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAttributeCard(
    AttributeField attr,
    bool isDark,
    Color accentColor,
    int index,
  ) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _getTypeColor(attr.type).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    _getTypeIcon(attr.type),
                    color: _getTypeColor(attr.type),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        attr.label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Text(
                        'Key: ${attr.key} • ${_getTypeName(attr.type)}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: Icon(
                    Icons.more_vert,
                    color: isDark ? Colors.white54 : Colors.black54,
                  ),
                  onSelected: (value) {
                    if (value == 'edit') {
                      _showEditAttributeDialog(attr, isDark);
                    } else if (value == 'delete') {
                      _deleteAttribute(attr);
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'edit',
                      child: Row(
                        children: [
                          Icon(Icons.edit, size: 18),
                          SizedBox(width: 8),
                          Text('Edit'),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(Icons.delete, size: 18, color: Colors.red),
                          SizedBox(width: 8),
                          Text('Delete', style: TextStyle(color: Colors.red)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            
            // Badges
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (attr.isRequired)
                  _buildBadge('Required', Colors.red, Icons.star),
                if (attr.isFilterable)
                  _buildBadge('Filterable', Colors.green, Icons.filter_list),
                _buildBadge(_getTypeName(attr.type), _getTypeColor(attr.type), _getTypeIcon(attr.type)),
              ],
            ),
            
            // Options
            if (attr.options.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isDark ? Colors.black26 : Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.list, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 6),
                        Text(
                          'Options (${attr.options.length})',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: attr.options.take(8).map((opt) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF3A3A3A) : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark ? Colors.white10 : Colors.grey[300]!,
                            ),
                          ),
                          child: Text(
                            opt,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? Colors.white70 : Colors.black87,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    if (attr.options.length > 8)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '+${attr.options.length - 8} more',
                          style: TextStyle(
                            color: accentColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    ).animate().fadeIn(delay: (index * 100).ms).slideX(begin: 0.05, end: 0);
  }

  Widget _buildBadge(String text, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  // ============================================
  // PENDING TAB
  // ============================================
  Widget _buildPendingTab(bool isDark, Color accentColor) {
    if (_pendingRequests.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.check_circle_outline,
                size: 64,
                color: Colors.green[400],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'All Caught Up!',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No pending attribute requests',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      ).animate().fadeIn(duration: 400.ms);
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _pendingRequests.length,
      itemBuilder: (context, index) {
        final request = _pendingRequests[index];
        return _buildPendingRequestCard(request, isDark, accentColor, index);
      },
    );
  }

  Widget _buildPendingRequestCard(
    PendingAttributeRequest request,
    bool isDark,
    Color accentColor,
    int index,
  ) {
    final category = _categories.firstWhere(
      (c) => c.id == request.categoryId,
      orElse: () => CategoryModel(
        id: request.categoryId,
        name: request.categoryId,
        description: '',
        createdAt: DateTime.now(),
      ),
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      color: isDark ? const Color(0xFF2A2A2A) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.orange.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.pending, color: Colors.orange),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        request.attributeLabel,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black87,
                        ),
                      ),
                      Text(
                        'Key: ${request.attributeKey}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Details
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isDark ? Colors.black26 : Colors.grey[50],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _buildDetailRow('Category', category.name, Icons.category),
                  const SizedBox(height: 8),
                  _buildDetailRow('Sample Value', request.sampleValue, Icons.text_fields),
                  if (request.suggestedOptions.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    _buildDetailRow(
                      'Suggested Options',
                      request.suggestedOptions.join(', '),
                      Icons.list,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Actions
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _rejectRequest(request),
                    icon: const Icon(Icons.close, size: 18),
                    label: const Text('Reject'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: () => _approveRequest(request),
                    icon: const Icon(Icons.check, size: 18),
                    label: const Text('Approve'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ).animate().fadeIn(delay: (index * 100).ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildDetailRow(String label, String value, IconData icon) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: Colors.grey),
        const SizedBox(width: 8),
        SizedBox(
          width: 100,
          child: Text(
            '$label:',
            style: const TextStyle(color: Colors.grey, fontSize: 13),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
          ),
        ),
      ],
    );
  }

  // ============================================
  // DIALOGS
  // ============================================
  Future<void> _showAddAttributeDialog(BuildContext context, bool isDark) async {
    if (_selectedCategoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a category first')),
      );
      return;
    }

    final keyController = TextEditingController();
    final labelController = TextEditingController();
    final optionsController = TextEditingController();
    AttributeType selectedType = AttributeType.enum_;
    bool isFilterable = true;
    bool isRequired = false;

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: isDark ? const Color(0xFF2A2A2A) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.add, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              const Text('Add Attribute'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: keyController,
                  decoration: InputDecoration(
                    labelText: 'Key (snake_case)',
                    hintText: 'e.g., ram_size',
                    prefixIcon: const Icon(Icons.key),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[a-z0-9_]')),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: labelController,
                  decoration: InputDecoration(
                    labelText: 'Display Label',
                    hintText: 'e.g., RAM Size',
                    prefixIcon: const Icon(Icons.label),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<AttributeType>(
                  initialValue: selectedType,
                  decoration: InputDecoration(
                    labelText: 'Type',
                    prefixIcon: const Icon(Icons.category),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  items: AttributeType.values.map((t) {
                    return DropdownMenuItem(
                      value: t,
                      child: Row(
                        children: [
                          Icon(_getTypeIcon(t), size: 18, color: _getTypeColor(t)),
                          const SizedBox(width: 8),
                          Text(_getTypeName(t)),
                        ],
                      ),
                    );
                  }).toList(),
                  onChanged: (v) => setDialogState(() => selectedType = v!),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: optionsController,
                  decoration: InputDecoration(
                    labelText: 'Options (comma separated)',
                    hintText: 'e.g., 4GB, 8GB, 16GB',
                    prefixIcon: const Icon(Icons.list),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      SwitchListTile(
                        title: const Text('Filterable'),
                        subtitle: const Text('Show in marketplace filters'),
                        value: isFilterable,
                        onChanged: (v) => setDialogState(() => isFilterable = v),
                        contentPadding: EdgeInsets.zero,
                      ),
                      SwitchListTile(
                        title: const Text('Required'),
                        subtitle: const Text('Mandatory in seller form'),
                        value: isRequired,
                        onChanged: (v) => setDialogState(() => isRequired = v),
                        contentPadding: EdgeInsets.zero,
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
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final key = keyController.text.trim();
                final label = labelController.text.trim();
                final options = optionsController.text
                    .split(',')
                    .map((e) => e.trim())
                    .where((e) => e.isNotEmpty)
                    .toList();

                if (key.isEmpty || label.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Key and Label are required')),
                  );
                  return;
                }

                final newAttr = AttributeField(
                  key: key,
                  label: label,
                  type: selectedType,
                  options: options,
                  isFilterable: isFilterable,
                  isRequired: isRequired,
                  displayOrder: _selectedSchema?.attributes.length ?? 0,
                );

                if (_selectedSchema == null ||
                    _selectedSchema!.attributes.isEmpty) {
                  await _service.saveCategorySchema(CategoryAttributeSchema(
                    categoryId: _selectedCategoryId!,
                    displayName: _categories
                        .firstWhere((c) => c.id == _selectedCategoryId)
                        .name,
                    attributes: [newAttr],
                    createdAt: DateTime.now(),
                    updatedAt: DateTime.now(),
                  ));
                } else {
                  await _service.addAttributeToCategory(
                    categoryId: _selectedCategoryId!,
                    attribute: newAttr,
                  );
                }

                Navigator.pop(context);
                _loadData();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showEditAttributeDialog(AttributeField attr, bool isDark) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Edit functionality coming soon')),
    );
  }

  Future<void> _deleteAttribute(AttributeField attr) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Attribute?'),
        content: Text('Are you sure you want to delete "${attr.label}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _service.removeAttributeFromCategory(
        categoryId: _selectedCategoryId!,
        attributeKey: attr.key,
      );
      _loadData();
    }
  }

  Future<void> _approveRequest(PendingAttributeRequest request) async {
    final success = await _service.approvePendingRequest(
      requestId: request.id,
      reviewedBy: 'admin',
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Attribute approved and added to category!'),
          backgroundColor: Colors.green,
        ),
      );
      _loadData();
    }
  }

  Future<void> _rejectRequest(PendingAttributeRequest request) async {
    final reasonController = TextEditingController();

    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rejection Reason'),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(
            labelText: 'Reason',
            hintText: 'Why is this attribute being rejected?',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, reasonController.text),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Reject'),
          ),
        ],
      ),
    );

    if (reason != null && reason.isNotEmpty) {
      await _service.rejectPendingRequest(
        requestId: request.id,
        reviewedBy: 'admin',
        rejectionReason: reason,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attribute request rejected')),
        );
      }
      _loadData();
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  Color _getTypeColor(AttributeType type) {
    switch (type) {
      case AttributeType.enum_:
        return Colors.blue;
      case AttributeType.multiSelect:
        return Colors.purple;
      case AttributeType.range:
        return Colors.orange;
      case AttributeType.text:
        return Colors.teal;
      case AttributeType.boolean_:
        return Colors.indigo;
    }
  }

  IconData _getTypeIcon(AttributeType type) {
    switch (type) {
      case AttributeType.enum_:
        return Icons.list;
      case AttributeType.multiSelect:
        return Icons.checklist;
      case AttributeType.range:
        return Icons.linear_scale;
      case AttributeType.text:
        return Icons.text_fields;
      case AttributeType.boolean_:
        return Icons.toggle_on;
    }
  }

  String _getTypeName(AttributeType type) {
    switch (type) {
      case AttributeType.enum_:
        return 'Dropdown';
      case AttributeType.multiSelect:
        return 'Multi-Select';
      case AttributeType.range:
        return 'Range';
      case AttributeType.text:
        return 'Text';
      case AttributeType.boolean_:
        return 'Toggle';
    }
  }
}
