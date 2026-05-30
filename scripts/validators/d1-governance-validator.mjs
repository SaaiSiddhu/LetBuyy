import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("D1 governance validator");
const topology = readJson("config/runtime/cloudflare-topology.json");
const apiWrangler = readFile("services/api-gateway/wrangler.toml");
const storageTerraform = readFile("infrastructure/cloudflare/storage.tf");
const materializer = readFile("infrastructure/scripts/cloudflare/materialize-wrangler-config.mjs");
const migrationPath = "database/cloudflare/d1/migrations/0001_provider_execution_foundation.sql";
const migration = readFile(migrationPath);

reporter.assert(exists(migrationPath), "D1 provider execution migration must exist");
for (const fragment of [
  "provider_execution_evidence",
  "d1_migration_lineage",
  "replay_restoration_lineage",
  "rollback_lineage",
]) {
  reporter.assert(migration.includes(fragment), `D1 migration missing table ${fragment}`);
}

reporter.assert(storageTerraform.includes('resource "cloudflare_d1_database" "runtime_d1"'), "Terraform must declare production D1 database");
reporter.assert(storageTerraform.includes('resource "cloudflare_d1_database" "runtime_d1_staging"'), "Terraform must declare staging D1 database");
reporter.assert(storageTerraform.includes('resource "cloudflare_d1_database" "runtime_d1_dev"'), "Terraform must declare dev D1 database");
reporter.assert(storageTerraform.includes("letbuyy_runtime_d1_database_ids"), "Terraform must output D1 database IDs for materialization");
reporter.assert(materializer.includes("LETBUYY_RUNTIME_D1_"), "Wrangler materializer must support D1 database IDs");

for (const environment of ["dev", "staging", "production"]) {
  const env = topology.environments[environment];
  const envSection = apiWrangler.slice(apiWrangler.indexOf(`[env.${environment}]`), apiWrangler.indexOf(environment === "dev" ? "[env.staging]" : environment === "staging" ? "[env.production]" : "\n[env.__end__"));
  const placeholder = `__LETBUYY_RUNTIME_D1_${environment.toUpperCase()}_DATABASE_ID__`;
  reporter.assert(envSection.includes("[[env." + environment + ".d1_databases]]"), `API Gateway missing D1 binding for ${environment}`);
  reporter.assert(envSection.includes('binding = "RUNTIME_DB"'), `API Gateway missing RUNTIME_DB binding for ${environment}`);
  reporter.assert(envSection.includes(`database_name = "${env.d1}"`), `API Gateway D1 database name drift for ${environment}`);
  reporter.assert(envSection.includes(`database_id = "${placeholder}"`), `API Gateway D1 placeholder drift for ${environment}`);
  reporter.assert(envSection.includes('migrations_dir = "../../database/cloudflare/d1/migrations"'), `API Gateway D1 migrations_dir missing for ${environment}`);
}

reporter.finish("D1 database, migration, and materialization governance checked");
