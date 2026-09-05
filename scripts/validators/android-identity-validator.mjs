import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  getTrackedFiles,
  readFile,
  readJson,
  root,
} from "./governance-common.mjs";

/**
 * Guards the one asset class in this repository that cannot be rebuilt: a
 * shipped Android applicationId. apps/admin_app/android/app/build.gradle.kts
 * once carried applicationId "com.letbuyy.letbuyy" -- the customer app's
 * shipped identity -- undetected through Phase 0 and fourteen further
 * phases, found only by a human diffing two files by hand (Phase R,
 * docs/migration/repository_consolidation/27_android_gradle_resolution.md).
 *
 * The expected identity is read from config/governance/android-identity-
 * registry.json, a file that is NOT generated from and does not live beside
 * the Gradle files it checks -- so a real identity change requires editing
 * two files and shows up as a reviewable diff, not a silent one-file edit.
 *
 * Path-only for keystore material: this validator NEVER reads, prints,
 * diffs or hashes the contents of key.properties or any .jks/.keystore
 * file. Phase R disclosed a real incident where a diff against a
 * non-existent tracked counterpart printed a live signing password --
 * every check here is an existence/path assertion only.
 *
 * Retired identities (registry.retiredApps, added by phase FB-1, 2026-09-05):
 * an applicationId whose app has been deleted is NOT checked against a Gradle
 * file -- there is no longer one to read. It is instead checked in the opposite
 * direction: no tracked Gradle script anywhere in the repository may declare
 * it. A retired applicationId is not a free name. Reusing com.letbuyy.admin
 * for some later app would publish that app under the retired listing's
 * identity, which is the same class of defect as the Phase R incident this
 * validator was written for -- one app silently carrying another's identity --
 * only in the reverse direction, and no other check would catch it.
 */

const reporter = createReporter("Android identity validator");
const registryPath = "config/governance/android-identity-registry.json";
const offenders = [];

const dialectPatterns = {
  groovy: {
    namespace: /namespace\s+'([^']+)'/,
    applicationId: /applicationId\s+"([^"]+)"/,
  },
  kotlin: {
    namespace: /namespace\s*=\s*"([^"]+)"/,
    applicationId: /applicationId\s*=\s*"([^"]+)"/,
  },
};

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

const registry = readJson(registryPath);

