import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Operational evidence lineage validator",
  finalValidator: "operational-evidence-lineage-validator",
  harnessFragments: ["evidence_hash", "contract_checksum", "slo_checksum", "restart_restoration_hash"],
  contractFields: ["artifactPolicy"],
  summary: "immutable operational evidence hashing and provenance checked",
});
