import {
  createReporter,
  exists,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Cloudflare binding validator");

const manifestPath = "config/runtime/cloudflare-binding-ownership.json";
const schemaPath = "config/runtime/cloudflare-binding-ownership.schema.json";
const manifest = readJson(manifestPath);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function section(text, environment) {
  const marker = `[env.${environment}]`;
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const rest = text.slice(start);
  const next = rest.slice(marker.length).search(/\n\[env\.(staging|production)\]/);
  return next >= 0 ? rest.slice(0, marker.length + next) : rest;
}

function arrayTableBlocks(text, tableName) {
  const marker = `[[${tableName}]]`;
  const pattern = new RegExp(`^\\s*${escapeRegExp(marker)}\\s*$`, "gm");
  const starts = [...text.matchAll(pattern)].map((match) => match.index);
  return starts.map((start, index) => {
    const next = starts[index + 1];
    if (next !== undefined) return text.slice(start, next);
    const relativeEnd = text.slice(start + marker.length).search(/\n\[/);
    return relativeEnd >= 0 ? text.slice(start, start + marker.length + relativeEnd) : text.slice(start);
  });
}

function stringValue(block, key) {
  return block.match(new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*"([^"]+)"`, "m"))?.[1] || "";
}

function hasTable(text, tableName) {
  return new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*$`, "m").test(text);
}

function hasArrayTable(text, tableName) {
  return new RegExp(`^\\s*\\[\\[${escapeRegExp(tableName)}\\]\\]\\s*$`, "m").test(text);
}

reporter.assert(exists(manifestPath), `Missing Cloudflare binding ownership manifest: ${manifestPath}`);
reporter.assert(exists(schemaPath), `Missing Cloudflare binding ownership schema: ${schemaPath}`);
reporter.assert(manifest?.$schema === schemaPath, "Cloudflare binding ownership manifest must reference its checked-in schema");
reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Cloudflare binding ownership must not claim live evidence");

for (const key of ["vars", "kv_namespaces", "r2_buckets", "queues", "durable_objects", "services", "secrets"]) {
  reporter.assert(manifest?.nonInheritableKeys?.includes(key), `Cloudflare non-inheritable key must be governed: ${key}`);
}

for (const worker of manifest?.workers || []) {
  reporter.assert(exists(worker.config), `Missing Worker wrangler config: ${worker.config}`);
  const text = readFile(worker.config);
  const kycBucketNames = [];
  const publicBucketNames = [];

  for (const environment of ["staging", "production"]) {
    const expected = worker.environments?.[environment];
    const envSection = section(text, environment);
    reporter.assert(Boolean(expected), `Cloudflare binding manifest missing env: ${worker.runtimeRoot}/${environment}`);
    reporter.assert(envSection.length > 0, `Wrangler config missing env section: ${worker.config} ${environment}`);
    reporter.assert(envSection.includes(`name = "${expected?.workerName}"`), `Wrangler env must declare isolated Worker name: ${expected?.workerName}`);
    reporter.assert(hasTable(envSection, `env.${environment}.vars`), `Wrangler env must explicitly declare non-inheritable vars: ${worker.config} ${environment}`);

    for (const variable of expected?.vars || []) {
      reporter.assert(new RegExp(`^\\s*${escapeRegExp(variable)}\\s*=`, "m").test(envSection), `Wrangler env missing governed var ${variable}: ${worker.config} ${environment}`);
    }

    for (const secret of expected?.secrets || []) {
      reporter.assert(
        !new RegExp(`^\\s*${escapeRegExp(secret)}\\s*=`, "m").test(envSection),
        `Wrangler env must not commit governed secret ${secret} as a plaintext var: ${worker.config} ${environment}`,
      );
      reporter.assert(
        new RegExp(`wrangler secret put ${escapeRegExp(secret)}\\s+--env ${escapeRegExp(environment)}`).test(envSection),
        `Wrangler env missing governed secret provisioning command ${secret}: ${worker.config} ${environment}`,
      );
    }

    const producerBlocks = arrayTableBlocks(envSection, `env.${environment}.queues.producers`);
    for (const binding of expected?.queueProducers || []) {
      reporter.assert(
        producerBlocks.some((block) => stringValue(block, "binding") === binding),
        `Wrangler env missing queue producer binding ${binding}: ${worker.config} ${environment}`,
      );
    }
    reporter.assert(
      producerBlocks.length === (expected?.queueProducers || []).length,
      `Wrangler env queue producer count must match ownership manifest: ${worker.config} ${environment}`,
    );

    const consumerBlocks = arrayTableBlocks(envSection, `env.${environment}.queues.consumers`);
    for (const queueName of expected?.queueConsumers || []) {
      reporter.assert(
        consumerBlocks.some((block) => stringValue(block, "queue") === queueName),
        `Wrangler env missing queue consumer ${queueName}: ${worker.config} ${environment}`,
      );
    }
    reporter.assert(
      consumerBlocks.length === (expected?.queueConsumers || []).length,
      `Wrangler env queue consumer count must match ownership manifest: ${worker.config} ${environment}`,
    );

    const kvBlocks = arrayTableBlocks(envSection, `env.${environment}.kv_namespaces`);
    for (const binding of expected?.kvNamespaces || []) {
      reporter.assert(kvBlocks.some((block) => stringValue(block, "binding") === binding), `Wrangler env missing KV binding ${binding}: ${worker.config} ${environment}`);
    }
    reporter.assert(kvBlocks.length === (expected?.kvNamespaces || []).length, `Wrangler env KV binding count must match ownership manifest: ${worker.config} ${environment}`);

    const r2Blocks = arrayTableBlocks(envSection, `env.${environment}.r2_buckets`);
    for (const binding of expected?.r2Buckets || []) {
      reporter.assert(r2Blocks.some((block) => stringValue(block, "binding") === binding), `Wrangler env missing R2 binding ${binding}: ${worker.config} ${environment}`);
    }
    reporter.assert(r2Blocks.length === (expected?.r2Buckets || []).length, `Wrangler env R2 binding count must match ownership manifest: ${worker.config} ${environment}`);
    const kycBlock = r2Blocks.find((block) => stringValue(block, "binding") === "KYC_PRIVATE_BUCKET");
    const publicBlock = r2Blocks.find((block) => stringValue(block, "binding") === "R2_BUCKET");
    if (publicBlock) publicBucketNames.push(stringValue(publicBlock, "bucket_name"));
    if (kycBlock) {
      const privateName = stringValue(kycBlock, "bucket_name");
      const publicName = publicBlock ? stringValue(publicBlock, "bucket_name") : "";
      reporter.assert(Boolean(privateName && publicName && privateName !== publicName),
        `KYC private R2 bucket must name a different bucket from public media: ${worker.config} ${environment}`);
      kycBucketNames.push(privateName);
    }

    const d1Blocks = arrayTableBlocks(envSection, `env.${environment}.d1_databases`);
    for (const binding of expected?.d1Databases || []) {
      reporter.assert(d1Blocks.some((block) => stringValue(block, "binding") === binding), `Wrangler env missing D1 binding ${binding}: ${worker.config} ${environment}`);
    }
    reporter.assert(d1Blocks.length === (expected?.d1Databases || []).length, `Wrangler env D1 binding count must match ownership manifest: ${worker.config} ${environment}`);

    const durableObjectBlocks = arrayTableBlocks(envSection, `env.${environment}.durable_objects.bindings`);
    for (const binding of expected?.durableObjects || []) {
      reporter.assert(durableObjectBlocks.some((block) => stringValue(block, "name") === binding), `Wrangler env missing Durable Object binding ${binding}: ${worker.config} ${environment}`);
    }
    reporter.assert(durableObjectBlocks.length === (expected?.durableObjects || []).length, `Wrangler env Durable Object binding count must match ownership manifest: ${worker.config} ${environment}`);

    const serviceBlocks = arrayTableBlocks(envSection, `env.${environment}.services`);
    for (const binding of expected?.serviceBindings || []) {
      reporter.assert(serviceBlocks.some((block) => stringValue(block, "binding") === binding), `Wrangler env missing service binding ${binding}: ${worker.config} ${environment}`);
    }
    reporter.assert(serviceBlocks.length === (expected?.serviceBindings || []).length, `Wrangler env service binding count must match ownership manifest: ${worker.config} ${environment}`);

    const analyticsBlocks = arrayTableBlocks(envSection, `env.${environment}.analytics_engine_datasets`);
    for (const binding of expected?.analyticsEngineDatasets || []) {
      reporter.assert(analyticsBlocks.some((block) => stringValue(block, "binding") === binding), `Wrangler env missing Analytics Engine binding ${binding}: ${worker.config} ${environment}`);
    }
    reporter.assert(analyticsBlocks.length === (expected?.analyticsEngineDatasets || []).length, `Wrangler env Analytics Engine binding count must match ownership manifest: ${worker.config} ${environment}`);

    for (const telemetryTable of expected?.telemetry || []) {
      reporter.assert(hasTable(envSection, `env.${environment}.${telemetryTable}`), `Wrangler env missing telemetry table ${telemetryTable}: ${worker.config} ${environment}`);
    }

    if ((expected?.durableObjects || []).length === 0) {
      reporter.assert(!hasArrayTable(envSection, `env.${environment}.durable_objects.bindings`), `Wrangler env has unowned Durable Object bindings: ${worker.config} ${environment}`);
    }
    if ((expected?.serviceBindings || []).length === 0) {
      reporter.assert(!hasArrayTable(envSection, `env.${environment}.services`), `Wrangler env has unowned service bindings: ${worker.config} ${environment}`);
    }
  }
  if (kycBucketNames.length === 2) {
    reporter.assert(kycBucketNames[0] !== kycBucketNames[1],
      `KYC staging and production must use separate R2 buckets: ${worker.config}`);
  }
  for (const privateName of kycBucketNames) {
    reporter.assert(!publicBucketNames.includes(privateName),
      `KYC private R2 bucket must not reuse any public media bucket: ${worker.config}`);
  }
}

reporter.finish(`${manifest?.workers?.length || 0} Worker binding ownership manifests checked`);
