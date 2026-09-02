import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/handoff/presentation/handoff_page.dart';
import '../../features/inventory/presentation/inventory_page.dart';
import '../../features/onboarding/presentation/store_onboarding_page.dart';
import '../../features/pick_pack/presentation/pick_pack_page.dart';
import '../../features/queue/presentation/store_queue_page.dart';
import 'store_routes.dart';

final storeRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: StoreRoutes.queue,
    routes: [
      GoRoute(path: '/', redirect: (context, state) => StoreRoutes.queue),
      GoRoute(
        path: StoreRoutes.queue,
        builder: (context, state) => const StoreQueuePage(),
      ),
      GoRoute(
        path: StoreRoutes.pickPack,
        builder: (context, state) => const PickPackPage(),
      ),
      GoRoute(
        path: StoreRoutes.pickPackOrder,
        builder: (context, state) => PickPackPage(
          orderId: state.pathParameters['orderId'],
        ),
      ),
      GoRoute(
        path: StoreRoutes.inventory,
        builder: (context, state) => const InventoryPage(),
      ),
      GoRoute(
        path: StoreRoutes.handoff,
        builder: (context, state) => const HandoffPage(),
      ),
      GoRoute(
        path: StoreRoutes.onboarding,
        builder: (context, state) => const StoreOnboardingPage(),
      ),
    ],
  );
});
