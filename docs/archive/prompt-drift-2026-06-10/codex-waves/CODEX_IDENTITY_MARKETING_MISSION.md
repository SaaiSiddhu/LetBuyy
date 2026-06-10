# CODEX IDENTITY & MARKETING MISSION — LetBuyy WS6

**Driver:** Codex agent. Reasoning: `medium`.
**Mode:** Continuous, autonomous. Never stop while unblocked work remains.
**Domain Ownership:** `apps/identity-platform/src/**` and `apps/marketing-site/src/**` ONLY.
**Dependencies:** `@letbuyy/ui` (consume only).

---

## 0. PRIME DIRECTIVE

Polish the identity platform into a guided, delightful onboarding experience and transform the marketing site into a premium conversion machine. Both apps use the shared design system.

**SUCCESS CRITERIA:**
1. Signup → store creation is a guided 2-3 step wizard with progress, not a bare form.
2. Store creation ends with a celebration screen ("Your store is live!") + immediate next action.
3. Store selection (for multi-store merchants) is clear and fast.
4. Marketing site has a premium pricing page with plan comparison.
5. Marketing site has a compelling feature showcase.
6. Both apps use `@letbuyy/ui` grammar; no ad-hoc CSS where components exist.
7. Governance 128/128 maintained.

---

## 1. THE WORK

### ID1 — Identity Platform Polish
- **ID1.1** Signup flow: clean form with inline validation, progress indicator.
- **ID1.2** Store creation wizard: 2-3 friendly questions, progress dots, smart defaults (INR, GST).
- **ID1.3** Success screen: celebration ("🎉 Your store is ready!"), immediate CTA to dashboard.
- **ID1.4** Store selector: for merchants with multiple stores, clear list with store type/status.
- **ID1.5** Password reset / OTP flows: consistent with shared components.
- **ID1.6** Responsive at 375px.
- **GATE ID1:** auth flows polished; before/after screenshots; governance 128/128.

### MK1 — Marketing Site Redesign
- **MK1.1** Landing page: hero section, value proposition, feature highlights, social proof, CTA.
- **MK1.2** Pricing page: plan comparison grid (Free/Basic/Pro/Enterprise) with feature matrix.
- **MK1.3** Feature showcase: key features with visuals (products, themes, apps, payments).
- **MK1.4** Responsive design: mobile-first layout.
- **MK1.5** SEO: meta tags, structured data, OG images.
- **GATE MK1:** marketing site redesigned; screenshots; governance 128/128.

---

## 2. OPERATING CONTRACT

1. Touch ONLY `apps/identity-platform/src/**` and `apps/marketing-site/src/**`.
2. Consume `@letbuyy/ui` and `@letbuyy/api-client` — never modify.
3. No auth/session/RBAC logic changes — purely presentation.
4. `pnpm turbo typecheck` + `pnpm lint` + `validate:governance` green after every commit.
5. Max 3 attempts per task → BLOCKED → next.

---

## 3. DO NOT TOUCH

- `services/**`, `packages/*-core/**`, `database/**`
- All other `apps/**` directories
- `packages/shared-types/**`, `packages/typescript/api-client/**`, `packages/typescript/ui/**`
- `scripts/validators/**`, `docs/governance/**`
- Any auth/session/RBAC/OAuth logic

---

## 4. LAUNCH PROMPT

```
Read CODEX_IDENTITY_MARKETING_MISSION.md in full.
Execute ID1→MK1 continuously and autonomously.

Hard rules:
- Touch ONLY apps/identity-platform/src/** and apps/marketing-site/src/**.
- No auth/session/RBAC logic changes — purely presentation.
- Compose every screen from @letbuyy/ui.
- Keep governance 128/128 green after every commit.
- Max 3 attempts per task then BLOCKED.
- Maintain CODEX_IDENTITY_MARKETING_LEDGER.md.

Begin with ID1.1 now.
```
