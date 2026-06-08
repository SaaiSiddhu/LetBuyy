import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Custom domain reconciler validator");

const gatewayRoute = readFile("services/api-gateway/src/routes/internal-custom-domain-reconcile.ts");
const gatewayIndex = readFile("services/api-gateway/src/index.ts");
const worker = readFile("services/queue-workers/src/index.ts");
const wrangler = readFile("services/queue-workers/wrangler.toml");
const singleWriter = readFile("scripts/validators/single-writer-ownership-validator.mjs");

for (const fragment of [
  "custom-domain-reconcile",
  "resolveDoh",
  "readVercelDomainStatus",
  "custom_domain_status: nextStatus",
  "platform_queue_jobs",
  "CNAME_DRIFT",
  "TXT_MISSING",
]) {
  reporter.assert(gatewayRoute.includes(fragment), `internal reconciler route missing ${fragment}`);
}

reporter.assert(gatewayIndex.includes("internalCustomDomainReconcileRouter"), "gateway must mount internal custom-domain reconciler");
reporter.assert(worker.includes("triggerCustomDomainReconciler"), "queue worker must trigger custom-domain reconciler");
reporter.assert(worker.includes("API_GATEWAY_SERVICE"), "queue worker must call gateway service binding");
reporter.assert(wrangler.includes("17 */6 * * *"), "queue worker must declare low-frequency custom-domain reconcile cron");
reporter.assert(singleWriter.includes("services/queue-workers/src"), "single-writer validator must inspect queue-workers");

reporter.finish("custom-domain reconciler is scheduled through queue-workers and writes through gateway");
