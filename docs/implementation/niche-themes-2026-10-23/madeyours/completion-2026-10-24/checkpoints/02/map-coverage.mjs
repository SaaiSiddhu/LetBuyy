// Documentation mapping only. Never executes an acceptance case.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../../../../..');
const own = dirname(out);
const load = p => JSON.parse(readFileSync(p, 'utf8'));
const inventory = load(resolve(out, 'CAPABILITY_INVENTORY.json'));
const original = load(resolve(own, 'installed-buyer-runtime-results.json'));
const matrix = readFileSync(resolve(own, 'installed-buyer-lifecycle-matrix.md'), 'utf8');
const inventoryHash = createHash('sha256').update(readFileSync(resolve(out, 'CAPABILITY_INVENTORY.json'))).digest('hex');
const caseShape = load(resolve(root, 'docs/implementation/niche-theme-programme/completion-2026-10-24/CASE_RECORD_TEMPLATE.json'));
const expanded = [];
const lifecycle = ['add', 'apply', 'edit', 'reorder', 'hide', 'show', 'save', 'full-reload', 'private-preview', 'publish', 'public-readback', 'delete', 'save-deletion', 'reload-deletion', 'publish-deletion', 'public-absence', 're-add', 'rebind', 'save-re-add', 'reload-re-add', 'publish-re-add', 'public-re-add-readback', 'undo', 'redo', 'interruption-recovery'];
const fieldOps = ['select-exact-owner', 'edit-valid', 'validate-boundaries', 'clear-if-supported', 'save', 'full-reload', 'private-preview', 'publish', 'public-readback', 'interruption-recovery'];
const applicabilityReviewPath = resolve(root, 'docs/implementation/niche-theme-programme/completion-2026-10-24/PHASE0_INDEPENDENT_REVIEW.json');
const applicabilityReview = load(applicabilityReviewPath);
if (!applicabilityReview.decisions.some(d => d.id === 'APP-SEAM-01')) throw Error('Missing independent frozen-seam applicability decision');
const seamRestrictionOps = ['inventory-dormant-seam', 'verify-no-misleading-activation-control', 'safe-dormant-value-preservation', 'reject-third-party-execution', 'no-public-executable-output', 'full-reload-restriction'];
const seamDecision = { value: 'CONSTITUTIONALLY_EXCLUDED_ACTIVATION_ONLY',
  reason: 'AGENTS NEVER-R3/AGENT-R13; Constitution R-12. Independent APP-SEAM-01 decision excludes third-party activation; safe restriction/preservation tests remain required.',
  reviewer: '01a16ce5-e5ba-7191-ab2c-a1b76947d2b5',
  evidenceSha256: createHash('sha256').update(readFileSync(applicabilityReviewPath)).digest('hex'),
  evidence: '../../../niche-theme-programme/completion-2026-10-24/PHASE0_INDEPENDENT_REVIEW.json#/decisions/0' };
