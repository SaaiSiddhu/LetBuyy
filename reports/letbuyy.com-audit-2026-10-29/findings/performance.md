# Performance (CWV)

Audit date: 29 October 2026, Asia/Kolkata. Status: qualitative; no numeric category score.

Unavailable: PageSpeed Insights returned quota exceeded. No field LCP/INP/CLS, local Lighthouse score, Lighthouse version or Agentic Browsing X/N. The source observations below are optimization hypotheses; network fetch timings are not CWV. The absent skill runtime was not installed because setup/dependency repair was not requested.

### SEO-10 — Measure and reduce unnecessary early image work (Medium)

**Observed:** Raw homepage HTML includes 16 image preload links and 22 loading=eager image elements, including capability and lower-page surface art. Decoded homepage HTML is 339,643 bytes; the compressed crawl response transferred 40,805 bytes. Three measured image assets returned 200: storefront illustration 107,040 bytes, bottom CTA 128,004 bytes, social image 52,770 bytes. Public PageSpeed Insights returned HTTP/API 429 RESOURCE_EXHAUSTED; LCP, INP, CLS, Lighthouse score and Agentic Browsing X/N are unavailable.

**Change:** Obtain a successful mobile/desktop Lighthouse lab run and CrUX/Search Console field data first. Reserve early preloads/eager fetching for actual critical above-fold content, lazy-load lower sections and serve appropriately sized variants. Profile animated illustration CPU/motion costs. Treat any speed improvement as a hypothesis until measured.

**Dependencies:** Available PageSpeed quota or an authorized local lab runner; CrUX/RUM field access if there is enough traffic.

**Validation:** Compare equivalent before/after lab runs and field LCP/INP/CLS separately; verify no new layout shift, visual break or delayed hero asset. Do not infer CWV from HTTP fetch time or HTML size.

**Leading indicator:** Critical-request/image bytes before LCP, followed by measured LCP/INP/CLS when available.

**Failure check:** Failure is reducing preload count without improving measured experience, or causing late hero rendering.
