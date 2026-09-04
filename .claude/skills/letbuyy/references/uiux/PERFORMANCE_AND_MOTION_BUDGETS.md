# LetBuyy Performance and Motion Budgets

**"Fast" is a measurement, not an adjective.** Budgets below are **PROVISIONAL_DIRECTION** until a
phase measures them on a real device profile and records the numbers in `EVIDENCE_LEDGER.md`; the
motion rules are law (`tokens.ts` motion tokens + `prefers-reduced-motion` kill switch, DOC 06 §4.1).
Nothing here is a claim about current performance — none has been measured at `823aa5ee`.

---

## 1. Device and network profile

Measured at the **75th percentile on mobile**: a mid-range Android (2–4 GB RAM) on throttled 4G in a
Tier-2 Indian city. Not a laptop, not localhost, not office Wi-Fi. The merchant OS is additionally
measured on a mid-range laptop over a slow connection, because merchants work there all day.

---

## 2. Budgets — blocking once measured

| Metric | Storefront (`customer_web`) + hosted checkout | Merchant OS (`merchant_web`, `admin_web`) | Identity (`identity-platform`) |
|---|---|---|---|
| **LCP** | ≤ 2.5 s | ≤ 2.5 s (first load), route change ≤ 1 s | ≤ 2.0 s |
| **INP** | ≤ 200 ms | ≤ 200 ms (table filter, palette open) | ≤ 200 ms |
| **CLS** | ≤ 0.1 | ≤ 0.1 (skeletons mirror layout) | ≤ 0.05 |
| TTFB | ≤ 0.8 s (edge-cached public pages) | ≤ 1.0 s | ≤ 0.8 s |
| Route JS, compressed | ≤ 150 KB | ≤ 250 KB per route | ≤ 100 KB |
| CSS, compressed | ≤ 40 KB | ≤ 60 KB | ≤ 30 KB |
| Fonts, total | ≤ 120 KB (Latin subset, WOFF2, variable) | same | same |
| LCP image | ≤ 150 KB | — | — |
| Third-party scripts | Razorpay checkout only, loaded on the payment step | 0 | Turnstile only |

Exceeding a budget is a **defect**, not a trade-off to be argued afterwards. Raising a budget requires
a written justification and owner approval. Checkout and payment surfaces are never degraded first:
under overload, analytics and personalisation shed before checkout (Constitution §long-range principles).

---

## 3. Architecture that makes the budget achievable

- Server components by default; `'use client'` only where interaction requires it.
- Public storefront reads cached at the edge; origin compute stateless.
- Storefront readable before JavaScript; the hosted checkout origin (`checkout.<root>`) ships its own
  minimal design layer, not the storefront theme CSS.
- No client-side data waterfalls; paginate from the gateway (cursor-based); preserve scroll.
- Fonts self-hosted via `next/font/local` behind `--font-letbuyy-*`; `display: swap` with metric
  overrides; preload only the LCP font.
- Images: `next/image`, correct `sizes`, intrinsic dimensions, AVIF/WebP; no hero/background video.
- Flutter: no jank on Orders/Finance lists at 60 fps on the device profile; images cached; no
  synchronous storage reads on the UI thread.

---

## 4. Third parties

- Storefront/checkout: **Razorpay checkout** is the one required third party, loaded on the payment
  step only, with its CSP entry (the CSP that blocked it once is a recorded S0 — never reintroduce a
  blanket `script-src 'self'` there).
- Identity: **Turnstile** on registration/login.
- Merchant OS and admin: **0** third-party scripts. No session recording, heatmaps, chat widgets,
  ad tags. Analytics, if ever approved, is cookieless and an owner decision with a privacy-policy entry.
- Every third party requires: owner approval, a privacy note, a CSP entry, and a re-measured budget.

---

## 5. Motion budget — law

```
Micro (hover, focus, small state)   120–180 ms
Standard (disclosure, drawer)       180–260 ms
Maximum permitted                   300 ms
Easing                              ease-out entrances; never bounce or elastic
Animatable properties               transform and opacity ONLY
Concurrent animations               ≤ 2 in view
Source                              --lb-motion-* tokens only; never a literal duration
```

**Forbidden:** scroll hijacking · parallax · scroll-triggered entrances that hide content · pointer-
following effects · looping ambient motion · animated gradients/orbs/blobs · counting-up numbers ·
auto-advancing carousels · page-load/preloader animations · animating `top`/`left`/`width`/`height`/
`box-shadow`. **Mandatory:** `prefers-reduced-motion: reduce` honoured (the token kill switch zeroes
all motion); prefer removing motion over shortening it.

---

## 6. Measurement — required before a budget claim

```
[ ] Lighthouse mobile, throttled — LCP / INP (TBT) / CLS recorded per touched route, both themes
[ ] Route JS, CSS, font and image weight recorded against the budget
[ ] Third-party requests listed (storefront: Razorpay only on the payment step)
[ ] LCP element identified; not lazy-loaded; discoverable in HTML
[ ] CLS checked with fonts cold and a slow network
[ ] Reduced-motion pass
[ ] Flutter: frame timeline on the device profile for the touched screens
[ ] Recorded in EVIDENCE_LEDGER.md with device, throttling, commit, and the routes NOT measured
```

**Never claim** zero cold starts, perfect uptime, or a guaranteed score. Report the numbers actually
measured, the device and throttling used, and what was not measured.
