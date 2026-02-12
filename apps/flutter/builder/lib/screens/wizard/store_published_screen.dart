import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:share_plus/share_plus.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/store_service.dart';
import '../../theme/store_admin_colors.dart';
import '../../app/routes.dart';

/// Store Published Screen with Enhanced 6-Stage Animated Progression
/// Each stage takes 2 seconds minimum with premium visual design
class StorePublishedScreen extends StatefulWidget {
  final String storeId;
  final String storeName;
  final String subdomain;

  const StorePublishedScreen({
    super.key,
    required this.storeId,
    required this.storeName,
    required this.subdomain,
  });

  @override
  State<StorePublishedScreen> createState() => _StorePublishedScreenState();
}

class _StorePublishedScreenState extends State<StorePublishedScreen>
    with TickerProviderStateMixin {
  // 6 Provisioning stages with icons
  static const List<Map<String, dynamic>> _stages = [
    {'id': 'store_created', 'label': 'Creating your store', 'icon': Icons.store_rounded},
    {'id': 'dns_record', 'label': 'Setting up DNS', 'icon': Icons.dns_rounded},
    {'id': 'domain_mapping', 'label': 'Mapping domain', 'icon': Icons.language_rounded},
    {'id': 'ssl_certificate', 'label': 'Securing with SSL', 'icon': Icons.lock_rounded},
    {'id': 'verification', 'label': 'Verifying setup', 'icon': Icons.verified_rounded},
    {'id': 'going_live', 'label': 'Going live!', 'icon': Icons.rocket_launch_rounded},
  ];

  int _currentStageIndex = 0;
  bool _isComplete = false;
  bool _hasError = false;
  String? _errorMessage;
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
      duration: const Duration(milliseconds: 2000),
    );
    
    // Start the animated progression
    _startProgressAnimation();
    
    // Poll the API for real status updates
    _pollStoreStatus();
  }

  void _startProgressAnimation() async {
    // Animate through 6 stages, each taking 2 seconds minimum
    for (int i = 0; i < _stages.length; i++) {
      if (!mounted || _hasError) break;
      
      setState(() => _currentStageIndex = i);
      _progressController.forward(from: 0);
      
      // Wait 2 seconds for each stage
      await Future.delayed(const Duration(milliseconds: 2000));
    }
    
    // After all stages, mark as complete
    if (mounted && !_hasError) {
      setState(() => _isComplete = true);
    }
  }

  void _pollStoreStatus() async {
    if (widget.storeId.isEmpty) return;
    
    final storeService = context.read<StoreService>();
    
    // Poll every 3 seconds until complete or error
    while (mounted && !_isComplete && !_hasError) {
      await Future.delayed(const Duration(seconds: 3));
      if (!mounted) break;
      
      try {
        final store = await storeService.fetchStore(widget.storeId);
        final storeData = store.toJson();
        
        final status = storeData['provisioning_status'] as Map<String, dynamic>?;
        final stage = status?['stage'] ?? storeData['domain_status'];
        final error = status?['error'] ?? storeData['domain_error'];
        
        // If there's an error, show it
        if (stage == 'error' && error != null) {
          if (mounted) {
            setState(() {
              _hasError = true;
              _errorMessage = error.toString();
            });
          }
          break;
        }
      } catch (e) {
        debugPrint('Error polling store status: $e');
      }
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return _buildErrorScreen(_errorMessage ?? 'Unknown error');
    }
    
    if (_isComplete) {
      return _buildSuccessScreen();
    }
    
    return _buildProgressScreen();
  }

  Widget _buildProgressScreen() {
    final progress = ((_currentStageIndex + 1) / _stages.length * 100).round();
    
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFF0F1525),
              const Color(0xFF1A2035),
              const Color(0xFF0F1525),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Compact progress ring
                  _buildProgressRing(progress),
                  
                  const SizedBox(height: 24),
                  
                  // Title - bright white
                  const Text(
                    'Setting up your store',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                  
                  const SizedBox(height: 8),
                  
                  // Current stage message - brighter color
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: Text(
                      _stages[_currentStageIndex]['label'],
                      key: ValueKey(_currentStageIndex),
                      style: const TextStyle(
                        fontSize: 15,
                        color: StoreAdminColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 28),
                  
                  // Stage list - compact
                  _buildStageList(),
                  
                  const SizedBox(height: 24),
                  
                  // Bottom info - more visible
                  Text(
                    'This usually takes about 12 seconds',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressRing(int progress) {
    return Stack(
      alignment: Alignment.center,
      children: [
        // Outer glow
        Container(
          width: 150,
          height: 150,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: StoreAdminColors.primary.withValues(alpha: 0.25),
                blurRadius: 40,
                spreadRadius: 10,
              ),
            ],
          ),
        ),
        
        // Progress track (background)
        SizedBox(
          width: 130,
          height: 130,
          child: CircularProgressIndicator(
            value: 1,
            strokeWidth: 6,
            backgroundColor: Colors.transparent,
            valueColor: AlwaysStoppedAnimation(Colors.white.withValues(alpha: 0.08)),
          ),
        ),
        
        // Progress indicator
        SizedBox(
          width: 130,
          height: 130,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress / 100),
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeOutCubic,
            builder: (context, value, _) => CircularProgressIndicator(
              value: value,
              strokeWidth: 6,
              strokeCap: StrokeCap.round,
              backgroundColor: Colors.transparent,
              valueColor: const AlwaysStoppedAnimation(StoreAdminColors.primary),
            ),
          ),
        ),
        
        // Center content
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$progress%',
              style: const TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                letterSpacing: -1,
              ),
            ),
          ],
        ),
      ],
    ).animate(controller: _pulseController).scale(
          begin: const Offset(0.98, 0.98),
          end: const Offset(1.02, 1.02),
        );
  }

  Widget _buildStageList() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        children: List.generate(_stages.length, (index) {
          final stage = _stages[index];
          final isCompleted = index < _currentStageIndex;
          final isActive = index == _currentStageIndex;
          final isPending = index > _currentStageIndex;
          
          return _buildStageRow(
            icon: stage['icon'],
            label: stage['label'],
            isCompleted: isCompleted,
            isActive: isActive,
            isPending: isPending,
            isLast: index == _stages.length - 1,
          );
        }),
      ),
    );
  }

  Widget _buildStageRow({
    required IconData icon,
    required String label,
    required bool isCompleted,
    required bool isActive,
    required bool isPending,
    required bool isLast,
  }) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              // Icon container
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: isCompleted || isActive
                      ? LinearGradient(
                          colors: [StoreAdminColors.primary, StoreAdminColors.accent],
                        )
                      : null,
                  color: isPending ? Colors.white.withValues(alpha: 0.08) : null,
                  shape: BoxShape.circle,
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: StoreAdminColors.primary.withValues(alpha: 0.4),
                            blurRadius: 12,
                            spreadRadius: 2,
                          ),
                        ]
                      : null,
                ),
                child: isCompleted
                    ? const Icon(Icons.check_rounded, color: Colors.white, size: 18)
                    : isActive
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: const AlwaysStoppedAnimation(Colors.white),
                            ),
                          )
                        : Icon(
                            icon,
                            size: 16,
                            color: Colors.white.withValues(alpha: 0.3),
                          ),
              ),
              
              const SizedBox(width: 14),
              
              // Label
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                    color: isCompleted || isActive
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.4),
                  ),
                ),
              ),
              
              // Status indicator
              if (isCompleted)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: StoreAdminColors.success.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Done',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: StoreAdminColors.success,
                    ),
                  ),
                )
              else if (isActive)
                Text(
                  '...',
                  style: TextStyle(color: StoreAdminColors.primary),
                ).animate(onPlay: (c) => c.repeat()).fadeIn().fadeOut(duration: 500.ms),
            ],
          ),
        ),
        if (!isLast)
          Container(
            margin: const EdgeInsets.only(left: 17),
            width: 2,
            height: 12,
            decoration: BoxDecoration(
              color: isCompleted
                  ? StoreAdminColors.primary.withValues(alpha: 0.5)
                  : Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(1),
            ),
          ),
      ],
    );
  }

  Widget _buildSuccessScreen() {
    final storeUrl = 'https://${widget.subdomain}.letbuyy.store';
    
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFF0A0E1A),
              const Color(0xFF0F1929),
              StoreAdminColors.success.withValues(alpha: 0.1),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Success icon with glow
                  Container(
                    width: 110,
                    height: 110,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          StoreAdminColors.success,
                          StoreAdminColors.success.withValues(alpha: 0.8),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: StoreAdminColors.success.withValues(alpha: 0.4),
                          blurRadius: 40,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 56,
                      color: Colors.white,
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 400.ms)
                      .scale(begin: const Offset(0.5, 0.5), curve: Curves.elasticOut),
                  
                  const SizedBox(height: 36),
                  
                  // Celebration emoji
                  const Text('🎉', style: TextStyle(fontSize: 44))
                      .animate(delay: 200.ms)
                      .fadeIn()
                      .scale(),
                  
                  const SizedBox(height: 20),
                  
                  // Title
                  const Text(
                    'Your store is live!',
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: -0.5,
                    ),
                  ).animate(delay: 300.ms).fadeIn().slideY(begin: 0.2),
                  
                  const SizedBox(height: 10),
                  
                  Text(
                    '"${widget.storeName}" is now online',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ).animate(delay: 400.ms).fadeIn(),
                  
                  const SizedBox(height: 36),
                  
                  // URL Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: StoreAdminColors.success.withValues(alpha: 0.3),
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: StoreAdminColors.success.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Icon(Icons.verified_rounded, color: StoreAdminColors.success, size: 16),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Your store URL',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          '${widget.subdomain}.letbuyy.store',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                  ).animate(delay: 500.ms).fadeIn().slideY(begin: 0.2),
                  
                  const SizedBox(height: 28),
                  
                  // Action buttons
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _ActionButton(
                        icon: Icons.copy_rounded,
                        label: 'Copy',
                        onTap: () => _copyUrl(storeUrl),
                      ),
                      const SizedBox(width: 14),
                      _ActionButton(
                        icon: Icons.share_rounded,
                        label: 'Share',
                        onTap: () => _shareUrl(storeUrl),
                      ),
                      const SizedBox(width: 14),
                      _ActionButton(
                        icon: Icons.open_in_browser_rounded,
                        label: 'View',
                        onTap: () => _openUrl(storeUrl),
                      ),
                    ],
                  ).animate(delay: 600.ms).fadeIn(),
                  
                  const SizedBox(height: 48),
                  
                  // Go to Dashboard button
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pushReplacementNamed(context, AppRoutes.main);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF0A0E1A),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Go to Dashboard →',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ).animate(delay: 700.ms).fadeIn().slideY(begin: 0.2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorScreen(String error) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              const Color(0xFF0A0E1A),
              const Color(0xFF1A1520),
              StoreAdminColors.error.withValues(alpha: 0.1),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                      color: StoreAdminColors.error.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.error_outline_rounded,
                      size: 44,
                      color: StoreAdminColors.error,
                    ),
                  ),
                  
                  const SizedBox(height: 28),
                  
                  const Text(
                    'Something went wrong',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  
                  const SizedBox(height: 14),
                  
                  Text(
                    error,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white.withValues(alpha: 0.6),
                    ),
                  ),
                  
                  const SizedBox(height: 32),
                  
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pushReplacementNamed(context, AppRoutes.main);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: StoreAdminColors.error,
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Go to Dashboard'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _copyUrl(String url) {
    Clipboard.setData(ClipboardData(text: url));
    HapticFeedback.mediumImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Store URL copied!'),
        backgroundColor: StoreAdminColors.success,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _shareUrl(String url) {
    Share.share(
      'Check out my new store: ${widget.storeName}\n$url',
      subject: 'My Store - ${widget.storeName}',
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.white, size: 22),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
