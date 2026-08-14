import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/cms_service.dart';
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class PostEditorScreen extends StatefulWidget {
  const PostEditorScreen({super.key, required this.storeId, this.post});

  final String storeId;
  final BlogPostContract? post;

  @override
  State<PostEditorScreen> createState() => _PostEditorScreenState();
}

class _PostEditorScreenState extends State<PostEditorScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _slugController;
  late final TextEditingController _excerptController;
  late final TextEditingController _contentController;
  late final TextEditingController _featuredImageController;
  late final TextEditingController _categoryIdController;
  late final TextEditingController _readingTimeController;
  late final TextEditingController _seoTitleController;
  late final TextEditingController _seoDescriptionController;
  late String _status;
  late bool _allowComments;
  late bool _isFeatured;
  late bool _isPinned;
  bool _isSaving = false;

  bool get _isEditing => widget.post != null;

  @override
  void initState() {
    super.initState();
    final post = widget.post;
    _titleController = TextEditingController(text: post?.title ?? '');
    _slugController = TextEditingController(text: post?.slug ?? '');
    _excerptController = TextEditingController(text: post?.excerpt ?? '');
    _contentController = TextEditingController(text: post?.content ?? '');
    _featuredImageController = TextEditingController(
      text: post?.featuredImage ?? '',
    );
    _categoryIdController = TextEditingController(
      text: post?.stringValue('category_id') ?? '',
    );
    _readingTimeController = TextEditingController(
      text: post == null || post.readingTimeMin == 0
          ? ''
          : post.readingTimeMin.toString(),
    );
    _seoTitleController = TextEditingController(
      text: post?.stringValue('seo_title') ?? '',
    );
    _seoDescriptionController = TextEditingController(
      text: post?.stringValue('seo_description') ?? '',
    );
    _status = post?.status == 'published' ? 'published' : 'draft';
    _allowComments = post?.allowComments ?? true;
    _isFeatured = post?.isFeatured ?? false;
    _isPinned = post?.isPinned ?? false;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _slugController.dispose();
    _excerptController.dispose();
    _contentController.dispose();
    _featuredImageController.dispose();
    _categoryIdController.dispose();
    _readingTimeController.dispose();
    _seoTitleController.dispose();
    _seoDescriptionController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _isSaving) return;
    setState(() => _isSaving = true);

    final input = BlogPostInput(
      storeId: widget.storeId,
      title: _titleController.text,
      slug: _slugController.text,
      excerpt: _excerptController.text,
      content: _contentController.text,
      featuredImage: _featuredImageController.text,
      categoryId: _categoryIdController.text,
      status: _status,
      allowComments: _allowComments,
      isFeatured: _isFeatured,
      isPinned: _isPinned,
      readingTimeMin: int.tryParse(_readingTimeController.text.trim()),
      seoTitle: _seoTitleController.text,
      seoDescription: _seoDescriptionController.text,
    );

    try {
      if (_isEditing) {
        await context.read<CmsService>().updateBlogPost(widget.post!.id, input);
      } else {
        await context.read<CmsService>().createBlogPost(input);
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
                  label: Text(_isEditing ? 'Save post' : 'Create post'),
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
                _isEditing ? 'Edit post' : 'New post',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _isEditing ? 'Update blog content' : 'Create blog content',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isSaving ? null : _save,
          icon: Icon(Icons.check_rounded, color: colors.textPrimary),
          tooltip: _isEditing ? 'Save post' : 'Create post',
        ),
      ],
    );
  }

  Widget _buildContentSection(AppThemeColors colors) {
    return _section(
      colors,
      title: 'Post content',
      icon: Icons.edit_note_outlined,
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
          controller: _excerptController,
          decoration: _inputDecoration(colors, 'Excerpt'),
          minLines: 2,
          maxLines: 4,
          maxLength: 500,
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _contentController,
          decoration: _inputDecoration(colors, 'Content'),
          keyboardType: TextInputType.multiline,
          minLines: 10,
          maxLines: 22,
          validator: (value) => value == null || value.trim().isEmpty
              ? 'Content is required'
              : null,
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
          controller: _featuredImageController,
          decoration: _inputDecoration(colors, 'Featured image URL'),
          keyboardType: TextInputType.url,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _categoryIdController,
          decoration: _inputDecoration(colors, 'Category ID'),
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _readingTimeController,
          decoration: _inputDecoration(colors, 'Reading time minutes'),
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        _switchRow(
          colors,
          title: 'Allow comments',
          value: _allowComments,
          onChanged: (value) => setState(() => _allowComments = value),
        ),
        _switchRow(
          colors,
          title: 'Feature post',
          value: _isFeatured,
          onChanged: (value) => setState(() => _isFeatured = value),
        ),
        _switchRow(
          colors,
          title: 'Pin post',
          value: _isPinned,
          onChanged: (value) => setState(() => _isPinned = value),
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

  Widget _switchRow(
    AppThemeColors colors, {
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    // The tile needs its own Material ancestor: it paints ink splashes on the
    // nearest Material, and the decorated card above would hide them.
    return Material(
      type: MaterialType.transparency,
      child: SwitchListTile(
        value: value,
        onChanged: onChanged,
        contentPadding: EdgeInsets.zero,
        title: Text(title, style: TextStyle(color: colors.textPrimary)),
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
