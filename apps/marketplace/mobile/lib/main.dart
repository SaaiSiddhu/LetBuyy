import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

// Internal packages
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

// Canonical gateway wiring (FB-2)
import 'data/canonical_api.dart';
import 'data/marketplace_repository.dart';

// Sign in with LetBuyy (APPID-P4d) — the app's sole sign-in as of Phase 1R
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'auth/buyer_sign_in_controller.dart';
import 'auth/buyer_sign_in_wiring.dart';

// App-specific providers
import 'providers/search_provider.dart';

// Routes
import 'app/routes.dart';

// Screens
import 'screens/main_screen.dart';
import 'screens/web_main_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ✅ Use path-based URLs (no hash #)
  usePathUrlStrategy();

  // Phase 1R (2026-09-26): Firebase is removed entirely — no real marketplace users existed to
  // preserve, and canonical "Sign in with LetBuyy" is now this app's sole entry point (R1.2/R1.3).
  // No Firebase.initializeApp(), no FCM boot, no Firebase analytics.

  // Initialize SharedPreferencesService
  try {
    await SharedPreferencesService.init();
  } catch (e) {
    debugPrint('⚠️ SharedPreferencesService init error: $e');
  }

  // Set preferred orientations (mobile only)
  if (!kIsWeb) {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);
  }

  runApp(const LetBuyyMarketplaceApp());
}

class LetBuyyMarketplaceApp extends StatelessWidget {
  const LetBuyyMarketplaceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // AuthProvider retired (R1 corrective, C2): entirely FirebaseAuth-backed with no
        // canonical successor -- canonical "Sign in with LetBuyy" (BuyerSignInController) is
        // this app's sole sign-in and never touches FirebaseAuth. Its constructor's own
        // FirebaseAuth.instance.currentUser access threw uncaught with no try/catch anywhere in
        // that chain (confirmed empirically; fixed and committed separately as an urgent, standalone
        // safety fix before this deregistration, since cart_screen.dart's auth gate sat in
        // MainScreen's eagerly-built IndexedStack -- a likely guaranteed crash on every app
        // launch, not just one tab). Of its 12 consumers: cart_screen.dart/wishlist_screen.dart's
        // outer gates and auth_gate.dart's AuthGatedWidget/requireAuth all checked the wrong
        // (legacy) auth source and were rewired to canonical BuyerSignInController;
        // edit_profile_screen.dart was rewired onto the canonical BuyerAccountApi (a real
        // successor exists, matching its exact fullName/phone fields); support_chat_screen.dart,
        // support_conversations_screen.dart, return_request_screen.dart and my_returns_screen.dart
        // have no canonical successor yet (downstream of orders/returns/support, none of which
        // have one) and were disconnected to an honest unavailable state, fixing "please login"
        // wording that was actively misleading for a buyer who's genuinely signed in via
        // canonical auth by the time these screens are reached; splash_screen.dart's reference
        // was already fully dead code, left over when auth restoration moved off the splash
        // screen; auth_screen.dart, web_auth_screen.dart, desktop_auth_screen.dart,
        // mobile_auth_screen.dart, auth_bottom_sheet.dart and change_password_screen.dart were
        // all fully orphaned once their legacy entry points were rewired, and deleted outright.

        // Firebase SDK removal pass (27 September 2026 review, finding 5): UserProvider was
        // entirely FirebaseAuth-backed, and grepping every real reader of its own getters/methods
        // anywhere in the app -- `Provider.of<UserProvider>`, `context.read<UserProvider>`,
        // `userProvider.` -- found none. It was registered but never actually consumed by
        // anything; deleted rather than left wired to a dead identity source with zero live
        // callers, the same disposition as every other C2 orphan. providers/auth_provider.dart
        // (AuthProvider, deregistered from this list earlier in C2) was a separate, already fully
        // orphaned file this same pass also deleted.

        // Search provider
        ChangeNotifierProvider(create: (_) => SearchProvider()),

        // NotificationProvider retired (R1 corrective, C2): entirely FirebaseFirestore/FirebaseAuth-
        // backed (userId sourced from FirebaseAuth.instance.currentUser, which canonical "Sign in with
        // LetBuyy" never populates) with no canonical successor. Its one consumer, notification_screen.dart
        // at the '/notifications' route, had zero live navigation anywhere in the app (grepped — no
        // pushNamed, no bell icon); both deleted rather than left wired to a dead identity source.

        // C2 (canonical rewire): the shared canonical gateway client -- built once, registered
        // ahead of every provider below that reads it (ProductProvider, CategoryProvider,
        // MarketplaceRepository), so they all talk to the same connection pool instead of each
        // opening its own.
        Provider<ApiClient>(create: (_) => buildCanonicalApiClient()),

