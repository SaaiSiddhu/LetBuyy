import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router/store_router.dart';

class AgrimoreStoreOpsApp extends ConsumerWidget {
  const AgrimoreStoreOpsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Agrimore Store Ops',
      debugShowCheckedModeBanner: false,
      theme: AgrimoreTheme.light(),
      darkTheme: AgrimoreTheme.dark(),
      highContrastTheme: AgrimoreTheme.highContrastLight(),
      highContrastDarkTheme: AgrimoreTheme.highContrastDark(),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(storeRouterProvider),
    );
  }
}
