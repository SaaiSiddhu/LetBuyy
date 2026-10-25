"""Bounded evidence consistency check. Does not start or test any application."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys

BASE = Path(__file__).resolve().parent
REPORT_NAME = sys.argv[1] if len(sys.argv) > 1 else "PHASE0_VALIDATION.json"
if Path(REPORT_NAME).name != REPORT_NAME or not REPORT_NAME.endswith(".json"):
    raise ValueError("The validation output must be an owned JSON filename")
ROOT = next(p for p in BASE.parents if (p / "LETBUYY_CANONICAL_SYSTEMS.md").exists() or (p / "GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md").exists())
checks = []


def record(name, condition, detail=None):
    checks.append({"name": name, "result": "PASS" if condition else "FAIL", "detail": detail})


def read(name):
    return json.loads((BASE / name).read_text())


def resolve_ref(ref):
    name, _, pointer = ref.partition("#")
    path = (BASE / name).resolve()
    if not path.is_file():
        path = (ROOT / name).resolve()
    if not path.is_file():
        return False
    if pointer:
        node = json.loads(path.read_text())
        for part in pointer.lstrip("/").split("/"):
            part = part.replace("~1", "/").replace("~0", "~")
            node = node[int(part)] if isinstance(node, list) else node[part]
    return True


inventory = read("CAPABILITY_INVENTORY.json")
coverage = read("COVERAGE.json")
slice_ = read("NEXT_EXECUTABLE_SLICE.json")
cert = read("CERTIFICATION.json")
inputs = read("SOURCE_AND_EVIDENCE_INPUTS.json")
tracking = json.loads((BASE.parent / "installed-nonorder-run936-tracking.json").read_text())
original = coverage["retainedOriginalCases"]
added = coverage["addedCases"]
groups = {g: [r for r in added if r["group"] == g] for g in {r["group"] for r in added}}

parsed_files = []
parse_errors = []
for p in BASE.glob("*.json"):
    if p.name == REPORT_NAME:
        continue
    try:
        json.loads(p.read_text())
        parsed_files.append(p.name)
    except (ValueError, OSError) as exc:
        parse_errors.append({"file": p.name, "error": str(exc)})
record("packet_json_parses", not parse_errors, {"files": parsed_files, "errors": parse_errors})
record("original_26_ids_and_statuses_preserved", len(original) == 26 and {r["id"]: r["status"] for r in original} == {r["id"]: r["status"] for r in tracking["cases"]})
record("original_17_lifecycle_and_9_query_cases", sum(r["id"].startswith("HI-") for r in original) == 17 and sum(r["id"].startswith("HQ-") for r in original) == 9)
original_counts = Counter(r["status"] for r in original)
record("original_counts_21_pass_1_partial_4_not_run", original_counts == {"PASS": 21, "PARTIAL": 1, "NOT_RUN": 4}, dict(original_counts))
record("retained_proof_not_promoted", all(r["completionCandidateStatus"] == "NOT_RUN" and r["completionCandidate"] is None for r in original))
record("337_unique_added_requirements", len(added) == len({r["id"] for r in added}) == 337)
record("new_requirements_have_no_fabricated_execution", all(r["status"] == "NOT_RUN" and r["candidate"] is None and r["runtime"] is None and r["evidence"] == [] and all(op["status"] == "NOT_RUN" and op["evidence"] == [] for op in r["operations"].values()) for r in added))
record("all_23_templates_mapped", {r["template"] for r in groups["editor-template"]} == {r["key"] for r in inventory["templates"]} and len(groups["editor-template"]) == 23)
record("all_46_sections_mapped", {r["sectionType"] for r in groups["editor-section"]} == {r["type"] for r in inventory["sectionTypes"]} and len(groups["editor-section"]) == 46)
inline = {(s["type"], b["type"]) for s in inventory["sectionTypes"] for b in s["schema"].get("blocks", [])}
block_rows = [r for r in groups["editor-block"] if "parent" in r]
record("all_13_inline_blocks_mapped", len(inline) == len(block_rows) == 13 and inline == {(r["parent"], r["blockType"]) for r in block_rows})
record("reusable_badge_mapped", {r["blockType"] for r in groups["editor-block"] if "parent" not in r} == {r["type"] for r in inventory["reusableBlockTypes"]} == {"badge"})
record("all_157_field_descriptors_mapped", {r["descriptorKey"] for r in groups["editor-field"]} == {r["key"] for r in inventory["settingDescriptors"]} and len(groups["editor-field"]) == 157)
record("all_10_presets_mapped", {r["preset"] for r in groups["editor-preset"]} == set(inventory["globalPresets"]) and len(groups["editor-preset"]) == 10)
record("locale_leaf_paths_mapped", sorted(p for r in groups["editor-localization"] for p in r["leafPaths"]) == sorted(p for loc in inventory["locales"].values() for p in loc["leafPaths"]))
fact_paths = {r["path"] for r in inventory["catalogueFacts"]["leafControls"]}
record("all_40_common_variant_facts_mapped", len(groups["catalogue-fact"]) == 40 and all({r["fact"]["path"] for r in groups["catalogue-fact"] if r["factScope"] == scope} == fact_paths for scope in ("common", "variant")))
ref_errors = []
for ref in sorted({ref for r in added for ref in r["sourceRefs"]}):
    try:
        if not resolve_ref(ref):
            ref_errors.append(ref)
    except (KeyError, IndexError, ValueError, OSError) as exc:
        ref_errors.append({"ref": ref, "error": str(exc)})
record("source_files_and_json_pointers_resolve", not ref_errors, ref_errors)
record("virtual_bundle_paths_labelled", all(not any(ref.startswith(("sections/", "blocks/")) for ref in r["sourceRefs"]) for r in added))
protected = [r for r in added if r.get("protectedSeam")]
record("app_activation_excluded_safety_unexecuted", len(protected) == 2 and all(r["activationScope"]["activation"] == "CONSTITUTIONALLY_EXCLUDED" and r["activationScope"]["runtimeSafetyProof"] == "NOT_RUN" and not any("add" in op or "activate" in op for op in r["operations"]) for r in protected))
record("pinned_chrome_remains_open", all(next(r for r in groups["editor-section"] if r["sectionType"] == s)["status"] == "NOT_RUN" for s in ("header", "footer")) and inventory["editorConstraints"]["pinnedSectionTypes"] == ["header", "footer"])
permissions = inventory["editorConstraints"]["effectiveChildPermissions"]
record("canonical_reusable_child_eligibility_not_generalized_to_inline_parents", inventory["editorConstraints"]["declaredChildRelationships"] == [] and len(permissions) == 11 and [(p["sectionType"], p["parentType"]) for p in permissions if p["eligibleKnownReusableChildren"]] == [("spotlight", "badge")] and all(p["eligibleKnownReusableChildren"] == (["badge"] if p["parentType"] == "badge" else []) for p in permissions) and inventory["editorConstraints"]["reusableChildChain"]["maxDepth"] == 3)
ids = {r["id"] for r in added}
field_slice = {r["id"] for r in groups["editor-field"] if r["descriptorKey"].startswith(("section:habitat-measurement-guide/", "section:faq-accordion/", "block:badge/"))}
record("next_slice_resolves_all_14_fields_and_22_cases", set(slice_["sourceCases"]) <= ids and field_slice <= set(slice_["sourceCases"]) and len(field_slice) == 14 and len(slice_["sourceCases"]) == 22 and "HAB-C-BLOCK-spotlight--badge" in slice_["sourceCases"])
effects = read("SCHEMA_FIELD_EFFECTS.json")
record("exact_157_field_effect_requirements_no_execution_claim", len(effects["fields"]) == 157 and {r["descriptorKey"] for r in effects["fields"]} == {r["key"] for r in inventory["settingDescriptors"]} and all(r["observedEffect"] == "NOT_RUN" and not r["evidence"] for r in effects["fields"]))
buyer_handoff = read("NEXT_UI_ACCEPTANCE_HANDOFF.json")
record("HI14_17_handoff_preserves_case_ids_unbound_and_unexecuted", [r["id"] for r in buyer_handoff["caseRequirements"]] == ["HI-14", "HI-15", "HI-16", "HI-17"] and all(r["status"] == "NOT_RUN" for r in buyer_handoff["caseRequirements"]) and all(v is None for k, v in buyer_handoff["bindings"].items() if k not in ("variantIds", "bindingRule")) and all(v is None for v in buyer_handoff["bindings"]["variantIds"].values()) and buyer_handoff["normalUiCasesExecuted"] == 0)
def contains_stock(value):
    if isinstance(value, dict):
        return "stock" in value or any(contains_stock(v) for v in value.values())
    return isinstance(value, list) and any(contains_stock(v) for v in value)
record("later_metadata_update_omits_all_stock_fields", not contains_stock(buyer_handoff["caseRequirements"][2]["laterEdit"]["updateFields"]))
private_qualification = read("private-order-heading-v201/QUALIFICATION.json")
private_hash_errors = [name for name, digest in private_qualification["artifactHashes"].items() if hashlib.sha256((BASE / "private-order-heading-v201" / name).read_bytes()).hexdigest() != digest]
record("private_source_tests_and_failed_startups_preserved_exact", not private_hash_errors and [r["exitCode"] for r in private_qualification["actualCommands"]] == [1, 1, 0] and private_qualification["actualCommands"][-1]["sourceTests"] == {"PASS": 5, "FAIL": 0, "skipped": 0}, private_hash_errors)
revision02 = read("private-habitat-v201-02/QUALIFICATION.json")
revision02_errors = [name for name, digest in revision02["artifactHashes"].items() if hashlib.sha256((BASE / "private-habitat-v201-02" / name).read_bytes()).hexdigest() != digest]
record("revision02_eight_source_tests_preserve_failed_positive_control_baseline", not revision02_errors and revision02["exitCode"] == 0 and revision02["tests"] == {"PASS": 8, "FAIL": 0, "skipped": 0} and revision02["retainedFailedBaseline"]["tests"] == {"PASS": 0, "FAIL": 1} and revision02["retainedFailedBaseline"]["rootBadgePositive"] is True and revision02["installedCasePassesAdded"] == 0, revision02_errors)
record("slice_is_request_not_lease", all(slice_[k] is None for k in ("candidate", "controller", "syntheticStore", "sacrificialDraft")))
record("certification_not_issued", cert["FULL_THEME_CERTIFIED"] is False and all(cert[k]["value"] is False for k in ("LOCAL_E2E_VERIFIED", "RAZORPAY_TEST_VERIFIED", "REVIEW_ACCEPTED")) and all(g["status"] == "NOT_RUN" for g in cert["requiredGates"].values()))
frozen = [{"path": r["path"], "matches": hashlib.sha256((ROOT / r["path"]).read_bytes()).hexdigest() == r["recordedSha256"]} for r in inputs["oldOwnedSourceComparison"]]
record("all_11_frozen_habitat_source_hashes_match", len(frozen) == 11 and all(r["matches"] for r in frozen), frozen)
link_errors = []
for p in BASE.glob("*.md"):
    for target in re.findall(r"(?<!!)\[[^\]]+\]\(([^)]+)\)", p.read_text()):
        if target.startswith(("http:", "https:", "mailto:", "#")):
            continue
        if not (p.parent / target.split("#", 1)[0]).resolve().exists():
            link_errors.append({"file": p.name, "target": target})
record("local_markdown_links_resolve", not link_errors, link_errors)

state_path = ROOT / "docs/implementation/niche-theme-programme/completion-2026-10-24/EXECUTION_STATE.json"
state_bytes = state_path.read_bytes()
state = json.loads(state_bytes)
state_observation = {"path": str(state_path.relative_to(ROOT)), "sha256": hashlib.sha256(state_bytes).hexdigest(), "programmePhase": state["programmePhase"], "helperActivation": state["helperActivation"], "activeBrowserLease": state["activeBrowserLease"], "activeSharedWriter": state["activeSharedWriter"]}
failures = [c for c in checks if c["result"] == "FAIL"]
report = {"schemaVersion": 1, "recordedAt": datetime.now(timezone.utc).isoformat(), "classification": "EVIDENCE_CONSISTENCY_ONLY_NOT_PRODUCT_TESTS_OR_ACCEPTANCE", "command": "python3 " + str(Path(__file__).resolve()) + " " + REPORT_NAME, "exitCode": 1 if failures else 0, "checkCounts": dict(Counter(c["result"] for c in checks)), "checks": checks, "retainedOriginalResults": dict(original_counts), "newRequirementStatusCounts": dict(Counter(r["status"] for r in added)), "operationCellsNotUniqueJourneys": sum(len(r["operations"]) for r in added), "programmeStateAtHandoff": state_observation, "packetHashes": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(BASE.iterdir()) if p.is_file() and p.name != REPORT_NAME}, "behavioralTestsRunByThisValidator": 0, "runtimeActions": 0, "databaseActions": 0, "providerCalls": 0, "crossChatMessagesSent": 0, "fullCertificationClaimed": False}
(BASE / REPORT_NAME).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"exitCode": report["exitCode"], "checks": report["checkCounts"], "failures": failures, "original": report["retainedOriginalResults"], "new": report["newRequirementStatusCounts"], "helperActivation": state["helperActivation"], "activeBrowserLease": state["activeBrowserLease"], "activeSharedWriter": state["activeSharedWriter"]}))
sys.exit(report["exitCode"])
