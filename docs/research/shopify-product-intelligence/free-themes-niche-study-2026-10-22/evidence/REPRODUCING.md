# Reproduction and artifact boundaries

The authoritative research finding can be reproduced without a database from the repository root:

```sh
node --import tsx docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/evidence/audit-presets.mts
python3 docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/evidence/validate-research.py
```

The audit writes its own synthetic results/HTML fixtures, never merchant state. Running it changes artifact hashes, so re-run validation afterward. The current source snapshot and experiment-start HEAD identify the reviewed code; a later checkout may legitimately produce different results. The scripts do not certify a deployed database or release.

The Python build helpers are one-off research drafting/export helpers, not production generators or governance authority. Final documents include manual review corrections, additional observations and validation. Do not blindly regenerate the collection over those edits. Read the final prose and model JSON together. All original SVGs and comparisons are research schematics, not a production theme implementation.

The browser screenshots were captured through the approved CUA browser workflow; the Python helpers only arranged original local screenshot files and authored SVGs. No remote Shopify page was modified to create a neutral comparison. The temporary local preview served only this research collection on loopback. Synthetic fixture route links and purchase controls were not used as a working store.

`manifest.json` excludes itself and records file identity. `research-validation.json` records current parsing/link/count/palette/privacy-marker checks. Neither proves a research claim true. Coverage and claim ledgers retain observations, inference, blocked and untested branches.
