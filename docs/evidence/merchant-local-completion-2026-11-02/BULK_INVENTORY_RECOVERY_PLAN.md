# Local bulk adjustment recovery

Owned rund5fb753f7d2freproduced valid-owner bulk failure (single adjustment positive passed, bulk item failed with unchanged stock). It is a regression of the old unscoped caller exposed by the required unconditional tenant guard. No guard exemption is permitted.

Complete the existing authority: extend the private append-only inventory_adjustment_receipts operation constraint for one batch acknowledgement, with product_id nullable only for that batch operation. Existing single rows and single writer remain unchanged. The batch calls apply_inventory_adjustment_v1 for each item under the existing tenant transaction and records the entire original command/results once. No new receipt table, auth system, stock engine, runtime or provider path.

Preserve the existing owner-only API and per-item result shape. A genuine missing product/business stock refusal remains a per-item outcome; infrastructure/audit/outbox/receipt faults abort the transaction. Bind the full batch to the original actor/site/key; replay rechecks current authority and acknowledged entity identity, returns original results and creates no new effect. Changed/extended commands, actor/store changes and unbound old HTTP keys refuse. The outer HTTP response cache must not bypass this authority.

Use legitimate next source number437after current436; primary still ends432at5614ffa7efcd93759c7bba63d1ea899d21253270, no collision. Ship paired DOWN, native/provider catalog/role/profile fences and retained-batch rollback refusal. Test existing receipt conservation, empty UP/DOWN/UP, tamper/prepared-writer refusal, real positive/negative caller context, races, reply loss, rollback of mandatory effects and exact replay. No hosted changes or release.

The exact pre-change authority was captured through436in owned metadata-only run474516b9750b. Original profile is private N/inventory-bulk-authority-original-profile-v1.json. This plan is implementation/evidence, never a governance amendment or runtime acceptance.
