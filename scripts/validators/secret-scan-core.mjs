// Secret-like value detection shared by environment-validator and its tests.
//
// APPID-P2 (2026-09-24). Founder, verbatim: "Do not exempt all documentation or Markdown from secret
// scanning. Use narrow, justified test-fixture exceptions. Never print detected credential values.
// Do not equate every public configuration key with a privileged secret."
//
// So there is no path-prefix exemption anywhere in this module. A reviewed exception binds one exact
// value in one exact file: config/governance/secret-scan-exceptions.json stores the path, the kind and
// the SHA-256 of the value, never the value. A different value in the same file, or the same value in
// another file, is still a finding. Findings never carry the value either, only its hash and length,
// so no caller can print one by accident.

import crypto from "node:crypto";

export const SECRET_SCAN_EXCEPTIONS_PATH = "config/governance/secret-scan-exceptions.json";

// Classifications an exception may claim. Each is a statement about what the value IS, and each needs
// evidence in the entry. "It is only documentation" is deliberately not one of them.
export const EXCEPTION_CLASSIFICATIONS = new Set([
  // A key that every client necessarily holds (Firebase client config, a Maps SDK key in a manifest).
  // Its protection is the provider's own restriction model, not secrecy.
  "public-client-identifier",
  // A sample value published by the provider in its own documentation, tied to no account.
  "public-sample-key",
  // A deliberately fake value, labelled as such where it appears.
  "labelled-local-fixture",
]);

export const secretPatterns = [
  { kind: "stripe-style-key", pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_=-]{20,}/g, prefix: /^(?:sk|pk|rk)_(?:live|test)_/ },
  { kind: "webhook-signing-secret", pattern: /\bwhsec_[A-Za-z0-9_=-]{20,}/g, prefix: /^whsec_/ },
  { kind: "razorpay-key-id", pattern: /\brzp_(?:live|test)_[A-Za-z0-9_=-]{8,}/g, prefix: /^rzp_(?:live|test)_/ },
  { kind: "google-api-key", pattern: /\bAIza[A-Za-z0-9_-]{20,}/g, prefix: /^AIza/ },
  { kind: "pem-private-key", pattern: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g, prefix: null },
];

// Unambiguous "this value is a fixture, not a credential" markers. Deliberately narrow (whole English
// phrases, never a bare word like "test") so a genuine leaked secret, an opaque random string, cannot
// coincidentally match: a real key does not spell out "do not expose" or "should never reach".
export const fixtureMarkerPattern = /do[-_ ]?not[-_ ]?expose|should[-_ ]?never[-_ ]?reach|placeholder|redacted|\bdummy\b|\bexample\b/i;

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function lineContainingIndex(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const nextNewline = content.indexOf("\n", index);
  return content.slice(lineStart, nextNewline === -1 ? content.length : nextNewline);
}

const lineNumberAt = (content, index) => content.slice(0, index).split("\n").length;

// The body after a key's fixed prefix is a placeholder when it is one character repeated
// (rzp_test_XXXXXXXXXXXX) or made only of x/X/*. A real key body is random; at eight or more
// characters it is never a single repeated symbol, so this cannot excuse key material.
export function isPlaceholderValue(value, prefix) {
  const body = prefix ? value.replace(prefix, "") : value;
  return body.length > 0 && (/^(.)\1+$/.test(body) || /^[xX*]+$/.test(body));
}

// A real committed PEM private key ships a full BEGIN...body...END block; a bare BEGIN header used as a
// redaction-test fixture has no matching footer anywhere in the file.
const hasRealPemBlock = (content) => /-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(content);

