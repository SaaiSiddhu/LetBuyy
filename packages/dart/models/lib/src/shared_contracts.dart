typedef JsonMap = Map<String, dynamic>;

class ContractFieldSets {
  const ContractFieldSets._();

  static const timestamped = <String>[
    'id',
    'created_at',
    'updated_at',
    'deleted_at',
  ];

  static const audited = <String>[
    ...timestamped,
    'created_by',
    'updated_by',
    'deleted_by',
  ];
}

abstract class SharedTypeContract {
  final JsonMap _json;

  SharedTypeContract(JsonMap json)
    : _json = Map<String, dynamic>.unmodifiable(json);

  JsonMap toJson() => Map<String, dynamic>.from(_json);

  dynamic operator [](String key) => _json[key];

  String stringValue(String key, {String fallback = ''}) {
    final value = _json[key];
    return value?.toString() ?? fallback;
  }

  String? optionalString(String key) {
    final value = _json[key];
    return value?.toString();
  }

  bool boolValue(String key, {bool fallback = false}) {
    final value = _json[key];
    return value is bool ? value : fallback;
  }

  int intValue(String key, {int fallback = 0}) {
    final value = _json[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? fallback;
  }

  double numberValue(String key, {double fallback = 0}) {
    final value = _json[key];
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? fallback;
  }

  List<String> stringList(String key) {
    final value = _json[key];
    if (value is List) return value.map((item) => item.toString()).toList();
    return const [];
  }

  JsonMap jsonMap(String key) {
    final value = _json[key];
    if (value is Map<String, dynamic>) return Map<String, dynamic>.from(value);
    if (value is Map) return Map<String, dynamic>.from(value);
    return const {};
  }

  List<T> contractList<T>(String key, T Function(JsonMap json) parse) {
    final value = _json[key];
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((item) => parse(Map<String, dynamic>.from(item)))
        .toList();
  }
}

class AddressContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'name',
    'line1',
    'line2',
    'city',
    'state',
    'state_code',
    'postal_code',
    'country',
    'phone',
    'gstin',
  ];

  AddressContract(super.json);

  factory AddressContract.fromJson(JsonMap json) => AddressContract(json);

  String get name => stringValue('name');
  String get line1 => stringValue('line1');
  String? get line2 => optionalString('line2');
  String get city => stringValue('city');
  String get state => stringValue('state');
  String? get stateCode => optionalString('state_code');
  String get postalCode => stringValue('postal_code');
  String get country => stringValue('country', fallback: 'IN');
  String? get phone => optionalString('phone');
  String? get gstin => optionalString('gstin');
}

class CustomerAddressContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'customer_id',
    'full_name',
    'phone',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'state_code',
    'postal_code',
    'country',
    'gstin',
    'landmark',
    'label',
    'is_default',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  CustomerAddressContract(super.json);

  factory CustomerAddressContract.fromJson(JsonMap json) =>
      CustomerAddressContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String? get customerId => optionalString('customer_id');
  String get fullName => stringValue('full_name');
  String? get phone => optionalString('phone');
  String get addressLine1 => stringValue('address_line1');
  String? get addressLine2 => optionalString('address_line2');
  String get city => stringValue('city');
  String get state => stringValue('state');
  String get postalCode => stringValue('postal_code');
  bool get isDefault => boolValue('is_default');
}

class ProductOptionContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'id',
    'product_id',
    'name',
    'position',
    'values',
  ];

  ProductOptionContract(super.json);

  factory ProductOptionContract.fromJson(JsonMap json) =>
      ProductOptionContract(json);

  String? get id => optionalString('id');
  String? get productId => optionalString('product_id');
  String get name => stringValue('name');
  int get position => intValue('position');
  List<String> get values => stringList('values');
}

class ProductVariantContract extends SharedTypeContract {
  static const ownFields = <String>[
    'product_id',
    'title',
    'sku',
    'barcode',
    'price',
    'compare_price',
    'cost_price',
    'stock',
    'inventory_quantity',
    'options',
    'image_url',
    'weight',
    'weight_unit',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  ProductVariantContract(super.json);

  factory ProductVariantContract.fromJson(JsonMap json) =>
      ProductVariantContract(json);

  String get id => stringValue('id');
  String get productId => stringValue('product_id');
  String get title => stringValue('title');
  String? get sku => optionalString('sku');
  String? get barcode => optionalString('barcode');
  double? get price => this['price'] == null ? null : numberValue('price');
  int get stock => intValue('stock');
  int get inventoryQuantity => intValue('inventory_quantity');
  JsonMap get options => jsonMap('options');
  String? get imageUrl => optionalString('image_url');
}

class ProductContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'version',
    'name',
    'slug',
    'description',
    'status',
    'price',
    'compare_price',
    'cost_price',
    'currency',
    'sku',
    'barcode',
    'stock',
    'track_inventory',
    'inventory_policy',
    'images',
    'category',
    'product_type',
    'vendor',
    'tags',
    'options',
    'variants',
    'is_active',
    'is_featured',
    'is_physical',
    'charge_tax',
    'hs_code',
    'hsn_code',
    'country_of_origin',
    'importer_details',
    'seo_title',
    'seo_description',
    'metadata',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  ProductContract(super.json);

