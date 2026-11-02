# Production export delivery guard — 1 November 2026

Status: the owner's specifically approved production privacy restriction is active and verified. This is a CDN policy change, not a production application/schema release or complete CSV acceptance. Permanent private storage separation remains open.

Exactly two harmless test objects were used in `letbuyy-media-production`: one public control and one under `exports/results`. Neither contained user or commerce data. No existing object body, job, order, customer, authentication record or file list was retrieved.

| Same two owned canaries | Before | After |
| --- | ---: | ---: |
| Public media control | 200, exact nonzero bytes | 200, same bytes |
| Private export canonical path | 200, exact bytes: confirmed bypass | 403, no canary bytes |
| Encoded prefix, encoded separator, recursive encoding and dot-segment paths | Not needed to establish initial exposure | All four403; no canary bytes |

Rule **`2dfe2ddf5eb24682acc5ccf1ce53619d`**, **Production: block direct export objects**, has saved exact-expression, Block and Active UI readback. The existing staging rule `448f40ff18614cafbbd72312d69f6458` remains active. The [exact active policy](PRODUCTION_EXPORT_CDN_POLICY.json) matches only `cdn.letbuyy.store` and its normalized `/exports` path; no Worker, secret, application alias, database, payment provider, public-media policy or paid plan was changed.

The first public PUT acknowledged completion but its CLI did not exit. The exact original public object was reconciled by CDN and R2 origin reads, without another PUT or replacement key. The already-planned second object and cleanup used the same R2 REST endpoints used by the installed Wrangler, with existing OAuth authority in memory. No new token or scope was created. The rule was submitted once; an automatic approval-review timeout on the subsequent read was followed by a read-only retry, not another deployment. Saved readback confirmed the exact expression/action and both active rules.

Both exact owned objects were deleted; independent R2 origin GETs returned404 for each. No extra canaries were created. The hung read-only CLI whoami process was signalled only after its stdout descriptor matched this task's private log. No unrelated process was stopped.

Private receipts: `/private/tmp/letbuyy-parity-continuation-20261101/approved-production-canaries.json`, `production-public-canary-timeout-reconciliation.json`, `approved-production-storage-metadata.json` and `production-export-rule-ui-readback.json`.

Limits: these are scoped public/private and encoded-path delivery checks. The production authenticated export journey was not exercised and no production merchant export was created. Staging's real authenticated export proof remains separate. Files still share the existing public media bucket; complete permanent private storage custody/cutover, original-operation import recovery and full web/native CSV selection/filter/share acceptance before certifying feature28 or a production release.
