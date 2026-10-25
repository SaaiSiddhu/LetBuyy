# Kindred G08 — retained-log attribution

The exact UI error **1136306685** is correlated with the retained commerce log: **StorefrontStoreError / getPreviewStoreBySubdomain**, caused by **HTTP404 NOT_FOUND: Preview session not found or expired**, request correlation90c8e7c0-1fed-4027-acba-92fb80bf140e. This is new saved evidence for the existing failure, not a new runtime attempt or a fix.

The gateway accepts only a matching store/token-hash session whose expiry is in the future. The parent requests900seconds and the adapter returns expires_at; the inspected parent retains token/context but not expiry. CenterPanel changes/remounts the preview URL on viewport changes with the supplied token. Existing normal Retry preview calls the authorized session refresh path. These source facts support investigating credential lifetime/navigation recovery before any Tablet styling change.

**Not established:** whether this particular token expired, was missing/revoked or failed a store/token binding. No session row, token or credential was read. The generic404 deliberately covers several cases. No source cause is silently promoted from that ambiguity, and no CSS patch, TTL extension or public-preview fallback is justified by this result.

The existing shared Editor owner should implement/review the finite session recovery contract under a new exact lease: retain fail-closed store/draft/template binding; recover an obsolete session through the existing authenticated authority; retire stale responses; preserve draft/conflict state; bound refresh/retry and verify exactly-one intended effect. Test expiration/long-idle plus actual Desktop/Tablet/Mobile, wrong-store/revoked inputs and late response races. Keep KQA-01's768long-brand failure separate and OPEN P2.

The sanitized excerpt excludes raw preview URLs/tokens/headers and does not copy the full mutable log. Current and retained candidate source hashes are in DIAGNOSTIC.json. No shared source/artifact edit, browser/API/database/build call, process restart or keepalive occurred. Helper activation and current grants remain absent at this boundary; the completion goal stays active.

Source lineage limit: the complete current theme execution adapter differs from the retained candidate. The relevant createPreviewSession method is byte-identical (fragmentSHA9f9da35a…), and the other six inspected diagnostic files match. This comparison qualifies only the cited diagnostic path, not unrelated adapter edits or a new build.
