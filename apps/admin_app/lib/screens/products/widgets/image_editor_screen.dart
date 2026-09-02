// lib/screens/products/widgets/image_editor_screen.dart
// 📸 Professional Full-Screen Image Editor like Instagram/Shopify
// Full image visible, crop frame acts as window, drag moves image behind crop

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Professional image editor screen with crop, rotate, flip functionality
/// Shows full image with crop frame overlay - drag to position image in frame
class ImageEditorScreen extends StatefulWidget {
  final Uint8List imageBytes;
  final double? aspectRatio;
  final String title;
  final String imageType;

  const ImageEditorScreen({
    super.key,
    required this.imageBytes,
    this.aspectRatio,
    this.title = 'Edit Image',
    this.imageType = 'icon',
  });

  @override
  State<ImageEditorScreen> createState() => _ImageEditorScreenState();
}

class _ImageEditorScreenState extends State<ImageEditorScreen>
    with TickerProviderStateMixin {
  // Transform state for the IMAGE (behind crop frame)
  Offset _imageOffset = Offset.zero;
  double _imageScale = 1.0;
  double _rotation = 0.0;
  bool _flipHorizontal = false;

  // Gesture tracking
  double _baseScale = 1.0;
  Offset _startOffset = Offset.zero;
  Offset _startFocalPoint = Offset.zero;

  // Aspect ratio
  double? _aspectRatio;
  String _selectedAspectRatioLabel = '1:1';

  // Grid
  bool _showGrid = true;

  @override
  void initState() {
    super.initState();
    _aspectRatio = widget.aspectRatio;
    _selectedAspectRatioLabel = _getAspectRatioLabel(_aspectRatio);
  }

  String _getAspectRatioLabel(double? ratio) {
    if (ratio == null) return 'Free';
    if (ratio == 1.0) return '1:1';
    if (ratio == 4.0) return '4:1';
    if ((ratio - 4/3).abs() < 0.01) return '4:3';
    if ((ratio - 16/9).abs() < 0.01) return '16:9';
    return 'Custom';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTURES - Move the image behind the crop frame
  // ═══════════════════════════════════════════════════════════════════════════

  void _onScaleStart(ScaleStartDetails details) {
    _baseScale = _imageScale;
    _startOffset = _imageOffset;
    _startFocalPoint = details.focalPoint;
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      // Scale with limits
      _imageScale = (_baseScale * details.scale).clamp(0.5, 4.0);
      
      // Pan - move image behind crop frame
      final focalDelta = details.focalPoint - _startFocalPoint;
      _imageOffset = _startOffset + focalDelta;
    });
  }

  void _onPointerSignal(PointerSignalEvent event) {
    if (event is PointerScrollEvent) {
      setState(() {
        final delta = event.scrollDelta.dy > 0 ? -0.1 : 0.1;
        _imageScale = (_imageScale + delta).clamp(0.5, 4.0);
      });
    }
  }

  void _rotate90() {
    HapticFeedback.lightImpact();
    setState(() {
      _rotation += math.pi / 2;
      if (_rotation >= math.pi * 2) _rotation = 0;
    });
  }

  void _flipImage() {
    HapticFeedback.lightImpact();
    setState(() => _flipHorizontal = !_flipHorizontal);
  }

  void _resetTransform() {
    HapticFeedback.mediumImpact();
    setState(() {
      _imageOffset = Offset.zero;
      _imageScale = 1.0;
      _rotation = 0.0;
      _flipHorizontal = false;
    });
  }

  void _setAspectRatio(double? ratio, String label) {
    HapticFeedback.selectionClick();
    setState(() {
      _aspectRatio = ratio;
      _selectedAspectRatioLabel = label;
    });
  }

  Future<void> _applyCrop() async {
    HapticFeedback.mediumImpact();
    Navigator.of(context).pop(widget.imageBytes);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = AppColors.primary;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0A0A) : const Color(0xFFF5F5F5),
      appBar: _buildAppBar(isDark, accentColor),
      body: Column(
        children: [
          Expanded(child: _buildImagePreview(isDark, accentColor)),
          _buildBottomToolbar(isDark, accentColor),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, Color accentColor) {
    return AppBar(
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.close, color: isDark ? Colors.white : Colors.black87),
        onPressed: () => Navigator.of(context).pop(),
        tooltip: 'Cancel',
      ),
      title: Text(
        widget.title,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : Colors.black87,
        ),
      ),
      centerTitle: true,
      actions: [
        IconButton(
          icon: Icon(Icons.refresh, color: isDark ? Colors.white54 : Colors.grey[600]),
          onPressed: _resetTransform,
          tooltip: 'Reset',
        ),
        Padding(
          padding: const EdgeInsets.only(right: 8),
          child: TextButton(
            onPressed: _applyCrop,
            style: TextButton.styleFrom(
              backgroundColor: accentColor,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Apply', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _buildImagePreview(bool isDark, Color accentColor) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate crop frame size based on aspect ratio
        final maxWidth = constraints.maxWidth - 48;
        final maxHeight = constraints.maxHeight - 48;
        
        double cropWidth, cropHeight;
        if (_aspectRatio != null) {
          if (maxWidth / _aspectRatio! <= maxHeight) {
            cropWidth = maxWidth;
            cropHeight = maxWidth / _aspectRatio!;
          } else {
            cropHeight = maxHeight;
            cropWidth = maxHeight * _aspectRatio!;
          }
        } else {
          cropWidth = maxWidth * 0.9;
          cropHeight = maxHeight * 0.7;
        }

        return Listener(
          onPointerSignal: _onPointerSignal,
          child: GestureDetector(
            onScaleStart: _onScaleStart,
            onScaleUpdate: _onScaleUpdate,
            child: Container(
              color: Colors.black,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // FULL IMAGE - transformed and positioned
                  Transform.translate(
                    offset: _imageOffset,
                    child: Transform.scale(
                      scale: _imageScale,
                      child: Transform.rotate(
                        angle: _rotation,
                        child: Transform.flip(
                          flipX: _flipHorizontal,
                          child: Image.memory(
                            widget.imageBytes,
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
                    ),
                  ),
                  
                  // DARK OVERLAY with crop window cut out
                  _buildCropOverlay(cropWidth, cropHeight),
                  
                  // CROP FRAME border
                  Container(
                    width: cropWidth,
                    height: cropHeight,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.white, width: 2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: _showGrid ? _buildGridOverlay() : null,
                  ),
                  
                  // Corner handles
                  _buildCornerHandles(cropWidth, cropHeight),
                  
                  // Size indicator
                  Positioned(
                    bottom: 24,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.crop, size: 14, color: Colors.white70),
                          const SizedBox(width: 6),
                          Text(
                            '${cropWidth.toInt()} × ${cropHeight.toInt()} • ${(_imageScale * 100).toInt()}%',
                            style: const TextStyle(fontSize: 11, color: Colors.white70, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                  // Hint text
                  Positioned(
                    top: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.open_with, size: 14, color: Colors.white70),
                          SizedBox(width: 6),
                          Text(
                            'Drag to position image • Pinch or scroll to zoom',
                            style: TextStyle(fontSize: 11, color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCropOverlay(double cropWidth, double cropHeight) {
    return IgnorePointer(
      child: ClipPath(
        clipper: _CropFrameClipper(cropWidth, cropHeight),
        child: Container(
          color: Colors.black.withAlpha(180),
        ),
      ),
    );
  }

  Widget _buildCornerHandles(double cropWidth, double cropHeight) {
    const handleSize = 20.0;
    const handleThickness = 3.0;
    
    return SizedBox(
      width: cropWidth,
      height: cropHeight,
      child: Stack(
        children: [
          // Top-left
          Positioned(
            top: -1,
            left: -1,
            child: _buildCornerHandle(handleSize, handleThickness, true, true),
          ),
          // Top-right
          Positioned(
            top: -1,
            right: -1,
            child: _buildCornerHandle(handleSize, handleThickness, true, false),
          ),
          // Bottom-left
          Positioned(
            bottom: -1,
            left: -1,
            child: _buildCornerHandle(handleSize, handleThickness, false, true),
          ),
          // Bottom-right
          Positioned(
            bottom: -1,
            right: -1,
            child: _buildCornerHandle(handleSize, handleThickness, false, false),
          ),
        ],
      ),
    );
  }

  Widget _buildCornerHandle(double size, double thickness, bool isTop, bool isLeft) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _CornerHandlePainter(
          isTop: isTop,
          isLeft: isLeft,
          thickness: thickness,
        ),
      ),
    );
  }

  Widget _buildGridOverlay() {
    return CustomPaint(
      painter: _GridPainter(color: Colors.white.withAlpha(80)),
      child: Container(),
    );
  }

  Widget _buildBottomToolbar(bool isDark, Color accentColor) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [BoxShadow(color: Colors.black.withAlpha(25), blurRadius: 10, offset: const Offset(0, -4))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
          ),
          
          // Aspect ratio section
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12, left: 4),
                child: Text('Aspect Ratio', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : Colors.grey[600])),
              ),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildAspectRatioChip('1:1', 1.0, isDark, accentColor),
                    _buildAspectRatioChip('4:1', 4.0, isDark, accentColor),
                    _buildAspectRatioChip('4:3', 4/3, isDark, accentColor),
                    _buildAspectRatioChip('16:9', 16/9, isDark, accentColor),
                    _buildAspectRatioChip('Free', null, isDark, accentColor),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 20),
          
          // Transform actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildActionButton(Icons.rotate_90_degrees_cw_rounded, 'Rotate', _rotate90, isDark, accentColor),
              _buildActionButton(Icons.flip_rounded, 'Flip', _flipImage, isDark, accentColor),
              _buildActionButton(_showGrid ? Icons.grid_on : Icons.grid_off, 'Grid', () => setState(() => _showGrid = !_showGrid), isDark, accentColor, isActive: _showGrid),
              _buildActionButton(Icons.center_focus_strong, 'Center', _resetTransform, isDark, accentColor),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAspectRatioChip(String label, double? ratio, bool isDark, Color accentColor) {
    final isSelected = _selectedAspectRatioLabel == label;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _setAspectRatio(ratio, label),
          borderRadius: BorderRadius.circular(20),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: isSelected ? accentColor : (isDark ? Colors.white.withAlpha(20) : Colors.grey[100]),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: isSelected ? accentColor : (isDark ? Colors.white.withAlpha(25) : Colors.grey[300]!)),
            ),
            child: Text(label, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.w500, color: isSelected ? Colors.white : (isDark ? Colors.white70 : Colors.grey[700]))),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String label, VoidCallback onTap, bool isDark, Color accentColor, {bool isActive = false}) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isActive ? accentColor.withAlpha(38) : (isDark ? Colors.white.withAlpha(13) : Colors.grey[100]),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 22, color: isActive ? accentColor : (isDark ? Colors.white70 : Colors.grey[700])),
              ),
              const SizedBox(height: 6),
              Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: isDark ? Colors.white54 : Colors.grey[600])),
            ],
          ),
        ),
      ),
    );
  }
}

