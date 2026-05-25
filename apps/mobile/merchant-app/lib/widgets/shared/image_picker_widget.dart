import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/storage_service.dart';

class ImagePickerWidget extends StatefulWidget {
  final String? initialUrl;
  final ValueChanged<String?> onChanged;
  final String label;
  final String storagePath;

  const ImagePickerWidget({
    super.key,
    this.initialUrl,
    required this.onChanged,
    this.label = 'Upload Image',
    this.storagePath = 'uploads',
  });

  @override
  State<ImagePickerWidget> createState() => _ImagePickerWidgetState();
}

class _ImagePickerWidgetState extends State<ImagePickerWidget> {
  final ImagePicker _picker = ImagePicker();
  bool _isUploading = false;
  String? _error;

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image == null) return;

      setState(() {
        _isUploading = true;
        _error = null;
      });

      final storageService = context.read<StorageService>();
      final downloadUrl = await storageService.uploadImage(
        File(image.path), 
        path: widget.storagePath
      );

      widget.onChanged(downloadUrl);
    } catch (e) {
      setState(() => _error = e.toString());
      debugPrint('Upload error: $e');
    } finally {
      setState(() => _isUploading = false);
    }
  }

  void _removeImage() {
    widget.onChanged(null);
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = widget.initialUrl != null && widget.initialUrl!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: _isUploading ? null : _pickImage,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 160,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.grey[50], // Premium Light Grey
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: _error != null ? Colors.red : Colors.grey[300]!,
                width: 1,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: _isUploading
                ? const Center(child: CircularProgressIndicator())
                : hasImage
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          CachedNetworkImage(
                            imageUrl: widget.initialUrl!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => const Center(child: CircularProgressIndicator()),
                            errorWidget: (_, __, ___) => const Icon(Icons.error),
                          ),
                          Positioned(
                            top: 8,
                            right: 8,
                            child: InkWell(
                              onTap: _removeImage,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.5),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.close, color: Colors.white, size: 16),
                              ),
                            ),
                          ),
                          Positioned(
                             bottom: 8,
                             right: 8,
                             child: Container(
                               padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                               decoration: BoxDecoration(
                                 color: Colors.black.withValues(alpha: 0.6),
                                 borderRadius: BorderRadius.circular(20),
                               ),
                               child: const Row(
                                 mainAxisSize: MainAxisSize.min,
                                 children: [
                                   Icon(Icons.edit, color: Colors.white, size: 12),
                                   SizedBox(width: 4),
                                   Text('Change', style: TextStyle(color: Colors.white, fontSize: 12)),
                                 ],
                               ),
                             ),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add_photo_alternate_outlined, 
                              size: 40, color: Colors.grey[400]),
                          const SizedBox(height: 8),
                          Text(
                            'Tap to upload',
                            style: TextStyle(color: Colors.grey[600], fontSize: 13),
                          ),
                        ],
                      ),
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _error!,
              style: const TextStyle(color: Colors.red, fontSize: 12),
            ),
          ),
      ],
    );
  }
}
