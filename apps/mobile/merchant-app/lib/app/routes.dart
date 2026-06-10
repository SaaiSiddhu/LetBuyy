import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

// All other screens are imported but Flutter's tree-shaking
// will handle optimization at build time

import '../screens/splash/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/otp_screen.dart';
import '../screens/auth/error_screen.dart';
import '../screens/auth/turnstile_challenge_screen.dart';
import '../screens/wizard/create_store_wizard.dart';
import '../screens/wizard/store_published_screen.dart';
import '../screens/main/store_main_screen.dart';
import '../screens/premium/upgrade_screen.dart';
import '../screens/preview/live_preview_screen.dart';
import '../screens/settings/domain_settings_screen.dart';
import '../screens/settings/seo_settings_screen.dart';
import '../screens/settings/shipping_screen.dart';
import '../screens/settings/store_details_screen.dart';
import '../screens/settings/taxes_screen.dart';
import '../screens/settings/localization_markets_screen.dart';
import '../screens/settings/custom_data_screen.dart';
import '../screens/settings/notifications_screen.dart';
import '../screens/settings/staff_screen.dart';
import '../screens/settings/billing_screen.dart';
import '../screens/marketing/reviews_screen.dart';
import '../screens/marketing/leads_screen.dart';
import '../screens/marketing/email_campaigns_screen.dart';
import '../screens/apps/apps_screen.dart';
import '../screens/ai/ai_screen.dart';
import '../screens/settings/help_screen.dart';
import '../screens/analytics/analytics_screen.dart';
import '../screens/customers/customer_detail_screen.dart';
import '../screens/customers/customers_screen.dart';
import '../screens/discounts/coupon_form_screen.dart';
import '../screens/discounts/coupons_screen.dart';
import '../screens/discounts/gift_cards_screen.dart';
import '../screens/content/blog_screen.dart';
import '../screens/content/media_library_screen.dart';
import '../screens/content/navigation_screen.dart';
import '../screens/content/pages_screen.dart';
import '../screens/inventory/inventory_screen.dart';
import '../screens/inventory/locations_screen.dart';
import '../screens/inventory/purchase_orders_screen.dart';
import '../screens/inventory/suppliers_screen.dart';
import '../screens/inventory/transfers_screen.dart';
import '../screens/orders/order_detail_screen.dart';
import '../screens/orders/orders_screen.dart';
import '../screens/orders/returns_screen.dart';
import '../screens/money/money_screen.dart';
import '../screens/kyc/kyc_screen.dart';
import '../screens/security/two_factor_screen.dart';
import '../screens/products/products_screen.dart';
import '../screens/products/collections_screen.dart';
import '../screens/store_health/store_health_screen.dart';
import '../screens/subscription/pricing_screen.dart';
import '../screens/subscription/connect_razorpay_screen.dart';
import 'auth_wrapper.dart';

enum AppRouteId {
  auth,
  splash,
  login,
  otp,
  turnstileChallenge,
  error,
  onboarding,
  createStore,
  storePublished,
  main,
  upgrade,
  livePreview,
  domainSettings,
  seoSettings,
  storeDetails,
  storeHealth,
  notifications,
  staff,
  billing,
  reviews,
  leads,
  emailCampaigns,
  apps,
  ai,
  shipping,
  taxes,
  localizationMarkets,
  customData,
  help,
  analytics,
  customers,
  customerDetail,
  coupons,
  couponForm,
  giftCards,
  pages,
  blog,
  navigation,
  media,
  inventory,
  inventoryLocations,
  inventorySuppliers,
  purchaseOrders,
  inventoryTransfers,
  collections,
  products,
  orders,
  orderDetail,
  returns,
  money,
  kyc,
  twoFactor,
  pricing,
  connectRazorpay,
  featureOrderDetail,
  featureCustomers,
  featureInventory,
  featureInventoryLocations,
  featureInventorySuppliers,
  featurePurchaseOrders,
  featureInventoryTransfers,
  featureCoupons,
  featureGiftCards,
  featureCollections,
  featurePages,
  featureBlog,
  featureNavigation,
  featureMedia,
  featureNotifications,
  featureUsers,
  featureBilling,
  featureReviews,
  featureFormSubmissions,
  featureEmailCampaigns,
  featureAppMarketplace,
  featureEmbeddedAppBridge,
  featureAi,
  featureShipping,
  featureReturns,
  featurePayoutsSettlement,
  featureWallet,
  featureCommission,
  featureKyc,
  featureTwoFactor,
  featureBusiness,
  featureBusinessDetails,
  featureTaxes,
  featureLocalization,
  featureLocalizationMarkets,
  featureCustomData,
}

