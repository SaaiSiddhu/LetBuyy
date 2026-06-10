import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import {
  createReporter,
  reservedMobileRuntimeRoots,
  reservedServiceRoots,
  startsWithPrefix,
} from "./governance-common.mjs";

const reporter = createReporter("No reserved service activation validator");
const reservedRoots = [...reservedServiceRoots, ...reservedMobileRuntimeRoots];
const allowedReservedFiles = new Set(reservedRoots.flatMap((root) => [
  `${root}/AGENTS.md`,
  `${root}/runtime.manifest.json`,
]));

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "config", "infrastructure"], { filePattern: /.*/ })) {
  if (!reservedRoots.some((root) => startsWithPrefix(entry.path, root))) continue;
  if (allowedReservedFiles.has(entry.path) && !entry.extra) continue;
  offenders.push(`${entry.path}: reserved runtime roots are manifest-only until human-approved activation`);
}

assertNoOffenders(reporter, offenders, "Reserved service/mobile roots must not gain deployable source");
reporter.finish("reserved runtime activation checked");
