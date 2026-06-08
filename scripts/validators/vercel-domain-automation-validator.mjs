import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Vercel domain automation validator");

const client = readFile("services/api-gateway/src/lib/vercel-domains.ts");
const route = readFile("services/api-gateway/src/routes/custom-domains.ts");
const workerSchema = readFile("config/env/schemas/worker.schema.json");
const workerTemplate = readFile("config/env/templates/worker.env.example");

for (const fragment of [
  "VERCEL_API_TOKEN",
  "VERCEL_STOREFRONT_PROJECT_ID",
  "/v10/projects/{projectId}/domains",
  "/v9/projects/{projectId}/domains/",
  "/v6/domains/",
  "Retry-After",
  "already",
]) {
  reporter.assert(client.includes(fragment), `Vercel domain client missing ${fragment}`);
}

for (const fragment of [
  "attachVercelProjectDomain",
  "readVercelDomainStatus",
  "custom_domain_status: status",
]) {
  reporter.assert(route.includes(fragment), `custom-domain route missing ${fragment}`);
}

for (const envName of ["VERCEL_API_TOKEN", "VERCEL_STOREFRONT_PROJECT_ID"]) {
  reporter.assert(workerSchema.includes(envName), `worker schema missing ${envName}`);
  reporter.assert(workerTemplate.includes(envName), `worker template missing ${envName}`);
}

reporter.assert(!/vercel_[A-Za-z0-9]{12,}/.test(client + route), "Vercel token values must not appear in source");
reporter.finish("Vercel custom-domain attach and status automation is wired");
