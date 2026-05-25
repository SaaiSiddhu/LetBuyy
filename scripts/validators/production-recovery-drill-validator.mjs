import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Production recovery drill validator",
  category: "production-recovery-drill",
  validator: "production-recovery-drill-validator",
  requiredEvidence: ["replay-restoration-drill", "wal-corruption-drill", "queue-rebuild-drill", "durable-object-recovery-drill"],
  requiredCloudflareBindings: ["durable_objects", "kv_namespaces", "r2_buckets", "d1_databases"],
  summary: "provider recovery drill certification gates checked",
});
