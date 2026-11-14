# Recovery and rollback boundaries

No application source change was retained on 7 November,so no new production rollback is needed. The existing owner dirty tree,environment files,shared restored database and Docker resources were preserved. The temporary Next.js 16.4.5 and privacy-dialog candidates were discarded; original 1,289-file source,manifest and frozen dependency graph were restored in the owned scratch copy and freshly built.

Normal local services are marketing on 9006, gateway on 9010 and Accounts on 9002. Accounts runs with both dev auth bypass flags set to false via process-only overrides. No environment file was rewritten. The task-owned 9016 acceptance listener was stopped after measurements. The three working local services still return HTTP 200. See [final runtime health](evidence/final-runtime-health.json).

Before any later approved hosted operation,capture its actual immutable previous deployment/version/configuration and test recovery. Existing[November3 rollback packet](../../letbuyy-seo-release-readiness-2026-11-03/ROLLBACK-AND-RECOVERY.md) is historical; reverify IDs before use. A source archive is not proof that a specific hosted rollback artifact is available.

For future DNS, the relevant current records and empty redirect inventory are captured. Verify any new binding and CNAME recommendations, record the exact new IDs, then remove only those new entries if rollback is required. For analytics:record approved destination,consent settings and source version,then disable optional transmission/revert only those changes. For Firebase/Play:no action is prepared for deferred buyer-policy publication,and no deletion/restoration operation is authorized here.

Keep marketing and Worker release recovery separate. Post-release failure means stop the approved rollout and use its captured recovery plan; it does not authorize broad DNS changes or weaker authentication/CSP/WAF.
