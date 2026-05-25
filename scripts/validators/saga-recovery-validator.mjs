import {
  createReporter,
  readFile,
  readJson,
} from "./governance-common.mjs";

const reporter = createReporter("Saga recovery validator");

const manifest = readJson("config/runtime/durable-execution-contract.json");
const saga = manifest?.sagaRecovery || {};

reporter.assert(manifest?.mode === "governance-contract-not-live-evidence", "Saga recovery must not claim live evidence");
reporter.assert(manifest?.failurePolicy === "fail-closed", "Saga recovery must fail closed");
reporter.assert(saga.engineSource === "packages/distributed-runtime/src/saga-recovery-runtime.ts", "Saga recovery engine must live in distributed-runtime");
reporter.assert(saga.baseCompensationEngine === "packages/distributed-runtime/src/compensation-saga-runtime.ts", "Saga recovery must build on compensation engine");
reporter.assert(saga.walAppender === "appendSagaWalEntry", "Saga recovery must name compensation WAL appender");
reporter.assert(saga.recoveryFunction === "recoverPersistentSaga", "Saga recovery must name recovery function");
reporter.assert(saga.assertionFunction === "assertSagaRecoverySafe", "Saga recovery must name assertion");
reporter.assert(saga.compensationWalPolicy === "append-only-compensation-wal", "Saga compensation WAL must be append-only");
reporter.assert(saga.irreversibleOperationRegistry === "irreversibleOperationIds-in-checkpoint", "Saga recovery must track irreversible operations");
reporter.assert(saga.resumptionPolicy === "remaining-steps-derived-from-compensation-wal", "Saga resumption must derive from WAL");

const source = readFile(saga.engineSource || "");
for (const fragment of [
  "appendSagaWalEntry",
  "recoverPersistentSaga",
  "assertSagaRecoverySafe",
  "Compensation replay unsafe",
  "irreversibleOperationIds",
  "remainingSteps",
]) {
  reporter.assert(source.includes(fragment), `Saga recovery source missing fragment: ${fragment}`);
}

reporter.finish("persistent saga recovery, compensation WAL, and irreversible registry checked");
