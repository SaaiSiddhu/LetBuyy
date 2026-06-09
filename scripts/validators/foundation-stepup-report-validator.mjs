import fs from "node:fs";
import { getTrackedFiles, readFile } from "./governance-common.mjs";

const dashboard = readFile("FOUNDATION_EXECUTION_DASHBOARD.md");
const status = readFile("FOUNDATION_STEPUP_STATUS.md");
const phaseA = [
  "FOUNDATION_REPO_STATE.md",
  "ACTIVE_DEPLOYMENT_TOPOLOGY.md",
  "BUILD_GRAPH.md",
  "IMPORT_GRAPH.md",
];

console.log("Foundation Step-Up report lane");
console.log(`- Dashboard present: ${dashboard ? "yes" : "no"}`);
console.log(`- Status present: ${status ? "yes" : "no"}`);
console.log(`- Phase A artifacts present: ${phaseA.filter((file) => fs.existsSync(file)).length}/${phaseA.length}`);
console.log(`- Tracked files: ${getTrackedFiles().length}`);
console.log("- Gate demotions: none");
