// lib/screens/products/widgets/image_crop_upload_widget.dart
// 🖼️ Professional Image Crop Upload Widget with Drag & Zoom

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

/// Professional image upload widget with drag-to-position and zoom functionality
class ImageCropUploadWidget extends StatefulWidget {
  final String? existingImageUrl;
  final Size cropSize;
  final double aspectRatio;
  final String label;
  final String dimensionHint;
  final Function(XFile file, Offset position, double scale) onImageReady;
  final VoidCallback? onDelete;
  final bool isUploading;
  final double uploadProgress;

  const ImageCropUploadWidget({
    super.key,
    this.existingImageUrl,
    required this.cropSize,
    required this.aspectRatio,
    required this.label,
    required this.dimensionHint,
    required this.onImageReady,
    this.onDelete,
    this.isUploading = false,
    this.uploadProgress = 0,
  });

  @override
  State<ImageCropUploadWidget> createState() => _ImageCropUploadWidgetState();
}

class _ImageCropUploadWidgetState extends State<ImageCropUploadWidget>
    with SingleTickerProviderStateMixin {
  XFile? _selectedFile;
  Uint8List? _imageBytes;
  
  // Transform state
  Offset _imageOffset = Offset.zero;
  double _imageScale = 1.0;
  double _baseScale = 1.0;
  Offset _startOffset = Offset.zero;
  
  // Animation
  late AnimationController _pulseController;
  
  final ImagePicker _picker = ImagePicker();
  bool _isHovering = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 90,
      );
      
      if (image != null) {
        final bytes = await image.readAsBytes();
        setState(() {
          _selectedFile = image;
          _imageBytes = bytes;
          _imageOffset = Offset.zero;
          _imageScale = 1.0;
        });
        HapticFeedback.lightImpact();
        // Notify parent with initial values
        widget.onImageReady(image, _imageOffset, _imageScale);
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  void _onScaleStart(ScaleStartDetails details) {
    _baseScale = _imageScale;
    _startOffset = _imageOffset;
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      // Scale with limits
      _imageScale = (_baseScale * details.scale).clamp(0.5, 3.0);
      
      // Pan
      _imageOffset = _startOffset + details.focalPointDelta;
    });
    widget.onImageReady(_selectedFile!, _imageOffset, _imageScale);
  }

  void _onPointerSignal(PointerSignalEvent event) {
    // Mouse wheel zoom for web/desktop
    if (event is PointerScrollEvent && _selectedFile != null) {
      setState(() {
        final delta = event.scrollDelta.dy > 0 ? -0.1 : 0.1;
        _imageScale = (_imageScale + delta).clamp(0.5, 3.0);
      });
      widget.onImageReady(_selectedFile!, _imageOffset, _imageScale);
    }
  }

  void _resetTransform() {
    setState(() {
      _imageOffset = Offset.zero;
      _imageScale = 1.0;
    });
    if (_selectedFile != null) {
      widget.onImageReady(_selectedFile!, _imageOffset, _imageScale);
    }
  }

  void _deleteImage() {
    setState(() {
      _selectedFile = null;
      _imageBytes = null;
      _imageOffset = Offset.zero;
      _imageScale = 1.0;
    });
    widget.onDelete?.call();
    HapticFeedback.mediumImpact();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accentColor = AppColors.primary;
    
    final hasExistingImage = widget.existingImageUrl?.isNotEmpty == true;
    final hasSelectedImage = _selectedFile != null && _imageBytes != null;
    final hasImage = hasSelectedImage || hasExistingImage;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label with dimensions
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              Icon(
                hasImage ? Icons.check_circle : Icons.image_outlined,
                size: 16,
                color: hasImage ? AppColors.success : Colors.grey,
              ),
              const SizedBox(width: 6),
              Text(
                widget.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.dimensionHint,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: accentColor,
                  ),
                ),
              ),
            ],
          ),
        ),
        
        // Main upload area
        MouseRegion(
          onEnter: (_) => setState(() => _isHovering = true),
          onExit: (_) => setState(() => _isHovering = false),
          child: GestureDetector(
            onTap: hasImage ? null : _pickImage,
            child: Listener(
              onPointerSignal: _onPointerSignal,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: widget.cropSize.height,
                decoration: BoxDecoration(
                  color: isDark 
                      ? Colors.white.withValues(alpha: 0.03)
                      : Colors.grey.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _isHovering || hasImage
                        ? accentColor.withValues(alpha: 0.5)
                        : (isDark ? Colors.white12 : Colors.grey[300]!),
                    width: hasImage ? 2 : 1,
                    style: hasImage ? BorderStyle.solid : BorderStyle.none,
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: Stack(
                    children: [
                      // Dashed border for empty state
                      if (!hasImage)
                        CustomPaint(
                          size: Size(double.infinity, widget.cropSize.height),
                          painter: _DashedBorderPainter(
                            color: _isHovering 
                                ? accentColor 
                                : (isDark ? Colors.white24 : Colors.grey[400]!),
                            strokeWidth: 2,
                            dashWidth: 8,
                            dashSpace: 4,
                          ),
                        ),
                      
                      // Image content
                      if (hasSelectedImage)
                        _buildCroppableImage(isDark, accentColor)
                      else if (hasExistingImage)
                        _buildExistingImage(isDark, accentColor)
                      else
                        _buildEmptyState(isDark, accentColor),
                      
                      // Upload progress overlay
                      if (widget.isUploading)
                        _buildUploadProgress(accentColor),
                      
                      // Action buttons (top right)
                      if (hasImage && !widget.isUploading)
                        _buildActionButtons(isDark, accentColor),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        
        // Help text
        if (hasImage && !widget.isUploading)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                Icon(Icons.touch_app, size: 12, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text(
                  'Drag to position • Pinch/scroll to zoom',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey[500],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildCroppableImage(bool isDark, Color accentColor) {
    return GestureDetector(
      onScaleStart: _onScaleStart,
      onScaleUpdate: _onScaleUpdate,
      child: Container(
        width: double.infinity,
        height: widget.cropSize.height,
        color: isDark ? Colors.black : Colors.grey[100],
        child: ClipRect(
          child: Transform.translate(
            offset: _imageOffset,
            child: Transform.scale(
              scale: _imageScale,
              child: Image.memory(
                _imageBytes!,
                fit: BoxFit.cover,
                width: double.infinity,
                height: widget.cropSize.height,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExistingImage(bool isDark, Color accentColor) {
    return GestureDetector(
      onTap: _pickImage, // Allow replacing
      child: CachedNetworkImage(
        imageUrl: widget.existingImageUrl!,
        width: double.infinity,
        height: widget.cropSize.height,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(
          color: isDark ? Colors.grey[800] : Colors.grey[200],
          child: const Center(
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        errorWidget: (_, __, ___) => Container(
          color: isDark ? Colors.grey[800] : Colors.grey[200],
          child: Icon(Icons.broken_image, color: Colors.grey[400], size: 32),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark, Color accentColor) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.1 + (_pulseController.value * 0.05)),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.add_photo_alternate_outlined,
                  size: 28,
                  color: accentColor,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Tap to upload',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white70 : Colors.grey[600],
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.dimensionHint,
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey[500],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUploadProgress(Color accentColor) {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 60,
              height: 60,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: widget.uploadProgress,
                    strokeWidth: 4,
                    backgroundColor: Colors.white24,
                    color: accentColor,
                  ),
                  Text(
                    '${(widget.uploadProgress * 100).toInt()}%',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Uploading...',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(bool isDark, Color accentColor) {
    return Positioned(
      top: 8,
      right: 8,
      child: Row(
        children: [
          // Reset button
          if (_selectedFile != null)
            _buildActionButton(
              icon: Icons.refresh,
              tooltip: 'Reset position',
              onTap: _resetTransform,
              isDark: isDark,
            ),
          const SizedBox(width: 6),
          // Replace button
          _buildActionButton(
            icon: Icons.edit,
            tooltip: 'Replace image',
            onTap: _pickImage,
            isDark: isDark,
          ),
          const SizedBox(width: 6),
          // Delete button
          _buildActionButton(
            icon: Icons.delete_outline,
            tooltip: 'Remove image',
            onTap: _deleteImage,
            isDark: isDark,
            isDestructive: true,
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    required bool isDark,
    bool isDestructive = false,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDark 
                  ? Colors.black54 
                  : Colors.white.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(8),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 4,
                ),
              ],
            ),
            child: Icon(
              icon,
              size: 16,
              color: isDestructive 
                  ? Colors.red 
                  : (isDark ? Colors.white : Colors.grey[700]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Custom painter for dashed border
class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double dashWidth;
  final double dashSpace;

  _DashedBorderPainter({
    required this.color,
    required this.strokeWidth,
    required this.dashWidth,
    required this.dashSpace,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(strokeWidth / 2, strokeWidth / 2, 
            size.width - strokeWidth, size.height - strokeWidth),
        const Radius.circular(12),
      ));

    // Draw dashed path
    final dashPath = Path();
    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final length = dashWidth.clamp(0.0, metric.length - distance);
        dashPath.addPath(
          metric.extractPath(distance, distance + length),
          Offset.zero,
        );
        distance += dashWidth + dashSpace;
      }
    }
    canvas.drawPath(dashPath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
