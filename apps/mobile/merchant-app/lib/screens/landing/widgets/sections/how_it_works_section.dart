import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class HowItWorksSection extends StatefulWidget {
  final bool isMobile;
  const HowItWorksSection({super.key, required this.isMobile});

  @override
  State<HowItWorksSection> createState() => _HowItWorksSectionState();
}

class _HowItWorksSectionState extends State<HowItWorksSection> with SingleTickerProviderStateMixin {
  late AnimationController _pathController;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF6366F1);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentPink = Color(0xFFEC4899);
  static const _accentTeal = Color(0xFF10B981);
  static const _textDark = Color(0xFF0F172A);
  static const _textMuted = Color(0xFF64748B);
  static const _borderLight = Color(0xFFE5E7EB);

  final List<Map<String, dynamic>> _milestones = [
    {
      'step': '01',
      'icon': Icons.download_rounded,
      'color': const Color(0xFF8B5CF6),
      'title': 'Download App',
      'subtitle': 'Get started in seconds',
      'details': ['One-tap signup', 'Free subdomain', 'No docs needed'],
      'time': '2 min',
    },
    {
      'step': '02',
      'icon': Icons.add_photo_alternate_rounded,
      'color': const Color(0xFF14B8A6),
      'title': 'Add Products',
      'subtitle': 'Upload or shoot reels',
      'details': ['Bulk upload', 'Video editor', 'Auto-optimize'],
      'time': '5 min',
    },
    {
      'step': '03',
      'icon': Icons.rocket_launch_rounded,
      'color': const Color(0xFF10B981),
      'title': 'Go Live',
      'subtitle': 'Share & start selling',
      'details': ['Instant publish', 'WhatsApp ready', 'Social share'],
      'time': '1 min',
    },
    {
      'step': '04',
      'icon': Icons.trending_up_rounded,
      'color': const Color(0xFFEC4899),
      'title': 'Scale & Grow',
      'subtitle': 'Track & optimize',
      'details': ['Order alerts', 'Analytics', 'Auto shipping'],
      'time': '∞',
    },
  ];

  @override
  void initState() {
    super.initState();
    _pathController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _pathController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        vertical: widget.isMobile ? 50 : 70,
        horizontal: widget.isMobile ? 16 : 60,
      ),
      // Transparent - unified background shows through from LandingScreen
      child: Column(
        children: [
          _buildHeader(),
          SizedBox(height: widget.isMobile ? 40 : 56),
          widget.isMobile ? _buildMobileRoadmap() : _buildDesktopRoadmap(),
          SizedBox(height: widget.isMobile ? 40 : 56),
          _buildBottomCTA(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        // Badge matching landing theme
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_accentTeal.withValues(alpha: 0.1), _accentTeal.withValues(alpha: 0.05)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _accentTeal.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _accentTeal,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Your Journey',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _accentTeal),
              ),
            ],
          ),
        ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.95, 0.95)),
        const SizedBox(height: 16),
        // Title
        Text(
          'Launch in 10 Minutes',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: widget.isMobile ? 28 : 44,
            fontWeight: FontWeight.w800,
            letterSpacing: -1,
            color: _textDark,
            height: 1.1,
          ),
        ).animate().fadeIn(duration: 500.ms, delay: 100.ms).slideY(begin: 0.08),
        const SizedBox(height: 10),
        // Subtitle
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'From zero to selling in ',
              style: TextStyle(fontSize: widget.isMobile ? 14 : 16, color: _textMuted),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [_primaryPurple, _secondaryPurple]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text('4 steps', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ],
        ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
      ],
    );
  }

  Widget _buildDesktopRoadmap() {
    return Column(
      children: [
        // Animated path line
        Stack(
          children: [
            // Background path
            Container(
              height: 4,
              margin: const EdgeInsets.symmetric(horizontal: 80),
              decoration: BoxDecoration(
                color: _borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Animated gradient path
            AnimatedBuilder(
              animation: _pathController,
              builder: (context, child) {
                return Container(
                  height: 4,
                  margin: const EdgeInsets.symmetric(horizontal: 80),
                  child: FractionallySizedBox(
                    widthFactor: _pathController.value,
                    alignment: Alignment.centerLeft,
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [_secondaryPurple, _accentTeal, _accentPink],
                        ),
                        borderRadius: BorderRadius.circular(2),
                        boxShadow: [
                          BoxShadow(color: _primaryPurple.withValues(alpha: 0.3), blurRadius: 8),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
        const SizedBox(height: 32),
        // Milestone cards
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: _milestones.asMap().entries.map((entry) {
            final index = entry.key;
            final milestone = entry.value;
            return Expanded(
              child: _buildMilestoneCard(milestone, index),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMobileRoadmap() {
    return Column(
      children: _milestones.asMap().entries.map((entry) {
        final index = entry.key;
        final milestone = entry.value;
        final isLast = index == _milestones.length - 1;
        final Color color = milestone['color'];

        return Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Left: Timeline
                Column(
                  children: [
                    // Step circle
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.8)]),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
                        ],
                      ),
                      child: Icon(milestone['icon'], color: Colors.white, size: 24),
                    ),
                    if (!isLast)
                      Container(
                        width: 3,
                        height: 70,
                        margin: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [color.withValues(alpha: 0.4), (_milestones[index + 1]['color'] as Color).withValues(alpha: 0.4)],
                          ),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 16),
                // Right: Content card
                Expanded(
                  child: Container(
                    margin: EdgeInsets.only(bottom: isLast ? 0 : 12),
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: _borderLight),
                      boxShadow: [
                        BoxShadow(color: color.withValues(alpha: 0.08), blurRadius: 16, offset: const Offset(0, 6)),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('STEP ${milestone['step']}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color, letterSpacing: 1)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.access_time_rounded, size: 10, color: color),
                                  const SizedBox(width: 4),
                                  Text(milestone['time'], style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(milestone['title'], style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _textDark)),
                        const SizedBox(height: 4),
                        Text(milestone['subtitle'], style: TextStyle(fontSize: 13, color: _textMuted)),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: (milestone['details'] as List<String>).map((d) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFF),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: _borderLight),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.check_circle_rounded, size: 12, color: color),
                                  const SizedBox(width: 4),
                                  Text(d, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _textDark)),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ).animate(delay: Duration(milliseconds: 100 * index)).fadeIn(duration: 400.ms).slideX(begin: -0.03);
      }).toList(),
    );
  }

  Widget _buildMilestoneCard(Map<String, dynamic> milestone, int index) {
    final Color color = milestone['color'];
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        children: [
          // Step indicator with ring
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withValues(alpha: 0.2), width: 2),
                ),
              ),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.8)]),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6)),
                  ],
                ),
                child: Icon(milestone['icon'], color: Colors.white, size: 26),
              ),
            ],
          ).animate(delay: Duration(milliseconds: 150 * index))
              .fadeIn(duration: 400.ms)
              .scale(begin: const Offset(0.8, 0.8), curve: Curves.easeOutBack),
          const SizedBox(height: 18),
          // Step badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text('STEP ${milestone['step']}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color, letterSpacing: 1)),
          ).animate(delay: Duration(milliseconds: 200 * index)).fadeIn(duration: 300.ms),
          const SizedBox(height: 12),
          // Title
          Text(
            milestone['title'],
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: _textDark),
          ).animate(delay: Duration(milliseconds: 200 * index)).fadeIn(duration: 300.ms),
          const SizedBox(height: 4),
          // Subtitle
          Text(
            milestone['subtitle'],
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: _textMuted),
          ).animate(delay: Duration(milliseconds: 200 * index)).fadeIn(duration: 300.ms),
          const SizedBox(height: 14),
          // Time badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _borderLight),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.access_time_rounded, size: 12, color: color),
                const SizedBox(width: 4),
                Text(milestone['time'], style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
              ],
            ),
          ).animate(delay: Duration(milliseconds: 250 * index)).fadeIn(duration: 300.ms),
          const SizedBox(height: 14),
          // Details
          ...((milestone['details'] as List<String>).map((d) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_circle_rounded, size: 14, color: color),
                  const SizedBox(width: 6),
                  Text(d, style: TextStyle(fontSize: 12, color: _textMuted)),
                ],
              ),
            );
          })).toList().animate(delay: Duration(milliseconds: 300 * index)).fadeIn(duration: 300.ms),
        ],
      ),
    );
  }

  Widget _buildBottomCTA() {
    return Container(
      padding: EdgeInsets.all(widget.isMobile ? 24 : 32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_primaryPurple, _secondaryPurple],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: _primaryPurple.withValues(alpha: 0.3), blurRadius: 24, offset: const Offset(0, 10)),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ready to launch?',
                  style: TextStyle(fontSize: widget.isMobile ? 18 : 24, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  'Join 500+ sellers already growing',
                  style: TextStyle(fontSize: widget.isMobile ? 13 : 14, color: Colors.white.withValues(alpha: 0.8)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Container(
            padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 18 : 24, vertical: widget.isMobile ? 12 : 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, 4))],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Get Started', style: TextStyle(fontSize: widget.isMobile ? 13 : 15, fontWeight: FontWeight.w700, color: _primaryPurple)),
                const SizedBox(width: 6),
                Icon(Icons.arrow_forward_rounded, size: 16, color: _primaryPurple),
              ],
            ),
          ),
        ],
      ),
    ).animate(delay: 500.ms).fadeIn(duration: 500.ms).slideY(begin: 0.1);
  }
}
