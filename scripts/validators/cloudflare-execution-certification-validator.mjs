import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Cloudflare execution certification validator",
  finalValidator: "cloudflare-execution-certification-validator",
  harnessFragments: ["certifyDurableObjectRecovery", "binding_ownership_checksum", "env_crossover_detected", "staging_model_only"],
  contractFields: ["persistenceBackends.cloudflareD1", "persistenceBackends.r2Snapshots", "persistenceBackends.kvCheckpoints"],
  summary: "Cloudflare execution certification boundaries and recovery contracts checked",
});
