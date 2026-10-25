"""Source/evidence mapping only; this does not execute acceptance cases."""
import hashlib
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[4]

def load(path):
    return json.loads((ROOT / path).read_text())

def pin(path):
    return {"path": path, "sha256": hashlib.sha256((ROOT / path).read_bytes()).hexdigest()}

def emit(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

inventory = json.loads((OUT / "CAPABILITY_INVENTORY.json").read_text())
matrix_path = "docs/implementation/niche-themes-2026-10-23/circuit/installed-lifecycle/installed-lifecycle-matrix.json"
audit_path = "docs/implementation/niche-themes-2026-10-23/habitat/circuit-run936-independent-audit.json"
classification_path = "docs/implementation/theme-editor-2026-10-23/evidence/stable936-circuit-finite-nonorder-classification-addendum.json"
matrix, audit, classification = (load(p) for p in (matrix_path, audit_path, classification_path))
prior_rows = {row["id"]: row for row in classification["rows"]}
base = "docs/implementation/niche-themes-2026-10-23/circuit/completion-2026-10-24/"
source = {"head": inventory["source"]["head"], "closureManifest": base + "SOURCE_MANIFEST.json", "artifactHash": inventory["source"]["bundleJsonSha256"], "buildId": None, "schemaVersion": "2026-05-json-contract; actual matching snapshot retained"}

original = []
for case in matrix["cases"]:
    prior = prior_rows[case["id"]]
    original.append({
        "caseId": case["id"], "requirement": case["title"],
        "status": prior["status"], "statusScope": "LATEST_REVIEWED_HISTORICAL_RUN_936_ONLY",
        "candidateStatus": "NOT_RUN", "required": True,
        "expected": case["expected"], "steps": case["steps"],
        "priorEvidence": [pin(audit_path), pin(classification_path)],
        "historicalRunId": "936e5f577646", "historicalReason": prior["reason"],
        "review": {"status": "PENDING", "scope": "New coherent candidate needs lineage admission and affected retests; prior reviewed observations remain historical."},
        "nextAction": "Retain applicable exact-input evidence after candidate admission; execute missing branches with actual allocated bindings. Do not repeat old setup or refill stock.",
    })

rows = []
def add(case_id, requirement, operations, expected, **scope):
    row = {
        "caseId": case_id, "requirement": requirement, "theme": "Circuit",
        "template": None, "sectionType": None, "sectionId": None,
        "blockType": None, "blockId": None, "field": None,
        "required": True, "applicability": {"value": "APPLICABLE", "reason": "Declared source or direct completion requirement; protected operations use refusal checks, never boundary relaxation.", "reviewer": None},
        "status": "NOT_RUN", "operations": [{"operation": op, "status": "NOT_RUN"} for op in operations],
        "source": source,
        "runtime": {"runId": None, "mode": None, "siteId": None, "actorRealm": None, "scopeReference": None},
        "expected": expected, "observed": None, "evidence": [], "commands": [], "priorEvidence": [],
        "review": {"status": "PENDING", "reviewer": None, "evidence": []},
        "limitations": ["Unexecuted planning row; source enumeration is not connected-control or runtime proof."],
        "nextAction": "Admit exact candidate/owned sacrificial scope and obtain the sole controller's finite allocation before execution.",
    }
    row.update(scope)
    rows.append(row)

lifecycle = ["add", "apply", "edit", "reorder", "hide", "show", "save", "full_reload", "private_preview", "publish", "public_readback", "delete", "reload_absence", "re_add", "rebind", "undo", "redo", "recover"]
field_ops = ["valid_edit", "clear_or_optional_absence", "invalid_or_limit_rejection", "save", "full_reload", "private_preview", "publish", "public_readback"]
for template in inventory["templates"]:
    add("CE-T-" + template["key"], "Actual template/group route, section identities and appropriate data context", ["select", "load_correct_context", "edit", "save", "full_reload", "private_preview", "publish", "public_readback", "cross_template_preservation"],
        {"ui": "Correct template and resource context; existing typography and intended header/footer behavior retained.", "http": "Normal acknowledged revisions and exact template key; no private inspector metadata publicly.", "businessEffects": "Only allocated sacrificial draft/release changes; stable identities and all untouched templates preserved."},
        template=template["key"], inventoryRef="templates/" + template["key"],
        instances=[{"sectionId": s["id"], "sectionType": s["type"]} for s in template["sections"]])

for section in inventory["sectionTypes"]:
    protected = section["type"] in ("header", "footer")
    seam = section["type"] == "app-block-slot"
    ops = (["inspect_frozen_seam", "reject_unapproved_extension_execution", "preserve_saved_data"] if seam else
           ["edit", "hide", "show", "save", "full_reload", "private_preview", "publish", "public_readback", "reject_pinned_delete_or_reorder", "undo", "redo", "recover"] if protected else lifecycle)
    add("CE-S-" + section["type"], "Complete actual section lifecycle within supported template and permission constraints", ops,
        {"ui": "Every supported action is reachable and changes intended content; unsupported protected operations remain constrained.", "http": "Canonical schema validation and revision acknowledgment; no fake local success.", "businessEffects": "No other template/draft/product/stock/order changes; deletion/re-add preserves valid bindings and fresh identity where required."},
        sectionType=section["type"], inventoryRef="sectionTypes/" + section["type"], defaultContexts=section["defaultInstances"],
        applicability={"value": "PROTECTED_NEGATIVE_CONTROL" if seam else "APPLICABLE_WITH_PINNED_GROUP_CONSTRAINTS" if protected else "DECLARED_REQUIRES_RUNTIME_AVAILABILITY_CHECK", "reason": section["ownership"], "reviewer": None})
    for block in section["nestedBlockDeclarations"]:
        add("CE-B-" + section["type"] + "/" + block["type"], "Declared nested/reusable block lifecycle, selection and limits", ["inspect_frozen_seam", "reject_unapproved_extension_execution"] if block["extensionSeam"] else lifecycle + ["section_and_block_selection", "nesting_depth_guard", "unknown_child_preservation"],
            {"ui": "Exact selected block instance; real fields and nesting constraints; preview identity maps to the correct block.", "businessEffects": "No schema/definition mutation or cross-section identity collision; no third-party execution."},
            sectionType=section["type"], blockType=block["type"], inventoryRef="sectionTypes/" + section["type"] + "/blocks/" + block["type"],
            applicability={"value": "PROTECTED_NEGATIVE_CONTROL" if block["extensionSeam"] else "DECLARED_REQUIRES_RUNTIME_AVAILABILITY_CHECK", "reason": "@app is an empty constitutional seam." if block["extensionSeam"] else "Effective inline/reusable fields are enumerated; no default block instances are supplied.", "reviewer": None})

for f in inventory["themeSettings"]["fields"]:
    add("CE-F-theme/" + f["id"], "Theme setting persists and affects the intended output", field_ops,
        {"ui": "Actual schema control, valid typed values/clear/limits; both heading/body typography and permitted token output remain truthful.", "businessEffects": "Only the intended setting changes, including false/zero/empty where valid; no schema mutation."},
        field=f["id"], inventoryRef="themeSettings/" + f["group"] + "/" + f["id"], descriptor=f["descriptor"])
for f in inventory["fieldIndex"]:
    add("CE-F-" + f["location"], "Every declared field connects control to persistence and runtime consumption", field_ops + (["select_owned_resource", "replace", "remove", "unavailable_resource_recovery", "foreign_resource_denial"] if f["resourceOrMedia"] else []),
        {"ui": "Control values and actual rendered output agree; limits and unknown/empty/false/zero states preserve type and actionable feedback.", "http": "Normal schema-validated save/reload; real resource ownership and media readiness when relevant.", "businessEffects": "Correct resource UUID and parent/template survive; no current catalogue facts are copied into settings."},
        sectionType=f["sectionType"], blockType=f["blockType"], field=f["field"],
        inventoryRef="fieldIndex/" + f["location"], descriptor=f["descriptor"], defaultContexts=f["instances"])

for f in inventory["catalogueFacts"]["leafFields"]:
    protected = f["path"] == "version"
    add("CE-CF-" + f["path"], "Canonical electronics fact leaf and parent save journey", ["schema_version_guard"] if protected else ["valid_edit", "clear_or_unknown", "invalid_or_limit_rejection", "parent_save", "full_reload", "public_PDP", "discovery_if_supported", "immutable_order_snapshot"],
        {"acceptance": "Follow the actual strict fact schema and custom refinements; no guessed values, invalid sources, private namespace leakage or variant electronics override. Save/conflict/stock authority stays in the canonical product parent."},
        field="metadata.electronics." + f["path"], inventoryRef="catalogueFacts/leafFields/" + f["path"], descriptor=f["descriptor"],
        applicability={"value": "PROTECTED_NEGATIVE_CONTROL" if protected else "APPLICABLE", "reason": f["authority"], "reviewer": None})

requirements = [
 ("CC-01", "Corrected-runtime merchant collection counts", ["own_positive", "empty_zero", "saved_membership_count", "pagination", "foreign_denial", "unavailable_is_not_zero"], "Actual merchant UI agrees with native-qualified exact membership count and required numeric SDK contract; count503 is actionable, no zero/fallback."),
 ("CC-02", "Product facts normal merchant save/reload/validation/conflict", ["create", "edit_every_fact_field", "invalid_date_units_duplicates", "clear_namespace", "save", "reload", "stale_version_conflict", "omit_untouched_stock"], "Strict electronics schema, canonical units, all nested references/arrays and unrelated namespaces survive; original UUIDs and consumed stock remain."),
 ("CC-03", "Private-preview origin, inspector and context", ["exact_section_selection", "exact_block_selection", "desktop", "tablet", "mobile", "forged_message", "stale_message", "wrong_origin", "private_public_isolation"], "Actual candidate frames render with correct resource/template/origin; no private data or inspector attributes escape publicly."),
 ("CC-04", "Draft save/recovery and published A/B seven-check cycle", ["A_save_reload", "B_save_reload", "B_private_A_public", "B_publish", "A_restore", "B_retain", "B_reapply", "double_save", "lost_ack", "reauth", "conflict", "unsaved_navigation"], "Actual acknowledged revisions and immutable snapshot hashes; uncertain commit reconciled using original intent, user drafts untouched."),
 ("CC-05", "Normal buyer registration and explicit continuation", ["normal_register", "configured_bot_verification", "verification_if_supported", "normal_signin", "consent_if_required", "explicit_continue", "callback"], "Canonical identity-issued buyer session and correct destination. Follow the actual supported BuyerAuthorize contract; do not invent mandatory verification/consent controls."),
 ("CC-06", "Storefront customer entry and persistent account", ["storefront_entry", "reload", "profile_edit", "address_create", "invalid_PIN", "address_edit", "default_if_supported", "signout", "signin_recovery"], "One canonical buyer principal, store-bound customer relationship and actual persistent profile/addresses; no app-local issuer."),
 ("CC-07", "Identity/realm/callback adversarial boundaries", ["buyerB_positive", "cross_buyer_order_denial", "cross_store_order_denial", "wrong_callback_state", "PKCE_or_code_replay", "expired_session", "buyer_not_merchant", "merchant_not_buyer"], "Positive controls precede denial; no token/cookie/PII exposure; independent existing user sessions preserved."),
 ("CC-08", "Complete cart edit/remove/re-add beyond retained CL14-23", ["variant_add", "quantity_edit", "remove", "re_add", "full_reload", "cross_site", "wrong_variant", "foreign_product"], "Canonical receipt authority and exact variant UUID, price/facts/stock; cart bearer recovery is not misclassified as identity denial."),
 ("CC-09", "Current quote, address, shipping, tax and discount", ["contact", "address", "eligible_rate", "invalid_address", "discount_valid_invalid", "tax", "quote_expiry", "requote"], "Actual authoritative eligibility and item/shipping/tax/grand totals; no invented delivery amount or provider name."),
 ("CC-10", "Actual Circuit Razorpay Test Mode purchase", ["normal_browser_test_checkout", "provider_order", "test_payment", "server_verify", "real_provider_webhook", "local_payment_order_ledger", "buyer_view", "merchant_view", "reconcile"], "Redacted exact provider/local order/payment/event linkage, verified test mode, amount/currency and actual authorized/captured status; one canonical effect. Mock/COD/another theme cannot satisfy."),
 ("CC-11", "Shared Razorpay adversarial cohort exact-input reuse", ["decline", "dismiss_cancel", "safe_retry", "duplicate_out_of_order_webhook", "verify_webhook_race", "invalid_signature", "wrong_amount_currency_order_tenant", "expired_intent", "provider_success_local_failure"], "Reuse admitted shared proof only with matching relevant source/provider inputs; raw-body signature and durable idempotency; zero break or explained suspense."),
 ("CC-12", "Cancellation/refund/reversal through canonical authority", ["cancel_if_supported", "test_refund", "payment_reversal", "exactly_once", "balanced_ledger", "reconcile"], "Only synthetic/test-mode money, append-only reversals and canonical ledger authority; no custody or actual fulfillment."),
 ("CC-13", "Immutable COD and Razorpay history after same-UUID edits", ["before_snapshot", "same_UUID_catalogue_edit", "omit_stock", "current_PDP", "buyer_history", "merchant_history", "stored_line_fingerprint", "archive", "missing_malformed_history"], "Both actual purchases retain committed facts/options/prices; no current-product fallback or inventory replenishment."),
 ("CC-14", "Responsive/long/localised content and type scaling", ["320", "390", "768", "834", "1440", "measured_content_viewport", "200_percent", "long_English", "Hindi", "Tamil", "font_image_ready"], "Approved Circuit identity and complete tasks remain usable; measure actual content dimensions, overflow and loaded assets."),
 ("CC-15", "Keyboard/semantics/focus and supported states", ["keyboard_task", "focus_return", "names_legends", "error_announcement", "reduced_motion", "loading", "empty", "error_retry", "disabled", "supported_light_dark"], "Real composed controls and native tasks pass relevant WCAG project target; no blanket certification from static scans."),
 ("CC-16", "Liquid sandbox, escaping, resource and privacy gates", ["SSTI_escape", "stored_XSS", "own_properties", "drop_scrub", "parse_render_memory_limits", "upload_render_forbidden", "private_metadata", "tenant_positive_first"], "Reuse exact applicable admitted shared security proof and execute Circuit-specific merchant content/field/resource negatives; preserve hard gates."),
 ("CC-17", "Meaningful performance and failure recovery", ["budget_admission", "device_network_data_scope", "sample_count_percentiles", "useful_ready", "interaction_latency", "request_bytes", "network_loss_recovery"], "Use existing budgets, explicit conditions and representative measurements; source/static speed is not runtime performance acceptance."),
 ("CC-18", "Artifact lineage, preservation, cleanup and independent acceptance", ["source_build_schema_lineage", "protected_before_after", "owned_cleanup", "independent_review"], "No missing required row; all evidence links/hash/expected effects valid; production remains NOT_REQUESTED."),
]
for ident, title, ops, expected in requirements:
    add(ident, title, ops, {"acceptance": expected})

for capability in inventory["advertisedCapabilities"]:
    if capability["class"].startswith("E"):
        # Preserve exclusions as assertions, never implement deferred features.
        add("CD-" + capability["id"], capability["feature"], ["verify_no_unsupported_controls_or_promises"], {"acceptance": capability["acceptance"]},
            applicability={"value": "PROTECTED_EXCLUSION_CHECK", "reason": capability["class"], "reviewer": None})
    else:
        add("CD-" + capability["id"], capability["feature"], ["design_to_actual_contract_review", "runtime_acceptance"], {"acceptance": capability["acceptance"]}, advertisedCapability=capability)

result = {
    "schemaVersion": 1, "classification": "MAPPED_REQUIREMENTS_NOT_NEW_EXECUTION_OR_CERTIFICATION",
    "theme": "Circuit", "preset": "forge", "recordedAt": inventory["recordedAt"],
    "originalMatrix": pin(matrix_path), "latestIndependentAudit": pin(audit_path),
    "historicalCounts": dict(Counter(row["status"] for row in original)),
    "originalCases": original,
    "additiveRequirementRows": rows,
    "additiveCounts": {"NOT_RUN": len(rows)},
    "countingRule": "Rows are requirement mappings with multiple suboperations, not executed tests or distinct assertions. Do not sum native/source/browser observations or overlapping rows into coverage credit.",
    "candidate": {"status": "NOT_ADMITTED", "runtime": None, "browserLease": None, "sharedWriter": None, "currentCandidatePasses": 0},
    "sourceManifest": pin(base + "SOURCE_MANIFEST.json"),
    "evidenceReuse": [
        {**pin("docs/implementation/niche-themes-2026-10-23/circuit/discovery/qualification.json"), "scope": "Historical migration386 owned PostgreSQL qualification; no unchanged rerun.", "candidateApplicability": "Allocator must validate relevant exact migration/source lineage."},
        {**pin("docs/implementation/niche-theme-programme/collection-count-native/native-runs/02/root-qualification.json"), "scope": "Count02 one TAP parent/all eight stages; backend only, M05 browser pending.", "candidateApplicability": "Use qualified count source and exact contract; no repeated unchanged native run."},
        {**pin("docs/implementation/niche-theme-programme/circuit-search392-native-admission.json"), "scope": "Historical native model search qualification; installed CL25 actual run936 is separately retained.", "candidateApplicability": "Affected corrected-runtime smoke only after source/build/schema admission."},
    ],
    "certification": {"LOCAL_E2E_VERIFIED": False, "RAZORPAY_TEST_VERIFIED": False, "REVIEW_ACCEPTED": False, "FULL_THEME_CERTIFIED": False, "PRODUCTION_DEPLOYED": "NOT_REQUESTED"},
}
assert len(original) == 25 and result["historicalCounts"] == {"PASS": 10, "PARTIAL": 5, "NOT_RUN": 10}
assert len({row["caseId"] for row in rows + original}) == len(rows) + len(original)
emit("COVERAGE.json", result)
print(json.dumps({"historicalCounts": result["historicalCounts"], "additiveRequirementRows": len(rows), "additiveStatuses": dict(Counter(row["status"] for row in rows)), "certified": False}))
