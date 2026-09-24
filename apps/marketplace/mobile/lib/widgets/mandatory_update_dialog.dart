// lib/widgets/mandatory_update_dialog.dart
// Premium Update Dialog with Glassmorphic Design & Direct APK Install

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import 'package:permission_handler/permission_handler.dart';

import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class MandatoryUpdateDialog extends StatefulWidget {
  final AppUpdateModel update;
  final String currentVersion;

  const MandatoryUpdateDialog({
    super.key,
    required this.update,
    required this.currentVersion,
  });

  static Future<void> show(
      BuildContext context, AppUpdateModel update, String currentVersion) {
    return showDialog(
      context: context,
      barrierDismissible: !update.mandatory,
      barrierColor: Colors.black.withValues(alpha: 0.8),
      builder: (context) => PopScope(
        canPop: !update.mandatory,
        child: MandatoryUpdateDialog(
          update: update,
          currentVersion: currentVersion,
        ),
      ),
    );
  }

  @override
  State<MandatoryUpdateDialog> createState() => _MandatoryUpdateDialogState();
}

class _MandatoryUpdateDialogState extends State<MandatoryUpdateDialog>
    with TickerProviderStateMixin {
  // Download states
  bool _isDownloading = false;
  bool _isDownloaded = false;
  double _downloadProgress = 0.0;
  String _downloadStatus = '';
  String? _errorMessage;
  String? _downloadedFilePath;

  // Speed tracking
  double _downloadSpeed = 0;
  DateTime? _lastSpeedUpdate;
  int _lastBytesReceived = 0;

  // UI states
  bool _showReleaseNotes = false;

  final Dio _dio = Dio();

  // Animation controllers
  late AnimationController _pulseController;
  late AnimationController _progressController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void dispose() {
    _dio.close();
    _pulseController.dispose();
    _progressController.dispose();
    super.dispose();
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  String _formatSpeed(double bytesPerSecond) {
    if (bytesPerSecond <= 0) return '';
    if (bytesPerSecond < 1024) return '${bytesPerSecond.toStringAsFixed(0)} B/s';
    if (bytesPerSecond < 1024 * 1024) {
      return '${(bytesPerSecond / 1024).toStringAsFixed(1)} KB/s';
    }
    return '${(bytesPerSecond / 1024 / 1024).toStringAsFixed(1)} MB/s';
  }

  Future<void> _downloadApk() async {
    if (_isDownloading) return;

    // Check if APK URL exists
    if (widget.update.apkUrl.isEmpty) {
      setState(() {
        _errorMessage = 'No download URL available. Please contact support.';
      });
      debugPrint('❌ Update APK URL is empty!');
      return;
    }

    debugPrint('📥 Starting APK download: ${widget.update.apkUrl}');

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0;
      _downloadStatus = 'Requesting permission...';
      _errorMessage = null;
    });

    try {
      // Request storage permission for Android
      if (Platform.isAndroid) {
        debugPrint('📱 Requesting storage permissions...');
        
        // For Android 10+ we need different approach
        var status = await Permission.storage.status;
        if (!status.isGranted) {
          status = await Permission.storage.request();
        }
        
        // For Android 11+ try manage external storage
        if (!status.isGranted) {
          await Permission.manageExternalStorage.request();
        }
        
        debugPrint('📱 Storage permission: $status');
      }

      setState(() => _downloadStatus = 'Preparing download...');

      // Get downloads directory
      Directory? downloadDir;
      if (Platform.isAndroid) {
        // Try public downloads first
        downloadDir = Directory('/storage/emulated/0/Download');
        if (!await downloadDir.exists()) {
          // Fallback to app external storage
          downloadDir = await getExternalStorageDirectory();
        }
        // Final fallback to app documents
        downloadDir ??= await getApplicationDocumentsDirectory();
      } else {
        downloadDir =
            await getDownloadsDirectory() ?? await getApplicationDocumentsDirectory();
      }

      final versionName = widget.update.formattedVersionName;
      final filePath = '${downloadDir.path}/LetBuyy_v$versionName.apk';
      
      debugPrint('📁 Download path: $filePath');

      setState(() => _downloadStatus = 'Downloading...');

      _lastSpeedUpdate = DateTime.now();
      _lastBytesReceived = 0;

      // Download APK with progress
      await _dio.download(
        widget.update.apkUrl,
        filePath,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            // Calculate speed
            final now = DateTime.now();
            if (_lastSpeedUpdate != null) {
              final elapsed = now.difference(_lastSpeedUpdate!).inMilliseconds;
              if (elapsed >= 500) {
                final bytesPerSecond =
                    (received - _lastBytesReceived) / (elapsed / 1000);
                _downloadSpeed = bytesPerSecond;
                _lastSpeedUpdate = now;
                _lastBytesReceived = received;
              }
            }

            setState(() {
              _downloadProgress = received / total;
              _downloadStatus =
                  '${_formatBytes(received)} / ${_formatBytes(total)}';
            });
          }
        },
      );

      debugPrint('✅ Download complete: $filePath');

      setState(() {
        _downloadProgress = 1.0;
        _isDownloaded = true;
        _isDownloading = false;
        _downloadedFilePath = filePath;
        _downloadStatus = 'Download complete! Tap Install';
      });
    } catch (e) {
      debugPrint('❌ Download failed: $e');
      setState(() {
        _errorMessage = 'Download failed: ${e.toString().split(':').last.trim()}';
        _isDownloading = false;
        _downloadProgress = 0;
      });
    }
  }

  Future<void> _installApk() async {
    if (_downloadedFilePath == null) {
      debugPrint('❌ No downloaded file path!');
      return;
    }

    debugPrint('📦 Installing APK: $_downloadedFilePath');
    setState(() => _downloadStatus = 'Opening installer...');

    try {
      // Request install packages permission for Android
      if (Platform.isAndroid) {
        final installStatus = await Permission.requestInstallPackages.status;
        if (!installStatus.isGranted) {
          await Permission.requestInstallPackages.request();
        }
      }

      final result = await OpenFilex.open(_downloadedFilePath!);
      debugPrint('📦 OpenFilex result: ${result.type} - ${result.message}');

      if (result.type != ResultType.done) {
        setState(() {
          _errorMessage = 'Could not open APK. Please install manually from Downloads.';
        });
      }
    } catch (e) {
      debugPrint('❌ Install error: $e');
      setState(() {
        _errorMessage = 'Install failed. Please install manually from Downloads folder.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(24),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.9,
        constraints: const BoxConstraints(maxWidth: 400),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withValues(alpha: 0.95),
              Colors.white.withValues(alpha: 0.9),
            ],
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.2),
              blurRadius: 40,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header with animated icon
            _buildHeader(),

            // Content
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  // Version Badge
                  _buildVersionBadge(),
                  const SizedBox(height: 16),

                  // Update Message
                  Text(
                    widget.update.updateMessage.isNotEmpty
                        ? widget.update.updateMessage
                        : 'A new version is available with improvements and bug fixes.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                      height: 1.5,
                    ),
                  ),

                  // Release Notes (expandable)
                  if (widget.update.releaseNotes.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _buildReleaseNotesSection(),
                  ],

                  const SizedBox(height: 24),

                  // Progress Section
                  if (_isDownloading || _isDownloaded) _buildProgressSection(),

                  // Error Message
                  if (_errorMessage != null) _buildErrorSection(),

                  // Action Buttons
                  _buildActionButtons(),

                  const SizedBox(height: 20),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Animated Icon
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              final scale = 1.0 + 0.05 * _pulseController.value;
              return Transform.scale(
                scale: scale,
                child: Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.primaryDark, AppColors.primary],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color:
                            AppColors.primary.withValues(alpha: 0.3 + 0.1 * _pulseController.value),
                        blurRadius: 20 + 10 * _pulseController.value,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    _isDownloaded
                        ? Icons.check_circle_outline_rounded
                        : (_isDownloading
                            ? Icons.downloading_rounded
                            : Icons.system_update_rounded),
                    size: 40,
                    color: Colors.white,
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 20),

          // Title
          Text(
            _isDownloaded
                ? 'Ready to Install!'
                : (widget.update.mandatory
                    ? 'Update Required'
                    : 'Update Available'),
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVersionBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.1),
            AppColors.primaryDark.withValues(alpha: 0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'v${widget.currentVersion}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Colors.grey[600],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Icon(
              Icons.arrow_forward_rounded,
              size: 16,
              color: AppColors.primary,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'v${widget.update.formattedVersionName}',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReleaseNotesSection() {
    return Column(
      children: [
        InkWell(
          onTap: () => setState(() => _showReleaseNotes = !_showReleaseNotes),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _showReleaseNotes ? Icons.expand_less : Icons.expand_more,
                  color: AppColors.primary,
                  size: 20,
                ),
                const SizedBox(width: 4),
                Text(
                  _showReleaseNotes ? 'Hide Release Notes' : 'View Release Notes',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
        AnimatedCrossFade(
          firstChild: const SizedBox.shrink(),
          secondChild: Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              widget.update.releaseNotes,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey[700],
                height: 1.6,
              ),
            ),
          ),
          crossFadeState: _showReleaseNotes
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          duration: const Duration(milliseconds: 200),
        ),
      ],
    );
  }

  Widget _buildProgressSection() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        children: [
          // Circular Progress
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 100,
                height: 100,
                child: CircularProgressIndicator(
                  value: _downloadProgress > 0 ? _downloadProgress : null,
                  strokeWidth: 8,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _isDownloaded ? Colors.green : AppColors.primary,
                  ),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_isDownloaded)
                    const Icon(Icons.check, color: Colors.green, size: 32)
                  else
                    Text(
                      '${(_downloadProgress * 100).toInt()}%',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Status Text
          Text(
            _downloadStatus,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: _isDownloaded ? Colors.green : Colors.grey[700],
            ),
          ),

          // Speed indicator
          if (_isDownloading && _downloadSpeed > 0) ...[
            const SizedBox(height: 4),
            Text(
              _formatSpeed(_downloadSpeed),
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[500],
              ),
            ),
          ],

          // File size
          if (widget.update.fileSize > 0 && !_isDownloaded) ...[
            const SizedBox(height: 4),
            Text(
              'Size: ${widget.update.formattedFileSize}',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[500],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorSection() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red[200]!),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red[600], size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _errorMessage!,
              style: TextStyle(
                fontSize: 12,
                color: Colors.red[600],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    // State: Downloaded - Show Install Button
    if (_isDownloaded) {
      return SizedBox(
        width: double.infinity,
        height: 54,
        child: ElevatedButton(
          onPressed: _installApk,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.green,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.install_mobile_rounded, size: 22),
              SizedBox(width: 10),
              Text(
                'Install Now',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // State: Downloading - Show progress
    if (_isDownloading) {
      return SizedBox(
        width: double.infinity,
        height: 54,
        child: ElevatedButton(
          onPressed: null,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.grey[300],
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 0,
          ),
          child: const Text(
            'Downloading...',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Colors.grey,
            ),
          ),
        ),
      );
    }

    // State: Initial - Show Download Button
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 54,
          child: ElevatedButton(
            onPressed: _downloadApk,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              elevation: 0,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.download_rounded, size: 22),
                const SizedBox(width: 10),
                Text(
                  widget.update.fileSize > 0
                      ? 'Download (${widget.update.formattedFileSize})'
                      : 'Download & Update',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Skip Button (only for non-mandatory)
        if (!widget.update.mandatory) ...[
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              'Remind me later',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 14,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
