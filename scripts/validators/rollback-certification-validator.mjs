import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Rollback certification validator",
  category: "rollback",
  validator: "rollback-certification-validator",
  requiredEvidence: ["rollback-dag-checksum", "compensation-checksum", "causality-checksum", "timing-observed"],
  summary: "rollback execution certification harness and evidence contract checked",
});
