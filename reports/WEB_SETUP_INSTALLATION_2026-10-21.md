# Web development installation — 21 October 2026

Scope: web applications, Workers/API, local database/Supabase and Chromium testing. Mobile SDKs and optional LCIS infrastructure excluded. No hosted deployment or cloud migration performed.

## Installed and verified

| Component | Result |
|---|---|
| Apple Command Line Tools | Installed at `/Library/Developer/CommandLineTools`; system Git `2.54.0`, Python `3.9.6` work |
| Node | Checksum-verified official arm64 Node `22.23.3` |
| pnpm | Repository-pinned `10.6.2`, installed in a separate user toolchain |
| Workspace dependencies | `pnpm install --frozen-lockfile` succeeded; no tracked manifest/lockfile changes |
| Worker tooling | Workspace Wrangler `4.100.0`; native workerd installation completed |
| Docker Desktop | Official arm64 application installed and signature verified; Desktop `4.96.0`, engine `29.9.1`, Compose `5.6.0`; daemon works |
| Supabase CLI | Existing `2.121.0` verified |
| Chromium | Playwright `1.60.0` matching Chromium/headless shell and supporting binaries installed |
| Local environment files | Repository generator created 13 missing, git-ignored files without `--force`; existing values were not overwritten |
| LetBuyy skill | Installed earlier; context probe now also runs through system Git/Python |

## Verification

- Marketing app and API gateway TypeScript checks passed.
- Marketing Next dev server started at `http://localhost:9006`; Chromium navigated through `/in`, received HTTP 200, the expected LetBuyy title and nonempty rendered page text.
- API gateway started with local Wrangler/workerd at `http://localhost:9010`; `/health` returned `status: healthy`. Its response labels the configured environment `staging`; this was a **local** process, not a hosted deployment.
- Checkout-idempotency contract smoke: 3 passed, 0 failed.
- Repository PostgreSQL fixture started successfully: `letbuyy-executable-pg`, database `letbuyy_executable`, image `postgres:16-alpine`. Fixture startup is not full database/security-suite acceptance.

## Shell configuration

Toolchains live under `/Users/saai_mithra/.local/share/letbuyy/toolchains/`. `.zprofile` and `.zshrc` source `/Users/saai_mithra/.local/share/letbuyy/web-env.sh`, which puts Node 22, pinned pnpm and Docker CLI first. Existing global Node 24 and pnpm 11 were preserved. Original shell file copies are beside that environment script as `.zprofile.before-web-setup` and `.zshrc.before-web-setup`.

In an already-open terminal, run:

```sh
source /Users/saai_mithra/.local/share/letbuyy/web-env.sh
node --version
pnpm --version
docker info
```

Normal interactive zsh was checked and resolves Node `22.23.3` and pnpm `10.6.2`. Agent tool processes may supply their own PATH, so explicit sourcing remains useful there.

## Local Supabase schema blocker

All required service images downloaded successfully, including the exact PostgREST `v16.2` fixture image and CLI-selected `v16.4` service image. The initial ECR 429 was retried successfully. Docker reports 13 images using about **9.1 GB** (logical image accounting, distinct from sparse VM physical disk allocation).

`supabase start --workdir database` initialized a fresh local PostgreSQL 17 instance and replayed migrations until **347**, then failed with:

```
ERROR: permission denied to set parameter "letbuyy.subscription_checkout_version"
SQLSTATE 42501
```

The failing statement is the function-level `SET letbuyy.subscription_checkout_version='347'` on `claim_merchant_subscription_checkout_v1` in `database/supabase/migrations/347_free_subscription_checkout_receipts.sql:7`. The CLI stopped its containers after failure. The full application schema and Supabase service readiness are therefore **not verified/ready**.

An isolated, unexposed container using the same PostgreSQL image confirmed that its `postgres` role is not a superuser and that creating a simple function with a fresh `SET letbuyy.setup_probe` attribute is denied. Setting the custom parameter in-session first did not fix function creation. This is concrete fresh-install compatibility evidence; it does not establish a production defect or authorize broader permissions. No canonical migration, role privilege, function security mode or security guard was altered to bypass the failure. The project needs a reviewed migration/bootstrap compatibility correction before full fresh-stack startup can pass.

The probe was removed with its task-owned disposable volume. The PostgreSQL fixture was stopped but retained for reuse. Marketing/API smoke servers were stopped after verification; Docker Desktop remains available. No deployment or real external transaction occurred.

Detailed setup logs remain local under `/tmp/letbuyy-web-setup`. Supabase logs/status can contain local credentials and must not be published. The official Docker installer and Node archive also remain there; removing only these downloaded installers later is optional once setup is accepted.

## Measured storage so far

- Apple developer tools: about 1.3 GiB.
- Docker application: about 2.2 GiB, excluding VM/images/data.
- Root `node_modules`: about 913 MiB; pnpm store about 892 MiB. Shared/hardlinked bytes should not be naively summed as unique usage.
- Playwright browser cache: about 534 MiB.
- LetBuyy user toolchains: about 209 MiB.

These are observations during setup, not the final full-stack disk total. Build caches, container images and database data continue to grow as their workflows run.

Final installation verdict: web tools, locked workspace dependencies, browser and all database service images installed and verified at the levels above. Full LetBuyy local database initialization remains blocked at migration 347. Homebrew, extra editors, standalone modern Python, mobile SDKs and optional intelligence servers were not needed for this web toolchain and were not installed.

## Subsequent repair

The initial blocker documented above was resolved for a separately owned local development stack. See [local backend repair](LOCAL_BACKEND_REPAIR_2026-10-21.md) for controlled migration preparation, preserved guards, running services and verified console sign-in. The original one-command migration path was not relabelled production-compatible.
