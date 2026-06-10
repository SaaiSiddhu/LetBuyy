import {
  assertNoOffenders,
  phaseBEntries,
  pushRegexOffenders,
} from "./phase-b-common.mjs";
import {
  createReporter,
  exists,
  rejectedPackageRoots,
} from "./governance-common.mjs";

const reporter = createReporter("No rejected package imports validator");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const packageNames = rejectedPackageRoots.map((root) => `@letbuyy/${root.split("/").pop()}`);
const rejectedSpecifierPattern = [
  ...packageNames.map(escapeRegExp),
  ...rejectedPackageRoots.map(escapeRegExp),
].join("|");
const rejectedImportPattern = new RegExp(
  `(?:from\\s+|import\\s*(?:\\(\\s*)?|require\\s*\\(\\s*)['"\`](${rejectedSpecifierPattern})(?:\\/[^'"\`]*)?['"\`]`,
  "g",
);

const offenders = [];
for (const entry of phaseBEntries(["apps", "services"], {
  filePattern: /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|dart)$/,
  includeTests: false,
})) {
  pushRegexOffenders(
    offenders,
    entry,
    rejectedImportPattern,
    (match) => `active runtime imports or references rejected package ${match[0]}`,
  );
}

assertNoOffenders(reporter, offenders, "Rejected architecture packages must not be imported by active runtimes");

const rejectedTerminologyPattern = /\b(?:orchestration-runtime|application-service(?:-declared)?)\b/g;
const terminologyOffenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"], {
  filePattern: /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|dart|md)$/,
  includeTests: false,
})) {
  pushRegexOffenders(
    terminologyOffenders,
    entry,
    rejectedTerminologyPattern,
    (match) => `active source uses rejected application-service/orchestration-runtime terminology: ${match[0]}`,
  );
}

assertNoOffenders(reporter, terminologyOffenders, "Rejected application-service/orchestration-runtime terminology must not appear in active source");

const survivingRejectedRoots = rejectedPackageRoots.filter((root) => exists(root));
reporter.assert(
  survivingRejectedRoots.length === 0,
  `Rejected architecture packages must be deleted, not left as inactive scaffolding: ${survivingRejectedRoots.join(", ")}`,
);

reporter.finish("rejected package imports and deleted roots checked");
