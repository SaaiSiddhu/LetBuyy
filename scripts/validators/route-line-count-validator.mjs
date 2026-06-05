import {
  createReporter,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Route line-count validator");
const maxRouteLines = 1500;

const routeFiles = listWorkspaceFiles(["services/api-gateway/src/routes"])
  .filter((file) => file.endsWith(".ts"));

for (const file of routeFiles) {
  const source = readFile(file);
  const lineCount = source.endsWith("\n")
    ? source.split("\n").length - 1
    : source.split("\n").length;
  reporter.assert(
    lineCount <= maxRouteLines,
    `${file} has ${lineCount} lines; route files must stay at or below ${maxRouteLines} lines`,
  );
}

reporter.finish(`${routeFiles.length} api-gateway route files checked at <=${maxRouteLines} lines`);
