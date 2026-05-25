import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Immutable evidence validator",
  category: "immutable-evidence",
  validator: "immutable-evidence-validator",
  requiredEvidence: ["sha256-artifact-hash", "immutable-snapshot", "provenance-lineage", "signature-required-before-live-certified"],
  requiredProviderFields: ["artifact_hash", "trace_id"],
  summary: "immutable provider evidence gates checked",
});
