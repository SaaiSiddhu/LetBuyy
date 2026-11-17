# Native418 CI memory and Identity startup repair

The full D954 CI attempt exposed a PostgreSQL OOM while the collection fixture computed a single snapshot containing hundreds of aggregate subplans. The failed container reported OOMKilled and PostgreSQL logged SIGKILL of the snapshot backend. The fixture now computes the identical per-relation digest through separate dynamic queries before assembling the same JSON object. Its row, catalog, ACL and numeric comparisons remain intact; the 1 GiB container limit is unchanged.

The Identity readiness fixture aborted each cold-route request after two seconds while allowing 45 seconds overall. It now lets a request use the remaining overall budget and reports sanitized startup diagnostics. The total deadline and application assertions remain unchanged. No application runtime, issuer, callback registry or migration changes are included.

Final Identity qualification passed nine checks across two concurrent owned suites: eight session/security checks and the real Identity/Commerce browser journey. This includes signup, consent, PKCE, profile/address, restart and two-buyer isolation. Run: `20261117T054433Z-native418-identity-final-parallel-18644000cc314950880543e415f5a6bb`.

The final bounded collection run passed all 19 tests with the required two prepared-transaction slots, no skips and no cleanup failures. It exercised all original schema/authority mutation, real prepared-transaction, concurrent-writer and raw-role controls. Run: `20261117T054813Z-native418-collection-prepared-memory-final-cd6913358298431399740fcd149c6ef4`. The earlier invocation omitted the prepared slots and remains failed (18/19); its evidence is preserved. Sampled PostgreSQL memory in that earlier run was 153–270 MiB under the same 1 GiB limit, without an OOM event.

Required exact-source CI, hosted staging signup/sign-in, production activation and physical iPhone acceptance remain pending. These local results are not a release certification.
