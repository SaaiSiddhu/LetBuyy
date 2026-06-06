import 'package:flutter/material.dart';

class MerchantFeatureDefinition {
  final String id;
  final String route;
  final String group;
  final String title;
  final String summary;
  final IconData icon;
  final String? endpoint;
  final bool requiresStore;
  final Map<String, String> query;
  final List<String> titleKeys;
  final List<String> subtitleKeys;
  final String backendRequirement;

  const MerchantFeatureDefinition({
    required this.id,
    required this.route,
    required this.group,
    required this.title,
    required this.summary,
    required this.icon,
    required this.backendRequirement,
    this.endpoint,
    this.requiresStore = true,
    this.query = const {},
    this.titleKeys = const ['name', 'title', 'code', 'email', 'id'],
    this.subtitleKeys = const ['status', 'type', 'category', 'created_at'],
  });

  bool get hasEndpoint => endpoint != null && endpoint!.isNotEmpty;
}

class MerchantFeatureDefinitions {
  MerchantFeatureDefinitions._();

  static const commerce = [
    customers,
    collections,
    inventory,
    inventoryLocations,
    inventorySuppliers,
    purchaseOrders,
    inventoryTransfers,
    coupons,
    giftCards,
    reviews,
    orderDetail,
  ];

  static const onlineStore = [themeMarketplace, pages, blog, navigation, media];

  static const apps = [appMarketplace];

  static const settingsHub = [
    checkout,
    shipping,
    taxes,
    notifications,
    users,
    policies,
    payments,
    billing,
    business,
    localization,
    security,
  ];

  static const other = [formSubmissions, analytics];

  static const all = [
    ...commerce,
    ...onlineStore,
    ...apps,
    ...settingsHub,
    ...other,
  ];

  static final byRoute = {for (final feature in all) feature.route: feature};

  static const customers = MerchantFeatureDefinition(
    id: 'customers',
    route: '/features/customers',
    group: 'Commerce',
    title: 'Customers',
    summary: 'Customer profiles, contact details, order history, and tags.',
    icon: Icons.people_alt_outlined,
    endpoint: 'customers',
    backendRequirement:
        'Requires protected /v1/customers access for the mobile merchant session.',
    titleKeys: ['email', 'name', 'full_name', 'id'],
    subtitleKeys: ['orders_count', 'total_spent', 'created_at'],
  );

  static const collections = MerchantFeatureDefinition(
    id: 'collections',
    route: '/features/collections',
    group: 'Commerce',
    title: 'Collections',
    summary: 'Product collections and category merchandising.',
    icon: Icons.category_outlined,
    endpoint: 'products/collections',
    backendRequirement:
        'Requires /v1/products/collections rows for the active store.',
  );

  static const inventory = MerchantFeatureDefinition(
    id: 'inventory',
    route: '/features/inventory',
    group: 'Commerce',
    title: 'Inventory',
    summary: 'Stock levels, locations, transfers, and adjustments.',
    icon: Icons.warehouse_outlined,
    endpoint: 'inventory/levels',
    backendRequirement:
        'Requires /v1/inventory/levels data for the active store.',
    titleKeys: ['sku', 'product_name', 'variant_id', 'id'],
    subtitleKeys: ['available', 'reserved', 'location_id'],
  );

  static const inventoryLocations = MerchantFeatureDefinition(
    id: 'inventory-locations',
    route: '/features/inventory-locations',
    group: 'Commerce',
    title: 'Inventory Locations',
    summary: 'Warehouses, stores, and fulfillment points.',
    icon: Icons.warehouse_outlined,
    endpoint: 'inventory/locations',
    backendRequirement:
        'Requires /v1/inventory/locations data for the active store.',
    titleKeys: ['name', 'id'],
    subtitleKeys: ['city', 'state', 'status'],
  );

