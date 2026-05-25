import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Replay throughput validator",
  finalValidator: "replay-throughput-validator",
  harnessFragments: ["replay-throughput", "throughput_per_second", "observed_events", "dataset_version"],
  contractFields: ["benchmarkLineage"],
  sloFields: ["executionCertificationBudgets.replayThroughputEventsPerSecondMinimum"],
  summary: "replay throughput benchmark lineage checked",
});
