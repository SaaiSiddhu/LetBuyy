import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Event versioning validator");

const manifest = readJson("config/runtime/replay-evolution-manifest.json");
const source = readFile("packages/distributed-runtime/src/event-versioning-runtime.ts");

for (const fragment of [
  "EventVersionDescriptor",
  "compatibleWith: number[]",
  "replaySafe: boolean",
  "migrationRequiredFrom: number[]",
  "requires-migration",
  "Event replay blocked",
]) {
  reporter.assert(source.includes(fragment), `Event versioning runtime missing fragment: ${fragment}`);
}

for (const family of manifest?.eventFamilies || []) {
  const versions = family.versions || [];
  const latest = versions.find((version) => version.version === family.latestVersion);
  reporter.assert(Boolean(latest), `Event versioning manifest missing latest descriptor: ${family.eventType}`);
  reporter.assert(latest?.status === "active", `Latest event version must be active: ${family.eventType}`);

  for (const version of versions) {
    reporter.assert(version.version >= 1, `Event version must be positive: ${family.eventType}`);
    reporter.assert(version.replaySafe === true, `Event version must be replay-safe before promotion: ${family.eventType} v${version.version}`);
    reporter.assert(!version.migrationRequiredFrom.includes(version.version), `Event version cannot require migration from itself: ${family.eventType} v${version.version}`);
    reporter.assert(
      version.compatibleWith.includes(family.latestVersion),
      `Older event version must be compatible with current replay runtime: ${family.eventType} v${version.version}`,
    );
  }
}

reporter.finish(`${manifest?.eventFamilies?.length || 0} event version families checked`);
