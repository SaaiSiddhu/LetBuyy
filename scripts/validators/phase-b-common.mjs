import {
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

export const phaseBSourcePattern = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|dart|sql|json|yaml|yml|toml|css)$/;

export function isTestPath(file) {
  return file.includes("__tests__")
    || file.includes("/test/")
    || file.includes("/tests/")
    || file.endsWith(".test.ts")
    || file.endsWith(".test.tsx")
    || file.endsWith(".test.mjs")
    || file.endsWith(".spec.ts")
    || file.endsWith(".spec.tsx");
}

export function phaseBExtraEntries() {
  const raw = process.env.LETBUYY_PHASE_B_EXTRA_FILES_JSON;
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`LETBUYY_PHASE_B_EXTRA_FILES_JSON must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("LETBUYY_PHASE_B_EXTRA_FILES_JSON must be an array");
  }

  return parsed.map((entry, index) => {
    if (!entry || typeof entry.path !== "string" || typeof entry.text !== "string") {
      throw new Error(`Invalid Phase B fixture at index ${index}; expected { path, text }`);
    }
    return {
      path: entry.path,
      text: entry.text,
      extra: true,
    };
  });
}

export function phaseBEntries(startDirs = ["apps", "services", "packages", "database", "config", "scripts"], options = {}) {
  const {
    includeTests = false,
    filePattern = phaseBSourcePattern,
  } = options;

  const realEntries = listWorkspaceFiles(startDirs)
    .filter((file) => filePattern.test(file))
    .filter((file) => includeTests || !isTestPath(file))
    .map((file) => ({
      path: file,
      text: readFile(file),
      extra: false,
    }));

  const extraEntries = phaseBExtraEntries()
    .filter((entry) => filePattern.test(entry.path))
    .filter((entry) => includeTests || !isTestPath(entry.path));

  return [...realEntries, ...extraEntries];
}

export function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

export function pushRegexOffenders(offenders, entry, pattern, message) {
  for (const match of entry.text.matchAll(pattern)) {
    offenders.push(`${entry.path}:${lineNumberForIndex(entry.text, match.index || 0)} ${message(match)}`);
  }
}

export function assertNoOffenders(reporter, offenders, message, limit = 25) {
  reporter.assert(
    offenders.length === 0,
    `${message}\n${offenders.slice(0, limit).join("\n")}`,
  );
}
