#!/usr/bin/env node

const RETIRED_REPOSITORY_INTELLIGENCE_GENERATOR = true;

console.error(
  [
    "scripts/generate-repository-intelligence.mjs is retired.",
    "Root AGENTS.md is hand-authored law from GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md.",
    "Repository scans may not regenerate governance authority or promote current tree drift into canonical law.",
    `retired=${RETIRED_REPOSITORY_INTELLIGENCE_GENERATOR}`,
  ].join("\n"),
);

process.exit(1);
