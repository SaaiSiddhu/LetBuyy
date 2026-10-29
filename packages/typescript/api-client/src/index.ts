import {CollectionListQuerySchema,type CollectionListQueryInput} from '@letbuyy/shared-types';
import { StorefrontDirectoryPayloadSchema, type StorefrontDirectoryPayload } from '@letbuyy/shared-types';
import {CollectionListPageSchema} from '@letbuyy/shared-types';
import { CheckoutDomainSetupSchema, type CheckoutDomainSetup } from '@letbuyy/shared-types';
export type { CheckoutDomainSetup } from '@letbuyy/shared-types';
export { SubscriptionTaxSummarySchema } from '@letbuyy/shared-types';
import { PersonalizationReviewContextSchema, PersonalizationReviewQuerySchema, type PersonalizationReviewContext, type StorefrontDiscoveryQueryInput, type StorefrontDiscoveryMetadata } from '@letbuyy/shared-types';
import { CollectionMembershipSnapshotSchema, type ReplaceCollectionMembershipInput } from '@letbuyy/shared-types';
import { InventoryHistoryEntrySchema } from '@letbuyy/shared-types';
import { createLetbuyyGraphQLSdk } from './graphql';
import { createReelReviewSdk } from './reels';
export { createReelReviewSdk } from './reels';
export type { ReelMerchantCommand, ReelReviewerCommand, ReelReadback, ReelReviewPage, ReelDraftSelection, ReelSummary } from './reels';
import type { LetbuyyGraphQLSdk } from './graphql';
import type {
  AICreditBalance,
  AIHomepageGenerationRequest,
  AIHomepageGenerationResult,
  AIUsageRecord,
  AIOperatorRequest,
  AIOperatorResponse,
  AdminAppBridgeSession,
  AppBillingCharge,
  AppBillingChargeApprove,
  AppBillingChargeCreate,
  AppBillingChargeResult,
  AppBridgeApiFetchResult,
  AppDiscoveryEventInput,
  AppDiscoveryEventResult,
  AppActivityEvent,
  AppApiUsageMetric,
  AppBundle,
  AppDemoSession,
  AppExtensionRegistration,
  AppExtensionRegistryResponse,
  AppFunctionRegistration,
  AppOAuthAuthorizationResult,
  AppOAuthTokenResult,
  AppPricingPlan,
  AppPricingPlanInput,
  AppPricingPlanUpdate,
  AppReviewPolicy,
  AppReviewReplyInput,
  AppReviewModerationItem,
  AppRequestInput,
  AppRequestResult,
  AppSavedAppInput,
  AppSavedAppsResult,
  AppTrustReportInput,
  AppTrustReportResult,
  AppListingUpdate,
  AppSpendControlResult,
  AppSpendControlUpdate,
  AppSandboxStore,
  AppTelemetryEventInput,
  AppTelemetryEventResult,
  AppUsageEventCreate,
  AppUsageMeteringResult,
  AppUsageSummary,
  AppVersion,
  AppVersionInput,
  AppVersionsResult,
  AnalyticsDashboard,
  AnalyticsLiveView,
  AnalyticsOrdersBreakdown,
  AnalyticsRevenue,
  AnalyticsTrafficSources,
  ApiResponse,
  AICreditPurchase,
  AuthSessionResponse,
  BlogComment,
  BlogCommentStatus,
  BlogPost,
  BlogPostStatus,
  BillingHistoryItem,
  Cart,
  CodReconciliationEntry,
  CodReconciliationOverview,
  CodReconciliationStatus,
  Collection,
  CommissionOverview,
  ComplianceAuditExportSinkType,
  ComplianceAuditExportStatus,
  ComplianceDataSubjectRequestType,
  ComplianceDataSubjectSource,
  ComplianceDataSubjectStatus,
  ComplianceDataSubjectSubjectType,
  Coupon,
  Customer,
  CustomerAddress,
  CustomerNote,
  CustomerSegment,
  CustomerSegmentPreview,
  Employee,
  ExecutiveCohortAnalytics,
  ExecutiveCompanyHealth,
  ExecutiveFunnelAnalytics,
  ExecutiveMrrAnalytics,
  FileUploadResult,
  FormSubmission,
  FormSubmissionStatus,
  GiftCard,
  GraphQLBulkOperation,
  GraphQLConnection,
  GraphQLPageInfo,
  GraphQLQueryCost,
  InstalledApp,
  InventoryAdjustmentReason,
  InventoryLevel,
  InventoryHistoryEntry,
  InternalPermissionScope,
  JsonRecord,
  LineItem,
  MediaAsset,
  MediaType,
  MarketplaceApp,
  MarketplaceAppAward,
  MarketplaceAppFeatureGroup,
  MarketplaceAppCategory,
  MarketplaceAppCollection,
  MarketplaceAppDeveloper,
  MarketplaceAppRecommendations,
  MarketplaceAppReview,
  MarketplaceReviewRecord,
  MarketplaceReviewStatus,
  MarketplaceSubmissionType,
  ReviewCheckRun,
  MerchantKycDocument,
  MerchantKycDocumentType,
  MerchantKycOverview,
  MerchantSessionInventoryItem,
  MerchantTwoFactor,
  MerchantTwoFactorEnrollment,
  MerchantTwoFactorOverview,
  MerchantPayoutList,
  MerchantPayoutStatement,
  MarketingEmailAudience,
  MarketingEmailAudiencePreview,
  MarketingEmailCampaign,
  MarketingEmailRecipient,
  MarketingEmailSendResult,
  NavigationItem,
  NavigationResponse,
  Order,
  DraftOrder,
  Page,
  PaginatedResponse,
  Payment,
  Policy,
  Product,
  ProductBarcodeLookup,
  ProductCategory,
  ProductReview,
  ProductVariant,
  ProductStatus,
  RiskBand,
  RiskDecision,
  RiskEntityType,
  RiskSignalSeverity,
  RiskSignalType,
  SupportTicketChannel,
  SupportTicketEscalationTarget,
  SupportTicketMessageAuthor,
  SupportTicketMessageVisibility,
  SupportTicketPriority,
  SupportTicketQueueTopic,
  SupportTicketStatus,
  SupportTicketTopic,
  TrustSafetyAppealStatus,
  TrustSafetyCaseCategory,
  TrustSafetyCaseStatus,
  TrustSafetyDecision,
  TrustSafetyEnforcementAction,
  TrustSafetySeverity,
  TrustSafetySubjectType,
  CustomDomainHealth,
  DomainAvailabilityQuote,
  DomainPurchaseResult,
  PartnerDashboard,
  PartnerAnalyticsPoint,
  PartnerAnalyticsTimeseries,
  PartnerCollaboratorRedeemInput,
  PartnerTier,
  AppWebhookEndpoint,
  AppWebhookEndpointInput,
  AppWebhookEndpointUpdate,
  PageStatus,
  PolicyType,
  ResumeContentItem,
  ResumeContentSection,
  ReviewModerationStatus,
  ReplaceNavigationResult,
  ShippingRate,
  ShippingZone,
  Store,
  StoreHealth,
  StoreLocalizationSummary,
  StoreMarket,
  StoreMarketRoundingMode,
  StoreMetafieldDefinition,
  StoreMetafieldJsonValue,
  StoreMetafieldOwnerType,
  StoreMetafieldsSummary,
  StoreMetafieldValue,
  StorePaymentConfig,
  StoreStatus,
  StorefrontLocale,
  StorefrontLocaleStatus,
  StorefrontTranslation,
  StorefrontTranslationResourceType,
  StorefrontTranslationStatus,
  StorefrontCheckoutExtensionRegistryResponse,
  StorefrontAnalyticsBeacon,
  StorefrontAnalyticsBeaconResult,
  StoreSummary,
  StoreSubscriptionState,
  SubscriptionBillingPeriod,
  SubscriptionCancelResult,
  SubscriptionOrderResult,
  SubscriptionTaxSummary,
  SubscriptionPlan,
  SubscriptionRecoveryResult,
  SubscriptionVerificationResult,
  TaxRate,
  Theme,
  ThemeDraftSaveResult,
  ThemeEditableSchemaResponse,
  ThemeEditorPayload,
  ThemePreviewSessionResult,
  ThemePublishResult,
  ThemeRelease,
  ThemeRollbackResult,
  WalletBalance,
  WhatsAppCapability,
  WhatsAppMessage,
  WhatsAppSendInput,
  WhatsAppSendResult,
  WhatsAppTemplate,
} from '@letbuyy/shared-types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryPrimitive = string | number | boolean | null | undefined;
export type QueryValue = QueryPrimitive | readonly QueryPrimitive[];
export type QueryParams = Record<string, QueryValue>;

export interface LetbuyyApiClientOptions {
  baseUrl: string;
  apiVersionPath?: string;
  token?: string | null;
  storeId?: string | null;
  headers?: HeadersInit;
  /** Fresh request credentials, evaluated independently for every transport call. */
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
  fetch?: typeof fetch;
}

type LetbuyyRequestCachePolicy = 'no-store';

export interface LetbuyyRequestOptions {
  method?: HttpMethod;
  query?: QueryParams;
  body?: unknown;
  headers?: HeadersInit;
  token?: string | null;
  storeId?: string | null;
  idempotencyKey?: string | null;
  signal?: AbortSignal;
  versioned?: boolean;
  /** Preserve UTF-8 export bytes while retaining normal HTTP/error validation. */
  responseType?: 'json' | 'text';
  cache?: LetbuyyRequestCachePolicy;
}

/** Allocate once per logical support action and retain across retry attempts. Sign identity afresh. */
export interface SupportMutationOptions extends LetbuyyRequestOptions {
  idempotencyKey: string;
}

export interface MerchantLoyaltyProgram {
  site_id: string;
  is_active: boolean;
  earn_rate_bps: number;
  redeem_cap_bps: number;
  point_value_minor: string;
  /** Preserve this exact version, including microseconds, when saving. */
  updated_at: string;
  created_at?: string;
}
export interface MerchantLoyaltySnapshot {
  store_id: string;
  enrolled: boolean;
  program: MerchantLoyaltyProgram | null;
  outstanding_points: string;
  valuation_policy: 'block_decrease_while_outstanding';
  value_decrease_allowed: boolean;
}
export interface SetMerchantLoyaltyInput {
  store_id: string;
  expected_updated_at: string | null;
  is_active?: boolean;
  earn_rate_bps?: number;
  redeem_cap_bps?: number;
  point_value_minor?: string;
}
export interface MerchantLoyaltySaveResult extends MerchantLoyaltyProgram {
  created: boolean;
  outstanding_points: string;
  liability_delta_minor: string | null;
  valuation_policy: 'block_decrease_while_outstanding';
  value_decrease_allowed: boolean;
}

export const LETBUYY_DEFAULT_API_VERSION_PATH = '/v1';

/**
 * Safe cross-runtime read of the `LETBUYY_PRODUCTION_API_BASE_URL` override.
 * Reached through `globalThis` (not a bare `process` reference) so this stays
 * compilable in non-Node targets that omit Node typings.
 */
