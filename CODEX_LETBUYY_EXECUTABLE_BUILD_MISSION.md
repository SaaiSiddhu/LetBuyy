# Codex Mission - LetBuyy Executable Architecture V1

This file is the active root mission artifact for the 2026-06-08 local executable architecture run.

Source of truth:

- Architecture: `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`.
- Invocation mission: the user-provided "CODEX MISSION - LetBuyy Executable Architecture V1: Whole-Platform, Foundation-First, Single Local Run" prompt in the current Codex thread.
- Governance: root `AGENTS.md`, local `AGENTS.md`, `CLAUDE.md`, `memory/lessons.md`, `tasks/todo.md`, and `docs/governance/*`.

Locked run rules:

- Execute V1-approved tasks `001` through `016` in dependency order.
- Start with the deepest implementation of `001-foundation`; do not start downstream tasks until the foundation proof gate is green.
- Use mock mode for every external provider by default.
- Treat live provider keys, DNS/cert changes, production migrations/deploys, legal sign-off, and real cloud actions as `[HUMAN-REQUIRED]`.
- Keep reserved service roots inactive.
- Do not build V1-rejected systems: service mesh decomposition, standalone event bus, schema registry, general saga engine, event sourcing/CQRS, analytics/media/notification service activation, fraud ML, full WhatsApp commerce, AI model wiring, reseller network, new partitioning, self-custody, or GMV rake.
- Preserve `site_id -> public.sites` tenant authority; never create a `stores` table.
- Maintain the run ledger, status, report, human-required registry, audit, gap analysis, build plan, and `tasks/executable/*` files.

Current migration reality:

- The invocation text says new migrations begin at `138`, but the dirty worktree contains `database/supabase/migrations/138_mobile_store_metafields.sql`.
- To avoid duplicate prefixes in this worktree, new migrations from this run should start at `139_*` unless that user-owned file is removed by its owner.
