import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Partition recovery validator",
  category: "partition-recovery",
  validator: "partition-recovery-validator",
  requiredEvidence: ["partition-isolation", "partition-reconciliation", "split-brain-rejection", "replay-safe-recovery"],
  requiredProviderFields: ["artifact_hash", "trace_id"],
  summary: "provider partition recovery gates checked",
});
