-- =============================================================================
-- WHATSAPP + GEMINI B2B CONCILIATOR — SUPABASE / POSTGRESQL SCHEMA
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_idempotency_logs (
  message_id        TEXT        PRIMARY KEY,
  sender_phone      TEXT        NOT NULL,
  event_type        TEXT        NOT NULL,
  raw_payload       JSONB       NOT NULL DEFAULT '{}'::JSONB,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL,
  message_id          TEXT          NOT NULL UNIQUE REFERENCES public.webhook_idempotency_logs(message_id),
  customer_identifier TEXT          NOT NULL,
  reference_number    TEXT          NOT NULL,
  amount              DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency            VARCHAR(5)    NOT NULL DEFAULT 'USD',
  origin_bank         TEXT          NOT NULL,
  receipt_storage_url TEXT          NULL,
  status              VARCHAR(20)   NOT NULL DEFAULT 'PENDING_REVIEW'
                      CHECK (status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')),
  extraction_engine   VARCHAR(30)   NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_tenant
  ON public.payment_reconciliations (tenant_id, status);

CREATE TABLE IF NOT EXISTS public.noc_incident_tickets (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL,
  message_id              TEXT        NOT NULL UNIQUE REFERENCES public.webhook_idempotency_logs(message_id),
  subscriber_id           TEXT        NOT NULL,
  category                VARCHAR(40) NOT NULL,
  severity                VARCHAR(15) NOT NULL,
  coordinates_or_address  TEXT        NOT NULL,
  structured_summary      TEXT        NOT NULL,
  requires_field_dispatch BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
