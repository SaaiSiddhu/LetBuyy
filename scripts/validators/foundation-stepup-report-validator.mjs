import fs from "node:fs";
import { getTrackedFiles, readFile } from "./governance-common.mjs";

const archiveRoot = "docs/archive/root-governance-2026-06-10";
const dashboardPath = fs.existsSync("FOUNDATION_EXECUTION_DASHBOARD.md")
  ? "FOUNDATION_EXECUTION_DASHBOARD.md"
  : `${archiveRoot}/FOUNDATION_EXECUTION_DASHBOARD.md`;
const statusPath = fs.existsSync("FOUNDATION_STEPUP_STATUS.md")
  ? "FOUNDATION_STEPUP_STATUS.md"
  : `${archiveRoot}/FOUNDATION_STEPUP_STATUS.md`;
const dashboard = readFile(dashboardPath);
const status = readFile(statusPath);
const phaseA = [
  `${archiveRoot}/FOUNDATION_REPO_STATE.md`,
  `${archiveRoot}/ACTIVE_DEPLOYMENT_TOPOLOGY.md`,
  `${archiveRoot}/BUILD_GRAPH.md`,
  `${archiveRoot}/IMPORT_GRAPH.md`,
];

console.log("Foundation Step-Up report lane");
console.log(`- Dashboard present: ${dashboard ? "yes" : "no"}`);
console.log(`- Status present: ${status ? "yes" : "no"}`);
console.log(`- Phase A artifacts present: ${phaseA.filter((file) => fs.existsSync(file)).length}/${phaseA.length}`);
console.log(`- Tracked files: ${getTrackedFiles().length}`);
console.log("- Gate demotions: none");
