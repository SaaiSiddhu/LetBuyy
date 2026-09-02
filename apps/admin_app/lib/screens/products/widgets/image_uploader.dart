// lib/screens/admin/products/widgets/image_uploader.dart
import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:uuid/uuid.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_core/letbuyy_marketplace_core.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class ImageUploader extends StatefulWidget {
  final List<String> imageUrls;
  final Function(List<String>) onImagesChanged;

  const ImageUploader({
    super.key,
    required this.imageUrls,
    required this.onImagesChanged,
  });

  @override
  State<ImageUploader> createState() => _ImageUploaderState();
}

class _ImageUploaderState extends State<ImageUploader> {
  final _urlController = TextEditingController();
  final ImagePicker _picker = ImagePicker();
  bool _isUploading = false;

  void _addImageUrl() {
    final safeContext = context;
    final text = _urlController.text.trim();
    if (text.isNotEmpty) {
      final newUrls = [...widget.imageUrls, text];
      widget.onImagesChanged(newUrls);
      _urlController.clear();
      final messenger = ScaffoldMessenger.maybeOf(safeContext);
      if (messenger != null) SnackbarHelper.showSuccess(safeContext, 'Image URL added');
    }
  }

  Future<void> _pickAndUploadImage() async {
    final safeContext = context;
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (image == null) return;
      if (!mounted) return;

      setState(() => _isUploading = true);

      final String fileName = '${const Uuid().v4()}.jpg';
      final Reference storageRef = FirebaseStorage.instance
          .ref()
          .child('products')
          .child(fileName);

      UploadTask uploadTask;
      if (kIsWeb) {
        final bytes = await image.readAsBytes();
        uploadTask = storageRef.putData(
          bytes,
          SettableMetadata(contentType: 'image/jpeg'),
        );
      } else {
        uploadTask = storageRef.putFile(File(image.path));
      }

      final TaskSnapshot snapshot = await uploadTask;
      final String downloadUrl = await snapshot.ref.getDownloadURL();

      final newUrls = [...widget.imageUrls, downloadUrl];
      widget.onImagesChanged(newUrls);

      if (!mounted) return;
      SnackbarHelper.showSuccess(safeContext, 'Image uploaded successfully! ✅');
    } catch (e) {
      if (!mounted) return;
      SnackbarHelper.showError(safeContext, 'Upload failed: ${e.toString()}');
    } finally {
      if (!mounted) return;
      setState(() => _isUploading = false);
    }
  }

  Future<void> _pickAndUploadMultipleImages() async {
    final safeContext = context;
    try {
      final List<XFile> images = await _picker.pickMultiImage(
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (images.isEmpty) return;
      if (!mounted) return;

      setState(() => _isUploading = true);

      List<String> uploadedUrls = [];

      for (var image in images) {
        try {
          final String fileName = '${const Uuid().v4()}.jpg';
          final Reference storageRef = FirebaseStorage.instance
              .ref()
              .child('products')
              .child(fileName);

          UploadTask uploadTask;
          if (kIsWeb) {
            final bytes = await image.readAsBytes();
            uploadTask = storageRef.putData(
              bytes,
              SettableMetadata(contentType: 'image/jpeg'),
            );
          } else {
            uploadTask = storageRef.putFile(File(image.path));
          }

          final TaskSnapshot snapshot = await uploadTask;
          final String downloadUrl = await snapshot.ref.getDownloadURL();
          uploadedUrls.add(downloadUrl);
        } catch (e) {
          // continue uploading other images
          debugPrint('Error uploading one image: $e');
        }
      }

      if (uploadedUrls.isNotEmpty) {
        final newUrls = [...widget.imageUrls, ...uploadedUrls];
        widget.onImagesChanged(newUrls);
        if (!mounted) return;
        SnackbarHelper.showSuccess(safeContext, '${uploadedUrls.length} images uploaded! ✅');
      }
    } catch (e) {
      if (!mounted) return;
      SnackbarHelper.showError(safeContext, 'Upload failed: ${e.toString()}');
    } finally {
      if (!mounted) return;
      setState(() => _isUploading = false);
    }
  }

  void _removeImage(int index) async {
    final safeContext = context;
    final url = widget.imageUrls[index];

    if (url.contains('firebase')) {
      try {
        await FirebaseStorage.instance.refFromURL(url).delete();
      } catch (e) {
        debugPrint('Error deleting image from storage: $e');
      }
    }

    final newUrls = [...widget.imageUrls]..removeAt(index);
    widget.onImagesChanged(newUrls);
    final messenger = ScaffoldMessenger.maybeOf(safeContext);
    if (messenger != null) SnackbarHelper.showSuccess(safeContext, 'Image removed');
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final cardColor = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final inputFillColor = isDark ? const Color(0xFF2C2C2C) : Colors.grey.shade50;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Upload Methods Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: cardColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.cloud_upload, size: 32, color: accentColor),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Upload Methods', style: AppTextStyles.titleMedium.copyWith(color: isDark ? Colors.white : Colors.black87)),
                        const SizedBox(height: 4),
                        Text(
                          'Choose from device or paste URL',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: isDark ? Colors.grey[400] : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isUploading ? null : _pickAndUploadImage,
                      icon: _isUploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.photo_library, size: 18),
                      label: const Text('Single'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isUploading ? null : _pickAndUploadMultipleImages,
                      icon: _isUploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.photo_library_outlined, size: 18),
                      label: const Text('Multiple'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // Divider with text "OR"
        Row(
          children: [
            Expanded(child: Divider(color: isDark ? Colors.grey[700] : Colors.grey[300])),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('OR', style: AppTextStyles.bodySmall.copyWith(color: Colors.grey)),
            ),
            Expanded(child: Divider(color: isDark ? Colors.grey[700] : Colors.grey[300])),
          ],
        ),

        const SizedBox(height: 24),

        // Image URL input
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _urlController,
                style: TextStyle(color: isDark ? Colors.white : Colors.black),
                decoration: InputDecoration(
                  labelText: 'Image URL',
                  hintText: 'https://example.com/image.jpg',
                  prefixIcon: Icon(Icons.link, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: inputFillColor,
                ),
                onSubmitted: (_) => _addImageUrl(),
                enabled: !_isUploading,
              ),
            ),
            const SizedBox(width: 12),
            ElevatedButton.icon(
              onPressed: _isUploading ? null : _addImageUrl,
              icon: const Icon(Icons.add),
              label: const Text('Add'),
            ),
          ],
        ),

        const SizedBox(height: 24),

        if (_isUploading)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.info),
                ),
                const SizedBox(width: 16),
                Text('Uploading images...', style: AppTextStyles.bodyMedium.copyWith(color: AppColors.info, fontWeight: FontWeight.bold)),
              ],
            ),
          ),

        if (_isUploading) const SizedBox(height: 24),

        if (widget.imageUrls.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text('${widget.imageUrls.length} image(s) added', style: AppTextStyles.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
          ),

        if (widget.imageUrls.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(
                children: [
                  Icon(Icons.image_outlined, size: 80, color: isDark ? Colors.grey[700] : Colors.grey.shade300),
                  const SizedBox(height: 16),
                  Text('No images added', style: AppTextStyles.bodyLarge.copyWith(color: isDark ? Colors.white70 : Colors.black87)),
                  const SizedBox(height: 8),
                  Text('Upload from device or paste URL', style: AppTextStyles.bodySmall.copyWith(color: Colors.grey)),
                ],
              ),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1,
            ),
            itemCount: widget.imageUrls.length,
            itemBuilder: (context, index) {
              return Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        widget.imageUrls[index],
                        width: double.infinity,
                        height: double.infinity,
                        fit: BoxFit.cover,
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return Container(
                            color: isDark ? Colors.grey[800] : Colors.grey.shade200,
                            child: const Center(child: CircularProgressIndicator()),
                          );
                        },
                        errorBuilder: (_, __, ___) => Container(
                          color: isDark ? Colors.grey[800] : Colors.grey.shade200,
                          child: Icon(Icons.broken_image, size: 50, color: isDark ? Colors.grey[600] : Colors.grey[400]),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      decoration: BoxDecoration(color: AppColors.error, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 8)]),
                      child: IconButton(
                        icon: const Icon(Icons.close, color: Colors.white, size: 20),
                        onPressed: () => _removeImage(index),
                      ),
                    ),
                  ),
                  if (index == 0)
                    Positioned(
                      bottom: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: accentColor, borderRadius: BorderRadius.circular(8), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4)]),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star, color: isDark ? Colors.black : Colors.white, size: 12),
                            const SizedBox(width: 4),
                            Text('Primary', style: TextStyle(color: isDark ? Colors.black : Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
      ],
    );
  }
}