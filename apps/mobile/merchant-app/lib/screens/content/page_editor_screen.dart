import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:provider/provider.dart';

import '../../services/cms_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart';

class PageEditorScreen extends StatefulWidget {
  const PageEditorScreen({super.key, required this.storeId, this.page});

  final String storeId;
  final PageContract? page;

  @override
  State<PageEditorScreen> createState() => _PageEditorScreenState();
}

class _PageEditorScreenState extends State<PageEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _slugController;
  late final TextEditingController _bodyController;
  late final TextEditingController _seoTitleController;
  late final TextEditingController _seoDescriptionController;
  late final TextEditingController _displayOrderController;
  late String _status;
  late String _pageType;
  late bool _showInNav;
  bool _isSaving = false;

  bool get _isEditing => widget.page != null;

  @override
  void initState() {
    super.initState();
    final page = widget.page;
    _titleController = TextEditingController(text: page?.title ?? '');
    _slugController = TextEditingController(text: page?.slug ?? '');
    _bodyController = TextEditingController(
      text: page == null ? '' : _pageBody(page),
    );
    _seoTitleController = TextEditingController(
      text: page == null ? '' : _seoValue(page, 'title'),
    );
    _seoDescriptionController = TextEditingController(
      text: page == null ? '' : _seoValue(page, 'description'),
    );
    _displayOrderController = TextEditingController(
      text: page?.intValue('display_order').toString() ?? '0',
    );
    _status = page?.status == 'published' ? 'published' : 'draft';
    _pageType = page?.stringValue('page_type', fallback: 'custom') ?? 'custom';
    _showInNav = page?.boolValue('show_in_nav') ?? false;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _slugController.dispose();
    _bodyController.dispose();
    _seoTitleController.dispose();
    _seoDescriptionController.dispose();
    _displayOrderController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _isSaving) return;
    setState(() => _isSaving = true);

    final input = CmsPageInput(
      storeId: widget.storeId,
      title: _titleController.text,
      slug: _slugController.text,
      body: _bodyController.text,
      pageType: _pageType,
      status: _status,
      showInNav: _showInNav,
      seoTitle: _seoTitleController.text,
      seoDescription: _seoDescriptionController.text,
      displayOrder: int.tryParse(_displayOrderController.text.trim()) ?? 0,
    );

    try {
      if (_isEditing) {
        await context.read<CmsService>().updatePage(widget.page!.id, input);
      } else {
        await context.read<CmsService>().createPage(input);
      }
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
              children: [
                _buildHeader(colors),
                const SizedBox(height: 16),
                _buildContentSection(colors),
                const SizedBox(height: 14),
                _buildPublishSection(colors),
                const SizedBox(height: 14),
                _buildSeoSection(colors),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: _isSaving ? null : _save,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(_isEditing ? 'Save page' : 'Create page'),
                  style: FilledButton.styleFrom(
                    backgroundColor: LetbuyyColorTokens.brandPrimary,
                    foregroundColor: LetbuyyColorTokens.white,
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Row(
      children: [
        IconButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context, false),
          icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
          tooltip: 'Back',
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _isEditing ? 'Edit page' : 'New page',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _isEditing
                    ? 'Update storefront content'
                    : 'Create storefront content',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isSaving ? null : _save,
          icon: Icon(Icons.check_rounded, color: colors.textPrimary),
          tooltip: _isEditing ? 'Save page' : 'Create page',
        ),
      ],
    );
  }

  Widget _buildContentSection(AppThemeColors colors) {
    return _section(
      colors,
      title: 'Content',
      icon: Icons.article_outlined,
      children: [
        TextFormField(
          controller: _titleController,
          decoration: _inputDecoration(colors, 'Title'),
          textInputAction: TextInputAction.next,
          validator: (value) => value == null || value.trim().isEmpty
              ? 'Title is required'
              : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _slugController,
          decoration: _inputDecoration(colors, 'Slug').copyWith(
            prefixText: '/',
            suffixIcon: IconButton(
              onPressed: _generateSlug,
              icon: const Icon(Icons.auto_fix_high_rounded),
              tooltip: 'Generate slug',
            ),
          ),
          textInputAction: TextInputAction.next,
          validator: (value) {
            final slug = value?.trim();
            if (slug == null || slug.isEmpty) return null;
            final valid = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$').hasMatch(slug);
            return valid ? null : 'Use lowercase letters, numbers, and hyphens';
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _bodyController,
          decoration: _inputDecoration(colors, 'Body'),
          keyboardType: TextInputType.multiline,
          minLines: 8,
          maxLines: 18,
        ),
      ],
    );
  }

  Widget _buildPublishSection(AppThemeColors colors) {
    return _section(
      colors,
      title: 'Publishing',
      icon: Icons.cloud_upload_outlined,
      children: [
        Text(
          'Status',
          style: TextStyle(color: colors.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            _statusChip(colors, status: 'draft', label: 'Draft'),
            _statusChip(colors, status: 'published', label: 'Published'),
          ],
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: _pageType,
          decoration: _inputDecoration(colors, 'Page type'),
          textInputAction: TextInputAction.next,
          onChanged: (value) => _pageType = value.trim().isEmpty
              ? 'custom'
              : value.trim().toLowerCase(),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _displayOrderController,
          decoration: _inputDecoration(colors, 'Display order'),
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          value: _showInNav,
          onChanged: (value) => setState(() => _showInNav = value),
          contentPadding: EdgeInsets.zero,
          title: Text(
            'Show in navigation',
            style: TextStyle(color: colors.textPrimary),
          ),
          subtitle: Text(
            'Add this page to the storefront menu when published.',
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildSeoSection(AppThemeColors colors) {
    return _section(
      colors,
      title: 'SEO',
      icon: Icons.manage_search_outlined,
      children: [
        TextFormField(
          controller: _seoTitleController,
          decoration: _inputDecoration(colors, 'SEO title'),
          maxLength: 70,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _seoDescriptionController,
          decoration: _inputDecoration(colors, 'SEO description'),
          maxLength: 160,
          minLines: 2,
          maxLines: 4,
        ),
      ],
    );
  }

  Widget _section(
    AppThemeColors colors, {
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: LetbuyyColorTokens.brandPrimary, size: 18),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }

  Widget _statusChip(
    AppThemeColors colors, {
    required String status,
    required String label,
  }) {
    final selected = _status == status;
    return ChoiceChip(
      selected: selected,
      label: Text(label),
      onSelected: (_) => setState(() => _status = status),
      selectedColor: LetbuyyColorTokens.brandPrimary.withValues(alpha: 0.18),
      backgroundColor: colors.surfaceVariant,
      labelStyle: TextStyle(
        color: selected
            ? LetbuyyColorTokens.brandPrimary
            : colors.textSecondary,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
      side: BorderSide(
        color: selected ? LetbuyyColorTokens.brandPrimary : colors.divider,
      ),
    );
  }

  InputDecoration _inputDecoration(AppThemeColors colors, String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: colors.textSecondary),
      filled: true,
      fillColor: colors.surfaceVariant,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.divider),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.divider),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: LetbuyyColorTokens.brandPrimary),
      ),
    );
  }

  void _generateSlug() {
    final slug = _titleController.text
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'(^-|-$)'), '');
    setState(() => _slugController.text = slug);
  }

  String _pageBody(PageContract page) {
    final direct = page.stringValue('body');
    if (direct.isNotEmpty) return direct;
    final htmlContent = page.stringValue('html_content');
    if (htmlContent.isNotEmpty) return htmlContent;
    final content = page.jsonMap('content');
    return content['body']?.toString() ?? content['html']?.toString() ?? '';
  }

  String _seoValue(PageContract page, String key) {
    final direct = page.stringValue('seo_$key');
    if (direct.isNotEmpty) return direct;
    return page.jsonMap('seo')[key]?.toString() ?? '';
  }

  void _showMessage(String message, {bool isError = false}) {
    if (!mounted) return;
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? colors.error : colors.card,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
