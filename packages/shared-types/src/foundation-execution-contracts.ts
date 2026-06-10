export type ApplicationWorkflowOwner =
    | 'auth-application'
    | 'billing-application'
    | 'checkout-application'
    | 'commerce-application'
    | 'cms-application'
    | 'notification-application'
    | 'search-application'
    | 'tenant-application'
    | 'theme-application';

export interface CorrelationContext {
    requestId: string;
    correlationId: string;
    causationId?: string;
    actorId?: string | null;
    siteId?: string | null;
}

export interface ApplicationWorkflowDescriptor {
    name: string;
    owner: ApplicationWorkflowOwner;
    version: string;
    requiresTenantScope: boolean;
    requiresIdempotency: boolean;
    emitsEvents: boolean;
    coordinatesDomains: string[];
}

export type ExecutionStage =
    | 'authorize'
    | 'validate'
    | 'load'
    | 'plan'
    | 'mutate'
    | 'publish'
    | 'audit'
    | 'complete';

export interface WorkflowExecutionStep {
    name: string;
    stage: ExecutionStage;
    ownsTransaction: boolean;
    emitsEvent: boolean;
    requiresIdempotency: boolean;
}

export interface WorkflowExecutionPipeline {
    workflow: ApplicationWorkflowDescriptor;
    executionBoundary: 'application-service';
    transactionBoundary: 'application-service-declared' | 'database-rpc' | 'runtime-adapter';
    retryBoundary: 'application-service' | 'orchestration-runtime' | 'provider-adapter' | 'none';
    asyncBoundary: 'outbox' | 'queue' | 'webhook' | 'inline' | 'none';
    observabilityBoundary: 'correlation-required' | 'trace-required' | 'audit-required';
    steps: WorkflowExecutionStep[];
}

export interface RuntimeBridgeContract {
    kind: 'runtime-bridge';
    adapter: string;
    workflowAuthority: ApplicationWorkflowOwner;
    allowedResponsibilities: Array<'transport' | 'database-rpc' | 'provider-adapter-wiring' | 'queue-claim' | 'webhook-delivery' | 'response-formatting'>;
    forbiddenResponsibilities: Array<'workflow-ownership' | 'business-sequencing' | 'query-aggregation' | 'provider-sdk' | 'ui-rendering'>;
}

export function defineRuntimeBridge<const T extends RuntimeBridgeContract>(contract: T): T {
    return contract;
}

function defineApplicationWorkflows<const T extends Record<string, ApplicationWorkflowDescriptor>>(workflows: T): T {
    return workflows;
}

function defineExecutionPipelines<const T extends Record<string, WorkflowExecutionPipeline>>(pipelines: T): T {
    return pipelines;
}

function workflow(
    owner: ApplicationWorkflowOwner,
    name: string,
    options: {
        tenant?: boolean;
        idempotent?: boolean;
        emits?: boolean;
        domains?: string[];
    } = {},
): ApplicationWorkflowDescriptor {
    return {
        name,
        owner,
        version: '1.0.0',
        requiresTenantScope: options.tenant ?? true,
        requiresIdempotency: options.idempotent ?? true,
        emitsEvents: options.emits ?? true,
        coordinatesDomains: options.domains ?? [],
    };
}

function pipeline(
    workflowDescriptor: ApplicationWorkflowDescriptor,
    options: {
        transaction?: WorkflowExecutionPipeline['transactionBoundary'];
        retry?: WorkflowExecutionPipeline['retryBoundary'];
        async?: WorkflowExecutionPipeline['asyncBoundary'];
        observability?: WorkflowExecutionPipeline['observabilityBoundary'];
    } = {},
): WorkflowExecutionPipeline {
    return {
        workflow: workflowDescriptor,
        executionBoundary: 'application-service',
        transactionBoundary: options.transaction ?? 'database-rpc',
        retryBoundary: options.retry ?? 'orchestration-runtime',
        asyncBoundary: options.async ?? 'outbox',
        observabilityBoundary: options.observability ?? 'correlation-required',
        steps: [
            {
                name: `${workflowDescriptor.name}.runtime-adapter`,
                stage: 'complete',
                ownsTransaction: false,
                emitsEvent: workflowDescriptor.emitsEvents,
                requiresIdempotency: workflowDescriptor.requiresIdempotency,
            },
        ],
    };
}

