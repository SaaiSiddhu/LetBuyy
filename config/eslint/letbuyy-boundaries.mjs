import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const baselinePath = path.join(repoRoot, "config/eslint/boundary-baseline.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

const apiRouteBaseline = new Set(baseline.apiRoutes ?? []);
const supabaseImportBaseline = new Set(baseline.supabaseImports ?? []);
const domainTypeBaseline = new Set(baseline.domainTypes ?? []);
const domainTypeNames = new Set([
  "Address",
  "Cart",
  "Collection",
  "Coupon",
  "Customer",
  "LineItem",
  "Order",
  "Page",
  "Payment",
  "Product",
  "Store",
  "Theme",
  "Variant",
]);

function toRepoPath(filename) {
  if (!filename || filename === "<input>") return "";
  const absolutePath = path.isAbsolute(filename) ? filename : path.resolve(process.cwd(), filename);
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function isAppApiRoute(repoPath) {
  return /^apps\/[^/]+\/src\/app\/api\/(?:.*\/)?route\.[jt]sx?$/.test(repoPath);
}

function getStringValue(node) {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value?.cooked;
  return undefined;
}

function isSupabasePackage(source) {
  return typeof source === "string" && source.startsWith("@supabase/");
}

const letbuyyBoundaryPlugin = {
  rules: {
    "no-new-next-api-route": {
      meta: {
        type: "problem",
        docs: {
          description: "Forbid new app-local Next.js API routes outside the mission baseline.",
        },
        schema: [],
      },
      create(context) {
        return {
          Program(node) {
            const repoPath = toRepoPath(context.filename);
            if (isAppApiRoute(repoPath) && !apiRouteBaseline.has(repoPath)) {
              context.report({
                node,
                message: "New app-local Next.js API routes are frozen. Add backend behavior to services/api-gateway instead.",
              });
            }
          },
        };
      },
    },
    "no-app-supabase-import": {
      meta: {
        type: "problem",
        docs: {
          description: "Forbid direct Supabase package imports from apps.",
        },
        schema: [],
      },
      create(context) {
        function checkSource(node, source) {
          const repoPath = toRepoPath(context.filename);
          if (!repoPath.startsWith("apps/")) return;
          if (!isSupabasePackage(source)) return;
          const key = `${repoPath}:${source}`;
          if (supabaseImportBaseline.has(key)) return;
          context.report({
            node,
            message: "Apps must not import @supabase/* directly. Call the Commerce API or a shared app boundary client.",
          });
        }

        return {
          ImportDeclaration(node) {
            checkSource(node.source, getStringValue(node.source));
          },
          ExportNamedDeclaration(node) {
            checkSource(node.source, getStringValue(node.source));
          },
          ExportAllDeclaration(node) {
            checkSource(node.source, getStringValue(node.source));
          },
          ImportExpression(node) {
            checkSource(node.source, getStringValue(node.source));
          },
          CallExpression(node) {
            if (node.callee?.type !== "Identifier" || node.callee.name !== "require") return;
            checkSource(node.arguments[0], getStringValue(node.arguments[0]));
          },
        };
      },
    },
    "no-app-domain-type": {
      meta: {
        type: "problem",
        docs: {
          description: "Forbid new app-local domain type declarations outside the mission baseline.",
        },
        schema: [],
      },
      create(context) {
        function checkTypeName(node) {
          const name = node.id?.name;
          if (!domainTypeNames.has(name)) return;

          const repoPath = toRepoPath(context.filename);
          if (!repoPath.startsWith("apps/")) return;

          const key = `${repoPath}:${name}`;
          if (domainTypeBaseline.has(key)) return;

          context.report({
            node: node.id,
            message: `Apps must not declare local ${name} domain types. Use @letbuyy/shared-types instead.`,
          });
        }

        return {
          TSInterfaceDeclaration: checkTypeName,
          TSTypeAliasDeclaration: checkTypeName,
        };
      },
    },
  },
};

export function createLetbuyyBoundaryConfig() {
  return {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "letbuyy-boundaries": letbuyyBoundaryPlugin,
    },
    rules: {
      "letbuyy-boundaries/no-app-domain-type": "error",
      "letbuyy-boundaries/no-app-supabase-import": "error",
      "letbuyy-boundaries/no-new-next-api-route": "error",
    },
  };
}
