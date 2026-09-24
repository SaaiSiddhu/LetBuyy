// Web Category Screen - Browser-optimized layout
import 'package:flutter/material.dart';
import 'category_screen.dart';

/// Web Category Screen - Uses the responsive CategoryScreen
class WebCategoryScreen extends StatelessWidget {
  final String? preselectedCategoryId;
  
  const WebCategoryScreen({super.key, this.preselectedCategoryId});

  @override
  Widget build(BuildContext context) {
    return CategoryScreen(preselectedCategoryId: preselectedCategoryId);
  }
}

