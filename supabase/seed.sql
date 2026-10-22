-- =============================================================================
-- DEMO SEED DATA (100% FICTITIOUS — ZERO REAL PII)
-- =============================================================================

INSERT INTO public.webhook_idempotency_logs (message_id, sender_phone, event_type, raw_payload)
VALUES
  ('wamid.DEMO_SEED_001', '584120001122', 'PAYMENT_RECONCILED', '{"demo": true}'::JSONB),
  ('wamid.DEMO_SEED_002', '584240005566', 'INCIDENT_TRIAGED', '{"demo": true}'::JSONB)
ON CONFLICT (message_id) DO NOTHING;
