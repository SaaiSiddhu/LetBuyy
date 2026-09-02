// lib/screens/download/download_screen.dart
// 📱 Premium APK Download Landing Page for Admin App

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class DownloadScreen extends StatefulWidget {
  const DownloadScreen({super.key});

  @override
  State<DownloadScreen> createState() => _DownloadScreenState();
}

class _DownloadScreenState extends State<DownloadScreen>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _floatController;
  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);

    // Load updates
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppUpdateProvider>(context, listen: false).loadUpdates();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _floatController.dispose();
    super.dispose();
  }

  Future<void> _downloadApk(String url) async {
    if (url.isEmpty) return;

    setState(() => _isDownloading = true);

    try {
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isDownloading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isMobile = size.width < 600;
    final isTablet = size.width >= 600 && size.width < 1024;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Stack(
        children: [
          // Animated Background
          _buildAnimatedBackground(isDark, size),

          // Content
          SafeArea(
            child: Consumer<AppUpdateProvider>(
              builder: (context, provider, _) {
                final update = provider.getLatestActiveUpdate(AppType.admin);

                if (provider.isLoading) {
                  return const Center(
                    child: CircularProgressIndicator(),
                  );
                }

                return SingleChildScrollView(
                  padding: EdgeInsets.symmetric(
                    horizontal: isMobile ? 20 : (isTablet ? 40 : 80),
                    vertical: 40,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 600),
                      child: Column(
                        children: [
                          // App Icon with Animation
                          _buildAppIcon(isDark),
                          const SizedBox(height: 24),

                          // App Title
                          _buildAppTitle(isDark),
                          const SizedBox(height: 8),

                          // Version Badge
                          if (update != null) _buildVersionBadge(update, isDark),
                          const SizedBox(height: 40),

                          // Download Card
                          _buildDownloadCard(update, isDark, isMobile),
                          const SizedBox(height: 32),

                          // Features List
                          _buildFeaturesList(isDark),
                          const SizedBox(height: 32),

                          // Release Notes
                          if (update != null && update.releaseNotes.isNotEmpty)
                            _buildReleaseNotes(update, isDark),

                          const SizedBox(height: 40),

                          // Footer
                          _buildFooter(isDark),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedBackground(bool isDark, Size size) {
    final baseColor = isDark ? const Color(0xFF1A1A2E) : const Color(0xFFF0F4FF);
    final accentColor = isDark ? AppColors.primaryDark : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            baseColor,
            isDark ? const Color(0xFF16213E) : const Color(0xFFE8EFFF),
          ],
        ),
      ),
      child: Stack(
        children: [
          // Floating orbs
          AnimatedBuilder(
            animation: _floatController,
            builder: (context, child) {
              final value = _floatController.value;
              return Stack(
                children: [
                  Positioned(
                    top: size.height * 0.1 + (value * 20),
                    right: size.width * 0.1,
                    child: _buildOrb(80, accentColor.withValues(alpha: 0.1)),
                  ),
                  Positioned(
                    top: size.height * 0.5 - (value * 15),
                    left: size.width * 0.05,
                    child: _buildOrb(120, accentColor.withValues(alpha: 0.08)),
                  ),
                  Positioned(
                    bottom: size.height * 0.2 + (value * 10),
                    right: size.width * 0.2,
                    child: _buildOrb(60, accentColor.withValues(alpha: 0.12)),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildOrb(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.5),
            blurRadius: size / 2,
            spreadRadius: size / 4,
          ),
        ],
      ),
    );
  }

  Widget _buildAppIcon(bool isDark) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = 1.0 + (_pulseController.value * 0.05);
        return Transform.scale(
          scale: scale,
          child: Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.primary,
                  AppColors.primaryDark,
                ],
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.4),
                  blurRadius: 30,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: const Center(
              child: Icon(
                Icons.admin_panel_settings,
                size: 56,
                color: Colors.white,
              ),
            ),
          ),
        );
      },
    ).animate().fadeIn(duration: 600.ms).scale(
          begin: const Offset(0.8, 0.8),
          end: const Offset(1, 1),
          curve: Curves.easeOutBack,
        );
  }

  Widget _buildAppTitle(bool isDark) {
    return Column(
      children: [
        Text(
          'LetBuyy Admin',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.bold,
            foreground: Paint()
              ..shader = LinearGradient(
                colors: [
                  AppColors.primary,
                  AppColors.primaryDark,
                ],
              ).createShader(const Rect.fromLTWH(0, 0, 200, 40)),
          ),
        ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.3),
        const SizedBox(height: 8),
        Text(
          'Powerful admin tools at your fingertips',
          style: TextStyle(
            fontSize: 16,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ).animate().fadeIn(delay: 300.ms),
      ],
    );
  }

  Widget _buildVersionBadge(AppUpdateModel update, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.verified,
            size: 16,
            color: AppColors.primary,
          ),
          const SizedBox(width: 8),
          Text(
            'v${update.formattedVersionName}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 400.ms).scale();
  }

  Widget _buildDownloadCard(AppUpdateModel? update, bool isDark, bool isMobile) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
            ),
          ),
          child: Column(
            children: [
              // Download Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: update != null && !_isDownloading
                      ? () => _downloadApk(update.apkUrl)
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: _isDownloading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.android, size: 24),
                            const SizedBox(width: 12),
                            const Text(
                              'Download APK',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                ),
              ),

              if (update != null) ...[
                const SizedBox(height: 16),

                // File Info
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildInfoChip(
                      Icons.storage,
                      update.formattedFileSize.isNotEmpty
                          ? update.formattedFileSize
                          : 'Unknown size',
                      isDark,
                    ),
                    const SizedBox(width: 16),
                    _buildInfoChip(
                      Icons.update,
                      'Build ${update.versionCode}',
                      isDark,
                    ),
                  ],
                ),

                if (update.updateMessage.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    update.updateMessage,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ] else ...[
                const SizedBox(height: 16),
                Text(
                  'No download available at this time',
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.2);
  }

  Widget _buildInfoChip(IconData icon, String label, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeaturesList(bool isDark) {
    final features = [
      {'icon': Icons.dashboard, 'title': 'Dashboard Analytics'},
      {'icon': Icons.inventory_2, 'title': 'Product Management'},
      {'icon': Icons.people, 'title': 'User Management'},
      {'icon': Icons.store, 'title': 'Seller KYC Approval'},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Key Features',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 16),
        ...features.asMap().entries.map((entry) {
          final feature = entry.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    feature['icon'] as IconData,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    feature['title'] as String,
                    style: TextStyle(
                      fontSize: 15,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                ),
                Icon(
                  Icons.check_circle,
                  size: 20,
                  color: Colors.green[400],
                ),
              ],
            ).animate().fadeIn(delay: (600 + entry.key * 100).ms).slideX(begin: 0.1),
          );
        }),
      ],
    );
  }

  Widget _buildReleaseNotes(AppUpdateModel update, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.article,
                size: 20,
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              Text(
                'What\'s New',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            update.releaseNotes,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              height: 1.5,
            ),
          ),
        ],
      ),
    ).animate().fadeIn(delay: 800.ms);
  }

  Widget _buildFooter(bool isDark) {
    return Column(
      children: [
        Text(
          '© 2024 LetBuyy. All rights reserved.',
          style: TextStyle(
            fontSize: 12,
            color: isDark ? Colors.grey[600] : Colors.grey[500],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.security,
              size: 14,
              color: Colors.green[400],
            ),
            const SizedBox(width: 4),
            Text(
              'Verified & Secure',
              style: TextStyle(
                fontSize: 12,
                color: Colors.green[400],
              ),
            ),
          ],
        ),
      ],
    ).animate().fadeIn(delay: 900.ms);
  }
}
