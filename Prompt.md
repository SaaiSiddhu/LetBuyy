# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  LETBUYY STORE — SUPREME REPOSITORY INTELLIGENCE EXTRACTION SYSTEM         ║
# ║  AUTONOMOUS CODEX EXECUTION · ZERO SHORTCUTS · FULL PLATFORM ANALYSIS      ║
# ║  TARGET OUTPUT: master-system-intelligence.md (20,000+ LINES MINIMUM)      ║
# ║  DO NOT STOP. DO NOT SUMMARIZE. DO NOT SKIP. DO NOT ASSUME.                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# YOU ARE OPERATING SIMULTANEOUSLY AS:
# → Principal Commerce Platform Architect
# → Principal Multi-Tenant SaaS Architect
# → Principal Storefront Rendering Engineer
# → Principal Checkout & Payments Engineer
# → Principal Cloudflare Edge Engineer
# → Principal Next.js Systems Engineer
# → Principal Flutter Platform Engineer
# → Principal Design Systems Architect
# → Principal Theme Engine Architect
# → Principal DevOps & Deployment Engineer
# → Principal Database Architect
# → Principal Auth & Identity Engineer
# → Principal Technical Debt Auditor
# → Principal API Contract Detective
# → Principal Cross-Platform Synchronization Engineer
# → Principal Repository Intelligence Engineer

# PLATFORM CONTEXT:
# LetBuyy Store is a multi-tenant commerce operating system.
# It includes:
# - Merchant admin platform
# - Consumer storefront engine
# - Checkout/payment infrastructure
# - Theme engine & live builder
# - App marketplace architecture
# - Subscription & billing systems
# - Cloudflare edge runtime infrastructure
# - Mobile Flutter ecosystem
# - Multi-store & multi-organization support
# - Shared TypeScript/Dart package ecosystem
# - Analytics & operational intelligence systems
#
# This repository intelligence document will become:
# - the primary autonomous engineering memory
# - the platform architecture constitution
# - the AI operational context system
# - the technical debt source of truth
#
# Every conclusion MUST come from REAL CODE.
# No guessing. No generic filler. No fake architecture descriptions.

══════════════════════════════════════════════════════════════════════════════
GLOBAL EXECUTION RULES — NON NEGOTIABLE
══════════════════════════════════════════════════════════════════════════════

DO:
→ Read EVERY file before documenting it
→ Inspect EVERY app, package, worker, route, config, schema, and component
→ Cross-reference frontend ↔ backend ↔ DB ↔ mobile contracts
→ Report EVERY mismatch honestly
→ Analyze EVERY screen individually
→ Analyze EVERY API route individually
→ Analyze EVERY DB table individually
→ Document EVERY hardcoded value with file references
→ Capture full typecheck and lint outputs
→ Report every TODO/FIXME/HACK
→ Detect architectural inconsistencies
→ Detect cross-platform sync failures
→ Detect tenant isolation weaknesses
→ Detect checkout/payment vulnerabilities
→ Detect design system drift
→ Detect duplicated business logic
→ Detect stale packages and dead code
→ Generate AGENTS.md intelligence files
→ Build operational memory for future autonomous engineering

DO NOT:
→ Invent systems that do not exist
→ Use generic “handles X” descriptions
→ Skip any app or package
→ Skip any route or schema
→ Summarize complex systems
→ Assume tenant isolation exists
→ Assume auth is secure
→ Assume APIs are synchronized
→ Assume Flutter and web behave consistently
→ Ignore technical debt
→ Ignore performance issues
→ Ignore design inconsistencies
→ Stop before 20,000+ lines

══════════════════════════════════════════════════════════════════════════════
PHASE 0 — REPOSITORY CENSUS
══════════════════════════════════════════════════════════════════════════════

RUN ALL COMMANDS BELOW AND CAPTURE REAL OUTPUT.

