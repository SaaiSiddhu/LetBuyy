import fs from "node:fs";
import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
} from "./governance-common.mjs";

const reporter = createReporter("Foundation SQL policy residue validator");

const policyPattern = /CREATE\s+POLICY\s+[\s\S]*?;/gi;
const truePolicyPattern = /\bUSING\s*\(\s*true\s*\)|\bWITH\s+CHECK\s*\(\s*true\s*\)/i;

const allowedPublicPolicyNames = [
  "anyone_create_endorsements",
  "anyone_read_plans",
  "anyone_read_roles",
  "employee_permissions_read",
  "public_submit_contact",
  "public_submit_leads",
  "public_track_analytics",
  "public_view_endorsements",
  "public_view_smart_collections",
];

function firstLineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function policyName(statement) {
  const quoted = statement.match(/CREATE\s+POLICY\s+"([^"]+)"/i);
  if (quoted) return quoted[1];
  return statement.match(/CREATE\s+POLICY\s+([^\s]+)\s+/i)?.[1] ?? "";
}

function classifyPolicy(file, statement) {
  const normalized = statement.replace(/\s+/g, " ").trim();
  const name = policyName(statement);
  const lowerName = name.toLowerCase();
  const lowerStatement = normalized.toLowerCase();

  if (file.endsWith("database/supabase/migrations/000_baseline.sql")) {
    return "baseline legacy residue superseded by additive RLS hardening and tenant validator";
  }

  if (
    /\bto\s+service_role\b/i.test(normalized) ||
    lowerName.includes("service role") ||
    lowerName.includes("service_role") ||
    lowerName.includes("service_all") ||
    lowerName.includes("_service_") ||
    lowerName.endsWith("_service_all")
  ) {
    return "service_role-only policy";
  }

  if (
    /\bfor\s+select\b/i.test(normalized) &&
    (allowedPublicPolicyNames.includes(lowerName) || lowerName.startsWith("public_") || lowerName.startsWith("anyone_read"))
  ) {
    return "intentional public/global read policy";
  }

  if (
    /\bfor\s+insert\b/i.test(normalized) &&
    (lowerName.startsWith("public_submit") || lowerName.startsWith("public_track") || lowerName.startsWith("anyone_create"))
  ) {
    return "intentional public insert policy";
  }

  return null;
}

const sqlFiles = listWorkspaceFiles(["database/supabase/migrations"])
  .filter((file) => file.endsWith(".sql"))
  .sort();

let classifiedCount = 0;

for (const file of sqlFiles) {
  const source = fs.readFileSync(path.resolve(file), "utf8");
  for (const match of source.matchAll(policyPattern)) {
    const statement = match[0];
    if (!truePolicyPattern.test(statement)) continue;

    const classification = classifyPolicy(file, statement);
    classifiedCount += 1;
    reporter.assert(
      Boolean(classification),
      `${file}:${firstLineNumber(source, match.index ?? 0)} has unclassified USING(true)/WITH CHECK(true) policy: ${policyName(statement) || "unknown policy"}`,
    );
  }
}

reporter.finish(`classified ${classifiedCount} SQL true-policy residues`);
