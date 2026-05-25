import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Queue certification validator",
  category: "queue",
  validator: "queue-certification-validator",
  requiredEvidence: ["checkpoint-checksum", "dead-letter-recovery", "poison-message-quarantine", "convergence-checksum"],
  summary: "queue rebuild certification harness and evidence contract checked",
});