```bash
find . -name "*.ts" -not -path "*/node_modules/*" | wc -l
find . -name "*.tsx" -not -path "*/node_modules/*" | wc -l
find . -name "*.dart" | wc -l
find . -name "*.css" -not -path "*/node_modules/*" | wc -l
find . -name "*.json" -not -path "*/node_modules/*" | wc -l
find . -name "*.md" -not -path "*/node_modules/*" | wc -l
find . -name "*.sql" -not -path "*/node_modules/*" | wc -l
find . -name "*.env*" | wc -l

find . -type d \
-not -path "*/node_modules/*" \
-not -path "*/.git/*" \
-not -path "*/dist/*" \
-not -path "*/build/*" \
-not -path "*/.next/*" \
-not -path "*/.turbo/*" \
| sort | head -600

find . -name "*.prisma" -not -path "*/node_modules/*"
find . -name "schema.*" -not -path "*/node_modules/*"

grep -rn "^model " . --include="*.prisma" | wc -l

find . -path "*/api/*" -name "*.ts" -not -path "*/node_modules/*" | wc -l
find . -path "*/routes/*" -name "*.ts" -not -path "*/node_modules/*" | wc -l

find apps/ -name "page.tsx" -not -path "*/node_modules/*" | wc -l
find apps/ -name "page.tsx" -not -path "*/node_modules/*" | sort

find . -name "wrangler.toml" -not -path "*/node_modules/*"

find packages/ui/ -name "*.tsx" -not -path "*/node_modules/*" | wc -l

pnpm typecheck 2>&1 | tail -200
pnpm lint 2>&1 | tail -150

grep -rn "TODO\|FIXME\|HACK\|PLACEHOLDER\|@ts-ignore\|eslint-disable" \
--include="*.ts" --include="*.tsx" \
-not -path "*/node_modules/*" | wc -l

grep -rn "console\.log\|console\.error\|console\.warn" \
--include="*.ts" --include="*.tsx" \
-not -path "*/node_modules/*" | wc -l

grep -rn "as any\|: any" \
--include="*.ts" --include="*.tsx" \
-not -path "*/node_modules/*" | wc -l

grep -rn "#[0-9a-fA-F]\{3,8\}" \
--include="*.tsx" --include="*.css" \
-not -path "*/node_modules/*" | wc -l

grep -rn "tenantId\|storeId\|workspaceId\|organizationId\|merchantId\|subdomain" \
--include="*.ts" --include="*.tsx" \
-not -path "*/node_modules/*" | wc -l
══════════════════════════════════════════════════════════════════════════════
MASTER DOCUMENT STRUCTURE
══════════════════════════════════════════════════════════════════════════════
FILE:
docs/architecture/master-system-intelligence.md
MINIMUM:
20,000 lines.
NO MAXIMUM.
════════════════════════════════════════
SECTION 1 — GENERATION FACTS
════════════════════════════════════════
1.1 Repository metadata
1.2 Real repository census
1.3 Full typecheck output
1.4 Full lint output
1.5 Total:
apps
packages
routes
screens
workers
schemas
tables
components
providers
hooks
contexts
middleware
TODOs
console.logs
hardcoded colors
any casts
tenant references
════════════════════════════════════════
SECTION 2 — PLATFORM OVERVIEW
════════════════════════════════════════
2.1 What LetBuyy Store Actually Is
Write 1000+ words from REAL CODE observations:
platform structure
commerce model
merchant ecosystem
storefront architecture
theme system
admin ecosystem
checkout architecture
app marketplace
billing model
operational tooling
analytics infrastructure
mobile ecosystem
tenant hierarchy
2.2 Commerce Business Model
Document from ACTUAL schema/code:
organizations
merchant workspaces
stores
storefronts
subscriptions
plans
billing
payments
domains
inventory
orders
customers
analytics
apps
themes
2.3 Platform Hierarchy
Platform
↓
Organization
↓
Merchant Workspace
↓
Store
↓
Storefront
↓
Customers
↓
Orders
↓
Subscriptions
↓
Analytics
Document:
DB model
relationships
tenant isolation
runtime ownership
════════════════════════════════════════
SECTION 3 — FULL TECH STACK MATRIX
════════════════════════════════════════
Document EVERY technology:
| Technology | Version | Used In | Purpose | Health |
Audit:
frontend dependencies
backend dependencies
Flutter dependencies
worker dependencies
design system dependencies
analytics dependencies
build tooling
deployment tooling
Flag:
unused
outdated
duplicated
risky
conflicting
════════════════════════════════════════
SECTION 4 — FULL REPOSITORY STRUCTURE
════════════════════════════════════════
4.1 Complete directory tree
4.2 App inventory
Document EVERY app:
admin
storefront
auth
checkout
analytics
app-store
theme-marketplace
internal
mobile/flutter apps
For each:
purpose
target users
auth model
routes
dependencies
architecture quality
issues
4.3 Package inventory
Document EVERY package:
exports
usage
quality
dead code
architectural issues
4.4 Naming convention audit
Audit:
file naming
directory naming
DB naming
API naming
schema naming
route naming
Flag inconsistencies.
════════════════════════════════════════
SECTION 5 — DATABASE COMPLETE ANALYSIS
════════════════════════════════════════
Document EVERY table/model individually.
FOR EVERY TABLE:
name
domain
fields
indexes
relations
tenant isolation
soft delete
audit fields
monetary fields
performance risks
normalization issues
GROUP BY DOMAINS:
CORE:
organizations
workspaces
stores
users
teams
permissions
COMMERCE:
products
variants
collections
inventory
carts
checkout
orders
refunds
shipping
taxes
coupons
discounts
CUSTOMERS:
accounts
addresses
wishlists
sessions
STORE BUILDER:
themes
sections
blocks
templates
assets
schemas
MARKETPLACE:
apps
installations
permissions
webhooks
BILLING:
subscriptions
invoices
payments
plans
usage tracking
ANALYTICS:
events
metrics
dashboards
════════════════════════════════════════
SECTION 6 — API COMPLETE ANALYSIS
════════════════════════════════════════
FOR EVERY API ROUTE:
METHOD /route
File:
Auth:
Tenant scope:
Permission:
Validation:
DB queries:
Cache:
Output:
Side effects:
Issues:
AUDIT:
missing auth
missing tenant isolation
missing permissions
missing validation
IDOR risks
insecure checkout
insecure payment flows
webhook verification issues
════════════════════════════════════════
SECTION 7 — AUTH & PERMISSION ANALYSIS
════════════════════════════════════════
Document:
merchant auth
customer auth
admin auth
staff auth
checkout auth
guest checkout
OAuth/social login
session propagation
multi-store access
permission inheritance
ANALYZE:
RBAC/PBAC model
session architecture
MFA
tenant-scoped auth
permission enforcement
frontend/backend mismatch
════════════════════════════════════════
SECTION 8 — THEME ENGINE ANALYSIS
════════════════════════════════════════
CRITICAL SECTION.
Document:
theme architecture
rendering pipeline
hydration strategy
live builder
section system
block system
template engine
schema system
dynamic rendering
asset pipeline
preview system
tenant overrides
performance risks
design token integration
════════════════════════════════════════
SECTION 9 — CHECKOUT & PAYMENT ANALYSIS
════════════════════════════════════════
Document:
cart lifecycle
checkout lifecycle
payment orchestration
order lifecycle
refund lifecycle
inventory reservation
coupon engine
tax calculation
shipping calculation
webhook handling
payment retries
fraud prevention
VERIFY:
double payment prevention
webhook signatures
amount tampering prevention
stock race conditions
abandoned cart handling
════════════════════════════════════════
SECTION 10 — WEB ↔ FLUTTER SYNCHRONIZATION AUDIT
════════════════════════════════════════
CRITICAL SECTION.
Analyze:
shared contracts
API parity
model parity
theme parity
auth parity
analytics parity
design token parity
state synchronization
Flag EVERY mismatch:
field mismatches
type mismatches
missing features
inconsistent auth
inconsistent business rules
duplicated models
════════════════════════════════════════
SECTION 11 — SCREEN BY SCREEN DOCUMENTATION
════════════════════════════════════════
DOCUMENT EVERY SCREEN INDIVIDUALLY.
FOR EACH SCREEN:
route
file
purpose
target user
auth guard
APIs called
loading states
error states
tables
forms
filters
pagination
charts
actions
modals
tenant behavior
permission behavior
design token compliance
hardcoded styles
performance issues
accessibility issues
TODO comments
quality rating
INCLUDE:
storefront pages
product pages
cart
checkout
merchant dashboard
analytics
inventory
orders
customers
billing
domains
themes
builder
app marketplace
internal ops
mobile screens
════════════════════════════════════════
SECTION 12 — DESIGN SYSTEM AUDIT
════════════════════════════════════════
Analyze:
tokens
colors
typography
spacing
shadows
motion
semantic colors
dark mode
Flutter/web parity
Audit:
hardcoded colors
inline styles
duplicated components
inconsistent spacing
inconsistent typography
════════════════════════════════════════
SECTION 13 — CLOUDFLARE & EDGE ANALYSIS
════════════════════════════════════════
Analyze EVERY worker:
bindings
KV
R2
D1
queues
cron
edge caching
middleware
routing
analytics
image optimization
CDN behavior
════════════════════════════════════════
SECTION 14 — PERFORMANCE ANALYSIS
════════════════════════════════════════
Audit:
N+1 queries
missing indexes
unbounded queries
oversized bundles
hydration costs
excessive client components
slow storefront rendering
checkout latency
caching strategy
cache invalidation
════════════════════════════════════════
SECTION 15 — SECURITY AUDIT
════════════════════════════════════════
Audit:
tenant isolation
auth security
session security
API security
checkout security
payment security
webhook security
secret management
data leakage
permission bypass
admin escalation
customer privacy
════════════════════════════════════════
SECTION 16 — TECHNICAL DEBT REGISTER
════════════════════════════════════════
Compile EVERY issue:
architecture
design
auth
payments
performance
design system
synchronization
APIs
schema mismatches
frontend/backend conflicts
Rank:
severity
effort
impact
════════════════════════════════════════
SECTION 17 — AGENTS.MD GENERATION
════════════════════════════════════════
GENERATE:
/AGENTS.md
apps/admin/AGENTS.md
apps/storefront/AGENTS.md
apps/auth/AGENTS.md
apps/internal/AGENTS.md
apps/checkout/AGENTS.md
apps/flutter/AGENTS.md
packages/api/AGENTS.md
packages/db/AGENTS.md
packages/ui/AGENTS.md
packages/auth/AGENTS.md
Each must contain REAL repository intelligence.
════════════════════════════════════════
SECTION 18 — FUTURE ROADMAP
════════════════════════════════════════
Immediate:
synchronization fixes
contract unification
tenant hardening
checkout stabilization
design token enforcement
Short-term:
app marketplace
AI analytics
mobile parity
theme marketplace
advanced builder
Medium-term:
edge personalization
AI storefront generation
autonomous analytics
subscription commerce
Long-term:
commerce operating system
global edge rendering
AI merchant assistant
autonomous store optimization
════════════════════════════════════════
SECTION 19 — FILE MEMORY REGISTRY
════════════════════════════════════════
FOR EVERY CRITICAL FILE:
purpose
dependencies
tenant criticality
auth criticality
testing requirements
modification risks
════════════════════════════════════════
COMPLETION CONDITIONS
════════════════════════════════════════
DO NOT DECLARE COMPLETE UNTIL:
✅ master-system-intelligence.md exists
✅ 20,000+ lines generated
✅ Every screen documented
✅ Every API route analyzed
✅ Every DB table analyzed
✅ Every worker analyzed
✅ Every app documented
✅ Every package documented
✅ Flutter/web sync audit complete
✅ Theme engine analysis complete
✅ Checkout analysis complete
✅ Security audit complete
✅ Technical debt register complete
✅ AGENTS.md files generated
✅ Typecheck and lint outputs captured
✅ Contract mismatch analysis complete
✅ Tenant isolation audit complete
════════════════════════════════════════
FINAL OUTPUT FORMAT
════════════════════════════════════════
╔══════════════════════════════════════════════════════════════════════╗
║ LETBUYY STORE — REPOSITORY INTELLIGENCE EXTRACTION — COMPLETE ║
╠══════════════════════════════════════════════════════════════════════╣
║ Total lines generated: [N] ║
║ Apps documented: [N] ║
║ Screens documented: [N] ║
║ API routes documented: [N] ║
║ DB tables documented: [N] ║
║ Workers analyzed: [N] ║
║ Theme systems analyzed: [N] ║
║ Checkout flows analyzed: [N] ║
║ Security findings: [N] ║
║ Tenant isolation issues: [N] ║
║ Technical debt items: [N] ║
║ Contract mismatches: [N] ║
║ Flutter/Web sync issues: [N] ║
║ Permission gaps: [N] ║
║ AGENTS.md files created: [N] ║
║ TypeScript errors found: [N] ║
╚══════════════════════════════════════════════════════════════════════╝