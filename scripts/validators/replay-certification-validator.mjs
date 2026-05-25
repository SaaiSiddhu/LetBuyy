import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Replay certification validator",
  category: "replay",
  validator: "replay-certification-validator",
  requiredEvidence: ["same-input-checksum", "same-state-checksum", "projection-equivalence", "timing-observed"],
  summary: "replay execution certification harness and evidence contract checked",
});
