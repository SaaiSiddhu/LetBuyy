// lib/screens/seller/settings/widgets/document_preview_screen.dart

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:gal/gal.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import 'package:provider/provider.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

class DocumentPreviewScreen extends StatefulWidget {
  final String? imageUrl;
  final File? imageFile;
  final String documentName;
  final String documentType;
  final bool isVerified;

  const DocumentPreviewScreen({
    super.key,
    this.imageUrl,
    this.imageFile,
    required this.documentName,
    required this.documentType,
    this.isVerified = false,
  })  : assert(imageUrl != null || imageFile != null,
            'Either imageUrl or imageFile must be provided');

  @override
  State<DocumentPreviewScreen> createState() => _DocumentPreviewScreenState();
}

class _DocumentPreviewScreenState extends State<DocumentPreviewScreen> {
  bool _isDownloading = false;
  final bool _isImageLoaded = false;
  double _scale = 1.0;
  late TransformationController _transformationController;

  @override
  void initState() {
    super.initState();
    _transformationController = TransformationController();
  }

  @override
  void dispose() {
    _transformationController.dispose();
    super.dispose();
  }

  // ✅ Download Image Function
  Future<void> _downloadImage() async {
    setState(() => _isDownloading = true);
    
    try {
      // Check gallery access
      final hasAccess = await Gal.hasAccess();
      if (!hasAccess) {
        await Gal.requestAccess();
      }

      // Get temporary directory
      final tempDir = await getTemporaryDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final fileName = 'LetBuyy_${widget.documentType}_$timestamp.jpg';
      final filePath = '${tempDir.path}/$fileName';

      if (widget.imageFile != null) {
        // Copy file if it's a local file
        await widget.imageFile!.copy(filePath);
      } else if (widget.imageUrl != null) {
        // Download if it's a URL
        await Dio().download(widget.imageUrl!, filePath);
      } else {
        throw Exception('No image source available');
      }

      // Save to gallery
      await Gal.putImage(filePath, album: 'LetBuyy KYC');

      if (mounted) {
        SnackbarHelper.showSuccess(
          context, 
          'Document saved to Gallery (Album: LetBuyy KYC)'
        );
      }
    } catch (e) {
      if (mounted) {
        SnackbarHelper.showError(context, 'Download failed: $e');
      }
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  // ✅ Reset Zoom Function
  void _resetZoom() {
    _transformationController.value = Matrix4.identity();
    setState(() => _scale = 1.0);
  }

  // ✅ Get Document Icon
  IconData _getDocumentIcon() {
    switch (widget.documentType) {
      case 'aadhar_front':
      case 'aadhar_back':
        return Icons.credit_card_rounded;
      case 'pan_card':
        return Icons.account_balance_wallet_rounded;
      case 'selfie':
        return Icons.face_retouching_natural_rounded;
      default:
        return Icons.document_scanner_rounded;
    }
  }

  // ✅ Get Document Type Color
  Color _getDocumentColor(bool isDark) {
    switch (widget.documentType) {
      case 'aadhar_front':
      case 'aadhar_back':
        return const Color(0xFF4CAF50);
      case 'pan_card':
        return const Color(0xFF2196F3);
      case 'selfie':
        return const Color(0xFF9C27B0);
      default:
        return isDark ? AppColors.primaryLight : AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final documentColor = _getDocumentColor(isDark);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // ✅ Main Image Content
          Positioned.fill(
            child: InteractiveViewer(
              transformationController: _transformationController,
              minScale: 0.5,
              maxScale: 4.0,
              onInteractionUpdate: (ScaleUpdateDetails details) {
                setState(() => _scale = details.scale);
              },
              child: Center(
                child: widget.imageFile != null
                    ? Image.file(
                        widget.imageFile!,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) {
                          return _buildErrorState(isDark);
                        },
                      )
                    : (widget.imageUrl!.startsWith('file://') || widget.imageUrl!.startsWith('/'))
                        ? Image.file(
                            File(widget.imageUrl!.startsWith('file://') 
                                ? Uri.parse(widget.imageUrl!).toFilePath() 
                                : widget.imageUrl!),
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return _buildErrorState(isDark);
                            },
                          )
                        : CachedNetworkImage(
                            imageUrl: widget.imageUrl!,
                            fit: BoxFit.contain,
                            placeholder: (context, url) => _buildLoadingState(isDark),
                            errorWidget: (context, url, error) => _buildErrorState(isDark),
                          ),
              ),
            ),
          ),

          // ✅ Top Gradient Overlay
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 120,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.8),
                    Colors.black.withValues(alpha: 0.4),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ✅ Bottom Gradient Overlay
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 160,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.9),
                    Colors.black.withValues(alpha: 0.6),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ✅ Top App Bar
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            right: 16,
            child: Row(
              children: [
                // Back Button
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
                
                const Spacer(),
                
                // Document Type Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: documentColor.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: documentColor.withValues(alpha: 0.5),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_getDocumentIcon(), color: Colors.white, size: 16),
                      const SizedBox(width: 8),
                      Text(
                        widget.documentName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                
                const Spacer(),
                
                // Close Button
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
          ),

          // ✅ Zoom Controls
          if (_scale != 1.0)
            Positioned(
              top: MediaQuery.of(context).padding.top + 80,
              right: 16,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: IconButton(
                  icon: const Icon(Icons.zoom_out_map_rounded, color: Colors.white, size: 20),
                  onPressed: _resetZoom,
                ),
              ),
            ),

          // ✅ Bottom Action Bar
          Positioned(
            bottom: MediaQuery.of(context).padding.bottom + 20,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.2),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Download Button
                  _buildActionButton(
                    icon: _isDownloading ? Icons.downloading_rounded : Icons.download_rounded,
                    label: _isDownloading ? 'Saving...' : 'Save to Gallery',
                    onTap: _downloadImage,
                    isDisabled: _isDownloading,
                    color: const Color(0xFF4CAF50),
                  ),

                  // Share Button (Optional - can be implemented later)
                  _buildActionButton(
                    icon: Icons.share_rounded,
                    label: 'Share',
                    onTap: () {
                      // TODO: Implement share functionality
                      SnackbarHelper.showInfo(context, 'Share feature coming soon');
                    },
                    color: const Color(0xFF2196F3),
                  ),

                  // Info Button
                  _buildActionButton(
                    icon: Icons.info_outline_rounded,
                    label: 'Details',
                    onTap: _showDocumentDetails,
                    color: const Color(0xFF9C27B0),
                  ),
                ],
              ),
            ),
          ),

          // ✅ Verified Badge (if verified)
          if (widget.isVerified)
            Positioned(
              top: MediaQuery.of(context).padding.top + 80,
              left: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.success,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.success.withValues(alpha: 0.5),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.verified_rounded, color: Colors.white, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      'Verified',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // ✅ Zoom Level Indicator
          if (_scale != 1.0)
            Positioned(
              top: MediaQuery.of(context).padding.top + 130,
              right: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${(_scale * 100).toInt()}%',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isDisabled = false,
    required Color color,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 50,
          height: 50,
          decoration: BoxDecoration(
            color: color.withValues(alpha: isDisabled ? 0.3 : 0.9),
            borderRadius: BorderRadius.circular(25),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: isDisabled ? 0.1 : 0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: IconButton(
            icon: Icon(icon, color: Colors.white, size: 20),
            onPressed: isDisabled ? null : onTap,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: isDisabled ? 0.5 : 0.9),
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 60,
          height: 60,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(30),
          ),
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: isDark ? AppColors.primaryLight : AppColors.primary,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'Loading Document...',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState(bool isDark) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.7),
            shape: BoxShape.circle,
          ),
          child: Icon(
            Icons.error_outline_rounded,
            color: Colors.white54,
            size: 40,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'Failed to Load Document',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Please check your connection and try again',
          style: TextStyle(
            color: Colors.white54,
            fontSize: 14,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back_rounded),
          label: const Text('Go Back'),
          style: ElevatedButton.styleFrom(
            backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
            foregroundColor: Colors.white,
          ),
        ),
      ],
    );
  }

  // ✅ Show Document Details Dialog
  void _showDocumentDetails() {
    final themeProvider = Provider.of<ThemeProvider>(context, listen: false);
    final isDark = themeProvider.isDarkMode;
    final documentColor = _getDocumentColor(isDark);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: documentColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_getDocumentIcon(), color: documentColor, size: 20),
            ),
            const SizedBox(width: 12),
            Text(
              'Document Details',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDetailRow('Document Type', widget.documentName),
            _buildDetailRow('Category', _getDocumentCategory()),
            if (widget.imageFile != null)
              _buildDetailRow(
                'File Size', 
                '${(widget.imageFile!.lengthSync() / 1024).toStringAsFixed(1)} KB'
              ),
            if (widget.isVerified)
              _buildDetailRow('Verification Status', 'Verified ✓', isSuccess: true),
            _buildDetailRow('Source', widget.imageFile != null ? 'Local File' : 'Cloud Storage'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isSuccess = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: isSuccess ? AppColors.success : null,
                fontWeight: isSuccess ? FontWeight.bold : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getDocumentCategory() {
    switch (widget.documentType) {
      case 'aadhar_front':
      case 'aadhar_back':
        return 'Identity Document';
      case 'pan_card':
        return 'Tax Document';
      case 'selfie':
        return 'Biometric Verification';
      default:
        return 'KYC Document';
    }
  }
}