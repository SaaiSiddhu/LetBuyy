# Merchant journey spacing — 24 October 2026

The desktop timeline used `min-height: 80vh` and centered each stage within that row. On tall displays, the empty part of each row produced an oversized gap between illustrations and the following stage. Replaced that viewport reservation with content-sized rows and bounded 32–64px spacing; the last stage has no extra trailing padding. This supersedes the earlier 80vh layout decision in the journey evidence. All five stages, assets, content order, preview state handlers and mobile accordion CSS remain intact.

Native browser checks: 1440×1200 light and dark both have 64px between stage bodies; 1280×720 has 64px; 1024×1366 has approximately 51px. No horizontal overflow at these sizes or 390×844. The operations preview activated beside Scale Operations; its column remains sticky. At 390×844, opening Build Brand closes the previous journey stage and reveals the existing mobile panel. Light theme and default viewport restored. Screenshot: `journey-gap-fixed.png`.

Strict CSS lint and diff whitespace checks passed. Production build passed with all 494 pages generated. Marketing dev preview restarted on 0.0.0.0:9006 after the build.
