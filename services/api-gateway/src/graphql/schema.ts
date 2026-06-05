import type {
  AnalyticsDashboard,
  AppBillingCharge,
  BlogPost,
  Cart,
  Collection,
  Coupon,
  Customer,
  CustomerAddress,
  FormSubmission,
  GraphQLBulkOperation,
  GraphQLConnection,
  GraphQLPageInfo,
  GraphQLQueryCost,
  InstalledApp,
  InventoryLevel,
  MarketplaceApp,
  NavigationItem,
  NavigationMenu,
  Order,
  Page,
  Payment,
  Policy,
  Product,
  ProductCategory,
  ProductReview,
  ProductVariant,
  ShippingRate,
  ShippingZone,
  Store,
  StorePaymentConfig,
  StoreSubscription,
  TaxRate,
  Theme,
  ThemeBlock,
  ThemeBundle,
  ThemeRelease,
  ThemeSection,
} from '@letbuyy/shared-types';

export const LETBUYY_GRAPHQL_SCHEMA_VERSION = '2026-06-05.g1';
export const LETBUYY_GRAPHQL_SCHEMA_STAGE = 'WS12-G1';
export const LETBUYY_GRAPHQL_SCHEMA_SURFACES = ['admin', 'storefront'] as const;

export const ADMIN_GRAPHQL_SCHEMA_ROOTS = {
  endpoint: '/v1/graphql/admin',
  queryType: 'AdminQuery',
  mutationType: 'AdminMutation',
  auth: 'merchant-session',
  costPolicy: {
    pointsPerSecond: 20,
    capacity: 200,
    maxSingleOperationCost: 250,
  },
} as const;

export const STOREFRONT_GRAPHQL_SCHEMA_ROOTS = {
  endpoint: '/v1/graphql/storefront',
  queryType: 'StorefrontQuery',
  mutationType: 'StorefrontMutation',
  auth: 'storefront-public-or-customer-token',
  costPolicy: {
    pointsPerSecond: 20,
    capacity: 200,
    maxSingleOperationCost: 250,
  },
} as const;

export const GRAPHQL_BULK_OPERATION_CONTRACT = {
  queryMutation: 'bulkOperationRunQuery',
  mutationMutation: 'bulkOperationRunMutation',
  cancelMutation: 'bulkOperationCancel',
  statusType: 'BulkOperation',
  outputFormat: 'JSONL',
  resultStorage: 'Cloudflare R2',
  queueOwner: 'services/api-gateway',
  idempotencyHeader: 'X-Idempotency-Key',
} as const;

export interface GraphQLSharedTypeAlignment {
  AnalyticsDashboard: AnalyticsDashboard;
  AppBillingCharge: AppBillingCharge;
  BlogPost: BlogPost;
  BulkOperation: GraphQLBulkOperation;
  Cart: Cart;
  Collection: Collection;
  Coupon: Coupon;
  Customer: Customer;
  CustomerAddress: CustomerAddress;
  FormSubmission: FormSubmission;
  InstalledApp: InstalledApp;
  InventoryLevel: InventoryLevel;
  MarketplaceApp: MarketplaceApp;
  NavigationItem: NavigationItem;
  NavigationMenu: NavigationMenu;
  Order: Order;
  Page: Page;
  PageInfo: GraphQLPageInfo;
  Payment: Payment;
  Policy: Policy;
  Product: Product;
  ProductCategory: ProductCategory;
  ProductConnection: GraphQLConnection<Product>;
  ProductReview: ProductReview;
  ProductVariant: ProductVariant;
  QueryCost: GraphQLQueryCost;
  ShippingRate: ShippingRate;
  ShippingZone: ShippingZone;
  Store: Store;
  StorePaymentConfig: StorePaymentConfig;
  StoreSubscription: StoreSubscription;
  TaxRate: TaxRate;
  Theme: Theme;
  ThemeBlock: ThemeBlock;
  ThemeBundle: ThemeBundle;
  ThemeRelease: ThemeRelease;
  ThemeSection: ThemeSection;
}

export const GRAPHQL_SHARED_TYPE_ALIGNMENT = {
  AnalyticsDashboard: '@letbuyy/shared-types:AnalyticsDashboard',
  AppBillingCharge: '@letbuyy/shared-types:AppBillingCharge',
  BlogPost: '@letbuyy/shared-types:BlogPost',
  BulkOperation: '@letbuyy/shared-types:GraphQLBulkOperation',
  Cart: '@letbuyy/shared-types:Cart',
  Collection: '@letbuyy/shared-types:Collection',
  Coupon: '@letbuyy/shared-types:Coupon',
  Customer: '@letbuyy/shared-types:Customer',
  CustomerAddress: '@letbuyy/shared-types:CustomerAddress',
  FormSubmission: '@letbuyy/shared-types:FormSubmission',
  InstalledApp: '@letbuyy/shared-types:InstalledApp',
  InventoryLevel: '@letbuyy/shared-types:InventoryLevel',
  MarketplaceApp: '@letbuyy/shared-types:MarketplaceApp',
  NavigationItem: '@letbuyy/shared-types:NavigationItem',
  NavigationMenu: '@letbuyy/shared-types:NavigationMenu',
  Order: '@letbuyy/shared-types:Order',
  Page: '@letbuyy/shared-types:Page',
  PageInfo: '@letbuyy/shared-types:GraphQLPageInfo',
  Payment: '@letbuyy/shared-types:Payment',
  Policy: '@letbuyy/shared-types:Policy',
  Product: '@letbuyy/shared-types:Product',
  ProductCategory: '@letbuyy/shared-types:ProductCategory',
  ProductConnection: '@letbuyy/shared-types:GraphQLConnection<Product>',
  ProductReview: '@letbuyy/shared-types:ProductReview',
  ProductVariant: '@letbuyy/shared-types:ProductVariant',
  QueryCost: '@letbuyy/shared-types:GraphQLQueryCost',
  ShippingRate: '@letbuyy/shared-types:ShippingRate',
  ShippingZone: '@letbuyy/shared-types:ShippingZone',
  Store: '@letbuyy/shared-types:Store',
  StorePaymentConfig: '@letbuyy/shared-types:StorePaymentConfig',
  StoreSubscription: '@letbuyy/shared-types:StoreSubscription',
  TaxRate: '@letbuyy/shared-types:TaxRate',
  Theme: '@letbuyy/shared-types:Theme',
  ThemeBlock: '@letbuyy/shared-types:ThemeBlock',
  ThemeBundle: '@letbuyy/shared-types:ThemeBundle',
  ThemeRelease: '@letbuyy/shared-types:ThemeRelease',
  ThemeSection: '@letbuyy/shared-types:ThemeSection',
} as const satisfies Record<keyof GraphQLSharedTypeAlignment, string>;

