INSERT INTO local_event_store (stream_name, event_type, payload, metadata)
VALUES
    ('local.bootstrap', 'local.environment.started', '{"source":"seed"}', '{"replaySafe":true}'),
    ('local.feature-flags', 'feature_flag.created', '{"flagKey":"checkout.canary","enabled":false}', '{"scope":"local"}')
ON CONFLICT DO NOTHING;

INSERT INTO local_queue_messages (queue_name, message_key, payload, status)
VALUES
    ('letbuyy-events-local', 'seed-event-001', '{"eventType":"local.seed"}', 'pending'),
    ('letbuyy-dead-letters-local', 'seed-dlq-001', '{"eventType":"local.dlq.seed"}', 'dead-lettered')
ON CONFLICT DO NOTHING;
