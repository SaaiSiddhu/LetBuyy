import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Operational evidence validator",
  category: "orchestration",
  validator: "operational-evidence-validator",
  requiredEvidence: ["resumable-cursor", "recovery-checksum", "bounded-convergence", "telemetry-lineage"],
  summary: "operational evidence harness, ignored artifacts, and lineage contract checked",
});
