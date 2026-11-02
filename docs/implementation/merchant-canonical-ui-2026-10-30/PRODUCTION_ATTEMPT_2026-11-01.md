# Merchant production attempt — 1 November 2026

Owner requested deployment of the Merchant app. Production activation did not occur.

Primary checkout: develop at 0dc2c8423, preserving separate dirty theme-programme files. Remote develop/staging/main were inspected at 14961c132. The isolated candidate at /private/tmp/letbuyy-merchant-production-candidate-20261101 merges the Merchant changes onto that newer source, preserving shipping/GST and Accounts fixes. Five merge conflicts were resolved. The gift-card migration was renumbered from the conflicting 411 to 414 with its rollback and test reference. Synthetic credentials were regenerated or explicitly registered as the public challenge fixture. Candidate head: 1ef6ddb48d58ce20b2116c178824ed959539516a. Candidate and promotion refs have not been pushed.

Observed candidate checks: Merchant tests 322 + 818 + 295 passed; shared UI tests 75 passed; Merchant and Gateway typechecks passed; Merchant production build passed. The affected gift-card and billing owned PostgreSQL suites passed 9/9, run f51eb3383c5c, with complete resource cleanup. Governance passed all 114 selected validators. These checks do not close the full eight-phase acceptance matrix or prove compatibility of the production Gateway/database with the new contracts.

Verified Vercel team: letbuyy-store-s-projects. Project: merchant, prj_BkaBsf3h7TvKRMpmyYQWsVmfP38J, root apps/merchant/web. Existing production deployment: dpl_F9XK6HGGssAodfUDA7xeFPStAvbm.

Two production-configured uploads used --skip-domain. Both were BLOCKED before a usable build. Latest: dpl_6DpeGoKdFnXnZQnWj9SuqssJXgf2, https://merchant-kaya5k843-letbuyy-store-s-projects.vercel.app. Provider reason: "The deployment was blocked because the commit author doesn’t have permission to create deployments for this project." seatBlock.blockCode = TEAM_ACCESS_REQUIRED; isVerified = false; aliasAssigned = false. The initial candidate commit used an auto-detected local-machine email. Its final packaging commit was corrected to the authenticated GitHub owner SaaiSiddhu (account 289344628) using that account's noreply identity; Vercel still rejected it. No access settings were weakened or bypassed. CLI watchers for the terminal blocked uploads were stopped.

Required provider action: connect/verify the repository GitHub owner with the Vercel team/project and resolve the TEAM_ACCESS_REQUIRED block. After that, build the exact candidate, verify it with production configuration, qualify dependent Gateway/schema compatibility (migration 414 has not been applied to production), and complete the governed develop → staging → main release and relevant hosted acceptance before assigning the live domain. No database migration or backend deployment was performed by this Merchant deployment attempt.

Logs: /private/tmp/letbuyy-merchant-production-{tests,build,ui,governance-final}-20261101.log; owned results /private/tmp/letbuyy-merchant-production-owned-20261101/result.json. Private provider responses remain in /private/tmp and were not committed.

Verdict: BLOCKED BY VERCEL PROJECT ACCESS; NOT PRODUCTION ACTIVATED.
