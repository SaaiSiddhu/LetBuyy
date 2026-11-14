# Reproducible source candidate — not accepted or approved

Source HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`,branch `codex/local-work-preserved-20261025`,with 424 owner dirty/untracked entries at task start. The working implementation was preserved; bare HEAD is not the release source.

**No new application-source change was retained in this follow-up.** Two isolated candidates were rejected. The final materialized source has 1,289 files across 15 runtime/package roots and matches both the working checkout's previously captured manifest and the November3 source archive. All 20 marketing CSS files match. The four prior task-owned repair patches remain reviewable; do not broadly apply/revert over owner edits.

Fresh exact `pnpm exec turbo run build --filter=@letbuyy/marketing-site` passes 29/29, **0 cached**. Final isolated build:`Nr2bD-AZ_XyFXsUJdc2FD` on 9016; current root build:`b2CsFLYIUn25H5EguBjys` on 9006. The new build uses `https://www.letbuyy.com` canonical metadata, with explicitly local API/Accounts origins and development auth bypass disabled. **It is test output, not production deployment output.** A later approved release must rebuild from reviewed source with verified hosted configuration.

[Verified source manifest](evidence/source-manifest.json) · [Lineage and archive hash](evidence/source-lineage.json) · [Existing source archive](../../letbuyy-seo-release-readiness-2026-11-03/MARKETING-RELEASE-SOURCE.tar.gz)

Prior scoped changes:[source repairs](../../letbuyy-seo-release-readiness-2026-11-03/SOURCE-CHANGES.patch),[locale Proxy migration](../../letbuyy-seo-release-readiness-2026-11-03/PROXY-MIGRATION.patch),[final content/directory/artwork repairs](../../letbuyy-seo-release-readiness-2026-11-03/RESOLUTION-REPAIRS.patch),[separate gateway CORS patch](../../letbuyy-seo-release-readiness-2026-11-03/GATEWAY-CORS-REPAIR.patch). The marketing archive does not include the gateway runtime. A marketing-only release cannot deliver its Worker CORS correction.

Release acceptance remains open because the required simulated LCP lanes fail; provider sandbox and human/device requirements remain separately unverified. DNS and analytics are prepared proposals, not applied changes. **Not ready for a scoped deployment approval request.** No commit, push, merge, preview deployment or production release occurred.

After acceptance passes, the approval packet must name exact marketing source/configuration/build command, separate Worker scope if included, observed before-state, rollback artifact and[post-release checks](POST-RELEASE-VERIFICATION.csv). Do not include Firebase/Play/DNS/GA4/indexing/outreach as implicit extras.
