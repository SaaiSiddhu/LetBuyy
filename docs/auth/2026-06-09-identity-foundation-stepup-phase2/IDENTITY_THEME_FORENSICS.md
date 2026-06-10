# IDENTITY THEME FORENSICS
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · measured against CURRENT tree

## Verdict
Theming infrastructure is **real and correct**, and a recent fix removed the only *broken* token. The remaining work is **leakage cleanup**, not repair. **Can the Identity Platform operate from one token source of truth? — YES, with no architectural blocker;** the path is removing ~16 hand-maintained color escapes in the shadow stylesheet (all ride along with the Wave-2 conversion).

## Infrastructure (verified)
| Element | Evidence | Status |
|---|---|---|
| Pre-paint theme | `app/layout.tsx:98` `<ThemeScript />` | ✅ |
| Provider | `app/layout.tsx:106` `<LetbuyyThemeProvider surface="identity">` | ✅ |
| Switching | `lib/useAuthTheme.ts:26` routes through `useTheme().setTheme` (not a raw `.dark` hack), with hydration guard (`:27-31`) | ✅ |
| Persistence | handled by `ThemeScript`/provider (caches resolved theme pre-paint); no ad-hoc `localStorage` in the app | ✅ |
| Canonical tokens | `globals.css:2` imports `config/tailwind/letbuyy-tokens.css` (`--lb-color-*`) | ✅ |

## Token health (measured)
- **Defined custom properties in `globals.css`: 20.** **Distinct `var(--X)` referenced: 38.**
- **Reachable undefined tokens: 0.** The diff of referenced-minus-defined yields only `--font-letbuyy-display/-mono/-sans`, which are **injected at runtime by `next/font`** (not static-undefined). **The previously-broken `--purple` (consumed at `globals.css:216,531`) is now defined** (`globals.css:14-17`, mapped to the theme-aware `--primary`) — confirmed it no longer appears in the undefined set.
- **Duplicate / parallel namespace:** the app defines its OWN `--bg`, `--text-primary`, `--text-secondary`, `--text-hint`, `--border`, `--input-bg` (`globals.css:20-28`) **separately** from the canonical `--lb-color-*`, with a hand-written `.dark` override block (`globals.css:31-40`). This is the core theme debt — two parallel token systems.

## Findings (file:line)
| # | Finding | Evidence | Severity |
|---|---|---|:--:|
| TH-1 | ~~Undefined `--purple`~~ **FIXED** | `globals.css:14-17` | resolved |
| TH-2 | Parallel hand-written `.dark` block duplicates the DS dark theme | `globals.css:31-40` + ~14 `.dark` selectors | **S2** |
| TH-3 | Hardcoded dark-only body bg `rgb(5 8 16)` (no token, no light pair) | `globals.css:1108` | **S2** |
| TH-4 | `rgb(10 15 26)` literal in TSX (layout bg fallback) | `app/layout.tsx:102` | **S3** |
| TH-5 | 60 raw `rgb()/rgba()` in CSS (state overlays + parallel namespace values) | `globals.css` (`:21-39,476,526,1108`) | **S2** |
| TH-6 | Mixed namespaces in one string (local `--text-hint` vs `--lb-*`) in Suspense fallbacks | `reset-password:270`, `check-email:216`, `login:369`, `lookup:630` | **S3** |
| TH-7 | `outline:none` ×5 — focus colour now restored via `:focus-visible` (Wave-3), but the 5 `outline:none` declarations remain (paired, not removed) | `globals.css` | **S3** |

## Dark / light / switching / persistence
Light, dark, and system are genuinely reachable end-to-end; the toggle works through the provider; colours come from the `data-theme`/class `ThemeScript` sets pre-paint. **Not broken or unreachable.** Contrast: the DS `--lb-color-*` scale is designed for AA; the *parallel* namespace's hand-picked `rgb()` values (TH-2/TH-5) are NOT contrast-audited and are the contrast risk to verify during cleanup.

## One-token-source-of-truth assessment
**Achievable, bounded job.** Blockers are exactly TH-2…TH-6 (delete the parallel `.dark` block + the two hardcoded bg literals; source the state overlays from themed tokens; collapse the local namespace into `--lb-*`). No provider/architecture change needed. Recommend doing this inside the Wave-2 page conversion so the shadow `globals.css` is removed wholesale rather than incrementally re-tokenized.