export const LETBUYY_GRAPHQL_SCHEMA_SDL = String.raw`
schema {
  query: Query
  mutation: Mutation
}

directive @cost(base: Int! = 1, perNode: Int = 0, max: Int = 250) on FIELD_DEFINITION
directive @scope(name: String!) on FIELD_DEFINITION
directive @idempotent on FIELD_DEFINITION

scalar DateTime
scalar Decimal
scalar Email
scalar JSON
scalar Money
scalar URL
scalar UUID

interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type Query {
  admin: AdminQuery!
  storefront: StorefrontQuery!
}

type Mutation {
  admin: AdminMutation!
  storefront: StorefrontMutation!
}

type UserError {
  field: [String!]!
  code: String!
  message: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type QueryCost {
  requested: Int!
  actual: Int!
  maximumAvailable: Int!
  currentlyAvailable: Int!
  restoreRate: Int!
  policy: String!
}

type MoneyV2 {
  amount: Money!
  amountMinor: Int
  currencyCode: String!
}

type SeoFields {
  title: String
  description: String
  imageUrl: URL
}

type MediaImage {
  id: ID
  url: URL!
  altText: String
  width: Int
  height: Int
}

enum SiteType {
  STORE
  PORTFOLIO
  RESUME
  BLOG
  LANDING
}

enum StoreStatus {
  DRAFT
  PUBLISHED
  FROZEN
  SUSPENDED
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum InventoryPolicy {
  DENY
  CONTINUE
}

enum CollectionStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum CustomerStatus {
  ACTIVE
  DISABLED
  INVITED
}

enum CartStatus {
  ACTIVE
  CONVERTED
  ABANDONED
  EXPIRED
}

enum OrderStatus {
  PENDING
  PENDING_COD
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  REQUIRES_ACTION
  AUTHORIZED
  PAID
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
  VOIDED
}

enum FulfillmentStatus {
  UNFULFILLED
  PARTIAL
  FULFILLED
  RETURNED
  CANCELLED
}

enum PaymentProvider {
  RAZORPAY
  CASHFREE
  PHONEPE
  UPI
  COD
  STRIPE
  PAYPAL
  MANUAL
}

enum PaymentMethod {
  UPI
  CARD
  NETBANKING
  WALLET
  COD
  PAYPAL
  MANUAL
}

enum PageStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum PolicyType {
  PRIVACY
  REFUND
  SHIPPING
  TERMS
  CONTACT
  CUSTOM
}

enum BlogPostStatus {
  DRAFT
  PUBLISHED
  SCHEDULED
  ARCHIVED
}

enum ThemeCategory {
  STORE
  PORTFOLIO
  RESUME
  BLOG
  LANDING
  SAAS
}

enum ThemePricingType {
  FREE
  ONE_TIME
  SUBSCRIPTION
}

enum AppInstallationStatus {
  ACTIVE
  PAUSED
  UNINSTALLED
}

enum MarketplaceAppStatus {
  DRAFT
  SUBMITTED
  IN_REVIEW
  CHANGES_NEEDED
  APPROVED
  PUBLISHED
  SUSPENDED
  REMOVED
  REJECTED
}

enum MarketplaceAppExtensionType {
  STOREFRONT_BLOCK
  STOREFRONT_EMBED
  CHECKOUT_UI
  POST_PURCHASE
  ADMIN_LINK
  ADMIN_BLOCK
}

enum BulkOperationType {
  QUERY
  MUTATION
}

enum BulkOperationStatus {
  CREATED
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
  EXPIRED
}

enum GraphQLApiSurface {
  ADMIN
  STOREFRONT
}

enum ProductSortKey {
  CREATED_AT
  UPDATED_AT
  TITLE
  PRICE
  INVENTORY
}

enum OrderSortKey {
  CREATED_AT
  UPDATED_AT
  TOTAL
  ORDER_NUMBER
}

enum CollectionSortKey {
  CREATED_AT
  UPDATED_AT
  TITLE
  MANUAL
}

input ConnectionInput {
  first: Int
  after: String
  last: Int
  before: String
}

input ProductFilter {
  search: String
  status: ProductStatus
  vendor: String
  productType: String
  tag: String
  collectionId: ID
  createdAfter: DateTime
  updatedAfter: DateTime
  sortKey: ProductSortKey = CREATED_AT
  reverse: Boolean = true
}

input OrderFilter {
  search: String
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  customerId: ID
  createdAfter: DateTime
  updatedAfter: DateTime
  sortKey: OrderSortKey = CREATED_AT
  reverse: Boolean = true
}

input CustomerFilter {
  search: String
  status: CustomerStatus
  tag: String
  acceptsMarketing: Boolean
}

input CollectionFilter {
  search: String
  status: CollectionStatus
  sortKey: CollectionSortKey = CREATED_AT
  reverse: Boolean = true
}

input ThemeFilter {
  search: String
  category: ThemeCategory
  pricingType: ThemePricingType
  published: Boolean
}

type Store implements Node & Timestamped {
  id: ID!
  userId: ID!
  name: String!
  subdomain: String!
  customDomain: String
  siteType: SiteType!
  status: StoreStatus!
  themeId: String
  currentThemeReleaseId: ID
  storefrontReleaseVersion: Int
  tagline: String
  description: String
  currency: String!
  locale: String!
  timezone: String!
  logoUrl: URL
  faviconUrl: URL
  legalName: String
  gstin: String
  gstStateCode: String
  invoicePrefix: String
  taxInclusive: Boolean!
  settings: JSON!
  navigation: JSON!
  themeConfig: JSON!
  seo: SeoFields
  publishedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type StoreEdge {
  cursor: String!
  node: Store!
}

type StoreConnection {
  edges: [StoreEdge!]!
  nodes: [Store!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type ProductOption {
  id: ID
  productId: ID
  name: String!
  position: Int!
  values: [String!]!
}

type ProductVariant implements Node & Timestamped {
  id: ID!
  productId: ID!
  title: String!
  sku: String
  barcode: String
  price: MoneyV2
  comparePrice: MoneyV2
  costPrice: MoneyV2
  stock: Int!
  inventoryQuantity: Int!
  options: JSON!
  imageUrl: URL
  weight: Decimal
  weightUnit: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type Product implements Node & Timestamped {
  id: ID!
  storeId: ID!
  name: String!
  slug: String!
  description: String
  status: ProductStatus!
  price: MoneyV2!
  comparePrice: MoneyV2
  costPrice: MoneyV2
  currency: String!
  sku: String
  barcode: String
  stock: Int!
  trackInventory: Boolean!
  inventoryPolicy: InventoryPolicy!
  images: [URL!]!
  category: String
  productType: String
  vendor: String
  tags: [String!]!
  options: [ProductOption!]!
  variants: [ProductVariant!]!
  isActive: Boolean!
  isFeatured: Boolean!
  isPhysical: Boolean!
  chargeTax: Boolean!
  hsCode: String
  hsnCode: String
  countryOfOrigin: String
  seo: SeoFields
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type ProductEdge {
  cursor: String!
  node: Product!
}

type ProductConnection {
  edges: [ProductEdge!]!
  nodes: [Product!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type ProductCategory implements Node & Timestamped {
  id: ID!
  storeId: ID!
  name: String!
  slug: String!
  description: String
  imageUrl: URL
  parentId: ID
  displayOrder: Int!
  isVisible: Boolean!
  level: Int!
  path: String
  productsCount: Int
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type CollectionRule {
  field: String!
  relation: String!
  value: JSON!
}

type Collection implements Node & Timestamped {
  id: ID!
  storeId: ID!
  title: String!
  slug: String!
  description: String
  imageUrl: URL
  status: CollectionStatus!
  isManual: Boolean!
  sortOrder: String!
  productIds: [ID!]!
  rules: [CollectionRule!]!
  seo: SeoFields
  products(first: Int, after: String): ProductConnection! @cost(base: 2, perNode: 1)
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type CollectionEdge {
  cursor: String!
  node: Collection!
}

type CollectionConnection {
  edges: [CollectionEdge!]!
  nodes: [Collection!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type ProductReview implements Node & Timestamped {
  id: ID!
  storeId: ID!
  productId: ID
  productName: String
  customerId: ID
  customerName: String
  rating: Int!
  title: String
  body: String
  images: [URL!]!
  isVerified: Boolean!
  isApproved: Boolean!
  helpfulCount: Int!
  status: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type ProductReviewEdge {
  cursor: String!
  node: ProductReview!
}

type ProductReviewConnection {
  edges: [ProductReviewEdge!]!
  nodes: [ProductReview!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type InventoryLevel {
  id: ID!
  productId: ID!
  variantId: ID
  locationId: ID
  productName: String!
  variantTitle: String
  sku: String
  images: [URL!]!
  locationName: String!
  available: Int!
  reserved: Int!
  incoming: Int!
  onHand: Int!
  sellable: Int!
  trackInventory: Boolean!
  updatedAt: DateTime
}

type InventoryLevelEdge {
  cursor: String!
  node: InventoryLevel!
}

type InventoryLevelConnection {
  edges: [InventoryLevelEdge!]!
  nodes: [InventoryLevel!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type CustomerAddress implements Node & Timestamped {
  id: ID!
  storeId: ID!
  customerId: ID
  fullName: String!
  phone: String
  addressLine1: String!
  addressLine2: String
  city: String!
  state: String!
  stateCode: String
  postalCode: String!
  country: String!
  gstin: String
  landmark: String
  label: String
  isDefault: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type Customer implements Node & Timestamped {
  id: ID!
  storeId: ID!
  email: Email
  phone: String
  gstin: String
  firstName: String
  lastName: String
  displayName: String
  status: CustomerStatus!
  acceptsMarketing: Boolean!
  tags: [String!]!
  notes: String
  defaultAddressId: ID
  addresses: [CustomerAddress!]!
  orderCount: Int!
  totalSpent: MoneyV2!
  lastOrderAt: DateTime
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type CustomerEdge {
  cursor: String!
  node: Customer!
}

type CustomerConnection {
  edges: [CustomerEdge!]!
  nodes: [Customer!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type CartLine {
  id: ID!
  productId: ID!
  variantId: ID
  title: String!
  sku: String
  imageUrl: URL
  quantity: Int!
  unitPrice: MoneyV2!
  comparePrice: MoneyV2
  currency: String!
  properties: JSON!
  lineTotal: MoneyV2!
}

type Cart implements Node & Timestamped {
  id: ID!
  storeId: ID!
  customerId: ID
  sessionId: String
  status: CartStatus!
  currency: String!
  lines: [CartLine!]!
  subtotal: MoneyV2!
  discountTotal: MoneyV2!
  shippingTotal: MoneyV2!
  taxTotal: MoneyV2!
  total: MoneyV2!
  couponCodes: [String!]!
  expiresAt: DateTime
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type OrderLineItem {
  id: ID
  orderId: ID
  productId: ID
  variantId: ID
  name: String!
  sku: String
  quantity: Int!
  unitPrice: MoneyV2!
  total: MoneyV2!
  currency: String!
  hsnCode: String
  gstRate: Decimal
  taxableAmount: MoneyV2
  cgstAmount: MoneyV2
  sgstAmount: MoneyV2
  igstAmount: MoneyV2
  imageUrl: URL
  variantTitle: String
  properties: JSON!
}

type Order implements Node & Timestamped {
  id: ID!
  storeId: ID!
  orderNumber: String!
  customerId: ID
  customerEmail: Email
  customerPhone: String
  customerName: String
  customerGstin: String
  status: OrderStatus!
  paymentStatus: PaymentStatus!
  fulfillmentStatus: FulfillmentStatus!
  currency: String!
  subtotal: MoneyV2!
  discountAmount: MoneyV2!
  shippingAmount: MoneyV2!
  taxAmount: MoneyV2!
  total: MoneyV2!
  paymentMethod: PaymentMethod
  paymentProvider: PaymentProvider
  paymentId: String
  shippingAddress: CustomerAddress
  billingAddress: CustomerAddress
  placeOfSupplyState: String
  gstInvoiceNumber: String
  gstInvoice: JSON
  shippingMethod: String
  trackingNumber: String
  trackingUrl: URL
  notes: String
  couponCode: String
  idempotencyKey: String
  lineItems: [OrderLineItem!]!
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type OrderEdge {
  cursor: String!
  node: Order!
}

type OrderConnection {
  edges: [OrderEdge!]!
  nodes: [Order!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type Payment implements Node & Timestamped {
  id: ID!
  storeId: ID!
  orderId: ID
  customerId: ID
  provider: PaymentProvider!
  method: PaymentMethod!
  status: PaymentStatus!
  currency: String!
  amount: MoneyV2!
  amountMinor: Int!
  authorizedAmountMinor: Int!
  capturedAmountMinor: Int!
  refundedAmountMinor: Int!
  providerPaymentId: String
  providerOrderId: String
  idempotencyKey: String!
  failureCode: String
  failureMessage: String
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type Coupon implements Node & Timestamped {
  id: ID!
  storeId: ID!
  code: String!
  name: String
  description: String
  discountType: String!
  value: Decimal!
  status: String!
  startsAt: DateTime
  endsAt: DateTime
  usageLimit: Int
  usedCount: Int!
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type ShippingRate implements Node {
  id: ID!
  storeId: ID!
  zoneId: ID
  name: String!
  rateType: String!
  amount: MoneyV2!
  currency: String!
  isActive: Boolean!
  createdAt: DateTime
  updatedAt: DateTime
}

type TaxRate implements Node {
  id: ID!
  storeId: ID!
  name: String!
  rate: Decimal!
  country: String!
  state: String
  hsnCode: String
  appliesTo: String!
  isActive: Boolean!
  createdAt: DateTime
  updatedAt: DateTime
}

type Page implements Node & Timestamped {
  id: ID!
  storeId: ID!
  title: String!
  slug: String!
  body: String!
  bodyHtml: String
  pageType: String!
  status: PageStatus!
  showInNav: Boolean!
  displayOrder: Int!
  seo: SeoFields
  publishedAt: DateTime
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type PageEdge {
  cursor: String!
  node: Page!
}

type PageConnection {
  edges: [PageEdge!]!
  nodes: [Page!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type Policy {
  id: ID!
  storeId: ID!
  policyType: PolicyType!
  slug: String!
  title: String!
  body: String!
  content: JSON!
  status: PageStatus!
  seo: SeoFields
  publishedAt: DateTime
  updatedAt: DateTime
}

type PolicyEdge {
  cursor: String!
  node: Policy!
}

type PolicyConnection {
  edges: [PolicyEdge!]!
  nodes: [Policy!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type NavigationMenu {
  id: ID!
  storeId: ID!
  handle: String!
  name: String!
  location: String!
  items: [NavigationItem!]!
}

type NavigationItem {
  id: ID!
  menuId: ID!
  storeId: ID!
  parentItemId: ID
  label: String!
  url: String!
  targetType: String!
  targetResourceId: String
  sortOrder: Int!
  isVisible: Boolean!
  openInNewTab: Boolean!
  metadata: JSON!
  updatedAt: DateTime
}

type BlogPost implements Node & Timestamped {
  id: ID!
  storeId: ID!
  authorId: ID
  title: String!
  slug: String!
  excerpt: String
  content: String!
  contentHtml: String
  featuredImage: URL
  categoryId: ID
  status: BlogPostStatus!
  scheduledAt: DateTime
  publishedAt: DateTime
  seo: SeoFields
  allowComments: Boolean!
  isFeatured: Boolean!
  isPinned: Boolean!
  readingTimeMin: Int
  metadata: JSON!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type BlogPostEdge {
  cursor: String!
  node: BlogPost!
}

type BlogPostConnection {
  edges: [BlogPostEdge!]!
  nodes: [BlogPost!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type FormSubmission implements Node & Timestamped {
  id: ID!
  storeId: ID!
  formType: String
  formName: String
  data: JSON!
  status: String!
  sourceUrl: String
  fullName: String
  email: Email
  phone: String
  subject: String
  message: String
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type ThemeSettingField {
  id: String!
  type: String!
  label: String!
  default: JSON
  options: [JSON!]
  min: Decimal
  max: Decimal
  step: Decimal
  helpText: String
}

type ThemeBlock {
  id: String!
  type: String!
  order: Int!
  rendererKey: String
  settings: JSON!
  isVisible: Boolean!
}

type ThemeSection {
  id: String!
  type: String!
  order: Int!
  rendererKey: String
  settings: JSON!
  blocks: [ThemeBlock!]!
  isVisible: Boolean!
}

type ThemeTemplate {
  key: String!
  layoutKey: String
  sections: [ThemeSection!]!
}

type ThemeBundle {
  schemaVersion: String!
  themeId: String!
  version: String!
  settingsSchema: [ThemeSettingField!]!
  settingsData: JSON!
  templates: JSON!
  sectionDefinitions: JSON!
  blockDefinitions: JSON!
  locales: JSON!
  assets: JSON!
}

type Theme implements Node & Timestamped {
  id: ID!
  slug: String!
  name: String!
  description: String!
  category: ThemeCategory!
  pricingType: ThemePricingType!
  price: MoneyV2!
  version: String!
  isActive: Boolean!
  thumbnailUrl: URL
  previewUrl: URL
  screenshots: [URL!]!
  tags: [String!]!
  features: [String!]!
  rating: Decimal!
  reviewCount: Int!
  installCount: Int!
  bundle: ThemeBundle
  publishedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

type ThemeEdge {
  cursor: String!
  node: Theme!
}

type ThemeConnection {
  edges: [ThemeEdge!]!
  nodes: [Theme!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type ThemeRelease {
  id: ID!
  themeId: String!
  themeInstanceId: ID
  themePackageVersionId: ID
  releaseVersion: Int!
  releaseStatus: String!
  isCurrent: Boolean!
  publishMessage: String
  publishedBy: ID
  publishedAt: DateTime
  rollbackOfReleaseId: ID
  schemaManifestVersion: String
  engineVersion: String
  createdAt: DateTime
}

type MarketplaceAppExtension {
  id: ID!
  appId: ID
  type: MarketplaceAppExtensionType!
  name: String
  entryPoint: URL
  target: String
  label: String
  config: JSON!
  status: String
  sortOrder: Int
}

type MarketplaceApp {
  id: ID!
  slug: String!
  name: String!
  tagline: String
  description: String
  status: MarketplaceAppStatus
  developerName: String
  developerEmail: Email
  clientId: String
  scopes: [String!]
  appUrl: URL
  proxyUrl: URL
  privacyUrl: URL
  termsUrl: URL
  iconUrl: URL
  screenshots: [URL!]
  pricingModel: String
  priceMonthly: Decimal
  priceYearly: Decimal
  priceInr: Decimal
  trialDays: Int
  tags: [String!]
  installCount: Int
  reviewCount: Int
  ratingAvg: Decimal
  extensions: [MarketplaceAppExtension!]
  createdAt: DateTime
  updatedAt: DateTime
  publishedAt: DateTime
}

type MarketplaceAppEdge {
  cursor: String!
  node: MarketplaceApp!
}

type MarketplaceAppConnection {
  edges: [MarketplaceAppEdge!]!
  nodes: [MarketplaceApp!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type InstalledApp {
  id: ID!
  appId: ID!
  storeId: ID!
  status: AppInstallationStatus!
  scopesGranted: [String!]!
  config: JSON!
  installedAt: DateTime
  uninstalledAt: DateTime
  marketplaceApp: MarketplaceApp
}

type InstalledAppEdge {
  cursor: String!
  node: InstalledApp!
}

type InstalledAppConnection {
  edges: [InstalledAppEdge!]!
  nodes: [InstalledApp!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

type StoreSubscription {
  id: ID
  plan: String!
  status: String!
  billingPeriod: String
  currentPeriodStart: DateTime
  currentPeriodEnd: DateTime
  promoEndsAt: DateTime
  amountPaid: Decimal
  cancelledAt: DateTime
}

type StorePaymentConfig {
  storeId: ID!
  onlinePaymentEnabled: Boolean!
  codEnabled: Boolean!
  paymentSettings: JSON!
  schemaReady: Boolean
}

type AnalyticsMetric {
  label: String!
  value: Decimal!
  previousValue: Decimal
  changePercent: Decimal
}

type AnalyticsDashboard {
  metrics: [AnalyticsMetric!]!
  orders: JSON!
  revenue: JSON!
  customers: JSON!
  products: JSON!
}

type BulkOperation {
  id: ID!
  storeId: ID
  apiSurface: GraphQLApiSurface!
  operationType: BulkOperationType!
  status: BulkOperationStatus!
  query: String!
  variables: JSON!
  inputUrl: URL
  resultUrl: URL
  objectCount: Int!
  fileSizeBytes: Int
  errorCode: String
  errorMessage: String
  idempotencyKey: String
  createdAt: DateTime!
  updatedAt: DateTime
  startedAt: DateTime
  completedAt: DateTime
  expiresAt: DateTime
  metadata: JSON!
}

type BulkOperationEdge {
  cursor: String!
  node: BulkOperation!
}

type BulkOperationConnection {
  edges: [BulkOperationEdge!]!
  nodes: [BulkOperation!]!
  pageInfo: PageInfo!
  totalCount: Int
  queryCost: QueryCost
}

input MoneyInput {
  amount: Money!
  amountMinor: Int
  currencyCode: String!
}

input SeoInput {
  title: String
  description: String
  imageUrl: URL
}

input ProductOptionInput {
  id: ID
  name: String!
  position: Int = 0
  values: [String!]!
}

input ProductVariantInput {
  id: ID
  title: String!
  sku: String
  barcode: String
  price: MoneyInput
  comparePrice: MoneyInput
  costPrice: MoneyInput
  stock: Int = 0
  inventoryQuantity: Int = 0
  options: JSON = {}
  imageUrl: URL
  weight: Decimal
  weightUnit: String = "kg"
}

input ProductInput {
  name: String!
  slug: String
  description: String
  status: ProductStatus = DRAFT
  price: MoneyInput!
  comparePrice: MoneyInput
  costPrice: MoneyInput
  sku: String
  barcode: String
  stock: Int = 0
  trackInventory: Boolean = true
  inventoryPolicy: InventoryPolicy = DENY
  images: [URL!] = []
  category: String
  productType: String
  vendor: String
  tags: [String!] = []
  options: [ProductOptionInput!] = []
  variants: [ProductVariantInput!] = []
  isActive: Boolean = false
  isFeatured: Boolean = false
  isPhysical: Boolean = true
  chargeTax: Boolean = true
  hsCode: String
  hsnCode: String
  countryOfOrigin: String
  seo: SeoInput
  metadata: JSON = {}
}

input ProductBulkActionInput {
  productIds: [ID!]!
  action: String!
  value: JSON
}

input CollectionInput {
  title: String!
  slug: String
  description: String
  imageUrl: URL
  status: CollectionStatus = DRAFT
  isManual: Boolean = true
  sortOrder: String = "manual"
  productIds: [ID!] = []
  rules: [JSON!] = []
  seo: SeoInput
}

input CustomerAddressInput {
  id: ID
  fullName: String!
  phone: String
  addressLine1: String!
  addressLine2: String
  city: String!
  state: String!
  stateCode: String
  postalCode: String!
  country: String = "IN"
  gstin: String
  landmark: String
  label: String
  isDefault: Boolean = false
}

input CustomerInput {
  email: Email
  phone: String
  gstin: String
  firstName: String
  lastName: String
  displayName: String
  status: CustomerStatus = ACTIVE
  acceptsMarketing: Boolean = false
  tags: [String!] = []
  notes: String
  defaultAddressId: ID
  addresses: [CustomerAddressInput!] = []
  metadata: JSON = {}
}

input OrderLineItemInput {
  productId: ID
  variantId: ID
  name: String!
  sku: String
  quantity: Int!
  unitPrice: MoneyInput!
  total: MoneyInput!
  hsnCode: String
  gstRate: Decimal
  properties: JSON = {}
}

input OrderInput {
  customerId: ID
  customerEmail: Email
  customerPhone: String
  customerName: String
  customerGstin: String
  status: OrderStatus = PENDING
  paymentStatus: PaymentStatus = PENDING
  fulfillmentStatus: FulfillmentStatus = UNFULFILLED
  currency: String = "INR"
  lineItems: [OrderLineItemInput!]!
  shippingAddress: CustomerAddressInput
  billingAddress: CustomerAddressInput
  shippingMethod: String
  notes: String
  couponCode: String
  metadata: JSON = {}
}

input FulfillmentInput {
  trackingNumber: String
  trackingUrl: URL
  shippingMethod: String
  notifyCustomer: Boolean = true
  lineItemIds: [ID!]
}

input RefundInput {
  amount: MoneyInput
  lineItemIds: [ID!]
  reason: String
  notifyCustomer: Boolean = true
}

input CouponInput {
  code: String!
  name: String
  description: String
  discountType: String!
  value: Decimal!
  startsAt: DateTime
  endsAt: DateTime
  usageLimit: Int
  metadata: JSON = {}
}

input PageInput {
  title: String!
  slug: String
  body: String = ""
  bodyHtml: String
  pageType: String = "custom"
  status: PageStatus = DRAFT
  showInNav: Boolean = false
  displayOrder: Int = 0
  seo: SeoInput
  metadata: JSON = {}
}

input ThemeDraftSaveInput {
  storeId: ID!
  themeId: ID!
  templateConfig: JSON!
  draftVersion: Int!
}

input ThemePublishInput {
  storeId: ID!
  themeId: ID!
  publishMessage: String
}

input ThemeInstallInput {
  storeId: ID!
  themeId: ID!
  source: String = "marketplace"
}

input AppInstallInput {
  storeId: ID!
  appId: ID!
  scopes: [String!]!
  consentToken: String!
}

input CartLineInput {
  productId: ID!
  variantId: ID
  quantity: Int!
  properties: JSON = {}
}

input CartLineUpdateInput {
  lineId: ID!
  quantity: Int!
  properties: JSON
}

input CheckoutInput {
  cartId: ID!
  customerId: ID
  email: Email
  phone: String
  shippingAddress: CustomerAddressInput
  billingAddress: CustomerAddressInput
  shippingMethod: String
  paymentMethod: PaymentMethod
  paymentProvider: PaymentProvider
}

input ProductReviewInput {
  productId: ID!
  customerId: ID
  customerName: String
  customerEmail: Email
  rating: Int!
  title: String
  body: String
  images: [URL!] = []
}

input BulkOperationRunQueryInput {
  query: String!
  variables: JSON = {}
}

input BulkOperationRunMutationInput {
  mutation: String!
  stagedUploadPath: String
  variables: JSON = {}
  idempotencyKey: String!
}

type DeletePayload {
  deletedId: ID
  userErrors: [UserError!]!
}

type ProductPayload {
  product: Product
  userErrors: [UserError!]!
}

type ProductBulkActionPayload {
  jobId: ID
  matchedCount: Int!
  updatedCount: Int!
  userErrors: [UserError!]!
}

type CollectionPayload {
  collection: Collection
  userErrors: [UserError!]!
}

type CustomerPayload {
  customer: Customer
  userErrors: [UserError!]!
}

type OrderPayload {
  order: Order
  payment: Payment
  userErrors: [UserError!]!
}

type FulfillmentPayload {
  order: Order
  userErrors: [UserError!]!
}

type RefundPayload {
  order: Order
  payment: Payment
  userErrors: [UserError!]!
}

type CouponPayload {
  coupon: Coupon
  userErrors: [UserError!]!
}

type PagePayload {
  page: Page
  userErrors: [UserError!]!
}

type ThemePayload {
  theme: Theme
  release: ThemeRelease
  previewToken: String
  userErrors: [UserError!]!
}

type AppInstallationPayload {
  installation: InstalledApp
  userErrors: [UserError!]!
}

type CartPayload {
  cart: Cart
  userErrors: [UserError!]!
}

type CheckoutPayload {
  order: Order
  payment: Payment
  redirectUrl: URL
  userErrors: [UserError!]!
}

type ProductReviewPayload {
  review: ProductReview
  userErrors: [UserError!]!
}

type BulkOperationPayload {
  bulkOperation: BulkOperation
  userErrors: [UserError!]!
}

type AdminQuery {
  queryCost(document: String!, variables: JSON): QueryCost! @cost(base: 1, max: 1) @scope(name: "graphql:cost")
  store(id: ID!): Store @cost(base: 1) @scope(name: "stores:read")
  stores(first: Int, after: String, last: Int, before: String): StoreConnection! @cost(base: 2, perNode: 1) @scope(name: "stores:read")
  currentStore: Store @cost(base: 1) @scope(name: "stores:read")
  storePaymentConfig(storeId: ID!): StorePaymentConfig @cost(base: 2) @scope(name: "stores:payments:read")
  subscription(storeId: ID!): StoreSubscription @cost(base: 2) @scope(name: "billing:read")
  product(id: ID, slug: String): Product @cost(base: 1) @scope(name: "products:read")
  products(filter: ProductFilter, first: Int, after: String, last: Int, before: String): ProductConnection! @cost(base: 2, perNode: 1) @scope(name: "products:read")
  productCategory(id: ID, slug: String): ProductCategory @cost(base: 1) @scope(name: "products:read")
  collection(id: ID, slug: String): Collection @cost(base: 1) @scope(name: "collections:read")
  collections(filter: CollectionFilter, first: Int, after: String, last: Int, before: String): CollectionConnection! @cost(base: 2, perNode: 1) @scope(name: "collections:read")
  inventoryLevels(productId: ID, variantId: ID, first: Int, after: String): InventoryLevelConnection! @cost(base: 2, perNode: 1) @scope(name: "inventory:read")
  customer(id: ID!): Customer @cost(base: 1) @scope(name: "customers:read")
  customers(filter: CustomerFilter, first: Int, after: String, last: Int, before: String): CustomerConnection! @cost(base: 2, perNode: 1) @scope(name: "customers:read")
  order(id: ID, orderNumber: String): Order @cost(base: 1) @scope(name: "orders:read")
  orders(filter: OrderFilter, first: Int, after: String, last: Int, before: String): OrderConnection! @cost(base: 2, perNode: 1) @scope(name: "orders:read")
  page(id: ID, slug: String): Page @cost(base: 1) @scope(name: "pages:read")
  pages(status: PageStatus, first: Int, after: String): PageConnection! @cost(base: 2, perNode: 1) @scope(name: "pages:read")
  policies(type: PolicyType, first: Int, after: String): PolicyConnection! @cost(base: 2, perNode: 1) @scope(name: "pages:read")
  navigationMenu(handle: String!): NavigationMenu @cost(base: 2) @scope(name: "navigation:read")
  blogPost(id: ID, slug: String): BlogPost @cost(base: 1) @scope(name: "blog:read")
  blogPosts(status: BlogPostStatus, first: Int, after: String): BlogPostConnection! @cost(base: 2, perNode: 1) @scope(name: "blog:read")
  reviews(productId: ID, first: Int, after: String): ProductReviewConnection! @cost(base: 2, perNode: 1) @scope(name: "reviews:read")
  theme(id: ID, slug: String): Theme @cost(base: 1) @scope(name: "themes:read")
  themes(filter: ThemeFilter, first: Int, after: String): ThemeConnection! @cost(base: 2, perNode: 1) @scope(name: "themes:read")
  themeRelease(id: ID!): ThemeRelease @cost(base: 1) @scope(name: "themes:read")
  marketplaceApps(search: String, first: Int, after: String): MarketplaceAppConnection! @cost(base: 2, perNode: 1) @scope(name: "apps:read")
  installedApps(storeId: ID!, first: Int, after: String): InstalledAppConnection! @cost(base: 2, perNode: 1) @scope(name: "apps:read")
  analyticsDashboard(storeId: ID!, period: String! = "30d"): AnalyticsDashboard @cost(base: 20) @scope(name: "analytics:read")
  formSubmissions(first: Int, after: String): [FormSubmission!]! @cost(base: 5, perNode: 1) @scope(name: "forms:read")
  shippingRates(storeId: ID!): [ShippingRate!]! @cost(base: 3) @scope(name: "shipping:read")
  taxRates(storeId: ID!): [TaxRate!]! @cost(base: 3) @scope(name: "tax:read")
  bulkOperation(id: ID!): BulkOperation @cost(base: 1) @scope(name: "bulk:read")
  currentBulkOperation(type: BulkOperationType): BulkOperation @cost(base: 1) @scope(name: "bulk:read")
  bulkOperations(first: Int, after: String): BulkOperationConnection! @cost(base: 2, perNode: 1) @scope(name: "bulk:read")
}

type AdminMutation {
  productCreate(input: ProductInput!, idempotencyKey: String!): ProductPayload! @cost(base: 10) @scope(name: "products:write") @idempotent
  productUpdate(id: ID!, input: ProductInput!): ProductPayload! @cost(base: 10) @scope(name: "products:write")
  productDelete(id: ID!): DeletePayload! @cost(base: 8) @scope(name: "products:write")
  productBulkAction(input: ProductBulkActionInput!, idempotencyKey: String!): ProductBulkActionPayload! @cost(base: 25) @scope(name: "products:write") @idempotent
  collectionCreate(input: CollectionInput!, idempotencyKey: String!): CollectionPayload! @cost(base: 10) @scope(name: "collections:write") @idempotent
  collectionUpdate(id: ID!, input: CollectionInput!): CollectionPayload! @cost(base: 10) @scope(name: "collections:write")
  collectionDelete(id: ID!): DeletePayload! @cost(base: 8) @scope(name: "collections:write")
  customerCreate(input: CustomerInput!, idempotencyKey: String!): CustomerPayload! @cost(base: 10) @scope(name: "customers:write") @idempotent
  customerUpdate(id: ID!, input: CustomerInput!): CustomerPayload! @cost(base: 10) @scope(name: "customers:write")
  customerDelete(id: ID!): DeletePayload! @cost(base: 8) @scope(name: "customers:write")
  orderCreate(input: OrderInput!, idempotencyKey: String!): OrderPayload! @cost(base: 20) @scope(name: "orders:write") @idempotent
  orderUpdateStatus(id: ID!, status: OrderStatus!): OrderPayload! @cost(base: 10) @scope(name: "orders:write")
  orderFulfill(id: ID!, input: FulfillmentInput!, idempotencyKey: String!): FulfillmentPayload! @cost(base: 15) @scope(name: "orders:fulfill") @idempotent
  orderRefund(id: ID!, input: RefundInput!, idempotencyKey: String!): RefundPayload! @cost(base: 20) @scope(name: "orders:refund") @idempotent
  couponCreate(input: CouponInput!, idempotencyKey: String!): CouponPayload! @cost(base: 10) @scope(name: "discounts:write") @idempotent
  couponUpdate(id: ID!, input: CouponInput!): CouponPayload! @cost(base: 10) @scope(name: "discounts:write")
  couponDelete(id: ID!): DeletePayload! @cost(base: 8) @scope(name: "discounts:write")
  pageCreate(input: PageInput!, idempotencyKey: String!): PagePayload! @cost(base: 10) @scope(name: "pages:write") @idempotent
  pageUpdate(id: ID!, input: PageInput!): PagePayload! @cost(base: 10) @scope(name: "pages:write")
  pagePublish(id: ID!): PagePayload! @cost(base: 8) @scope(name: "pages:write")
  pageDelete(id: ID!): DeletePayload! @cost(base: 8) @scope(name: "pages:write")
  themeDraftSave(input: ThemeDraftSaveInput!, idempotencyKey: String!): ThemePayload! @cost(base: 20) @scope(name: "themes:write") @idempotent
  themePublish(input: ThemePublishInput!, idempotencyKey: String!): ThemePayload! @cost(base: 30) @scope(name: "themes:publish") @idempotent
  themeRollback(releaseId: ID!, idempotencyKey: String!): ThemePayload! @cost(base: 30) @scope(name: "themes:publish") @idempotent
  themeInstall(input: ThemeInstallInput!, idempotencyKey: String!): ThemePayload! @cost(base: 30) @scope(name: "themes:write") @idempotent
  appInstall(input: AppInstallInput!, idempotencyKey: String!): AppInstallationPayload! @cost(base: 25) @scope(name: "apps:install") @idempotent
  appUninstall(installationId: ID!, idempotencyKey: String!): AppInstallationPayload! @cost(base: 20) @scope(name: "apps:install") @idempotent
  bulkOperationRunQuery(input: BulkOperationRunQueryInput!): BulkOperationPayload! @cost(base: 25, max: 250) @scope(name: "bulk:write") @idempotent
  bulkOperationRunMutation(input: BulkOperationRunMutationInput!): BulkOperationPayload! @cost(base: 50, max: 250) @scope(name: "bulk:write") @idempotent
  bulkOperationCancel(id: ID!): BulkOperationPayload! @cost(base: 5) @scope(name: "bulk:write")
}

type StorefrontQuery {
  queryCost(document: String!, variables: JSON): QueryCost! @cost(base: 1, max: 1)
  store(subdomain: String, customDomain: String): Store @cost(base: 1)
  product(id: ID, slug: String!): Product @cost(base: 1)
  products(filter: ProductFilter, first: Int, after: String, last: Int, before: String): ProductConnection! @cost(base: 2, perNode: 1)
  collection(id: ID, slug: String): Collection @cost(base: 1)
  collections(filter: CollectionFilter, first: Int, after: String, last: Int, before: String): CollectionConnection! @cost(base: 2, perNode: 1)
  page(slug: String!): Page @cost(base: 1)
  pages(first: Int, after: String): PageConnection! @cost(base: 2, perNode: 1)
  policy(type: PolicyType, slug: String): Policy @cost(base: 1)
  policies(first: Int, after: String): PolicyConnection! @cost(base: 2, perNode: 1)
  navigationMenu(handle: String!): NavigationMenu @cost(base: 2)
  blogPost(slug: String!): BlogPost @cost(base: 1)
  blogPosts(first: Int, after: String): BlogPostConnection! @cost(base: 2, perNode: 1)
  reviews(productId: ID!, first: Int, after: String): ProductReviewConnection! @cost(base: 2, perNode: 1)
  cart(id: ID!): Cart @cost(base: 2)
  customer(id: ID!): Customer @cost(base: 2) @scope(name: "customer:read")
  order(id: ID!): Order @cost(base: 2) @scope(name: "customer:read")
}

type StorefrontMutation {
  cartCreate(lines: [CartLineInput!] = [], idempotencyKey: String!): CartPayload! @cost(base: 10) @idempotent
  cartLinesAdd(cartId: ID!, lines: [CartLineInput!]!, idempotencyKey: String!): CartPayload! @cost(base: 10) @idempotent
  cartLinesUpdate(cartId: ID!, lines: [CartLineUpdateInput!]!, idempotencyKey: String!): CartPayload! @cost(base: 10) @idempotent
  cartLinesRemove(cartId: ID!, lineIds: [ID!]!, idempotencyKey: String!): CartPayload! @cost(base: 10) @idempotent
  cartDiscountCodesUpdate(cartId: ID!, couponCodes: [String!]!, idempotencyKey: String!): CartPayload! @cost(base: 10) @idempotent
  checkoutCreate(input: CheckoutInput!, idempotencyKey: String!): CheckoutPayload! @cost(base: 25) @idempotent
  productReviewCreate(input: ProductReviewInput!, idempotencyKey: String!): ProductReviewPayload! @cost(base: 10) @idempotent
  customerAddressCreate(customerId: ID!, input: CustomerAddressInput!, idempotencyKey: String!): CustomerPayload! @cost(base: 10) @scope(name: "customer:write") @idempotent
  customerAddressUpdate(customerId: ID!, addressId: ID!, input: CustomerAddressInput!): CustomerPayload! @cost(base: 10) @scope(name: "customer:write")
}
`;
