import {
  createReporter,
  listWorkspaceFiles,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("No orphan webhook-deliveries queue validator");

const sourceFiles = listWorkspaceFiles(["services", "packages", "scripts", "tests"])
  .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file));

for (const file of sourceFiles) {
  if (file === "scripts/validators/no-orphan-webhook-delivery-queue-validator.mjs") continue;
  const source = readFile(file);
  const writesWebhookDeliveryPlatformJob =
    /queue_name:\s*['"`]webhook-deliveries['"`]/.test(source)
    || /queueName:\s*['"`]webhook-deliveries['"`]/.test(source);

  reporter.assert(
    !writesWebhookDeliveryPlatformJob,
    `${file} must not enqueue webhook-deliveries through platform_queue_jobs; use webhook_deliveries dispatch`,
  );
}

reporter.finish(`${sourceFiles.length} source files checked`);