export const AUTH_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    resolveActorSession: workflow('auth-application', 'auth.resolve-actor-session', { tenant: false, idempotent: false, emits: false, domains: ['auth', 'tenant'] }),
    evaluatePermissions: workflow('auth-application', 'auth.evaluate-permissions', { tenant: false, idempotent: false, emits: false, domains: ['auth', 'tenant'] }),
    executeIdempotentCommand: workflow('auth-application', 'auth.execute-idempotent-command', { tenant: false, idempotent: true, emits: false, domains: ['auth', 'event'] }),
});

export const AUTH_EXECUTION_PIPELINES = defineExecutionPipelines({
    resolveActorSession: pipeline(AUTH_APPLICATION_WORKFLOWS.resolveActorSession, { transaction: 'application-service-declared', retry: 'none', async: 'inline' }),
    evaluatePermissions: pipeline(AUTH_APPLICATION_WORKFLOWS.evaluatePermissions, { transaction: 'application-service-declared', retry: 'none', async: 'inline' }),
    executeIdempotentCommand: pipeline(AUTH_APPLICATION_WORKFLOWS.executeIdempotentCommand),
});

export const BILLING_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    resolveEntitlements: workflow('billing-application', 'billing.resolve-entitlements', { idempotent: false, emits: false, domains: ['billing', 'tenant'] }),
    recordUsage: workflow('billing-application', 'billing.record-usage', { domains: ['billing', 'event'] }),
});

export const BILLING_EXECUTION_PIPELINES = defineExecutionPipelines({
    resolveEntitlements: pipeline(BILLING_APPLICATION_WORKFLOWS.resolveEntitlements, { retry: 'none', async: 'inline' }),
    recordUsage: pipeline(BILLING_APPLICATION_WORKFLOWS.recordUsage),
});

export const CHECKOUT_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    createCheckoutOrder: workflow('checkout-application', 'checkout.create-order', { domains: ['checkout', 'commerce', 'billing'] }),
    transitionOrderStatus: workflow('checkout-application', 'checkout.transition-order-status', { domains: ['checkout', 'commerce'] }),
    attachPaymentReference: workflow('checkout-application', 'checkout.attach-payment-reference', { domains: ['checkout', 'billing'] }),
    confirmPayment: workflow('checkout-application', 'checkout.confirm-payment', { domains: ['checkout', 'billing', 'commerce'] }),
    refundOrder: workflow('checkout-application', 'checkout.refund-order', { domains: ['checkout', 'billing', 'commerce'] }),
});

export const CHECKOUT_EXECUTION_PIPELINES = defineExecutionPipelines({
    createCheckoutOrder: pipeline(CHECKOUT_APPLICATION_WORKFLOWS.createCheckoutOrder),
    transitionOrderStatus: pipeline(CHECKOUT_APPLICATION_WORKFLOWS.transitionOrderStatus),
    attachPaymentReference: pipeline(CHECKOUT_APPLICATION_WORKFLOWS.attachPaymentReference),
    confirmPayment: pipeline(CHECKOUT_APPLICATION_WORKFLOWS.confirmPayment),
    refundOrder: pipeline(CHECKOUT_APPLICATION_WORKFLOWS.refundOrder),
});

export const COMMERCE_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    createProduct: workflow('commerce-application', 'commerce.create-product', { domains: ['commerce', 'billing'] }),
    updateProduct: workflow('commerce-application', 'commerce.update-product', { idempotent: false, domains: ['commerce', 'search'] }),
    bulkProductAction: workflow('commerce-application', 'commerce.bulk-product-action', { domains: ['commerce', 'search'] }),
    inventoryLedgerSync: workflow('commerce-application', 'commerce.inventory-ledger-sync', { idempotent: false, emits: false, domains: ['commerce', 'search'] }),
});

