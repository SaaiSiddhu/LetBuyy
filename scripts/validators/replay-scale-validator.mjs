import { validateProductionCertification } from "./production-certification-common.mjs";

validateProductionCertification({
  reporterName: "Replay scale validator",
  category: "replay-scale",
  validator: "replay-scale-validator",
  requiredEvidence: ["10000-events", "100000-events", "1000000-events", "projection-equivalence"],
  requiredMeasurements: ["replay_duration_ms", "projection_equivalence_hash", "queue_convergence_hash"],
  summary: "provider replay scale certification gates checked",
});