function readProductionApiBaseUrlOverride(): string | undefined {
  const globalProcess = (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  const value = globalProcess?.env?.LETBUYY_PRODUCTION_API_BASE_URL;
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Silent production fallback for the API base URL. Overridable via the
 * `LETBUYY_PRODUCTION_API_BASE_URL` env var; defaults to the canonical
 * `letbuyy.com` apex. `letbuyy.com` remains a legacy routing alias during
 * launch cutover.
 */
export const LETBUYY_PRODUCTION_API_BASE_URL =
  readProductionApiBaseUrlOverride() ?? 'https://api.letbuyy.com/v1';

export interface LetbuyyApiBaseUrlOptions {
  apiVersionPath?: string;
  includeVersionPath?: boolean;
}

export interface ResolveLetbuyyApiBaseUrlOptions extends LetbuyyApiBaseUrlOptions {
  fallback?: string;
  requireConfigured?: boolean;
  errorMessage?: string;
}

export function normalizeLetbuyyApiBaseUrl(
  input: string,
  options: LetbuyyApiBaseUrlOptions = {},
): string {
  const apiVersionPath = normalizePath(options.apiVersionPath ?? LETBUYY_DEFAULT_API_VERSION_PATH);
  const includeVersionPath = options.includeVersionPath ?? true;
  const configuredUrl = trimTrailingSlash(input.trim());

  if (!configuredUrl) {
    throw new Error('LetBuyy API base URL is not configured.');
  }

  try {
    const url = new URL(configuredUrl);
    const path = trimTrailingSlash(url.pathname);

    if (includeVersionPath) {
      if (!path || path === '/') {
        url.pathname = apiVersionPath;
      } else if (!path.endsWith(apiVersionPath)) {
        url.pathname = `${path}${apiVersionPath}`;
      } else {
        url.pathname = path;
      }

      return trimTrailingSlash(url.toString());
    }

    if (path.endsWith(apiVersionPath)) {
      url.pathname = path.slice(0, -apiVersionPath.length) || '/';
    } else {
      url.pathname = path || '/';
    }

    return trimTrailingSlash(url.toString());
  } catch {
    if (includeVersionPath) {
      return configuredUrl.endsWith(apiVersionPath)
        ? configuredUrl
        : `${configuredUrl}${apiVersionPath}`;
    }

    return configuredUrl.endsWith(apiVersionPath)
      ? trimTrailingSlash(configuredUrl.slice(0, -apiVersionPath.length))
      : configuredUrl;
  }
}

export function resolveLetbuyyApiBaseUrl(
  candidates: readonly (string | null | undefined)[],
  options: ResolveLetbuyyApiBaseUrlOptions = {},
): string {
  const configuredUrl = candidates.find((candidate): candidate is string => Boolean(candidate?.trim()));

  if (!configuredUrl) {
    if (options.requireConfigured) {
      throw new Error(options.errorMessage || 'LetBuyy API base URL is not configured.');
    }

    if (!options.fallback) {
      throw new Error(options.errorMessage || 'LetBuyy API base URL is not configured.');
    }

    return normalizeLetbuyyApiBaseUrl(options.fallback, options);
  }

  return normalizeLetbuyyApiBaseUrl(configuredUrl, options);
}

export function apiClientInputToLetbuyyApiPath(
  input: RequestInfo | URL,
  versionedBaseUrl: string,
  options: Pick<LetbuyyApiBaseUrlOptions, 'apiVersionPath'> = {},
): string {
  const rawUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(rawUrl);
  const base = new URL(normalizeLetbuyyApiBaseUrl(versionedBaseUrl, {
    apiVersionPath: options.apiVersionPath,
    includeVersionPath: true,
  }));
  const basePath = trimTrailingSlash(base.pathname);
  const pathname = basePath && url.pathname.startsWith(basePath)
    ? url.pathname.slice(basePath.length) || '/'
    : url.pathname;

  return `${pathname}${url.search}`;
}

export interface GatewayPaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  next_cursor?: string | null;
  total_is_exact?: boolean;
}

export interface GatewaySuccess<T> {
  success?: true;
  data: T;
  meta?: GatewayPaginationMeta & Record<string, unknown>;
}

export interface GatewayFailure {
  success?: false;
  error: {
    code: string;
    message: string;
    status?: number;
  };
}

export type GatewayResponse<T> = GatewaySuccess<T> | GatewayFailure | ApiResponse<T> | T;

export interface HealthResponse {
  status: string;
  timestamp: string;
  environment: string;
  version: string;
}

export interface ListQuery extends QueryParams {
  page?: number;
  limit?: number;
  cursor?: string;
  withCount?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface StoreScopedQuery extends ListQuery {
  store_id?: string;
}

export interface CustomDomainHealthQuery extends QueryParams {
  site_id: string;
}

export interface DomainSearchQuery extends QueryParams {
  query: string;
}

export interface DomainPurchaseInput extends JsonRecord {
  site_id: string;
  domain: string;
  years?: number;
  checkout_mode?: 'sandbox' | 'external_reference';
  payment_reference: string;
  owner: {
    name: string;
    email: string;
    phone?: string | null;
  };
}

// ── Multi-domain (migration 185) contract ────────────────────────────────────
export type SiteDomainRole = 'primary' | 'redirect';
export type SiteDomainStatus = 'none' | 'pending' | 'review' | 'verifying' | 'active' | 'error';

export interface SiteDomainRecord {
  id: string | null;
  site_id: string;
  domain: string;
  role: SiteDomainRole;
  status: SiteDomainStatus;
  ssl_status: string;
  provider: string | null;
  redirect_to: string | null;
  last_checked_at: string | null;
  connected_at: string | null;
}
export interface DomainListResult {
  cname_target: string;
  source: 'site_domains' | 'legacy';
  domains: SiteDomainRecord[];
}
export interface DomainScopedInput extends JsonRecord {
  site_id: string;
}
export interface DomainScopedQuery extends QueryParams {
  site_id: string;
}
export interface DomainConnectInput extends JsonRecord {
  site_id: string;
  domain: string;
}
export interface DomainDnsRecordHint {
  name: string;
  value: string;
}
export interface DomainConnectResult {
  domain: string;
  status: string;
  provider?: string | null;
  role?: SiteDomainRole;
  checkout?: CheckoutDomainSetup;
  records: {
    txt?: DomainDnsRecordHint;
    cname?: DomainDnsRecordHint;
    apex_alias?: DomainDnsRecordHint;
  };
  apex_mx_warning?: boolean;
  dns_snapshot?: { mx: string[]; ns: string[] };
}
export interface DomainVerifyResult {
  domain: string;
  status: string;
  customer_verification?: CustomDomainHealth['customer_verification'];
  txt_verified?: boolean;
  cname_verified?: boolean;
  cname_target?: string;
  vercel?: JsonRecord;
  reason?: string;
  checkout?: CheckoutDomainSetup;
  provider_dns_records?: Array<{ type: 'TXT'; name: string; value: string }>;
}
export interface DomainVerificationEvent {
  id: string;
  domain: string;
  check_type: string;
  status: string;
  txt_verified: boolean;
  cname_verified: boolean;
  ssl_active: boolean;
  created_at: string | null;
}
export interface DomainHistoryResult {
  domain: string;
  connected: boolean;
  events: DomainVerificationEvent[];
}
export interface DomainRedirectInput extends JsonRecord {
  site_id: string;
  role?: 'redirect';
  redirect_to?: string | null;
}
export interface DomainSetPrimaryResult {
  ok: boolean;
  domain?: string;
  role?: string;
  message?: string;
}
export interface DomainDeleteResult {
  domain: string;
  released: boolean;
}

export interface AppInstallationListQuery extends Pick<StoreScopedQuery, 'store_id'> {}
export interface AppExtensionRegistrationUpdateInput extends JsonRecord {
  store_id?: string;
  status: 'enabled' | 'disabled';
}
export interface AppStoreListQuery extends ListQuery {
  category?: string;
  collection?: string;
  featured?: boolean;
  built_for_letbuyy?: boolean | string;
  pricing?: string;
  rating_min?: string | number;
  site_type?: string;
  feature_handles?: string | readonly string[];
  'feature_handles[]'?: string | readonly string[];
}
export interface AppReviewListQuery extends ListQuery {}
export interface AppFeatureFacetQuery extends QueryParams {
  feature_handles?: string | readonly string[];
  'feature_handles[]'?: string | readonly string[];
}
export interface AppReviewSummaryGenerationResult extends JsonRecord {
  eligible: boolean;
  generated: boolean;
  reason?: string;
  summary?: string | null;
  eligibility_snapshot: JsonRecord;
}
export interface AppAwardWriteInput extends JsonRecord {
  award_key: string;
  label: string;
  year?: number | string;
  blurb?: string | null;
  status?: 'draft' | 'published' | 'archived';
  metadata?: JsonRecord;
}
export interface AppAwardArchiveResult extends JsonRecord {
  awards: MarketplaceAppAward[];
}
export interface SubmitAppReviewInput extends JsonRecord {
  rating: number;
  title?: string | null;
  body?: string | null;
  store_id?: string;
}
export type AppReviewReplyCreateInput = AppReviewReplyInput;
export type AppReportCreateInput = AppTrustReportInput;
export interface AppActivityEventListResult extends JsonRecord {
  events: AppActivityEvent[];
}
export interface AppReviewModerationQueueResult extends JsonRecord {
  reviews: AppReviewModerationItem[];
}
export interface AppReviewModerationActionInput extends JsonRecord {
  action: 'publish' | 'dismiss' | 'reject' | 'flag';
  reason?: string | null;
}
export type AppRequestCreateInput = AppRequestInput;
export type AppSavedAppCreateInput = AppSavedAppInput;
export interface PartnerAnalyticsTimeseriesResult extends JsonRecord {
  points: PartnerAnalyticsPoint[];
  totals: PartnerAnalyticsTimeseries['totals'];
}
export interface AppApiUsageMetricsResult extends JsonRecord {
  app_id: string;
  metrics: AppApiUsageMetric[];
}
export interface AppWebhookEndpointListResult extends JsonRecord {
  webhooks: AppWebhookEndpoint[];
}
export type AppWebhookEndpointCreateInput = AppWebhookEndpointInput;
export type AppWebhookEndpointPatchInput = AppWebhookEndpointUpdate;
export interface PartnerCollaboratorRedeemResult extends JsonRecord {
  accepted: boolean;
  seat?: JsonRecord | null;
}
export interface PartnerTierListResult extends JsonRecord {
  tiers: PartnerTier[];
}
export interface AppSandboxStoreListResult extends JsonRecord {
  stores: AppSandboxStore[];
}
export interface AppDemoSessionResult extends JsonRecord {
  session: AppDemoSession;
}
export interface AppInstallInput extends JsonRecord {
  store_id?: string;
  scopes?: string[];
  pricing_plan_id?: string;
  config?: JsonRecord;
  webhook_url?: string;
  webhook_event?: string;
  webhook_secret?: string;
}
export interface AppOAuthAuthorizeInput extends AppInstallInput {
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method?: 'S256';
  state?: string | null;
}
export interface AppOAuthAuthorizationCodeTokenInput extends JsonRecord {
  grant_type: 'authorization_code';
  code: string;
  client_id: string;
  redirect_uri: string;
  code_verifier: string;
}
export interface AppOAuthRefreshTokenInput extends JsonRecord {
  grant_type: 'refresh_token';
  refresh_token: string;
  client_id: string;
  scopes?: string[];
}
export type AppOAuthTokenInput = AppOAuthAuthorizationCodeTokenInput | AppOAuthRefreshTokenInput;
export interface AppOAuthTokenExchangeInput extends JsonRecord {
  installation_id: string;
  store_id?: string;
  scopes?: string[];
}
export interface AppBridgeFetchInput extends JsonRecord {
  method?: 'GET';
  path: string;
  store_id?: string;
}
export type AppApiProductListQuery = Omit<ProductListQuery, 'store_id'>;
export type AppApiOrderListQuery = Omit<OrderListQuery, 'store_id' | 'customer_id'>;
export interface AppApiInstallationMetadataInput extends JsonRecord {
  metadata: JsonRecord;
}
export interface AppApiInstallationMetadataResult extends JsonRecord {
  installation_id: string;
  app_id: string;
  store_id: string;
  metadata: JsonRecord;
  updated_at: string;
}
export type AppBillingChargeCreateInput = AppBillingChargeCreate;
export type AppBillingChargeApproveInput = AppBillingChargeApprove;
export interface AppBillingChargeCancelInput extends JsonRecord {
  store_id: string;
  charge_id: string;
  idempotency_key: string;
  reason?: string;
}
export type AppBillingChargeApprovalResult = AppBillingChargeResult & {
  charge: AppBillingCharge;
};
export type AppUsageEventCreateInput = AppUsageEventCreate;
export type AppUsageMeteringApiResult = AppUsageMeteringResult;
export type AppUsageSummaryResult = AppUsageSummary;
export type AppSpendControlUpdateInput = AppSpendControlUpdate;
export type AppSpendControlApiResult = AppSpendControlResult;
export interface AppInstallationScopeUpdateInput extends JsonRecord {
  store_id?: string;
  revoke_scope?: string;
  scopes_granted?: string[];
}
export type AppPricingPlanCreateInput = AppPricingPlanInput;
export type AppPricingPlanUpdateInput = AppPricingPlanUpdate;
export type AppListingUpdateInput = AppListingUpdate;
export type AppVersionCreateInput = AppVersionInput;
export type AppVersionCreateResult = {
  app: MarketplaceApp;
  version: AppVersion;
  review_record?: MarketplaceReviewRecord | null;
};
export type AppListingUpdateResult = {
  app: MarketplaceApp;
  version?: AppVersion | null;
  review_record?: MarketplaceReviewRecord | null;
};
export interface AppPricingPlansResult extends JsonRecord {
  app?: MarketplaceApp;
  plans: AppPricingPlan[];
}
export interface AppDeveloperRegistrationInput extends JsonRecord {
  company_name: string;
  website_url?: string | null;
  support_email: string;
  description?: string | null;
  country?: string;
  tax_id?: string | null;
  agreed_tos?: boolean;
  agreed_privacy?: boolean;
}
export interface AppSubmissionInput extends JsonRecord {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  category_id: string | null;
  app_url: string;
  privacy_policy_url: string;
  pricing_model: string;
  price_monthly?: number | string | null;
  price_yearly?: number | string | null;
  trial_days?: number | string | null;
  icon_url?: string | null;
  screenshots?: string[];
  data_handling?: JsonRecord;
  data_handling_summary?: string | null;
  data_collected?: string[];
  data_retention?: string | null;
  support_sla?: string | null;
  support_sla_response_minutes?: number | string | null;
  status_url?: string | null;
  works_with?: string[];
  conflict_app_ids?: string[];
  pricing_plans?: AppPricingPlanCreateInput[];
  save_as_draft?: boolean;
  manifest?: JsonRecord;
  oauth_redirect_uris?: string[];
}
export interface AppManifestValidationInput extends JsonRecord {
  manifest: JsonRecord;
}
export interface AppManifestValidationResult extends JsonRecord {
  valid: true;
  schema_version: string;
  manifest: JsonRecord;
  extension_records: JsonRecord[];
  function_records: JsonRecord[];
  counts: {
    extensions: number;
    functions: number;
  };
}
export interface AppDeveloperCredentialsResult extends JsonRecord {
  oauth_client_id: string;
  client_secret?: string;
  api_key?: string;
  api_key_prefix: string;
  issued_at: string;
  persisted: 'hash_only';
  show_once: true;
}
export interface AppDeveloperProfileResult extends JsonRecord {
  developer: MarketplaceAppDeveloper | null;
}
export interface PublicAppDeveloperProfileResult extends JsonRecord {
  developer: MarketplaceAppDeveloper;
  apps: MarketplaceApp[];
}
export interface AppDeveloperAppsResult extends JsonRecord {
  developer: MarketplaceAppDeveloper;
  apps: MarketplaceApp[];
  app_versions?: AppVersion[];
  pricing_plans?: AppPricingPlan[];
  review_records?: MarketplaceReviewRecord[];
}
export interface AppSubmissionResult extends JsonRecord {
  app: JsonRecord;
  review_record?: MarketplaceReviewRecord | null;
  manifest?: JsonRecord | null;
  credentials?: AppDeveloperCredentialsResult;
  pricing_plans?: AppPricingPlan[];
}
export type MarketplaceReviewDecision = Extract<MarketplaceReviewStatus, 'approved' | 'rejected' | 'changes_requested'>;
export interface MarketplaceReviewListQuery extends QueryParams {
  status?: MarketplaceReviewStatus;
  submission_type?: MarketplaceSubmissionType;
  limit?: number;
}
export interface MarketplaceReviewDecisionInput extends JsonRecord {
  decision: MarketplaceReviewDecision;
  reason?: string | null;
}
export interface MarketplaceReviewListResult extends JsonRecord {
  review_records: MarketplaceReviewRecord[];
}
export interface MarketplaceReviewDecisionResult extends JsonRecord {
  review_record: MarketplaceReviewRecord;
  resource?: JsonRecord | null;
  event_type?: string | null;
}
export interface MarketplaceReviewDetailResult extends JsonRecord {
  review_record: MarketplaceReviewRecord;
  check_runs: ReviewCheckRun[];
  resource?: JsonRecord | null;
}
export interface MarketplaceReviewRunChecksResult extends JsonRecord {
  review_record: MarketplaceReviewRecord;
  check_runs: ReviewCheckRun[];
  automated_checks: JsonRecord;
  resource?: JsonRecord | null;
}
export interface MarketplaceReviewClaimInput extends JsonRecord {
  reason: string;
}
export interface MarketplaceReviewAssignInput extends JsonRecord {
  assignee_id: string;
  reason: string;
}
export interface MarketplaceReviewCommentInput extends JsonRecord {
  comment: string;
  visibility?: 'internal' | 'developer';
}
export interface MarketplaceReviewCommentResult extends JsonRecord {
  review_record: MarketplaceReviewRecord;
  comment: JsonRecord;
}

export interface InternalDeveloperSearchQuery extends QueryParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: 'pending' | 'approved' | 'suspended' | 'rejected' | 'all';
}

export interface InternalPartnerPayoutLedgerEntry extends JsonRecord {
  id: string;
  partner_id: string;
  site_id?: string | null;
  app_id?: string | null;
  installation_id?: string | null;
  charge_id?: string | null;
  billing_mode?: string | null;
  amount_minor: number;
  currency: string;
  partner_amount_minor: number;
  platform_fee_minor?: number;
  status: 'pending' | 'processing' | 'released' | 'failed' | 'cancelled';
  rail?: 'razorpay_route' | 'upi' | 'manual';
  held_at?: string | null;
  hold_reason?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalPayoutReconciliationRecord extends JsonRecord {
  id: string;
  partner_id: string;
  payout_ledger_entry_id?: string | null;
  charge_id?: string | null;
  app_id?: string | null;
  site_id?: string | null;
  reconciliation_key: string;
  expected_partner_amount_minor: number;
  ledger_partner_amount_minor: number;
  delta_minor: number;
  currency: string;
  status: 'matched' | 'mismatch' | 'reviewing' | 'resolved' | 'ignored';
  reason?: string | null;
  resolution_notes?: string | null;
  checked_at: string;
  resolved_at?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalPayoutDispute extends JsonRecord {
  id: string;
  partner_id: string;
  payout_ledger_entry_id?: string | null;
  reconciliation_record_id?: string | null;
  opened_by?: string | null;
  assignee_id?: string | null;
  status: 'open' | 'in_review' | 'waiting_partner' | 'resolved' | 'rejected' | 'withdrawn';
  reason: string;
  resolution?: string | null;
  amount_minor: number;
  currency: string;
  opened_at: string;
  resolved_at?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalDeveloperOverview extends JsonRecord {
  developer: MarketplaceAppDeveloper;
  owner?: JsonRecord | null;
  apps: MarketplaceApp[];
  installations: JsonRecord[];
  webhooks: JsonRecord[];
  review_records: MarketplaceReviewRecord[];
  charges: JsonRecord[];
  payouts: InternalPartnerPayoutLedgerEntry[];
  trust_safety_cases: JsonRecord[];
  reconciliation_records: InternalPayoutReconciliationRecord[];
  disputes: InternalPayoutDispute[];
  audit_events: JsonRecord[];
  analytics: {
    total_apps: number;
    published_apps: number;
    suspended_apps: number;
    active_installations: number;
    gross_amount_minor: number;
    expected_partner_amount_minor: number;
    ledger_partner_amount_minor: number;
    released_partner_amount_minor: number;
    pending_partner_amount_minor: number;
    held_partner_amount_minor: number;
    reconciliation_delta_minor: number;
    open_mismatch_amount_minor: number;
    open_disputes: number;
    open_trust_safety_cases: number;
    currency: string;
    apps_by_status: Record<string, number>;
    payouts_by_status: Record<string, number>;
    payout_rail_breakdown: Record<string, { count: number; partner_amount_minor: number }>;
    webhook_health: { total: number; active: number; inactive: number };
  };
  recent: {
    charges: JsonRecord[];
    payouts: InternalPartnerPayoutLedgerEntry[];
    reviews: MarketplaceReviewRecord[];
    reconciliation: InternalPayoutReconciliationRecord[];
    disputes: InternalPayoutDispute[];
  };
}

export interface InternalDeveloperModerationInput extends JsonRecord {
  action: 'verify' | 'reject' | 'suspend' | 'restore';
  reason: string;
  secondary_approver_id?: string;
}

export interface InternalDeveloperModerationResult extends JsonRecord {
  developer: MarketplaceAppDeveloper;
  cascades: JsonRecord;
}

export interface InternalDeveloperPayoutReleaseInput extends JsonRecord {
  reason: string;
  secondary_approver_id: string;
}

export interface InternalDeveloperPayoutReleaseResult extends JsonRecord {
  payout: InternalPartnerPayoutLedgerEntry;
  transfer_mode: 'dry_run_provider_pending';
}

export interface InternalDeveloperReconciliationRunInput extends JsonRecord {
  reason: string;
  limit?: number;
}

export interface InternalDeveloperReconciliationRunResult extends JsonRecord {
  records: InternalPayoutReconciliationRecord[];
  summary: JsonRecord;
}

export interface InternalDeveloperDisputeInput extends JsonRecord {
  payout_ledger_entry_id?: string | null;
  reconciliation_record_id?: string | null;
  assignee_id?: string | null;
  reason: string;
  amount_minor?: number;
  metadata?: JsonRecord;
}

export interface InternalDeveloperDisputePatch extends JsonRecord {
  status?: InternalPayoutDispute['status'];
  assignee_id?: string | null;
  resolution?: string | null;
  reason: string;
  metadata?: JsonRecord;
}

export interface InternalDeveloperDisputeResult extends JsonRecord {
  dispute: InternalPayoutDispute;
}

export interface InternalDataSubjectRequest extends JsonRecord {
  id: string;
  site_id?: string | null;
  request_type: ComplianceDataSubjectRequestType;
  subject_type: ComplianceDataSubjectSubjectType;
  subject_id?: string | null;
  subject_email?: string | null;
  subject_display?: string | null;
  source: ComplianceDataSubjectSource;
  status: ComplianceDataSubjectStatus;
  due_at: string;
  verified_at?: string | null;
  fulfilled_at?: string | null;
  rejected_at?: string | null;
  assignee_id?: string | null;
  idempotency_key?: string | null;
  reason: string;
  request_payload?: JsonRecord;
  fulfillment_summary?: string | null;
  retention_policy_version?: string;
  retention_exempt_tables?: string[];
  purgeable_tables?: string[];
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalDataSubjectRequestQuery extends QueryParams {
  page?: number;
  limit?: number;
  status?: ComplianceDataSubjectStatus | 'all';
  request_type?: ComplianceDataSubjectRequestType | 'all';
  source?: ComplianceDataSubjectSource | 'all';
  site_id?: string;
  q?: string;
  actor_id?: string;
  actor_email?: string;
}

export interface InternalDataSubjectRequestInput extends JsonRecord {
  site_id?: string | null;
  request_type: ComplianceDataSubjectRequestType;
  subject_type: ComplianceDataSubjectSubjectType;
  subject_id?: string | null;
  subject_email?: string | null;
  subject_display?: string | null;
  source?: ComplianceDataSubjectSource;
  assignee_id?: string | null;
  reason: string;
  request_payload?: JsonRecord;
  metadata?: JsonRecord;
  actor_id?: string | null;
  actor_email?: string | null;
  idempotency_key?: string | null;
}

export interface InternalDataSubjectRequestPatch extends JsonRecord {
  status?: ComplianceDataSubjectStatus;
  assignee_id?: string | null;
  fulfillment_summary?: string | null;
  reason: string;
  metadata?: JsonRecord;
  actor_id?: string | null;
  actor_email?: string | null;
}

export interface InternalAuditExportCursor extends JsonRecord {
  id: string;
  cursor_key: string;
  sink_type: ComplianceAuditExportSinkType;
  sink_name: string;
  dry_run: boolean;
  status: ComplianceAuditExportStatus;
  last_audit_log_id?: string | null;
  last_audit_created_at?: string | null;
  last_exported_at?: string | null;
  rows_exported: number;
  checksum?: string | null;
  failure_reason?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalComplianceRetentionPolicy extends JsonRecord {
  version: string;
  data_request_due_days: number;
  trust_safety_retention_exempt_tables: readonly string[];
  policies: readonly JsonRecord[];
}

export interface InternalComplianceOverview extends JsonRecord {
  generated_at: string;
  totals: {
    total: number;
    open: number;
    overdue: number;
    due_soon: number;
    fulfilled: number;
    erasure: number;
    access: number;
  };
  latest_requests: InternalDataSubjectRequest[];
  audit_export_cursors: InternalAuditExportCursor[];
  retention_policy: InternalComplianceRetentionPolicy;
}

export interface InternalAuditExportRunInput extends JsonRecord {
  cursor_key?: string | null;
  limit?: number;
  reason: string;
  actor_id?: string | null;
  actor_email?: string | null;
}

export interface InternalAuditExportRunResult extends JsonRecord {
  cursor: InternalAuditExportCursor;
  rows_exported: number;
  total_rows_exported: number;
  checksum: string;
  dry_run: true;
  sink_type: ComplianceAuditExportSinkType;
  exported_sample: JsonRecord[];
}

export interface InternalRbacPermissionAssignmentInput extends JsonRecord {
  scopes: InternalPermissionScope[];
  reason: string;
}

export interface InternalRbacEmployeePermissionsResult extends JsonRecord {
  employee: Employee;
  effective_scopes: string[];
  break_glass_grant_ids: string[];
}

export interface InternalBreakGlassGrant extends JsonRecord {
  id: string;
  employee_id: string;
  scope: InternalPermissionScope;
  reason: string;
  granted_by: string;
  expires_at: string;
  used_at?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
}

export interface InternalBreakGlassGrantInput extends JsonRecord {
  employee_id: string;
  scope: InternalPermissionScope;
  reason: string;
  expires_at: string;
  metadata?: JsonRecord;
}

export interface InternalBreakGlassExpireInput extends JsonRecord {
  reason: string;
}

export interface InternalAccessReviewRecord extends JsonRecord {
  id: string;
  reviewer_id: string;
  period: string;
  decisions: JsonRecord;
  completed_at?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
}

export interface InternalAccessReviewRecordInput extends JsonRecord {
  reviewer_id: string;
  period: string;
  decisions: JsonRecord;
  completed_at?: string;
  reason: string;
  metadata?: JsonRecord;
}

export interface InternalAccessReviewRecordResult extends JsonRecord {
  access_review: InternalAccessReviewRecord;
}

export interface InternalRiskScore extends JsonRecord {
  id: string;
  site_id?: string | null;
  entity_type: RiskEntityType;
  entity_id: string;
  score: number;
  band: RiskBand;
  breakdown: JsonRecord;
  status: 'open' | 'confirmed' | 'dismissed' | 'restricted';
  manual_decision?: RiskDecision | null;
  decision_reason?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  scored_at: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalRiskSignal extends JsonRecord {
  id: string;
  site_id?: string | null;
  entity_type: RiskEntityType;
  entity_id: string;
  signal_type: RiskSignalType;
  source: string;
  severity: RiskSignalSeverity;
  weight?: number | null;
  rule_id?: string | null;
  value?: number | null;
  evidence: JsonRecord;
  metadata: JsonRecord;
  observed_at: string;
  created_at?: string | null;
}

export interface InternalRiskActionEvent extends JsonRecord {
  id: string;
  site_id?: string | null;
  entity_type: RiskEntityType;
  entity_id: string;
  action_type: 'score' | 'auto_restrict' | 'manual_decision' | 'ts_case_open_requested' | 'rule_change';
  action_status: 'recorded' | 'applied' | 'failed';
  reason: string;
  evidence: JsonRecord;
  created_at: string;
}

export interface InternalRiskRule extends JsonRecord {
  id: string;
  name: string;
  description?: string | null;
  signal_type: RiskSignalType;
  predicate: JsonRecord;
  weight: number;
  enabled: boolean;
  sandbox: boolean;
  action: 'score' | 'review' | 'restrict';
  version?: number;
  metadata?: JsonRecord;
  activated_at?: string | null;
  disabled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalRiskOverview extends JsonRecord {
  counts: {
    total_scores_sampled: number;
    by_band: Record<RiskBand, number>;
    high_today: number;
    restricted: number;
  };
  thresholds: JsonRecord;
  top_signals: Array<{ signal_type: string; count: number }>;
  recent_scores: InternalRiskScore[];
  recent_actions: InternalRiskActionEvent[];
}

export interface InternalRiskScoreQuery extends QueryParams {
  page?: number;
  limit?: number;
  band?: RiskBand;
  status?: InternalRiskScore['status'];
  entity_type?: RiskEntityType;
  site_id?: string;
}

export interface InternalRiskSignalInput extends JsonRecord {
  site_id?: string | null;
  entity_type: RiskEntityType;
  entity_id: string;
  signal_type: RiskSignalType;
  source?: string;
  severity?: RiskSignalSeverity;
  weight?: number;
  rule_id?: string | null;
  value?: number;
  evidence?: JsonRecord;
  metadata?: JsonRecord;
  observed_at?: string;
}

export interface InternalRiskScoreInput extends JsonRecord {
  site_id?: string | null;
  entity_type: RiskEntityType;
  entity_id: string;
  signals?: Array<Omit<InternalRiskSignalInput, 'site_id' | 'entity_type' | 'entity_id'>>;
  reason: string;
}

export interface InternalRiskDecisionInput extends JsonRecord {
  decision: RiskDecision;
  reason: string;
  metadata?: JsonRecord;
}

export interface InternalRiskRuleInput extends JsonRecord {
  name: string;
  description?: string | null;
  signal_type: RiskSignalType;
  predicate?: JsonRecord;
  weight: number;
  enabled?: boolean;
  sandbox?: boolean;
  action?: 'score' | 'review' | 'restrict';
  reason: string;
  metadata?: JsonRecord;
}

export interface InternalRiskRulePatch extends Partial<Omit<InternalRiskRuleInput, 'reason'>> {
  reason: string;
}

export interface InternalRiskScoreDetailResult extends JsonRecord {
  score: InternalRiskScore;
  signals: InternalRiskSignal[];
  actions: InternalRiskActionEvent[];
}

export interface InternalRiskScoreResult extends JsonRecord {
  score: InternalRiskScore;
  signals?: InternalRiskSignal[];
}

export interface InternalRiskSignalResult extends JsonRecord {
  signal: InternalRiskSignal;
  score: InternalRiskScore;
}

export interface InternalRiskRuleListResult extends JsonRecord {
  rules: InternalRiskRule[];
}

export interface InternalRiskRuleResult extends JsonRecord {
  rule: InternalRiskRule;
}

export interface InternalTrustSafetyCase extends JsonRecord {
  id: string;
  site_id?: string | null;
  subject_type: TrustSafetySubjectType;
  subject_id: string;
  category: TrustSafetyCaseCategory;
  severity: TrustSafetySeverity;
  status: TrustSafetyCaseStatus;
  title: string;
  summary?: string;
  assignee_id?: string | null;
  policy_id?: string | null;
  opened_by?: string | null;
  decided_by?: string | null;
  enforced_by?: string | null;
  decision?: TrustSafetyDecision | null;
  decision_reason?: string | null;
  enforcement_action?: TrustSafetyEnforcementAction | null;
  appeal_due_at?: string | null;
  closed_at?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalTrustSafetyCaseEvent extends JsonRecord {
  id: string;
  case_id: string;
  event_type: string;
  actor_type: 'employee' | 'super_admin' | 'system' | 'subject';
  actor_id?: string | null;
  reason: string;
  evidence: JsonRecord;
  metadata: JsonRecord;
  created_at: string;
}

export interface InternalTrustSafetyEvidence extends JsonRecord {
  id: string;
  case_id: string;
  evidence_type: string;
  source: string;
  title: string;
  description?: string;
  risk_score_id?: string | null;
  risk_action_event_id?: string | null;
  uri?: string | null;
  content: JsonRecord;
  metadata?: JsonRecord;
  created_at?: string | null;
}

export interface InternalTrustSafetyAppeal extends JsonRecord {
  id: string;
  case_id: string;
  filed_by_type: 'subject' | 'employee' | 'super_admin' | 'system';
  filed_by_id?: string | null;
  reason: string;
  status: TrustSafetyAppealStatus;
  original_reviewer_id?: string | null;
  appeal_reviewer_id?: string | null;
  decision_reason?: string | null;
  decided_at?: string | null;
  due_at: string;
  metadata?: JsonRecord;
  created_at?: string | null;
}

export interface InternalTrustSafetyTakedown extends JsonRecord {
  id: string;
  case_id: string;
  site_id?: string | null;
  subject_type: TrustSafetySubjectType;
  subject_id: string;
  action_type: Exclude<TrustSafetyEnforcementAction, 'none'>;
  status: 'pending' | 'active' | 'reversed';
  reason: string;
  enforced_by?: string | null;
  enforced_at?: string | null;
  reversed_by?: string | null;
  reversed_at?: string | null;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyOverview extends JsonRecord {
  counts: {
    total_cases_sampled: number;
    total_cases: number;
    open_cases: number;
    active_takedowns: number;
    pending_appeals: number;
  };
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  recent_cases: InternalTrustSafetyCase[];
  active_takedowns: InternalTrustSafetyTakedown[];
  appeals: InternalTrustSafetyAppeal[];
  policies: Array<JsonRecord & { id: string; policy_key: string; title: string }>;
  defaults: { appeal_window_business_days: number };
}

export interface InternalTrustSafetyCaseQuery extends QueryParams {
  page?: number;
  limit?: number;
  status?: TrustSafetyCaseStatus;
  severity?: TrustSafetySeverity;
  category?: TrustSafetyCaseCategory;
  site_id?: string;
  assignee_id?: string;
}

export interface InternalTrustSafetyEvidenceInput extends JsonRecord {
  title: string;
  evidence_type?: string;
  source?: string;
  description?: string;
  risk_score_id?: string | null;
  risk_action_event_id?: string | null;
  uri?: string | null;
  content?: JsonRecord;
  metadata?: JsonRecord;
  reason: string;
}

export interface InternalTrustSafetyOpenCaseInput extends JsonRecord {
  site_id?: string | null;
  subject_type: TrustSafetySubjectType;
  subject_id: string;
  category: TrustSafetyCaseCategory;
  severity?: TrustSafetySeverity;
  title: string;
  summary?: string;
  policy_id?: string | null;
  assignee_id?: string | null;
  reason: string;
  evidence?: Omit<InternalTrustSafetyEvidenceInput, 'reason' | 'metadata'> | null;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyRiskActionCaseInput extends JsonRecord {
  risk_action_event_id: string;
  assignee_id?: string | null;
  reason: string;
}

export interface InternalTrustSafetyDecisionInput extends JsonRecord {
  decision: TrustSafetyDecision;
  reason: string;
  policy_id?: string | null;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyEnforcementInput extends JsonRecord {
  action: Exclude<TrustSafetyEnforcementAction, 'none'>;
  reason: string;
  /** Required by the protected site-enforcement workflow; retain for retries. */
  idempotency_key?: string;
  notify_subject?: boolean;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyAppealInput extends JsonRecord {
  reason: string;
  filed_by_type?: 'subject' | 'employee' | 'super_admin' | 'system';
  filed_by_id?: string | null;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyAppealDecisionInput extends JsonRecord {
  status: Extract<TrustSafetyAppealStatus, 'upheld' | 'overturned' | 'rejected'>;
  reason: string;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyReinstateInput extends JsonRecord {
  reason: string;
  /** A session-bound independently approved request, required for execution. */
  approval_id?: string;
  /** Legacy transport only; never grants approval authority. */
  secondary_approver_id?: string;
  metadata?: JsonRecord;
}

export interface InternalTrustSafetyCaseResult extends JsonRecord {
  case: InternalTrustSafetyCase;
  events?: InternalTrustSafetyCaseEvent[];
  evidence?: InternalTrustSafetyEvidence[];
  appeals?: InternalTrustSafetyAppeal[];
  takedowns?: InternalTrustSafetyTakedown[];
}

export interface InternalTrustSafetyEvidenceResult extends JsonRecord {
  evidence: InternalTrustSafetyEvidence;
}

export interface InternalTrustSafetyAppealResult extends JsonRecord {
  appeal: InternalTrustSafetyAppeal;
}

export interface InternalTrustSafetyEnforcementResult extends JsonRecord {
  case: InternalTrustSafetyCase;
  takedown: InternalTrustSafetyTakedown;
}

export interface InternalSupportTicket extends JsonRecord {
  id: string;
  ticket_ref: string;
  site_id?: string | null;
  requester_type?: 'merchant' | 'customer' | 'employee' | 'anonymous' | 'system';
  requester_email?: string | null;
  requester_user_id?: string | null;
  subject: string;
  channel: SupportTicketChannel;
  // A ticket in the queue may be a buyer's privacy request; an operator still creates tickets with SupportTicketTopic.
  topic: SupportTicketQueueTopic;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignee_id?: string | null;
  escalated_to?: SupportTicketEscalationTarget | null;
  linked_risk_score_id?: string | null;
  linked_ts_case_id?: string | null;
  linked_incident_id?: string | null;
  first_response_due_at?: string | null;
  resolution_due_at?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  last_customer_message_at?: string | null;
  last_agent_message_at?: string | null;
  tags?: string[];
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalSupportTicketMessage extends JsonRecord {
  id: string;
  ticket_id: string;
  author_type: SupportTicketMessageAuthor;
  author_id?: string | null;
  author_email?: string | null;
  visibility: SupportTicketMessageVisibility;
  body: string;
  macro_id?: string | null;
  attachments?: JsonRecord[];
  metadata?: JsonRecord;
  created_at?: string | null;
}

export interface InternalSupportSlaClock extends JsonRecord {
  id: string;
  ticket_id: string;
  clock_type: 'first_response' | 'resolution';
  due_at: string;
  paused?: boolean;
  breached?: boolean;
  satisfied_at?: string | null;
}

export interface InternalSupportCsat extends JsonRecord {
  id: string;
  ticket_id: string;
  survey_token: string;
  requester_email?: string | null;
  score?: number | null;
  comment?: string | null;
  sent_at?: string | null;
  responded_at?: string | null;
}

export interface InternalSupportMacro extends JsonRecord {
  id: string;
  name: string;
  description?: string;
  topic: SupportTicketTopic;
  body: string;
  is_active: boolean;
  tags?: string[];
}

export interface InternalSupportOverview extends JsonRecord {
  open_count: number;
  pending_customer_count: number;
  escalated_count: number;
  sla_breach_count: number;
  active_macro_count: number;
  csat_average: number | null;
  sla_defaults: {
    first_response_hours: number;
    resolution_business_days: number;
  };
}

export interface InternalSupportTicketQuery extends QueryParams {
  page?: number;
  limit?: number;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  topic?: SupportTicketQueueTopic;
  assignee_id?: string;
  site_id?: string;
  q?: string;
}

export interface InternalSupportCreateTicketInput extends JsonRecord {
  site_id?: string | null;
  requester_type?: InternalSupportTicket['requester_type'];
  requester_email?: string | null;
  requester_user_id?: string | null;
  subject: string;
  body: string;
  channel?: SupportTicketChannel;
  topic?: SupportTicketTopic;
  priority?: SupportTicketPriority;
  assignee_id?: string | null;
  metadata?: JsonRecord;
  reason: string;
}

export interface InternalSupportMessageInput extends JsonRecord {
  body: string;
  visibility?: SupportTicketMessageVisibility;
  status?: SupportTicketStatus;
  macro_id?: string | null;
  attachments?: JsonRecord[];
  metadata?: JsonRecord;
  reason: string;
}

export interface InternalSupportAssignInput extends JsonRecord {
  assignee_id: string | null;
  reason: string;
}

export interface InternalSupportEscalateInput extends JsonRecord {
  target: SupportTicketEscalationTarget;
  reason: string;
  linked_incident_id?: string | null;
  metadata?: JsonRecord;
}

export interface InternalSupportResolveInput extends JsonRecord {
  reason: string;
  resolution_note?: string;
}

export interface InternalSupportCsatInput extends JsonRecord {
  score: number;
  comment?: string | null;
  reason: string;
}

export interface InternalSupportMacroInput extends JsonRecord {
  name: string;
  description?: string;
  topic?: SupportTicketTopic;
  body: string;
  is_active?: boolean;
  tags?: string[];
  metadata?: JsonRecord;
  reason: string;
}

export interface InternalSupportTicketDetail extends JsonRecord {
  ticket: InternalSupportTicket;
  messages: InternalSupportTicketMessage[];
  sla_clocks: InternalSupportSlaClock[];
  csat: InternalSupportCsat[];
  merchant_context: JsonRecord | null;
}

// What happened to a Trust & Safety escalation: the automatic one a reply or a new ticket gets when it mentions fraud and the
// like, or the case an explicit escalation to trust_safety opens. 'linked' only when the ticket really points at the case.
export type InternalSupportTrustSafetyEscalation =
  | { status: 'not_triggered' }
  | { status: 'already_escalated' }
  | { status: 'refused'; reason: 'privacy_request_conflict' }
  | { status: 'linked'; ts_case_id: string }
  | { status: 'failed'; stage: 'claim' | 'case' | 'link' };

export interface InternalSupportTicketResult extends JsonRecord {
  ticket: InternalSupportTicket;
  linked_ts_case_id?: string | null;
  trust_safety_escalation?: InternalSupportTrustSafetyEscalation;
}

export interface InternalSupportReplyResult extends JsonRecord {
  message: InternalSupportTicketMessage;
  ticket: InternalSupportTicket;
  linked_ts_case_id: string | null;
  trust_safety_escalation: InternalSupportTrustSafetyEscalation;
}

export type InternalIncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type InternalIncidentStatus = 'open' | 'mitigating' | 'resolved' | 'closed';
export type InternalIncidentEventType = 'created' | 'status-change' | 'escalation' | 'mitigation' | 'recovery' | 'note';
export type InternalPostmortemStatus = 'draft' | 'review' | 'accepted' | 'closed';

export interface InternalProductionIncident extends JsonRecord {
  incident_id: string;
  title: string;
  severity: InternalIncidentSeverity;
  status: InternalIncidentStatus;
  affected_runtimes?: string[];
  affected_regions?: string[];
  customer_impact?: string;
  commander_id?: string | null;
  started_at?: string | null;
  mitigated_at?: string | null;
  resolved_at?: string | null;
  postmortem_url?: string | null;
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalProductionIncidentEvent extends JsonRecord {
  id: string;
  incident_id: string;
  event_type: InternalIncidentEventType;
  actor_id?: string | null;
  summary: string;
  details?: JsonRecord;
  recorded_at?: string | null;
  created_at?: string | null;
}

export interface InternalOncallSchedule extends JsonRecord {
  id: string;
  team_name: string;
  rotation_name: string;
  primary_employee_id?: string | null;
  backup_employee_ids?: string[];
  escalation_tiers?: JsonRecord[];
  timezone: string;
  starts_at: string;
  ends_at?: string | null;
  active: boolean;
  paging_adapter: 'dry_run' | 'pagerduty' | 'opsgenie';
  metadata?: JsonRecord;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalIncidentPostmortem extends JsonRecord {
  id: string;
  incident_id: string;
  status: InternalPostmortemStatus;
  owner_id?: string | null;
  summary?: string;
  timeline?: JsonRecord[];
  contributing_factors?: JsonRecord[];
  action_items?: JsonRecord[];
  due_at?: string | null;
  completed_at?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  metadata?: JsonRecord;
  production_incidents?: Pick<InternalProductionIncident, 'title' | 'severity' | 'status' | 'started_at' | 'resolved_at'>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalRuntimeControlCommand extends JsonRecord {
  id?: string;
  command_id: string;
  operation: string;
  target_type: string;
  target_id: string;
  requested_by?: string | null;
  reason?: string;
  status: string;
  result?: JsonRecord;
  request_id?: string | null;
  correlation_id?: string | null;
  trace_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalIncidentListQuery extends QueryParams {
  limit?: number;
}

export interface InternalOncallScheduleQuery extends QueryParams {
  page?: number;
  limit?: number;
  active?: 'true' | 'false' | 'all';
  team_name?: string;
}

export interface InternalIncidentPostmortemQuery extends QueryParams {
  page?: number;
  limit?: number;
  status?: InternalPostmortemStatus | 'all';
  incident_id?: string;
}

export interface InternalRuntimeControlCommandInput extends JsonRecord {
  command_id: string;
  operation: string;
  target_type: string;
  target_id: string;
  reason: string;
  secondary_approver_id?: string | null;
}

export interface InternalProductionIncidentInput extends JsonRecord {
  incident_id: string;
  title: string;
  severity: InternalIncidentSeverity;
  affected_runtimes?: string[];
  affected_regions?: string[];
  customer_impact: string;
  metadata?: JsonRecord;
}

export interface InternalIncidentStatusInput extends JsonRecord {
  status: InternalIncidentStatus;
  summary: string;
  details?: JsonRecord;
}

export interface InternalIncidentEventInput extends JsonRecord {
  event_type: Extract<InternalIncidentEventType, 'note' | 'mitigation' | 'escalation' | 'recovery'>;
  summary: string;
  details?: JsonRecord;
  reason: string;
}

export interface InternalDryRunPageInput extends JsonRecord {
  incident_id?: string | null;
  target_team?: string | null;
  severity?: InternalIncidentSeverity;
  summary: string;
  escalation_level?: number;
  reason: string;
}

export interface InternalOncallScheduleInput extends JsonRecord {
  team_name: string;
  rotation_name: string;
  primary_employee_id?: string | null;
  backup_employee_ids?: string[];
  escalation_tiers?: JsonRecord[];
  timezone?: string;
  starts_at?: string;
  ends_at?: string | null;
  active?: boolean;
  paging_adapter?: 'dry_run' | 'pagerduty' | 'opsgenie';
  metadata?: JsonRecord;
  reason: string;
}

export interface InternalIncidentPostmortemInput extends JsonRecord {
  incident_id: string;
  owner_id?: string | null;
  status?: InternalPostmortemStatus;
  summary?: string;
  timeline?: JsonRecord[];
  contributing_factors?: JsonRecord[];
  action_items?: JsonRecord[];
  due_at?: string | null;
  metadata?: JsonRecord;
  reason: string;
}

export interface InternalIncidentPostmortemPatch extends Partial<Omit<InternalIncidentPostmortemInput, 'incident_id' | 'reason'>> {
  reason: string;
}

export interface InternalProductionIncidentResult extends JsonRecord {
  incident: InternalProductionIncident;
}

export interface InternalProductionIncidentDetail extends InternalProductionIncidentResult {
  events: InternalProductionIncidentEvent[];
  postmortem: InternalIncidentPostmortem | null;
}

export interface InternalRuntimeControlCommandResult extends JsonRecord {
  command: InternalRuntimeControlCommand;
}

export interface InternalOncallCurrentResult extends JsonRecord {
  schedule: InternalOncallSchedule | null;
  paging_adapter_mode: 'dry_run' | 'pagerduty' | 'opsgenie';
}

export interface InternalDryRunPageResult extends JsonRecord {
  page: JsonRecord;
  event?: InternalProductionIncidentEvent;
}

export interface InternalIncidentPostmortemResult extends JsonRecord {
  postmortem: InternalIncidentPostmortem;
}

export interface InternalMerchantSearchQuery extends QueryParams {
  q: string;
  page?: number;
  limit?: number;
}

export interface InternalMerchantSearchResult extends JsonRecord {
  id: string;
  user_id?: string | null;
  custom_user_id?: string | null;
  name?: string | null;
  store_name?: string | null;
  site_type?: string | null;
  subdomain?: string | null;
  custom_domain?: string | null;
  status?: string | null;
  views_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InternalMerchantSearchResponse extends JsonRecord {
  query: string;
  results: InternalMerchantSearchResult[];
  total: number;
}

export interface InternalMerchantOwner extends JsonRecord {
  id: string;
  email?: string | null;
  full_name?: string | null;
  email_verified?: boolean | null;
  auth_provider?: string | null;
  created_at?: string | null;
}

export interface InternalMerchantOverviewQuery extends QueryParams {
  actor_id?: string;
  actor_email?: string;
}

export interface InternalMerchantImpersonationSession extends JsonRecord {
  id: string;
  site_id?: string;
  operator_id: string;
  operator_email?: string | null;
  reason: string;
  read_only: true;
  expires_at: string;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface InternalMerchantOverview extends JsonRecord {
  site: InternalMerchantSearchResult & {
    custom_domain_status?: string | null;
    access_mode?: string | null;
    published?: boolean | null;
    published_at?: string | null;
    product_count?: number | null;
    order_count?: number | null;
    current_theme_release_id?: string | null;
    currency?: string | null;
    locale?: string | null;
    trial_status?: string | null;
    trial_ends_at?: string | null;
  };
  owners: InternalMerchantOwner[];
  subscription: JsonRecord | null;
  subscriptions: JsonRecord[];
  commerce: {
    order_count: number;
    paid_order_count: number;
    revenue_paise: number;
    recent_orders: JsonRecord[];
  };
  ecosystem: {
    installed_apps: JsonRecord[];
    active_theme: JsonRecord | null;
    theme_instances: JsonRecord[];
  };
  trust: {
    risk_score: InternalRiskScore | JsonRecord | null;
    open_cases: InternalTrustSafetyCase[] | JsonRecord[];
  };
  support: {
    configured: boolean;
    open_ticket_count: number;
    tickets: JsonRecord[];
  };
  impersonation_sessions: InternalMerchantImpersonationSession[];
  recent_audit_events: JsonRecord[];
}

export interface InternalMerchantActorInput extends JsonRecord {
  actor_id: string;
  actor_email?: string | null;
  reason: string;
}

export interface InternalMerchantImpersonationInput extends InternalMerchantActorInput {
  operator_id?: string;
  operator_email?: string | null;
  ttl_minutes?: number;
}

export interface InternalMerchantImpersonationResult extends JsonRecord {
  session: InternalMerchantImpersonationSession;
  token: string;
}

export interface InternalMerchantModerationInput extends InternalMerchantActorInput {
  action: 'suspend' | 'restore';
  approval_id: string;
  /** Compatibility field only; a typed ID is never consent. */
  secondary_approver_id?: string;
}

export interface InternalMerchantModerationResult extends JsonRecord {
  site: InternalMerchantSearchResult;
}

export interface InternalExecutiveAnalyticsQuery extends QueryParams {
  limit?: number;
  days?: number;
  actor_id?: string;
  actor_email?: string;
  reason?: string;
}

export interface InternalExecutiveCohortMerchant extends JsonRecord {
  id: string;
  name?: string | null;
  store_name?: string | null;
  subdomain?: string | null;
  custom_domain?: string | null;
  status?: string | null;
  published?: boolean | null;
  published_at?: string | null;
  site_type?: string | null;
  order_count?: number | null;
  created_at?: string | null;
}

export interface InternalExecutiveCohortMerchantsResult extends JsonRecord {
  cohort_month: string;
  merchants: InternalExecutiveCohortMerchant[];
}

export interface AnalyticsQuery extends StoreScopedQuery {
  period?: '7d' | '30d' | '90d' | '12m' | string;
}

export interface AnalyticsLiveQuery extends QueryParams, Pick<StoreScopedQuery, 'store_id'> {
  window_minutes?: number;
}

export interface AnalyticsTrafficSourcesQuery extends AnalyticsQuery {
  limit?: number;
}

export interface AIUsageListQuery extends StoreScopedQuery {
  feature?: string;
}

export interface AICreditPurchaseInput extends Pick<StoreScopedQuery, 'store_id'> {
  amount: number;
  idempotency_key?: string;
}

export interface PlanListQuery extends QueryParams {
  store_id?: string;
  site_type: string;
  slug?: string;
}

export interface PageListQuery extends StoreScopedQuery {
  status?: PageStatus | 'all';
}

export interface PolicyListQuery extends StoreScopedQuery {
  status?: PageStatus | 'all';
}

export interface CouponListQuery extends StoreScopedQuery {
  status?: 'active' | 'expired' | 'all';
}

export interface BlogPostListQuery extends StoreScopedQuery {
  status?: BlogPostStatus;
  category_id?: string;
}

export interface BlogCommentListQuery extends StoreScopedQuery {
  status?: BlogCommentStatus | 'all';
}

export interface FormSubmissionListQuery extends StoreScopedQuery {
  type?: 'all' | 'contact' | 'lead';
  status?: FormSubmissionStatus | 'all';
}

export interface ProductReviewListQuery extends StoreScopedQuery {
  status?: ReviewModerationStatus | 'all';
  product_id?: string;
}

export type ResumeContentListQuery = Pick<StoreScopedQuery, 'store_id'>;

export interface ProductListQuery extends StoreScopedQuery {
  category?: string;
  status?: ProductStatus | 'inactive' | 'all';
}

/** Table rows omit editor-only content and relational variant hydration. */
export type ProductListSummary = Pick<Product,
  'id' | 'name' | 'status' | 'stock' | 'price' | 'compare_price' | 'images' |
  'category' | 'product_type' | 'vendor' | 'is_active' | 'created_at' | 'version'>;

export interface ProductBarcodeLookupQuery extends QueryParams {
  store_id: string;
  barcode: string;
}

export type ProductBarcodeLookupResult = ProductBarcodeLookup | {
  store_id: string;
  barcode: string;
  product: Product;
  variant?: ProductVariant | null;
  matched_field: 'product.barcode' | 'variant.barcode';
};

export interface CategoryListQuery extends StoreScopedQuery {
  flat?: boolean;
}

// ── Smart collections ────────────────────────────────────────────
export type SmartConditionField =
  | 'title'
  | 'product_type'
  | 'vendor'
  | 'tag'
  | 'price'
  | 'inventory_quantity';

export type SmartConditionOp =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'lt';

export type SmartMatchType = 'all' | 'any';

export interface SmartCondition {
  field: SmartConditionField;
  op: SmartConditionOp;
  value: string;
}

export interface SmartCollection {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string | null;
  conditions: SmartCondition[];
  match_type: SmartMatchType;
  created_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  version: number;
}

export interface CreateSmartCollectionInput {
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  conditions: SmartCondition[];
  match_type?: SmartMatchType;
}

export type UpdateSmartCollectionInput = Partial<{
  name: string;
  slug: string;
  description: string | null;
  conditions: SmartCondition[];
  match_type: SmartMatchType;
}>;

export interface SmartCollectionListQuery extends QueryParams {
  store_id: string;
}

export interface SmartCollectionPreviewQuery extends QueryParams {
  store_id?: string;
}

export interface SmartCollectionPreviewResult {
  collection_id: string;
  match_type: SmartMatchType;
  condition_count: number;
  count: number;
  sample_product_ids: string[];
  evaluated_of: number;
  capped_at: number;
}

export interface InventoryLevelQuery extends StoreScopedQuery {
  product_id?: string;
  low_stock?: boolean;
}

// ── Purchase orders ──────────────────────────────────────────────
export interface PurchaseOrderLineInput {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_cost: number;
}

export interface CreatePurchaseOrderInput {
  store_id: string;
  supplier_id?: string | null;
  location_id: string;
  expected_at?: string;
  notes?: string;
  lines: PurchaseOrderLineInput[];
  idempotency_key: string;
}

export interface ReceivePurchaseOrderLineInput {
  purchase_order_line_id: string;
  quantity: number;
}

export interface ReceivePurchaseOrderInput {
  lines?: ReceivePurchaseOrderLineInput[];
  idempotency_key: string;
}

export interface PurchaseOrderLine extends JsonRecord {
  id: string;
  purchase_order_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_cost: number;
  received_quantity: number;
  created_at: string;
  updated_at?: string | null;
}

export interface PurchaseOrder extends JsonRecord {
  id: string;
  site_id: string;
  supplier_id?: string | null;
  location_id: string;
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
  po_number?: string | null;
  expected_at?: string | null;
  notes?: string | null;
  total_cost: number;
  created_at: string;
  updated_at?: string | null;
  supplier?: { name: string } | null;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderListQuery extends StoreScopedQuery {}

// ── Suppliers ────────────────────────────────────────────────────
export interface CreateSupplierInput {
  store_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: Record<string, unknown>;
}

export interface Supplier extends JsonRecord {
  id: string;
  site_id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
  created_at: string;
}

// ── Inventory locations ──────────────────────────────────────────
export interface CreateInventoryLocationInput {
  store_id: string;
  name: string;
  is_default?: boolean;
  address?: Record<string, unknown>;
}

export interface InventoryLocation extends JsonRecord {
  id: string;
  store_id: string;
  name: string;
  is_default: boolean;
  status: string;
  created_at: string;
}

// Phase 5.5 — typed exposure of the existing inventory transfer + reservation + history gateway routes.
export interface InventoryTransferLineInput {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface CreateInventoryTransferInput {
  store_id: string;
  source_location_id: string;
  destination_location_id: string;
  lines: InventoryTransferLineInput[];
  idempotency_key: string;
  notes?: string | null;
}

export interface ShipInventoryTransferInput {
  store_id: string;
  idempotency_key: string;
}

export interface ReceiveInventoryTransferLineInput {
  transfer_line_id: string;
  quantity_received: number;
}

export interface ReceiveInventoryTransferInput {
  store_id: string;
  lines: ReceiveInventoryTransferLineInput[];
  idempotency_key: string;
}

export interface InventoryTransfer extends JsonRecord {
  id: string;
  transfer_number: string;
  source_location_id: string;
  destination_location_id: string;
  status: string;
  created_at: string;
}

export interface InventoryTransferListQuery extends StoreScopedQuery {
  status?: string;
}

export interface ReserveInventoryInput {
  store_id: string;
  product_id: string;
  variant_id?: string | null;
  location_id: string;
  quantity: number;
  idempotency_key: string;
  ttl_seconds?: number;
  order_id?: string | null;
}

export interface InventoryReservationActionInput {
  store_id: string;
  reservation_id: string;
  idempotency_key: string;
  reason?: string | null;
}

export interface InventoryHistoryQuery extends StoreScopedQuery {
  product_id?: string;
  page?: number;
  limit?: number;
}

// ── Inventory reservations (read endpoint) ───────────────────────
export interface InventoryReservation extends JsonRecord {
  id: string;
  product_id: string;
  variant_id?: string | null;
  location_id?: string | null;
  quantity: number;
  status: string;
  expires_at?: string | null;
  order_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface InventoryReservationListQuery extends StoreScopedQuery {
  status?: string;
  product_id?: string;
  page?: number;
  limit?: number;
}

// ── Inventory receipts (read endpoint) ───────────────────────────
export interface InventoryReceipt extends JsonRecord {
  id: string;
  receipt_type: 'purchase_order' | 'transfer';
  purchase_order_id?: string | null;
  transfer_id?: string | null;
  quantity_received: number;
  notes?: string | null;
  received_at?: string | null;
  created_at: string;
}

export interface InventoryReceiptListQuery extends StoreScopedQuery {
  po_id?: string;
  transfer_id?: string;
  page?: number;
  limit?: number;
}

// ── Inventory analytics (read endpoint) ──────────────────────────
export interface InventoryAnalyticsResult extends JsonRecord {
  low_stock_count?: number;
  total_skus?: number;
  po_by_status?: Record<string, number>;
  transfer_by_status?: Record<string, number>;
}

export interface InventoryAnalyticsQuery extends StoreScopedQuery {
  [key: string]: string | number | boolean | undefined | null;
}

/** Compatibility name for the canonical adjustment history contract. */
export type InventoryEventRecord = InventoryHistoryEntry;

// ── Commerce Analytics types (Phase 5.10) ───────────────────

export interface CommerceAnalyticsQuery {
  store_id: string;
  [key: string]: string | number | boolean | undefined | null;
}

export interface SupplierMetricsRow extends JsonRecord {
  supplier_id: string | null;
  supplier_name: string;
  po_count: number;
  on_time_rate: number | null;
  avg_lead_time_days: number | null;
}

export interface SupplierMetricsResult extends JsonRecord {
  meta?: GatewayPaginationMeta;
  suppliers: SupplierMetricsRow[];
  schema_missing?: boolean;
}

export interface WarehouseMetricsRow extends JsonRecord {
  location_id: string;
  location_name: string;
  is_default: boolean;
  sku_count: number;
  total_units: number;
}

export interface WarehouseMetricsResult extends JsonRecord {
  meta?: GatewayPaginationMeta;
  warehouses: WarehouseMetricsRow[];
  schema_missing?: boolean | string;
}

export interface TransferMetricsResult extends JsonRecord {
  by_status: Record<string, number>;
  in_transit_count: number;
  total_count: number;
  schema_missing?: boolean;
}

export interface OperationsSummaryResult extends JsonRecord {
  order_count?: number;
  open_order_count?: number;
  po_count?: number;
  open_po_count?: number;
  transfer_count?: number;
  in_transit_transfer_count?: number;
  low_stock_sku_count?: number;
  total_sku_count?: number;
}

export interface OrderListQuery extends StoreScopedQuery {
  status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  customer_id?: string;
}

export interface DraftOrderListQuery extends StoreScopedQuery {
  status?: 'draft' | 'converted' | 'discarded' | 'all';
}

export interface CustomerListQuery extends StoreScopedQuery {
  status?: string;
  email?: string;
  phone?: string;
  has_orders?: boolean;
}

export interface NotificationListQuery extends ListQuery {
  is_read?: boolean;
  type?: string;
}

export interface NotificationInboxItem extends JsonRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string | null;
  data?: JsonRecord | null;
  action_url?: string | null;
  is_read: boolean;
  created_at: string;
  updated_at?: string | null;
}

export type DeviceTokenPlatform = 'ios' | 'android' | 'web';

export interface RegisterDeviceTokenInput extends JsonRecord {
  token: string;
  platform: DeviceTokenPlatform;
  device_name?: string | null;
}

export interface DeviceTokenRegistrationResult extends JsonRecord {
  registered: boolean;
  id?: string | null;
  token?: string | null;
  platform?: DeviceTokenPlatform | string | null;
}

export type SendWhatsAppInput = WhatsAppSendInput;

// ---------------------------------------------------------------------------
// Notification preferences + delivery logs (merchant operations vertical)
// ---------------------------------------------------------------------------

/** A row from notification_preferences (user_id/store_id/channel/category). */
export interface NotificationPreference extends JsonRecord {
  id: string;
  user_id: string;
  store_id: string | null;
  channel: string;
  category: string;
  enabled: boolean;
  created_at: string;
  updated_at?: string | null;
}

/** Query for GET /notifications/preferences */
export interface NotificationPreferenceQuery extends QueryParams {
  store_id?: string;
}

/** Body for PUT /notifications/preferences */
export interface NotificationPreferenceUpdateInput extends JsonRecord {
  store_id?: string | null;
  channel: string;
  category: string;
  enabled?: boolean;
}

/** A delivery-log row from GET /notifications/delivery-logs */
export interface NotificationDeliveryLog extends JsonRecord {
  id: string;
  site_id: string;
  user_id: string | null;
  channel: string;
  category: string;
  template_key: string;
  event_type: string | null;
  status: string;
  provider: string | null;
  attempt_count: number | null;
  error_message: string | null;
  metadata: JsonRecord | null;
  created_at: string;
  updated_at?: string | null;
}

/** Query for GET /notifications/delivery-logs */
export interface NotificationDeliveryLogsQuery extends QueryParams {
  site_id?: string;
  channel?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface WhatsAppTimelineQuery extends StoreScopedQuery {
  customer_email?: string;
  customer_phone?: string;
}

export interface MobileOnboardingProgressInput extends JsonRecord {
  site_type?: 'store' | 'portfolio' | 'resume' | 'blog' | 'landing_page';
  business_type: 'new' | 'existing';
  channels: string[];
  product_type: string;
  category: string;
}

export interface MobileOnboardingProgressResult extends JsonRecord {
  attempt_id: string;
  current_step: number;
  completed_steps: number[];
  survey_data: JsonRecord;
}

export interface ThemeListQuery extends ListQuery {
  category?: string;
  site_type?: string;
  pricing?: string;
  industry?: string;
  layout?: string;
  tag?: string;
  feature?: string;
  price_min?: number | string;
  price_max?: number | string;
  store_id?: string;
}

export type ThemeCatalogItem = Theme & {
  installed?: boolean;
  active?: boolean;
};

export interface ThemeCatalogResponse {
  data: ThemeCatalogItem[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
  next_cursor?: string | null;
  total_is_exact?: boolean;
  current_theme: string | null;
  current_theme_record?: ThemeCatalogItem | null;
  store_status: string | null;
}

export interface ThemeReviewListQuery extends ListQuery {
  status?: 'published' | 'pending' | 'rejected' | 'all';
}

export interface ThemeReviewCreateInput {
  rating: number;
  title: string;
  content: string;
}

export interface ThemeReviewReplyInput {
  developer_reply: string;
}

export type ThemeReviewRecord = JsonRecord & {
  id: string;
  user_id?: string;
  theme_id?: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  is_verified_purchase?: boolean | null;
  status?: string | null;
  developer_reply?: string | null;
  developer_replied_at?: string | null;
  created_at?: string | null;
};

export interface ThemeReviewSummary {
  average: number;
  total: number;
  distribution: Record<string, number>;
}

export interface ThemeReviewListResult {
  reviews: ThemeReviewRecord[];
  summary: ThemeReviewSummary;
}

export type ThemeCollectionRecord = JsonRecord & {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  themes?: ThemeCatalogItem[];
};

export interface ThemeSuggestionResult {
  themes: Array<{ slug: string; name: string; category?: string | null }>;
  tags: string[];
  industries: string[];
  features: string[];
}

export type ThemeAuthorProfile = JsonRecord & {
  id: string;
  handle: string;
  display_name: string;
  verification_status?: string;
  themes?: ThemeCatalogItem[];
};

export type ThemeDownloadPlatform = 'letbuyy' | 'wordpress' | 'html' | 'react';

export type ThemeDownloadArtifact = JsonRecord & {
  id: string;
  theme_id: string;
  platform: ThemeDownloadPlatform;
  file_name: string;
  size_bytes?: number | null;
  checksum_sha256?: string | null;
  delivery_status?: string | null;
  signed_url?: string | null;
  expires_at?: string | null;
};

export type ThemeDownloadGroup = JsonRecord & {
  theme: ThemeCatalogItem;
  purchase: JsonRecord;
  artifacts: ThemeDownloadArtifact[];
};

export type ThemePurchaseReceipt = JsonRecord & {
  id: string;
  purchase_id: string;
  receipt_number: string;
  invoice_number?: string | null;
  license_key?: string | null;
  amount_inr: number;
  currency: string;
  gst_rate: number;
  gst_amount_inr: number;
  receipt_status: string;
};

export interface ThemeMarketplaceSettingsInput {
  display_name?: string;
  support_email?: string;
  notification_preferences?: JsonRecord;
  saved_filters?: JsonRecord;
}

export type ThemeMarketplaceSettings = ThemeMarketplaceSettingsInput & JsonRecord & {
  id: string;
  user_id: string;
  plan_snapshot?: JsonRecord;
};

export interface ThemeSavedSearchInput {
  name: string;
  query: JsonRecord;
  alerts_enabled?: boolean;
}

export interface ThemeDeveloperListingInput {
  slug: string;
  name: string;
  short_description: string;
  long_description?: string;
  category: 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
  industries?: string[];
  tags?: string[];
  supported_platforms?: ThemeDownloadPlatform[];
  screenshots?: string[];
  pricing?: JsonRecord;
  license_tiers?: JsonRecord[];
  bundle_manifest?: JsonRecord;
  agreement_accepted?: boolean;
  submit?: boolean;
}

export type ThemeDeveloperListingResult = JsonRecord & {
  id: string;
  slug: string;
  submission_status: string;
  asset_scan_status: string;
};

export type StorefrontProductQuery = StorefrontDiscoveryQueryInput;

export type StorefrontStorePayload = Store & JsonRecord & {
  current_theme_release?: ThemeRelease | null;
};

export type StorefrontRenderRelease = {
  id: string;
  theme_id: string;
  theme_instance_id: string | null;
  theme_package_version_id: string | null;
  release_version: number;
  release_manifest: JsonRecord;
  schema_manifest_version: string;
  engine_version: string;
  published_at: string | null;
};
export type StorefrontRenderStorePayload = Omit<StorefrontStorePayload, 'current_theme_release' | 'template_config'> & {
  projection: 'render-v1';
  template_config: JsonRecord;
  current_theme_release: StorefrontRenderRelease | null;
};

export type StorefrontStoreStatusPayload = Partial<StorefrontStorePayload> & {
  id: string;
  name?: string | null;
  store_name?: string | null;
  subdomain?: string | null;
  site_type?: string | null;
  status: StoreStatus | string;
};

export type StorefrontContentPayload = JsonRecord & {
  id: string;
  title?: string | null;
  slug?: string | null;
  page_type?: string | null;
  policy_type?: string | null;
  content?: JsonRecord | string | null;
  seo?: JsonRecord | null;
  assigned_template_key?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

export type StorefrontBlogPostPayload = BlogPost & JsonRecord;

/** Private editor read; the server verifies the token, site and saved draft. */
export type ThemePreviewContentQuery = {
  resource: 'page' | 'article' | 'blog';
  resource_id?: string;
  page?: number;
  limit?: number;
};
export type ThemePreviewContentPayload = {
  resource: 'page' | 'article' | 'blog';
  content: StorefrontContentPayload | null;
  articles: StorefrontBlogPostPayload[];
  pagination: { page: number; limit: number; has_more: boolean; total?: number; total_pages?: number };
};

export type StorefrontCollectionSummary = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
};

export type StorefrontCollectionCursorQuery = { after?: string; before?: string };
export type StorefrontCollectionPage = {
  items: StorefrontCollectionSummary[];
  nextCursor: string | null;
  previousCursor: string | null;
};

export type StorefrontCollectionPayload = {
  collection: {
    id: string;
    title: string;
    description?: string | null;
    image_url?: string | null;
  };
  products: Product[];
  total: number;
  discovery?: StorefrontDiscoveryMetadata;
};

export type StorefrontLookupResult = JsonRecord & {
  status: 'invalid' | 'found' | 'not_found' | string;
  message?: string | null;
  store?: JsonRecord & {
    name?: string | null;
    subdomain?: string | null;
    status?: StoreStatus | string | null;
    siteType?: string | null;
  };
};

export type { StorefrontDirectoryPayload } from '@letbuyy/shared-types';

export interface StorefrontCouponValidationQuery extends QueryParams {
  code: string;
  subtotal?: string | number;
}

export type StorefrontCouponValidationResult = JsonRecord & {
  valid: boolean;
  error?: string | null;
  coupon?: JsonRecord & {
    code?: string;
    type?: string;
    value?: number;
    discount?: number;
    freeShipping?: boolean;
  };
};

export type StorefrontOrderContactSummary = {
  orders: JsonRecord[];
  hasOrders: boolean;
  hasPassword: boolean;
  store_id?: string | null;
};

export type StorefrontOrderCredentialInput = {
  store_id?: string | null;
  subdomain?: string | null;
  email_or_phone: string;
  password: string;
};

export type StorefrontOrderCredentialSaveResult = {
  saved: boolean;
  store_id?: string | null;
};

export type StorefrontOrderCredentialLoginResult = {
  valid: boolean;
  store_id?: string | null;
};

export type StorefrontCustomerRecord = JsonRecord;

export interface StorefrontCustomerLookupQuery extends QueryParams {
  store_id: string;
  email: string;
}

export type StorefrontCustomerFromOrderInput = {
  store_id: string;
  order_id: string;
};

export type StorefrontCustomerPasswordInput = StorefrontCustomerLookupQuery & {
  password: string;
  turnstile_token?: string | null;
  turnstileToken?: string | null;
};

export type StorefrontCustomerPasswordResetRequestInput = StorefrontCustomerLookupQuery & {
  reset_url?: string | null;
};

export type StorefrontCustomerPasswordResetConfirmInput = StorefrontCustomerPasswordInput & {
  token: string;
};

export type StorefrontCustomerStatsInput = StorefrontCustomerLookupQuery & {
  order_total: number;
  order_id: string;
};

export type StorefrontCustomerResult = {
  customer: StorefrontCustomerRecord | null;
  created?: boolean;
};

export type StorefrontCustomerPasswordResult = {
  customer_id?: string | null;
  customer?: StorefrontCustomerRecord | null;
};

export type StorefrontCustomerPasswordResetRequestResult = {
  accepted: boolean;
};

export type StorefrontCustomerStatsResult = {
  updated: boolean;
};

export interface StorefrontWishlistQuery extends QueryParams {
  customer_id: string;
  store_id: string;
}

export type StorefrontWishlistInput = StorefrontWishlistQuery & {
  product_id: string;
  variant_id?: string | null;
};

export type StorefrontWishlistSyncInput = StorefrontWishlistQuery & {
  product_ids: string[];
};

export type StorefrontWishlistResult = {
  product_ids: string[];
};

export type StorefrontCustomerOrdersResult = {
  orders: JsonRecord[];
};

export interface StorefrontCustomerSessionQuery extends QueryParams {
  customer_id: string;
  store_id: string;
  customer_email: string;
}

export type StorefrontCustomerProfileInput = {
  customer_id: string;
  store_id: string;
  full_name?: string | null;
  phone?: string | null;
  accepts_marketing?: boolean;
};

export type StorefrontCustomerProfileResult = {
  customer: StorefrontCustomerRecord | null;
};

export type StorefrontCustomerAddressRecord = CustomerAddress & {
  customer_email?: string | null;
  customer_phone?: string | null;
};

export type StorefrontCustomerAddressListResult = {
  addresses: StorefrontCustomerAddressRecord[];
};

export type StorefrontCustomerAddressInput = StorefrontCustomerSessionQuery & {
  customer_phone?: string | null;
  label?: string | null;
  full_name?: string;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string | null;
  landmark?: string | null;
  is_default?: boolean;
};

export type StorefrontCustomerAddressResult = {
  address: StorefrontCustomerAddressRecord;
};

export interface StorefrontProductReviewsQuery extends QueryParams {
  product_id: string;
  store_id: string;
}

export type StorefrontProductReviewInput = {
  product_id: string;
  store_id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  is_verified?: boolean;
  turnstile_token?: string | null;
  turnstileToken?: string | null;
};

export type StorefrontProductReviewSummary = {
  totalReviews: number;
  averageRating: number;
  distribution: Array<{ star: number; count: number }>;
};

export type StorefrontProductReviewsResult = {
  reviews: ProductReview[];
  summary: StorefrontProductReviewSummary;
};

export type StorefrontProductReviewResult = {
  review: ProductReview;
  message: string;
};

type NewRecord<T> = Partial<Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'>>;

export type CreateStoreInput = Pick<Store, 'name' | 'site_type'> & Partial<Pick<Store, 'subdomain' | 'tagline' | 'description' | 'currency' | 'locale' | 'timezone'>>;
export type UpdateStoreInput = Partial<NewRecord<Store>> & { status?: StoreStatus }
  & import('@letbuyy/shared-types').UpdateStorePaymentMethodsInput;
export type SaveStorePaymentConfigInput = import('@letbuyy/shared-types').SaveStorePaymentConfigInput;

export type UpdateStoreLocalizationInput = {
  default_locale?: string;
  currency?: string;
  timezone?: string;
};

export type CreateStoreMarketInput = Pick<StoreMarket, 'name' | 'country_code'> &
  Partial<Pick<StoreMarket, 'currency' | 'locale' | 'is_primary' | 'is_active' | 'price_adjustment_bps' | 'rounding_mode' | 'metadata'>>;
export type UpdateStoreMarketInput = Partial<Pick<StoreMarket, 'name' | 'country_code' | 'currency' | 'locale' | 'is_primary' | 'is_active' | 'price_adjustment_bps' | 'rounding_mode' | 'metadata'>>;

export type CreateStorefrontLocaleInput = Pick<StorefrontLocale, 'locale' | 'name'> &
  Partial<Pick<StorefrontLocale, 'status' | 'is_default' | 'metadata'>>;
export type UpdateStorefrontLocaleInput = Partial<Pick<StorefrontLocale, 'name' | 'status' | 'is_default' | 'metadata'>>;

export type CreateStorefrontTranslationInput = Pick<StorefrontTranslation, 'locale' | 'resource_type' | 'resource_id' | 'field' | 'translated_text'> &
  Partial<Pick<StorefrontTranslation, 'source_text' | 'status' | 'metadata'>>;
export type UpdateStorefrontTranslationInput = Partial<Pick<StorefrontTranslation, 'source_text' | 'translated_text' | 'status' | 'metadata'>>;
export type StoreMetafieldDefinitionQuery = Pick<StoreScopedQuery, 'store_id'> & {
  owner_type?: StoreMetafieldOwnerType;
};
export type StoreMetafieldValueQuery = StoreMetafieldDefinitionQuery & {
  owner_id?: string;
};
export type CreateStoreMetafieldDefinitionInput = Pick<StoreMetafieldDefinition, 'store_id' | 'key' | 'name'> &
  Partial<Pick<StoreMetafieldDefinition, 'owner_type' | 'namespace' | 'description' | 'value_type' | 'validation_rules' | 'is_required' | 'is_public' | 'sort_order' | 'metadata'>>;
export type UpdateStoreMetafieldDefinitionInput = Partial<Pick<StoreMetafieldDefinition, 'owner_type' | 'namespace' | 'key' | 'name' | 'description' | 'value_type' | 'validation_rules' | 'is_required' | 'is_public' | 'sort_order' | 'metadata'>>;
export type UpsertStoreMetafieldValueInput = Pick<StoreMetafieldValue, 'store_id' | 'definition_id' | 'owner_type' | 'owner_id'> & {
  value: StoreMetafieldJsonValue;
  metadata?: StoreMetafieldValue['metadata'];
};
export type EmployeeListQuery = Pick<StoreScopedQuery, 'store_id'>;
export interface StaffInvitationSummary {
  id: string; store_id: string; expires_at: string; delivery_status: string; status: string; wakeup: string; accept_url: string;
}
export type StaffInvitationResult = Employee & { invitation: StaffInvitationSummary };
export type CreateStaffInvitationInput = Pick<Employee, 'store_id' | 'email'> & Partial<Employee> & { employee_id?: string; expected_updated_at?: string };
export interface StaffInvitationPreview {
  id: string; store_id: string; store_name: string; role: string; permissions: Record<string, unknown>; expires_at: string; status: 'pending' | 'accepted';
}
export interface StaffInvitationAcceptance { employee: Employee; store_handle: string; accepted: true }

export type CreateEmployeeInput = Pick<Employee, 'store_id' | 'email'> & Partial<Employee>;
export type UpdateEmployeeInput = Partial<Pick<Employee, 'role' | 'permissions' | 'status' | 'is_active'>> & { expected_updated_at?: string; store_id?: string };
// Plan-driven staff seat usage (how many staff the store's plan allows vs uses).
// staff_limit === null means unlimited (e.g. Enterprise).
export type EmployeeStaffLimit = {
  staff_limit: number | null;
  staff_used: number;
  plan_slug: string;
  plan_name: string;
};
export interface MediaListQuery extends StoreScopedQuery {
  folder?: string;
  type?: MediaType | 'all';
}
export type CreateMediaInput = Pick<MediaAsset, 'store_id' | 'filename' | 'url' | 'mime_type'> & Partial<MediaAsset>;
export type UpdateMediaInput = Partial<Pick<MediaAsset, 'alt_text' | 'caption' | 'folder' | 'tags' | 'filename'>>;
export type CreateProductInput = Pick<Product, 'store_id' | 'name' | 'price'> & NewRecord<Product>;
export type UpdateProductInput = NewRecord<Product> & Pick<Product, 'version'> & {
  /** Retain one UUID for this exact edit through transport retries. */
  idempotency_key: string;
};
export type CreateCollectionInput = Pick<Collection, 'store_id' | 'title'> & NewRecord<Collection>;
export type UpdateCollectionInput = Partial<Pick<Collection, 'title' | 'description' | 'image_url'>> & {
  is_active?: boolean;
};
export type CreateProductCategoryInput = Pick<ProductCategory, 'store_id' | 'name'> & NewRecord<ProductCategory>;
export type UpdateProductCategoryInput = NewRecord<ProductCategory>;
export type CreateGiftCardInput = Pick<GiftCard, 'store_id' | 'initial_value'> & {
  currency?: string;
  expires_at?: string | null;
  recipient_email?: string | null;
  recipient_name?: string | null;
  note?: string | null;
} & NewRecord<GiftCard>;
// LB-11 — gift card lifecycle surfaces (canonical gift_card_accounts model).
export interface GiftCardLifecycleItem {
  id: string;
  store_id: string;
  code_last4: string;
  initial_value: number;
  balance: number;
  currency: string;
  status: 'active' | 'held' | 'disabled' | 'expired';
  fraud_hold_reason?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  recipient_email?: string | null;
  redemption_count?: number;
}
export interface GiftCardIssued extends GiftCardLifecycleItem {
  // The plaintext code is returned exactly once, at issuance.
  code: string;
}
export interface GiftCardBalanceResult {
  found: boolean;
  id?: string;
  code_last4?: string;
  initial_value?: number;
  balance?: number;
  currency?: string;
  status?: string;
  expires_at?: string | null;
  redeemable?: boolean;
}
export interface GiftCardTransactionsResult {
  found: boolean;
  id?: string;
  code_last4?: string;
  balance?: number;
  status?: string;
  ledger?: Array<{ id: string; entry_type: string; amount: number; balance_after: number; order_id?: string | null; created_at: string; metadata?: Record<string, unknown> }>;
  redemptions?: Array<{ id: string; order_id: string; amount: number; status: string; created_at: string }>;
}
export interface GiftCardStatusUpdateInput {
  store_id: string;
  status: 'active' | 'held' | 'disabled';
  reason?: string | null;
}
export type InventoryAdjustInput = {
  product_id: string;
  variant_id?: string | null;
  location_id?: string | null;
  adjustment: number;
  reason: InventoryAdjustmentReason;
  notes?: string | null;
};
export type ProductImportInput = import('@letbuyy/shared-types').ProductCsvImportInput;
export interface ExportJobSummary extends JsonRecord {
  id: string;
  type: 'products' | 'orders' | 'customers' | 'product_import';
  status: 'queued' | 'running' | 'completed' | 'failed';
  row_count: number;
  filename: string;
  download_url: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}
export type ProductImportResult = {
  job: ExportJobSummary;
};
export type ShippingLabelProvider = 'shiprocket' | 'delhivery' | 'pickrr';
export type ShippingLabelPackage = {
  weight_grams?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
};
export type ShippingLabelRateInput = {
  order_id: string;
  provider?: ShippingLabelProvider;
  package?: ShippingLabelPackage;
};
export type ShippingLabelBuyInput = ShippingLabelRateInput & {
  idempotency_key: string;
};
export interface ShippingLabelRecord extends JsonRecord {
  id: string;
  site_id: string;
  order_id: string;
  provider: ShippingLabelProvider;
  carrier: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
  label_url?: string | null;
  status: string;
  test_mode: boolean;
  content_type?: string | null;
  pdf_base64?: string | null;
}
export type ShippingLabelRate = {
  provider: ShippingLabelProvider;
  currency: 'INR';
  amount: number;
  service_level: string;
  estimated_delivery_days: number;
  test_mode: boolean;
  provider_mode: 'sandbox' | 'live';
};
export type ShippingLabelProviderModeResponse = {
  provider_mode: 'sandbox' | 'live';
};
export type CreatePayoutStatementInput = {
  store_id: string;
  idempotency_key: string;
  period_start?: string;
  period_end?: string;
};
export type SettlePayoutStatementInput = {
  idempotency_key: string;
};
export type ReconcileCommissionInput = {
  store_id: string;
  idempotency_key: string;
};
export type CodReconciliationQuery = {
  store_id: string;
  status?: CodReconciliationStatus | 'all';
  limit?: number;
};
export type CollectCodInput = {
  store_id: string;
  order_id: string;
  collected_amount_minor?: number;
  notes?: string;
  idempotency_key: string;
};
export type ReconcileCodInput = {
  store_id: string;
  deposited_amount_minor?: number;
  notes?: string;
  idempotency_key: string;
};
export type SubmitKycDocumentInput = {
  store_id: string;
  document_type: MerchantKycDocumentType;
  document_number_last4?: string;
  file_url?: string;
  file_name?: string;
  idempotency_key?: string;
};
export type VerifyTotpInput = {
  factor_id: string;
  code: string;
};
export type DisableTwoFactorInput = {
  factor_id: string;
  code?: string;
};
export type ThemeInstallInput = {
  store_id: string;
  config_overrides?: JsonRecord;
  expected_version?: string;
  expected_package_id?: string;
  expected_package_version_id?: string;
};
export type ThemeInstallResult = {
  installation: JsonRecord;
  theme: Pick<Theme, 'id' | 'slug' | 'name'> & { version?: string };
  release?: JsonRecord;
  already_installed?: boolean;
  theme_instance_id?: string;
  installed_version?: string;
  theme_package_id?: string;
  theme_package_version_id?: string;
};
export type ThemePurchaseOrderInput = {
  currency?: 'INR';
  idempotency_key?: string;
};
export type ThemePurchaseOrderResult = {
  purchase_id: string;
  theme: string;
  status: string;
  already_purchased?: boolean;
  payment_required?: boolean;
  provider?: 'razorpay' | 'free' | string;
  razorpay_order_id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  idempotent_replay?: boolean;
};
export type ThemePurchaseVerifyInput = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
export type ThemePurchaseVerifyResult = {
  purchase_id: string;
  theme: string;
  status: string;
  provider_payment_id?: string | null;
};
export type ThemePackageUploadInput = {
    store_id?: string;
  bundle: JsonRecord;
  submission_mode?: 'marketplace' | 'private_install';
};
export type ThemePackageUploadResult = {
  theme: Pick<Theme, 'id' | 'slug' | 'name'>;
  package: {
    id: string;
    slug: string;
    name: string;
    status: string;
  };
  version: {
    id: string;
    version: string;
    version_number: number;
    release_status: string;
  };
  schema_manifest_version: string;
  renderer_version: string;
  installable: boolean;
  review_record?: MarketplaceReviewRecord | null;
};
export type SaveThemeDraftInput = {
  store_id: string;
  template_key?: string;
  template_config: JsonRecord;
  base_version: number;
  idempotency_key: string;
  client?: 'admin-web' | 'flutter-builder' | 'api';
};
export type ReorderThemeDraftInput = Omit<SaveThemeDraftInput, 'template_config'> & { section_order: string[] };
export type PublishThemeInput = {
  store_id: string;
  template_key?: string;
  template_config?: JsonRecord;
  base_version: number;
  idempotency_key: string;
  make_store_live?: boolean;
  publish_message?: string;
};
export type ThemePreviewSessionInput = {
  store_id: string;
  template_key?: string;
  ttl_seconds?: number;
};
export type RollbackThemeReleaseInput = {
  store_id: string;
  expected_current_release_id: string;
  idempotency_key: string;
  make_store_live?: boolean;
  rollback_message?: string;
};
export type CreateOrderInput = Pick<Order, 'store_id' | 'line_items' | 'currency'> & NewRecord<Order>;
export type StorefrontCreateOrderInput = {
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: {
      address: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>;
  paymentMethod?: 'razorpay' | 'stripe' | 'paypal' | 'cashfree' | 'cod';
  deliveryOption?: 'standard' | 'express';
  notes?: string;
  couponCode?: string;
  giftCardCode?: string;
  shippingRateId?: string | null;
  /** Buyer-reviewed shipping amount in INR paise, used only to reject a stale quote. */
  shippingAmountMinor?: number | null;
  idempotencyKey: string;
};
export type StorefrontOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
};
export type StorefrontCreateOrderResult = {
  order: StorefrontOrderSummary;
};
export type UpdateOrderInput = Partial<Pick<Order, 'status' | 'payment_status' | 'fulfillment_status' | 'tracking_number' | 'tracking_url' | 'notes'>> & {
  idempotency_key?: string;
  carrier?: string;
  cancellation_reason?: string;
  version?: number;
};
export type FulfillOrderInput = Partial<Pick<Order, 'tracking_number' | 'tracking_url'>> & {
  idempotency_key: string;
  location_id?: string | null;
  lines?: Array<{ order_item_id: string; quantity: number }>;
  carrier?: string;
  logistics_provider?: 'shiprocket' | 'delhivery' | 'pickrr';
  create_shipping_label?: boolean;
  package_weight_grams?: number;
  package_dimensions_cm?: {
    length: number;
    width: number;
    height: number;
  };
};
export type OrderLineItemPatchInput = {
  order_item_id: string;
  quantity: number;
};
export type OrderLineItemAddInput = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
};
export type UpdateOrderLineItemsInput = {
  idempotency_key: string;
  lines?: OrderLineItemPatchInput[];
  add_items?: OrderLineItemAddInput[];
  remove_line_item_ids?: string[];
  notes?: string;
};
export type DraftOrderLineInput = {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
};
export type CreateDraftOrderInput = {
  store_id: string;
  idempotency_key: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  customer_gstin?: string;
  shipping_address?: JsonRecord;
  items: DraftOrderLineInput[];
  payment_method?: 'razorpay' | 'stripe' | 'cashfree' | 'cod';
  shipping_method?: 'standard' | 'express';
  notes?: string;
  coupon_code?: string;
  gift_card_code?: string;
};
export type ConvertDraftOrderInput = {
  idempotency_key: string;
};
export type ConvertDraftOrderResult = {
  draft_order: DraftOrder;
  order: Order;
};
export type ReturnStatus =
  | 'requested'
  | 'authorized'
  | 'rejected'
  | 'received'
  | 'inspected'
  | 'approved'
  | 'refunded'
  | 'closed'
  | 'cancelled';
export type ReturnRecord = JsonRecord & {
  id: string;
  store_id: string;
  site_id: string;
  order_id: string;
  status: ReturnStatus;
  refund_id?: string | null;
  refund_status?: string | null;
  refund_amount?: number | string | null;
};
export type ReturnLineInput = {
  order_item_id: string;
  quantity: number;
  restock_quantity?: number;
};
export type CreateReturnInput = {
  order_id: string;
  idempotency_key: string;
  lines?: ReturnLineInput[];
  reason?: string;
  refund_method?: 'original_payment' | 'gift_card' | 'manual';
  restock?: boolean;
};
export type UpdateReturnStatusInput = {
  status: ReturnStatus;
  notes?: string;
};
export type CompleteReturnRefundInput = {
  idempotency_key: string;
  refund_id?: string;
  provider_refund_id?: string;
  provider_event_id?: string;
  notes?: string;
};
export type UpdateCustomerInput = Partial<Pick<Customer, 'first_name' | 'last_name' | 'phone' | 'notes' | 'tags' | 'accepts_marketing'>>;
export type CreateCustomerInput = { store_id: string; email: string; first_name: string } & Partial<Pick<Customer, 'last_name' | 'phone' | 'notes' | 'tags' | 'accepts_marketing'>>;
export type CreateCustomerNoteInput = {
  store_id: string;
  note: string;
};
export type UpdateCustomerTagsInput = {
  store_id: string;
  tags: string[];
};
export type SendCustomerEmailInput = {
  store_id: string;
  subject: string;
  message: string;
};
export type MergeCustomerInput = {
  store_id: string;
  target_email: string;
};
export type CreateCustomerSegmentInput = Pick<CustomerSegment, 'store_id' | 'name' | 'rules'> & Partial<Pick<CustomerSegment, 'description'>>;
export type UpdateCustomerSegmentInput = Partial<Pick<CustomerSegment, 'name' | 'description' | 'rules'>>;
export type PreviewCustomerSegmentInput = Pick<CustomerSegment, 'store_id' | 'rules'>;
export type CreateMarketingEmailCampaignInput = Pick<MarketingEmailCampaign, 'store_id' | 'name' | 'subject' | 'body_text'> & Partial<Pick<MarketingEmailCampaign, 'preview_text' | 'body_html' | 'scheduled_at' | 'metadata'>> & {
  audience: MarketingEmailAudience;
};
export type UpdateMarketingEmailCampaignInput = Partial<Pick<MarketingEmailCampaign, 'name' | 'subject' | 'preview_text' | 'body_text' | 'body_html' | 'scheduled_at' | 'metadata' | 'status'>> & {
  audience?: MarketingEmailAudience;
};
export type PreviewMarketingEmailAudienceInput = {
  store_id: string;
  audience: MarketingEmailAudience;
};
export type SendMarketingEmailCampaignInput = {
  store_id: string;
  idempotency_key: string;
};
export type CreateCustomerAddressInput = Pick<CustomerAddress, 'store_id' | 'full_name' | 'address_line1' | 'city' | 'state' | 'postal_code'> & NewRecord<CustomerAddress>;
export type UpdateCustomerAddressInput = NewRecord<CustomerAddress>;
export type CreatePageInput = Pick<Page, 'store_id' | 'title' | 'slug'> & NewRecord<Page>;
export type UpdatePageInput = NewRecord<Page>;
export type CreatePolicyInput = Pick<Policy, 'store_id' | 'policy_type' | 'title'> & NewRecord<Policy>;
export type UpdatePolicyInput = Partial<Pick<Policy, 'policy_type' | 'slug' | 'title' | 'body' | 'status' | 'seo_title' | 'seo_description'>>;
export type NavigationItemInput = Pick<NavigationItem, 'label'> & Partial<Pick<NavigationItem, 'id' | 'url' | 'target_type' | 'target_resource_id' | 'parent_item_id' | 'sort_order' | 'is_visible' | 'open_in_new_tab'>>;
export type ReplaceNavigationInput = {
  store_id: string;
  location: string;
  name?: string;
  items?: NavigationItemInput[];
};
export type CreateBlogPostInput = Pick<BlogPost, 'store_id' | 'title' | 'content'> & NewRecord<BlogPost> & {
  tag_ids?: string[];
};
export type UpdateBlogPostInput = NewRecord<BlogPost> & {
  tag_ids?: string[];
  version?: number;
};
export type UpdateBlogCommentInput = Pick<BlogComment, 'status'>;
export type UpdateFormSubmissionInput = Pick<FormSubmission, 'status'>;
export type UpdateProductReviewInput = Pick<ProductReview, 'status'>;
export interface ProductReviewReplyInput extends JsonRecord {
  message: string;
}
export type CreateResumeContentItemInput = Pick<ResumeContentItem, 'store_id'> & Partial<ResumeContentItem>;
export type UpdateResumeContentItemInput = Partial<ResumeContentItem>;
export type ShippingTaxListQuery = StoreScopedQuery;
export type CreateShippingZoneInput = Pick<ShippingZone, 'store_id' | 'name' | 'countries'> & Partial<ShippingZone>;
export type UpdateShippingZoneInput = Partial<ShippingZone>;
export type CreateShippingRateInput = Pick<ShippingRate, 'zone_id' | 'name' | 'type'> & Partial<ShippingRate>;
export type UpdateShippingRateInput = Partial<ShippingRate>;
export type CreateTaxRateInput = Pick<TaxRate, 'store_id' | 'name' | 'rate'> & Partial<TaxRate>;
export type UpdateTaxRateInput = Partial<TaxRate>;
export type CreateCouponInput = Pick<Coupon, 'store_id' | 'code' | 'type' | 'value'> & NewRecord<Coupon>;
export type UpdateCouponInput = NewRecord<Coupon>;
export type CreatePaymentInput = Pick<Payment, 'store_id' | 'provider' | 'method' | 'currency' | 'amount' | 'amount_minor' | 'idempotency_key'> & NewRecord<Payment>;
export type CreateSubscriptionOrderInput = {
  store_id: string;
  plan_slug: string;
  billing_period?: SubscriptionBillingPeriod;
  site_type: string;
  approved_usage_charges?: Array<{
    meter_name: string;
    description?: string;
    amount_minor: number;
    quantity?: number;
    idempotency_key: string;
  }>;
  coupon_code?: string;
};
export type VerifySubscriptionInput = {
  store_id: string;
  plan_slug: string;
  billing_period?: SubscriptionBillingPeriod;
  site_type: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  coupon_code?: string;
};
export type ValidateSubscriptionCouponInput = {
  store_id: string;
  plan_slug: string;
  billing_period?: SubscriptionBillingPeriod;
  site_type: string;
  coupon_code: string;
};
export type SubscriptionCouponResult = {
  valid: boolean;
  code?: string;
  message?: string;
  discount_type?: string;
  percent_off?: number | null;
  amount_off_minor?: number | null;
  discount_minor?: number;
  final_minor?: number;
  amount_minor?: number;
  description?: string | null;
};
export type CancelSubscriptionInput = {
  store_id: string;
  reason?: string;
};
export type RecoverSubscriptionPaymentInput = {
  store_id: string;
  billing_period?: SubscriptionBillingPeriod;
  idempotency_key?: string;
};

// ── Billing payment methods (how the merchant pays LetBuyy) ──────────────────
// A billing mandate is a Razorpay UPI AutoPay authorization. LetBuyy is not an
// RBI-licensed payment aggregator, so card/UPI credentials are never stored here —
// Razorpay (the licensed PA) holds them and we keep only the mandate reference.
export type BillingMandate = {
  id: string;
  provider: string;
  provider_mode: 'sandbox' | 'live';
  status: 'pending_provider' | 'active' | 'revoked' | 'failed';
  plan_slug: string;
  billing_period: SubscriptionBillingPeriod;
  currency: string;
  amount_minor: number;
  external_mandate_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type CreateBillingMandateInput = {
  store_id: string;
  plan_slug?: 'free' | 'starter' | 'business' | 'enterprise';
  billing_period?: SubscriptionBillingPeriod;
  provider_mode?: 'sandbox' | 'live';
  upi_vpa?: string;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
};
// A past bill: a billing_history row joined to its GST invoice (if issued).
export type BillingInvoiceRecord = {
  id: string;
  invoice_number?: string | null;
  description?: string | null;
  amount?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  billing_period?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  created_at?: string | null;
  merchant_billing_invoices?: Array<Record<string, unknown>> | Record<string, unknown> | null;
};

export class LetbuyyApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly body: unknown;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    requestId?: string | null;
    body?: unknown;
  }) {
    super(input.message);
    this.name = 'LetbuyyApiError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.body = input.body;
  }
}

function idempotencyKeyFromBody(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const value = body.idempotency_key ?? body.idempotencyKey;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function automaticIdempotencyKey(method: HttpMethod, path: string): string {
  const normalizedPath = path
    .replace(/[^A-Za-z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  return `auto:${method}:${normalizedPath}:${random}`;
}

function withAutomaticIdempotency(path: string, options: LetbuyyRequestOptions): LetbuyyRequestOptions {
  const method = options.method ?? 'GET';
  if (method === 'GET' || options.idempotencyKey) return options;

  return {
    ...options,
    idempotencyKey: idempotencyKeyFromBody(options.body) ?? automaticIdempotencyKey(method, path),
  };
}

export interface FoundingProgramPublic {
  available: boolean;
  active?: boolean;
  paused?: boolean;
  total_slots?: number;
  used_slots?: number;
  remaining_slots?: number;
  public_remaining?: number;
  invited_remaining?: number;
  partner_remaining?: number;
  launch_price?: number;
  growth_price?: number;
}

export interface FoundingProgramRemaining {
  total_slots: number;
  used_slots: number;
  remaining_slots: number;
  active: boolean;
  paused: boolean;
}

export interface FoundingPlanPricing {
  slug: string;
  name: string;
  tagline: string | null;
  is_popular: boolean;
  display_order: number;
  status: string;
  purchasable: boolean;
  regular_inr: number;
  founding_inr: number;
  savings_inr: number;
  has_founding: boolean;
  features: string[];
}

export interface FoundingPricingResponse {
  plans: FoundingPlanPricing[];
  founding_program: FoundingProgramPublic;
}

export interface MerchantFoundingStatus {
  is_founding_merchant: boolean;
  founding_number: number | null;
  allocation_source: string | null;
  price_lock_enabled: boolean;
  locked_launch_price: number | null;
  locked_growth_price: number | null;
  founding_allocated_at: string | null;
  allocation: Record<string, unknown> | null;
}

export interface FoundingAllocationRow {
  id: string;
  site_id: string;
  founding_number: number;
  allocation_source: string;
  plan_slug: string;
  locked_monthly_price: number;
  allocated_at: string;
  released_at: string | null;
  release_reason: string | null;
  founding_released: boolean;
}

export interface FoundingAdminOverview {
  program: Record<string, unknown> | null;
  reconcile: Record<string, unknown> | null;
}

export class LetbuyyApiClient {
  private readonly baseUrl: string;
  private readonly apiVersionPath: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultToken: string | null;
  private readonly defaultStoreId: string | null;
  private readonly defaultHeaders: HeadersInit | undefined;
  private readonly getHeaders: LetbuyyApiClientOptions['getHeaders'];

  constructor(options: LetbuyyApiClientOptions) {
    if (!options.baseUrl.trim()) {
      throw new Error('LetBuyy API client requires a baseUrl');
    }

    const apiVersionPath = normalizePath(options.apiVersionPath ?? '/v1');
    const trimmedBaseUrl = trimTrailingSlash(options.baseUrl.trim());

    this.apiVersionPath = apiVersionPath;
    this.baseUrl = trimmedBaseUrl.endsWith(apiVersionPath)
      ? trimTrailingSlash(trimmedBaseUrl.slice(0, -apiVersionPath.length))
      : trimmedBaseUrl;
    this.fetchImpl = options.fetch ?? fetch;
    this.defaultToken = options.token ?? null;
    this.defaultStoreId = options.storeId ?? null;
    this.defaultHeaders = options.headers;
    this.getHeaders = options.getHeaders;
  }

  readonly graphql: LetbuyyGraphQLSdk = createLetbuyyGraphQLSdk(this);
  readonly reels = createReelReviewSdk(this);

  readonly stores = {
    list: (query?: ListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<StoreSummary>('/stores', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}`, options),
    health: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StoreHealth>(`/stores/${encodePathSegment(id)}/health`, options),
    getBySubdomain: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/public/${encodePathSegment(subdomain)}`, options),
    getByHandle: (handle: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StoreSummary>(`/stores/handle/${encodePathSegment(handle)}`, options),
    create: (input: CreateStoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>('/stores', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateStoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    publish: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Store>(`/stores/${encodePathSegment(id)}/publish`, { ...options, method: 'POST' }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/stores/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    paymentConfig: {
      get: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<StorePaymentConfig>(`/stores/${encodePathSegment(id)}/payment-config`, options),
      save: (id: string, input: SaveStorePaymentConfigInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorePaymentConfig>(`/stores/${encodePathSegment(id)}/payment-config`, { ...options, method: 'POST', body: input }),
      updateMethods: (id: string, input: import('@letbuyy/shared-types').UpdateStorePaymentMethodsInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorePaymentConfig>(`/stores/${encodePathSegment(id)}/payment-config`, { ...options, method: 'PATCH', body: input }),
    },
    localization: {
      get: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreLocalizationSummary>(`/stores/${encodePathSegment(id)}/localization`, options),
      update: (id: string, input: UpdateStoreLocalizationInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreLocalizationSummary>(`/stores/${encodePathSegment(id)}/localization`, { ...options, method: 'PATCH', body: input }),
      createMarket: (id: string, input: CreateStoreMarketInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMarket>(`/stores/${encodePathSegment(id)}/localization/markets`, { ...options, method: 'POST', body: input }),
      updateMarket: (id: string, marketId: string, input: UpdateStoreMarketInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMarket>(`/stores/${encodePathSegment(id)}/localization/markets/${encodePathSegment(marketId)}`, { ...options, method: 'PATCH', body: input }),
      deleteMarket: (id: string, marketId: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(`/stores/${encodePathSegment(id)}/localization/markets/${encodePathSegment(marketId)}`, { ...options, method: 'DELETE' }),
      createLocale: (id: string, input: CreateStorefrontLocaleInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorefrontLocale>(`/stores/${encodePathSegment(id)}/localization/locales`, { ...options, method: 'POST', body: input }),
      updateLocale: (id: string, localeId: string, input: UpdateStorefrontLocaleInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorefrontLocale>(`/stores/${encodePathSegment(id)}/localization/locales/${encodePathSegment(localeId)}`, { ...options, method: 'PATCH', body: input }),
      deleteLocale: (id: string, localeId: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(`/stores/${encodePathSegment(id)}/localization/locales/${encodePathSegment(localeId)}`, { ...options, method: 'DELETE' }),
      createTranslation: (id: string, input: CreateStorefrontTranslationInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorefrontTranslation>(`/stores/${encodePathSegment(id)}/localization/translations`, { ...options, method: 'POST', body: input }),
      updateTranslation: (id: string, translationId: string, input: UpdateStorefrontTranslationInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StorefrontTranslation>(`/stores/${encodePathSegment(id)}/localization/translations/${encodePathSegment(translationId)}`, { ...options, method: 'PATCH', body: input }),
      deleteTranslation: (id: string, translationId: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(`/stores/${encodePathSegment(id)}/localization/translations/${encodePathSegment(translationId)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly auth = {
    session: (options?: LetbuyyRequestOptions) =>
      this.request<AuthSessionResponse>('/auth/custom/session', options),
  };

  readonly notifications = {
    list: (query: NotificationListQuery = {}, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<NotificationInboxItem>('/notifications', { ...options, query }),
    unreadCount: (options?: LetbuyyRequestOptions) =>
      this.request<{ count: number }>('/notifications/count', options),
    markRead: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ marked: boolean }>(
        `/notifications/${encodePathSegment(id)}/read`,
        { ...options, method: 'PATCH' },
      ),
    markAllRead: (options?: LetbuyyRequestOptions) =>
      this.requestData<{ marked_all: boolean }>(
        '/notifications/read-all',
        { ...options, method: 'POST' },
      ),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(
        `/notifications/${encodePathSegment(id)}`,
        { ...options, method: 'DELETE' },
      ),
    registerDeviceToken: (input: RegisterDeviceTokenInput, options?: LetbuyyRequestOptions) =>
      this.requestData<DeviceTokenRegistrationResult>(
        '/notifications/device-tokens',
        { ...options, method: 'POST', body: input },
      ),
    unregisterDeviceToken: (token: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(
        '/notifications/device-tokens',
        { ...options, method: 'DELETE', body: { token } },
      ),
    preferences: {
      /** GET /notifications/preferences — list preferences for the authed user, optionally scoped to a store. */
      list: (query: NotificationPreferenceQuery = {}, options?: LetbuyyRequestOptions) =>
        this.requestData<NotificationPreference[]>('/notifications/preferences', { ...options, query }),
      /** PUT /notifications/preferences — upsert a single channel+category preference. */
      update: (input: NotificationPreferenceUpdateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<NotificationPreference>('/notifications/preferences', { ...options, method: 'PUT', body: input }),
    },
    /** GET /notifications/delivery-logs — paginated delivery evidence for a store. */
    deliveryLogs: (query: NotificationDeliveryLogsQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<NotificationDeliveryLog>('/notifications/delivery-logs', { ...options, query }),
  };

  readonly metafields = {
    definitions: {
      list: (query: StoreMetafieldDefinitionQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMetafieldDefinition[]>('/metafields/definitions', { ...options, query }),
      create: (input: CreateStoreMetafieldDefinitionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMetafieldDefinition>('/metafields/definitions', { ...options, method: 'POST', body: input }),
      update: (definitionId: string, input: UpdateStoreMetafieldDefinitionInput, query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMetafieldDefinition>(
          `/metafields/definitions/${encodePathSegment(definitionId)}`,
          { ...options, method: 'PATCH', query, body: input },
        ),
      remove: (definitionId: string, query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(
          `/metafields/definitions/${encodePathSegment(definitionId)}`,
          { ...options, method: 'DELETE', query },
        ),
    },
    values: {
      list: (query: StoreMetafieldValueQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMetafieldsSummary>('/metafields/values', { ...options, query }),
      upsert: (input: UpsertStoreMetafieldValueInput, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreMetafieldValue>('/metafields/values', { ...options, method: 'PUT', body: input }),
      remove: (valueId: string, query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(
          `/metafields/values/${encodePathSegment(valueId)}`,
          { ...options, method: 'DELETE', query },
        ),
    },
  };

  readonly whatsapp = {
    status: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<WhatsAppCapability>('/whatsapp/status', { ...options, query }),
    templates: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<WhatsAppTemplate[]>('/whatsapp/templates', { ...options, query }),
    timeline: (query: WhatsAppTimelineQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<WhatsAppMessage[]>('/whatsapp/timeline', { ...options, query }),
    send: (input: SendWhatsAppInput, options?: LetbuyyRequestOptions) =>
      this.requestData<WhatsAppSendResult>('/whatsapp/send', { ...options, method: 'POST', body: input }),
  };

  readonly marketing = {
    emailCampaigns: {
      list: (query: { store_id: string; page?: number; limit?: number; status?: MarketingEmailCampaign['status'] }, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<MarketingEmailCampaign>('/marketing/email-campaigns', { ...options, query }),
      create: (input: CreateMarketingEmailCampaignInput, options?: LetbuyyRequestOptions) =>
        this.requestData<MarketingEmailCampaign>('/marketing/email-campaigns', { ...options, method: 'POST', body: input }),
      get: (id: string, query: { store_id: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<{ campaign: MarketingEmailCampaign; recipients: MarketingEmailRecipient[] }>(`/marketing/email-campaigns/${encodePathSegment(id)}`, { ...options, query }),
      update: (id: string, input: UpdateMarketingEmailCampaignInput, query: { store_id: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<MarketingEmailCampaign>(`/marketing/email-campaigns/${encodePathSegment(id)}`, { ...options, method: 'PATCH', query, body: input }),
      previewAudience: (input: PreviewMarketingEmailAudienceInput, options?: LetbuyyRequestOptions) =>
        this.requestData<MarketingEmailAudiencePreview>('/marketing/email-campaigns/audience-preview', { ...options, method: 'POST', body: input }),
      send: (id: string, input: SendMarketingEmailCampaignInput, options?: LetbuyyRequestOptions) =>
        this.requestData<MarketingEmailSendResult>(`/marketing/email-campaigns/${encodePathSegment(id)}/send`, { ...options, method: 'POST', body: input }),
    },
  };

  // Custom-domain lifecycle (migration 185). Paths target the gateway `/custom` router.
  readonly customDomains = {
    checkout: async (query: DomainScopedQuery, options?: LetbuyyRequestOptions): Promise<CheckoutDomainSetup> =>
      CheckoutDomainSetupSchema.parse(await this.requestData<unknown>('/custom/checkout-domain', { ...options, query })),
    prepareCheckout: async (input: DomainScopedInput, options?: LetbuyyRequestOptions): Promise<CheckoutDomainSetup> =>
      CheckoutDomainSetupSchema.parse(await this.requestData<unknown>('/custom/checkout-domain', { ...options, method: 'POST', body: input })),
    list: (query: DomainScopedQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainListResult>('/custom/domains', { ...options, query }),
    connect: (input: DomainConnectInput, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainConnectResult>('/custom/domains', { ...options, method: 'POST', body: input }),
    verify: (input: DomainConnectInput, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainVerifyResult>('/custom/domains/verify', { ...options, method: 'POST', body: input }),
    health: (domain: string, query: CustomDomainHealthQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<CustomDomainHealth>(
        `/custom/domains/${encodePathSegment(domain)}/status`,
        { ...options, query },
      ),
    history: (domain: string, query: DomainScopedQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainHistoryResult>(
        `/custom/domains/${encodePathSegment(domain)}/history`,
        { ...options, query },
      ),
    setPrimary: (domain: string, input: DomainScopedInput, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainSetPrimaryResult>(
        `/custom/domains/${encodePathSegment(domain)}/primary`,
        { ...options, method: 'POST', body: input },
      ),
    update: (domain: string, input: DomainRedirectInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ domain: string; role: string; redirect_to: string | null }>(
        `/custom/domains/${encodePathSegment(domain)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    remove: (domain: string, query: DomainScopedQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainDeleteResult>(
        `/custom/domains/${encodePathSegment(domain)}`,
        { ...options, method: 'DELETE', query },
      ),
  };

  readonly domains = {
    search: (query: DomainSearchQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainAvailabilityQuote>('/domains/search', { ...options, query }),
    purchase: (input: DomainPurchaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<DomainPurchaseResult>('/domains/purchase', { ...options, method: 'POST', body: input }),
  };

  readonly onboarding = {
    saveMobileProgress: (input: MobileOnboardingProgressInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MobileOnboardingProgressResult>(
        '/onboarding/mobile-progress',
        { ...options, method: 'POST', body: input },
      ),
  };

  readonly appStore = {
    apps: (query?: AppStoreListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MarketplaceApp>('/app-store/apps', { ...options, query }),
    app: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceApp>(`/app-store/apps/${encodePathSegment(id)}`, options),
    reviews: (appId: string, query?: AppReviewListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MarketplaceAppReview>(`/app-store/apps/${encodePathSegment(appId)}/reviews`, { ...options, query }),
    submitReview: (appId: string, input: SubmitAppReviewInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppReview>(`/app-store/apps/${encodePathSegment(appId)}/reviews`, { ...options, method: 'POST', body: input }),
    replyToReview: (appId: string, reviewId: string, input: AppReviewReplyCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppReview>(
        `/app-store/apps/${encodePathSegment(appId)}/reviews/${encodePathSegment(reviewId)}/reply`,
        { ...options, method: 'POST', body: input },
      ),
    reportReview: (appId: string, reviewId: string, input: AppReportCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppTrustReportResult>(
        `/app-store/apps/${encodePathSegment(appId)}/reviews/${encodePathSegment(reviewId)}/report`,
        { ...options, method: 'POST', body: input },
      ),
    reportListing: (appId: string, input: AppReportCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppTrustReportResult>(
        `/app-store/apps/${encodePathSegment(appId)}/report`,
        { ...options, method: 'POST', body: input },
      ),
    reviewPolicy: (slug = 'app-review-requirements', options?: LetbuyyRequestOptions) =>
      this.requestData<AppReviewPolicy>(`/app-store/review-policies/${encodePathSegment(slug)}`, options),
    reviewModerationQueue: (query?: { status?: string; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppReviewModerationQueueResult>('/app-store/reviews/moderation', { ...options, query }),
    moderateReview: (reviewId: string, input: AppReviewModerationActionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppReview>(
        `/app-store/reviews/${encodePathSegment(reviewId)}/moderation`,
        { ...options, method: 'PATCH', body: input },
      ),
    upsertAward: (appId: string, input: AppAwardWriteInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppAward>(
        `/app-store/apps/${encodePathSegment(appId)}/awards`,
        { ...options, method: 'POST', body: input },
      ),
    deleteAward: (appId: string, awardKey: string, query?: { year?: number | string }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppAwardArchiveResult>(
        `/app-store/apps/${encodePathSegment(appId)}/awards/${encodePathSegment(awardKey)}`,
        { ...options, method: 'DELETE', query },
      ),
    generateReviewSummary: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppReviewSummaryGenerationResult>(
        `/app-store/apps/${encodePathSegment(appId)}/review-summary/generate`,
        { ...options, method: 'POST' },
      ),
    installationActivity: (installationId: string, query?: Pick<StoreScopedQuery, 'store_id'> & { limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppActivityEventListResult>(
        `/app-store/installations/${encodePathSegment(installationId)}/activity`,
        { ...options, query },
      ),
    partnerDirectory: (query?: { limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<Array<MarketplaceAppDeveloper & { published_apps?: number; built_for_letbuyy_apps?: number }>>('/app-store/partners', { ...options, query }),
    categories: (options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppCategory[]>('/app-store/categories', options),
    featureFacets: (category: string, query?: AppFeatureFacetQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppFeatureGroup[]>(
        `/app-store/categories/${encodePathSegment(category)}/features`,
        { ...options, query },
      ),
    collections: (options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppCollection[]>('/app-store/collections', options),
    collection: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppCollection>(`/app-store/collections/${encodePathSegment(slug)}`, options),
    featured: (query?: Pick<AppStoreListQuery, 'limit'> & { placement?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceApp[]>('/app-store/featured', { ...options, query }),
    newThisWeek: (query?: Pick<AppStoreListQuery, 'limit'>, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceApp[]>('/app-store/growth/new-this-week', { ...options, query }),
    bundles: (query?: { limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppBundle[]>('/app-store/growth/bundles', { ...options, query }),
    requestApp: (input: AppRequestCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppRequestResult>('/app-store/growth/requests', { ...options, method: 'POST', body: input }),
    savedApps: (query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSavedAppsResult>('/app-store/growth/saved-apps', { ...options, query }),
    saveApp: (input: AppSavedAppCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSavedAppsResult>('/app-store/growth/saved-apps', { ...options, method: 'POST', body: input }),
    unsaveApp: (appId: string, query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSavedAppsResult>(
        `/app-store/growth/saved-apps/${encodePathSegment(appId)}`,
        { ...options, method: 'DELETE', query },
      ),
    recommendations: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceAppRecommendations>(`/app-store/apps/${encodePathSegment(appId)}/recommendations`, options),
    recordDiscoveryEvent: (input: AppDiscoveryEventInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppDiscoveryEventResult>('/app-store/discovery/events', { ...options, method: 'POST', body: input }),
    installations: (query?: AppInstallationListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<InstalledApp[]>('/app-store/installations', { ...options, query }),
    extensionRegistry: (installationId: string, query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AppExtensionRegistryResponse>(
        `/app-store/installations/${encodePathSegment(installationId)}/extensions`,
        { ...options, query },
      ),
    updateExtensionRegistration: (installationId: string, registrationId: string, input: AppExtensionRegistrationUpdateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppExtensionRegistration>(
        `/app-store/installations/${encodePathSegment(installationId)}/extensions/${encodePathSegment(registrationId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    updateFunctionRegistration: (installationId: string, registrationId: string, input: AppExtensionRegistrationUpdateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppFunctionRegistration>(
        `/app-store/installations/${encodePathSegment(installationId)}/functions/${encodePathSegment(registrationId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    embedSession: (installationId: string, query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AdminAppBridgeSession>(
        `/app-store/installations/${encodePathSegment(installationId)}/embed-session`,
        { ...options, method: 'POST', query },
      ),
    install: (appId: string, input: AppInstallInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/app-store/apps/${encodePathSegment(appId)}/install`, { ...options, method: 'POST', body: input }),
    oauthAuthorize: (appId: string, input: AppOAuthAuthorizeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppOAuthAuthorizationResult>(
        `/app-store/apps/${encodePathSegment(appId)}/oauth/authorize`,
        { ...options, method: 'POST', body: input },
      ),
    oauthToken: (input: AppOAuthTokenInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppOAuthTokenResult>('/app-store/oauth/token', { ...options, method: 'POST', body: input }),
    oauthTokenExchange: (input: AppOAuthTokenExchangeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppOAuthTokenResult>('/app-store/oauth/token-exchange', { ...options, method: 'POST', body: input }),
    bridgeFetch: (input: AppBridgeFetchInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppBridgeApiFetchResult>('/app-store/bridge/fetch', { ...options, method: 'POST', body: input }),
    createCharge: (installationId: string, input: AppBillingChargeCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppBillingChargeApprovalResult>(
        `/app-store/installations/${encodePathSegment(installationId)}/charges`,
        { ...options, method: 'POST', body: input },
      ),
    approveCharge: (chargeId: string, input: AppBillingChargeApproveInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppBillingChargeApprovalResult>(
        `/app-store/charges/${encodePathSegment(chargeId)}/approve`,
        { ...options, method: 'POST', body: input },
      ),
    cancelCharge: (chargeId: string, input: AppBillingChargeCancelInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppBillingChargeApprovalResult>(
        `/app-store/charges/${encodePathSegment(chargeId)}/cancel`,
        { ...options, method: 'POST', body: input },
      ),
    spendControl: (storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSpendControlApiResult>(
        `/app-store/stores/${encodePathSegment(storeId)}/spend-control`,
        options,
      ),
    updateSpendControl: (storeId: string, input: AppSpendControlUpdateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSpendControlApiResult>(
        `/app-store/stores/${encodePathSegment(storeId)}/spend-control`,
        { ...options, method: 'PATCH', body: input },
      ),
    uninstall: (appId: string, query?: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<{ uninstalled: boolean }>(`/app-store/apps/${encodePathSegment(appId)}/install`, { ...options, method: 'DELETE', query }),
    updateInstallationScopes: (installationId: string, input: AppInstallationScopeUpdateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InstalledApp>(
        `/app-store/installations/${encodePathSegment(installationId)}/scopes`,
        { ...options, method: 'PATCH', body: input },
      ),
    developer: (options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperProfileResult>('/app-store/developers/me', options),
    developerProfile: (developerIdOrSlug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<PublicAppDeveloperProfileResult>(`/app-store/developers/${encodePathSegment(developerIdOrSlug)}`, options),
    registerDeveloper: (input: AppDeveloperRegistrationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperProfileResult>('/app-store/developers/register', { ...options, method: 'POST', body: input }),
    developerApps: (options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperAppsResult>('/app-store/developers/apps', options),
    developerAppVersions: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppVersionsResult>(`/app-store/developers/apps/${encodePathSegment(appId)}/versions`, options),
    updateDeveloperApp: (appId: string, input: AppListingUpdateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppListingUpdateResult>(
        `/app-store/developers/apps/${encodePathSegment(appId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    createDeveloperAppVersion: (appId: string, input: AppVersionCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppVersionCreateResult>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/versions`,
        { ...options, method: 'POST', body: input },
      ),
    validateDeveloperAppManifest: (input: AppManifestValidationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppManifestValidationResult>('/app-store/developers/apps/manifest/validate', { ...options, method: 'POST', body: input }),
    submitDeveloperApp: (input: AppSubmissionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSubmissionResult>('/app-store/developers/apps', { ...options, method: 'POST', body: input }),
    rotateDeveloperAppKey: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppDeveloperCredentialsResult>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/api-key`,
        { ...options, method: 'POST' },
      ),
    developerAppPricingPlans: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppPricingPlansResult>(`/app-store/developers/apps/${encodePathSegment(appId)}/pricing-plans`, options),
    createDeveloperAppPricingPlan: (appId: string, input: AppPricingPlanCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppPricingPlan>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/pricing-plans`,
        { ...options, method: 'POST', body: input },
      ),
    updateDeveloperAppPricingPlan: (appId: string, planId: string, input: AppPricingPlanUpdateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppPricingPlan>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/pricing-plans/${encodePathSegment(planId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    archiveDeveloperAppPricingPlan: (appId: string, planId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppPricingPlan>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/pricing-plans/${encodePathSegment(planId)}`,
        { ...options, method: 'DELETE' },
      ),
    developerAppUsage: (appId: string, query?: { limit?: number; meter_name?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppUsageSummaryResult>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/usage`,
        { ...options, query },
      ),
    developerAppApiUsage: (appId: string, query?: { days?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppApiUsageMetricsResult>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/api-usage`,
        { ...options, query },
      ),
    developerAppWebhooks: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppWebhookEndpointListResult>(`/app-store/developers/apps/${encodePathSegment(appId)}/webhooks`, options),
    createDeveloperAppWebhook: (appId: string, input: AppWebhookEndpointCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppWebhookEndpoint>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/webhooks`,
        { ...options, method: 'POST', body: input },
      ),
    updateDeveloperAppWebhook: (appId: string, webhookId: string, input: AppWebhookEndpointPatchInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppWebhookEndpoint>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/webhooks/${encodePathSegment(webhookId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    archiveDeveloperAppWebhook: (appId: string, webhookId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppWebhookEndpoint>(
        `/app-store/developers/apps/${encodePathSegment(appId)}/webhooks/${encodePathSegment(webhookId)}`,
        { ...options, method: 'DELETE' },
      ),
    partnerDashboard: (options?: LetbuyyRequestOptions) =>
      this.requestData<PartnerDashboard>('/app-store/partners/dashboard', options),
    partnerAnalytics: (query?: { days?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<PartnerAnalyticsTimeseriesResult>('/app-store/partners/analytics', { ...options, query }),
    collaboratorCode: (options?: LetbuyyRequestOptions) =>
      this.requestData<PartnerDashboard['collaborator_access']>('/app-store/partners/collaborator-code', { ...options, method: 'POST' }),
    redeemCollaboratorCode: (input: PartnerCollaboratorRedeemInput, options?: LetbuyyRequestOptions) =>
      this.requestData<PartnerCollaboratorRedeemResult>('/app-store/partners/collaborator-code/redeem', { ...options, method: 'POST', body: input }),
    partnerTiers: (options?: LetbuyyRequestOptions) =>
      this.requestData<PartnerTierListResult>('/app-store/partners/tiers', options),
    sandboxStores: (options?: LetbuyyRequestOptions) =>
      this.requestData<AppSandboxStoreListResult>('/app-store/partners/sandbox-stores', options),
    requestSandboxStore: (input: { name?: string; provisioning_mode?: 'sandbox' | 'test_store' | 'manual' }, options?: LetbuyyRequestOptions) =>
      this.requestData<AppSandboxStore>('/app-store/partners/sandbox-stores', { ...options, method: 'POST', body: input }),
    createDemoSession: (appId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<AppDemoSessionResult>(`/app-store/apps/${encodePathSegment(appId)}/demo-session`, { ...options, method: 'POST' }),
    recordTelemetryEvent: (input: AppTelemetryEventInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppTelemetryEventResult>('/app-store/telemetry/events', { ...options, method: 'POST', body: input }),
  };

  readonly appApi = {
    products: (query?: AppApiProductListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>('/app/products', { ...options, query }),
    orders: (query?: AppApiOrderListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Order>('/app/orders', { ...options, query }),
    updateInstallationMetadata: (input: AppApiInstallationMetadataInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppApiInstallationMetadataResult>('/app/installation/metadata', { ...options, method: 'PATCH', body: input }),
    recordUsage: (input: AppUsageEventCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<AppUsageMeteringApiResult>('/app/usage-events', { ...options, method: 'POST', body: input }),
  };

  readonly operations = {
    runtimeOverview: (query?: InternalIncidentListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/operations/runtime/overview', { ...options, query }),
    runtimeControlCommands: (query?: InternalIncidentListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<{ commands: InternalRuntimeControlCommand[] }>('/operations/runtime/control-commands', { ...options, query }),
    submitRuntimeControlCommand: (input: InternalRuntimeControlCommandInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRuntimeControlCommandResult>(
        '/operations/runtime/control-commands',
        { ...options, method: 'POST', body: input },
      ),
    runtimeIncidents: (query?: InternalIncidentListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<{ incidents: InternalProductionIncident[] }>('/operations/runtime/incidents', { ...options, query }),
    createRuntimeIncident: (input: InternalProductionIncidentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalProductionIncidentResult>(
        '/operations/runtime/incidents',
        { ...options, method: 'POST', body: input },
      ),
    runtimeIncident: (incidentId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalProductionIncidentDetail>(
        `/operations/runtime/incidents/${encodePathSegment(incidentId)}`,
        options,
      ),
    updateRuntimeIncidentStatus: (incidentId: string, input: InternalIncidentStatusInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalProductionIncidentResult>(
        `/operations/runtime/incidents/${encodePathSegment(incidentId)}/status`,
        { ...options, method: 'PATCH', body: input },
      ),
    addRuntimeIncidentEvent: (incidentId: string, input: InternalIncidentEventInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ event: InternalProductionIncidentEvent }>(
        `/operations/runtime/incidents/${encodePathSegment(incidentId)}/events`,
        { ...options, method: 'POST', body: input },
      ),
    pageRuntimeIncident: (incidentId: string, input: InternalDryRunPageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDryRunPageResult>(
        `/operations/runtime/incidents/${encodePathSegment(incidentId)}/page`,
        { ...options, method: 'POST', body: input },
      ),
    oncallSchedules: (query?: InternalOncallScheduleQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalOncallSchedule>('/operations/oncall/schedules', { ...options, query }),
    createOncallSchedule: (input: InternalOncallScheduleInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ schedule: InternalOncallSchedule }>(
        '/operations/oncall/schedules',
        { ...options, method: 'POST', body: input },
      ),
    currentOncall: (query?: { team_name?: string; now?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalOncallCurrentResult>('/operations/oncall/current', { ...options, query }),
    dryRunOncallPage: (input: InternalDryRunPageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDryRunPageResult>(
        '/operations/oncall/page',
        { ...options, method: 'POST', body: input },
      ),
    incidentPostmortems: (query?: InternalIncidentPostmortemQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalIncidentPostmortem>('/operations/postmortems', { ...options, query }),
    createIncidentPostmortem: (input: InternalIncidentPostmortemInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalIncidentPostmortemResult>(
        '/operations/postmortems',
        { ...options, method: 'POST', body: input },
      ),
    updateIncidentPostmortem: (id: string, input: InternalIncidentPostmortemPatch, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalIncidentPostmortemResult>(
        `/operations/postmortems/${encodePathSegment(id)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    developerSearch: (query?: InternalDeveloperSearchQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MarketplaceAppDeveloper>('/operations/developers/search', { ...options, query }),
    developerOverview: (developerId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperOverview>(
        `/operations/developers/${encodePathSegment(developerId)}/overview`,
        options,
      ),
    moderateDeveloper: (developerId: string, input: InternalDeveloperModerationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperModerationResult>(
        `/operations/developers/${encodePathSegment(developerId)}/moderation`,
        { ...options, method: 'POST', body: input },
      ),
    approveDeveloperPayoutRelease: (developerId: string, payoutId: string, input: InternalDeveloperPayoutReleaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperPayoutReleaseResult>(
        `/operations/developers/${encodePathSegment(developerId)}/payouts/${encodePathSegment(payoutId)}/release`,
        { ...options, method: 'POST', body: input },
      ),
    runDeveloperPayoutReconciliation: (developerId: string, input: InternalDeveloperReconciliationRunInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperReconciliationRunResult>(
        `/operations/developers/${encodePathSegment(developerId)}/reconciliation/run`,
        { ...options, method: 'POST', body: input },
      ),
    developerPayoutReconciliation: (developerId: string, query?: { page?: number; limit?: number; status?: string }, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalPayoutReconciliationRecord>(
        `/operations/developers/${encodePathSegment(developerId)}/reconciliation`,
        { ...options, query },
      ),
    developerPayoutDisputes: (developerId: string, query?: { page?: number; limit?: number; status?: string }, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalPayoutDispute>(
        `/operations/developers/${encodePathSegment(developerId)}/disputes`,
        { ...options, query },
      ),
    createDeveloperPayoutDispute: (developerId: string, input: InternalDeveloperDisputeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperDisputeResult>(
        `/operations/developers/${encodePathSegment(developerId)}/disputes`,
        { ...options, method: 'POST', body: input },
      ),
    updateDeveloperPayoutDispute: (developerId: string, disputeId: string, input: InternalDeveloperDisputePatch, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperDisputeResult>(
        `/operations/developers/${encodePathSegment(developerId)}/disputes/${encodePathSegment(disputeId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    marketplaceReviews: (query?: MarketplaceReviewListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceReviewListResult>('/operations/marketplace-reviews', { ...options, query }),
    marketplaceReview: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceReviewDetailResult>(
        `/operations/marketplace-reviews/${encodePathSegment(id)}`,
        options,
      ),
    claimMarketplaceReview: (id: string, input: MarketplaceReviewClaimInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ review_record: MarketplaceReviewRecord }>(
        `/operations/marketplace-reviews/${encodePathSegment(id)}/claim`,
        { ...options, method: 'POST', body: input },
      ),
    assignMarketplaceReview: (id: string, input: MarketplaceReviewAssignInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ review_record: MarketplaceReviewRecord }>(
        `/operations/marketplace-reviews/${encodePathSegment(id)}/assign`,
        { ...options, method: 'PATCH', body: input },
      ),
    commentMarketplaceReview: (id: string, input: MarketplaceReviewCommentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceReviewCommentResult>(
        `/operations/marketplace-reviews/${encodePathSegment(id)}/comments`,
        { ...options, method: 'POST', body: input },
      ),
    runMarketplaceReviewChecks: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceReviewRunChecksResult>(
        `/operations/marketplace-reviews/${encodePathSegment(id)}/run-checks`,
        { ...options, method: 'POST' },
      ),
    decideMarketplaceReview: (id: string, input: MarketplaceReviewDecisionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MarketplaceReviewDecisionResult>(
        `/operations/marketplace-reviews/${encodePathSegment(id)}/decision`,
        { ...options, method: 'POST', body: input },
      ),
    employeePermissions: (employeeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRbacEmployeePermissionsResult>(
        `/operations/rbac/employees/${encodePathSegment(employeeId)}/permissions`,
        options,
      ),
    updateEmployeePermissions: (employeeId: string, input: InternalRbacPermissionAssignmentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ employee: Employee }>(
        `/operations/rbac/employees/${encodePathSegment(employeeId)}/permissions`,
        { ...options, method: 'PATCH', body: input },
      ),
    breakGlassGrants: (query?: { page?: number; limit?: number; status?: 'active' | 'expired' | 'revoked' | 'all' }, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalBreakGlassGrant>('/operations/rbac/break-glass', { ...options, query }),
    grantBreakGlass: (input: InternalBreakGlassGrantInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ grant: InternalBreakGlassGrant }>(
        '/operations/rbac/break-glass',
        { ...options, method: 'POST', body: input },
      ),
    expireBreakGlass: (id: string, input: InternalBreakGlassExpireInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ grant: InternalBreakGlassGrant }>(
        `/operations/rbac/break-glass/${encodePathSegment(id)}/expire`,
        { ...options, method: 'POST', body: input },
      ),
    accessReviews: (query?: { page?: number; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalAccessReviewRecord>('/operations/rbac/access-reviews', { ...options, query }),
    recordAccessReview: (input: InternalAccessReviewRecordInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalAccessReviewRecordResult>(
        '/operations/rbac/access-reviews',
        { ...options, method: 'POST', body: input },
      ),
    riskOverview: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskOverview>('/operations/risk/overview', options),
    riskScores: (query?: InternalRiskScoreQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalRiskScore>('/operations/risk/scores', { ...options, query }),
    riskScore: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskScoreDetailResult>(
        `/operations/risk/scores/${encodePathSegment(id)}`,
        options,
      ),
    riskReviewQueue: (query?: Pick<InternalRiskScoreQuery, 'page' | 'limit' | 'band'>, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalRiskScore>('/operations/risk/review-queue', { ...options, query }),
    createRiskSignal: (input: InternalRiskSignalInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskSignalResult>(
        '/operations/risk/signals',
        { ...options, method: 'POST', body: input },
      ),
    scoreRiskEntity: (input: InternalRiskScoreInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskScoreResult>(
        '/operations/risk/score',
        { ...options, method: 'POST', body: input },
      ),
    decideRiskScore: (id: string, input: InternalRiskDecisionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskScoreResult>(
        `/operations/risk/scores/${encodePathSegment(id)}/decision`,
        { ...options, method: 'POST', body: input },
      ),
    riskRules: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskRuleListResult>('/operations/risk/rules', options),
    createRiskRule: (input: InternalRiskRuleInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskRuleResult>(
        '/operations/risk/rules',
        { ...options, method: 'POST', body: input },
      ),
    updateRiskRule: (id: string, input: InternalRiskRulePatch, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalRiskRuleResult>(
        `/operations/risk/rules/${encodePathSegment(id)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    trustSafetyOverview: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyOverview>('/operations/trust-safety/overview', options),
    trustSafetyPolicies: (options?: LetbuyyRequestOptions) =>
      this.requestData<Array<JsonRecord & { id: string; policy_key: string; title: string }>>('/operations/trust-safety/policies', options),
    trustSafetyCases: (query?: InternalTrustSafetyCaseQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalTrustSafetyCase>('/operations/trust-safety/cases', { ...options, query }),
    trustSafetyCase: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyCaseResult>(
        `/operations/trust-safety/cases/${encodePathSegment(id)}`,
        options,
      ),
    openTrustSafetyCase: (input: InternalTrustSafetyOpenCaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyCaseResult>(
        '/operations/trust-safety/cases',
        { ...options, method: 'POST', body: input },
      ),
    openTrustSafetyCaseFromRiskAction: (input: InternalTrustSafetyRiskActionCaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyCaseResult>(
        '/operations/trust-safety/cases/from-risk-action',
        { ...options, method: 'POST', body: input },
      ),
    attachTrustSafetyEvidence: (caseId: string, input: InternalTrustSafetyEvidenceInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyEvidenceResult>(
        `/operations/trust-safety/cases/${encodePathSegment(caseId)}/evidence`,
        { ...options, method: 'POST', body: input },
      ),
    decideTrustSafetyCase: (caseId: string, input: InternalTrustSafetyDecisionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyCaseResult>(
        `/operations/trust-safety/cases/${encodePathSegment(caseId)}/decide`,
        { ...options, method: 'POST', body: input },
      ),
    enforceTrustSafetyCase: (caseId: string, input: InternalTrustSafetyEnforcementInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyEnforcementResult>(
        `/operations/trust-safety/cases/${encodePathSegment(caseId)}/enforce`,
        { ...options, method: 'POST', body: input },
      ),
    fileTrustSafetyAppeal: (caseId: string, input: InternalTrustSafetyAppealInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyAppealResult>(
        `/operations/trust-safety/cases/${encodePathSegment(caseId)}/appeals`,
        { ...options, method: 'POST', body: input },
      ),
    decideTrustSafetyAppeal: (appealId: string, input: InternalTrustSafetyAppealDecisionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyAppealResult>(
        `/operations/trust-safety/appeals/${encodePathSegment(appealId)}/decide`,
        { ...options, method: 'POST', body: input },
      ),
    reinstateTrustSafetyCase: (caseId: string, input: InternalTrustSafetyReinstateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalTrustSafetyCaseResult>(
        `/operations/trust-safety/cases/${encodePathSegment(caseId)}/reinstate`,
        { ...options, method: 'POST', body: input },
      ),
    supportOverview: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalSupportOverview>('/operations/support/overview', options),
    supportTickets: (query?: InternalSupportTicketQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalSupportTicket>('/operations/support/tickets', { ...options, query }),
    supportTicket: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalSupportTicketDetail>(
        `/operations/support/tickets/${encodePathSegment(id)}`,
        options,
      ),
    createSupportTicket: (input: InternalSupportCreateTicketInput, options: SupportMutationOptions) =>
      this.requestData<InternalSupportTicketResult>(
        '/operations/support/tickets',
        { ...options, method: 'POST', body: input },
      ),
    replySupportTicket: (id: string, input: InternalSupportMessageInput, options: SupportMutationOptions) =>
      this.requestData<InternalSupportReplyResult>(
        `/operations/support/tickets/${encodePathSegment(id)}/messages`,
        { ...options, method: 'POST', body: input },
      ),
    assignSupportTicket: (id: string, input: InternalSupportAssignInput, options: SupportMutationOptions) =>
      this.requestData<InternalSupportTicketResult>(
        `/operations/support/tickets/${encodePathSegment(id)}/assign`,
        { ...options, method: 'PATCH', body: input },
      ),
    escalateSupportTicket: (id: string, input: InternalSupportEscalateInput, options: SupportMutationOptions) =>
      this.requestData<InternalSupportTicketResult>(
        `/operations/support/tickets/${encodePathSegment(id)}/escalate`,
        { ...options, method: 'POST', body: input },
      ),
    resolveSupportTicket: (id: string, input: InternalSupportResolveInput, options: SupportMutationOptions) =>
      this.requestData<InternalSupportTicketResult & { csat_survey_token: string }>(
        `/operations/support/tickets/${encodePathSegment(id)}/resolve`,
        { ...options, method: 'POST', body: input },
      ),
    recordSupportCsat: (id: string, input: InternalSupportCsatInput, options: SupportMutationOptions) =>
      this.requestData<{ csat: InternalSupportCsat }>(
        `/operations/support/tickets/${encodePathSegment(id)}/csat`,
        { ...options, method: 'POST', body: input },
      ),
    supportMacros: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalSupportMacro[]>('/operations/support/macros', options),
    createSupportMacro: (input: InternalSupportMacroInput, options: SupportMutationOptions) =>
      this.requestData<{ macro: InternalSupportMacro }>(
        '/operations/support/macros',
        { ...options, method: 'POST', body: input },
      ),
  };

  readonly internalConsole = {
    complianceOverview: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalComplianceOverview>('/internal/console/compliance/overview', options),
    complianceDataRequests: (query?: InternalDataSubjectRequestQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InternalDataSubjectRequest>(
        '/internal/console/compliance/data-requests',
        { ...options, query },
      ),
    complianceDataSubjectRequest: (requestId: string, query?: { actor_id?: string; actor_email?: string; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDataSubjectRequest>(
        `/internal/console/compliance/data-requests/${encodePathSegment(requestId)}`,
        { ...options, query },
      ),
    createComplianceDataSubjectRequest: (input: InternalDataSubjectRequestInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ request: InternalDataSubjectRequest }>(
        '/internal/console/compliance/data-requests',
        { ...options, method: 'POST', body: input },
      ),
    updateComplianceDataSubjectRequest: (requestId: string, input: InternalDataSubjectRequestPatch, options?: LetbuyyRequestOptions) =>
      this.requestData<{ request: InternalDataSubjectRequest }>(
        `/internal/console/compliance/data-requests/${encodePathSegment(requestId)}`,
        { ...options, method: 'PATCH', body: input },
      ),
    complianceRetentionPolicy: (options?: LetbuyyRequestOptions) =>
      this.requestData<InternalComplianceRetentionPolicy>('/internal/console/compliance/retention-policy', options),
    complianceAuditExports: (options?: LetbuyyRequestOptions) =>
      this.requestData<{ cursors: InternalAuditExportCursor[] }>('/internal/console/compliance/audit-exports', options),
    runComplianceAuditExport: (input: InternalAuditExportRunInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalAuditExportRunResult>(
        '/internal/console/compliance/audit-exports/run',
        { ...options, method: 'POST', body: input },
      ),
    developerSearch: (query?: InternalDeveloperSearchQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MarketplaceAppDeveloper>(
        '/internal/console/developers/search',
        { ...options, query },
      ),
    developerOverview: (developerId: string, query?: { actor_id?: string; actor_email?: string; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalDeveloperOverview>(
        `/internal/console/developers/${encodePathSegment(developerId)}/overview`,
        { ...options, query },
      ),
    merchantSearch: (query: InternalMerchantSearchQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalMerchantSearchResponse>(
        '/internal/console/merchants/search',
        { ...options, query },
      ),
    merchantOverview: (merchantId: string, query?: InternalMerchantOverviewQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalMerchantOverview>(
        `/internal/console/merchants/${encodePathSegment(merchantId)}/overview`,
        { ...options, query },
      ),
    startMerchantImpersonation: (merchantId: string, input: InternalMerchantImpersonationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalMerchantImpersonationResult>(
        `/internal/console/merchants/${encodePathSegment(merchantId)}/impersonation`,
        { ...options, method: 'POST', body: input },
      ),
    endMerchantImpersonation: (merchantId: string, sessionId: string, input: InternalMerchantActorInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ session: InternalMerchantImpersonationSession }>(
        `/internal/console/merchants/${encodePathSegment(merchantId)}/impersonation/${encodePathSegment(sessionId)}/end`,
        { ...options, method: 'POST', body: input },
      ),
    moderateMerchant: (merchantId: string, input: InternalMerchantModerationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalMerchantModerationResult>(
        `/internal/console/merchants/${encodePathSegment(merchantId)}/moderation`,
        { ...options, method: 'POST', body: input },
      ),
    executiveMrr: (query?: InternalExecutiveAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ExecutiveMrrAnalytics>(
        '/internal/console/analytics/mrr',
        { ...options, query },
      ),
    executiveFunnels: (query?: InternalExecutiveAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ExecutiveFunnelAnalytics>(
        '/internal/console/analytics/funnels',
        { ...options, query },
      ),
    executiveCohorts: (query?: InternalExecutiveAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ExecutiveCohortAnalytics>(
        '/internal/console/analytics/cohorts',
        { ...options, query },
      ),
    executiveCompanyHealth: (query?: InternalExecutiveAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ExecutiveCompanyHealth>(
        '/internal/console/analytics/company-health',
        { ...options, query },
      ),
    executiveCohortMerchants: (cohortMonth: string, query: InternalExecutiveAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<InternalExecutiveCohortMerchantsResult>(
        `/internal/console/analytics/cohorts/${encodePathSegment(cohortMonth)}/merchants`,
        { ...options, query },
      ),
  };

  readonly employees = {
    list: (query: EmployeeListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<Employee[]>('/employees', { ...options, query }),
    limits: (query: EmployeeListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<EmployeeStaffLimit>('/employees/limits', { ...options, query }),
    create: (input: CreateEmployeeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Employee>('/employees', { ...options, method: 'POST', body: input }),
    invite: (input: CreateStaffInvitationInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StaffInvitationResult>('/employees/invite', { ...options, method: 'POST', body: input }),
    previewInvite: (input: { token: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<StaffInvitationPreview>('/employees/invitations/preview', { ...options, method: 'POST', body: input }),
    acceptInvite: (input: { token: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<StaffInvitationAcceptance>('/employees/auth/accept-invite', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateEmployeeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Employee>(`/employees/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/employees/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly media = {
    list: (query: MediaListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<MediaAsset>('/media', { ...options, query }),
    create: (input: CreateMediaInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MediaAsset>('/media', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateMediaInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MediaAsset>(`/media/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/media/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly upload = {
    file: (formData: FormData, options?: LetbuyyRequestOptions) =>
      this.requestData<FileUploadResult>('/upload', { ...options, method: 'POST', body: formData }),
    remove: (key: string, inputOrOptions?: { store_id?: string } | LetbuyyRequestOptions, options?: LetbuyyRequestOptions) => {
      const hasScopedInput = Boolean(inputOrOptions && 'store_id' in inputOrOptions);
      const storeId = hasScopedInput ? (inputOrOptions as { store_id?: string }).store_id : undefined;
      const requestOptions = hasScopedInput ? options : inputOrOptions as LetbuyyRequestOptions | undefined;
      return this.requestData<{ deleted: boolean; storage?: string }>(`/upload/${encodePathSegment(key)}`, {
        ...requestOptions,
        method: 'DELETE',
        query: { ...requestOptions?.query, ...(storeId ? { store_id: storeId } : {}) },
      });
    },
  };

  readonly analytics = {
    dashboard: (query: AnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsDashboard>('/analytics/dashboard', { ...options, query }),
    revenue: (query: AnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsRevenue>('/analytics/revenue', { ...options, query }),
    orders: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsOrdersBreakdown>('/analytics/orders', { ...options, query }),
    live: (query: AnalyticsLiveQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsLiveView>('/analytics/live', { ...options, query }),
    trafficSources: (query: AnalyticsTrafficSourcesQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<AnalyticsTrafficSources>('/analytics/traffic-sources', { ...options, query }),
  };

  readonly ai = {
    credits: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<AICreditBalance>('/ai/credits', { ...options, query }),
    usage: (query: AIUsageListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<AIUsageRecord>('/ai/usage', { ...options, query }),
    generate: (
      input: { store_id: string; feature?: string; type?: string; prompt: string; context?: JsonRecord },
      options?: LetbuyyRequestOptions,
    ) =>
      this.requestData<{ usage: AIUsageRecord; credits: AICreditBalance; output: string }>(
        '/ai/generate',
        { ...options, method: 'POST', body: input },
      ),
    operator: (input: AIOperatorRequest, options?: LetbuyyRequestOptions) =>
      this.requestData<AIOperatorResponse>(
        '/ai/operator',
        { ...options, method: 'POST', body: input },
      ),
    homepage: (input: AIHomepageGenerationRequest, options?: LetbuyyRequestOptions) =>
      this.requestData<AIHomepageGenerationResult>(
        '/ai/homepage',
        { ...options, method: 'POST', body: input },
      ),
    purchaseCredits: (input: AICreditPurchaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ purchase: AICreditPurchase; credits: AICreditBalance }>(
        '/ai/credits/purchase',
        { ...options, method: 'POST', body: input },
      ),
  };

  readonly products = {
    list: (query?: ProductListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>('/products', { ...options, query }),
    listSummary: (query?: ProductListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<ProductListSummary>('/products', { ...options, query: { ...query, view: 'summary' } }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/products/${encodePathSegment(id)}`, options),
    create: (input: CreateProductInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>('/products', { ...options, method: 'POST', body: input }),
    sample: (input: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>('/products/sample', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateProductInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/products/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input, idempotencyKey: input.idempotency_key }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ id: string }>(`/products/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    bulk: (input: { store_id: string; action: string; product_ids: string[] }, options?: LetbuyyRequestOptions) =>
      this.requestData<{ updated: number }>('/products/bulk', { ...options, method: 'POST', body: input }),
    lookupBarcode: (query: ProductBarcodeLookupQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductBarcodeLookupResult>('/products/barcode/lookup', { ...options, query }),
    collections: {
      list: async (input: CollectionListQueryInput, options?: LetbuyyRequestOptions) => {
        const query = CollectionListQuerySchema.parse(input);
        const result = CollectionListPageSchema.parse(await this.request<unknown>('/products/collections', { ...options, query }));
        if(result.meta.page!==query.page||result.meta.per_page!==query.limit||result.data.some(row=>row.store_id!==query.store_id))
          throw new Error('Collection list context could not be confirmed.');
        return result;
      },
      create: (input: CreateCollectionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Collection>('/products/collections', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateCollectionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Collection>(`/products/collections/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean; id: string }>(`/products/collections/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
      listProducts: async (id: string, options: LetbuyyRequestOptions & { storeId: string }) =>
        CollectionMembershipSnapshotSchema.parse(await this.requestData<unknown>(`/products/collections/${encodePathSegment(id)}/products`, options)),
      replaceProducts: async (id: string, input: ReplaceCollectionMembershipInput, options: LetbuyyRequestOptions & { storeId: string }) =>
        CollectionMembershipSnapshotSchema.parse(await this.requestData<unknown>(`/products/collections/${encodePathSegment(id)}/products`, { ...options, method: 'PUT', body: input, idempotencyKey: input.idempotency_key })),
    },
    giftCards: {
      list: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCardLifecycleItem[]>('/products/gift-cards', { ...options, query }),
      create: (input: CreateGiftCardInput, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCardIssued>('/products/gift-cards', { ...options, method: 'POST', body: input }),
      balance: (query: { store_id: string; code: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCardBalanceResult>('/products/gift-cards/balance', { ...options, query }),
      transactions: (id: string, query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCardTransactionsResult>(`/products/gift-cards/${encodePathSegment(id)}/transactions`, { ...options, query }),
      setStatus: (id: string, input: GiftCardStatusUpdateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<GiftCardLifecycleItem>(`/products/gift-cards/${encodePathSegment(id)}/status`, { ...options, method: 'POST', body: input }),
    },
    importCsv: (input: ProductImportInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductImportResult>('/export/import-products', { ...options, method: 'POST', body: input }),
  };

  readonly categories = {
    list: (query?: CategoryListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory[]>('/categories', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory>(`/categories/${encodePathSegment(id)}`, options),
    create: (input: CreateProductCategoryInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory>('/categories', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateProductCategoryInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductCategory>(`/categories/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/categories/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly smartCollections = {
    list: (query: SmartCollectionListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<SmartCollection[]>('/smart-collections', { ...options, query }),
    create: (input: CreateSmartCollectionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<SmartCollection>('/smart-collections', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateSmartCollectionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<SmartCollection>(`/smart-collections/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    preview: (id: string, query?: SmartCollectionPreviewQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<SmartCollectionPreviewResult>(`/smart-collections/${encodePathSegment(id)}/preview`, { ...options, query }),
  };

  readonly inventory = {
    levels: (query?: InventoryLevelQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<InventoryLevel>('/inventory/levels', { ...options, query }),
    adjust: (input: InventoryAdjustInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/inventory/adjust', { ...options, method: 'POST', body: input }),
    purchaseOrders: {
      list: (query: PurchaseOrderListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<PurchaseOrder[]>('/inventory/purchase-orders', { ...options, query }),
      create: (input: CreatePurchaseOrderInput, options?: LetbuyyRequestOptions) =>
        this.requestData<JsonRecord>('/inventory/purchase-orders', { ...options, method: 'POST', body: input }),
      receive: (id: string, input: ReceivePurchaseOrderInput, options?: LetbuyyRequestOptions) =>
        this.requestData<JsonRecord>(`/inventory/purchase-orders/${encodePathSegment(id)}/receive`, { ...options, method: 'POST', body: input }),
    },
    suppliers: {
      list: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<Supplier[]>('/inventory/suppliers', { ...options, query }),
      create: (input: CreateSupplierInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Supplier>('/inventory/suppliers', { ...options, method: 'POST', body: input }),
    },
    locations: {
      list: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<InventoryLocation[]>('/inventory/locations', { ...options, query }),
      create: (input: CreateInventoryLocationInput, options?: LetbuyyRequestOptions) =>
        this.requestData<InventoryLocation>('/inventory/locations', { ...options, method: 'POST', body: input }),
    },
    history: async (query?: InventoryHistoryQuery, options?: LetbuyyRequestOptions): Promise<PaginatedResponse<InventoryHistoryEntry>> => {
      const body = await this.request<GatewayResponse<unknown[]>>('/inventory/history', { ...options, storeId: query?.store_id ?? options?.storeId, query });
      const data = InventoryHistoryEntrySchema.array().safeParse(unwrapData<unknown[]>(body, 200, null));
      const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};
      const { total, page, per_page: limit, has_next: more } = meta;
      if (!data.success || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 ||
          typeof page !== 'number' || page !== (query?.page ?? 1) ||
          typeof limit !== 'number' || limit !== (query?.limit ?? 20) || typeof more !== 'boolean' ||
          (query?.store_id && meta.store_id !== query.store_id) ||
          (data.success && data.data.some(row =>
            row.products.store_id !== row.store_id ||
            (query?.store_id && row.store_id !== query.store_id) ||
            (query?.product_id && row.product_id !== query.product_id)))) {
        throw new LetbuyyApiError({ status: 503, code: 'INVENTORY_HISTORY_UNVERIFIED', message: 'Inventory history could not be verified. Try again later.' });
      }
      return { data: data.data, total, page, limit, has_more: more, next_cursor: null, total_is_exact: Boolean(meta.total_is_exact) };
    },
    reserve: (input: ReserveInventoryInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/inventory/reserve', { ...options, method: 'POST', body: input }),
    commit: (input: InventoryReservationActionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/inventory/commit', { ...options, method: 'POST', body: input }),
    release: (input: InventoryReservationActionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/inventory/release', { ...options, method: 'POST', body: input }),
    transfers: {
      list: (query: InventoryTransferListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<InventoryTransfer[]>('/inventory/transfers', { ...options, query }),
      create: (input: CreateInventoryTransferInput, options?: LetbuyyRequestOptions) =>
        this.requestData<JsonRecord>('/inventory/transfers', { ...options, method: 'POST', body: input }),
      ship: (id: string, input: ShipInventoryTransferInput, options?: LetbuyyRequestOptions) =>
        this.requestData<JsonRecord>(`/inventory/transfers/${encodePathSegment(id)}/ship`, { ...options, method: 'POST', body: input }),
      receive: (id: string, input: ReceiveInventoryTransferInput, options?: LetbuyyRequestOptions) =>
        this.requestData<JsonRecord>(`/inventory/transfers/${encodePathSegment(id)}/receive`, { ...options, method: 'POST', body: input }),
    },
    reservations: {
      list: (query: InventoryReservationListQuery, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<InventoryReservation>('/inventory/reservations', { ...options, query }),
    },
    receipts: {
      list: (query: InventoryReceiptListQuery, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<InventoryReceipt>('/inventory/receipts', { ...options, query }),
    },
    analytics: (query: InventoryAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<InventoryAnalyticsResult>('/inventory/analytics', { ...options, query }),
  };

  // ── Commerce Analytics (Phase 5.10) ─────────────────────────
  readonly commerceAnalytics = {
    supplierMetrics: (query: CommerceAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<SupplierMetricsResult>('/commerce-analytics/supplier-metrics', { ...options, query }),
    warehouseMetrics: (query: CommerceAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<WarehouseMetricsResult>('/commerce-analytics/warehouse-metrics', { ...options, query }),
    transferMetrics: (query: CommerceAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<TransferMetricsResult>('/commerce-analytics/transfer-metrics', { ...options, query }),
    operationsSummary: (query: CommerceAnalyticsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<OperationsSummaryResult>('/commerce-analytics/operations-summary', { ...options, query }),
  };

  readonly orders = {
    list: (query?: OrderListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Order>('/orders', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}`, options),
    create: (input: CreateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>('/orders', { ...options, method: 'POST', body: input }),
    listDrafts: (query?: DraftOrderListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<DraftOrder>('/orders/drafts', { ...options, query }),
    createDraft: (input: CreateDraftOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<DraftOrder>('/orders/drafts', { ...options, method: 'POST', body: input }),
    convertDraft: (id: string, input: ConvertDraftOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ConvertDraftOrderResult>(`/orders/drafts/${encodePathSegment(id)}/convert`, { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    fulfill: (id: string, input: FulfillOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}/fulfill`, { ...options, method: 'POST', body: input }),
    updateLineItems: (id: string, input: UpdateOrderLineItemsInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}/line-items`, { ...options, method: 'PATCH', body: input }),
    packingSlip: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/orders/${encodePathSegment(id)}/packing-slip`, options),
    refund: (id: string, input: { amount?: number; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Order>(`/orders/${encodePathSegment(id)}/refund`, { ...options, method: 'POST', body: input }),
  };

  readonly returns = {
    list: (query?: { store_id?: string; status?: ReturnStatus | 'all'; order_id?: string; page?: number; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<ReturnRecord>('/returns', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ReturnRecord>(`/returns/${encodePathSegment(id)}`, options),
    create: (input: CreateReturnInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ReturnRecord>('/returns', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateReturnStatusInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ReturnRecord>(`/returns/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    completeRefund: (id: string, input: CompleteReturnRefundInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ReturnRecord>(`/returns/${encodePathSegment(id)}/refund/complete`, { ...options, method: 'POST', body: input }),
  };

  readonly shippingLabels = {
    rates: (input: ShippingLabelRateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ provider_mode: ShippingLabelProviderModeResponse['provider_mode']; rates: ShippingLabelRate[] }>('/shipping/labels/rates', { ...options, method: 'POST', body: input }),
    providerMode: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<ShippingLabelProviderModeResponse>('/shipping/labels/provider-mode', { ...options, query }),
    buy: (input: ShippingLabelBuyInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ label: ShippingLabelRecord }>('/shipping/labels', { ...options, method: 'POST', body: input }),
    void: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ label: ShippingLabelRecord }>(`/shipping/labels/${encodePathSegment(id)}/void`, { ...options, method: 'POST' }),
  };

  readonly payouts = {
    list: (query: { store_id: string; status?: string; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantPayoutList>('/payouts', { ...options, query }),
    summary: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantPayoutList['summary']>('/payouts/summary', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantPayoutStatement>(`/payouts/${encodePathSegment(id)}`, options),
    create: (input: CreatePayoutStatementInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantPayoutStatement>('/payouts', { ...options, method: 'POST', body: input }),
    settle: (id: string, input: SettlePayoutStatementInput, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantPayoutStatement>(`/payouts/${encodePathSegment(id)}/settle`, { ...options, method: 'POST', body: input }),
  };

  readonly wallet = {
    get: (query: { store_id: string; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<WalletBalance>('/wallet', { ...options, query }),
  };

  readonly commission = {
    overview: (query: { store_id: string; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<CommissionOverview>('/commission', { ...options, query }),
    reconcile: (input: ReconcileCommissionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ created: number; overview: CommissionOverview }>('/commission/reconcile', { ...options, method: 'POST', body: input }),
  };

  readonly cod = {
    overview: (query: CodReconciliationQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<CodReconciliationOverview>('/cod/reconciliation', { ...options, query }),
    collect: (input: CollectCodInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ entry: CodReconciliationEntry }>('/cod/reconciliation', { ...options, method: 'POST', body: input }),
    reconcile: (id: string, input: ReconcileCodInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ entry: CodReconciliationEntry }>(`/cod/reconciliation/${encodePathSegment(id)}/reconcile`, { ...options, method: 'POST', body: input }),
  };

  readonly kyc = {
    overview: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantKycOverview>('/kyc', { ...options, query }),
    submitDocument: (input: SubmitKycDocumentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ document: MerchantKycDocument; overview: MerchantKycOverview }>('/kyc/documents', { ...options, method: 'POST', body: input }),
    refreshDocument: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ document: MerchantKycDocument; overview: MerchantKycOverview }>(`/kyc/documents/${encodePathSegment(id)}/refresh`, { ...options, method: 'POST' }),
  };

  readonly twoFactor = {
    overview: (options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantTwoFactorOverview>('/2fa', options),
    sessions: (options?: LetbuyyRequestOptions) =>
      this.requestData<{ sessions: MerchantSessionInventoryItem[] }>('/2fa/sessions', options),
    enrollTotp: (options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantTwoFactorEnrollment>('/2fa/totp/enroll', { ...options, method: 'POST' }),
    verifyTotp: (input: VerifyTotpInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ factor: MerchantTwoFactor; recovery_codes: string[] }>('/2fa/totp/verify', { ...options, method: 'POST', body: input }),
    disable: (input: DisableTwoFactorInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ factor: MerchantTwoFactor }>('/2fa/disable', { ...options, method: 'POST', body: input }),
  };

  readonly customers = {
    list: (query?: CustomerListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Customer>('/customers', { ...options, query }),
    create: (input: CreateCustomerInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Customer>('/customers', { ...options, method: 'POST', body: input }),
    getByEmail: (email: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Customer>(`/customers/${encodePathSegment(email)}`, options),
    update: (email: string, input: UpdateCustomerInput, query?: { store_id?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Customer>(`/customers/${encodePathSegment(email)}`, { ...options, method: 'PATCH', query, body: input }),
    notes: {
      list: (email: string, query: { store_id: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerNote[]>(`/customers/${encodePathSegment(email)}/notes`, { ...options, query }),
      create: (email: string, input: CreateCustomerNoteInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerNote>(`/customers/${encodePathSegment(email)}/notes`, { ...options, method: 'POST', body: input }),
    },
    updateTags: (email: string, input: UpdateCustomerTagsInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Customer>(`/customers/${encodePathSegment(email)}/tags`, { ...options, method: 'PUT', body: input }),
    sendEmail: (email: string, input: SendCustomerEmailInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ success: boolean; devOnly?: boolean }>(`/customers/${encodePathSegment(email)}/email`, { ...options, method: 'POST', body: input }),
    merge: (email: string, input: MergeCustomerInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ merged: boolean; source_email: string; target_email: string; customer: Customer }>(`/customers/${encodePathSegment(email)}/merge`, { ...options, method: 'POST', body: input }),
    remove: (email: string, query: { store_id: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean; customer_id?: string }>(`/customers/${encodePathSegment(email)}`, { ...options, method: 'DELETE', query }),
    segments: {
      list: (query: { store_id: string; search?: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerSegment[]>('/customers/segments', { ...options, query }),
      create: (input: CreateCustomerSegmentInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerSegment>('/customers/segments', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateCustomerSegmentInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerSegment>(`/customers/segments/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      preview: (input: PreviewCustomerSegmentInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerSegmentPreview>('/customers/segments/preview', { ...options, method: 'POST', body: input }),
      customers: (id: string, query: { store_id: string; page?: number; limit?: number }, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<Customer>(`/customers/segments/${encodePathSegment(id)}/customers`, { ...options, query }),
    },
    addresses: {
      list: (email: string, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerAddress[]>(`/customers/${encodePathSegment(email)}/addresses`, options),
      create: (email: string, input: CreateCustomerAddressInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerAddress>(`/customers/${encodePathSegment(email)}/addresses`, { ...options, method: 'POST', body: input }),
      update: (email: string, id: string, input: UpdateCustomerAddressInput, options?: LetbuyyRequestOptions) =>
        this.requestData<CustomerAddress>(`/customers/${encodePathSegment(email)}/addresses/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (email: string, id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ id: string }>(`/customers/${encodePathSegment(email)}/addresses/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly pages = {
    list: (query?: PageListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Page>('/pages', { ...options, query }),
    create: (input: CreatePageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>('/pages', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdatePageInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Page>(`/pages/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/pages/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    policies: {
      list: (query?: PolicyListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<Policy[]>('/pages/policies', { ...options, query }),
      create: (input: CreatePolicyInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Policy>('/pages/policies', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdatePolicyInput, options?: LetbuyyRequestOptions) =>
        this.requestData<Policy>(`/pages/policies/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/pages/policies/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
    navigation: {
      get: (query: { store_id: string; location?: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<NavigationResponse>('/pages/navigation', { ...options, query }),
      replace: (location: string, input: ReplaceNavigationInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ReplaceNavigationResult>(`/pages/navigation/${encodePathSegment(location)}`, { ...options, method: 'PUT', body: input }),
    },
  };

  readonly loyalty = {
    program: (storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantLoyaltySnapshot>('/loyalty/program', { ...options, query: { store_id: storeId } }),
    setProgram: (input: SetMerchantLoyaltyInput, options: LetbuyyRequestOptions & { idempotencyKey: string }) =>
      this.requestData<MerchantLoyaltySaveResult>('/loyalty/program', { ...options, method: 'PUT', body: input }),
  };

  readonly coupons = {
    list: (query?: CouponListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Coupon>('/coupons', { ...options, query }),
    get: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>(`/coupons/${encodePathSegment(id)}`, options),
    create: (input: CreateCouponInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>('/coupons', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateCouponInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>(`/coupons/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/coupons/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    validate: (input: { store_id: string; code: string; cart_total?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<Coupon>('/coupons/validate', { ...options, method: 'POST', body: input }),
  };

  readonly blog = {
    posts: {
      list: (query?: BlogPostListQuery, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<BlogPost>('/blog/posts', { ...options, query }),
      get: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogPost>(`/blog/posts/${encodePathSegment(id)}`, options),
      create: (input: CreateBlogPostInput, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogPost>('/blog/posts', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateBlogPostInput, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogPost>(`/blog/posts/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/blog/posts/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
    comments: {
      list: (query: BlogCommentListQuery, options?: LetbuyyRequestOptions) =>
        this.requestPaginated<BlogComment>('/blog/comments', { ...options, query }),
      update: (id: string, input: UpdateBlogCommentInput, options?: LetbuyyRequestOptions) =>
        this.requestData<BlogComment>(`/blog/comments/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/blog/comments/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly formSubmissions = {
    list: (query: FormSubmissionListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<FormSubmission>('/form-submissions', { ...options, query }),
    update: (id: string, input: UpdateFormSubmissionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<FormSubmission>(`/form-submissions/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/form-submissions/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly exports = {
    products: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<{ job: ExportJobSummary }>('/export/products', { ...options, query }),
    orders: (query: Pick<StoreScopedQuery, 'store_id'> & { status?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<{ job: ExportJobSummary }>('/export/orders', { ...options, query }),
    customers: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
      this.requestData<{ job: ExportJobSummary }>('/export/customers', { ...options, query }),
    job: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ job: ExportJobSummary }>(`/export/jobs/${encodePathSegment(id)}`, options),
  };

  readonly reviews = {
    list: (query: ProductReviewListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<ProductReview>('/reviews', { ...options, query }),
    update: (id: string, input: UpdateProductReviewInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductReview>(`/reviews/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    reply: (id: string, input: ProductReviewReplyInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ProductReview>(`/reviews/${encodePathSegment(id)}/reply`, { ...options, method: 'POST', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/reviews/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly resume = {
    content: {
      list: (section: ResumeContentSection, query: ResumeContentListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<ResumeContentItem[]>(`/resume/section/${encodePathSegment(section)}`, { ...options, query }),
      create: (section: ResumeContentSection, input: CreateResumeContentItemInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ResumeContentItem>(`/resume/section/${encodePathSegment(section)}`, { ...options, method: 'POST', body: input }),
      update: (section: ResumeContentSection, id: string, input: UpdateResumeContentItemInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ResumeContentItem>(`/resume/section/${encodePathSegment(section)}/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (section: ResumeContentSection, id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/resume/section/${encodePathSegment(section)}/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly shipping = {
    zones: {
      list: (query: ShippingTaxListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingZone[]>('/shipping-tax/shipping/zones', { ...options, query }),
      create: (input: CreateShippingZoneInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingZone>('/shipping-tax/shipping/zones', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateShippingZoneInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingZone>(`/shipping-tax/shipping/zones/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/shipping-tax/shipping/zones/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
    rates: {
      list: (query: ShippingTaxListQuery, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingRate[]>('/shipping-tax/shipping', { ...options, query }),
      create: (input: CreateShippingRateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingRate>('/shipping-tax/shipping', { ...options, method: 'POST', body: input }),
      update: (id: string, input: UpdateShippingRateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<ShippingRate>(`/shipping-tax/shipping/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
      remove: (id: string, options?: LetbuyyRequestOptions) =>
        this.requestData<{ deleted: boolean }>(`/shipping-tax/shipping/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
    },
  };

  readonly taxes = {
    list: (query: ShippingTaxListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<TaxRate[]>('/shipping-tax/taxes', { ...options, query }),
    create: (input: CreateTaxRateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<TaxRate>('/shipping-tax/taxes', { ...options, method: 'POST', body: input }),
    update: (id: string, input: UpdateTaxRateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<TaxRate>(`/shipping-tax/taxes/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    remove: (id: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/shipping-tax/taxes/${encodePathSegment(id)}`, { ...options, method: 'DELETE' }),
  };

  readonly themes = {
    list: (query?: ThemeListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Theme>('/themes', { ...options, query }),
    listCatalog: async (query?: ThemeListQuery, options?: LetbuyyRequestOptions): Promise<ThemeCatalogResponse> => {
      const body = await this.request<GatewayResponse<ThemeCatalogItem[]> & { current_theme?: unknown; current_theme_record?: ThemeCatalogItem | null; store_status?: unknown }>(
        '/themes',
        { ...options, query },
      );
      const data = unwrapData<ThemeCatalogItem[]>(body, 200, null);
      const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};

      return {
        data,
        total: numberValue(meta.total, data.length),
        page: numberValue(meta.page, 1),
        limit: numberValue(meta.per_page, data.length),
        has_more: Boolean(meta.has_next),
        current_theme: typeof body.current_theme === 'string' ? body.current_theme : null,
        current_theme_record: body.current_theme_record || null,
        store_status: typeof body.store_status === 'string' ? body.store_status : null,
      };
    },
    get: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Theme>(`/themes/${encodePathSegment(slug)}`, options),
    schema: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeEditableSchemaResponse>(`/themes/${encodePathSegment(slug)}/schema`, options),
    categories: (options?: LetbuyyRequestOptions) =>
      this.requestData<string[]>('/themes/categories', options),
    industries: (options?: LetbuyyRequestOptions) =>
      this.requestData<string[]>('/themes/industries', options),
    suggestions: (query: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeSuggestionResult>('/themes/suggest', { ...options, query: { ...(options?.query || {}), q: query } }),
    collections: (options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeCollectionRecord[]>('/themes/collections', options),
    collection: (slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeCollectionRecord>(`/themes/collections/${encodePathSegment(slug)}`, options),
    author: (handle: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeAuthorProfile>(`/themes/authors/${encodePathSegment(handle)}`, options),
    purchases: (options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord[]>('/themes/purchases/list', options),
    installations: (options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord[]>('/themes/installations/list', options),
    downloads: (options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeDownloadGroup[]>('/themes/downloads/list', options),
    download: (slug: string, platform: ThemeDownloadPlatform, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeDownloadArtifact>(`/themes/${encodePathSegment(slug)}/downloads/${encodePathSegment(platform)}`, options),
    receipt: (purchaseId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePurchaseReceipt>(`/themes/purchases/${encodePathSegment(purchaseId)}/receipt`, options),
    settings: (options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeMarketplaceSettings>('/themes/settings', options),
    updateSettings: (input: ThemeMarketplaceSettingsInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeMarketplaceSettings>('/themes/settings', { ...options, method: 'PUT', body: input }),
    savedSearches: (options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord[]>('/themes/saved-searches', options),
    createSavedSearch: (input: ThemeSavedSearchInput, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/themes/saved-searches', { ...options, method: 'POST', body: input }),
    install: (slug: string, input: ThemeInstallInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeInstallResult>(`/themes/${encodePathSegment(slug)}/install`, { ...options, method: 'POST', body: input }),
    purchase: (slug: string, input: ThemePurchaseOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePurchaseOrderResult>(`/themes/${encodePathSegment(slug)}/purchase`, { ...options, method: 'POST', body: input }),
    verifyPurchase: (slug: string, input: ThemePurchaseVerifyInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePurchaseVerifyResult>(`/themes/${encodePathSegment(slug)}/purchase/verify`, { ...options, method: 'POST', body: input }),
    reviews: (slug: string, query?: ThemeReviewListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeReviewListResult>(`/themes/${encodePathSegment(slug)}/reviews`, { ...options, query }),
    createReview: (slug: string, input: ThemeReviewCreateInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeReviewRecord>(`/themes/${encodePathSegment(slug)}/reviews`, { ...options, method: 'POST', body: input }),
    replyReview: (slug: string, reviewId: string, input: ThemeReviewReplyInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeReviewRecord>(`/themes/${encodePathSegment(slug)}/reviews/${encodePathSegment(reviewId)}/reply`, { ...options, method: 'POST', body: input }),
    report: (slug: string, input: { reason: string; details?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/themes/${encodePathSegment(slug)}/reports`, { ...options, method: 'POST', body: input }),
    refund: (slug: string, input: { purchase_id: string; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/themes/${encodePathSegment(slug)}/refunds`, { ...options, method: 'POST', body: input }),
    createDeveloperListing: (input: ThemeDeveloperListingInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeDeveloperListingResult>('/themes/developer/listings', { ...options, method: 'POST', body: input }),
    developerDashboard: (options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/themes/developer/dashboard', options),
    uploadPackage: (input: ThemePackageUploadInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePackageUploadResult>('/themes/packages/upload', { ...options, method: 'POST', body: input }),
    editor: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeEditorPayload>(`/themes/${encodePathSegment(slug)}/editor`, { ...options, query: { ...(options?.query || {}), store_id: storeId } }),
    saveDraft: (slug: string, input: SaveThemeDraftInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeDraftSaveResult>(`/themes/${encodePathSegment(slug)}/editor/draft`, { ...options, method: 'PUT', body: input }),
    reorderDraft: (slug: string, input: ReorderThemeDraftInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeDraftSaveResult & { section_order: string[] }>(`/themes/${encodePathSegment(slug)}/editor/reorder`, { ...options, method: 'PUT', body: input }),
    deleteDraft: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/themes/${encodePathSegment(slug)}/editor/draft`, { ...options, method: 'DELETE', query: { ...(options?.query || {}), store_id: storeId } }),
    publish: (slug: string, input: PublishThemeInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePublishResult>(`/themes/${encodePathSegment(slug)}/publish`, { ...options, method: 'POST', body: input }),
    previewSession: (slug: string, input: ThemePreviewSessionInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePreviewSessionResult>(`/themes/${encodePathSegment(slug)}/preview-session`, { ...options, method: 'POST', body: input }),
    releases: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeRelease[]>(`/themes/${encodePathSegment(slug)}/releases`, { ...options, query: { store_id: storeId } }),
    rollbackRelease: (slug: string, releaseId: string, input: RollbackThemeReleaseInput, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemeRollbackResult>(`/themes/${encodePathSegment(slug)}/releases/${encodePathSegment(releaseId)}/rollback`, { ...options, method: 'POST', body: input }),
    // Phase Q — theme library management (site-scoped, tenant-safe)
    listSiteLibrary: (storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/themes/library', { ...options, query: { ...(options?.query || {}), store_id: storeId } }),
    createTheme: (storeId: string, input: { name: string; template_slug?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>('/themes/library/create', { ...options, method: 'POST', body: { store_id: storeId, ...input } }),
    duplicateTheme: (slug: string, storeId: string, input: { name?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/themes/${encodePathSegment(slug)}/duplicate`, { ...options, method: 'POST', body: { store_id: storeId, ...input } }),
    renameTheme: (slug: string, storeId: string, name: string, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/themes/${encodePathSegment(slug)}/rename`, { ...options, method: 'PATCH', body: { store_id: storeId, name } }),
    archiveTheme: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/themes/${encodePathSegment(slug)}/archive`, { ...options, method: 'POST', body: { store_id: storeId } }),
    deleteUnpublishedTheme: (slug: string, storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<JsonRecord>(`/themes/${encodePathSegment(slug)}/unpublished`, { ...options, method: 'DELETE', query: { ...(options?.query || {}), store_id: storeId } }),
  };

  readonly payments = {
    create: (input: CreatePaymentInput, options?: LetbuyyRequestOptions) =>
      this.requestData<Payment>('/payments', {
        ...options,
        method: 'POST',
        body: input,
        idempotencyKey: options?.idempotencyKey ?? input.idempotency_key,
      }),
    plans: (query: PlanListQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<SubscriptionPlan[]>('/payments/plans', { ...options, query }),
    subscription: {
      get: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<StoreSubscriptionState>('/payments/subscription', { ...options, query }),
      history: (query: Pick<StoreScopedQuery, 'store_id'>, options?: LetbuyyRequestOptions) =>
        this.requestData<BillingHistoryItem[]>('/payments/subscription/history', { ...options, query }),
      cancel: (input: CancelSubscriptionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionCancelResult>('/payments/subscription/cancel', { ...options, method: 'POST', body: input }),
      createOrder: (input: CreateSubscriptionOrderInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionOrderResult>('/payments/subscription/order', { ...options, method: 'POST', body: input }),
      coupon: (input: ValidateSubscriptionCouponInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionCouponResult>('/payments/subscription/coupon', { ...options, method: 'POST', body: input }),
      recover: (input: RecoverSubscriptionPaymentInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionRecoveryResult>('/payments/subscription/recover', { ...options, method: 'POST', body: input }),
      verify: (input: VerifySubscriptionInput, options?: LetbuyyRequestOptions) =>
        this.requestData<SubscriptionVerificationResult>('/payments/subscription/verify', { ...options, method: 'POST', body: input }),
    },
  };

  // Billing — how the MERCHANT pays LetBuyy (subscription bills). Distinct from the
  // `payments` group (subscription lifecycle) and from stores.paymentConfig (the
  // merchant's storefront provider for collecting from THEIR customers).
  readonly billing = {
    mandates: {
      list: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
        this.requestData<{ mandates: BillingMandate[] }>('/billing/mandates', { ...options, query }),
      create: (input: CreateBillingMandateInput, options?: LetbuyyRequestOptions) =>
        this.requestData<{ mandate: BillingMandate; replayed?: boolean }>('/billing/mandate', {
          ...options,
          method: 'POST',
          body: input,
          idempotencyKey: options?.idempotencyKey ?? input.idempotency_key,
        }),
    },
    invoices: {
      list: (query: { store_id: string; limit?: number }, options?: LetbuyyRequestOptions) =>
        this.requestData<{ invoices: BillingInvoiceRecord[] }>('/billing/invoices', { ...options, query }),
    },
  };

  // Founding Merchant Program — public reads (no auth: stats/remaining/pricing) plus
  // the merchant-scoped `me`. Mirrors the payments group.
  readonly foundingProgram = {
    get: (options?: LetbuyyRequestOptions) =>
      this.requestData<FoundingProgramPublic>('/founding-program', options),
    stats: (options?: LetbuyyRequestOptions) =>
      this.requestData<FoundingProgramPublic>('/founding-program/stats', options),
    remaining: (options?: LetbuyyRequestOptions) =>
      this.requestData<FoundingProgramRemaining>('/founding-program/remaining', options),
    pricing: (options?: LetbuyyRequestOptions) =>
      this.requestData<FoundingPricingResponse>('/pricing', options),
    me: (query: { store_id: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<MerchantFoundingStatus>('/founding/me', { ...options, query }),
  };

  // Super-admin founding administration + recovery (targets /internal/founding/*).
  // Server-side callers supply the internal API secret via options.headers.
  readonly foundingAdmin = {
    overview: (options?: LetbuyyRequestOptions) =>
      this.requestData<FoundingAdminOverview>('/internal/founding/overview', options),
    allocations: (query?: { search?: string; limit?: number }, options?: LetbuyyRequestOptions) =>
      this.requestData<{ allocations: FoundingAllocationRow[] }>('/internal/founding/allocations', { ...options, query }),
    setState: (input: { active?: boolean; paused?: boolean; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Record<string, unknown>>('/internal/founding/state', { ...options, method: 'POST', body: input }),
    allocate: (input: { site_id: string; subscription_id?: string; force?: boolean; allocation_source?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Record<string, unknown>>('/internal/founding/allocate', { ...options, method: 'POST', body: input }),
    reclaim: (input: { site_id: string; reason?: string; force?: boolean }, options?: LetbuyyRequestOptions) =>
      this.requestData<Record<string, unknown>>('/internal/founding/reclaim', { ...options, method: 'POST', body: input }),
    repairLock: (input: { site_id: string; reason?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<Record<string, unknown>>('/internal/founding/repair-lock', { ...options, method: 'POST', body: input }),
    reconcile: (input?: { repair?: boolean }, options?: LetbuyyRequestOptions) =>
      this.requestData<Record<string, unknown>>('/internal/founding/reconcile', { ...options, method: 'POST', body: input ?? {} }),
  };

  readonly storefront = {
    personalizationReview: async (subdomain: string, productId: string, variantId: string | null, options?: LetbuyyRequestOptions): Promise<PersonalizationReviewContext> => {
      if (variantId !== null && typeof variantId !== 'string') throw new Error('Supply an explicit variant UUID or null for personalization review.');
      const query = PersonalizationReviewQuerySchema.parse(variantId === null ? {} : { variant_id: variantId });
      const headers = new Headers(options?.headers);
      headers.set('Cache-Control', 'no-store');
      const context = PersonalizationReviewContextSchema.parse(await this.requestData<unknown>(`/storefront/${encodePathSegment(subdomain)}/products/${encodePathSegment(productId)}/personalization-review`, {
        ...options, method: 'GET', body: undefined, query, headers, cache: 'no-store',
      }));
      if (context.product_id !== productId.toLowerCase() || context.variant_id !== (variantId?.toLowerCase() ?? null)) throw new Error('Personalization review identity does not match the requested product and variant.');
      return context;
    },
    lookup: (query: { q?: string; host?: string; subdomain?: string }, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontLookupResult>('/storefront/lookup', { ...options, query }),
    directory: (options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontDirectoryPayload>('/storefront/directory', options).then(value => StorefrontDirectoryPayloadSchema.parse(value)),
    getStoreById: (storeId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStorePayload>(`/storefront/store/${encodePathSegment(storeId)}`, options),
    getStore: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStorePayload>(`/storefront/${encodePathSegment(subdomain)}`, options),
    // Old Gateways ignore the query and return the legacy shape during rollout.
    getRenderStore: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontRenderStorePayload | StorefrontStorePayload>(`/storefront/${encodePathSegment(subdomain)}`, { ...options, query: { ...options?.query, projection: 'render-v1' } }),
    checkoutExtensions: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCheckoutExtensionRegistryResponse>(`/storefront/${encodePathSegment(subdomain)}/checkout/extensions`, options),
    status: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStoreStatusPayload>(`/storefront/${encodePathSegment(subdomain)}/status`, options),
    themePreview: (subdomain: string, token: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontStorePayload>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { token } }),
    themePreviewContent: (subdomain: string, token: string, query: ThemePreviewContentQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<ThemePreviewContentPayload>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { ...query, token } }),
    themePreviewCollections: (subdomain: string, token: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCollectionSummary[]>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { token, resource: 'collections' } }),
    themePreviewCollection: (subdomain: string, token: string, collectionId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCollectionSummary>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { token, resource: 'collections', collection_id: collectionId } }),
    browsePreviewCollections: (subdomain: string, token: string, cursor: StorefrontCollectionCursorQuery = {}, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCollectionPage>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { after: cursor.after, before: cursor.before, token, resource: 'collections', browse: '1' } }),
    themePreviewProductPage: (subdomain: string, token: string, query: StorefrontProductQuery = {}, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, { ...options, query: { ...query, token, resource: 'products', pagination: '1' } }, true),
    themePreviewProducts: (subdomain: string, token: string, productIds?: string[], options?: LetbuyyRequestOptions) =>
      this.requestData<Product[]>(`/storefront/${encodePathSegment(subdomain)}/theme-preview`, {
        ...options, query: { ...options?.query, token, resource: 'products', ...(productIds ? { ids: productIds.join(',') } : {}) },
      }),
    navigation: (subdomain: string, location: string, options?: LetbuyyRequestOptions) =>
      this.requestData<NavigationResponse>(`/storefront/${encodePathSegment(subdomain)}/navigation`, { ...options, query: { location } }),
    listProducts: (subdomain: string, query?: StorefrontProductQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>(`/storefront/${encodePathSegment(subdomain)}/products`, { ...options, query }, true),
    listProductsByStoreId: (storeId: string, query?: StorefrontProductQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<Product>(`/storefront/store/${encodePathSegment(storeId)}/products`, { ...options, query }, true),
    getProduct: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<Product>(`/storefront/${encodePathSegment(subdomain)}/products/${encodePathSegment(slug)}`, options),
    productsByIds: (subdomain: string, productIds: string[], options?: LetbuyyRequestOptions) =>
      this.requestData<Product[]>(`/storefront/${encodePathSegment(subdomain)}/products/by-ids`, {
        ...options,
        query: { ...options?.query, ids: productIds },
      }),
    createOrder: (subdomain: string, input: StorefrontCreateOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCreateOrderResult>(`/storefront/${encodePathSegment(subdomain)}/orders`, { ...options, method: 'POST', body: input }),
    analyticsBeacon: (subdomain: string, input: StorefrontAnalyticsBeacon, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontAnalyticsBeaconResult>(`/storefront/${encodePathSegment(subdomain)}/analytics/beacon`, { ...options, method: 'POST', body: input }),
    pages: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload[]>(`/storefront/${encodePathSegment(subdomain)}/pages`, options),
    page: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload>(`/storefront/${encodePathSegment(subdomain)}/pages/${encodePathSegment(slug)}`, options),
    policies: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload[]>(`/storefront/${encodePathSegment(subdomain)}/policies`, options),
    policy: (subdomain: string, policyType: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload>(`/storefront/${encodePathSegment(subdomain)}/policies/${encodePathSegment(policyType)}`, options),
    blogPosts: (subdomain: string, query?: ListQuery, options?: LetbuyyRequestOptions) =>
      this.requestPaginated<StorefrontBlogPostPayload>(`/storefront/${encodePathSegment(subdomain)}/blog`, { ...options, query }),
    blogPost: (subdomain: string, slug: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontContentPayload>(`/storefront/${encodePathSegment(subdomain)}/blog/${encodePathSegment(slug)}`, options),
    validateCoupon: (subdomain: string, query: StorefrontCouponValidationQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCouponValidationResult>(`/storefront/${encodePathSegment(subdomain)}/coupons/validate`, { ...options, query }),
    validateCouponByStoreId: (storeId: string, query: StorefrontCouponValidationQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCouponValidationResult>(`/storefront/store/${encodePathSegment(storeId)}/coupons/validate`, { ...options, query }),
    orderContactSummary: (subdomain: string, contact: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontOrderContactSummary>(`/storefront/${encodePathSegment(subdomain)}/orders/contact`, { ...options, query: { contact } }),
    setOrderCredential: (input: StorefrontOrderCredentialInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontOrderCredentialSaveResult>('/storefront/customer/order-credential', { ...options, method: 'POST', body: input }),
    verifyOrderCredential: (input: StorefrontOrderCredentialInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontOrderCredentialLoginResult>('/storefront/customer/order-credential/login', { ...options, method: 'POST', body: input }),
    createCustomerFromOrder: (input: StorefrontCustomerFromOrderInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ created: boolean }>('/storefront/customer/from-order', { ...options, method: 'POST', body: input }),
    customerByEmail: (query: StorefrontCustomerLookupQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerResult>('/storefront/customer/by-email', { ...options, query }),
    setCustomerPassword: (input: StorefrontCustomerPasswordInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerPasswordResult>('/storefront/customer/password', { ...options, method: 'POST', body: input }),
    requestCustomerPasswordReset: (input: StorefrontCustomerPasswordResetRequestInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerPasswordResetRequestResult>('/storefront/customer/password/request-reset', { ...options, method: 'POST', body: input }),
    confirmCustomerPasswordReset: (input: StorefrontCustomerPasswordResetConfirmInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerPasswordResult>('/storefront/customer/password/confirm-reset', { ...options, method: 'POST', body: input }),
    verifyCustomerPassword: (input: StorefrontCustomerPasswordInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerResult>('/storefront/customer/login', { ...options, method: 'POST', body: input }),
    updateCustomerStats: (input: StorefrontCustomerStatsInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerStatsResult>('/storefront/customer/order-stats', { ...options, method: 'POST', body: input }),
    customerWishlist: (query: StorefrontWishlistQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontWishlistResult>('/storefront/customer/wishlist', { ...options, query }),
    addCustomerWishlistItem: (input: StorefrontWishlistInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ saved: boolean }>('/storefront/customer/wishlist', { ...options, method: 'POST', body: input }),
    removeCustomerWishlistItem: (input: StorefrontWishlistInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ removed: boolean }>('/storefront/customer/wishlist', { ...options, method: 'DELETE', body: input }),
    syncCustomerWishlist: (input: StorefrontWishlistSyncInput, options?: LetbuyyRequestOptions) =>
      this.requestData<{ synced: number }>('/storefront/customer/wishlist/sync', { ...options, method: 'POST', body: input }),
    customerOrders: (query: StorefrontCustomerLookupQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerOrdersResult>('/storefront/customer/orders', { ...options, query }),
    updateCustomerProfile: (input: StorefrontCustomerProfileInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerProfileResult>('/storefront/customer/profile', { ...options, method: 'PATCH', body: input }),
    customerAddresses: (query: StorefrontCustomerSessionQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerAddressListResult>('/storefront/customer/addresses', { ...options, query }),
    createCustomerAddress: (input: StorefrontCustomerAddressInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerAddressResult>('/storefront/customer/addresses', { ...options, method: 'POST', body: input }),
    updateCustomerAddress: (id: string, input: StorefrontCustomerAddressInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCustomerAddressResult>(`/storefront/customer/addresses/${encodePathSegment(id)}`, { ...options, method: 'PATCH', body: input }),
    removeCustomerAddress: (id: string, input: StorefrontCustomerSessionQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<{ deleted: boolean }>(`/storefront/customer/addresses/${encodePathSegment(id)}`, { ...options, method: 'DELETE', body: input }),
    productReviews: (query: StorefrontProductReviewsQuery, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontProductReviewsResult>('/storefront/reviews', { ...options, query }),
    submitProductReview: (input: StorefrontProductReviewInput, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontProductReviewResult>('/storefront/reviews', { ...options, method: 'POST', body: input }),
    listCollections: (subdomain: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCollectionSummary[]>(`/storefront/${encodePathSegment(subdomain)}/collections`, options),
    browseCollections: (subdomain: string, cursor: StorefrontCollectionCursorQuery = {}, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCollectionPage>(`/storefront/${encodePathSegment(subdomain)}/collections`, { ...options, query: { after: cursor.after, before: cursor.before, browse: '1' } }),
    getCollectionWithProducts: (subdomain: string, collectionId: string, options?: LetbuyyRequestOptions) =>
      this.requestData<StorefrontCollectionPayload>(`/storefront/${encodePathSegment(subdomain)}/collections/${encodePathSegment(collectionId)}`, options),
  };

  withOptions(options: Partial<LetbuyyApiClientOptions>): LetbuyyApiClient {
    return new LetbuyyApiClient({
      baseUrl: options.baseUrl ?? this.baseUrl,
      apiVersionPath: options.apiVersionPath ?? this.apiVersionPath,
      token: options.token ?? this.defaultToken,
      storeId: options.storeId ?? this.defaultStoreId,
      headers: options.headers ?? this.defaultHeaders,
      getHeaders: options.getHeaders ?? this.getHeaders,
      fetch: options.fetch ?? this.fetchImpl,
    });
  }

  health(options?: LetbuyyRequestOptions): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', { ...options, versioned: false });
  }

  async requestData<T>(path: string, options?: LetbuyyRequestOptions): Promise<T> {
    const body = await this.request<GatewayResponse<T>>(path, options);
    return unwrapData<T>(body, 200, null);
  }

  requestPaginated<T>(path: string, options?: LetbuyyRequestOptions): Promise<PaginatedResponse<T>>;
  requestPaginated<T>(path: string, options: LetbuyyRequestOptions | undefined, includeDiscovery: true): Promise<PaginatedResponse<T> & { discovery?: StorefrontDiscoveryMetadata }>;
  async requestPaginated<T>(path: string, options?: LetbuyyRequestOptions, includeDiscovery = false): Promise<PaginatedResponse<T> & { discovery?: StorefrontDiscoveryMetadata }> {
    const body = await this.request<GatewayResponse<T[]> & { discovery?: StorefrontDiscoveryMetadata }>(path, options);
    const data = unwrapData<T[]>(body, 200, null);
    const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};

    return {
      data,
      total: numberValue(meta.total, data.length),
      page: numberValue(meta.page, 1),
      limit: numberValue(meta.per_page, data.length),
      has_more: Boolean(meta.has_next),
      next_cursor: typeof meta.next_cursor === 'string' ? meta.next_cursor : null,
      total_is_exact: Boolean(meta.total_is_exact),
      ...(includeDiscovery && body.discovery && isRecord(body.discovery) ? { discovery: body.discovery } : {}),
    };
  }

  async request<T>(path: string, options: LetbuyyRequestOptions = {}): Promise<T> {
    const requestOptions = withAutomaticIdempotency(path, options);
    const url = this.buildUrl(path, requestOptions);
    const headers = await this.buildHeaders(requestOptions);
    const init: RequestInit = {
      method: requestOptions.method ?? 'GET',
      headers,
      signal: requestOptions.signal,
      ...(requestOptions.cache ? { cache: requestOptions.cache } : {}),
    };

    if (requestOptions.body !== undefined) {
      if (isRawRequestBody(requestOptions.body)) {
        init.body = requestOptions.body;
      } else {
        init.body = JSON.stringify(requestOptions.body);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      }
    }

    const response = await this.fetchImpl(url, init);
    const requestId = response.headers.get('X-Request-ID');
    const rawResponse = requestOptions.responseType === 'text' ? response.clone() : null;
    const [body, rawText] = await Promise.all([parseResponseBody(response), rawResponse?.text()]);

    if (!response.ok) {
      throw errorFromBody(body, response.status, requestId);
    }

    if (isFailurePayload(body)) {
      throw errorFromBody(body, response.status, requestId);
    }

    return (rawText === undefined ? body : rawText) as T;
  }

  private async buildHeaders(options: LetbuyyRequestOptions): Promise<Headers> {
    const headers = new Headers(this.defaultHeaders);
    if (this.getHeaders) copyHeaders(headers, await this.getHeaders());
    copyHeaders(headers, options.headers);

    const token = options.token ?? this.defaultToken;
    const storeId = options.storeId ?? this.defaultStoreId;

    headers.set('Accept', headers.get('Accept') ?? 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (storeId) headers.set('X-Store-ID', storeId);
    if (options.idempotencyKey) headers.set('X-Idempotency-Key', options.idempotencyKey);

    return headers;
  }

  private buildUrl(path: string, options: LetbuyyRequestOptions): string {
    const isAbsolute = path.startsWith('http://') || path.startsWith('https://');
    const route = isAbsolute
      ? path
      : `${this.baseUrl}${options.versioned === false ? '' : this.apiVersionPath}${normalizePath(path)}`;
    const query = serializeQuery(options.query);

    if (!query) return route;
    return `${route}${route.includes('?') ? '&' : '?'}${query}`;
  }
}

export function createLetbuyyApiClient(options: LetbuyyApiClientOptions): LetbuyyApiClient {
  return new LetbuyyApiClient(options);
}

export interface LetbuyyAppSdkOptions extends Omit<LetbuyyApiClientOptions, 'token'> {
  accessToken: string;
}

export interface LetbuyyAppSdk {
  products: LetbuyyApiClient['appApi']['products'];
  orders: LetbuyyApiClient['appApi']['orders'];
  updateInstallationMetadata: LetbuyyApiClient['appApi']['updateInstallationMetadata'];
}

export function createLetbuyyAppSdk(options: LetbuyyAppSdkOptions): LetbuyyAppSdk {
  const client = createLetbuyyApiClient({
    ...options,
    token: options.accessToken,
  });

  return {
    products: client.appApi.products,
    orders: client.appApi.orders,
    updateInstallationMetadata: client.appApi.updateInstallationMetadata,
  };
}

export * from './graphql';

function unwrapData<T>(body: GatewayResponse<T>, status: number, requestId: string | null): T {
  if (isFailurePayload(body)) {
    throw errorFromBody(body, status, requestId);
  }

  if (isRecord(body) && 'data' in body) {
    return body.data as T;
  }

  return body as T;
}

function isRawRequestBody(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<unknown>;
  }

  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorFromBody(body: unknown, status: number, requestId: string | null): LetbuyyApiError {
  if (isFailurePayload(body)) {
    return new LetbuyyApiError({
      status: body.error.status ?? status,
      code: body.error.code,
      message: body.error.message,
      requestId,
      body,
    });
  }

  return new LetbuyyApiError({
    status,
    code: status === 401 ? 'UNAUTHORIZED' : 'API_ERROR',
    message: typeof body === 'string' && body ? body : `LetBuyy API request failed with status ${status}`,
    requestId,
    body,
  });
}

function isFailurePayload(value: unknown): value is GatewayFailure {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function serializeQuery(query?: QueryParams): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(params, key, value);
  }

  return params.toString();
}

function appendQueryValue(params: URLSearchParams, key: string, value: QueryValue): void {
  if (Array.isArray(value)) {
    for (const item of value) appendQueryValue(params, key, item);
    return;
  }

  if (value === undefined || value === null) return;
  params.append(key, String(value));
}

function copyHeaders(target: Headers, source?: HeadersInit): void {
  if (!source) return;
  new Headers(source).forEach((value, key) => {
    target.set(key, value);
  });
}

function normalizePath(value: string): string {
  const path = value.trim();
  if (!path) return '';
  return path.startsWith('/') ? trimTrailingSlash(path) : `/${trimTrailingSlash(path)}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export type {
  AICreditBalance,
  AICreditPurchase,
  AIHomepageGenerationRequest,
  AIHomepageGenerationResult,
  AIOperatorRequest,
  AIOperatorResponse,
  AIUsageRecord,
  AnalyticsDashboard,
  AnalyticsLiveView,
  AnalyticsOrdersBreakdown,
  AnalyticsRevenue,
  AnalyticsTrafficSources,
  AppBridgeApiFetchResult,
  AppOAuthAuthorizationResult,
  AppOAuthTokenResult,
  AuthSessionResponse,
  BlogComment,
  BlogPost,
  BillingHistoryItem,
  Cart,
  Collection,
  Coupon,
  CustomDomainHealth,
  Customer,
  CustomerAddress,
  DomainAvailabilityQuote,
  DomainPurchaseResult,
  Employee,
  FileUploadResult,
  FormSubmission,
  GiftCard,
  GraphQLBulkOperation,
  GraphQLConnection,
  GraphQLPageInfo,
  GraphQLQueryCost,
  InventoryLevel,
  LineItem,
  MediaAsset,
  MediaType,
  MarketplaceApp,
  MarketplaceAppCategory,
  MarketplaceAppDeveloper,
  MarketplaceAppReview,
  MarketplaceReviewRecord,
  NavigationItem,
  NavigationResponse,
  Order,
  Page,
  PaginatedResponse,
  Payment,
  Policy,
  PolicyType,
  Product,
  ProductCategory,
  ProductReview,
  ResumeContentItem,
  ResumeContentSection,
  ReplaceNavigationResult,
  ShippingRate,
  ShippingZone,
  RiskBand,
  RiskDecision,
  RiskEntityType,
  RiskSignalSeverity,
  RiskSignalType,
  Store,
  StorefrontAnalyticsBeacon,
  StorefrontAnalyticsBeaconResult,
  StoreLocalizationSummary,
  StoreMarket,
  StoreMarketRoundingMode,
  StorePaymentConfig,
  StoreSummary,
  StorefrontLocale,
  StorefrontLocaleStatus,
  StorefrontTranslation,
  StorefrontTranslationResourceType,
  StorefrontTranslationStatus,
  StoreSubscriptionState,
  SubscriptionBillingPeriod,
  SubscriptionCancelResult,
  SubscriptionOrderResult,
  SubscriptionTaxSummary,
  SubscriptionPlan,
  SubscriptionRecoveryResult,
  SubscriptionVerificationResult,
  TaxRate,
  Theme,
  ThemeDraftSaveResult,
  ThemeEditableSchemaResponse,
  ThemeEditorPayload,
  ThemePreviewSessionResult,
  ThemePublishResult,
  ThemeRelease,
  ThemeRollbackResult,
  WhatsAppCapability,
  WhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppTemplate,
};

// PurchaseOrder, PurchaseOrderLine, PurchaseOrderLineInput, PurchaseOrderListQuery,
// CreatePurchaseOrderInput, ReceivePurchaseOrderInput, ReceivePurchaseOrderLineInput,
// Supplier, CreateSupplierInput, InventoryLocation, CreateInventoryLocationInput
// are defined and exported inline above.
