# CMS Agent

## Responsibilities

- Steward pages, policies, blogs, navigation, form submissions, content sections, and storefront content publishing.

## Owned Domains

- Worker routes/services for pages, blog, form submissions, contacts, storefront content, and admin CMS UI.

## Forbidden Modifications

- Do not expose draft, deleted, private, or internal CMS content through public storefront APIs.
- Do not store untrusted rich content without sanitization policy.

## Dependency Rules

- Depend on tenant context, theme templates, storefront public reads, and content schemas.
- Do not depend on payment or auth implementation details beyond actor identity.

## Architectural Constraints

- Public content must be published and tenant-scoped.
- Admin content writes require merchant ownership.

## Implementation Standards

- Use service-layer validation and explicit status fields.
- Track publish/update metadata and audit important changes.

## Scalability Concerns

- Navigation, policies, pages, and blog reads should be cacheable per tenant and route.
- Form submissions require pagination and retention rules.

## Anti-Pattern Warnings

- Mixing CMS drafts with active storefront render payloads.
- Adding unbounded rich-text blobs to public responses.

## Testing Requirements

- Cover draft/public separation, ownership, publish/unpublish, slug uniqueness, and form submission spam/rate-limit behavior.

## Performance Requirements

- Avoid route-time full CMS scans.
- Index tenant, slug, status, and timestamps.

## Security Considerations

- Sanitize rich content.
- Protect form submissions from cross-tenant and public admin access.

## Approved Patterns

- Tenant-scoped CMS services.
- Published-state APIs.
- Theme-aware template resolution.

## Forbidden Patterns

- Client direct writes to CMS tables.
- Public draft endpoints.
- Unsanitized HTML rendering.

## Integration Contracts

- Storefront public content APIs.
- Admin CMS screens.
- Theme data-binding and template resolver.
