import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/router/rider_routes.dart';

class RiderScaffold extends StatelessWidget {
  const RiderScaffold({
    required this.title,
    required this.child,
    this.actions = const [],
    super.key,
  });

  final String title;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selected(location),
        onDestinationSelected: (index) => context.go(_route(index)),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.power_settings_new), label: 'Shift'),
          NavigationDestination(
              icon: Icon(Icons.assignment_outlined), label: 'Offer'),
          NavigationDestination(
              icon: Icon(Icons.delivery_dining), label: 'Trip'),
          NavigationDestination(
              icon: Icon(Icons.payments_outlined), label: 'Earnings'),
        ],
      ),
    );
  }
}

int _selected(String location) {
  if (location == RiderRoutes.offer) return 1;
  if (location == RiderRoutes.activeDelivery) return 2;
  if (location == RiderRoutes.earnings) return 3;
  return 0;
}

String _route(int index) => switch (index) {
      1 => RiderRoutes.offer,
      2 => RiderRoutes.activeDelivery,
      3 => RiderRoutes.earnings,
      _ => RiderRoutes.shift,
    };
