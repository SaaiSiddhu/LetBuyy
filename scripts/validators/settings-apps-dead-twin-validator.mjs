import {
  createReporter,
  getTrackedFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Settings apps dead twin validator");
const trackedFiles = getTrackedFiles();

const runtimeTwin = "apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsContent.tsx";
reporter.assert(
  !trackedFiles.includes(runtimeTwin),
  `${runtimeTwin} is an archived dead twin and must not return to runtime source`,
);

const archiveTwin = "docs/archive/dead-code/merchant-control-plane/settings-apps/AppsSettingsContent.tsx";
reporter.assert(
  trackedFiles.includes(archiveTwin),
  "archived AppsSettingsContent twin must remain under docs/archive/dead-code for provenance",
);

const settingsPage = readFile("apps/merchant-control-plane/src/app/[store]/settings/apps/page.tsx");
reporter.assert(
  settingsPage.includes("import { AppsSettingsClient } from './AppsSettingsClient'"),
  "settings apps page must render the live AppsSettingsClient implementation",
);

const appSourceRefs = trackedFiles.filter((file) => {
  if (!file.startsWith("apps/")) return false;
  if (!/\.(?:ts|tsx)$/.test(file)) return false;
  return readFile(file).includes("AppsSettingsContent");
});
reporter.assert(
  appSourceRefs.length === 0,
  `runtime source must not reference archived AppsSettingsContent: ${appSourceRefs.join(", ")}`,
);

const activeAudit = readFile("docs/archive/historical-audits-2026-06-10/apps-platform/06-merchant-integration-audit.md");
reporter.assert(
  activeAudit.includes("AppsSettingsClient.tsx") && !activeAudit.includes("AppsSettingsContent.tsx"),
  "active app-platform audit must reference the live apps settings implementation",
);

reporter.finish("orphaned AppsSettingsContent twin is archived outside runtime source");