  static const inventorySuppliers = MerchantFeatureDefinition(
    id: 'inventory-suppliers',
    route: '/features/inventory-suppliers',
    group: 'Commerce',
    title: 'Suppliers',
    summary: 'Vendor contacts used for replenishment workflows.',
    icon: Icons.handshake_outlined,
    endpoint: 'inventory/suppliers',
    backendRequirement:
        'Requires /v1/inventory/suppliers data for the active store.',
    titleKeys: ['name', 'contact_name', 'id'],
    subtitleKeys: ['email', 'phone', 'created_at'],
  );

  static const purchaseOrders = MerchantFeatureDefinition(
    id: 'purchase-orders',
    route: '/features/purchase-orders',
    group: 'Commerce',
    title: 'Purchase Orders',
    summary: 'Inbound supplier orders and receiving workflow.',
    icon: Icons.add_box_outlined,
    endpoint: 'inventory/purchase-orders',
    backendRequirement:
        'Requires /v1/inventory/purchase-orders data for the active store.',
    titleKeys: ['id', 'status', 'supplier_id'],
    subtitleKeys: ['status', 'location_id', 'expected_at'],
  );

  static const inventoryTransfers = MerchantFeatureDefinition(
    id: 'inventory-transfers',
    route: '/features/inventory-transfers',
    group: 'Commerce',
    title: 'Transfers',
    summary: 'Move stock between inventory locations.',
    icon: Icons.swap_horiz_outlined,
    endpoint: 'inventory/transfers',
    backendRequirement:
        'Requires /v1/inventory/transfers data for the active store.',
    titleKeys: ['id', 'status'],
    subtitleKeys: ['source_location_id', 'destination_location_id', 'status'],
  );

  static const coupons = MerchantFeatureDefinition(
    id: 'coupons',
    route: '/features/coupons',
    group: 'Commerce',
    title: 'Coupons',
    summary: 'Discount codes, eligibility, and active campaigns.',
    icon: Icons.local_offer_outlined,
    endpoint: 'coupons',
    backendRequirement: 'Requires /v1/coupons rows for the active store.',
    titleKeys: ['code', 'name', 'id'],
    subtitleKeys: ['discount_type', 'status', 'expires_at'],
  );

  static const giftCards = MerchantFeatureDefinition(
    id: 'gift-cards',
    route: '/features/gift-cards',
    group: 'Commerce',
    title: 'Gift Cards',
    summary: 'Gift card balances, issuance, redemption, and expiry.',
    icon: Icons.card_giftcard_outlined,
    backendRequirement: 'No governed /v1 gift-card endpoint is present yet.',
  );

  static const reviews = MerchantFeatureDefinition(
    id: 'reviews',
    route: '/features/reviews',
    group: 'Commerce',
    title: 'Reviews',
    summary: 'Product review moderation and merchant replies.',
    icon: Icons.rate_review_outlined,
    endpoint: 'reviews',
    backendRequirement: 'Requires /v1/reviews rows for the active store.',
    titleKeys: ['title', 'customer_name', 'product_name', 'id'],
    subtitleKeys: ['rating', 'status', 'created_at'],
  );

  static const orderDetail = MerchantFeatureDefinition(
    id: 'order-detail',
    route: '/features/order-detail',
    group: 'Commerce',
    title: 'Order Detail',
    summary: 'Order timeline, fulfillment, refund, and payment state.',
    icon: Icons.receipt_long_outlined,
    endpoint: 'orders',
    backendRequirement:
        'Requires a protected /v1/orders list/detail session and seeded order rows.',
    titleKeys: ['order_number', 'id', 'customer_email'],
    subtitleKeys: ['status', 'payment_status', 'created_at'],
  );

  static const themeMarketplace = MerchantFeatureDefinition(
    id: 'theme-marketplace',
    route: '/features/theme-marketplace',
    group: 'Online Store',
    title: 'Theme Marketplace',
    summary: 'Browse, install, and preview marketplace themes.',
    icon: Icons.storefront_outlined,
    endpoint: 'themes',
    backendRequirement:
        'Requires /v1/themes catalog rows and protected install access for store-scoped state.',
    requiresStore: false,
    titleKeys: ['name', 'slug', 'id'],
    subtitleKeys: ['category', 'letbuyy_pricing_type', 'status'],
  );

