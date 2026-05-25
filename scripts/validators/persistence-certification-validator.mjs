import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Persistence certification validator",
  finalValidator: "persistence-certification-validator",
  harnessFragments: ["appendRecord", "readRecords", "buildRestorationReport", "--mode=restore", "restart_backed"],
  contractFields: ["persistenceBackends.local", "persistenceBackends.sqlite", "persistenceBackends.postgres", "persistenceBackends.cloudflareD1", "persistenceBackends.r2Snapshots", "persistenceBackends.kvCheckpoints"],
  summary: "persistent execution backend, restart restoration, and backend contracts checked",
});
