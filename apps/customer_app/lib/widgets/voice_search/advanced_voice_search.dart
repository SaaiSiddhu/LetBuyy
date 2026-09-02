// Advanced Voice Search Modal - ChatGPT-style animated UI
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_marketplace/app/routes.dart';

/// Advanced Voice Search Modal with animated visualizer
class AdvancedVoiceSearchModal extends StatefulWidget {
  const AdvancedVoiceSearchModal({super.key});

  @override
  State<AdvancedVoiceSearchModal> createState() => _AdvancedVoiceSearchModalState();
}

class _AdvancedVoiceSearchModalState extends State<AdvancedVoiceSearchModal>
    with TickerProviderStateMixin {
  // Speech to text
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;
  bool _isInitialized = false;
  bool _hasError = false;
  bool _hasNavigated = false; // Prevent duplicate navigation
  String _errorMessage = '';
  String _recognizedText = '';
  double _soundLevel = 0.0;

  // Animation controllers
  late AnimationController _pulseController;
  late AnimationController _waveController;
  late AnimationController _glowController;
  late AnimationController _particleController;

  // Animations
  late Animation<double> _pulseAnimation;
  late Animation<double> _glowAnimation;

  // Timer for auto-stop
  Timer? _silenceTimer;
  
  // State
  VoiceSearchState _state = VoiceSearchState.idle;

  @override
  void initState() {
    super.initState();
    _initAnimations();
    _checkPermissionAndInit();
  }

  void _initAnimations() {
    // Pulse animation for the orb
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Wave animation for the visualizer
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    // Glow animation
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _glowAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeInOut),
    );

    // Particle animation
    _particleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat();
  }

  Future<void> _checkPermissionAndInit() async {
    // Check microphone permission
    final status = await Permission.microphone.status;
    
    if (status.isDenied || status.isRestricted) {
      // Request permission
      final result = await Permission.microphone.request();
      
      if (result.isGranted) {
        await _initSpeech();
      } else if (result.isPermanentlyDenied) {
        if (mounted) {
          setState(() {
            _hasError = true;
            _errorMessage = 'Microphone permission denied. Please enable it in Settings.';
            _state = VoiceSearchState.error;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _hasError = true;
            _errorMessage = 'Microphone permission required for voice search';
            _state = VoiceSearchState.error;
          });
        }
      }
    } else if (status.isGranted) {
      await _initSpeech();
    } else if (status.isPermanentlyDenied) {
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = 'Microphone permission denied. Please enable it in Settings.';
          _state = VoiceSearchState.error;
        });
      }
    }
  }

  Future<void> _initSpeech() async {
    try {
      _isInitialized = await _speech.initialize(
        onStatus: _onSpeechStatus,
        onError: _onSpeechError,
      );
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('Speech init error: $e');
      if (mounted) {
        setState(() {
          _hasError = true;
          _errorMessage = 'Could not initialize voice search';
          _state = VoiceSearchState.error;
        });
      }
    }
  }

  void _onSpeechStatus(String status) {
    debugPrint('Speech status: $status');
    if (status == 'done' || status == 'notListening') {
      if (_recognizedText.isNotEmpty && mounted) {
        _processResult();
      } else if (mounted) {
        setState(() {
          _isListening = false;
          _state = VoiceSearchState.idle;
        });
        _stopAnimations();
      }
    }
  }

  void _onSpeechError(dynamic error) {
    debugPrint('Speech error: $error');
    if (mounted) {
      setState(() {
        _isListening = false;
        _hasError = true;
        _errorMessage = 'Could not understand. Please try again.';
        _state = VoiceSearchState.error;
      });
      _stopAnimations();
    }
  }

  void _startListening() async {
    if (!_isInitialized) {
      await _initSpeech();
      if (!_isInitialized) {
        setState(() {
          _hasError = true;
          _errorMessage = 'Microphone not available';
          _state = VoiceSearchState.error;
        });
        return;
      }
    }

    HapticFeedback.mediumImpact();
    
    setState(() {
      _isListening = true;
      _hasError = false;
      _hasNavigated = false; // Reset for new session
      _recognizedText = '';
      _state = VoiceSearchState.listening;
    });

    _startAnimations();

    await _speech.listen(
      onResult: _onSpeechResult,
      onSoundLevelChange: _onSoundLevelChange,
      listenFor: const Duration(seconds: 30),
      pauseFor: const Duration(seconds: 3),
      localeId: 'en_IN',
      cancelOnError: true,
      partialResults: true,
    );

    // Reset silence timer
    _resetSilenceTimer();
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    setState(() {
      _recognizedText = result.recognizedWords;
    });
    
    // Reset silence timer on new results
    _resetSilenceTimer();

    if (result.finalResult && _recognizedText.isNotEmpty) {
      _processResult();
    }
  }

  void _onSoundLevelChange(double level) {
    setState(() {
      // Normalize sound level to 0-1 range
      _soundLevel = ((level + 2) / 12).clamp(0.0, 1.0);
    });
  }

  void _resetSilenceTimer() {
    _silenceTimer?.cancel();
    _silenceTimer = Timer(const Duration(seconds: 3), () {
      if (_isListening && _recognizedText.isNotEmpty) {
        _speech.stop();
        _processResult();
      }
    });
  }

  void _processResult() {
    // Prevent duplicate navigation
    if (_hasNavigated) return;
    _hasNavigated = true;
    
    _silenceTimer?.cancel();
    
    setState(() {
      _isListening = false;
      _state = VoiceSearchState.processing;
    });

    // Brief delay to show processing state
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted && _recognizedText.isNotEmpty) {
        Navigator.pop(context);
        Navigator.pushNamed(
          context,
          AppRoutes.search,
          arguments: {'query': _recognizedText},
        );
      }
    });
  }

  void _stopListening() async {
    _silenceTimer?.cancel();
    await _speech.stop();
    
    setState(() {
      _isListening = false;
      _state = VoiceSearchState.idle;
    });
    _stopAnimations();
  }

  void _startAnimations() {
    _pulseController.repeat(reverse: true);
    _glowController.repeat(reverse: true);
  }

  void _stopAnimations() {
    _pulseController.stop();
    _pulseController.reset();
    _glowController.stop();
    _glowController.reset();
  }

  @override
  void dispose() {
    _silenceTimer?.cancel();
    _speech.stop();
    _pulseController.dispose();
    _waveController.dispose();
    _glowController.dispose();
    _particleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final size = MediaQuery.of(context).size;

    return Container(
      height: size.height * 0.7,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? [const Color(0xFF1a1a2e), const Color(0xFF0f0f1a)]
              : [Colors.white, const Color(0xFFF5F5F5)],
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Stack(
        children: [
          // Particle background
          if (_isListening) _buildParticleBackground(isDark),
          
          // Main content
          SafeArea(
            child: Column(
              children: [
                // Handle bar
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[700] : Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                const Spacer(flex: 1),

                // Animated orb
                _buildAnimatedOrb(isDark),

                const SizedBox(height: 40),

                // Status text
                _buildStatusText(isDark),

                const SizedBox(height: 16),

                // Recognized text
                _buildRecognizedText(isDark),

                const Spacer(flex: 2),

                // Action buttons
                _buildActionButtons(isDark),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParticleBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _particleController,
      builder: (context, child) {
        return CustomPaint(
          painter: ParticlePainter(
            progress: _particleController.value,
            color: isDark ? AppColors.primaryLight : AppColors.primary,
          ),
          size: Size.infinite,
        );
      },
    );
  }

  Widget _buildAnimatedOrb(bool isDark) {
    final baseColor = isDark ? AppColors.primaryLight : AppColors.primary;
    final orbSize = 140.0;

    return GestureDetector(
      onTap: () {
        if (!_isListening) {
          _startListening();
        } else {
          _stopListening();
        }
      },
      child: AnimatedBuilder(
        animation: Listenable.merge([_pulseAnimation, _glowAnimation, _waveController]),
        builder: (context, child) {
          final scale = _isListening ? _pulseAnimation.value : 1.0;
          final glow = _isListening ? _glowAnimation.value : 0.3;

          return Container(
            width: orbSize * 1.5,
            height: orbSize * 1.5,
            alignment: Alignment.center,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Outer glow rings
                if (_isListening) ...[
                  _buildGlowRing(orbSize * 1.4, glow * 0.2, baseColor),
                  _buildGlowRing(orbSize * 1.25, glow * 0.4, baseColor),
                ],

                // Waveform visualizer
                if (_isListening)
                  CustomPaint(
                    painter: WaveformPainter(
                      progress: _waveController.value,
                      amplitude: _soundLevel,
                      color: baseColor.withValues(alpha: 0.5),
                    ),
                    size: Size(orbSize * 1.3, orbSize * 1.3),
                  ),

                // Main orb
                Transform.scale(
                  scale: scale,
                  child: Container(
                    width: orbSize,
                    height: orbSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          baseColor.withValues(alpha: 0.9),
                          baseColor,
                          baseColor.withValues(alpha: 0.8),
                        ],
                        stops: const [0.0, 0.5, 1.0],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: baseColor.withValues(alpha: glow),
                          blurRadius: 40,
                          spreadRadius: 10,
                        ),
                        BoxShadow(
                          color: baseColor.withValues(alpha: glow * 0.5),
                          blurRadius: 80,
                          spreadRadius: 20,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        _isListening ? Icons.mic : Icons.mic_none_rounded,
                        color: Colors.white,
                        size: 48,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildGlowRing(double size, double opacity, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: color.withValues(alpha: opacity),
          width: 2,
        ),
      ),
    );
  }

  Widget _buildStatusText(bool isDark) {
    String text;
    switch (_state) {
      case VoiceSearchState.idle:
        text = 'Tap to speak';
        break;
      case VoiceSearchState.listening:
        text = 'Listening...';
        break;
      case VoiceSearchState.processing:
        text = 'Searching...';
        break;
      case VoiceSearchState.error:
        text = _errorMessage;
        break;
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      child: Text(
        text,
        key: ValueKey('status_${_state.name}'),
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: _state == VoiceSearchState.error
              ? Colors.red
              : (isDark ? Colors.white : AppColors.textPrimary),
        ),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _buildRecognizedText(bool isDark) {
    if (_recognizedText.isEmpty) {
      return Text(
        _isListening ? 'Say what you\'re looking for...' : 'e.g. "iPhone 15 case"',
        style: TextStyle(
          fontSize: 14,
          color: isDark ? Colors.grey[500] : Colors.grey[600],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 32),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.format_quote_rounded,
            size: 20,
            color: isDark ? AppColors.primaryLight : AppColors.primary,
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              _recognizedText,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.white : AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Cancel button
        TextButton.icon(
          onPressed: () {
            HapticFeedback.lightImpact();
            Navigator.pop(context);
          },
          icon: Icon(
            Icons.close_rounded,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
          label: Text(
            'Cancel',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        if (_hasError) ...[
          const SizedBox(width: 24),
          if (_errorMessage.contains('Settings'))
            ElevatedButton.icon(
              onPressed: () {
                openAppSettings();
              },
              icon: const Icon(Icons.settings_rounded),
              label: const Text('Open Settings'),
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            )
          else
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _hasError = false;
                  _state = VoiceSearchState.idle;
                });
                _checkPermissionAndInit();
              },
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// Voice search states
enum VoiceSearchState { idle, listening, processing, error }

/// Custom painter for waveform visualization
class WaveformPainter extends CustomPainter {
  final double progress;
  final double amplitude;
  final Color color;

  WaveformPainter({
    required this.progress,
    required this.amplitude,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;

    // Draw multiple wave circles
    for (int i = 0; i < 3; i++) {
      final waveProgress = (progress + i * 0.33) % 1.0;
      final waveRadius = radius * (0.6 + waveProgress * 0.4 * (0.5 + amplitude * 0.5));
      final opacity = (1 - waveProgress) * 0.6;
      
      paint.color = color.withValues(alpha: opacity);
      canvas.drawCircle(center, waveRadius, paint);
    }
  }

  @override
  bool shouldRepaint(WaveformPainter oldDelegate) =>
      progress != oldDelegate.progress || amplitude != oldDelegate.amplitude;
}

/// Custom painter for particle background
class ParticlePainter extends CustomPainter {
  final double progress;
  final Color color;
  final math.Random _random = math.Random(42);

  ParticlePainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    for (int i = 0; i < 30; i++) {
      final x = _random.nextDouble() * size.width;
      final baseY = _random.nextDouble() * size.height;
      final y = (baseY + progress * size.height * 0.3) % size.height;
      final radius = 1.0 + _random.nextDouble() * 2;
      final opacity = 0.1 + _random.nextDouble() * 0.3;

      paint.color = color.withValues(alpha: opacity);
      canvas.drawCircle(Offset(x, y), radius, paint);
    }
  }

  @override
  bool shouldRepaint(ParticlePainter oldDelegate) => progress != oldDelegate.progress;
}
