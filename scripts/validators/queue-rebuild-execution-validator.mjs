import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Queue rebuild execution validator",
  finalValidator: "queue-rebuild-execution-validator",
  harnessFragments: ["queue-rebuild-throughput", "queue-checkpoints", "poison_quarantined", "dead_lettered"],
  contractFields: ["persistenceBackends.jsonlEvidence.storageCollections"],
  sloFields: ["executionCertificationBudgets.queueRebuildMessagesPerSecondMinimum"],
  summary: "persistent queue rebuild execution and benchmark lineage checked",
});
