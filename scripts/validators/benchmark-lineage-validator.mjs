import { validateOperationalCertification } from "./operational-certification-common.mjs";

validateOperationalCertification({
  reporterName: "Benchmark lineage validator",
  finalValidator: "benchmark-lineage-validator",
  harnessFragments: ["benchmark_results", "dataset_version", "execution_environment", "evidence_hash"],
  contractFields: ["benchmarkLineage.requiredFields", "benchmarkLineage.requiredBenchmarks"],
  summary: "benchmark provenance and timing lineage checked",
});
