# 26 — Documentation Manifest

> **Date:** 2026-08-05 · **Documents:** 27 Markdown files · **Location:** `docs/theme-system-current-state/`
> **Artifact:** `artifacts/letbuyy-theme-system-current-state.zip`
>
> Checksums below are SHA-256 of each file as packaged. `26-documentation-manifest.md` cannot list its own
> checksum (writing it changes it) — verify it against the value printed by the packaging run.

---

## 1. Reading order

| Audience | Path through the set |
|---|---|
| **Executive / ARB** | `00` → `17` → `23` → `24` |
| **Engineer joining the theme system** | `01` → `02` → `05` → `03` → `07` → `06` |
| **Reviewing what changed here** | `16` → `19` → `21` → `20` |
| **Planning next work** | `15` → `25` → `22` |
| **Auditing a claim** | `18` (source index) → the cited `path:line` |

---

## 2. File inventory with checksums

### Discovery — current state as found

| File | Lines | Bytes | SHA-256 |
|---|---|---|---|
| `01-governance-and-invariants.md` | 247 | 15 400 | `92111268ab71590b352a69adad0b563a00c22638bf830fcab0478ffa777d3f99` |
| `02-runtime-and-route-map.md` | 344 | 31 891 | `a6576fa9d34ed62ad6153ebebdd898ba52c8e160b3126e6173175cb60a330a1b` |
| `03-theme-data-model.md` | 376 | 34 885 | `92f3f6bf490870cea3fe4e1d565ecb63c3e37a8d057d238549f581d9435502a7` |
| `04-theme-installation-lifecycle.md` | 447 | 30 322 | `fa4ae844c9aa97e014b00cff181737d35c71cdfb9547ad7d56e14d48b1ef41ba` |
| `05-rendering-pipeline.md` | 558 | 35 883 | `8813e78336488ffa7c7cd4e738e528b6fb9791863b4477dcdff1a489790f2d0a` |
| `06-react-liquid-parity-matrix.md` | 372 | 27 852 | `8ad3a8b6ab4c27369d3ea16f9ce146d1f03df6e7c5838fd203b7861b7f77a141` |
| `07-letbuyy-core-current-state.md` | 390 | 28 394 | `f936ac783aac91c19e174bf65d9e19fe8b8f38cfead4ef8ba940393b079d7d06` |
| `08-presets-and-industry-map.md` | 345 | 22 580 | `3a6be8db3e217165b15282e2ee3c484cb2bd4634441b76adc0096560651fd436` |
| `09-settings-schema-and-editor.md` | 469 | 27 662 | `71a8f764f7809553879bac3014d9c6d543e041a3550e9c6ab45af8c48a8ca6d7` |
| `10-shopper-auth-and-account-flows.md` | 440 | 36 721 | `7ea54a3900f2bd8eb2591e99694bc28edc1149abbed58790439a5ac3f65905c5` |
| `11-cart-and-checkout-boundary.md` | 359 | 29 042 | `b356f01b8d06bb5da483fb2419d26e8f02f66db03d8770e9dfb9e99a4c6f622c` |
| `12-payments-cod-razorpay-gst.md` | 395 | 34 925 | `e53cad65e01cbdbd0f8e7b8fbe431abe1ca356845783204ccb4760d9f7e99151` |
| `13-security-and-tenant-isolation.md` | 955 | 61 356 | `a713537dcb2d4d8719bc6cc0c20a3182d2ca6263d894ba14e1e785aceab3aa4b` |

### Baseline, gaps and decisions

| File | Lines | Bytes | SHA-256 |
|---|---|---|---|
| `14-test-build-governance-baseline.md` | 268 | 16 668 | `813eb2e1000d5f4e637051073afc550c9f05a67ee40b5591b4a9868e271efcc2` |
| `15-gap-register-and-priorities.md` | 502 | 110 528 | `176d824d082153e465ef39fa38eec409c1e09feaee545a9c4a8fab647594e573` |
| `16-implementation-plan.md` | 175 | 10 928 | `f4765af6a349a9ebf9c60f5b7a080010b5b9909ae179a51c42e3e6aa10bfc75e` |
| `17-open-decisions-and-arb-gates.md` | 841 | 78 979 | `d10500d94869cf0967b935392d8ec61c9ce3dedbee6ae867deb62eb746d96dfb` |
| `18-source-index.md` | 780 | 82 906 | `1e321b89d195f29e0655e1620c89ae6f3787144437d37000fa0ccd09800bf770` |

