// Web Profile Screen - Browser-optimized layout
import 'package:flutter/material.dart';
import 'profile_screen.dart';

/// Web Profile Screen - Uses the same layout as mobile since it's responsive
/// Can be customized for web-specific features in future (sidebar, etc.)
class WebProfileScreen extends StatelessWidget {
  const WebProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ProfileScreen();
  }
}
