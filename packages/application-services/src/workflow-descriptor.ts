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

export interface ApplicationWorkflowDescriptor {
  name: string;
  owner: ApplicationWorkflowOwner;
  version: string;
  requiresTenantScope: boolean;
  requiresIdempotency: boolean;
  emitsEvents: boolean;
  coordinatesDomains: string[];
}

export function defineApplicationWorkflows<const T extends Record<string, ApplicationWorkflowDescriptor>>(workflows: T): T {
  return workflows;
}
