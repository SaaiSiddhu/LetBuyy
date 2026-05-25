import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Rollback execution validator",
  finalValidator: "rollback-execution-validator",
  harnessFragments: ["rollback-steps", "rollback-timing", "compensation_checksum", "rollback_dag_checksum"],
  summary: "rollback execution, compensation, and timing evidence checked",
});
