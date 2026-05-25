import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Crash recovery validator",
  category: "crash-recovery",
  validator: "crash-recovery-validator",
  requiredEvidence: ["process-interruption", "wal-restoration", "checkpoint-restoration", "continuation-proof"],
  requiredMeasurements: ["wal_restoration_ms"],
  summary: "provider crash recovery certification gates checked",
});
