CREATE TABLE IF NOT EXISTS provider_execution_evidence (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  provider TEXT NOT NULL CHECK (provider = 'cloudflare'),
  command TEXT NOT NULL,
  args_hash TEXT NOT NULL,
  exit_status INTEGER NOT NULL,
  stdout_hash TEXT NOT NULL,
  stderr_hash TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS d1_migration_lineage (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  database_name TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  migration_checksum TEXT NOT NULL,
  applied_at TEXT,
  provider_evidence_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (provider_evidence_id) REFERENCES provider_execution_evidence(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS d1_migration_lineage_environment_name_idx
  ON d1_migration_lineage(environment, migration_name);

CREATE TABLE IF NOT EXISTS replay_restoration_lineage (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  replay_cursor TEXT NOT NULL,
  source_checksum TEXT NOT NULL,
  restored_checksum TEXT NOT NULL,
  divergence_detected INTEGER NOT NULL DEFAULT 0 CHECK (divergence_detected IN (0, 1)),
  provider_evidence_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (provider_evidence_id) REFERENCES provider_execution_evidence(id)
);

CREATE TABLE IF NOT EXISTS rollback_lineage (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  worker_name TEXT NOT NULL,
  from_version_id TEXT NOT NULL,
  to_version_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  replay_validation_hash TEXT NOT NULL,
  queue_validation_hash TEXT NOT NULL,
  provider_evidence_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (provider_evidence_id) REFERENCES provider_execution_evidence(id)
);
