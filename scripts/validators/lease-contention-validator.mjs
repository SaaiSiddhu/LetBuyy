import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Lease contention validator",
  finalValidator: "lease-contention-validator",
  harnessFragments: ["lease-heartbeats", "authoritative_executor", "stale_executor_evicted", "fencing_token_replayed"],
  summary: "lease contention, stale executor eviction, and fencing evidence checked",
});