  static const pages = MerchantFeatureDefinition(
    id: 'pages',
    route: '/features/pages',
    group: 'Online Store',
    title: 'Pages',
    summary: 'CMS pages and storefront content publishing.',
    icon: Icons.article_outlined,
    endpoint: 'pages',
    backendRequirement: 'Requires /v1/pages rows for the active store.',
  );

  static const blog = MerchantFeatureDefinition(
    id: 'blog',
    route: '/features/blog',
    group: 'Online Store',
    title: 'Blog',
    summary: 'Blog posts, categories, tags, and comments.',
    icon: Icons.edit_note_outlined,
    endpoint: 'blog/posts',
    backendRequirement: 'Requires /v1/blog/posts rows for the active store.',
  );

  static const navigation = MerchantFeatureDefinition(
    id: 'navigation',
    route: '/features/navigation',
    group: 'Online Store',
    title: 'Navigation Menus',
    summary: 'Header, footer, and storefront menu locations.',
    icon: Icons.account_tree_outlined,
    endpoint: 'pages/navigation',
    backendRequirement:
        'Requires /v1/pages/navigation rows for the active store.',
    titleKeys: ['location', 'label', 'name', 'id'],
    subtitleKeys: ['items_count', 'updated_at', 'created_at'],
  );

  static const media = MerchantFeatureDefinition(
    id: 'media',
    route: '/features/media',
    group: 'Online Store',
    title: 'Media',
    summary: 'Images, files, alt text, and storefront media usage.',
    icon: Icons.perm_media_outlined,
    endpoint: 'media',
    backendRequirement: 'Requires /v1/media rows for the active store.',
    titleKeys: ['filename', 'name', 'alt_text', 'id'],
    subtitleKeys: ['mime_type', 'size', 'created_at'],
  );

  static const appMarketplace = MerchantFeatureDefinition(
    id: 'app-marketplace',
    route: '/features/app-marketplace',
    group: 'Apps',
    title: 'App Marketplace',
    summary: 'Browse apps, review scopes, and install extensions.',
    icon: Icons.extension_outlined,
    endpoint: 'app-store/apps',
    backendRequirement:
        'Requires /v1/app-store/apps catalog rows and protected install/session access.',
    requiresStore: false,
    titleKeys: ['name', 'slug', 'id'],
    subtitleKeys: ['category', 'pricing_type', 'developer_name'],
  );

  static const checkout = MerchantFeatureDefinition(
    id: 'checkout',
    route: '/features/checkout',
    group: 'Settings',
    title: 'Checkout',
    summary: 'Checkout options, branding, customer data, and payment behavior.',
    icon: Icons.shopping_bag_outlined,
    backendRequirement:
        'No dedicated mobile-safe /v1 checkout settings contract is present yet.',
  );

  static const shipping = MerchantFeatureDefinition(
    id: 'shipping',
    route: '/features/shipping',
    group: 'Settings',
    title: 'Shipping',
    summary: 'Shipping zones, rates, delivery rules, and profiles.',
    icon: Icons.local_shipping_outlined,
    endpoint: 'shipping-tax/shipping/zones',
    backendRequirement:
        'Requires /v1/shipping-tax/shipping/zones rows for the active store.',
  );

  static const taxes = MerchantFeatureDefinition(
    id: 'taxes',
    route: '/features/taxes',
    group: 'Settings',
    title: 'Taxes / GST',
    summary: 'GST rates, HSN mapping, tax-inclusive pricing, and duties.',
    icon: Icons.request_quote_outlined,
    endpoint: 'shipping-tax/taxes',
    backendRequirement:
        'Requires /v1/shipping-tax/taxes rows plus product tax metadata for full parity.',
  );

