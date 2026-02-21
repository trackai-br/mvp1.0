CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
CREATE TYPE tenant_status AS ENUM ('provisioning', 'active', 'suspended', 'retired');
CREATE TYPE dispatch_status AS ENUM ('pending', 'success', 'failed');

-- Tenants table
CREATE TABLE tenants (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status tenant_status NOT NULL DEFAULT 'provisioning',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Funnels
CREATE TABLE funnels (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clicks
CREATE TABLE clicks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fbclid TEXT,
    fbc TEXT,
    fbp TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clicks_tenant_fbc_idx ON clicks(tenant_id, fbc);
CREATE INDEX clicks_tenant_fbclid_idx ON clicks(tenant_id, fbclid);

-- Identities
CREATE TABLE identities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_hash TEXT,
    phone_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX identities_tenant_email_idx ON identities(tenant_id, email_hash);
CREATE INDEX identities_tenant_phone_idx ON identities(tenant_id, phone_hash);

-- Dedupe registry
CREATE TABLE dedupe_registry (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, event_id)
);

-- Dispatch attempts
CREATE TABLE dispatch_attempts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    attempt INT NOT NULL,
    status dispatch_status NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX dispatch_attempts_tenant_idx ON dispatch_attempts(tenant_id);
CREATE INDEX dispatch_attempts_tenant_event_idx ON dispatch_attempts(tenant_id, event_id);

-- Setup sessions
CREATE TABLE setup_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
    project_name TEXT NOT NULL,
    state TEXT NOT NULL,
    webhook_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    issues JSONB,
    input JSONB
);
CREATE INDEX setup_sessions_tenant_idx ON setup_sessions(tenant_id);
