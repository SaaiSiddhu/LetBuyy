import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Telemetry ingestion validator",
  category: "telemetry-ingestion",
  validator: "telemetry-ingestion-validator",
  requiredEvidence: ["otel-health", "trace-ingestion", "trace-correlation", "evidence-linkage"],
  requiredProviderFields: ["stdout_hash", "stderr_hash", "trace_id"],
  summary: "provider telemetry ingestion gates checked",
});
