import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Recovery drill execution validator",
  finalValidator: "recovery-drill-execution-validator",
  harnessFragments: ["restart_backed", "buildRestorationReport", "orchestration-checkpoints", "durable-object-snapshots"],
  summary: "restart-backed recovery drill execution lineage checked",
});