        // Shared providers from services package
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        // ProductProvider/CategoryProvider retired their Firestore-backed DatabaseService path
        // (R1 corrective, C2 REWIRE): both now read the canonical marketplace feed/categories/
        // listing endpoints through this shared ApiClient. See their own doc comments for exactly
        // which fields the canonical gateway does not (yet) carry -- rating, reviews,
        // specifications, shipping estimates, featured/new/trending/verified flags, related
        // products, named variant option labels -- and how each is left at an honest default
        // rather than a fabricated one.
        ChangeNotifierProvider(create: (context) => ProductProvider(client: context.read<ApiClient>())),
        ChangeNotifierProvider(create: (context) => CategoryProvider(client: context.read<ApiClient>())),
        // OrderProvider retired (R1 corrective, C2): entirely FirebaseFirestore-backed with no
        // canonical successor. loadUserOrders() guards on a userId that's always null (same
        // pattern as several other providers this pass), but loadAllOrders()/createOrder()/
        // cancelOrder()/updateOrderStatus()/returnOrder()/loadOrderById() have no such guard, so
        // they genuinely attempted Firestore whenever invoked. orders_screen.dart's Consumer
        // already always rendered its "User not authenticated" error state (loadUserOrders()
        // sets that error even though it never reaches Firestore); order_details_screen.dart's
        // already always rendered its own error state (selectedOrder never populates, and this
        // screen is only ever reached with an orderId, not a full order -- nothing in the app can
        // currently produce one to fetch). order_tracking_screen.dart is architecturally
        // different: it takes a full OrderModel constructor parameter and already fell back to
        // it (`orderProvider.selectedOrder ?? widget.order`), so it renders correctly from that
        // parameter alone -- only the optional timeline enrichment depended on the provider, and
        // that already had a proper "No tracking information yet" empty state. profile_stats.dart
        // and order_history_screen.dart were both already fully orphaned (zero live callers) and
        // deleted outright.
        // AddressProvider retired (R1 corrective, C2): entirely FirebaseFirestore-backed via the
        // legacy AuthService/DatabaseService, with no canonical successor wired into its three
        // consumers (web_header.dart's and shop_app_bar.dart's header pills, saved_addresses_screen.dart).
        // Its own read path never populated addresses (canonical sign-in never touches FirebaseAuth,
        // so its userId guard always short-circuited), so all three already rendered exactly the
        // empty/default state they now render unconditionally, without the provider in the tree.

        // ✅ ADDED: Missing providers
        // BannerProvider retired (Phase 1R, R1.3): it was entirely FirebaseFirestore/FirebaseStorage,
        // with no canonical successor. banner_carousel_section.dart now renders a static placeholder.
        // SponsoredBannerProvider retired (R1 corrective, C2): its one consumer, sponsored_banner.dart,
        // now renders SizedBox.shrink() unconditionally (matching its own prior empty state) instead of
        // opening a FirebaseFirestore realtime listener with no canonical successor.
        // CouponProvider retired (R1 corrective, C2): entirely FirebaseFirestore-backed with no
        // canonical successor. Its methods had no userId guard (unlike LoyaltyProvider, kept
        // registered), so they genuinely attempted Firestore queries whenever invoked --
        // product_details_screen.dart called fetchAvailableCoupons() unconditionally on every
        // view. Deeply embedded across checkout_screen.dart, payment_method_screen.dart (4 sites,
        // including two order-placement code paths already unreachable since they sit behind an
        // always-null safeFirebaseUserId()/safeFirebaseCurrentUser() guard), mobile_cart_screen.dart
        // and web_cart_screen.dart (both via Consumer2<CartProvider, CouponProvider> wrapping the
        // whole screen body), cart_summary.dart and coupon_selection_screen.dart (deleted outright,
        // fully orphaned once its one opener was removed). Coupons could never actually load or
        // apply in any of these (appliedCoupon/calculateDiscount already always resolved to
        // null/0), so every fix computes that same already-true value directly or drops the
        // now-nonfunctional "Apply Coupon" affordance, never a behavior change.
        // ReviewProvider retired (R1 corrective, C2): entirely FirebaseFirestore-backed with no
        // canonical successor. getReviewsStream() built a raw Firestore stream directly and
        // unguarded in reviews_section.dart's build() -- a real crash risk on product_details_
        // screen.dart, the app's most-visited screen -- and loadReviewStats() left its stats
        // section spinning forever with nothing to populate it. Both consumers (reviews_section.dart,
        // rate_your_purchases_section.dart) already reduced to their honest always-empty state;
        // review_card.dart deleted outright (its only caller, the reviews list, is gone).
        // AppUpdateProvider retired (R1 corrective, C2): its two consumers, the '/downloads' route's
        // DownloadScreen and MandatoryUpdateDialog, had zero live navigation/construction anywhere in
        // the active app (grepped) — "Legacy compatibility" per the route's own comment — so both were
        // deleted along with the dead route, rather than left wired to a Firebase-backed provider.

