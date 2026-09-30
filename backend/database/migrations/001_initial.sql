CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN','MANAGER','VIEWER')),
  password_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_organizations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN','MANAGER','VIEWER')), PRIMARY KEY (user_id, organization_id)
);
CREATE TABLE IF NOT EXISTS sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE','OFFLINE','DEGRADED')),
  last_reading TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS energy_readings (
  id BIGSERIAL PRIMARY KEY, sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE, timestamp TIMESTAMPTZ NOT NULL,
  energy_kwh NUMERIC(12,3) NOT NULL, power_kw NUMERIC(12,3) NOT NULL, voltage NUMERIC(12,3), current NUMERIC(12,3), carbon_factor NUMERIC(8,4) NOT NULL DEFAULT 0.5
);
CREATE INDEX IF NOT EXISTS energy_readings_sensor_time_idx ON energy_readings(sensor_id, timestamp DESC);
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sector TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OFF' CHECK (status IN ('ON','OFF','MAINTENANCE')),
  base_power_kw NUMERIC(12,3) NOT NULL, current_power_kw NUMERIC(12,3) NOT NULL
);
CREATE TABLE IF NOT EXISTS optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), before_kwh NUMERIC(12,3) NOT NULL, after_kwh NUMERIC(12,3) NOT NULL,
  before_co2 NUMERIC(12,3) NOT NULL, after_co2 NUMERIC(12,3) NOT NULL, before_cost NUMERIC(12,3) NOT NULL,
  after_cost NUMERIC(12,3) NOT NULL, estimated_savings NUMERIC(12,3) NOT NULL, scenario JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL, priority TEXT NOT NULL CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  estimated_savings NUMERIC(12,3) NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','APPLIED','DISMISSED')),
  factors JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, configuration JSONB NOT NULL, result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preferences JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
