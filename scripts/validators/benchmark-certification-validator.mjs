import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Benchmark certification validator",
  category: "benchmark-certification",
  validator: "benchmark-certification-validator",
  requiredEvidence: ["runtime-config-snapshot", "infrastructure-metadata", "timing-lineage", "provider-artifact-hash"],
  requiredMeasurements: ["replay_duration_ms", "failover_duration_ms", "provider_artifact_hash"],
  summary: "provider benchmark certification gates checked",
});
