// lib/screens/admin/products/add_edit_category_screen.dart
// Premium responsive category add/edit screen with live preview and upload progress

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:uuid/uuid.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../../providers/admin_provider.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'widgets/icon_picker_helper.dart';
import 'widgets/category_preview_panel.dart';
import 'widgets/professional_category_form.dart';
import 'widgets/image_editor_screen.dart';

class AddEditCategoryScreen extends StatefulWidget {
  final CategoryModel? category;
  final String? parentId;
  final int level;

  const AddEditCategoryScreen({
    super.key,
    this.category,
    required this.parentId,
    required this.level,
  });

  bool get isEditing => category != null;

  @override
  State<AddEditCategoryScreen> createState() => _AddEditCategoryScreenState();
}

class _AddEditCategoryScreenState extends State<AddEditCategoryScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _descriptionController;
  late TextEditingController _iconController;
  late TextEditingController _displayOrderController;
  late TextEditingController _iconImageUrlController;
  late TextEditingController _bannerImageUrlController;

  XFile? _iconImageXFile;
  XFile? _bannerImageXFile;
  Uint8List? _localIconBytes;
  Uint8List? _localBannerBytes;

  bool _isActive = true;
  bool _isLoading = false;
  double _uploadProgress = 0;
  String _uploadingFile = '';

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.category?.name);
    _descriptionController = TextEditingController(text: widget.category?.description);
    _iconController = TextEditingController(text: widget.category?.iconName ?? 'default');
    _displayOrderController = TextEditingController(text: widget.category?.displayOrder.toString() ?? '0');
    _iconImageUrlController = TextEditingController(text: widget.category?.iconImageUrl);
    _bannerImageUrlController = TextEditingController(text: widget.category?.bannerImageUrl);
    _isActive = widget.category?.isActive ?? true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _iconController.dispose();
    _displayOrderController.dispose();
    _iconImageUrlController.dispose();
    _bannerImageUrlController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(bool isIcon) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery, imageQuality: 90);
    
    if (pickedFile != null) {
      final bytes = await pickedFile.readAsBytes();
      
      // Open the image editor screen
      final editedBytes = await Navigator.push<Uint8List>(
        context,
        MaterialPageRoute(
          builder: (_) => ImageEditorScreen(
            imageBytes: bytes,
            aspectRatio: isIcon ? 1.0 : 4.0,
            title: isIcon ? 'Edit Icon Image' : 'Edit Banner Image',
            imageType: isIcon ? 'icon' : 'banner',
          ),
        ),
      );
      
      // If user applied the crop
      if (editedBytes != null && mounted) {
        setState(() {
          if (isIcon) {
            _iconImageXFile = pickedFile;
            _localIconBytes = editedBytes;
            _iconImageUrlController.clear();
          } else {
            _bannerImageXFile = pickedFile;
            _localBannerBytes = editedBytes;
            _bannerImageUrlController.clear();
          }
        });
      }
    }
  }

  Future<String?> _uploadImage(XFile file, String path) async {
    try {
      final ref = FirebaseStorage.instance.ref(path);
      UploadTask uploadTask;
      
      if (kIsWeb) {
        final bytes = await file.readAsBytes();
        uploadTask = ref.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
      } else {
        uploadTask = ref.putFile(File(file.path));
      }

      // Listen to upload progress
      uploadTask.snapshotEvents.listen((TaskSnapshot snapshot) {
        if (mounted) {
          setState(() {
            _uploadProgress = snapshot.bytesTransferred / snapshot.totalBytes;
          });
        }
      });

      final snapshot = await uploadTask;
      return await snapshot.ref.getDownloadURL();
    } catch (e) {
      debugPrint('❌ Upload error: $e');
      return null;
    }
  }

  Future<void> _saveCategory() async {
    if (!_formKey.currentState!.validate()) {
      _showSnackbar('Please fix the errors in the form', isError: true);
      return;
    }

    if (!mounted) return;

    setState(() {
      _isLoading = true;
      _uploadProgress = 0;
    });

    final adminProvider = Provider.of<AdminProvider>(context, listen: false);
    final categoryProvider = Provider.of<CategoryProvider>(context, listen: false);

    String? errorMessage;
    String? iconImageUrl = _iconImageUrlController.text.trim();
    String? bannerImageUrl = _bannerImageUrlController.text.trim();
    const uuid = Uuid();

    try {
      // Upload icon image
      if (_iconImageXFile != null) {
        setState(() => _uploadingFile = 'icon');
        final uniqueFileName = '${uuid.v4()}.jpg';
        final url = await _uploadImage(_iconImageXFile!, 'category_icons/$uniqueFileName');
        if (url != null) iconImageUrl = url;
      }

      // Upload banner image
      if (_bannerImageXFile != null) {
        setState(() {
          _uploadingFile = 'banner';
          _uploadProgress = 0;
        });
        final uniqueFileName = '${uuid.v4()}.jpg';
        final url = await _uploadImage(_bannerImageXFile!, 'category_banners/$uniqueFileName');
        if (url != null) bannerImageUrl = url;
      }

      setState(() => _uploadingFile = 'saving');

      final name = _nameController.text.trim();
      final description = _descriptionController.text.trim();
      final iconName = _iconController.text.trim();
      final displayOrder = int.tryParse(_displayOrderController.text.trim()) ?? 0;

      if (widget.isEditing) {
        await adminProvider.updateCategory(
          categoryId: widget.category!.id,
          name: name,
          description: description,
          parentId: widget.category!.parentId,
          level: widget.category!.level,
          iconName: iconName,
          iconImageUrl: iconImageUrl.isEmpty ? null : iconImageUrl,
          bannerImageUrl: bannerImageUrl.isEmpty ? null : bannerImageUrl,
          displayOrder: displayOrder,
          isActive: _isActive,
        );
      } else {
        await adminProvider.addCategory(
          name: name,
          description: description,
          parentId: widget.parentId,
          level: widget.level,
          iconName: iconName,
          iconImageUrl: iconImageUrl.isEmpty ? null : iconImageUrl,
          bannerImageUrl: bannerImageUrl.isEmpty ? null : bannerImageUrl,
          displayOrder: displayOrder,
          isActive: _isActive,
        );
      }

      await categoryProvider.loadCategories();
    } catch (e) {
      debugPrint('❌ Error: $e');
      errorMessage = e.toString();
    }

    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _uploadingFile = '';
    });

    if (errorMessage != null) {
      _showSnackbar('Failed to save: $errorMessage', isError: true);
    } else {
      _showSnackbar('Category saved successfully!', isSuccess: true);
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) Navigator.of(context).pop();
      });
    }
  }

  void _showSnackbar(String message, {bool isError = false, bool isSuccess = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            if (isError) const Icon(Icons.error_outline, color: Colors.white),
            if (isSuccess) const Icon(Icons.check_circle_outline, color: Colors.white),
            if (isError || isSuccess) const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: isError ? AppColors.error : (isSuccess ? AppColors.success : null),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width >= 1100;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: _buildAppBar(isDark, accentColor),
      body: isDesktop
          ? _buildDesktopLayout(isDark, accentColor)
          : _buildMobileLayout(isDark, accentColor),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color accentColor) {
    return AppBar(
      elevation: 0,
      backgroundColor: accentColor,
      foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
      title: Text(widget.isEditing ? 'Edit Category' : 'Add Category'),
      actions: [
        if (_isLoading)
          const Padding(
            padding: EdgeInsets.all(16),
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            ),
          )
        else
          TextButton.icon(
            onPressed: _saveCategory,
            icon: const Icon(Icons.check, color: Colors.white),
            label: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
      ],
    );
  }

  Widget _buildDesktopLayout(bool isDark, Color accentColor) {
    // Get parent name for preview
    final categoryProvider = context.read<CategoryProvider>();
    final parentName = widget.parentId != null 
        ? categoryProvider.getCategoryById(widget.parentId!)?.name 
        : null;

    return Row(
      children: [
        // Form Panel
        Expanded(
          flex: 6,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: _buildForm(isDark, accentColor),
              ),
            ),
          ),
        ),
        // Divider
        Container(width: 1, color: isDark ? Colors.white10 : Colors.grey.shade200),
        // Preview Panel - Using new CategoryPreviewPanel
        Expanded(
          flex: 4,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: CategoryPreviewPanel(
              categoryName: _nameController.text,
              description: _descriptionController.text,
              iconImageUrl: _iconImageUrlController.text.isEmpty ? null : _iconImageUrlController.text,
              bannerImageUrl: _bannerImageUrlController.text.isEmpty ? null : _bannerImageUrlController.text,
              localIconBytes: _localIconBytes,
              localBannerBytes: _localBannerBytes,
              iconName: _iconController.text,
              level: widget.level,
              parentName: parentName,
              isActive: _isActive,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileLayout(bool isDark, Color accentColor) {
    return Column(
      children: [
        // Upload progress bar
        if (_isLoading && _uploadingFile.isNotEmpty)
          _buildUploadProgressBar(isDark, accentColor),
        // Form
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: _buildForm(isDark, accentColor),
          ),
        ),
        // Bottom bar
        _buildBottomBar(isDark, accentColor),
      ],
    );
  }

  Widget _buildUploadProgressBar(bool isDark, Color accentColor) {
    String label = 'Uploading...';
    if (_uploadingFile == 'icon') label = 'Uploading icon image...';
    if (_uploadingFile == 'banner') label = 'Uploading banner image...';
    if (_uploadingFile == 'saving') label = 'Saving category...';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: accentColor.withValues(alpha: 0.1),
        border: Border(bottom: BorderSide(color: accentColor.withValues(alpha: 0.3))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  value: _uploadingFile == 'saving' ? null : _uploadProgress,
                  strokeWidth: 2,
                  color: accentColor,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black87,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              if (_uploadingFile != 'saving')
                Text(
                  '${(_uploadProgress * 100).toInt()}%',
                  style: TextStyle(
                    color: accentColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _uploadingFile == 'saving' ? null : _uploadProgress,
              backgroundColor: isDark ? Colors.white10 : Colors.grey[300],
              color: accentColor,
              minHeight: 6,
            ),
          ),
        ],
      ),
    ).animate().fadeIn().slideY(begin: -0.5);
  }

  Widget _buildPreviewPanel(bool isDark, Color accentColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.preview_rounded, color: accentColor, size: 20),
            const SizedBox(width: 8),
            Text(
              'Live Preview',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isDark ? Colors.white : Colors.black87,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        
        // Upload progress in preview
        if (_isLoading && _uploadingFile.isNotEmpty)
          _buildUploadProgressBar(isDark, accentColor),
        
        const SizedBox(height: 16),
        
        // Category Card Preview
        _buildCategoryCardPreview(isDark, accentColor),
        const SizedBox(height: 24),
        
        // Banner Preview
        _buildBannerPreview(isDark, accentColor),
        const SizedBox(height: 24),
        
        // Tree Position Preview
        if (widget.parentId != null)
          _buildTreePositionPreview(isDark, accentColor),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildCategoryCardPreview(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Row(
        children: [
          _buildPreviewIcon(accentColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _nameController,
                  builder: (_, value, __) => Text(
                    value.text.isEmpty ? 'Category Name' : value.text,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: value.text.isEmpty
                          ? (isDark ? Colors.white38 : Colors.grey)
                          : (isDark ? Colors.white : Colors.black87),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _descriptionController,
                  builder: (_, value, __) => Text(
                    value.text.isEmpty ? 'Description preview' : value.text,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white54 : Colors.grey[600],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: (_isActive ? AppColors.success : AppColors.warning).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              _isActive ? 'Active' : 'Inactive',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: _isActive ? AppColors.success : AppColors.warning,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewIcon(Color accentColor) {
    final hasLocalFile = _iconImageXFile != null;
    final hasUrl = _iconImageUrlController.text.isNotEmpty;

    return CircleAvatar(
      radius: 24,
      backgroundColor: accentColor.withValues(alpha: 0.1),
      backgroundImage: hasUrl
          ? CachedNetworkImageProvider(_iconImageUrlController.text)
          : null,
      child: hasLocalFile
          ? ClipOval(
              child: kIsWeb
                  ? FutureBuilder<Uint8List>(
                      future: _iconImageXFile!.readAsBytes(),
                      builder: (_, snap) => snap.hasData
                          ? Image.memory(snap.data!, fit: BoxFit.cover, width: 48, height: 48)
                          : const CircularProgressIndicator(),
                    )
                  : Image.file(File(_iconImageXFile!.path), fit: BoxFit.cover, width: 48, height: 48),
            )
          : (!hasUrl
              ? ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _iconController,
                  builder: (_, value, __) => Icon(
                    IconPickerHelper.getIcon(value.text),
                    color: accentColor,
                    size: 24,
                  ),
                )
              : null),
    );
  }

  Widget _buildBannerPreview(bool isDark, Color accentColor) {
    final hasLocalFile = _bannerImageXFile != null;
    final hasUrl = _bannerImageUrlController.text.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Banner Preview',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white54 : Colors.grey[600],
          ),
        ),
        const SizedBox(height: 8),
        Container(
          height: 120,
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: LinearGradient(
              colors: [accentColor.withValues(alpha: 0.3), accentColor.withValues(alpha: 0.1)],
            ),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: hasLocalFile
                ? (kIsWeb
                    ? FutureBuilder<Uint8List>(
                        future: _bannerImageXFile!.readAsBytes(),
                        builder: (_, snap) => snap.hasData
                            ? Image.memory(snap.data!, fit: BoxFit.cover, width: double.infinity)
                            : const Center(child: CircularProgressIndicator()),
                      )
                    : Image.file(File(_bannerImageXFile!.path), fit: BoxFit.cover))
                : (hasUrl
                    ? CachedNetworkImage(
                        imageUrl: _bannerImageUrlController.text,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => const Center(child: CircularProgressIndicator()),
                      )
                    : Center(
                        child: Text(
                          'No banner image',
                          style: TextStyle(color: isDark ? Colors.white38 : Colors.grey),
                        ),
                      )),
          ),
        ),
      ],
    );
  }

  Widget _buildTreePositionPreview(bool isDark, Color accentColor) {
    return Consumer<CategoryProvider>(
      builder: (_, provider, __) {
        final parent = provider.getCategoryById(widget.parentId!);
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tree Position',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white54 : Colors.grey[600],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.folder_rounded, size: 18, color: accentColor),
                  const SizedBox(width: 8),
                  Text(
                    parent?.name ?? 'Parent Category',
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(left: 9),
                child: Container(
                  width: 1,
                  height: 16,
                  color: isDark ? Colors.white24 : Colors.grey[400],
                ),
              ),
              Row(
                children: [
                  const SizedBox(width: 8),
                  Icon(Icons.subdirectory_arrow_right_rounded, size: 18, color: accentColor),
                  const SizedBox(width: 8),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _nameController,
                    builder: (_, value, __) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        value.text.isEmpty ? 'New Category' : value.text,
                        style: TextStyle(
                          color: accentColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildForm(bool isDark, Color accentColor) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Parent info
          if (widget.parentId != null)
            _buildParentInfo(isDark),
          
          _buildSectionTitle('Category Info', isDark),
          _buildTextField(
            controller: _nameController,
            label: 'Category Name',
            icon: Icons.category_rounded,
            isDark: isDark,
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 16),
          _buildTextField(
            controller: _descriptionController,
            label: 'Description',
            icon: Icons.description_outlined,
            isDark: isDark,
            maxLines: 3,
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          
          const SizedBox(height: 24),
          _buildSectionTitle('Images', isDark),
          const SizedBox(height: 12),
          
          // Responsive layout: side by side on desktop, stacked on mobile
          LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth > 500;
              
              if (isWide) {
                // Desktop: Side by side
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _buildIconUploadCard(isDark, accentColor),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _buildBannerUploadCard(isDark, accentColor),
                    ),
                  ],
                );
              } else {
                // Mobile: Stacked
                return Column(
                  children: [
                    _buildIconUploadCard(isDark, accentColor),
                    const SizedBox(height: 16),
                    _buildBannerUploadCard(isDark, accentColor),
                  ],
                );
              }
            },
          ),
          
          const SizedBox(height: 24),
          _buildSectionTitle('Settings', isDark),
          
          _buildIconSelector(isDark, accentColor),
          const SizedBox(height: 16),
          
          _buildTextField(
            controller: _displayOrderController,
            label: 'Display Order',
            icon: Icons.sort_rounded,
            isDark: isDark,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          ),
          const SizedBox(height: 16),
          
          _buildActiveToggle(isDark),
          
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildParentInfo(bool isDark) {
    return Consumer<CategoryProvider>(
      builder: (_, provider, __) {
        final parent = provider.getCategoryById(widget.parentId!);
        return Container(
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.primary.withValues(alpha: 0.1) : AppColors.primary.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Row(
            children: [
              Icon(Icons.subdirectory_arrow_right_rounded, color: AppColors.primary, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Subcategory of: ${parent?.name ?? '...'}',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black87,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFESSIONAL IMAGE UPLOAD CARDS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildIconUploadCard(bool isDark, Color accentColor) {
    return ProfessionalImageUploadCard(
      title: 'Icon Image',
      subtitle: 'Square image for sidebar & cards',
      dimensionHint: '200 × 200 px',
      existingImageUrl: _iconImageUrlController.text.isEmpty ? null : _iconImageUrlController.text,
      localBytes: _localIconBytes,
      aspectRatio: 1.0,
      height: 160,
      icon: Icons.crop_square_rounded,
      isUploading: _isLoading && _uploadingFile == 'icon',
      uploadProgress: _uploadProgress,
      onTap: () => _pickImage(true),
      onDelete: () {
        setState(() {
          _iconImageXFile = null;
          _localIconBytes = null;
          _iconImageUrlController.clear();
        });
      },
    );
  }

  Widget _buildBannerUploadCard(bool isDark, Color accentColor) {
    return ProfessionalImageUploadCard(
      title: 'Banner Image',
      subtitle: 'Wide image for category header',
      dimensionHint: '800 × 200 px',
      existingImageUrl: _bannerImageUrlController.text.isEmpty ? null : _bannerImageUrlController.text,
      localBytes: _localBannerBytes,
      aspectRatio: 4.0,
      height: 160,
      icon: Icons.panorama_wide_angle_rounded,
      isUploading: _isLoading && _uploadingFile == 'banner',
      uploadProgress: _uploadProgress,
      onTap: () => _pickImage(false),
      onDelete: () {
        setState(() {
          _bannerImageXFile = null;
          _localBannerBytes = null;
          _bannerImageUrlController.clear();
        });
      },
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: isDark ? Colors.white : Colors.black87,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool isDark,
    String? Function(String?)? validator,
    int maxLines = 1,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return TextFormField(
      controller: controller,
      validator: validator,
      maxLines: maxLines,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      style: TextStyle(color: isDark ? Colors.white : Colors.black87),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: isDark ? Colors.white54 : Colors.grey[600]),
        prefixIcon: Icon(icon, color: isDark ? Colors.white38 : Colors.grey),
        filled: true,
        fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: isDark ? Colors.white10 : Colors.grey.shade300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: isDark ? Colors.white10 : Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.primary, width: 2),
        ),
      ),
    );
  }

  Widget _buildImageUploader(String label, bool isIcon, bool isDark, Color accentColor) {
    final xFile = isIcon ? _iconImageXFile : _bannerImageXFile;
    final urlController = isIcon ? _iconImageUrlController : _bannerImageUrlController;
    final hasFile = xFile != null;
    final hasUrl = urlController.text.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              if (hasFile)
                IconButton(
                  icon: const Icon(Icons.close, size: 18),
                  onPressed: () => setState(() {
                    if (isIcon) {
                      _iconImageXFile = null;
                    } else {
                      _bannerImageXFile = null;
                    }
                  }),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => _pickImage(isIcon),
            child: Container(
              height: isIcon ? 80 : 100,
              width: double.infinity,
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: isDark ? Colors.white10 : Colors.grey.shade300,
                  style: hasFile || hasUrl ? BorderStyle.solid : BorderStyle.none,
                ),
              ),
              child: hasFile
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: kIsWeb
                          ? FutureBuilder<Uint8List>(
                              future: xFile.readAsBytes(),
                              builder: (_, snap) => snap.hasData
                                  ? Image.memory(snap.data!, fit: BoxFit.cover)
                                  : const Center(child: CircularProgressIndicator()),
                            )
                          : Image.file(File(xFile.path), fit: BoxFit.cover),
                    )
                  : (hasUrl
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: CachedNetworkImage(
                            imageUrl: urlController.text,
                            fit: BoxFit.cover,
                          ),
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_photo_alternate_outlined,
                                color: accentColor, size: 28),
                            const SizedBox(height: 4),
                            Text(
                              'Tap to upload',
                              style: TextStyle(
                                fontSize: 11,
                                color: isDark ? Colors.white54 : Colors.grey[600],
                              ),
                            ),
                          ],
                        )),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconSelector(bool isDark, Color accentColor) {
    return GestureDetector(
      onTap: () => _showIconPicker(isDark),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade300),
        ),
        child: Row(
          children: [
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: _iconController,
              builder: (_, value, __) => Icon(
                IconPickerHelper.getIcon(value.text),
                color: accentColor,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Fallback Icon',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Text(
                    'Used when no image is set',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.white54 : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: isDark ? Colors.white38 : Colors.grey),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveToggle(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? Colors.white10 : Colors.grey.shade300),
      ),
      child: Row(
        children: [
          Icon(
            _isActive ? Icons.check_circle_rounded : Icons.pause_circle_rounded,
            color: _isActive ? AppColors.success : AppColors.warning,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Category Status',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
                Text(
                  _isActive ? 'Active - visible to users' : 'Inactive - hidden from users',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white54 : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: _isActive,
            onChanged: (v) => setState(() => _isActive = v),
            activeThumbColor: AppColors.success,
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(bool isDark, Color accentColor) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewPadding.bottom),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        border: Border(top: BorderSide(color: isDark ? Colors.white10 : Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: ElevatedButton.icon(
        onPressed: _isLoading ? null : _saveCategory,
        icon: _isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Icon(widget.isEditing ? Icons.check_circle_outline : Icons.add_circle_outline),
        label: Text(_isLoading ? 'Saving...' : (widget.isEditing ? 'Save Changes' : 'Add Category')),
        style: ElevatedButton.styleFrom(
          backgroundColor: accentColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          minimumSize: const Size(double.infinity, 50),
        ),
      ),
    );
  }

  void _showIconPicker(bool isDark) {
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Select an Icon',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ),
            const Divider(height: 1),
            Flexible(
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                shrinkWrap: true,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 5,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: IconPickerHelper.kAppIcons.length,
                itemBuilder: (context, index) {
                  final entry = IconPickerHelper.kAppIcons.entries.elementAt(index);
                  final isSelected = _iconController.text == entry.key;
                  return InkWell(
                    onTap: () {
                      setState(() => _iconController.text = entry.key);
                      Navigator.pop(context);
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary.withValues(alpha: 0.1)
                            : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100]),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Icon(
                        entry.value,
                        color: isSelected
                            ? AppColors.primary
                            : (isDark ? Colors.white54 : Colors.grey[600]),
                        size: 28,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}