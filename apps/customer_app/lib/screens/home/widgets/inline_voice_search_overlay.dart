// Amazon-Style Inline Voice Search Overlay
// Features: Blurred background, inline search bar transformation, animated dots
import 'dart:async';
import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

/// Amazon-style inline voice search overlay
/// Shows a blurred background with an inline search bar that displays
/// "Listening..." with animated dots while processing voice input
class InlineVoiceSearchOverlay extends StatefulWidget {
  final VoidCallback onClose;

  const InlineVoiceSearchOverlay({
    super.key,
    required this.onClose,
  });

  /// Show the overlay as a full-screen route
  /// Checks microphone permission first before showing
  static Future<void> show(BuildContext context) async {
    // Check current permission status
    var status = await Permission.microphone.status;
    
    // If not determined yet, request permission
    if (status.isDenied || status.isRestricted) {
      status = await Permission.microphone.request();
    }
    
    // Handle different permission states
    if (status.isPermanentlyDenied) {
      // Show dialog to open settings
      if (context.mounted) {
        _showPermissionDeniedDialog(context);
      }
      return;
    }
    
    if (!status.isGranted) {
      // Permission denied
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Microphone permission is required for voice search'),
            backgroundColor: Colors.red.shade600,
            behavior: SnackBarBehavior.floating,
            action: SnackBarAction(
              label: 'Settings',
              textColor: Colors.white,
              onPressed: () => openAppSettings(),
            ),
          ),
        );
      }
      return;
    }
    
    // Permission granted - show the overlay
    if (context.mounted) {
      await Navigator.of(context).push(
        PageRouteBuilder(
          opaque: false,
          barrierDismissible: true,
          barrierColor: Colors.transparent,
          pageBuilder: (context, animation, secondaryAnimation) {
            return InlineVoiceSearchOverlay(
              onClose: () => Navigator.of(context).pop(),
            );
          },
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return FadeTransition(
              opacity: animation,
              child: child,
            );
          },
          transitionDuration: const Duration(milliseconds: 200),
        ),
      );
    }
  }
  
  /// Show dialog when permission is permanently denied
  static void _showPermissionDeniedDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.mic_off_rounded, color: Colors.red),
            SizedBox(width: 12),
            Text('Microphone Access'),
          ],
        ),
        content: const Text(
          'Voice search requires microphone access. Please enable it in your device settings to use this feature.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              openAppSettings();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  @override
  State<InlineVoiceSearchOverlay> createState() => _InlineVoiceSearchOverlayState();
}

