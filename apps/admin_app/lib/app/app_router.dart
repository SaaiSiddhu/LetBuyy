// lib/app/app_router.dart
// GoRouter configuration for Admin App with semantic URL routing

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:letbuyy_core/letbuyy_core.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

// Auth Screens
import '../screens/splash/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/reset_password_screen.dart';
import '../screens/download/download_screen.dart';

// Shell
import '../screens/admin_shell_screen.dart';

// Dashboard
import '../screens/admin_dashboard.dart';

// Categories
import '../screens/products/category_management_screen.dart';
import '../screens/products/add_edit_category_screen.dart';
import '../screens/products/category_attribute_management_screen.dart';

// Products
import '../screens/products/product_approval_screen.dart';
import '../screens/products/add_product_screen.dart';
import '../screens/products/edit_product_screen.dart';

// Orders
import '../screens/orders/order_management_screen.dart';
import '../screens/orders/admin_order_details_screen.dart';

// Users & Sellers
import '../screens/users/user_management_screen.dart';
import '../screens/sellers/seller_management_screen.dart';
import '../screens/sellers/seller_detail_screen.dart';

// Marketing
import '../screens/banners/banner_management_screen.dart';
import '../screens/sponsored_banners/sponsored_banner_management_screen.dart';
import '../screens/coupon/coupon_management_screen.dart';
import '../screens/deals/deal_approvals_screen.dart';
import '../screens/reels/admin_reels_screen.dart';

// Finance
import '../screens/payouts/admin_payouts_dashboard.dart';
import '../screens/returns/admin_returns_screen.dart';
import '../screens/commission/commission_management_screen.dart';

// Analytics
import '../screens/analytics/analytics_screen.dart';
import '../screens/analytics/orders_analytics_screen.dart';
import '../screens/analytics/gmv_analytics_screen.dart';
import '../screens/analytics/sellers_analytics_screen.dart';
import '../screens/analytics/users_analytics_screen.dart';
import '../screens/analytics/products_analytics_screen.dart';
import '../screens/analytics/ads_analytics_screen.dart';

// Communication
import '../screens/notifications/admin_notifications_screen.dart';
import '../screens/notifications/send_notification_screen.dart';
import '../screens/support/support_inbox_screen.dart';

// System
import '../screens/app_update/app_update_management_screen.dart';
import '../screens/settings/admin_settings_screen.dart';
import '../screens/settings/security_settings_screen.dart';
import '../screens/settings/totp_setup_screen.dart';
import '../screens/domains/domain_requests_screen.dart';

/// Global navigator key for the router
final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

/// App Router Configuration
class AppRouter {
  static const String baseUrl = 'https://admin-letbuy-y.web.app';

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE PATHS
  // ═══════════════════════════════════════════════════════════════════════════

  // Auth
  static const String splash = '/';
  static const String login = '/login';
  static const String forgotPassword = '/forgot-password';
  static const String resetPassword = '/reset-password';
  static const String download = '/download';

  // Dashboard
  static const String dashboard = '/dashboard';

  // Categories
  static const String categories = '/categories';
  static const String categoryNew = '/categories/new';
  static const String categoryEdit = '/categories/:id/edit';
  static const String categoryAttributes = '/categories/:id/attributes';

  // Products
  static const String products = '/products';
  static const String productNew = '/products/new';
  static const String productEdit = '/products/:id/edit';

  // Orders
  static const String orders = '/orders';
  static const String orderDetail = '/orders/:id';

  // Users
  static const String users = '/users';

  // Sellers
  static const String sellers = '/sellers';
  static const String sellerDetail = '/sellers/:id';

  // Marketing
  static const String banners = '/banners';
  static const String sponsoredAds = '/sponsored-ads';
  static const String coupons = '/coupons';
  static const String deals = '/deals';
  static const String reels = '/reels';

  // Finance
  static const String payouts = '/payouts';
  static const String returns = '/returns';
  static const String commission = '/commission';

  // Analytics
  static const String analytics = '/analytics';
  static const String analyticsOrders = '/analytics/orders';
  static const String analyticsGmv = '/analytics/gmv';
  static const String analyticsSellers = '/analytics/sellers';
  static const String analyticsUsers = '/analytics/users';
  static const String analyticsProducts = '/analytics/products';
  static const String analyticsAds = '/analytics/ads';

  // Communication
  static const String notifications = '/notifications';
  static const String notificationSend = '/notifications/send';
  static const String support = '/support';

