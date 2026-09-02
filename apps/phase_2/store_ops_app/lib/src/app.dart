import 'package:quickcommerce_design_system/quickcommerce_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router/store_router.dart';

class QuickcommerceStoreOpsApp extends ConsumerWidget {
  const QuickcommerceStoreOpsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Quickcommerce Store Ops',
      debugShowCheckedModeBanner: false,
      theme: QuickcommerceTheme.light(),
      darkTheme: QuickcommerceTheme.dark(),
      highContrastTheme: QuickcommerceTheme.highContrastLight(),
      highContrastDarkTheme: QuickcommerceTheme.highContrastDark(),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(storeRouterProvider),
    );
  }
}
