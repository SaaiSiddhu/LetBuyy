import 'package:agrimore_design_system/agrimore_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/router/rider_router.dart';

class AgrimoreRiderApp extends ConsumerWidget {
  const AgrimoreRiderApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Agrimore Rider',
      debugShowCheckedModeBanner: false,
      theme: AgrimoreTheme.light(),
      darkTheme: AgrimoreTheme.dark(),
      highContrastTheme: AgrimoreTheme.highContrastLight(),
      highContrastDarkTheme: AgrimoreTheme.highContrastDark(),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(riderRouterProvider),
    );
  }
}
