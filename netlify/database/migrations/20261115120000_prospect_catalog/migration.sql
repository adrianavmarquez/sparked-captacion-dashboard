-- Catálogo importado (empresas, prospectos, contactos).
-- La evidencia ya existe. Volver a importar actualiza por id y no duplica.
-- Nada de esto escribe en GHL.

CREATE TABLE companies (
  id text PRIMARY KEY,
  name text NOT NULL,
  locality text NOT NULL,
  industry text NOT NULL,
  is_chain_or_franchise boolean NOT NULL DEFAULT false,
  website_url text,
  website_renewed_on date,
  website_renewed_source text,
  address text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prospects (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies (id),
  summary text NOT NULL,
  summary_source text NOT NULL,
  offer_interest text,
  exclusion text,
  status_proposed text NOT NULL,
  confidence text,
  note text,
  created_at timestamptz NOT NULL,
  CONSTRAINT prospects_status_chk CHECK (status_proposed IN ('Listo para revisión', 'Revisión manual', 'Descartado')),
  CONSTRAINT prospects_exclusion_chk CHECK (
    exclusion IS NULL OR exclusion IN ('chain', 'franchise', 'recently_renewed', 'manual_review')
  ),
  CONSTRAINT prospects_offer_chk CHECK (
    offer_interest IS NULL OR offer_interest IN ('diagnostico', 'core', 'plus', 'cm')
  )
);

CREATE INDEX prospects_company_idx ON prospects (company_id);

CREATE TABLE contacts (
  id text PRIMARY KEY,
  prospect_id text NOT NULL REFERENCES prospects (id),
  role text NOT NULL,
  channel text NOT NULL,
  value text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  source text,
  CONSTRAINT contacts_channel_chk CHECK (channel IN ('email', 'linkedin'))
);

CREATE INDEX contacts_prospect_idx ON contacts (prospect_id);
