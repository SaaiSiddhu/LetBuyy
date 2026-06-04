# 🖥️ TERMINAL 6 — WS8 Mobile Parity (Flutter ↔ Web Cross‑App)

**Worktree:** `../lb-ws8`  ·  **Branch:** `stream/WS8-mobile`  ·  **Wave:** 4 (launch after WS1 tokens + WS7 real stack exist; safe to run isolated anytime)
**Owns ONLY:** `apps/mobile/merchant-app/**` · `packages/dart/**` (creates `packages/dart/api_client`)
**Never touches:** `services/**`, `database/**`, `packages/*-core/**`, `shared-types` (read-only), `packages/typescript/**` (read tokens only), other apps, governance
**Platforms:** Android **and** iOS — both must build + smoke (iOS device signing → `[SKIP — NEEDS HUMAN]`)

### Setup
```bash
git worktree add ../lb-ws8 -b stream/WS8-mobile   # (skip if already created)
cd ../lb-ws8 && pnpm install && (cd apps/mobile/merchant-app && flutter pub get)
# start Codex here, then paste the prompt below into /goal
```

### 📋 PASTE THIS INTO CODEX `/goal`
```
Read docs/Codex_waves/CODEX_MOBILE_PARITY_MISSION.md and LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md in full,
then execute M0→M8 continuously and autonomously, 24h+, never stopping while unblocked work remains.

OWN ONLY: apps/mobile/merchant-app/** and packages/dart/** (create packages/dart/api_client).
NEVER edit services/**, database/**, packages/*-core/**, shared-types (read-only), packages/typescript/** (read
tokens only), other apps, or governance. Backend data missing → [SKIP — NEEDS BACKEND] + placeholder screen.

Goal: make the Flutter merchant app an EXACT cross-app of the web admin — same identity (lb_session, delete Firebase
Auth), same /v1 gateway via a new typed dart api_client (no direct Supabase/Firestore in the app), same contracts
(dart models mirror shared-types + conformance test), same Supabase (remove hardcoded project + Firestore), same theme
engine (editor reads/writes /v1/themes + WebView of the real storefront preview, keep device frames). Then SAFELY DELETE
all legacy (Firebase auth/storage/analytics/functions, Firestore, embedded marketing landing, mock data, shopper-only
services) — confirm no live import, migrate, git rm, keep flutter analyze clean. Build the ~22 missing screens mirroring
the web's IA. Wire local/staging/production dart-define configs like the web (real keys [SKIP — NEEDS HUMAN]).

PROVE on BOTH platforms: flutter build apk AND flutter build ios --no-codesign succeed; smoke on an Android emulator
AND an iOS simulator with screenshots (iOS device signing → [SKIP — NEEDS HUMAN]). Keep flutter analyze clean,
flutter test green, and all 128 validators green at each gate; small reversible commits; 3 strikes → BLOCKED → next;
no fabrication (every DONE = command + result + screenshot). Mirror the web pattern per feature by reading
apps/merchant-control-plane/src/app/[store]/** (read-only). Maintain CODEX_MOBILE_PARITY_LEDGER.md. Begin with M0.1 now.
```

> **Note:** WS8 owns `packages/dart/**`. If you ever run a separate shopper-app stream, give it `apps/mobile/shopper-app/**` only and keep shared `packages/dart/**` owned by **one** agent at a time to avoid collision.
