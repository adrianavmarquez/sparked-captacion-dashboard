-- Decisiones de revisión, borradores, evidencia y hitos de caja.
-- Los montos ausentes quedan NULL. No hay DEFAULT 0 ni precio de lista.
-- ghl_synced no puede ser true: la escritura a GHL está apagada.
-- El reino demo no tiene tablas aquí.

CREATE TABLE reviews (
  id text PRIMARY KEY,
  prospect_id text NOT NULL,
  decision text NOT NULL,
  reason text,
  revisit_on date,
  decided_by text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT reviews_decision_chk CHECK (decision IN ('approve_contact', 'maybe', 'discard')),
  CONSTRAINT reviews_discard_chk CHECK (decision <> 'discard' OR (reason IS NOT NULL AND length(btrim(reason)) > 0)),
  CONSTRAINT reviews_maybe_chk CHECK (decision <> 'maybe' OR revisit_on IS NOT NULL)
);

CREATE INDEX reviews_prospect_idx ON reviews (prospect_id, decided_at DESC);

CREATE TABLE fit_assessments (
  id text PRIMARY KEY,
  prospect_id text NOT NULL,
  fit text NOT NULL,
  services jsonb NOT NULL,
  budget text NOT NULL,
  note text,
  decided_by text NOT NULL,
  decided_at timestamptz NOT NULL,
  CONSTRAINT fit_chk CHECK (fit IN ('buen_fit', 'fit_parcial', 'no_fit')),
  CONSTRAINT fit_budget_chk CHECK (budget IN ('sin_dato', 'bajo', 'rango_core', 'rango_plus', 'abierto')),
  CONSTRAINT fit_services_chk CHECK (fit = 'no_fit' OR jsonb_typeof(services) = 'array')
);

CREATE TABLE draft_approvals (
  draft_id text PRIMARY KEY,
  approved_at timestamptz NOT NULL
);

CREATE TABLE payments (
  opportunity_id text PRIMARY KEY,
  type text NOT NULL,
  contract_signed boolean NOT NULL,
  amount_contracted_cents integer,
  deposit_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  deposit_received_cents integer,
  deposit_marked_at timestamptz,
  delivered_at timestamptz,
  balance_verified_at timestamptz,
  balance_received_cents integer,
  balance_marked_at timestamptz,
  offer text,
  CONSTRAINT payments_type_chk CHECK (type IN ('project_50pct', 'monthly_prepaid')),
  CONSTRAINT payments_offer_chk CHECK (offer IS NULL OR offer IN ('diagnostico', 'core', 'plus', 'cm')),
  CONSTRAINT payments_deposit_chk CHECK (
    deposit_verified = false OR (deposit_received_cents IS NOT NULL AND verified_at IS NOT NULL)
  ),
  CONSTRAINT payments_balance_chk CHECK (
    balance_verified_at IS NULL OR balance_received_cents IS NOT NULL
  ),
  CONSTRAINT payments_amounts_chk CHECK (
    (amount_contracted_cents IS NULL OR amount_contracted_cents >= 0)
    AND (deposit_received_cents IS NULL OR deposit_received_cents >= 0)
    AND (balance_received_cents IS NULL OR balance_received_cents >= 0)
  )
);

CREATE TABLE stage_moves (
  opportunity_id text PRIMARY KEY,
  stage text NOT NULL,
  moved_at timestamptz NOT NULL,
  moved_by text NOT NULL,
  ghl_synced boolean NOT NULL DEFAULT false,
  CONSTRAINT stage_chk CHECK (stage IN ('new_lead', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'closed')),
  CONSTRAINT stage_not_synced_chk CHECK (ghl_synced = false)
);

CREATE TABLE evidence (
  id text PRIMARY KEY,
  prospect_id text NOT NULL,
  component text NOT NULL,
  fact text NOT NULL,
  url text NOT NULL,
  observed_at timestamptz NOT NULL,
  competitor_url text,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT evidence_component_chk CHECK (
    component IN ('social_outdated', 'lower_visibility_vs_competitor', 'competitor_better')
  )
);

CREATE TABLE followup_stops (
  prospect_id text PRIMARY KEY,
  reason text NOT NULL,
  stopped_at timestamptz NOT NULL,
  CONSTRAINT followup_reason_chk CHECK (reason IN ('replied', 'opt_out'))
);

CREATE TABLE audit_log (
  id text PRIMARY KEY,
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor text NOT NULL,
  at timestamptz NOT NULL
);
