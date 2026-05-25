import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Provider failover certification validator",
  category: "provider-failover",
  validator: "provider-failover-certification-validator",
  requiredEvidence: ["executor-failover", "stale-executor-eviction", "lease-ownership-restoration", "fencing-replay"],
  requiredMeasurements: ["failover_duration_ms"],
  summary: "provider failover certification gates checked",
});
