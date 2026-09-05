#!/usr/bin/env bash
# surface.sh — classify changed files into review lanes. Deterministic; the router must not "judge" this.
# Usage: bash .claude/skills/letbuyy/scripts/surface.sh [<base>] [<head>]     (defaults: develop..HEAD)
#        bash .claude/skills/letbuyy/scripts/surface.sh --files <path-list-file>   (one path per line, e.g. a contract's may_write)
# Output: one line per file "<lane[,lane]>\t<path>" then "LANES: <space-separated>" (empty → LANES: none).
# Lanes: security · db · money · mobile · uiux · uiux-hold (donor/marketing, D-UIUX) · feedback · theme · ci · governance · docs
#        · frozen (a change in a FROZEN app is a finding) · reserved (a change in a RESERVED root is BLOCKING)
set -uo pipefail
if [ "${1:-}" = "--files" ]; then FILES="$(cat "$2")"; else
  BASE="${1:-develop}"; HEAD="${2:-HEAD}"; FILES="$(git diff --name-only "$BASE".."$HEAD" 2>/dev/null || git diff --name-only "$BASE" "$HEAD")"; fi
LANES=""   # bash 3.2 on macOS: no associative arrays
lane() { case " $LANES " in *" $1 "*) ;; *) LANES="$LANES $1";; esac; }
while IFS= read -r f; do [ -z "$f" ] && continue; out=""
  case "$f" in
    services/api-gateway/src/index.ts|services/api-gateway/src/middleware/*|services/api-gateway/src/lib/*|services/api-gateway/src/routes/*|\
    services/api-gateway/src/tenant/*|services/api-gateway/src/identity-foundation/*|services/api-gateway/wrangler.toml|\
    services/webhook-service/*|services/queue-workers/*|services/mobile-bff/*|services/compatibility/*|*/wrangler.toml|\
    apps/identity-platform/src/lib/*|apps/identity-platform/src/app/api/*|apps/*/src/middleware.ts|apps/*/src/proxy.ts|apps/*/src/app/api/*|\
    apps/*/src/lib/*auth*|apps/*/src/lib/*session*|apps/*/src/lib/*cookie*|apps/*/src/lib/*csp*|apps/*/src/lib/*tenant*|\
    packages/tenant-core/*|packages/session-core/*|packages/token-core/*|packages/identity-core/*|packages/auth-core/*|packages/permission-core/*|\
    packages/payments/*|packages/billing-core/*|packages/checkout-core/*|packages/infrastructure/*|packages/theme-engine/src/*sanit*|\
    database/*|scripts/validators/*|scripts/governance/*|scripts/generators/*|.github/*|config/env/*|config/governance/*|config/runtime/*|config/security/*|infrastructure/*|\
    apps/*/android/*|apps/*/ios/*|apps/*/lib/*config*|packages/dart/*/lib/*config*|pubspec.yaml|\
    pnpm-lock.yaml|package.json|pnpm-workspace.yaml|.gitignore)
      out="security"; lane security;;
  esac
  case "$f" in
    database/supabase/*|services/api-gateway/src/tenant/tenant-tables.registry.ts) out="${out:+$out,}db"; lane db;;
  esac
  case "$f" in
    services/api-gateway/src/routes/*payment*|services/api-gateway/src/routes/*payout*|services/api-gateway/src/routes/*refund*|services/api-gateway/src/routes/*checkout*|\
    services/api-gateway/src/routes/*gift*|services/api-gateway/src/routes/*commission*|services/api-gateway/src/routes/*settlement*|services/api-gateway/src/routes/*billing*|\
    services/api-gateway/src/routes/*invoice*|services/api-gateway/src/routes/*gst*|packages/payments/*|packages/billing-core/*|packages/checkout-core/*|\
    database/supabase/migrations/*ledger*|database/supabase/migrations/*payment*|database/supabase/migrations/*refund*|database/supabase/migrations/*payout*|\
    database/supabase/migrations/*gift_card*|database/supabase/migrations/*checkout*|database/supabase/migrations/*gst*|database/supabase/migrations/*commission*)
      out="${out:+$out,}money"; lane money;;
  esac
  case "$f" in
    apps/customer_app/*|apps/merchant_app/*|apps/phase_2/*|packages/dart/*|pubspec.yaml|*.dart) out="${out:+$out,}mobile"; lane mobile;;
  esac
  case "$f" in
    apps/customer_app/*|apps/phase_2/*|apps/marketing-site/*|apps/app-marketplace/*|apps/developer-portal/*|apps/theme-marketplace/*|apps/platform-operations-portal/*)
      case "$f" in *.tsx|*.css|*.dart|*.arb) out="${out:+$out,}uiux-hold"; lane uiux-hold;; esac;;
    packages/typescript/ui/*|packages/dart/ui_kit/*|apps/*/src/app/*.tsx|apps/*/src/components/*|apps/*/src/features/*|apps/*/src/*.css|apps/*/tailwind.config.*|\
    apps/merchant_app/lib/*.dart|scripts/generators/generate-design-tokens.mjs|scripts/generators/generate-mobile-tokens.mjs|scripts/validators/validate-design-system.mjs|scripts/validators/design-system-baseline.json)
      out="${out:+$out,}uiux"; lane uiux;;
  esac
  case "$f" in
    *.tsx|*.dart|*.arb|packages/typescript/ui/src/feedback.tsx|packages/typescript/ui/src/input.tsx|packages/typescript/ui/src/overlays.tsx)
      case "$f" in *.test.tsx|*.stories.tsx|*_test.dart|*/test/*) ;; *) out="${out:+$out,}feedback"; lane feedback;; esac;;
  esac
  case "$f" in
    packages/theme-engine/*|apps/customer_web/src/*theme*|apps/customer_web/src/*liquid*|apps/customer_web/src/*render*) out="${out:+$out,}theme"; lane theme;;
  esac
  case "$f" in
    .github/*|turbo.json|tsconfig*.json|scripts/validate-governance.mjs|scripts/validators/*|scripts/governance/*) out="${out:+$out,}ci"; lane ci;;
  esac
  case "$f" in
    AGENTS.md|CLAUDE.md|GOVERNANCE_REWRITE_2026_06_10/*|EXECUTION_LEDGER.md|SKIPPED_HUMAN_DECISIONS.md|CAPABILITY_BACKLOG.md|EXECUTABLE_HUMAN_REQUIRED.md|PROMPTS.md|MERGE_RUNBOOK.md|\
    docs/active/*|docs/governance/*|*/AGENTS.md|*/runtime.manifest.json|.claude/skills/*|config/governance/*) out="${out:+$out,}governance"; lane governance;;
  esac
  case "$f" in
    apps/app-marketplace/*|apps/developer-portal/*|apps/theme-marketplace/*|apps/platform-operations-portal/*) out="${out:+$out,}frozen"; lane frozen;;
  esac
  case "$f" in
    services/checkout-runtime/*|services/event-bus/*|services/notification-service/*|services/analytics-pipeline/*|services/media-service/*|services/search-service/*|apps/mobile/*|\
    apps/admin_app/*)
      # "Gained source" means source is there AFTER the change. A diff that DELETES
      # source from a reserved root is the rule being satisfied, not broken — and it
      # is exactly what phase FB-1 did to apps/admin_app, which is how this was
      # found. Classify by path, then confirm the file still exists before flagging.
      case "$f" in */runtime.manifest.json|*/AGENTS.md) ;; *) if [ -e "$f" ]; then out="${out:+$out,}reserved"; lane reserved; fi;; esac;;
  esac
  case "$f" in
    docs/*|*.md) out="${out:+$out,}docs"; lane docs;;
  esac
  printf '%s\t%s\n' "${out:-none}" "$f"
done <<< "$FILES"
echo "LANES:${LANES:- none}"
case " $LANES " in *" reserved "*) echo "BLOCKING: a RESERVED root gained source (Constitution: reserved roots stay manifest-only)";; esac