if (!registry || typeof registry.apps !== "object" || registry.apps === null) {
  offenders.push(`${registryPath}: missing or unparsable -- Android identity cannot be verified`);
} else {
  for (const [appName, expected] of Object.entries(registry.apps)) {
    const gradleRoot = expected.gradleRoot;
    const dialect = expected.buildScriptDialect;
    const patterns = dialectPatterns[dialect];

    if (!gradleRoot || !patterns) {
      offenders.push(`${appName}: registry entry missing gradleRoot or a recognised buildScriptDialect ("groovy" | "kotlin")`);
      continue;
    }

    // --- duplicate .gradle / .gradle.kts pairs: the exact Phase R condition ---
    const levels = [
      { label: "root build script", groovy: `${gradleRoot}/build.gradle`, kts: `${gradleRoot}/build.gradle.kts` },
      { label: "settings script", groovy: `${gradleRoot}/settings.gradle`, kts: `${gradleRoot}/settings.gradle.kts` },
      { label: "app build script", groovy: `${gradleRoot}/app/build.gradle`, kts: `${gradleRoot}/app/build.gradle.kts` },
    ];
    for (const level of levels) {
      if (exists(level.groovy) && exists(level.kts)) {
        // Peek at what the dead .kts file itself declares, purely for a more
        // actionable message -- this is never used to decide pass/fail, and
        // the file is not a secret (a source-code Gradle script).
        const deadText = readFile(level.kts);
        const deadAppId = deadText.match(dialectPatterns.kotlin.applicationId)?.[1]
          ?? deadText.match(dialectPatterns.groovy.applicationId)?.[1];
        const deadValueNote = deadAppId
          ? ` The dead file declares applicationId '${deadAppId}'${deadAppId !== expected.applicationId ? ` -- WRONG, does not match this app's declared identity '${expected.applicationId}'` : ""}.`
          : "";
        offenders.push(
          `${appName}: both ${level.groovy} and ${level.kts} exist (${level.label}) -- Gradle silently ignores the .kts file when both are present ("This is likely a mistake" -- Gradle's own diagnostic).${deadValueNote} Delete the dead one.`,
        );
      }
    }

    // --- applicationId / namespace against the declaration ---
    const appScriptPath = dialect === "kotlin" ? `${gradleRoot}/app/build.gradle.kts` : `${gradleRoot}/app/build.gradle`;
    if (!exists(appScriptPath)) {
      offenders.push(`${appName}: expected app build script ${appScriptPath} (dialect: ${dialect}) does not exist`);
    } else {
      const text = readFile(appScriptPath);
      const namespaceMatch = text.match(patterns.namespace);
      const applicationIdMatch = text.match(patterns.applicationId);

      if (!namespaceMatch) {
        offenders.push(`${appName}: could not find a ${dialect}-dialect namespace declaration in ${appScriptPath}`);
      } else if (namespaceMatch[1] !== expected.namespace) {
        offenders.push(
          `${appName}: ${appScriptPath} declares namespace '${namespaceMatch[1]}' but ${registryPath} expects '${expected.namespace}'`,
        );
      }

      if (!applicationIdMatch) {
        offenders.push(`${appName}: could not find a ${dialect}-dialect applicationId declaration in ${appScriptPath}`);
      } else if (applicationIdMatch[1] !== expected.applicationId) {
        offenders.push(
          `${appName}: ${appScriptPath} declares applicationId '${applicationIdMatch[1]}' but ${registryPath} expects '${expected.applicationId}'`,
        );
      }
    }

    // --- google-services.json cross-reference (public client manifest, not a secret) ---
    if (expected.googleServicesJson) {
      if (!exists(expected.googleServicesJson)) {
        offenders.push(`${appName}: ${registryPath} declares googleServicesJson at ${expected.googleServicesJson} but that file does not exist`);
      } else {
        const gsj = readJson(expected.googleServicesJson);
        const clientPackageNames = (gsj?.client ?? [])
          .map((c) => c?.client_info?.android_client_info?.package_name)
          .filter(Boolean);
        if (!clientPackageNames.includes(expected.applicationId)) {
          offenders.push(
            `${appName}: ${expected.googleServicesJson} has no client registered for applicationId '${expected.applicationId}' (found: ${clientPackageNames.join(", ") || "none"})`,
          );
        }
      }
    }
  }
}

// --- retired applicationIds must not reappear in ANY tracked Gradle script ---
const retiredApps = registry?.retiredApps ?? {};
const retiredIds = new Map(
  Object.entries(retiredApps)
    .map(([name, entry]) => [entry?.applicationId, name])
    .filter(([id]) => typeof id === "string" && id.length > 0),
);
if (retiredIds.size > 0) {
  const gradleScripts = getTrackedFiles().filter((file) => /(^|\/)build\.gradle(\.kts)?$/.test(file));
  for (const file of gradleScripts) {
    const text = readFile(file);
    const declaredId = text.match(dialectPatterns.kotlin.applicationId)?.[1]
      ?? text.match(dialectPatterns.groovy.applicationId)?.[1];
    if (declaredId && retiredIds.has(declaredId)) {
      offenders.push(
        `${file}: declares applicationId '${declaredId}', which ${registryPath} records as RETIRED (was ${retiredIds.get(declaredId)}, retired ${retiredApps[retiredIds.get(declaredId)]?.retiredOn ?? "unknown date"}). A retired identity must never be reused -- it would ship this app under the retired app's store listing.`,
      );
    }
  }
}

// --- keystore / key.properties must never be tracked in git -- path-only, content never read ---
const keystorePattern = /\.jks$|\.keystore$|(^|\/)key\.properties$/;
const trackedKeystoreFiles = getTrackedFiles().filter((file) => keystorePattern.test(file));
for (const file of trackedKeystoreFiles) {
  offenders.push(`${file}: signing keystore material must never be tracked in git (path-only check -- contents were not read)`);
}

reporter.assert(
  offenders.length === 0,
  `Android identity drift or hazard detected:\n${offenders.join("\n")}`,
);
reporter.finish("Android applicationId/namespace, duplicate build scripts, retired-identity reuse, and keystore tracking checked");
