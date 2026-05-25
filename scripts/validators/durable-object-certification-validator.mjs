import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Durable Object certification validator",
  category: "durable-object",
  validator: "durable-object-certification-validator",
  requiredEvidence: ["binding-ownership", "snapshot-restored", "replay-cursor-restored", "no-env-crossover"],
  summary: "Durable Object recovery certification harness and evidence contract checked",
});
