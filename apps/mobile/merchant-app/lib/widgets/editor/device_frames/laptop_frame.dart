import 'package:flutter/material.dart';
import 'dart:async';
import 'package:intl/intl.dart';

/// MacBook Pro 14" style laptop frame with notch and macOS menu bar
/// Bezeless design with realistic proportions
class LaptopFrame extends StatefulWidget {
  final Widget child;

  const LaptopFrame({
    super.key,
    required this.child,
  });

  @override
  State<LaptopFrame> createState() => _LaptopFrameState();
}

class _LaptopFrameState extends State<LaptopFrame> {
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
    // macOS style: Sat 12:21 AM
    final newTime = DateFormat('EEE h:mm a').format(now);
    if (newTime != _currentTime) {
      setState(() => _currentTime = newTime);
    }
  }

  @override
  Widget build(BuildContext context) {
    // MacBook Pro 14" - compact size to fit in editor
    const screenWidth = 480.0;
    const screenHeight = 300.0;
    
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Screen with thin bezel
        Container(
          width: screenWidth + 16,
          height: screenHeight + 12,
          decoration: BoxDecoration(
            // Space Gray aluminum
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF3A3A3C),
                Color(0xFF1C1C1E),
                Color(0xFF2C2C2E),
              ],
            ),
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(14),
            ),
            border: Border.all(
              color: const Color(0xFF48484A),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 30,
                offset: const Offset(0, 15),
                spreadRadius: 5,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(12),
            ),
            child: Container(
              // Black bezel around display (matching notch)
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1C), // Same black as notch
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(12),
                ),
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(5),
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                children: [
                  // Content area (below menu bar)
                  Positioned.fill(
                    child: Column(
                      children: [
                        // Space for menu bar
                        const SizedBox(height: 22),
                        // Actual content
                        Expanded(child: widget.child),
                      ],
                    ),
                  ),
                  
                  // Menu bar with notch (overlay on top)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: _buildMenuBar(screenWidth),
                  ),
                ],
              ),
              ),
            ),
          ),
        ),
        
        // Hinge
        Container(
          width: screenWidth + 24,
          height: 8,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF2A2A2C),
                const Color(0xFF1A1A1C),
              ],
            ),
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(2),
            ),
          ),
        ),
        
        // Keyboard base (palmrest view from top)
        Container(
          width: screenWidth + 36,
          height: 10,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF3A3A3C),
                const Color(0xFF2A2A2C),
              ],
            ),
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(6),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 6,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Center(
            child: Container(
              width: 60,
              height: 3,
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1C),
                borderRadius: BorderRadius.circular(1.5),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMenuBar(double screenWidth) {
    const menuBarColor = Color(0xFF2D2D2D); // Dark grey like macOS
    const textColor = Color(0xFFE5E5E7); // Light grey/white text
    const iconColor = Color(0xFFB0B0B5); // Grey icons
    
    return Container(
      height: 22,
      color: menuBarColor,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Menu bar content
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Center(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                // Apple logo (grey)
                Icon(
                  Icons.apple,
                  size: 13,
                  color: iconColor,
                ),
                const SizedBox(width: 14),
                
                // App name (white, bold)
                Text(
                  'Safari',
                  style: TextStyle(
                    color: textColor,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    height: 1.0,
                  ),
                ),
                const SizedBox(width: 12),
                
                // Menu items - left of notch
                ...['File', 'Edit', 'View'].map((item) => Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Text(
                    item,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w400,
                      height: 1.0,
                    ),
                  ),
                )),
                
                // Space for notch in center
                const SizedBox(width: 60),
                
                const Spacer(),
                
                // Right side - Status icons
                _buildStatusIcons(),
              ],
              ),
            ),
          ),
          
          // Notch extending to top (fills grey gap)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                width: 60,
                height: 22, // Full menu bar height
                decoration: BoxDecoration(
                  color: const Color(0xFF1A1A1C),
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(12),
                  ),
                ),
                // Camera and light centered
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Camera lens
                    Container(
                      width: 5,
                      height: 5,
                      margin: const EdgeInsets.only(top: 4),
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          colors: [
                            const Color(0xFF1E3A4C),
                            const Color(0xFF0D1F2D),
                          ],
                        ),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFF3A5A6C),
                          width: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 3),
                    // Camera indicator light (off)
                    Container(
                      width: 3,
                      height: 3,
                      margin: const EdgeInsets.only(top: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF3A3A3C), // Dark grey (off)
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIcons() {
    const iconColor = Color(0xFFB0B0B5); // Grey icons
    const textColor = Color(0xFFE5E5E7); // Light grey/white text
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Battery icon
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 14,
              height: 7,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(1.5),
                border: Border.all(
                  color: textColor,
                  width: 0.8,
                ),
              ),
              padding: const EdgeInsets.all(1),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF32D74B),
                  borderRadius: BorderRadius.circular(0.5),
                ),
              ),
            ),
            Container(
              width: 1,
              height: 3,
              margin: const EdgeInsets.only(left: 0.5),
              decoration: BoxDecoration(
                color: textColor,
                borderRadius: const BorderRadius.horizontal(
                  right: Radius.circular(1),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(width: 5),
        
        // WiFi icon
        Icon(
          Icons.wifi_rounded,
          size: 10,
          color: iconColor,
        ),
        const SizedBox(width: 5),
        
        // Search
        Icon(
          Icons.search_rounded,
          size: 10,
          color: iconColor,
        ),
        const SizedBox(width: 6),
        
        // Date and Time (compact)
        Text(
          _currentTime.isEmpty ? 'Sat 12:21 AM' : _currentTime,
          style: TextStyle(
            color: textColor,
            fontSize: 9,
            fontWeight: FontWeight.w400,
            height: 1.0,
          ),
        ),
      ],
    );
  }
}