function restrictDormantSeam(row) {
  row.activationApplicability = seamDecision;
  row.applicability = { value: 'APPLICABLE', reason: 'Required dormant-seam restriction and preservation acceptance; activation remains constitutionally excluded.', reviewer: seamDecision.reviewer };
  row.operations = seamRestrictionOps.map(operation => ({ operation, status: 'NOT_RUN', evidence: [], observed: null }));
  row.operation = seamRestrictionOps.join(' -> ');
  row.nextAction = 'Verify safe dormant restriction/no misleading activation/no execution/preserved values under an actual controller grant. Do not activate third-party blocks.';
}
function add(id, requirement, capability, operations, extra = {}) {
  const row = structuredClone(caseShape);
  Object.assign(row, { caseId: id, requirement, theme: 'MadeYours', operation: operations.join(' -> '),
    capability, status: 'NOT_RUN', observed: null, ...extra });
  row.source.head = inventory.source.head;
  row.source.closureManifest = 'CAPABILITY_INVENTORY.json#/source/inputs';
  row.operations = operations.map(operation => ({ operation, status: 'NOT_RUN', evidence: [], observed: null }));
  row.runtime.mode = 'PENDING_CURRENT_ALLOCATION';
  row.nextAction = 'Execute only under current exact allocator/controller grant on an owned synthetic store/draft; capture receipt before advancing.';
  row.review.status = 'PENDING';
  expanded.push(row); return row;
}
for (const t of inventory.templates) {
  add(`MY-C-TEMPLATE-${t.key}`, `Every declared ${t.kind.toLowerCase()} renders in its real resource context with correct header/footer and save/reload/preview/publication identity.`, t.capabilityId,
    ['select-template', 'bind-owned-context', 'save', 'full-reload', 'private-preview', 'publish', 'public-readback', 'empty-missing-context', 'recover'], { template: t.key });
  for (const s of t.sections) {
    add(`MY-C-INSTANCE-${t.key}-${s.id}`, 'Retain exact section identity/settings/order and declared nested blocks through save, reload, preview and publication.', s.capabilityId,
      ['select-exact-section', 'edit', 'save', 'full-reload', 'private-preview', 'publish', 'public-readback'], { template: t.key, sectionType: s.type, sectionId: s.id });
    function instances(blocks) {
      for (const b of blocks) {
        add(`MY-C-BLOCK-INSTANCE-${t.key}-${s.id}-${b.id}`, 'Exact instantiated block selection, identity and persisted/runtime content; inspect nested parent boundaries.', b.capabilityId,
          ['select-exact-block', 'edit', 'save', 'full-reload', 'private-preview', 'publish', 'public-readback'],
          { template: t.key, sectionType: s.type, sectionId: s.id, blockType: b.type, blockId: b.id });
        instances(b.children);
      }
    }
    instances(s.blocks);
  }
}
for (const s of inventory.sections) {
  const ops = s.pinnedGroup
    ? ['verify-pinned-group-constraint', 'edit', 'hide-show-where-exposed', 'save', 'full-reload', 'private-preview', 'publish', 'public-readback', 'undo', 'redo', 'interruption-recovery']
    : lifecycle;
  const row = add(`MY-C-SECTION-${s.type}`, 'Exercise every declared section type in an owned sacrificial draft; all supported operations have durable preview/public output.', s.capabilityId, ops, { sectionType: s.type });
  if (s.pinnedGroup) row.limitations.push('Header/footer are canonical pinned groups. Verify supported controls/blocks and persistence; deletion/re-add is not exposed by the source. Independent applicability review required.');
  if (s.frozenSeam) {
    restrictDormantSeam(row);
  }
  for (const f of s.settings) {
    const row = add(`MY-C-FIELD-${s.type}-${f.id}`, `Declared ${f.label} field connects its real control to persisted and rendered output.`, f.capabilityId, fieldOps,
      { sectionType: s.type, field: f.id, valueCases: f.valueCases, descriptor: f });
    if (s.frozenSeam) {
      restrictDormantSeam(row);
    }
  }
  function blockSchemas(blocks) {
    for (const b of blocks) {
      const row = add(`MY-C-BLOCK-${s.type}-${b.type}`, 'All declared block operations, parent/child identity, limits and persistence work through public output.', b.capabilityId, lifecycle, { sectionType: s.type, blockType: b.type });
      if (b.frozenSeam) {
        restrictDormantSeam(row);
      }
      for (const f of b.settings) add(`MY-C-BLOCK-FIELD-${s.type}-${b.type}-${f.id}`, `Declared ${b.name} / ${f.label} control persists and renders at the correct block.`, f.capabilityId, fieldOps,
        { sectionType: s.type, blockType: b.type, field: f.id, valueCases: f.valueCases, descriptor: f });
      blockSchemas(b.children);
    }
  }
  blockSchemas(s.blocks);
}
for (const g of inventory.themeSettings) for (const f of g.fields) add(`MY-C-THEME-FIELD-${g.group}-${f.id}`, 'Declared global setting saves/reloads and changes its actual style/head/content use sites without changing approved defaults.', f.capabilityId, fieldOps,
  { field: f.id, valueCases: f.valueCases, descriptor: f });
