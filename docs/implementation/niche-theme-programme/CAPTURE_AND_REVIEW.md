# Mockup capture and independent review

The coordinator verified an isolated Playwright headless Chromium launch from the existing root `@playwright/test` dependency. It rendered a local 390×844 DPR1 document to a genuine PNG without touching user/IAB/Threadline tabs. The sandboxed launch failed at macOS Mach-port registration; the same bounded local launch with the supported sandbox escalation succeeded. Use `chromiumSandbox: true`; do not disable TLS checks, connect to an existing browser profile, or use user tabs.

Prepare source and imagegen assets independently. Request an isolated capture slot when ready: at most two full export processes run concurrently. There is no shared-browser lease for these isolated captures. Existing Threadline IAB browser 2 remains its owner's resource.

Use Threadline-compatible evidence where practical: `scenes.json` lists 15 distinct IDs; `exports.json` has 45 entries with `scene`, `device`, `file`, `width`, `height`, `viewport` (`width`, `height`, `dpr`); `responsive-audit.json` has 45 entries with actual `scene`, `device`, `width`, `height`, `dpr`, `scrollWidth`, `brokenImages`, and font evidence. Declare actual font families per theme, with the canonical identity screens' appropriate font exception. Never copy Threadline's Playfair-specific assertions into another theme.

Every individual PNG must have actual width 1440/834/390 for desktop/tablet/mobile, and full-page height at least its viewport height 1000/1112/844. Independent responsive rendering is required. Composite boards are additional artifacts. ZIP image bytes must match current exported files. Viewport audit records, not comments or nominal UI frame sizes, prove capture dimensions.

The coordinator's `verify_mockups.py` independently checks delivered files, PNG dimensions/decoding, unique scene-device combinations, export/audit coverage, overflow/broken images, local HTML links, JSON parsing, ZIP integrity and current-image hashes. This structural check does not certify visual design, keyboard accessibility, production behavior or performance; coordinator visual review remains separate.

The shared checkout was already dirty before this programme. Do not copy the old Threadline mockup validator's assumption that `git diff --quiet apps services packages database` must be clean. Do not reuse hardcoded historical governance totals as fresh evidence, modify unrelated source to satisfy artifact checks, or run cleanup/build gates in the shared checkout. Record only what this chat changed.