function isHardcodedSecretValue(raw) {
  const value = raw.trim();
  const lowerValue = value.toLowerCase();
  if (/^[A-Z0-9_]+$/.test(value)) return false;
  if (lowerValue.includes("process.env") || lowerValue.includes("env.") || (lowerValue.startsWith("env(") && lowerValue.endsWith(")"))) return false;
  if (lowerValue.includes("replace") || lowerValue.includes("example") || lowerValue.includes("placeholder")) return false;
  if (lowerValue.includes("redacted") || lowerValue.includes("dummy") || lowerValue.includes("test_")) return false;
  // Same unambiguous fixture-marker set as the pattern scan (R-18: precision, not weakening).
  if (fixtureMarkerPattern.test(value)) return false;
  if (value.startsWith("$") || value.startsWith("{")) return false;
  if (/\s/.test(value)) return false;
  if (/^[a-z0-9_./-]+$/.test(value)) return false;
  const characterClassCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[+/=_-]/].filter((re) => re.test(value)).length;
  return characterClassCount >= 3;
}

// Every secret-like value in `content`, as { kind, line, sha256, length }. Never the value itself.
export function findSecretLikeValues(content) {
  const findings = [];
  for (const { kind, pattern, prefix } of secretPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (kind === "pem-private-key") {
        if (!hasRealPemBlock(content)) continue;
      } else {
        if (fixtureMarkerPattern.test(lineContainingIndex(content, match.index))) continue;
        if (isPlaceholderValue(match[0], prefix)) continue;
      }
      findings.push({ kind, line: lineNumberAt(content, match.index), sha256: sha256(match[0]), length: match[0].length });
    }
  }
  const assignmentPattern = /(?:secret|token|password|private[_-]?key|service[_-]?role)[A-Za-z0-9_ .:-]*[=:]\s*["']([^"'\n]{16,})["']/gi;
  for (const match of content.matchAll(assignmentPattern)) {
    if (!isHardcodedSecretValue(match[1])) continue;
    const value = match[1].trim();
    findings.push({ kind: "hardcoded-assignment", line: lineNumberAt(content, match.index), sha256: sha256(value), length: value.length });
  }
  return findings;
}

// Structural problems in the exception registry itself. `isTracked` decides whether a path exists in
// the repository; an exception for a file that is gone is stale by definition.
export function exceptionRegistryProblems(registry, isTracked) {
  const problems = [];
  const entries = Array.isArray(registry?.exceptions) ? registry.exceptions : null;
  if (!entries) return ["the registry must have an `exceptions` array"];
  const seen = new Set();
  entries.forEach((entry, index) => {
    const at = `exceptions[${index}]`;
    for (const field of ["path", "kind", "sha256", "classification", "justification", "evidence", "retire_when"]) {
      if (typeof entry?.[field] !== "string" || entry[field].trim() === "") problems.push(`${at} is missing ${field}`);
    }
    const allowed = new Set(["path", "kind", "sha256", "classification", "justification", "evidence", "retire_when"]);
    for (const key of Object.keys(entry || {})) if (!allowed.has(key)) problems.push(`${at} has unsupported field ${key} (exceptions bind one value in one file; there is no prefix form)`);
    if (entry?.path && /[*?[\]]|\/$/.test(entry.path)) problems.push(`${at} path must name one file, not a pattern or directory: ${entry.path}`);
    if (entry?.path && !isTracked(entry.path)) problems.push(`${at} names a file that is not tracked: ${entry.path}`);
    if (entry?.kind && !secretPatterns.some((p) => p.kind === entry.kind) && entry.kind !== "hardcoded-assignment") problems.push(`${at} has unknown kind ${entry.kind}`);
    if (entry?.sha256 && !/^[0-9a-f]{64}$/.test(entry.sha256)) problems.push(`${at} sha256 must be 64 lowercase hex characters`);
    if (entry?.classification && !EXCEPTION_CLASSIFICATIONS.has(entry.classification)) problems.push(`${at} has unknown classification ${entry.classification}`);
    const key = `${entry?.path}\u0000${entry?.kind}\u0000${entry?.sha256}`;
    if (seen.has(key)) problems.push(`${at} duplicates an earlier entry for ${entry.path}`);
    seen.add(key);
  });
  return problems;
}

export const exceptionMatches = (entry, path, finding) =>
  entry.path === path && entry.kind === finding.kind && entry.sha256 === finding.sha256;
