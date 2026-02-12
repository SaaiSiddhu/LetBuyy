import 'package:flutter/material.dart';
import 'dart:async';
import 'package:intl/intl.dart';

/// iPhone 15 Pro style phone frame with Dynamic Island and status bar
/// Seamless screen - no gaps between status bar and content
class PhoneFrame extends StatefulWidget {
  final Widget child;

  const PhoneFrame({
    super.key,
    required this.child,
  });

  @override
  State<PhoneFrame> createState() => _PhoneFrameState();
}

class _PhoneFrameState extends State<PhoneFrame> {
  late Timer _timer;
  String _currentTime = '';

  @override
  void initState() {
    super.initState();
    _updateTime();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _updateTime());
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  void _updateTime() {
    final now = DateTime.now();
    final newTime = DateFormat('h:mm').format(now);
    if (newTime != _currentTime) {
      setState(() => _currentTime = newTime);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      height: 600,
      decoration: BoxDecoration(
        // Titanium frame color (iPhone 15 Pro)
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF3A3A3C),
            Color(0xFF1C1C1E),
            Color(0xFF2C2C2E),
          ],
        ),
        borderRadius: BorderRadius.circular(52),
        border: Border.all(
          color: const Color(0xFF48484A),
          width: 3,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 40,
            offset: const Offset(0, 20),
            spreadRadius: 5,
          ),
          BoxShadow(
            color: Colors.white.withValues(alpha: 0.08),
            blurRadius: 2,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(48),
        child: Container(
          color: Colors.white,
          child: Stack(
            children: [
              // Content area (below status bar, above home indicator)
              Positioned.fill(
                child: Column(
                  children: [
                    // Top safe area (content starts below status bar)
                    const SizedBox(height: 44),
                    // Content
                    Expanded(child: widget.child),
                    // Bottom safe area for home indicator
                    const SizedBox(height: 24),
                  ],
                ),
              ),
              
              // Status bar overlay with solid background (on top)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 44,
                  color: Colors.white,
                  child: _buildStatusBar(),
                ),
              ),
              
              // Home indicator overlay (on top)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 24,
                  alignment: Alignment.center,
                  child: Container(
                    width: 120,
                    height: 5,
                    margin: const EdgeInsets.only(top: 10),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBar() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Left side - Time
          SizedBox(
            width: 50,
            child: Text(
              _currentTime.isEmpty ? '9:41' : _currentTime,
              style: TextStyle(
                color: Colors.black.withValues(alpha: 0.9),
                fontSize: 14,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.3,
              ),
            ),
          ),
          
          // Center - Dynamic Island (takes remaining space)
          Expanded(
            child: Center(
              child: Container(
                width: 95,
                height: 28,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Camera lens
                    Container(
                      width: 9,
                      height: 9,
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFF1E3A4C),
                            const Color(0xFF0D1F2D),
                            Colors.black,
                          ],
                        ),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFF2A4A5C),
                          width: 1,
                        ),
                      ),
                    ),
                    Container(
                      width: 4,
                      height: 4,
                      decoration: const BoxDecoration(
                        color: Color(0xFF1A1A1C),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          // Right side - Signal + Battery
          SizedBox(
            width: 50,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                _buildSignalBars(),
                const SizedBox(width: 4),
                _buildBattery(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignalBars() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(4, (index) {
        return Container(
          width: 3,
          height: 4 + (index * 2.5),
          margin: const EdgeInsets.only(right: 1),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(1),
          ),
        );
      }),
    );
  }

  Widget _buildBattery() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 22,
          height: 11,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3),
            border: Border.all(
              color: Colors.black.withValues(alpha: 0.9),
              width: 1,
            ),
          ),
          padding: const EdgeInsets.all(1.5),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF32D74B),
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        ),
        Container(
          width: 2,
          height: 5,
          margin: const EdgeInsets.only(left: 1),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.9),
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(2),
            ),
          ),
        ),
      ],
    );
  }
}
