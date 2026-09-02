import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/router/store_routes.dart';

class StoreScaffold extends StatelessWidget {
  const StoreScaffold({required this.title, required this.child, super.key});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final path = GoRouterState.of(context).uri.path;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selected(path),
        onDestinationSelected: (index) => context.go(_route(index)),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.queue), label: 'Queue'),
          NavigationDestination(
              icon: Icon(Icons.fact_check_outlined), label: 'Pick'),
          NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined), label: 'Stock'),
          NavigationDestination(
              icon: Icon(Icons.handshake_outlined), label: 'Handoff'),
          NavigationDestination(
              icon: Icon(Icons.storefront_outlined), label: 'Ready'),
        ],
      ),
    );
  }
}

int _selected(String path) {
  if (path == StoreRoutes.pickPack) return 1;
  if (path == StoreRoutes.inventory) return 2;
  if (path == StoreRoutes.handoff) return 3;
  if (path == StoreRoutes.onboarding) return 4;
  return 0;
}

String _route(int index) => switch (index) {
      1 => StoreRoutes.pickPack,
      2 => StoreRoutes.inventory,
      3 => StoreRoutes.handoff,
      4 => StoreRoutes.onboarding,
      _ => StoreRoutes.queue,
    };
