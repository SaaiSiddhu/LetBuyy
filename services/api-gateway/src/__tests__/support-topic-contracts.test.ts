// The operator support queue's two topic contracts (P2-OPERATOR-QUEUE-CORRECTNESS, 2026-10-02), pinned to the database.
//
// The queue is FILTERED with SupportTicketQueueTopicSchema; tickets and macros are CREATED with SupportTicketTopicSchema. They
// differ by exactly 'privacy' (only the buyer's privacy intake writes a privacy ticket), and each must equal the CHECK constraint
// of the table it is used against: a topic the table holds but the filter refuses is a ticket an operator cannot find, and a topic
// the creation schema accepts but the table refuses is an internal error. The behaviour is proven against a real database in
// owned-db/operator-queue-correctness.postgres.test.ts; this is the fast drift check.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SupportTicketQueueTopicSchema, SupportTicketTopicSchema } from '@letbuyy/shared-types';

const repositoryFile = (path: string): string => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const sorted = (values: readonly string[]): string[] => [...values].sort();

test('the queue topics are the creation topics plus privacy, and nothing else', () => {
    assert.deepEqual(sorted(SupportTicketQueueTopicSchema.options), sorted([...SupportTicketTopicSchema.options, 'privacy']));
    assert.ok(!(SupportTicketTopicSchema.options as readonly string[]).includes('privacy'), 'an operator cannot create a privacy ticket');
});

test('the queue topics are exactly what support_tickets.topic accepts since migration 261', () => {
    const sql = repositoryFile('database/supabase/migrations/261_support_tickets_privacy_topic.sql');
    const check = sql.match(/ADD CONSTRAINT support_tickets_topic_check\s+CHECK \(topic = ANY \(ARRAY\[([^\]]*)\]\)\)/)?.[1] ?? '';
    const accepted = [...check.matchAll(/'([a-z_]+)'::text/g)].map((match) => match[1]);
    assert.ok(accepted.length > 0, 'the CHECK constraint was found');
    assert.deepEqual(sorted(accepted), sorted(SupportTicketQueueTopicSchema.options));
});

test('the creation topics are exactly what ticket_macros.topic accepts (migration 127), which has no privacy', () => {
    const sql = repositoryFile('database/supabase/migrations/127_internal_os_support_ticketing.sql');
    const macros = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS public.ticket_macros'));
    const check = macros.match(/topic text NOT NULL DEFAULT 'general' CHECK \(topic IN \(([^)]*)\)\)/)?.[1] ?? '';
    const accepted = [...check.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    assert.ok(accepted.length > 0, 'the CHECK constraint was found');
    assert.deepEqual(sorted(accepted), sorted(SupportTicketTopicSchema.options));
});
