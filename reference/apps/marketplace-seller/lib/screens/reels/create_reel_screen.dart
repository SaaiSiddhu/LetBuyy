import 'dart:io';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

/// Video source types for creating reels
enum ReelSourceType {
  instagram,
  youtube,
  upload,
}

/// Premium Create Reel Screen with multi-source support
class CreateReelScreen extends StatefulWidget {
  const CreateReelScreen({super.key});

  @override
  State<CreateReelScreen> createState() => _CreateReelScreenState();
}

class _CreateReelScreenState extends State<CreateReelScreen> 
    with SingleTickerProviderStateMixin {
  // Services
  final ReelService _reelService = ReelService();
  final ImagePicker _picker = ImagePicker();
  
  // Controllers
  final TextEditingController _linkController = TextEditingController();
  final TextEditingController _captionController = TextEditingController();
  final TextEditingController _hashtagController = TextEditingController();
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  
  // State
  int _currentStep = 0; // 0: Source, 1: Details, 2: Review
  ReelSourceType? _selectedSource;
  File? _videoFile;
  ProductModel? _selectedProduct;
  final List<String> _hashtags = [];
  bool _isUploading = false;
  bool _isFetchingLink = false;
  String? _fetchedVideoUrl;
  String? _fetchedThumbnail;
  String? _linkError;
  
  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic);
    _animController.forward();
  }
  
  @override
  void dispose() {
    _linkController.dispose();
    _captionController.dispose();
    _hashtagController.dispose();
    _animController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: Stack(
        children: [
          // Background gradient
          _buildBackground(isDark),
          
          // Main content
          SafeArea(
            child: Column(
              children: [
                _buildAppBar(isDark),
                _buildStepIndicator(isDark),
                Expanded(
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: _buildCurrentStep(isDark),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildBackground(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [AppColors.backgroundDark, const Color(0xFF0A1628)]
              : [AppColors.background, const Color(0xFFE8F5F4)],
        ),
      ),
      child: Stack(
        children: [
          // Decorative circles
          Positioned(
            top: -100,
            right: -80,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withValues(alpha: 0.15),
                    AppColors.primary.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            left: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.secondary.withValues(alpha: 0.1),
                    AppColors.secondary.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildAppBar(bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _buildGlassButton(
            icon: Icons.arrow_back_ios_new_rounded,
            onTap: _handleBack,
            isDark: isDark,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              'Create Reel',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : AppColors.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
          ),
          if (_currentStep == 2)
            _buildPublishButton(isDark),
        ],
      ),
    );
  }
  
  Widget _buildGlassButton({
    required IconData icon,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.1)
                  : Colors.black.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.1)
                    : Colors.black.withValues(alpha: 0.05),
              ),
            ),
            child: Icon(
              icon,
              size: 20,
              color: isDark ? Colors.white : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
  
  Widget _buildStepIndicator(bool isDark) {
    final steps = ['Source', 'Details', 'Review'];
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: List.generate(steps.length * 2 - 1, (index) {
          if (index.isOdd) {
            // Connector line
            final stepIndex = index ~/ 2;
            final isCompleted = stepIndex < _currentStep;
            return Expanded(
              child: Container(
                height: 3,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: isCompleted
                      ? AppColors.primary
                      : (isDark ? Colors.white12 : Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }
          
          // Step circle
          final stepIndex = index ~/ 2;
          final isActive = stepIndex == _currentStep;
          final isCompleted = stepIndex < _currentStep;
          
          return GestureDetector(
            onTap: stepIndex < _currentStep ? () => _goToStep(stepIndex) : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isActive
                    ? AppColors.primary
                    : isCompleted
                        ? AppColors.primary.withValues(alpha: 0.2)
                        : (isDark ? Colors.white10 : Colors.grey.shade200),
                borderRadius: BorderRadius.circular(20),
                border: isCompleted
                    ? Border.all(color: AppColors.primary, width: 2)
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (isCompleted)
                    const Icon(Icons.check_rounded, size: 16, color: AppColors.primary)
                  else
                    Text(
                      '${stepIndex + 1}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isActive
                            ? Colors.white
                            : (isDark ? Colors.white54 : AppColors.textSecondary),
                      ),
                    ),
                  const SizedBox(width: 6),
                  Text(
                    steps[stepIndex],
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                      color: isActive
                          ? Colors.white
                          : isCompleted
                              ? AppColors.primary
                              : (isDark ? Colors.white38 : AppColors.textTertiary),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
  
  Widget _buildCurrentStep(bool isDark) {
    switch (_currentStep) {
      case 0:
        return _buildSourceStep(isDark);
      case 1:
        return _buildDetailsStep(isDark);
      case 2:
        return _buildReviewStep(isDark);
      default:
        return _buildSourceStep(isDark);
    }
  }
  
  // ============================================
  // STEP 1: SOURCE SELECTION
  // ============================================
  
  Widget _buildSourceStep(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Upload Your Video',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : AppColors.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Select a video from your device to create a reel',
            style: TextStyle(
              fontSize: 15,
              color: isDark ? Colors.white54 : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 32),
          
          // Upload card only
          _buildSourceCard(
            icon: Icons.cloud_upload_rounded,
            iconGradient: LinearGradient(
              colors: [AppColors.primary, AppColors.primaryLight],
            ),
            title: 'Upload Video',
            subtitle: 'From your device',
            description: '9:16 ratio • 5-60 seconds • Max 50MB',
            sourceType: ReelSourceType.upload,
            isDark: isDark,
          ),
          
          const SizedBox(height: 24),
          
          // Hint text
          if (_selectedSource == ReelSourceType.upload && _videoFile != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: AppColors.success),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Video Selected!',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isDark ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          'Tap Continue to add details',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.white54 : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => _goToStep(1),
                    child: const Text('Continue'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
  
  Widget _buildSourceCard({
    required IconData icon,
    required Gradient iconGradient,
    required String title,
    required String subtitle,
    required String description,
    required ReelSourceType sourceType,
    required bool isDark,
  }) {
    final isSelected = _selectedSource == sourceType;
    
    return GestureDetector(
      onTap: () => _selectSource(sourceType),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isDark
              ? (isSelected ? AppColors.primary.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.05))
              : (isSelected ? AppColors.primary.withValues(alpha: 0.08) : Colors.white),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : (isDark ? Colors.white12 : Colors.grey.shade200),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.2),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
        ),
        child: Row(
          children: [
            // Icon with gradient
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: iconGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: (iconGradient as LinearGradient).colors.first.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(icon, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 16),
            
            // Text content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.1)
                              : AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          subtitle,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white54 : AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.white38 : AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
            
            // Selection indicator
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? AppColors.primary : Colors.transparent,
                border: Border.all(
                  color: isSelected
                      ? AppColors.primary
                      : (isDark ? Colors.white24 : Colors.grey.shade400),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildLinkInput(bool isDark) {
    final isInstagram = _selectedSource == ReelSourceType.instagram;
    
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.white.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? Colors.white12 : Colors.grey.shade200,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    isInstagram ? Icons.link_rounded : Icons.link_rounded,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Paste ${isInstagram ? 'Instagram' : 'YouTube'} Link',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              
              TextField(
                controller: _linkController,
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: isInstagram
                      ? 'https://www.instagram.com/reel/...'
                      : 'https://youtube.com/shorts/...',
                  hintStyle: TextStyle(
                    color: isDark ? Colors.white30 : AppColors.textHint,
                  ),
                  errorText: _linkError,
                  filled: true,
                  fillColor: isDark
                      ? Colors.white.withValues(alpha: 0.05)
                      : Colors.grey.shade100,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                  suffixIcon: _linkController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded),
                          onPressed: () {
                            _linkController.clear();
                            setState(() {
                              _linkError = null;
                              _fetchedVideoUrl = null;
                            });
                          },
                        )
                      : null,
                ),
                onChanged: (_) => setState(() => _linkError = null),
              ),
              
              const SizedBox(height: 16),
              
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isFetchingLink ? null : _fetchVideoFromLink,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  child: _isFetchingLink
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.download_rounded, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Fetch Video',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
              
              // Success preview
              if (_fetchedVideoUrl != null) ...[
                const SizedBox(height: 20),
                _buildFetchedPreview(isDark),
              ],
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildFetchedPreview(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.success,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.check_rounded, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Video Ready!',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                Text(
                  'Tap Continue to add details',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.white54 : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _goToStep(1),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }
  
  // ============================================
  // STEP 2: DETAILS
  // ============================================
  
  Widget _buildDetailsStep(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Add Details',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : AppColors.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Link a product and add a catchy caption',
            style: TextStyle(
              fontSize: 15,
              color: isDark ? Colors.white54 : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 32),
          
          // Product selector
          _buildProductSelector(isDark),
          const SizedBox(height: 24),
          
          // Caption
          _buildSectionTitle('Caption', isDark),
          const SizedBox(height: 12),
          _buildCaptionInput(isDark),
          const SizedBox(height: 24),
          
          // Hashtags
          _buildSectionTitle('Hashtags', isDark),
          const SizedBox(height: 12),
          _buildHashtagInput(isDark),
          
          const SizedBox(height: 32),
          
          // Continue button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedProduct != null ? () => _goToStep(2) : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
                disabledBackgroundColor: isDark 
                    ? Colors.white12 
                    : Colors.grey.shade300,
              ),
              child: const Text(
                'Continue to Review',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildSectionTitle(String title, bool isDark) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: isDark ? Colors.white70 : AppColors.textPrimary,
      ),
    );
  }
  
  Widget _buildProductSelector(bool isDark) {
    return GestureDetector(
      onTap: _selectProduct,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: _selectedProduct != null
                ? AppColors.primary
                : (isDark ? Colors.white12 : Colors.grey.shade200),
            width: _selectedProduct != null ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: _selectedProduct != null
            ? Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      _selectedProduct!.images.isNotEmpty 
                          ? _selectedProduct!.images.first 
                          : '',
                      width: 60,
                      height: 60,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        width: 60,
                        height: 60,
                        color: Colors.grey.shade300,
                        child: const Icon(Icons.image_not_supported),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _selectedProduct!.name,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            color: isDark ? Colors.white : AppColors.textPrimary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${_selectedProduct!.salePrice.toStringAsFixed(0) ?? _selectedProduct!.price.toStringAsFixed(0)}',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.swap_horiz_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                ],
              )
            : Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.05)
                          : AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.inventory_2_rounded,
                      color: isDark ? Colors.white38 : AppColors.primary,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Select Product',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            color: isDark ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Link your reel to a product',
                          style: TextStyle(
                            fontSize: 13,
                            color: isDark ? Colors.white38 : AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: isDark ? Colors.white38 : AppColors.textTertiary,
                  ),
                ],
              ),
      ),
    );
  }
  
  Widget _buildCaptionInput(bool isDark) {
    return TextField(
      controller: _captionController,
      maxLines: 3,
      maxLength: 150,
      style: TextStyle(
        color: isDark ? Colors.white : AppColors.textPrimary,
      ),
      decoration: InputDecoration(
        hintText: 'Write a catchy caption to grab attention...',
        hintStyle: TextStyle(
          color: isDark ? Colors.white30 : AppColors.textHint,
        ),
        filled: true,
        fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: isDark ? Colors.white12 : Colors.grey.shade200,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: isDark ? Colors.white12 : Colors.grey.shade200,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
      ),
    );
  }
  
  Widget _buildHashtagInput(bool isDark) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _hashtagController,
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
                decoration: InputDecoration(
                  hintText: 'Add hashtag',
                  prefixText: '#',
                  prefixStyle: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                  hintStyle: TextStyle(
                    color: isDark ? Colors.white30 : AppColors.textHint,
                  ),
                  filled: true,
                  fillColor: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: isDark ? Colors.white12 : Colors.grey.shade200,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: isDark ? Colors.white12 : Colors.grey.shade200,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
                onSubmitted: _addHashtag,
              ),
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: () => _addHashtag(_hashtagController.text),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.add_rounded, color: Colors.white),
              ),
            ),
          ],
        ),
        if (_hashtags.isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _hashtags.map((tag) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '#$tag',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: () => setState(() => _hashtags.remove(tag)),
                    child: Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            )).toList(),
          ),
        ],
      ],
    );
  }
  
  // ============================================
  // STEP 3: REVIEW
  // ============================================
  
  Widget _buildReviewStep(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review & Publish',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : AppColors.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Make sure everything looks good before publishing',
            style: TextStyle(
              fontSize: 15,
              color: isDark ? Colors.white54 : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 32),
          
          // Preview card
          _buildPreviewCard(isDark),
          const SizedBox(height: 24),
          
          // Summary
          _buildReviewSummary(isDark),
        ],
      ),
    );
  }
  
  Widget _buildPreviewCard(bool isDark) {
    String sourceLabel = '';
    IconData sourceIcon = Icons.videocam;
    
    switch (_selectedSource) {
      case ReelSourceType.instagram:
        sourceLabel = 'Instagram Reel';
        sourceIcon = Icons.photo_library_rounded;
        break;
      case ReelSourceType.youtube:
        sourceLabel = 'YouTube Shorts';
        sourceIcon = Icons.play_circle_filled_rounded;
        break;
      case ReelSourceType.upload:
        sourceLabel = 'Uploaded Video';
        sourceIcon = Icons.cloud_upload_rounded;
        break;
      default:
        break;
    }
    
    return Container(
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Video preview area
          Container(
            height: 200,
            width: double.infinity,
            decoration: BoxDecoration(
              color: isDark ? Colors.black : Colors.grey.shade200,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (_selectedProduct?.images.isNotEmpty ?? false)
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    child: Image.network(
                      _selectedProduct!.images.first,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                    ),
                  ),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                  ),
                ),
                Icon(
                  Icons.play_circle_filled_rounded,
                  size: 64,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(sourceIcon, size: 14, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(
                          sourceLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Product info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        _selectedProduct?.images.firstOrNull ?? '',
                        width: 50,
                        height: 50,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 50,
                          height: 50,
                          color: Colors.grey.shade300,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _selectedProduct?.name ?? 'No product selected',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white : AppColors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            '₹${_selectedProduct?.salePrice.toStringAsFixed(0) ?? _selectedProduct?.price.toStringAsFixed(0) ?? '0'}',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (_captionController.text.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    _captionController.text,
                    style: TextStyle(
                      color: isDark ? Colors.white70 : AppColors.textSecondary,
                    ),
                  ),
                ],
                if (_hashtags.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    children: _hashtags.map((tag) => Text(
                      '#$tag',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    )).toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildReviewSummary(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white12 : Colors.grey.shade200,
        ),
      ),
      child: Column(
        children: [
          _buildSummaryRow('Source', _getSourceLabel(), isDark),
          const Divider(height: 24),
          _buildSummaryRow('Product', _selectedProduct?.name ?? 'None', isDark),
          const Divider(height: 24),
          _buildSummaryRow('Caption', _captionController.text.isEmpty ? 'None' : '${_captionController.text.length} chars', isDark),
          const Divider(height: 24),
          _buildSummaryRow('Hashtags', _hashtags.isEmpty ? 'None' : '${_hashtags.length} tags', isDark),
        ],
      ),
    );
  }
  
  Widget _buildSummaryRow(String label, String value, bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isDark ? Colors.white54 : AppColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : AppColors.textPrimary,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
  
  Widget _buildPublishButton(bool isDark) {
    return ElevatedButton(
      onPressed: _isUploading ? null : _publishReel,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        elevation: 0,
      ),
      child: _isUploading
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2,
              ),
            )
          : const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.rocket_launch_rounded, size: 18),
                SizedBox(width: 8),
                Text(
                  'Publish',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
    );
  }
  
  // ============================================
  // ACTIONS
  // ============================================
  
  void _handleBack() {
    if (_currentStep > 0) {
      _goToStep(_currentStep - 1);
    } else {
      Navigator.pop(context);
    }
  }
  
  void _goToStep(int step) {
    _animController.reset();
    setState(() => _currentStep = step);
    _animController.forward();
  }
  
  void _selectSource(ReelSourceType source) {
    setState(() {
      _selectedSource = source;
      _linkController.clear();
      _fetchedVideoUrl = null;
      _linkError = null;
    });
    
    if (source == ReelSourceType.upload) {
      _selectVideo();
    }
  }
  
  Future<void> _selectVideo() async {
    try {
      final video = await _picker.pickVideo(
        source: ImageSource.gallery,
        maxDuration: const Duration(seconds: 60),
      );
      
      if (video != null) {
        setState(() => _videoFile = File(video.path));
        _goToStep(1); // Go to details
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error selecting video: $e')),
      );
    }
  }
  
  Future<void> _fetchVideoFromLink() async {
    final link = _linkController.text.trim();
    
    if (link.isEmpty) {
      setState(() => _linkError = 'Please enter a link');
      return;
    }
    
    // Validate URL format
    bool isValid = false;
    if (_selectedSource == ReelSourceType.instagram) {
      isValid = link.contains('instagram.com/reel') || 
                link.contains('instagram.com/p/') ||
                link.contains('instagr.am');
    } else if (_selectedSource == ReelSourceType.youtube) {
      isValid = link.contains('youtube.com/shorts') || 
                link.contains('youtu.be');
    }
    
    if (!isValid) {
      setState(() => _linkError = 'Invalid ${_selectedSource == ReelSourceType.instagram ? 'Instagram' : 'YouTube'} link');
      return;
    }
    
    setState(() {
      _isFetchingLink = true;
      _linkError = null;
    });
    
    // Simulate fetching (in real app, we just store the link)
    await Future.delayed(const Duration(seconds: 1));
    
    if (mounted) {
      setState(() {
        _isFetchingLink = false;
        _fetchedVideoUrl = link; // Store the original link
      });
    }
  }
  
  Future<void> _selectProduct() async {
    final sellerId = FirebaseAuth.instance.currentUser?.uid ?? '';
    
    final products = await FirebaseFirestore.instance
        .collection('products')
        .where('sellerId', isEqualTo: sellerId)
        .get();
    
    if (!mounted) return;
    
    final productList = products.docs
        .map((doc) => ProductModel.fromFirestore(doc))
        .toList();
    
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: BoxDecoration(
          color: isDark ? AppColors.surfaceDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  Text(
                    'Select Product',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${productList.length} products',
                    style: TextStyle(
                      color: isDark ? Colors.white54 : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: productList.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.inventory_2_outlined,
                            size: 64,
                            color: isDark ? Colors.white24 : Colors.grey.shade300,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No products found',
                            style: TextStyle(
                              color: isDark ? Colors.white54 : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: productList.length,
                      itemBuilder: (context, index) {
                        final product = productList[index];
                        final isSelected = _selectedProduct?.id == product.id;
                        
                        return GestureDetector(
                          onTap: () {
                            setState(() => _selectedProduct = product);
                            Navigator.pop(context);
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primary.withValues(alpha: 0.1)
                                  : (isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade50),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : (isDark ? Colors.white12 : Colors.grey.shade200),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: Image.network(
                                    product.images.isNotEmpty ? product.images.first : '',
                                    width: 60,
                                    height: 60,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      width: 60,
                                      height: 60,
                                      color: Colors.grey.shade300,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        product.name,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: isDark ? Colors.white : AppColors.textPrimary,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '₹${product.salePrice.toStringAsFixed(0) ?? product.price.toStringAsFixed(0)}',
                                        style: TextStyle(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                      color: AppColors.primary,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check_rounded,
                                      size: 16,
                                      color: Colors.white,
                                    ),
                                  ),
                              ],
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
  
  void _addHashtag(String tag) {
    final cleanTag = tag.replaceAll('#', '').trim().toLowerCase();
    if (cleanTag.isNotEmpty && !_hashtags.contains(cleanTag) && _hashtags.length < 10) {
      setState(() {
        _hashtags.add(cleanTag);
        _hashtagController.clear();
      });
    }
  }
  
  String _getSourceLabel() {
    switch (_selectedSource) {
      case ReelSourceType.instagram:
        return 'Instagram Reel';
      case ReelSourceType.youtube:
        return 'YouTube Shorts';
      case ReelSourceType.upload:
        return 'Manual Upload';
      default:
        return 'Not selected';
    }
  }
  
  Future<void> _publishReel() async {
    if (_selectedProduct == null) return;
    
    setState(() => _isUploading = true);
    
    try {
      final sellerId = FirebaseAuth.instance.currentUser?.uid ?? '';
      
      if (_selectedSource == ReelSourceType.upload && _videoFile != null) {
        // Original upload flow
        await _reelService.createReel(
          sellerId: sellerId,
          productId: _selectedProduct!.id,
          videoFile: _videoFile!,
          caption: _captionController.text,
          hashtags: _hashtags,
          product: _selectedProduct!,
        );
      } else if (_fetchedVideoUrl != null) {
        // External link flow - create reel with embedded URL
        await _reelService.createReelFromLink(
          sellerId: sellerId,
          productId: _selectedProduct!.id,
          sourceType: _selectedSource == ReelSourceType.instagram ? 'instagram' : 'youtube',
          externalUrl: _fetchedVideoUrl!,
          caption: _captionController.text,
          hashtags: _hashtags,
          product: _selectedProduct!,
        );
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 12),
                Text('Reel published successfully!'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error publishing reel: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }
}
