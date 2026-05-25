import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "WAL certification validator",
  category: "wal",
  validator: "wal-certification-validator",
  requiredEvidence: ["append-only-lineage", "corruption-detected", "cursor-restored", "snapshot-restored"],
  summary: "WAL recovery certification harness and evidence contract checked",
});
