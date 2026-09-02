import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/rider_providers.dart';
import '../../features/assignment/presentation/assignment_page.dart';
import '../../features/auth/presentation/rider_auth_page.dart';
import '../../features/delivery/presentation/active_delivery_page.dart';
import '../../features/earnings/presentation/earnings_page.dart';
import '../../features/shift/presentation/shift_page.dart';
import 'rider_routes.dart';

final riderRouterProvider = Provider<GoRouter>((ref) {
  final session = ref.watch(riderSessionProvider).valueOrNull;
  return GoRouter(
    initialLocation: RiderRoutes.shift,
    redirect: (context, state) {
      final path = state.uri.path;
      if (session == null && path != RiderRoutes.auth) return RiderRoutes.auth;
      if (session != null && path == RiderRoutes.auth) return RiderRoutes.shift;
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (context, state) => RiderRoutes.shift,
      ),
      GoRoute(
        path: RiderRoutes.auth,
        builder: (context, state) => const RiderAuthPage(),
      ),
      GoRoute(
        path: RiderRoutes.shift,
        builder: (context, state) => const ShiftPage(),
      ),
      GoRoute(
        path: RiderRoutes.offer,
        builder: (context, state) => const AssignmentPage(),
      ),
      GoRoute(
        path: RiderRoutes.activeDelivery,
        builder: (context, state) => const ActiveDeliveryPage(),
      ),
      GoRoute(
        path: RiderRoutes.earnings,
        builder: (context, state) => const EarningsPage(),
      ),
    ],
  );
});
