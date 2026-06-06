import {
  createReporter,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Fail-closed internal routes validator");

const internalRouteFiles = listWorkspaceFiles(["services"])
  .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file))
  .filter((file) => /\/routes\/.*internal/i.test(file));

for (const file of internalRouteFiles) {
  const source = readFile(file);
  const authorizesWithoutSecret =
    /!\s*(?:configuredSecret|secret)[\s\S]{0,160}ENVIRONMENT[\s\S]{0,160}return\s+true/.test(source)
    || /ENVIRONMENT[\s\S]{0,160}!\s*(?:configuredSecret|secret)[\s\S]{0,160}return\s+true/.test(source);

  reporter.assert(
    !authorizesWithoutSecret,
    `${file} must fail closed when an internal API secret is not configured`,
  );
}

reporter.finish(`${internalRouteFiles.length} internal route files checked`);