  factory ProductContract.fromJson(JsonMap json) => ProductContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  // An absent/invalid revision is not a locally fabricated editable version.
  int? get version {
    final value = this['version'];
    return value is int && value > 0 ? value : null;
  }

  String get name => stringValue('name');
  String get slug => stringValue('slug');
  String get description => stringValue('description');
  String get status => stringValue('status', fallback: 'draft');
  double get price => numberValue('price');
  double? get comparePrice =>
      this['compare_price'] == null ? null : numberValue('compare_price');
  String get currency => stringValue('currency', fallback: 'INR');
  String? get sku => optionalString('sku');
  String? get barcode => optionalString('barcode');
  String? get category => optionalString('category');
  String? get countryOfOrigin => optionalString('country_of_origin');
  String? get importerDetails => optionalString('importer_details');
  int get stock => intValue('stock');
  bool get isActive => boolValue('is_active');
  bool get isFeatured => boolValue('is_featured');
  List<String> get images => stringList('images');
  List<String> get tags => stringList('tags');
  List<ProductOptionContract> get options =>
      contractList('options', ProductOptionContract.fromJson);
  List<ProductVariantContract> get variants =>
      contractList('variants', ProductVariantContract.fromJson);
  JsonMap get metadata => jsonMap('metadata');
}

class CollectionRuleContract extends SharedTypeContract {
  static const schemaFields = <String>['field', 'relation', 'value'];

  CollectionRuleContract(super.json);

  factory CollectionRuleContract.fromJson(JsonMap json) =>
      CollectionRuleContract(json);
}

class CollectionContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'title',
    'slug',
    'description',
    'image_url',
    'status',
    'is_manual',
    'sort_order',
    'product_ids',
    'rules',
    'seo_title',
    'seo_description',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  CollectionContract(super.json);

  factory CollectionContract.fromJson(JsonMap json) => CollectionContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String get title => stringValue('title');
  String get slug => stringValue('slug');
  String get status => stringValue('status', fallback: 'draft');
  List<String> get productIds => stringList('product_ids');
  List<CollectionRuleContract> get rules =>
      contractList('rules', CollectionRuleContract.fromJson);
}

class CustomerContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'email',
    'phone',
    'gstin',
    'first_name',
    'last_name',
    'display_name',
    'status',
    'accepts_marketing',
    'tags',
    'notes',
    'default_address_id',
    'addresses',
    'order_count',
    'total_spent',
    'last_order_at',
    'metadata',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  CustomerContract(super.json);

  factory CustomerContract.fromJson(JsonMap json) => CustomerContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String? get email => optionalString('email');
  String? get phone => optionalString('phone');
  String? get displayName => optionalString('display_name');
  String get status => stringValue('status', fallback: 'active');
  bool get acceptsMarketing => boolValue('accepts_marketing');
  int get orderCount => intValue('order_count');
  double get totalSpent => numberValue('total_spent');
  List<CustomerAddressContract> get addresses =>
      contractList('addresses', CustomerAddressContract.fromJson);
}

class CustomerSegmentContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'name',
    'description',
    'rules',
    'customer_count',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  CustomerSegmentContract(super.json);

  factory CustomerSegmentContract.fromJson(JsonMap json) =>
      CustomerSegmentContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String get name => stringValue('name');
  String? get description => optionalString('description');
  JsonMap get rules => jsonMap('rules');
  int get customerCount => intValue('customer_count');
  List<String> get tagsAny {
    final value = rules['tags_any'];
    if (value is List) return value.map((item) => item.toString()).toList();
    return const [];
  }
}

class CartLineContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'id',
    'product_id',
    'variant_id',
    'title',
    'sku',
    'image_url',
    'quantity',
    'unit_price',
    'compare_price',
    'currency',
    'properties',
    'line_total',
  ];

  CartLineContract(super.json);

  factory CartLineContract.fromJson(JsonMap json) => CartLineContract(json);

  String get id => stringValue('id');
  String get productId => stringValue('product_id');
  String get title => stringValue('title');
  int get quantity => intValue('quantity');
  double get unitPrice => numberValue('unit_price');
  double get lineTotal => numberValue('line_total');
}

class CartContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'customer_id',
    'session_id',
    'status',
    'channel',
    'buyer_email',
    'currency',
    'lines',
    'subtotal',
    'discount_total',
    'shipping_total',
    'tax_total',
    'total',
    'coupon_codes',
    'expires_at',
    'metadata',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  CartContract(super.json);

  factory CartContract.fromJson(JsonMap json) => CartContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String get status => stringValue('status', fallback: 'active');
  String get channel => stringValue('channel');
  String? get buyerEmail => optionalString('buyer_email');
  String get currency => stringValue('currency', fallback: 'INR');
  List<CartLineContract> get lines =>
      contractList('lines', CartLineContract.fromJson);
  double get total => numberValue('total');
}

class LineItemContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'id',
    'order_id',
    'product_id',
    'variant_id',
    'name',
    'sku',
    'quantity',
    'unit_price',
    'total',
    'currency',
    'hsn_code',
    'gst_rate',
    'taxable_amount',
    'cgst_amount',
    'sgst_amount',
    'igst_amount',
    'image_url',
    'variant_title',
    'properties',
  ];

  LineItemContract(super.json);

  factory LineItemContract.fromJson(JsonMap json) => LineItemContract(json);

  String get id => stringValue('id');
  String? get productId => optionalString('product_id');
  String? get variantId => optionalString('variant_id');
  String get name => stringValue('name');
  String? get sku => optionalString('sku');
  int get quantity => intValue('quantity');
  double get unitPrice => numberValue('unit_price');
  double get total => numberValue('total');
  String get currency => stringValue('currency', fallback: 'INR');
  String? get imageUrl => optionalString('image_url');
}

class OrderContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'order_number',
    'customer_id',
    'customer_email',
    'customer_phone',
    'customer_name',
    'customer_gstin',
    'status',
    'payment_status',
    'fulfillment_status',
    'currency',
    'subtotal',
    'discount_amount',
    'shipping_amount',
    'tax_amount',
    'total',
    'payment_method',
    'payment_provider',
    'payment_id',
    'risk_score',
    'risk_level',
    'fulfillment_state',
    'cod_confirmation_status',
    'rto_status',
    'shipping_address',
    'billing_address',
    'place_of_supply_state',
    'gst_invoice_number',
    'gst_invoice',
    'shipping_method',
    'tracking_number',
    'tracking_url',
    'notes',
    'coupon_code',
    'idempotency_key',
    'line_items',
    'metadata',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  OrderContract(super.json);

  factory OrderContract.fromJson(JsonMap json) => OrderContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String get orderNumber => stringValue('order_number');
  String? get customerName => optionalString('customer_name');
  String? get customerEmail => optionalString('customer_email');
  String? get customerPhone => optionalString('customer_phone');
  String get status => stringValue('status');
  String get paymentStatus => stringValue('payment_status');
  String get fulfillmentStatus => stringValue('fulfillment_status');
  String get currency => stringValue('currency', fallback: 'INR');
  double get subtotal => numberValue('subtotal');
  double get discountAmount => numberValue('discount_amount');
  double get shippingAmount => numberValue('shipping_amount');
  double get taxAmount => numberValue('tax_amount');
  double get total => numberValue('total');
  int get riskScore => intValue('risk_score');
  String get riskLevel => stringValue('risk_level', fallback: 'low');
  String? get fulfillmentState => optionalString('fulfillment_state');
  String? get codConfirmationStatus =>
      optionalString('cod_confirmation_status');
  String? get rtoStatus => optionalString('rto_status');
  List<LineItemContract> get lineItems =>
      contractList('line_items', LineItemContract.fromJson);
}

class PaymentContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'order_id',
    'customer_id',
    'provider',
    'method',
    'status',
    'currency',
    'amount',
    'amount_minor',
    'authorized_amount_minor',
    'captured_amount_minor',
    'refunded_amount_minor',
    'provider_payment_id',
    'provider_order_id',
    'provider_signature',
    'idempotency_key',
    'failure_code',
    'failure_message',
    'metadata',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  PaymentContract(super.json);

  factory PaymentContract.fromJson(JsonMap json) => PaymentContract(json);

  String get id => stringValue('id');
  String get provider => stringValue('provider');
  String get method => stringValue('method');
  String get status => stringValue('status');
  double get amount => numberValue('amount');
}

class CouponContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'code',
    'description',
    'type',
    'value',
    'currency',
    'minimum_order_amount',
    'maximum_discount',
    'usage_limit',
    'used_count',
    'per_customer_limit',
    'applicable_product_ids',
    'applicable_collection_ids',
    'starts_at',
    'expires_at',
    'is_active',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  CouponContract(super.json);

  factory CouponContract.fromJson(JsonMap json) => CouponContract(json);

  String get id => stringValue('id');
  String get code => stringValue('code');
  String get type => stringValue('type');
  double get value => numberValue('value');
  bool get isActive => boolValue('is_active');
}

class PageContract extends SharedTypeContract {
  static const ownFields = <String>[
    'store_id',
    'title',
    'slug',
    'body',
    'body_html',
    'page_type',
    'status',
    'show_in_nav',
    'display_order',
    'seo_title',
    'seo_description',
    'published_at',
    'metadata',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  PageContract(super.json);

  factory PageContract.fromJson(JsonMap json) => PageContract(json);

  String get id => stringValue('id');
  String get storeId => stringValue('store_id');
  String get title => stringValue('title');
  String get slug => stringValue('slug');
  String get status => stringValue('status', fallback: 'draft');
}

class ThemeSettingFieldContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'id',
    'type',
    'label',
    'default',
    'options',
    'min',
    'max',
    'step',
    'help_text',
  ];

  ThemeSettingFieldContract(super.json);

  factory ThemeSettingFieldContract.fromJson(JsonMap json) =>
      ThemeSettingFieldContract(json);
}

class ThemeSettingsContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'primaryColor',
    'secondaryColor',
    'accentColor',
    'backgroundColor',
    'textColor',
    'fontFamily',
    'headingFontFamily',
    'borderRadius',
    'enableAnimations',
    'enableShadows',
    'isDark',
    'surfaceColor',
  ];

  ThemeSettingsContract(super.json);

  factory ThemeSettingsContract.fromJson(JsonMap json) =>
      ThemeSettingsContract(json);
}

class ThemeBlockContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'id',
    'type',
    'order',
    'renderer_key',
    'settings',
    'is_visible',
  ];

  ThemeBlockContract(super.json);

  factory ThemeBlockContract.fromJson(JsonMap json) => ThemeBlockContract(json);
}

class ThemeSectionContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'id',
    'type',
    'order',
    'renderer_key',
    'settings',
    'blocks',
    'is_visible',
  ];

  ThemeSectionContract(super.json);

  factory ThemeSectionContract.fromJson(JsonMap json) =>
      ThemeSectionContract(json);
}

class ThemeTemplateContract extends SharedTypeContract {
  static const schemaFields = <String>['key', 'layout_key', 'sections'];

  ThemeTemplateContract(super.json);

  factory ThemeTemplateContract.fromJson(JsonMap json) =>
      ThemeTemplateContract(json);
}

class ThemeBundleContract extends SharedTypeContract {
  static const schemaFields = <String>[
    'schema_version',
    'theme_id',
    'version',
    'settings_schema',
    'settings_data',
    'templates',
    'section_definitions',
    'block_definitions',
    'locales',
    'assets',
  ];

  ThemeBundleContract(super.json);

  factory ThemeBundleContract.fromJson(JsonMap json) =>
      ThemeBundleContract(json);

  String get schemaVersion => stringValue('schema_version');
  String get themeId => stringValue('theme_id');
  String get version => stringValue('version');
  List<ThemeSettingFieldContract> get settingsSchema =>
      contractList('settings_schema', ThemeSettingFieldContract.fromJson);
  JsonMap get settingsData => jsonMap('settings_data');
  JsonMap get templates => jsonMap('templates');
}

class ThemeContract extends SharedTypeContract {
  static const ownFields = <String>[
    'slug',
    'name',
    'description',
    'category',
    'pricing_type',
    'price_inr',
    'version',
    'is_active',
    'thumbnail_url',
    'preview_url',
    'screenshots',
    'tags',
    'features',
    'rating',
    'review_count',
    'install_count',
    'bundle',
    'published_at',
  ];

  static const schemaFields = <String>[
    ...ContractFieldSets.audited,
    ...ownFields,
  ];

  ThemeContract(super.json);

  factory ThemeContract.fromJson(JsonMap json) => ThemeContract(json);

  String get id => stringValue('id');
  String get slug => stringValue('slug');
  String get name => stringValue('name');
  String get category => stringValue('category');
  String get pricingType => stringValue('pricing_type', fallback: 'free');
  double get priceInr => numberValue('price_inr');
  String get version => stringValue('version');
  bool get isActive => boolValue('is_active', fallback: true);
  ThemeBundleContract? get bundle {
    final value = this['bundle'];
    if (value is Map<String, dynamic>) return ThemeBundleContract(value);
    if (value is Map)
      return ThemeBundleContract(Map<String, dynamic>.from(value));
    return null;
  }
}
