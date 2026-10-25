# Order confirmation transport — private02 sealed

**31 pure checks PASS; API/worker semantic diagnostics0, introduced0.** [Exact4-file handoff](HANDOFF.json), [patch](proposal.patch). No Main or running-candidate source changed.

Direct and queued order confirmations now forward the existing stable site+order provider idempotency key. An unsuccessful direct adapter result throws; binding mismatches fail closed. Missing confirmation provider configuration stays retryable. Existing signed envelope validation, queue entry acknowledgement/retry code and all other transactional jobs remain unchanged.

Checks cover unsuccessful send/retry, lost acknowledgement, concurrent/duplicate arrivals, matching direct/queued multipart body/key, wrong tenant/order/key, envelope forgery and unchanged other jobs. Provider calls were intercepted; no actual email, provider, DB, native, browser or build ran. A fake acceptance map is explicitly not actual provider/inbox or durable scheduler proof. Outer event-helper failure catching and scheduling are unchanged.

The capture-proof01 seal is preserved. This first seal ends the notification preparation lease. Independent review and separate integration/qualification remain required.