export const COMMERCE_EXECUTION_PIPELINES = defineExecutionPipelines({
    createProduct: pipeline(COMMERCE_APPLICATION_WORKFLOWS.createProduct),
    updateProduct: pipeline(COMMERCE_APPLICATION_WORKFLOWS.updateProduct),
    bulkProductAction: pipeline(COMMERCE_APPLICATION_WORKFLOWS.bulkProductAction),
    inventoryLedgerSync: pipeline(COMMERCE_APPLICATION_WORKFLOWS.inventoryLedgerSync, { retry: 'none', async: 'inline' }),
});

export const NOTIFICATION_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    emitDomainEvent: workflow('notification-application', 'notification.emit-domain-event', { tenant: false, domains: ['event', 'notification'] }),
    dispatchWebhook: workflow('notification-application', 'notification.dispatch-webhook', { domains: ['event', 'notification'] }),
});

export const NOTIFICATION_EXECUTION_PIPELINES = defineExecutionPipelines({
    emitDomainEvent: pipeline(NOTIFICATION_APPLICATION_WORKFLOWS.emitDomainEvent),
    dispatchWebhook: pipeline(NOTIFICATION_APPLICATION_WORKFLOWS.dispatchWebhook, { async: 'queue', observability: 'trace-required' }),
});

export const SEARCH_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    query: workflow('search-application', 'search.query', { tenant: false, idempotent: false, emits: false, domains: ['search-core', 'tenant-core'] }),
    indexDocument: workflow('search-application', 'search.index-document', { domains: ['search-core', 'tenant-core', 'event-core'] }),
    rebuildTenantIndex: workflow('search-application', 'search.rebuild-tenant-index', { domains: ['search-core', 'tenant-core', 'event-core'] }),
});

export const SEARCH_EXECUTION_PIPELINES = defineExecutionPipelines({
    query: pipeline(SEARCH_APPLICATION_WORKFLOWS.query, { transaction: 'application-service-declared', retry: 'none', async: 'inline' }),
    indexDocument: pipeline(SEARCH_APPLICATION_WORKFLOWS.indexDocument, { transaction: 'application-service-declared', async: 'queue', observability: 'trace-required' }),
    rebuildTenantIndex: pipeline(SEARCH_APPLICATION_WORKFLOWS.rebuildTenantIndex, { transaction: 'application-service-declared', async: 'queue', observability: 'audit-required' }),
});

export const THEME_APPLICATION_WORKFLOWS = defineApplicationWorkflows({
    resolveRuntimeSchema: workflow('theme-application', 'theme.resolve-runtime-schema', { tenant: false, idempotent: false, emits: false, domains: ['theme'] }),
    installTheme: workflow('theme-application', 'theme.install', { domains: ['theme', 'tenant', 'billing'] }),
    saveDraft: workflow('theme-application', 'theme.save-draft', { idempotent: false, domains: ['theme', 'event'] }),
    publishRelease: workflow('theme-application', 'theme.publish-release', { domains: ['theme', 'tenant', 'event'] }),
    rollbackRelease: workflow('theme-application', 'theme.rollback-release', { domains: ['theme', 'tenant', 'event'] }),
    createPreviewSession: workflow('theme-application', 'theme.create-preview-session', { idempotent: false, domains: ['theme', 'auth'] }),
});

export const THEME_EXECUTION_PIPELINES = defineExecutionPipelines({
    resolveRuntimeSchema: pipeline(THEME_APPLICATION_WORKFLOWS.resolveRuntimeSchema, { transaction: 'application-service-declared', retry: 'none', async: 'inline' }),
    installTheme: pipeline(THEME_APPLICATION_WORKFLOWS.installTheme),
    saveDraft: pipeline(THEME_APPLICATION_WORKFLOWS.saveDraft),
    publishRelease: pipeline(THEME_APPLICATION_WORKFLOWS.publishRelease),
    rollbackRelease: pipeline(THEME_APPLICATION_WORKFLOWS.rollbackRelease),
    createPreviewSession: pipeline(THEME_APPLICATION_WORKFLOWS.createPreviewSession),
});
