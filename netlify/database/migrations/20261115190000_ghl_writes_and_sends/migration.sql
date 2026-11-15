-- Escrituras a GHL y envíos de correo. La migración anterior no se toca.
-- ghl_synced puede ser true solo después de una escritura aceptada por GHL.
-- before_json / after_json guardan la auditoría de cada escritura.

ALTER TABLE stage_moves DROP CONSTRAINT stage_not_synced_chk;

ALTER TABLE audit_log ADD COLUMN before_json jsonb;
ALTER TABLE audit_log ADD COLUMN after_json jsonb;

CREATE TABLE mail_drafts (
  id text PRIMARY KEY,
  prospect_id text NOT NULL,
  kind text NOT NULL,
  followup_day integer,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  recipient text,
  message_id text,
  approved_at timestamptz,
  sent_at timestamptz,
  send_claim text,
  CONSTRAINT mail_kind_chk CHECK (kind IN ('first_contact', 'followup')),
  CONSTRAINT mail_status_chk CHECK (status IN ('draft', 'approved', 'sent')),
  CONSTRAINT mail_day_chk CHECK (followup_day IS NULL OR followup_day IN (4, 10, 20)),
  CONSTRAINT mail_sent_chk CHECK (status <> 'sent' OR (message_id IS NOT NULL AND sent_at IS NOT NULL))
);

CREATE UNIQUE INDEX mail_drafts_one_first ON mail_drafts (prospect_id) WHERE kind = 'first_contact';
CREATE UNIQUE INDEX mail_drafts_one_followup ON mail_drafts (prospect_id, followup_day) WHERE kind = 'followup';

CREATE TABLE opt_outs (
  id text PRIMARY KEY,
  email text,
  domain text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT opt_out_target_chk CHECK (
    (email IS NOT NULL AND domain IS NULL) OR (email IS NULL AND domain IS NOT NULL)
  )
);

CREATE UNIQUE INDEX opt_outs_email_idx ON opt_outs (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX opt_outs_domain_idx ON opt_outs (lower(domain)) WHERE domain IS NOT NULL;

CREATE TABLE ghl_links (
  prospect_id text PRIMARY KEY,
  opportunity_id text NOT NULL,
  contact_id text,
  location_id text NOT NULL
);