typedef AppRouteWidgetBuilder = Widget Function(RouteSettings settings);

class MobileDeepLinkTarget {
  const MobileDeepLinkTarget(this.routeName, {this.arguments = const {}});

  final String routeName;
  final Map<String, Object?> arguments;
}

class AppRouteSpec {
  const AppRouteSpec({
    required this.id,
    required this.path,
    required this.builder,
    this.fast = false,
  });

  final AppRouteId id;
  final String path;
  final AppRouteWidgetBuilder builder;
  final bool fast;
}

/// App route definitions
class AppRoutes {
  // Auth routes
  static const String auth = '/'; // Auth wrapper is root route for mobile
  static const String splash = '/splash';
  static const String login = '/login';
  static const String otp = '/otp';
  static const String turnstileChallenge = '/turnstile-challenge';
  static const String error = '/error';

  // Wizard routes
  static const String createStore = '/create-store';
  static const String wizard = '/create-store'; // Alias
  static const String storePublished = '/store-published';

  // Auth flow routes
  static const String setPassword = '/set-password';
  static const String onboarding = '/onboarding';
  // Note: onboarding route kept for backwards compatibility - redirects to wizard

  // Main app routes
  static const String main = '/main';
  static const String upgrade = '/upgrade';

  // New supporting routes
  static const String livePreview = '/live-preview';
  static const String domainSettings = '/domain-settings';
  static const String seoSettings = '/seo-settings';
  static const String storeDetails = '/store-details';
  static const String storeHealth = '/store-health';
  static const String notifications = '/notifications';
  static const String staff = '/staff';
  static const String billing = '/billing';
  static const String reviews = '/reviews';
  static const String leads = '/leads';
  static const String emailCampaigns = '/email-campaigns';
  static const String apps = '/apps';
  static const String ai = '/ai';
  static const String shipping = '/shipping';
  static const String taxes = '/taxes';
  static const String localizationMarkets = '/localization-markets';
  static const String customData = '/custom-data';
  static const String help = '/help';
  static const String analytics = '/analytics';
  static const String customers = '/customers';
  static const String customerDetail = '/customers/detail';
  static const String coupons = '/coupons';
  static const String couponForm = '/coupons/form';
  static const String giftCards = '/gift-cards';
  static const String pages = '/pages';
  static const String blog = '/blog';
  static const String navigation = '/navigation';
  static const String media = '/media';
  static const String inventory = '/inventory';
  static const String inventoryLocations = '/inventory/locations';
  static const String inventorySuppliers = '/inventory/suppliers';
  static const String purchaseOrders = '/inventory/purchase-orders';
  static const String inventoryTransfers = '/inventory/transfers';
  static const String collections = '/collections';
  static const String products = '/products';
  static const String orders = '/orders';
  static const String orderDetail = '/orders/detail';
  static const String returns = '/returns';
  static const String money = '/money';
  static const String kyc = '/kyc';
  static const String twoFactor = '/two-factor';
  static const String pricing = '/pricing';
  static const String connectRazorpay = '/connect-razorpay';

