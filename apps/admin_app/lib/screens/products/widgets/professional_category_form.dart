// lib/screens/products/widgets/professional_category_form.dart
// 🏢 Enterprise-Grade Category Form Widget

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

/// Professional image upload card with drag, zoom, and crop preview
class ProfessionalImageUploadCard extends StatefulWidget {
  final String title;
  final String subtitle;
  final String dimensionHint;
  final String? existingImageUrl;
  final Uint8List? localBytes;
  final double aspectRatio;
  final double height;
  final bool isUploading;
  final double uploadProgress;
  final VoidCallback onTap;
  final VoidCallback? onDelete;
  final IconData icon;

  const ProfessionalImageUploadCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.dimensionHint,
    this.existingImageUrl,
    this.localBytes,
    this.aspectRatio = 1.0,
    this.height = 180,
    this.isUploading = false,
    this.uploadProgress = 0,
    required this.onTap,
    this.onDelete,
    this.icon = Icons.image_outlined,
  });

  @override
  State<ProfessionalImageUploadCard> createState() => _ProfessionalImageUploadCardState();
}

class _ProfessionalImageUploadCardState extends State<ProfessionalImageUploadCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _hoverController;
  bool _isHovering = false;
  
  // Image transform state
  Offset _imageOffset = Offset.zero;
  double _imageScale = 1.0;
  double _baseScale = 1.0;
  Offset _startOffset = Offset.zero;

  @override
  void initState() {
    super.initState();
    _hoverController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
  }

  @override
  void dispose() {
    _hoverController.dispose();
    super.dispose();
  }

  bool get _hasImage => widget.localBytes != null || (widget.existingImageUrl?.isNotEmpty == true);

  void _onScaleStart(ScaleStartDetails details) {
    _baseScale = _imageScale;
    _startOffset = _imageOffset;
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      _imageScale = (_baseScale * details.scale).clamp(0.5, 3.0);
      _imageOffset = _startOffset + details.focalPointDelta;
    });
  }

  void _resetTransform() {
    setState(() {
      _imageOffset = Offset.zero;
      _imageScale = 1.0;
    });
    HapticFeedback.lightImpact();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = AppColors.primary;

    return MouseRegion(
      onEnter: (_) => setState(() {
        _isHovering = true;
        _hoverController.forward();
      }),
      onExit: (_) => setState(() {
        _isHovering = false;
        _hoverController.reverse();
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isDark 
              ? Colors.white.withValues(alpha: _isHovering ? 0.08 : 0.04)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: _isHovering 
                ? accentColor.withValues(alpha: 0.5)
                : (isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[200]!),
            width: _isHovering ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: _isHovering 
                  ? accentColor.withValues(alpha: 0.1)
                  : Colors.black.withValues(alpha: 0.03),
              blurRadius: _isHovering ? 20 : 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(widget.icon, size: 20, color: accentColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87,
                          ),
                        ),
                        Text(
                          widget.subtitle,
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _hasImage 
                          ? AppColors.success.withValues(alpha: 0.1)
                          : Colors.orange.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _hasImage ? Icons.check_circle : Icons.pending,
                          size: 12,
                          color: _hasImage ? AppColors.success : Colors.orange,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          widget.dimensionHint,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: _hasImage ? AppColors.success : Colors.orange,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // Image Area
            GestureDetector(
              onTap: widget.onTap,
              onScaleStart: _hasImage && widget.localBytes != null ? _onScaleStart : null,
              onScaleUpdate: _hasImage && widget.localBytes != null ? _onScaleUpdate : null,
              child: Container(
                height: widget.height,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: isDark ? Colors.black26 : Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                  border: !_hasImage ? Border.all(
                    color: isDark ? Colors.white12 : Colors.grey[300]!,
                    style: BorderStyle.solid,
                  ) : null,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Dashed border when empty
                      if (!_hasImage)
                        CustomPaint(
                          painter: _DashedBorderPainter(
                            color: isDark ? Colors.white24 : Colors.grey[400]!,
                          ),
                        ),
                      
                      // Image content
                      if (widget.localBytes != null)
                        ClipRect(
                          child: Transform.translate(
                            offset: _imageOffset,
                            child: Transform.scale(
                              scale: _imageScale,
                              child: Image.memory(
                                widget.localBytes!,
                                fit: BoxFit.cover,
                                width: double.infinity,
                                height: widget.height,
                              ),
                            ),
                          ),
                        )
                      else if (widget.existingImageUrl?.isNotEmpty == true)
                        CachedNetworkImage(
                          imageUrl: widget.existingImageUrl!,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: widget.height,
                          placeholder: (_, __) => _buildPlaceholder(isDark),
                          errorWidget: (_, __, ___) => _buildEmptyState(isDark, accentColor),
                        )
                      else
                        _buildEmptyState(isDark, accentColor),
                      
                      // Upload progress overlay
                      if (widget.isUploading)
                        Container(
                          color: Colors.black54,
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: 50,
                                  height: 50,
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      CircularProgressIndicator(
                                        value: widget.uploadProgress,
                                        strokeWidth: 3,
                                        backgroundColor: Colors.white24,
                                        color: accentColor,
                                      ),
                                      Text(
                                        '${(widget.uploadProgress * 100).toInt()}%',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'Uploading...',
                                  style: TextStyle(color: Colors.white70, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        ),
                      
                      // Action buttons overlay
                      if (_hasImage && !widget.isUploading)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Row(
                            children: [
                              if (widget.localBytes != null)
                                _buildMiniButton(
                                  Icons.refresh,
                                  'Reset',
                                  _resetTransform,
                                  isDark,
                                ),
                              const SizedBox(width: 6),
                              _buildMiniButton(
                                Icons.edit,
                                'Replace',
                                widget.onTap,
                                isDark,
                              ),
                              const SizedBox(width: 6),
                              _buildMiniButton(
                                Icons.delete_outline,
                                'Remove',
                                widget.onDelete ?? () {},
                                isDark,
                                isDestructive: true,
                              ),
                            ],
                          ),
                        ),
                      
                      // Drag hint
                      if (_hasImage && widget.localBytes != null && !widget.isUploading)
                        Positioned(
                          bottom: 8,
                          left: 0,
                          right: 0,
                          child: Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: const [
                                  Icon(Icons.open_with, size: 12, color: Colors.white70),
                                  SizedBox(width: 4),
                                  Text(
                                    'Drag to reposition • Pinch to zoom',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Colors.white70,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniButton(IconData icon, String tooltip, VoidCallback onTap, bool isDark, {bool isDestructive = false}) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: isDark ? Colors.black54 : Colors.white.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(6),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4),
              ],
            ),
            child: Icon(
              icon,
              size: 14,
              color: isDestructive ? Colors.red : (isDark ? Colors.white : Colors.grey[700]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark, Color accentColor) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.add_photo_alternate_outlined, size: 24, color: accentColor),
          ),
          const SizedBox(height: 10),
          Text(
            'Click to upload',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: isDark ? Colors.white70 : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'or drag and drop',
            style: TextStyle(
              fontSize: 10,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlaceholder(bool isDark) {
    return Container(
      color: isDark ? Colors.grey[800] : Colors.grey[200],
      child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
    );
  }
}

/// Dashed border painter
class _DashedBorderPainter extends CustomPainter {
  final Color color;

  _DashedBorderPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    const dashWidth = 6.0;
    const dashSpace = 4.0;
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(1, 1, size.width - 2, size.height - 2),
        const Radius.circular(11),
      ));

    final dashPath = Path();
    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final length = dashWidth.clamp(0.0, metric.length - distance);
        dashPath.addPath(metric.extractPath(distance, distance + length), Offset.zero);
        distance += dashWidth + dashSpace;
      }
    }
    canvas.drawPath(dashPath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Professional input field with icon and validation
class ProfessionalInputField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final int maxLines;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;

  const ProfessionalInputField({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.maxLines = 1,
    this.validator,
    this.keyboardType,
    this.inputFormatters,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey[200]!,
        ),
      ),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        validator: validator,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        style: TextStyle(
          fontSize: 14,
          color: isDark ? Colors.white : Colors.black87,
        ),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: Icon(icon, size: 20, color: accentColor),
          labelStyle: TextStyle(fontSize: 13, color: Colors.grey[500]),
          hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }
}
