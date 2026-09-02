// Web Search Screen - Browser-specific search layout
import 'package:flutter/material.dart';
import 'mobile_search_screen.dart';

/// Web Search Screen for browser-based access
/// Uses mobile search as base (it's responsive)
class WebSearchScreen extends StatelessWidget {
  const WebSearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const MobileSearchScreen();
  }
}