### Final state after implementation

| File | Lines | Bytes | SHA-256 |
|---|---|---|---|
| `00-executive-summary.md` | 134 | 8 876 | `6d16c0b16104a9aa365b81ee83fc9c836a672a32ad20eb587043c06509088fee` |
| `19-implementation-change-log.md` | 118 | 9 926 | `d9788930d611a50459b28d807ca9568160c79e3fc3720d06e14c2b7d6ee3b236` |
| `20-final-feature-matrix.md` | 132 | 10 150 | `9376ba0a81c22fa93f2478c7711a1a363d3cd7320b1de9fc17efc4ee0a5c4033` |
| `21-final-test-evidence.md` | 181 | 12 704 | `705247b10867da4a8b158efe2932302f8e3f6760334a666d44f5697b9febeb09` |
| `22-preset-certification-matrix.md` | 92 | 7 307 | `b86bc9d5451648c1030419ac87f00d890ef197e7e2cc51c826d8aca8fab73cc7` |
| `23-rollout-and-rollback-runbook.md` | 162 | 8 928 | `d8780a0d91bb4e33658321195aff5665627cc4b9bd5f86109e2a3e17d88b0a37` |
| `24-known-limitations.md` | 168 | 10 944 | `ed340e3eab225f3651da9a66455462de3285a2cb1f01045a293b31685c683604` |
| `25-follow-up-backlog.md` | 173 | 11 212 | `e372fb188cd5b1534e34a2f260109d2fd730de337e097b76cd116a0365b921f1` |
| `26-documentation-manifest.md` | *(this file)* | — | *self-referential — see packaging output* |

**27 files.** Numbers `00`–`26` are present with no gaps.

---

## 3. Exclusions — what is deliberately NOT in the archive

| Excluded | Reason |
|---|---|
| Source code | Documentation artifact only; source lives in the repository |
| Screenshots / images | None were produced — no browser session was run |
| `.env` files, secrets, credentials | Never packaged. The packaging script scans for secret-shaped content and aborts on a hit |
| Database dumps | The 12.8 MB pre-reset `pg_dump` stays in the session scratchpad |
| `node_modules`, build output | Not documentation |
| Customer data | None exists — the local database has one test site |
| Logs | Validator and test logs stay in the scratchpad; their *results* are transcribed into `21` |

The archive contains **only** `*.md` files from `docs/theme-system-current-state/`, with relative paths
preserved.

---

## 4. Integrity verification

```bash
shasum -a 256 -c artifacts/letbuyy-theme-system-current-state.zip.sha256
unzip -t artifacts/letbuyy-theme-system-current-state.zip
unzip -Z1 artifacts/letbuyy-theme-system-current-state.zip | sort
```

Per-document verification:

```bash
cd docs/theme-system-current-state && shasum -a 256 *.md
```

---

## 5. Git tracking

`artifacts/` is **not** globally ignored — only specific subdirectories are
(`artifacts/live-certification/`, `artifacts/local-operational-proof/`,
`artifacts/operational-certification/`, `artifacts/production-certification/`).

The ZIP is therefore **untracked but not ignored**, and was deliberately left that way. **No ignore rule
was modified to force it into or out of Git**, and nothing was committed.

---

## 6. Provenance

- **Repository:** `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store`
- **Branch:** `stepup/main` · **Baseline HEAD:** `bf35062e`
- **Working tree:** user-owned and preserved — 6 784 modified (6 063 mode-only), 721 real content
  changes, 11 untracked, all stamped before this engagement began
- **Method:** read-only discovery (14 agents) → documentation → ARB-authorized implementation, each round
  closed by an adversarial reviewer that failed the work twice before passing
- **Evidence standard:** every material claim carries a `path:line`, a SQL result, or a command with its
  exit code. Unproven items are marked `inferred` or `unresolved` and never upgraded silently
