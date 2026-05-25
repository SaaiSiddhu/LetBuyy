import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Provider execution validator",
  category: "provider-execution",
  validator: "provider-execution-validator",
  requiredEvidence: ["wrangler-auth", "cloudflare-account", "provider-command-artifacts", "no-secret-output"],
  requiredProviderFields: ["provider", "command", "exit_status", "artifact_hash", "trace_id"],
  requiredCloudflareBindings: ["durable_objects", "queues", "d1_databases"],
  summary: "provider execution evidence gates checked",
});
