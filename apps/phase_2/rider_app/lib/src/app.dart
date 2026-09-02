import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router/rider_router.dart';

class QuickcommerceRiderApp extends ConsumerWidget {
  const QuickcommerceRiderApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Quickcommerce Rider',
      debugShowCheckedModeBanner: false,
      theme: QuickcommerceTheme.light(),
      darkTheme: QuickcommerceTheme.dark(),
      highContrastTheme: QuickcommerceTheme.highContrastLight(),
      highContrastDarkTheme: QuickcommerceTheme.highContrastDark(),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(riderRouterProvider),
    );
  }
}