  static const String domainRequests = '/domain-requests';
  static const String appUpdates = '/app-updates';
  static const String settings = '/settings';
  static const String securitySettings = '/settings/security';
  static const String totpSetup = '/settings/totp-setup';

  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  static final GoRouter router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: splash,
    debugLogDiagnostics: true,
    redirect: _guardRoute,
    routes: [
      // ─────────────────────────────────────────────────────────────────────
      // AUTH ROUTES (Outside Shell)
      // ─────────────────────────────────────────────────────────────────────
      GoRoute(
        path: splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: login,
        builder: (context, state) => const LoginScreen(key: ValueKey('login')),
        routes: [
          // OTP Verification sub-route
          GoRoute(
            path: 'verify',
            builder: (context, state) {
              final email = state.uri.queryParameters['email'] ?? '';
              final is2FA = state.uri.queryParameters['2fa'] == 'true';
              return LoginScreen(
                key: ValueKey('login-verify-$email'),
                showOtp: true,
                email: email,
                is2FA: is2FA,
              );
            },
          ),
        ],
      ),
      GoRoute(
        path: forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: resetPassword,
        builder: (context, state) {
          final token = state.uri.queryParameters['token'];
          final uid = state.uri.queryParameters['uid'];
          return ResetPasswordScreen(token: token, uid: uid);
        },
      ),
      GoRoute(
        path: download,
        builder: (context, state) => const DownloadScreen(),
      ),
      GoRoute(
        path: securitySettings,
        builder: (context, state) => const SecuritySettingsScreen(),
      ),
      GoRoute(
        path: totpSetup,
        builder: (context, state) => const TOTPSetupScreen(),
      ),

      // ─────────────────────────────────────────────────────────────────────
      // SHELL ROUTE (With Sidebar/Bottom Nav)
      // ─────────────────────────────────────────────────────────────────────
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AdminShellScreen(
          currentPath: state.uri.path,
          child: child,
        ),
        routes: [
          // DASHBOARD
          GoRoute(
            path: dashboard,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AdminDashboard(),
            ),
          ),

          // ─────────────────────────────────────────────────────────────────
          // CATEGORIES
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: categories,
            pageBuilder: (context, state) => _buildPage(
              state,
              const CategoryManagementScreen(),
            ),
            routes: [
              GoRoute(
                path: 'new',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  final parentId = state.uri.queryParameters['parentId'];
                  final level = int.tryParse(state.uri.queryParameters['level'] ?? '0') ?? 0;
                  return AddEditCategoryScreen(parentId: parentId, level: level);
                },
              ),
              GoRoute(
                path: ':id/edit',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  // Category passed via extra parameter
                  final category = state.extra as CategoryModel?;
                  final parentId = state.uri.queryParameters['parentId'];
                  final level = int.tryParse(state.uri.queryParameters['level'] ?? '0') ?? 0;
                  return AddEditCategoryScreen(
                    category: category,
                    parentId: parentId,
                    level: level,
                  );
                },
              ),
              GoRoute(
                path: ':id/attributes',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  // CategoryAttributeManagementScreen doesn't take categoryId
                  // It loads all attributes internally
                  return const CategoryAttributeManagementScreen();
                },
              ),
            ],
          ),

          // ─────────────────────────────────────────────────────────────────
          // PRODUCTS
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: products,
            pageBuilder: (context, state) => _buildPage(
              state,
              const ProductApprovalScreen(),
            ),
            routes: [
              GoRoute(
                path: 'new',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const AddProductScreen(),
              ),
              GoRoute(
                path: ':id/edit',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  // Product passed via extra parameter
                  final product = state.extra as ProductModel;
                  return EditProductScreen(product: product);
                },
              ),
            ],
          ),

          // ─────────────────────────────────────────────────────────────────
          // ORDERS
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: orders,
            pageBuilder: (context, state) => _buildPage(
              state,
              const OrderManagementScreen(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  final orderId = state.pathParameters['id']!;
                  return AdminOrderDetailsScreen(orderId: orderId);
                },
              ),
            ],
          ),

          // ─────────────────────────────────────────────────────────────────
          // USERS
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: users,
            pageBuilder: (context, state) => _buildPage(
              state,
              const UserManagementScreen(),
            ),
          ),

          // ─────────────────────────────────────────────────────────────────
          // SELLERS
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: sellers,
            pageBuilder: (context, state) => _buildPage(
              state,
              const SellerManagementScreen(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) {
                  final sellerId = state.pathParameters['id']!;
                  final seller = state.extra as SellerModel?;
                  return SellerDetailScreen(sellerId: sellerId, seller: seller);
                },
              ),
            ],
          ),

          // ─────────────────────────────────────────────────────────────────
          // MARKETING
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: banners,
            pageBuilder: (context, state) => _buildPage(
              state,
              const BannerManagementScreen(),
            ),
          ),
          GoRoute(
            path: sponsoredAds,
            pageBuilder: (context, state) => _buildPage(
              state,
              const SponsoredBannerManagementScreen(),
            ),
          ),
          GoRoute(
            path: coupons,
            pageBuilder: (context, state) => _buildPage(
              state,
              const CouponManagementScreen(),
            ),
          ),
          GoRoute(
            path: deals,
            pageBuilder: (context, state) => _buildPage(
              state,
              const DealApprovalsScreen(),
            ),
          ),
          GoRoute(
            path: reels,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AdminReelsScreen(),
            ),
          ),

          // ─────────────────────────────────────────────────────────────────
          // FINANCE
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: payouts,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AdminPayoutsDashboard(),
            ),
          ),
          GoRoute(
            path: returns,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AdminReturnsScreen(),
            ),
          ),
          GoRoute(
            path: commission,
            pageBuilder: (context, state) => _buildPage(
              state,
              const CommissionManagementScreen(),
            ),
          ),

          // ─────────────────────────────────────────────────────────────────
          // ANALYTICS
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: analytics,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AnalyticsScreen(),
            ),
            routes: [
              GoRoute(
                path: 'orders',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const OrdersAnalyticsScreen(),
              ),
              GoRoute(
                path: 'gmv',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const GMVAnalyticsScreen(),
              ),
              GoRoute(
                path: 'sellers',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const SellersAnalyticsScreen(),
              ),
              GoRoute(
                path: 'users',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const UsersAnalyticsScreen(),
              ),
              GoRoute(
                path: 'products',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const ProductsAnalyticsScreen(),
              ),
              GoRoute(
                path: 'ads',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const AdsAnalyticsScreen(),
              ),
            ],
          ),

          // ─────────────────────────────────────────────────────────────────
          // COMMUNICATION
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: notifications,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AdminNotificationsScreen(),
            ),
            routes: [
              GoRoute(
                path: 'send',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const SendNotificationScreen(),
              ),
            ],
          ),
          GoRoute(
            path: support,
            pageBuilder: (context, state) => _buildPage(
              state,
              const SupportInboxScreen(),
            ),
          ),

          // ─────────────────────────────────────────────────────────────────
          // SYSTEM
          // ─────────────────────────────────────────────────────────────────
          GoRoute(
            path: appUpdates,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AppUpdateManagementScreen(),
            ),
          ),
          GoRoute(
            path: domainRequests,
            pageBuilder: (context, state) => _buildPage(
              state,
              const DomainRequestsScreen(),
            ),
          ),
          GoRoute(
            path: settings,
            pageBuilder: (context, state) => _buildPage(
              state,
              const AdminSettingsScreen(),
            ),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => _ErrorScreen(error: state.error),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static Page<dynamic> _buildPage(GoRouterState state, Widget child) {
    return NoTransitionPage(
      key: state.pageKey,
      child: child,
    );
  }

  static Future<String?> _guardRoute(BuildContext context, GoRouterState state) async {
    final isLoggedIn = FirebaseAuth.instance.currentUser != null;
    final isAuthRoute = state.matchedLocation == login ||
        state.uri.path.startsWith(login) ||  // Include /login/verify
        state.matchedLocation == forgotPassword ||
        state.matchedLocation == resetPassword ||
        state.matchedLocation == splash ||
        state.matchedLocation == download;

    // Not logged in and trying to access protected route
    if (!isLoggedIn && !isAuthRoute) {
      return login;
    }

    // Logged in and trying to access login page (but not verify sub-route)
    if (isLoggedIn && state.matchedLocation == login && !state.uri.path.contains('/verify')) {
      return dashboard;
    }

    // Logged in at splash - redirect to dashboard
    if (isLoggedIn && state.matchedLocation == splash) {
      // Verify admin role
      final prefs = await SharedPreferences.getInstance();
      final userRole = prefs.getString(StorageConstants.keyUserRole);
      if (userRole == 'admin') {
        return dashboard;
      }
      // Not admin - sign out and go to login
      await FirebaseAuth.instance.signOut();
      return login;
    }

    return null; // No redirect
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR SCREEN
// ═══════════════════════════════════════════════════════════════════════════

class _ErrorScreen extends StatelessWidget {
  final Exception? error;

  const _ErrorScreen({this.error});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Error')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              error?.toString() ?? 'Page not found',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go(AppRouter.dashboard),
              child: const Text('Go to Dashboard'),
            ),
          ],
        ),
      ),
    );
  }
}