/// Custom clipper to create crop frame cutout in dark overlay
class _CropFrameClipper extends CustomClipper<Path> {
  final double cropWidth;
  final double cropHeight;

  _CropFrameClipper(this.cropWidth, this.cropHeight);

  @override
  Path getClip(Size size) {
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    
    final cropRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: cropWidth,
      height: cropHeight,
    );
    
    path.addRRect(RRect.fromRectAndRadius(cropRect, const Radius.circular(4)));
    path.fillType = PathFillType.evenOdd;
    
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => true;
}

/// Grid painter for rule of thirds
class _GridPainter extends CustomPainter {
  final Color color;
  _GridPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;

    final thirdWidth = size.width / 3;
    canvas.drawLine(Offset(thirdWidth, 0), Offset(thirdWidth, size.height), paint);
    canvas.drawLine(Offset(thirdWidth * 2, 0), Offset(thirdWidth * 2, size.height), paint);

    final thirdHeight = size.height / 3;
    canvas.drawLine(Offset(0, thirdHeight), Offset(size.width, thirdHeight), paint);
    canvas.drawLine(Offset(0, thirdHeight * 2), Offset(size.width, thirdHeight * 2), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Corner handle painter
class _CornerHandlePainter extends CustomPainter {
  final bool isTop;
  final bool isLeft;
  final double thickness;

  _CornerHandlePainter({required this.isTop, required this.isLeft, required this.thickness});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = thickness
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    
    if (isTop && isLeft) {
      path.moveTo(0, size.height);
      path.lineTo(0, 0);
      path.lineTo(size.width, 0);
    } else if (isTop && !isLeft) {
      path.moveTo(0, 0);
      path.lineTo(size.width, 0);
      path.lineTo(size.width, size.height);
    } else if (!isTop && isLeft) {
      path.moveTo(0, 0);
      path.lineTo(0, size.height);
      path.lineTo(size.width, size.height);
    } else {
      path.moveTo(0, size.height);
      path.lineTo(size.width, size.height);
      path.lineTo(size.width, 0);
    }
    
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
