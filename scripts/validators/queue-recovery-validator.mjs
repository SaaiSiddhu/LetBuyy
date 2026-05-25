import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Queue recovery validator");

const manifest = readJson("config/runtime/runtime-orchestration-manifest.json");
const recovery = manifest?.queueRecovery || {};
const lifecycle = readJson(recovery.lifecycleManifest || "config/runtime/queue-lifecycle-manifest.json");

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Queue recovery must not claim live evidence");
reporter.assert(recovery.engineSource === "packages/distributed-runtime/src/queue-recovery-orchestration-runtime.ts", "Queue recovery must use package-owned engine");
reporter.assert(recovery.lifecycleManifest === "config/runtime/queue-lifecycle-manifest.json", "Queue recovery must bind queue lifecycle manifest");
reporter.assert(recovery.deadLetterPolicy === lifecycle?.deadLetterQueue?.redrivePolicy, "Queue recovery dead-letter policy must match lifecycle manifest");
reporter.assert(recovery.retryPolicy === "deterministic-retry-sequencing-from-manifest", "Queue recovery must use deterministic retry sequencing");

const source = readFile(recovery.engineSource || "");
for (const fragment of [
  "planQueueRecoveryOrchestration",
  "quarantine-poison",
  "operator-redrive-review",
  "reconcile-retries",
  "queue recovery state is within policy",
]) {
  reporter.assert(source.includes(fragment), `Queue recovery engine missing fragment: ${fragment}`);
}

for (const action of ["none", "reconcile-retries", "quarantine-poison", "operator-redrive-review"]) {
  reporter.assert((recovery.requiredActions || []).includes(action), `Queue recovery missing action: ${action}`);
}

const productionQueues = new Set((lifecycle?.queues || []).map((queue) => queue.names?.production));
for (const policy of recovery.policies || []) {
  reporter.assert(productionQueues.has(policy.queueName), `Queue recovery policy references unknown production queue: ${policy.queueName}`);
  reporter.assert(policy.maxPoisonMessages === 0, `Queue recovery must quarantine any poison messages: ${policy.queueName}`);
  reporter.assert(policy.maxRetrying > 0, `Queue recovery retry threshold must be explicit: ${policy.queueName}`);
  reporter.assert(policy.maxDeadLetteredBeforeQuarantine > 0, `Queue recovery DLQ threshold must be explicit: ${policy.queueName}`);
}

reporter.assert((recovery.policies || []).length === productionQueues.size, "Queue recovery policies must cover every production queue");

reporter.finish(`${recovery.policies?.length || 0} queue recovery policies checked`);
