# Firebase Functions Legacy Governance

Purpose: Deprecated Firebase Cloud Functions package retained for migration reference.

Boundary: `legacy/firebase/functions`.

Status: Deprecated. Do not deploy as part of active LetBuyy production operations without an explicit migration plan.

Rules:

- No active app, service, or package may import this package.
- Do not add new business logic here.
- Generated `lib/`, `.tsbuildinfo`, emulator output, and Firebase credential files must stay ignored.
- Any retained behavior needed by the platform must be reimplemented under governed service roots and covered by validators.

