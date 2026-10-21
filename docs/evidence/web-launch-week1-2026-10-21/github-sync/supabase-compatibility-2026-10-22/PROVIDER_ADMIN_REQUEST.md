# Provider administrator request — submitted 22 October 2026

The authenticated staging dashboard confirmed submission with the non-secret SQL package attached. The optional human/AI diagnostic-access grant was off. See `support-submission.json`; provider acceptance/installation is pending.

LetBuyy needs a supported migration-admission route for these Supabase projects in Mumbai:

- Staging: `yhhhjeaprrpjglriazad`
- Production: `qtrzgnnqnvboifoqntfi`

Please review `database/supabase/deploy/provider-admin-catalog-fence.sql` and its paired retirement script. The managed `postgres` role is not a superuser and cannot acquire the system-catalog locks used by the existing financial migration admission. It also cannot create an administrator-owned security-definer function or grant itself the missing catalog privileges.

The proposed helper is `letbuyy_maintenance.lock_catalogs_v1()`, owned by `supabase_admin` in an administrator-owned private schema. It accepts no arguments, executes a fixed native `LOCK TABLE ... IN SHARE ROW EXCLUSIVE MODE NOWAIT` list and performs no data writes, arbitrary SQL or role changes. It uses a pinned catalog search path, checks the direct migration session, and gives only `postgres` schema usage and execution without grant option. Application roles receive neither. Locks release at transaction end or connection loss. Existing admission still refuses foreign assigned/prepared writers and unknown financial state.

Its body SHA256 is `4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc`. The complete file hash is in `source-manifest.json`. Independent synthetic PostgreSQL17/Supautils review passed70 mechanism checks; the local retained-data rehearsal and financial suites are separate evidence.

Please confirm whether this precise installation is supported, install on staging first, and return the function/schema owner, body hash and effective ACL verification. Production installation follows staging verification. A supported equivalent must retain the native catalog exclusion and existing retained-data/concurrency safeguards. No user credentials, customer records or recovery key are needed for this request.

Submission does not imply provider approval or that installation has occurred. The release remains blocked until the supported administrative prerequisite is available.