  static const notifications = MerchantFeatureDefinition(
    id: 'notifications',
    route: '/features/notifications',
    group: 'Settings',
    title: 'Notifications',
    summary: 'Merchant alerts, customer templates, and delivery preferences.',
    icon: Icons.notifications_outlined,
    endpoint: 'notifications/preferences',
    backendRequirement:
        'Requires /v1/notifications/preferences and template/channel contracts.',
  );

  static const users = MerchantFeatureDefinition(
    id: 'users',
    route: '/features/users',
    group: 'Settings',
    title: 'Users & Permissions',
    summary: 'Staff accounts, roles, invites, and access controls.',
    icon: Icons.manage_accounts_outlined,
    endpoint: 'employees',
    backendRequirement:
        'Requires /v1/employees rows for the active merchant account.',
    titleKeys: ['email', 'name', 'id'],
    subtitleKeys: ['role', 'status', 'created_at'],
  );

  static const policies = MerchantFeatureDefinition(
    id: 'policies',
    route: '/features/policies',
    group: 'Settings',
    title: 'Policies',
    summary: 'Refund, privacy, terms, shipping, and legal policy pages.',
    icon: Icons.policy_outlined,
    endpoint: 'pages/policies',
    backendRequirement:
        'Requires /v1/pages/policies rows for the active store.',
  );

  static const payments = MerchantFeatureDefinition(
    id: 'payments',
    route: '/features/payments',
    group: 'Settings',
    title: 'Payments',
    summary: 'Razorpay, COD, provider status, and payment settings.',
    icon: Icons.payments_outlined,
    endpoint: 'payments/subscription',
    backendRequirement:
        'Requires full /v1/payments configuration contracts beyond subscription status.',
  );

  static const billing = MerchantFeatureDefinition(
    id: 'billing',
    route: '/features/billing',
    group: 'Settings',
    title: 'Plan & Billing',
    summary:
        'Plan catalog, subscription history, invoices, and billing events.',
    icon: Icons.credit_card_outlined,
    endpoint: 'payments/subscription/history',
    backendRequirement:
        'Requires /v1/billing or full payment billing history contracts for mobile parity.',
  );

  static const business = MerchantFeatureDefinition(
    id: 'business',
    route: '/features/business',
    group: 'Settings',
    title: 'Business',
    summary:
        'Legal name, GSTIN, invoice prefix, billing address, and compliance.',
    icon: Icons.business_outlined,
    backendRequirement:
        'Store PATCH does not yet accept full business-detail or billing-address fields.',
  );

  static const localization = MerchantFeatureDefinition(
    id: 'localization',
    route: '/features/localization',
    group: 'Settings',
    title: 'Localization',
    summary: 'Languages, markets, default locale, and storefront translations.',
    icon: Icons.language_outlined,
    backendRequirement:
        'No storefront localization/settings endpoint exists beyond current locale.',
  );

  static const security = MerchantFeatureDefinition(
    id: 'security',
    route: '/features/security',
    group: 'Settings',
    title: 'Security',
    summary:
        '2FA, passkeys, recovery codes, active sessions, and audit history.',
    icon: Icons.security_outlined,
    backendRequirement:
        'No merchant 2FA/passkey/session inventory endpoint exists for mobile yet.',
  );

  static const formSubmissions = MerchantFeatureDefinition(
    id: 'form-submissions',
    route: '/features/form-submissions',
    group: 'Other',
    title: 'Form Submissions',
    summary: 'Storefront leads, contact forms, and follow-up status.',
    icon: Icons.mark_email_read_outlined,
    endpoint: 'form-submissions',
    backendRequirement:
        'Requires /v1/form-submissions rows for the active store.',
  );

  static const analytics = MerchantFeatureDefinition(
    id: 'real-analytics',
    route: '/features/real-analytics',
    group: 'Other',
    title: 'Real Analytics',
    summary: 'Dashboard, revenue, top products, and order analytics from /v1.',
    icon: Icons.insights_outlined,
    endpoint: 'analytics/dashboard',
    backendRequirement:
        'Requires protected /v1/analytics dashboard access for the active store.',
  );
}