        // MarketplaceAdProvider retired (R1 corrective, C2): entirely Firestore-backed
        // (ad_campaigns/ad_products/products collections) with no canonical successor. Its
        // consumers in product_card.dart/compact_product_card.dart already guard their
        // Provider.of<MarketplaceAdProvider> lookups in try/catch (isSponsored -> false,
        // click tracking -> no-op), so deregistering is safe there; category_screen.dart's
        // and mobile_shop_screen.dart's ad-merge/loading paths were removed outright, since
        // both called it unconditionally on every render/initState (a real crash risk once
        // deregistered, not just dead weight); sponsored_products_section.dart and
        // sponsored_products_banner.dart (on product_details_screen.dart, the app's most-
        // visited screen) built raw unguarded FirebaseFirestore streams directly and were
        // replaced with an honest empty state.

        // ✅ ADDED: Loyalty Points provider
        ChangeNotifierProvider(create: (_) => LoyaltyProvider()),

        // Firebase SDK removal pass (27 September 2026 review, finding 5): AuthService/
        // DatabaseService were registered "for reviews," but ReviewProvider itself (Firestore-
        // backed, no canonical successor) was already retired in C2 -- and this same pass found
        // and removed the one remaining live consumer, reviews_section.dart's still-wired "Add/
        // Edit Review" button (see that file's own doc comment). Grepped every real (non-comment)
        // reference to either type anywhere in the app: none left outside this registration and
        // one already-dead, unreachable direct construction in payment_method_screen.dart's
        // _createOrder (throws before reaching it; that file's own comment already explains why).
        // Removed rather than left registered with nothing to serve.

        // FB-2: the canonical marketplace read path. Screens depend on the interface, never on
        // ApiMarketplaceRepository or on an ApiClient directly, so the backend behind a screen is
        // one decision here rather than a per-file import. Shares the ApiClient registered above.
        Provider<MarketplaceRepository>(
          create: (context) => buildMarketplaceRepository(client: context.read<ApiClient>()),
        ),

        // APPID-P4d: "Sign in with LetBuyy" — Phase 1R made this the app's sole sign-in (no Firebase
        // fallback), so it is always provided; AppConfig.buyerSignInEnabled stays a documented
        // --dart-define override, never a condition on the controller's own presence, since
        // profile_screen.dart and others now read it unconditionally.
        // Not lazy, so a sign-in callback that arrived while the app was stopped is collected at launch.
        ChangeNotifierProvider<BuyerSignInController>(
          create: (_) => buildBuyerSignInController()..start(),
          lazy: false,
        ),

        // D-BUYER-SCOPE (27 September 2026 review continuation): Cart/WishlistProvider each keep
        // a separate local namespace per canonical buyer ID (never per session token or email --
        // see CartProvider.updateUserId's own doc comment), plus one separate shared guest
        // namespace, switched by BuyerSignInController.buyerId. ChangeNotifierProxyProvider keeps
        // the SAME provider instance across a sign-in/sign-out/account-switch notification
        // (mutating it in place via `previous!..updateUserId(...)`), so every existing widget that
        // already holds or watches a CartProvider/WishlistProvider reference keeps working
        // unchanged -- only the data underneath switches. Must be registered after
        // BuyerSignInController: Provider resolves an ancestor by its position in this list.
        ChangeNotifierProxyProvider<BuyerSignInController, CartProvider>(
          create: (_) => CartProvider(),
          update: (_, auth, previous) => (previous ?? CartProvider())..updateUserId(auth.buyerId),
        ),
        ChangeNotifierProxyProvider<BuyerSignInController, WishlistProvider>(
          create: (_) => WishlistProvider(),
          update: (_, auth, previous) => (previous ?? WishlistProvider())..updateUserId(auth.buyerId),
        ),

        // SUSTAINED-L: the buyer's canonical cross-store profile and address book, reachable once
        // signed in with LetBuyy. Lazy (unlike the controller above): nothing needs them before a
        // screen asks.
        Provider<BuyerAccountApi>(create: (_) => buildBuyerAccountApi()),
        Provider<BuyerAddressApi>(create: (_) => buildBuyerAddressApi()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'LetBuyy',
            debugShowCheckedModeBanner: false,
            
            // Theme
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            
            // ✅ Native splash screen is enough - go directly to main
            // The native splash shows during Flutter engine initialization
            home: kIsWeb 
                ? const WebMainScreen(initialIndex: 0) 
                : const MainScreen(initialIndex: 0),
            onGenerateRoute: AppRoutes.onGenerateRoute,
          );
        },
      ),
    );
  }
}