  static MobileDeepLinkTarget? resolveDeepLink(Uri uri) {
    final segments = uri.pathSegments;
    if (segments.length >= 2 && segments.first == 'orders') {
      return MobileDeepLinkTarget(
        orderDetail,
        arguments: {'orderId': segments[1]},
      );
    }
    if (segments.isNotEmpty && segments.first == 'payment-return') {
      return MobileDeepLinkTarget(
        pricing,
        arguments: Map<String, Object?>.from(uri.queryParameters),
      );
    }
    if (segments.length >= 2 && segments.first == 'share') {
      return MobileDeepLinkTarget(
        livePreview,
        arguments: {
          'storeId': segments[1],
          'storeUrl': uri.queryParameters['url'] ?? '',
          'storeName': uri.queryParameters['name'] ?? 'Store',
        },
      );
    }
    return null;
  }

  static final List<AppRouteSpec> _primaryRouteSpecs = [
    AppRouteSpec(
      id: AppRouteId.auth,
      path: auth,
      builder: (_) => const AuthWrapper(),
      fast: true,
    ),
    AppRouteSpec(
      id: AppRouteId.splash,
      path: splash,
      builder: (_) => const SplashScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.login,
      path: login,
      builder: (_) => const LoginScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.otp,
      path: otp,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        return OtpScreen(
          email: args['email'] as String? ?? '',
          password: args['password'] as String? ?? '',
          name: args['name'] as String?,
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.turnstileChallenge,
      path: turnstileChallenge,
      builder: (_) => const TurnstileChallengeScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.error,
      path: error,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>?;
        return ErrorScreen(
          title: args?['title'] ?? 'Error',
          message: args?['message'] ?? 'Something went wrong',
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.onboarding,
      path: onboarding,
      builder: (_) => const CreateStoreWizard(),
    ),
    AppRouteSpec(
      id: AppRouteId.createStore,
      path: createStore,
      builder: (_) => const CreateStoreWizard(),
    ),
    AppRouteSpec(
      id: AppRouteId.storePublished,
      path: storePublished,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>?;
        return StorePublishedScreen(
          storeId: args?['storeId'] ?? '',
          storeName: args?['storeName'] ?? '',
          subdomain: args?['subdomain'] ?? '',
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.main,
      path: main,
      builder: (_) => const StoreMainScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.upgrade,
      path: upgrade,
      builder: (_) => const UpgradeScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.livePreview,
      path: livePreview,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>?;
        return LivePreviewScreen(
          storeUrl: args?['storeUrl'] ?? '',
          storeName: args?['storeName'] ?? 'Store',
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.domainSettings,
      path: domainSettings,
      builder: (_) => const DomainSettingsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.seoSettings,
      path: seoSettings,
      builder: (_) => const SEOSettingsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.storeDetails,
      path: storeDetails,
      builder: (_) => const StoreDetailsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.storeHealth,
      path: storeHealth,
      builder: (_) => const StoreHealthScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.notifications,
      path: notifications,
      builder: (_) => const NotificationsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.staff,
      path: staff,
      builder: (_) => const StaffScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.billing,
      path: billing,
      builder: (_) => const BillingScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.reviews,
      path: reviews,
      builder: (_) => const ReviewsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.leads,
      path: leads,
      builder: (_) => const LeadsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.emailCampaigns,
      path: emailCampaigns,
      builder: (_) => const EmailCampaignsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.apps,
      path: apps,
      builder: (_) => const AppsScreen(),
    ),
    AppRouteSpec(id: AppRouteId.ai, path: ai, builder: (_) => const AiScreen()),
    AppRouteSpec(
      id: AppRouteId.shipping,
      path: shipping,
      builder: (_) => const ShippingScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.taxes,
      path: taxes,
      builder: (_) => const TaxesScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.localizationMarkets,
      path: localizationMarkets,
      builder: (_) => const LocalizationMarketsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.customData,
      path: customData,
      builder: (_) => const CustomDataScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.help,
      path: help,
      builder: (_) => const HelpScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.analytics,
      path: analytics,
      builder: (_) => const AnalyticsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.customers,
      path: customers,
      builder: (_) => const CustomersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.customerDetail,
      path: customerDetail,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final customer = args['customer'];
        return CustomerDetailScreen(
          email: args['email'] as String? ?? '',
          initialCustomer: customer is CustomerContract ? customer : null,
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.coupons,
      path: coupons,
      builder: (_) => const CouponsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.couponForm,
      path: couponForm,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final coupon = args['coupon'];
        return CouponFormScreen(
          storeId: args['storeId'] as String? ?? '',
          coupon: coupon is CouponContract ? coupon : null,
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.giftCards,
      path: giftCards,
      builder: (_) => const GiftCardsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.pages,
      path: pages,
      builder: (_) => const PagesScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.blog,
      path: blog,
      builder: (_) => const BlogScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.navigation,
      path: navigation,
      builder: (_) => const NavigationScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.media,
      path: media,
      builder: (_) => const MediaLibraryScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.inventory,
      path: inventory,
      builder: (_) => const InventoryScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.inventoryLocations,
      path: inventoryLocations,
      builder: (_) => const InventoryLocationsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.inventorySuppliers,
      path: inventorySuppliers,
      builder: (_) => const InventorySuppliersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.purchaseOrders,
      path: purchaseOrders,
      builder: (_) => const PurchaseOrdersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.inventoryTransfers,
      path: inventoryTransfers,
      builder: (_) => const InventoryTransfersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.collections,
      path: collections,
      builder: (_) => const CollectionsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.products,
      path: products,
      builder: (_) => const ProductsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.orders,
      path: orders,
      builder: (_) => const OrdersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.orderDetail,
      path: orderDetail,
      builder: (settings) {
        final args = settings.arguments as Map<String, dynamic>? ?? {};
        final order = args['order'];
        return OrderDetailScreen(
          orderId: args['orderId'] as String? ?? '',
          initialOrder: order is OrderContract ? order : null,
        );
      },
    ),
    AppRouteSpec(
      id: AppRouteId.returns,
      path: returns,
      builder: (_) => const ReturnsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.money,
      path: money,
      builder: (_) => const MoneyScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.kyc,
      path: kyc,
      builder: (_) => const KycScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.twoFactor,
      path: twoFactor,
      builder: (_) => const TwoFactorScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.pricing,
      path: pricing,
      builder: (_) => const PricingScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.connectRazorpay,
      path: connectRazorpay,
      builder: (_) => const ConnectRazorpayScreen(),
    ),
  ];

  static final List<AppRouteSpec> _featureRouteSpecs = [
    AppRouteSpec(
      id: AppRouteId.featureOrderDetail,
      path: '/features/order-detail',
      builder: (_) => const OrdersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureCustomers,
      path: '/features/customers',
      builder: (_) => const CustomersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureInventory,
      path: '/features/inventory',
      builder: (_) => const InventoryScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureInventoryLocations,
      path: '/features/inventory-locations',
      builder: (_) => const InventoryLocationsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureInventorySuppliers,
      path: '/features/inventory-suppliers',
      builder: (_) => const InventorySuppliersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featurePurchaseOrders,
      path: '/features/purchase-orders',
      builder: (_) => const PurchaseOrdersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureInventoryTransfers,
      path: '/features/inventory-transfers',
      builder: (_) => const InventoryTransfersScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureCoupons,
      path: '/features/coupons',
      builder: (_) => const CouponsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureGiftCards,
      path: '/features/gift-cards',
      builder: (_) => const GiftCardsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureCollections,
      path: '/features/collections',
      builder: (_) => const CollectionsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featurePages,
      path: '/features/pages',
      builder: (_) => const PagesScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureBlog,
      path: '/features/blog',
      builder: (_) => const BlogScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureNavigation,
      path: '/features/navigation',
      builder: (_) => const NavigationScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureMedia,
      path: '/features/media',
      builder: (_) => const MediaLibraryScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureNotifications,
      path: '/features/notifications',
      builder: (_) => const NotificationsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureUsers,
      path: '/features/users',
      builder: (_) => const StaffScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureBilling,
      path: '/features/billing',
      builder: (_) => const BillingScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureReviews,
      path: '/features/reviews',
      builder: (_) => const ReviewsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureFormSubmissions,
      path: '/features/form-submissions',
      builder: (_) => const LeadsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureEmailCampaigns,
      path: '/features/email-campaigns',
      builder: (_) => const EmailCampaignsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureAppMarketplace,
      path: '/features/app-marketplace',
      builder: (_) => const AppsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureEmbeddedAppBridge,
      path: '/features/embedded-app-bridge',
      builder: (_) => const AppsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureAi,
      path: '/features/ai',
      builder: (_) => const AiScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureShipping,
      path: '/features/shipping',
      builder: (_) => const ShippingScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureReturns,
      path: '/features/returns',
      builder: (_) => const ReturnsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featurePayoutsSettlement,
      path: '/features/payouts-settlement',
      builder: (_) => const MoneyScreen(initialTab: 0),
    ),
    AppRouteSpec(
      id: AppRouteId.featureWallet,
      path: '/features/wallet',
      builder: (_) => const MoneyScreen(initialTab: 1),
    ),
    AppRouteSpec(
      id: AppRouteId.featureCommission,
      path: '/features/commission',
      builder: (_) => const MoneyScreen(initialTab: 2),
    ),
    AppRouteSpec(
      id: AppRouteId.featureKyc,
      path: '/features/kyc',
      builder: (_) => const KycScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureTwoFactor,
      path: '/features/two-factor',
      builder: (_) => const TwoFactorScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureBusiness,
      path: '/features/business',
      builder: (_) => const StoreDetailsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureBusinessDetails,
      path: '/features/business-details',
      builder: (_) => const StoreDetailsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureTaxes,
      path: '/features/taxes',
      builder: (_) => const TaxesScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureLocalization,
      path: '/features/localization',
      builder: (_) => const LocalizationMarketsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureLocalizationMarkets,
      path: '/features/localization-markets',
      builder: (_) => const LocalizationMarketsScreen(),
    ),
    AppRouteSpec(
      id: AppRouteId.featureCustomData,
      path: '/features/custom-data',
      builder: (_) => const CustomDataScreen(),
    ),
  ];

  static final List<AppRouteSpec> allRoutes = List.unmodifiable([
    ..._primaryRouteSpecs,
    ..._featureRouteSpecs,
  ]);

  static final Map<String, AppRouteSpec> _routesByPath = {
    for (final route in allRoutes) route.path: route,
  };

  static final Map<AppRouteId, AppRouteSpec> _routesById = {
    for (final route in allRoutes) route.id: route,
  };

  static AppRouteSpec? routeFor(String? path) {
    if (path == null) return null;
    return _routesByPath[path];
  }

  static String pathFor(AppRouteId id) => _routesById[id]!.path;

  static bool isKnownRoute(String? path) {
    if (path == null) return false;
    return _routesByPath.containsKey(path);
  }

  /// Generate routes with optimized page transitions
  static Route<dynamic> generateRoute(RouteSettings settings) {
    final spec = routeFor(settings.name);
    if (spec != null) {
      return _buildConfiguredRoute(spec, settings);
    }

    return _buildRoute(
      Scaffold(body: Center(child: Text("Route not found: ${settings.name}"))),
      settings,
    );
  }

  static Route<dynamic> routeForId(AppRouteId id, {Object? arguments}) {
    return generateRoute(
      RouteSettings(name: pathFor(id), arguments: arguments),
    );
  }

  static Route<dynamic> _buildConfiguredRoute(
    AppRouteSpec spec,
    RouteSettings settings,
  ) {
    final page = spec.builder(settings);
    return spec.fast
        ? _buildFastRoute(page, settings)
        : _buildRoute(page, settings);
  }

  /// Fast route for root auth wrapper - no animation delay
  static PageRoute _buildFastRoute(Widget page, RouteSettings settings) {
    return PageRouteBuilder(
      settings: settings,
      pageBuilder: (_, __, ___) => page,
      transitionDuration: Duration.zero,
      reverseTransitionDuration: Duration.zero,
    );
  }

  /// Standard route with smooth animation
  static MaterialPageRoute _buildRoute(Widget page, RouteSettings settings) {
    return MaterialPageRoute(builder: (_) => page, settings: settings);
  }
}
