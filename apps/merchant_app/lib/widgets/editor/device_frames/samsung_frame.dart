import 'package:flutter/material.dart';
import 'dart:async';
import 'package:intl/intl.dart';

/// Samsung Galaxy S25 style phone frame with punch-hole camera and Android status bar
/// Flatter design with centered camera punch-hole
class SamsungFrame extends StatefulWidget {
  final Widget child;

  const SamsungFrame({
    super.key,
    required this.child,
  });

  @override
  State<SamsungFrame> createState() => _SamsungFrameState();
}

class _SamsungFrameState extends State<SamsungFrame> {
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
    // Samsung uses 24-hour format by default
    final newTime = DateFormat('HH:mm').format(now);
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
        // Samsung Titanium Gray frame
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF2D2D30),
            Color(0xFF1A1A1D),
            Color(0xFF252528),
          ],
        ),
        // Flatter corners like S25
        borderRadius: BorderRadius.circular(42),
        border: Border.all(
          color: const Color(0xFF3A3A3D),
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
            color: Colors.white.withValues(alpha: 0.05),
            blurRadius: 2,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(38),
        child: Container(
          color: Colors.white,
          child: Stack(
            children: [
              // Content area (below status bar, above nav bar)
              Positioned.fill(
                child: Column(
                  children: [
                    // Top safe area (content starts below status bar)
                    const SizedBox(height: 32),
                    // Content
                    Expanded(child: widget.child),
                    // Bottom safe area for gesture nav
                    const SizedBox(height: 20),
                  ],
                ),
              ),
              
              // Status bar overlay with solid background (on top)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 32,
                  color: Colors.white,
                  child: _buildStatusBar(),
                ),
              ),
              
              // Gesture navigation bar overlay (on top)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 20,
                  alignment: Alignment.center,
                  child: Container(
                    width: 100,
                    height: 4,
                    margin: const EdgeInsets.only(top: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(2),
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
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Left side - Time (Samsung style)
          SizedBox(
            width: 45,
            child: Text(
              _currentTime.isEmpty ? '00:00' : _currentTime,
              style: TextStyle(
                color: Colors.black.withValues(alpha: 0.85),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          
          // Center - Punch-hole camera (small, centered)
          Expanded(
            child: Center(
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF1A1A1C),
                      const Color(0xFF0A0A0C),
                      Colors.black,
                    ],
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFF2A2A2C),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 2,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: Center(
                  child: Container(
                    width: 3,
                    height: 3,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E3A4C).withValues(alpha: 0.5),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ),
          ),
          
          // Right side - Icons (Samsung OneUI style)
          SizedBox(
            width: 65,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                _buildNetworkIcon(),
                const SizedBox(width: 4),
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

  Widget _buildNetworkIcon() {
    // 5G/LTE indicator
    return Text(
      '5G',
      style: TextStyle(
        color: Colors.black.withValues(alpha: 0.8),
        fontSize: 9,
        fontWeight: FontWeight.bold,
      ),
    );
  }

  Widget _buildSignalBars() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(4, (index) {
        return Container(
          width: 2.5,
          height: 3 + (index * 2),
          margin: const EdgeInsets.only(right: 0.8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.85),
            borderRadius: BorderRadius.circular(0.5),
          ),
        );
      }),
    );
  }

  Widget _buildBattery() {
    // Samsung style battery icon
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 9,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(2),
            border: Border.all(
              color: Colors.black.withValues(alpha: 0.85),
              width: 1,
            ),
          ),
          padding: const EdgeInsets.all(1.5),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF4CAF50), // Android green
              borderRadius: BorderRadius.circular(0.5),
            ),
          ),
        ),
        Container(
          width: 2,
          height: 4,
          margin: const EdgeInsets.only(left: 0.5),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.85),
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(1),
            ),
          ),
        ),
      ],
    );
  }
}
