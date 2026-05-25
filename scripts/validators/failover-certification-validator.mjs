import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Failover certification validator",
  category: "failover",
  validator: "failover-certification-validator",
  requiredEvidence: ["single-authority", "stale-executor-evicted", "fencing-token-replayed", "takeover-timing-observed"],
  summary: "lease failover certification harness and evidence contract checked",
});
