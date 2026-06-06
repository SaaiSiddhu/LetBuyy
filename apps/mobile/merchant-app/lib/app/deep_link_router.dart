import 'package:go_router/go_router.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import '../screens/main/store_main_screen.dart';
import '../screens/orders/order_detail_screen.dart';
import '../screens/preview/live_preview_screen.dart';
import '../screens/subscription/pricing_screen.dart';

class MobileDeepLinkTarget {
  const MobileDeepLinkTarget(this.routeName, {this.arguments = const {}});

  final String routeName;
  final Map<String, Object?> arguments;
}

class AppDeepLinkRouter {
  AppDeepLinkRouter._();

  static const String orderRouteName = 'push-order';
  static const String paymentReturnRouteName = 'payment-return';
  static const String shareRouteName = 'share-store';

  static final GoRouter router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const StoreMainScreen()),
      GoRoute(
        path: '/orders/:orderId',
        name: orderRouteName,
        builder: (context, state) => OrderDetailScreen(
          orderId: state.pathParameters['orderId'] ?? '',
          initialOrder: state.extra is OrderContract
              ? state.extra! as OrderContract
              : null,
        ),
      ),
      GoRoute(
        path: '/payment-return',
        name: paymentReturnRouteName,
        builder: (context, state) => const PricingScreen(),
      ),
      GoRoute(
        path: '/share/:storeId',
        name: shareRouteName,
        builder: (context, state) => LivePreviewScreen(
          storeUrl: state.uri.queryParameters['url'] ?? '',
          storeName: state.uri.queryParameters['name'] ?? 'Store',
        ),
      ),
    ],
  );

  static MobileDeepLinkTarget? resolve(Uri uri) {
    final segments = uri.pathSegments;
    if (segments.length >= 2 && segments.first == 'orders') {
      return MobileDeepLinkTarget(
        '/orders/detail',
        arguments: {'orderId': segments[1]},
      );
    }
    if (segments.isNotEmpty && segments.first == 'payment-return') {
      return MobileDeepLinkTarget(
        '/pricing',
        arguments: Map<String, Object?>.from(uri.queryParameters),
      );
    }
    if (segments.length >= 2 && segments.first == 'share') {
      return MobileDeepLinkTarget(
        '/live-preview',
        arguments: {
          'storeId': segments[1],
          'storeUrl': uri.queryParameters['url'] ?? '',
          'storeName': uri.queryParameters['name'] ?? 'Store',
        },
      );
    }
    return null;
  }
}