class _InlineVoiceSearchOverlayState extends State<InlineVoiceSearchOverlay>
    with TickerProviderStateMixin {
  // Speech recognition
  final SpeechToText _speech = SpeechToText();
  bool _isListening = false;
  bool _isInitialized = false;
  String _recognizedText = '';
  String _statusText = 'Listening...';
  double _soundLevel = 0.0;

  // Animation controllers
  late AnimationController _dotController;
  late AnimationController _pulseController;
  late AnimationController _waveController;
  late AnimationController _fadeController;

  // Timer for silence detection
  Timer? _silenceTimer;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _initSpeech();
  }

  void _initAnimations() {
    // Dot animation (for the "Listening..." dots)
    _dotController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // Pulse animation for the mic/listening indicator
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    // Wave animation for the sound visualization
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    // Fade in animation
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    )..forward();
  }

  Future<void> _initSpeech() async {
    // Permission is already granted (checked in show() method)
    try {
      _isInitialized = await _speech.initialize(
        onStatus: _onSpeechStatus,
        onError: (error) => _onSpeechError(error.errorMsg),
      );

      if (_isInitialized) {
        _startListening();
      } else {
        setState(() {
          _statusText = 'Speech recognition not available';
        });
      }
    } catch (e) {
      setState(() {
        _statusText = 'Error initializing speech';
      });
    }
  }

  void _onSpeechStatus(String status) {
    if (status == 'done' || status == 'notListening') {
      if (_recognizedText.isNotEmpty) {
        _processResult();
      } else {
        // Try to restart listening if no result
        _startListening();
      }
    }
  }

  void _onSpeechError(String error) {
    setState(() {
      _statusText = 'Tap to try again';
      _isListening = false;
    });
  }

  void _startListening() async {
    if (!_isInitialized) return;

    HapticFeedback.mediumImpact();

    setState(() {
      _isListening = true;
      _recognizedText = '';
      _statusText = 'Listening...';
    });

    try {
      await _speech.listen(
        onResult: _onSpeechResult,
        onSoundLevelChange: _onSoundLevelChange,
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 3),
        localeId: 'en_US',
        cancelOnError: false,
        partialResults: true,
      );
    } catch (e) {
      setState(() {
        _statusText = 'Error starting speech recognition';
        _isListening = false;
      });
    }
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    setState(() {
      _recognizedText = result.recognizedWords;
      if (_recognizedText.isNotEmpty) {
        _statusText = _recognizedText;
      }
    });

    // Reset silence timer
    _resetSilenceTimer();

    if (result.finalResult && _recognizedText.isNotEmpty) {
      _processResult();
    }
  }

  void _onSoundLevelChange(double level) {
    setState(() {
      _soundLevel = (level + 10) / 20; // Normalize to 0-1
      _soundLevel = _soundLevel.clamp(0.0, 1.0);
    });
  }

  void _resetSilenceTimer() {
    _silenceTimer?.cancel();
    _silenceTimer = Timer(const Duration(seconds: 2), () {
      if (_recognizedText.isNotEmpty) {
        _processResult();
      }
    });
  }

  void _processResult() {
    if (_recognizedText.isEmpty) return;

    _speech.stop();
    HapticFeedback.lightImpact();

    // Navigate to search with the recognized text
    widget.onClose();
    Navigator.pushNamed(
      context,
      AppRoutes.search,
      arguments: {'query': _recognizedText},
    );
  }

  void _stopListening() {
    _speech.stop();
    setState(() {
      _isListening = false;
    });
  }

  @override
  void dispose() {
    _silenceTimer?.cancel();
    _speech.stop();
    _dotController.dispose();
    _pulseController.dispose();
    _waveController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusBarHeight = MediaQuery.of(context).padding.top;

    return FadeTransition(
      opacity: _fadeController,
      child: Material(
        color: Colors.transparent,
        child: Stack(
          children: [
            // Blurred Background
            Positioned.fill(
              child: GestureDetector(
                onTap: widget.onClose,
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.7),
                  ),
                ),
              ),
            ),

            // Content
            Column(
              children: [
                // Status Bar Spacer
                SizedBox(height: statusBarHeight + 8),

                // Inline Search Bar (Amazon-style)
                _buildInlineSearchBar(isDark),

                const Spacer(),

                // Sound Wave Visualization (centered)
                if (_isListening) _buildSoundWaveVisualization(isDark),

                const Spacer(),

                // Recognized Text Display
                if (_recognizedText.isNotEmpty) _buildRecognizedTextDisplay(isDark),

                const SizedBox(height: 100),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInlineSearchBar(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Animated "Listening..." text with dots
          Expanded(
            child: _buildAnimatedListeningText(isDark),
          ),

          const SizedBox(width: 12),

          // Animated dots
          _buildAnimatedDots(isDark),

          const SizedBox(width: 12),

          // Close button
          GestureDetector(
            onTap: () {
              HapticFeedback.lightImpact();
              widget.onClose();
            },
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.close_rounded,
                color: isDark ? Colors.white70 : Colors.grey[600],
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnimatedListeningText(bool isDark) {
    return Text(
      _recognizedText.isNotEmpty ? _recognizedText : 'Listening...',
      style: TextStyle(
        color: _recognizedText.isNotEmpty
            ? (isDark ? Colors.white : Colors.black87)
            : (isDark ? Colors.white60 : Colors.grey[600]),
        fontSize: 16,
        fontWeight: _recognizedText.isNotEmpty ? FontWeight.w500 : FontWeight.w400,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildAnimatedDots(bool isDark) {
    return AnimatedBuilder(
      animation: _dotController,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (index) {
            // Calculate delay for each dot
            final delay = index * 0.2;
            final progress = (_dotController.value + delay) % 1.0;
            
            // Create a bouncing effect
            final bounce = math.sin(progress * math.pi);
            final opacity = 0.3 + (bounce * 0.7);

            return Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: opacity),
              ),
            );
          }),
        );
      },
    );
  }

  Widget _buildSoundWaveVisualization(bool isDark) {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final scale = 1.0 + (_pulseController.value * 0.1) + (_soundLevel * 0.2);

        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Main pulse circle with sound level
              Transform.scale(
                scale: scale,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.primary.withValues(alpha: 0.3),
                        AppColors.primary.withValues(alpha: 0.1),
                        Colors.transparent,
                      ],
                      stops: const [0.3, 0.7, 1.0],
                    ),
                  ),
                  child: Center(
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary,
                            AppColors.primaryLight,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.4),
                            blurRadius: 20,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.mic_rounded,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Waveform bars
              _buildWaveformBars(isDark),
            ],
          ),
        );
      },
    );
  }

  Widget _buildWaveformBars(bool isDark) {
    return AnimatedBuilder(
      animation: _dotController,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(7, (index) {
            // Create varying heights based on animation and sound level
            final baseHeight = 8.0;
            final maxAdditionalHeight = 24.0;
            
            // Each bar has a different phase
            final phase = (index - 3).abs() * 0.15;
            final animValue = ((_dotController.value + phase) % 1.0) * math.pi * 2;
            final wave = (math.sin(animValue) + 1) / 2;
            
            // Combine with sound level
            final height = baseHeight + (maxAdditionalHeight * wave * (0.3 + _soundLevel * 0.7));

            return Container(
              width: 4,
              height: height,
              margin: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.7 + (wave * 0.3)),
                borderRadius: BorderRadius.circular(2),
              ),
            );
          }),
        );
      },
    );
  }

  Widget _buildRecognizedTextDisplay(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 32),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : AppColors.primary).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Text(
            'Did you say:',
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.grey[600],
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '"$_recognizedText"',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black87,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
