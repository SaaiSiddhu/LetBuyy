# LetBuyy Anti-AI-Template Checklist

Run this before calling **any** LetBuyy UI complete — merchant OS screen, storefront section,
checkout step, identity form, Flutter screen. A failed item is a **defect**, not a taste disagreement.

---

## 0. The principle

A screen looks generated when it has **nothing specific to say and decorates instead**. LetBuyy's
users are a shop owner reconciling a day's COD collections on a phone, and a shopper deciding
whether a small store is trustworthy enough to pay. Specificity earns both: the exact payable with
its GST line, the exact settlement date, the exact stock count. Restraint alone produces a blander
template; **restraint plus specificity** is the standard.

**The test:** cover the logo. Could this screen belong to any other commerce SaaS? If yes, it has
failed — no matter how clean it looks.

---

## 1. Visual patterns — reject unless individually justified in writing

```
[ ] Gradient backgrounds, glowing orbs, aurora washes, blobs used as decoration
[ ] Glassmorphism / backdrop-blur without a real layering need (ui_kit's glass_container needs a reason)
[ ] Gradient text
[ ] Bento grids because they are fashionable, not because the content is a grid
[ ] Every element the same rounded card — cards as the default container
[ ] 3D renders, floating geometry, isometric illustration
[ ] A giant hero with one line and 90vh of nothing (storefront themes included)
[ ] Pill shapes for everything (badges, buttons, tags, chips all pill)
[ ] Alternating tinted section bands
[ ] Dark sections used to look "technical"
[ ] Repeated 3-across icon-card rows with no narrative
[ ] Fake logo clouds, invented "trusted by" strips (no merchant's name without permission)
[ ] Stock illustration with no product meaning; emoji as iconography
[ ] Colour used for hierarchy where weight, size or position should carry it (UX-R20)
```

**The icon-card test:** delete the icons. Does the section still communicate? If yes, the icons were
decoration. If no, the section had no content.

---

## 2. Motion

```
[ ] Scroll-triggered entrance animations; content invisible until scrolled into view
[ ] Parallax; scroll hijacking; cursor-following or magnetic hover
[ ] Numbers that count up; auto-advancing carousels; preloaders; ambient loops
[ ] Any animation without a reduced-motion fallback; any literal duration outside --lb-motion-*
```

---

## 3. Copy

```
[ ] A heading that says nothing ("Powerful features", "Why choose us", "Built for you")
[ ] "AI-powered" / "seamless" / "revolutionary" where no shipped capability exists
[ ] A benefit sentence that would be true of any competitor (the swap test: replace "LetBuyy" with a competitor)
[ ] Three parallel value props of suspiciously equal length
[ ] A number we cannot count; a certification we do not hold; an uptime we have not measured
[ ] Placeholder text, lorem ipsum, a TODO, or a [SKIP] screen shipped (UX-R14)
[ ] A "0% fees" claim next to a screen that shows a fee (D-1 is open; the repository is 0%)
[ ] US-centric idioms; missing INR/GST/pincode vocabulary where an Indian merchant expects it
[ ] An error message that names an internal (stack trace, table, RPC) instead of the next step
```

---

## 4. Proof and honesty

```
[ ] Fabricated customer logos, testimonials, counts, ratings, awards, uptime
[ ] A fake dashboard screenshot or invented merchant/order data in product imagery
[ ] A sandbox/mock/scaffold path rendering as success anywhere (UX-R33) — the badge is missing or wrong
[ ] A money surface without ProviderModeBadge, or a badge that is colour-only
[ ] A stub action that shows a success toast
```

---

## 5. Structure

```
[ ] Section order is the default template rather than the task the merchant came to do
[ ] Sections could be reordered with no loss of sense (no argument is being made)
[ ] The same CTA repeated three or more times; more than one hero
[ ] More than one primary action on a screen (merchant-ux.md: one, top-right and/or pinned)
[ ] Navigation with more than 5 top-level items; a mega-menu listing everything
[ ] A settings screen that leads to a parity catalog instead of a real screen
```

---

## 6. Craft — the things generated screens get wrong

```
[ ] Values off the token scale (spacing, radius, shadow, font size) — the ratchet will catch some; you catch the rest
[ ] More than 3 font sizes in one viewport; more than 2 elevation levels
[ ] Brand purple used decoratively rather than for meaning
[ ] Icons at mismatched stroke weights or from two sets
[ ] Measure over ~75 characters; optical alignment ignored
[ ] Buttons that look identical but do different-priority things
[ ] Hover states with no focus equivalent; focus ring missing on a custom control
[ ] Empty, loading, error-with-retry states unstyled or missing (UX-R5)
[ ] Money not tabular; breakdown collapsed; currency symbol inconsistent
[ ] Dark mode renders an ad-hoc palette instead of the --lb-* dark ramp
[ ] 404 / error pages unbranded
```

---

## 7. Final sign-off

```
[ ] Cover the logo — is this identifiably LetBuyy?
[ ] Swap the brand name into a competitor's copy — does anything break?
[ ] Read it aloud — does it sound like a person or a generator?
[ ] Delete every decorative element — is the screen worse, or just plainer?
[ ] Would a shop owner learn something they did not know (a number, a date, a next step)?
[ ] Is there one specific, concrete, checkable thing on this screen a competitor could not say?
```

**That last line is the whole test.** Every screen needs at least one.

---

## 8. What LetBuyy does instead

- Say the exact thing. "₹1,240 will settle on Tuesday, minus ₹0 fees" beats "Fast, transparent payouts".
- Show the real product and the real data, or show nothing.
- Name what does not exist yet, in the UI, honestly (`ProviderModeBadge`, "coming soon" as an
  `EmptyState`, never a fake success).
- Let structure and typography carry the design: borders, spacing, rhythm, tabular numbers.
- Use the brand accent so rarely that it means something when it appears.
- Write for a merchant who is busy on a phone, not a visitor to be dazzled.