for (const f of inventory.cataloguePersonalization.fields) add(`MY-C-CATALOGUE-${f.path}`, `Canonical product editor ${f.label}; valid/invalid/duplicate/limit/clear behavior, revision changes and no stock refill.`, `catalogue/${f.path}`,
  ['edit', 'validate-valid-and-invalid', 'save-canonical-product', 'full-reload', 'public-product-facts', 'review-context', 'stale-review-refusal', 'immutable-history'], { field: f.path, descriptor: f, priorEvidence: ['../merchant-editor-tests.tap'], overlapsOriginalCases: ['MY-00', 'MY-04', 'MY-18', 'MY-20'] });
for (const a of inventory.cataloguePersonalization.arrays) add(`MY-C-CATALOGUE-ARRAY-${a.path}`, `All supported ${a.path} add/remove/re-add and minimum/maximum/duplicate-ID checks preserve unaffected rows.`, `catalogue/${a.path}`, ['add', 'edit', 'remove', 're-add', 'validate-array-limits', 'save', 'full-reload', 'review-context'], { field: a.path, descriptor: a });
add('MY-C-CATALOGUE-FACTS', 'Whole personalization namespace add/apply/edit/clear/re-add uses canonical product save, revision validation and safe cart/history behavior.', 'catalogue/personalization',
  ['add-facts', 'edit', 'save', 'full-reload', 'review-context', 'clear-facts', 'save-clear', 'reload-clear', 'public-unavailable', 're-add-facts', 'save-re-add', 'reload-re-add', 'review-context-restored', 'immutable-history'],
  { overlapsOriginalCases: ['MY-00', 'MY-18', 'MY-19', 'MY-20'] });
