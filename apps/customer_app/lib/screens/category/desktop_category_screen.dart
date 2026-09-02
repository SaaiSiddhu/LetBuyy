// Desktop Category Screen - macOS/Windows native app layout
import 'package:flutter/material.dart';
import 'web_category_screen.dart';

/// Desktop Category Screen - Shares layout with web
class DesktopCategoryScreen extends StatelessWidget {
  final String? preselectedCategoryId;
  
  const DesktopCategoryScreen({super.key, this.preselectedCategoryId});

  @override
  Widget build(BuildContext context) {
    return WebCategoryScreen(preselectedCategoryId: preselectedCategoryId);
  }
}

