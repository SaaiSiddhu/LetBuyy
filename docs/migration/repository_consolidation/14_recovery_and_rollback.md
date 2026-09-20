# 14 — Recovery and Rollback

## If Systems A or B need to be restored from disk

Everything needed lives outside this repository at `~/LetBuyy-history-preservation-2026-08-29/`:

| Artifact | File | SHA-256 |
|---|---|---|
| System A full history (all branches/tags/remote-tracking) | `system-A-letbuyy.bundle` (112 MB) | `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358` |
| System B full history | `system-B-agrimore.bundle` (112 MB) | `2ed6cb3a845f24f719211729e4e94cd9c2cea99b96c4159aaaa22b02ce204b66` |
| System A uncommitted tracked-file diff | `system-A-unstaged.patch` (4714 lines) | — |
| System B uncommitted tracked-file diff | `system-B-unstaged.patch` (5282 lines) | — |
| System A untracked files | `system-A-untracked.txt` (file list; content is the nested System-B repo, captured separately) | — |
| System B untracked files (242/242) | `system-B-untracked/` directory + `system-B-untracked.txt` | — |
| System A gitignored signing configs | `system-A-gitignored-signing-files/{marketplace,admin}-key.properties` | — |

### Restoring System A

```bash
git clone ~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle /path/to/restore/Ecommerce/LetBuyy
cd /path/to/restore/Ecommerce/LetBuyy
git checkout be716ae18b5f1e25e1266f963ab5c0907928db26
git apply ~/LetBuyy-history-preservation-2026-08-29/system-A-unstaged.patch
# untracked files: copy system-A-untracked/ content back if needed (mostly the
# nested Agrimore repo itself — restore System B separately instead, below)
cp -p ~/LetBuyy-history-preservation-2026-08-29/system-A-gitignored-signing-files/marketplace-key.properties apps/marketplace/android/key.properties
cp -p ~/LetBuyy-history-preservation-2026-08-29/system-A-gitignored-signing-files/admin-key.properties apps/admin/android/key.properties
```

### Restoring System B

```bash
git clone ~/LetBuyy-history-preservation-2026-08-29/system-B-agrimore.bundle /path/to/restore/Ecommerce/LetBuyy/Agrimore
cd /path/to/restore/Ecommerce/LetBuyy/Agrimore
git checkout 20548b8938e2baa9c85b1e8f4ecc1f701999e331
git apply ~/LetBuyy-history-preservation-2026-08-29/system-B-unstaged.patch
rsync -a ~/LetBuyy-history-preservation-2026-08-29/system-B-untracked/ .
```

**Proven, not assumed:** Stage 1's own verification reconstructed a mode-flip-only tracked file, a real-content tracked diff, a genuine deletion (via `git show <blob-sha>`), and an untracked file this way, in `/tmp`, and confirmed byte-for-byte SHA-256 matches against the live working tree before anything was deleted. See the journal's S1 entry for the exact commands and hashes.

**Release keystores** (separate from the above, rescued earlier in this engagement): `~/LetBuyy-signing-recovery-2026-08-29/` — `key.jks`, `key-1.jks` (byte-identical to `key.jks`), `legacy-archive-marketplace-key.jks`, `marketplace-app-key.jks` (3 distinct keystores), plus `admin-key.properties`, `marketplace-key.properties`.

**Credential-containment originals** (the pre-`--dart-define` versions of the Razorpay/Gemini config files, from Phases 0.5–0.7): `~/LetBuyy-credential-evidence-2026-08-29/` — 7 files.

## Rolling back this phase's own commits (within System C)

The branch `feature/claude-md-durable-architecture-memory` is entirely local relative to `main` — nothing from this phase was pushed. Every commit is a normal, revertable git commit; `git mv`-based renames were verified `R100` (clean renames, not delete+add) at every step, so `git revert` on any of them produces a clean inverse rename.

- **To undo everything from this phase in one step (local only, not yet pushed):** `git reset --soft <SHA before cbbf030d's next commit>` restores the working tree and index to the pre-Phase-M state, with zero data loss — the same tool used mid-phase to correct two real mistakes (see the journal's S3/S6 entries). This does **not** restore `Ecommerce/LetBuyy`/`Agrimore` to disk (that requires the bundle restoration above) but does undo every commit this phase made to the canonical repository itself.
- **To undo a specific stage's changes only:** each stage has its own checkpoint commit(s), listed in the journal's stage table with their SHAs — `git revert <sha>` (or a range) targets exactly one stage.
- **If this phase's commits have already been pushed by the time a rollback is needed:** do not force-push or rewrite history. Use `git revert` (forward-fixing commits) instead, exactly as this journal's own hazard-avoidance discipline required throughout the phase.

## What recovery does NOT cover

Restoring the bundles brings back the source code and commit history. It does **not** re-rotate any credential (rotation was never attempted this phase, per the standing prohibition) and does not restore any external state (a DNS record, a deployed Worker, a Play Store listing) — none of those were touched by this phase at all.