for (const c of inventory.advertisedDesignCapabilities) {
  const row = add(`MY-C-DESIGN-${c.capabilityId.split('/')[1]}`, c.feature, c.capabilityId, ['reconcile-current-source', 'execute-advertised-acceptance', 'independent-review'],
    { designSource: 'CAPABILITY_INVENTORY.json#/advertisedDesignCapabilities', expected: { ui: c.acceptance, http: null, businessEffects: null, providerEffects: null } });
  if (c.class === 'E') { row.applicability = { value: 'REVIEW_REQUIRED', reason: 'Original approved design explicitly excluded uploads/proof/bundles/wallet/new renderer; preserve exclusions, no activation.', reviewer: null }; row.nextAction = 'Independent scope review of original explicit exclusion; no implementation expansion.'; }
}
const common = [
  ['ID01', 'New synthetic LetBuyy buyer signup, configured bot check and separate verification only where the current UI requires/supports it; explicit Continue to intended storefront.', 'identity', ['signup-normal-ui', 'verify-if-required', 'explicit-consent', 'callback', 'store-bound-session', 'full-reload']],
  ['ID02', 'Existing buyer sign-in, different-account action, signout and sign-in preserve owned store context and independent sessions.', 'identity', ['signin', 'continue', 'reload', 'signout', 'signin', 'different-account']],
  ['ID03', 'Store customer login/register entry uses canonical identity and retains safe registered return; no parallel customer password issuer.', 'identity', ['store-login-entry', 'store-register-entry', 'canonical-identity-return', 'full-reload']],
  ['ID04', 'Own profile name/phone edit, read-only email, addresses add/edit/delete/re-add and durable reload.', 'identity', ['profile-edit', 'profile-reload', 'address-add', 'address-edit', 'address-delete', 'address-re-add', 'reload']],
  ['ID05', 'Normal recovery/expired session and interrupted authorization preserve safe input and callback context.', 'identity', ['recover-ui', 'local-email-if-supported', 'expired-session', 'reauthenticate', 'safe-return']],
  ['SEC01', 'Actual wrong-store callback, state/PKCE/code replay and missing/expired session are refused with positive owned controls.', 'security', ['positive-control', 'wrong-store', 'state-pkce', 'code-replay', 'expired-session']],
  ['SEC02', 'Actual buyer B, foreign site and merchant/buyer realm separation; bound existing foreign resources, never unbound arbitrary UUID.', 'security', ['owned-positive', 'other-buyer-denial', 'other-store-denial', 'merchant-not-buyer', 'buyer-not-merchant']],
  ['SEC03', 'Liquid sandbox/SSTI/stored XSS/escaping and public projection/privacy remain correct on current admitted source.', 'security', ['sandbox-suite', 'escaped-text-output', 'public-private-field-denial', 'preview-identifiers-absent-public']],
  ['ED01', 'Shared A/B seven-check cycle, exact section AND block selection and forged/stale preview message denial.', 'editor', ['A-B-seven-check-cycle', 'section-selection', 'block-selection', 'stale-message', 'forged-message']],
  ['ED02', 'Owned draft stale revision, duplicate save/publish, lost acknowledgement, reauthentication and unsaved navigation recover original intent.', 'editor', ['stale-conflict', 'duplicate-save', 'duplicate-publish', 'lost-response', 'reauthentication', 'unsaved-navigation']],
  ['ED03', 'Every declared media/resource binding: own resource selection/upload/library/replacement/clear/deleted/unavailable/foreign; alt/crop only where actually declared.', 'editor', ['select-owned-resource', 'upload', 'library', 'replace', 'clear', 'deleted-resource', 'unavailable', 'foreign-denial']],
  ['DS01', 'Actual home/collection/search methods, prices, categories, sorting, clear-one/all, back, empty, failed and past-end pagination.', 'discovery', ['home', 'collection', 'search', 'facets-compose', 'clear-one', 'clear-all', 'back', 'past-end', 'empty', 'unavailable']],
  ['CO01', 'Normal personalized COD journey includes actual address/shipping/discount/tax quote and canonical server totals; retain original MY-15/MY-16 primary order.', 'checkout', ['address', 'shipping', 'discount', 'tax-quote', 'cod-confirm', 'exact-original-retry', 'business-effect-readback']],
  ['CO02', 'Current checkout recovery correction mounted Worker/owned PostgreSQL 7+15 proposed cases; source units alone cannot pass.', 'checkout', ['fresh-owned-pg-admission', 'seven-reentry-tests', 'fifteen-buyer-tests', 'effects-and-ledger-review', 'owned-cleanup']],
  ['CO03', 'Normal checkout changed price/facts/stock and stale handoff refusal with retained safe draft and supported fresh review.', 'checkout', ['hold-owned-cart', 'normal-catalogue-edit', 'stale-refusal', 'retain-draft', 'fresh-context-review']],
  ['RZ01', 'Shared Razorpay Test Mode readiness: actual authorized account, secure test keys/secret, accepted public HTTPS route and provider mode/account capabilities.', 'provider', ['secure-account-admission', 'test-mode-verified', 'accepted-public-https', 'webhook-secret-binding', 'readiness-receipt']],
  ['RZ02', 'MadeYours actual normal browser Razorpay Test Mode purchase with provider/local order-payment-amount-currency linkage, signature verification and actual webhook.', 'provider', ['normal-store-pdp-cart', 'hosted-online-intent', 'provider-test-checkout', 'server-verification', 'provider-delivered-webhook', 'exact-once-business-readback', 'buyer-view', 'merchant-view']],
  ['RZ03', 'Shared adversarial provider cohort reused only on identical relevant inputs: decline/cancel/retry/signature/order/amount/currency/tenant/expired/wrong intent; webhook duplicate/order/races and unknown commit reconciliation.', 'provider', ['decline', 'dismiss', 'retry', 'invalid-signature', 'wrong-order', 'wrong-amount', 'wrong-currency', 'wrong-tenant', 'expired-intent', 'duplicate-event', 'out-of-order-event', 'verify-webhook-race', 'provider-success-local-failure']],
  ['HIS01', 'COD and Razorpay buyer/merchant history preserve accepted text/facts/options/prices/media after same UUID catalogue edits/archive with no inventory refill.', 'history', ['capture-cod-history', 'capture-razorpay-history', 'normal-catalogue-edit', 'archive-if-required', 'buyer-readback', 'merchant-readback', 'persisted-snapshot-equality']],
  ['HIS02', 'Genuinely supported missing/malformed historical snapshot state has explicit unavailable output and no mutable catalogue substitution.', 'history', ['owned-historical-control-admission', 'missing-history', 'malformed-history', 'no-current-product-fallback']],
  ['PAY01', 'Canonical synthetic/Test Mode cancellation/refund/reversal as supported; exactly-once order/payment/inventory/ledger effects and reconciliation.', 'provider', ['admit-test-record', 'supported-cancellation', 'supported-refund-reversal', 'duplicate-retry', 'ledger-balance', 'provider-local-reconciliation']],
  ['QA01', 'Actual measured content viewport 320/390/768/834/1440, 200% text, long English/Hindi/Tamil names, fonts/images and overflow.', 'quality', ['320', '390', '768', '834', '1440', '200-percent-text', 'Hindi', 'Tamil', 'long-labels', 'fonts-images', 'overflow']],
  ['QA02', 'Keyboard/focus/return, semantic names, validation announcements, reduced motion and declared colour states on composed editor and buyer journeys.', 'quality', ['keyboard', 'focus-order', 'focus-return', 'semantic-names', 'validation-announcement', 'reduced-motion', 'declared-colour-states']],
  ['QA03', 'Representative useful readiness and interaction performance under recorded network/device/data with sample/percentiles/request/byte work and existing budgets.', 'quality', ['record-budget-and-conditions', 'measure-readiness', 'measure-review-cart', 'measure-editor-save-preview', 'record-samples-percentiles-work']],
  ['LIN01', 'Exact source -> package -> installed draft -> release/build -> real API/schema/runtime lineage before every acceptance slice.', 'lineage', ['source-manifest', 'package-digest', 'installed-readback', 'release-snapshot', 'build-runtime-schema', 'scope-expiry']],
  ['PRES01', 'Protected local apps/drafts/sessions/cart/order/inventory and frozen artifacts unchanged except explicitly scoped synthetic effects; owned cleanup receipts.', 'preservation', ['boundary-before', 'declared-effects', 'boundary-after', 'owned-cleanup', 'independent-review']],
];
for (const [id, requirement, domain, operations] of common) add(`MY-C-${id}`, requirement, `common/${id}`, operations, { domain });
const originalRows = original.cases.map(row => {
  const line = matrix.split('\n').find(line => line.startsWith(`| ${row.id} |`));
  const cells = line?.split('|').slice(1,-1).map(v => v.trim());
  return { ...row, action: cells?.[1] || null, originalRequiredResult: cells?.[2] || null,
    executionAmendment: '../installed-buyer-ui-setup.plan.json (revision2 setup/purchase; revision3 later edit overrides old revision1 prose)',
    evidenceLedger: `../installed-buyer-runtime-results.json#/cases/${original.cases.indexOf(row)}`,
    newAcceptanceCredit: false, review: { status: 'PENDING', reviewer: null },
    sourceStatus: 'CURRENT_EXECUTION_ARTIFACT_NOT_ALLOCATED' };
});
const ids = expanded.map(r => r.caseId); if (new Set(ids).size !== ids.length) throw Error('Duplicate additive case IDs');
const sourceFindingsPath = resolve(out, 'SOURCE_RENDER_FINDINGS.json');
const sourceFindings = existsSync(sourceFindingsPath) ? load(sourceFindingsPath) : null;
for (const finding of sourceFindings?.findings || []) {
  const row = expanded.find(r => r.caseId === finding.caseId);
  if (!row) throw Error(`Source finding has no acceptance case: ${finding.caseId}`);
  row.sourceContractFinding = { id: finding.id, status: finding.status, evidence: 'SOURCE_RENDER_FINDINGS.json', sourceCase: finding.sourceCase,
    browserOrInstalledExecuted: false };
  row.nextAction = finding.nextAction;
}
const countStatus = rows => rows.reduce((v,r) => ({ ...v, [r.status]: (v[r.status] || 0) + 1 }), {});
const coverage = {
  schemaVersion: 1, classification: 'PREPARED_REQUIRED_COVERAGE_NOT_EXECUTION_EVIDENCE', theme: 'MadeYours',
  generatedAt: new Date().toISOString(), inventory: { path: 'CAPABILITY_INVENTORY.json', sha256: inventoryHash },
  acceptancePolicy: 'Original23 retained exactly. Additive groups and their operations are obligations, never extra passes. No model/static/backend proof becomes browser/provider credit. N/A requires independent source-backed applicability approval.',
  original: { caseCount: originalRows.length, summary: original.summary, executionOrder: original.executionOrder, cases: originalRows },
  additive: { caseGroups: expanded.length, operationObligations: expanded.reduce((n,r) => n+r.operations.length,0), statuses: countStatus(expanded), cases: expanded },
  overlapPolicy: 'A single observed operation may explicitly satisfy several requirements; retain shared evidence links and do not sum overlapping tests as unique journeys.',
  buyerControlMapping: inventory.buyerPersonalization.controls.map(control => ({ control,
    originalCases: control === 'personalization_text' ? ['MY-06','MY-07','MY-08','MY-09'] : ['MY-01','MY-04','MY-05','MY-18'],
    additiveCases: ['MY-C-DESIGN-4','MY-C-DESIGN-5','MY-C-CO03','MY-C-QA02'], status: 'NOT_RUN' })),
  buyerStateMapping: inventory.buyerPersonalization.states.map(state => ({ state,
    requiredCases: ['MY-01','MY-04','MY-05','MY-07','MY-08','MY-18','MY-20','MY-21'], status: 'NOT_RUN' })),
  artifactAdmission: null, browserLease: null, providerReadiness: 'UNVERIFIED_NO_CREDENTIAL_FILES_READ',
  sourceContractFindings: sourceFindings ? { path: 'SOURCE_RENDER_FINDINGS.json', open: sourceFindings.findings.filter(f => f.status === 'OPEN').length,
    classification: sourceFindings.classification, installedResultsUnchanged: true } : null,
  gates: Object.fromEntries(['CAPABILITY_COMPLETENESS','EDITOR','IDENTITY_CUSTOMER','DISCOVERY','CART_COD','RAZORPAY_TEST','IMMUTABLE_HISTORY','NEGATIVE_SECURITY_RECOVERY','RESPONSIVE_ACCESSIBILITY_PERFORMANCE','ARTIFACT_LINEAGE','PRESERVATION_CLEANUP','INDEPENDENT_REVIEW'].map(g => [g, { status: 'NOT_RUN', review: 'PENDING' }])),
  certification: { LOCAL_E2E_VERIFIED: false, RAZORPAY_TEST_VERIFIED: false, REVIEW_ACCEPTED: false, FULL_THEME_CERTIFIED: false, PRODUCTION_DEPLOYED: 'NOT_REQUESTED' },
};
writeFileSync(resolve(out, 'COVERAGE.json'), JSON.stringify(coverage, null, 2) + '\n');
console.log(JSON.stringify({ original23: original.summary, additiveGroups: expanded.length, operationObligations: coverage.additive.operationObligations, additiveStatuses: coverage.additive.statuses, duplicateIDs: false, executed: 0 }));
