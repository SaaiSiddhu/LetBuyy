# CODEX STOREFRONT MISSION — LetBuyy WS4

**Driver:** Codex agent. Reasoning: `xhigh` for preview route, `medium` for polish.
**Mode:** Continuous, autonomous. Never stop while unblocked work remains.
**Domain Ownership:** `apps/storefront-runtime/src/**` ONLY.
**Dependencies:** `@letbuyy/ui` (consume only), `@letbuyy/api-client` (consume only).
**Coordination:** WS2 (Merchant UX) needs a storefront preview route. Build SF2 early.

---

## 0. PRIME DIRECTIVE

Polish the storefront runtime into a premium shopper experience. Build the theme preview route that the merchant theme editor (WS2/UX7) needs. Ensure consistent component grammar, mobile responsiveness, and customer account quality.

**SUCCESS CRITERIA:**
1. Theme preview route renders storefront with draft `settings_data` from query params or session.
2. Preview route supports device viewport emulation and postMessage for section selection.
3. Customer account pages (profile, orders, addresses) use consistent grammar.
4. Cart and checkout flows are polished with feedback (toasts, skeletons, form validation).
5. Storefront is fully responsive at 375px, 768px, and 1440px viewports.
6. Governance 128/128 maintained.

---

## 1. THE WORK

### SF1 — Component Grammar
- **SF1.1** Audit storefront pages for consistency; identify bespoke patterns.
- **SF1.2** Apply consistent header/footer/product-card/collection-card grammar.
- **SF1.3** Add skeletons to all dynamic storefront pages.
- **SF1.4** Add empty states (no products, no orders, etc.).
- **GATE SF1:** consistent storefront grammar; screenshots; governance 128/128.

### SF2 — Theme Preview Route (CRITICAL — unblocks WS2/UX7)
- **SF2.1** Build `/preview` route that renders the storefront with draft theme settings.
- **SF2.2** Accept draft `settings_data` via query params, session, or API lookup.
- **SF2.3** Add `postMessage` handler for section highlighting (editor clicks section → storefront highlights it).
- **SF2.4** Add `postMessage` handler for section scrolling (editor selects section → storefront scrolls to it).
- **SF2.5** Support viewport override for device toggle (desktop/tablet/mobile via CSS).
- **GATE SF2:** preview route works; postMessage sync works; governance 128/128.

### SF3 — Customer Account Polish
- **SF3.1** Profile page: name, email, phone, address management.
- **SF3.2** Order history: status badges, timeline, order detail.
- **SF3.3** Addresses: CRUD with Indian address format (pin code lookup).
- **SF3.4** Wishlist (if supported by existing API).
- **GATE SF3:** customer account polished; governance 128/128.

### SF4 — Cart & Checkout Polish
- **SF4.1** Cart: quantity adjustment, remove, empty cart state.
- **SF4.2** Checkout: form validation, address autofill, payment method selection.
- **SF4.3** Order confirmation: success state with order details.
- **SF4.4** COD flow: clear COD option, confirmation.
- **GATE SF4:** cart + checkout polished; governance 128/128.

### SF5 — Responsive Storefront
- **SF5.1** Product listing/detail responsive at 375px.
- **SF5.2** Cart/checkout responsive at 375px.
- **SF5.3** Customer account responsive at 375px.
- **SF5.4** Navigation (hamburger menu) at mobile.
- **GATE SF5:** 375px viewport screenshots; governance 128/128.

---

## 2. OPERATING CONTRACT

1. Touch ONLY `apps/storefront-runtime/src/**`.
2. Consume `@letbuyy/ui` and `@letbuyy/api-client` — never modify.
3. SF2 is highest priority — WS2/UX7 (theme editor) depends on it.
4. If API data is missing, build UI with placeholders and `[SKIP — NEEDS BACKEND]`.
5. `pnpm turbo typecheck` + `pnpm lint` + `validate:governance` green after every commit.
6. Max 3 attempts per task → BLOCKED → next.

---

## 3. DO NOT TOUCH

- `services/**`, `packages/*-core/**`, `database/**`
- All other `apps/**` directories
- `packages/shared-types/**`, `packages/typescript/api-client/**`, `packages/typescript/ui/**`
- `scripts/validators/**`, `docs/governance/**`

---

## 4. LAUNCH PROMPT

```
Read CODEX_STOREFRONT_MISSION.md in full.
Execute SF1→SF5 continuously. Prioritize SF2 (preview route) first — it unblocks WS2/UX7.

Hard rules:
- Touch ONLY apps/storefront-runtime/src/**.
- SF2 (preview route) is HIGHEST PRIORITY — the theme editor depends on it.
- Compose every screen from @letbuyy/ui where applicable.
- If API data is missing, [SKIP — NEEDS BACKEND].
- Keep governance 128/128 green after every commit.
- Max 3 attempts per task then BLOCKED.
- Maintain CODEX_STOREFRONT_LEDGER.md.

Begin with SF2.1 now (preview route).
```
