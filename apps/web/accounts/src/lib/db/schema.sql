-- LetBuyy Auth System - Database Schema
-- Run this in Supabase SQL Editor

-- Users: Core user data
CREATE TABLE IF NOT EXISTS users_custom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  full_name TEXT,
  avatar_url TEXT,
  auth_provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices: Fingerprinted devices for trust system
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  name TEXT,
  trusted BOOLEAN DEFAULT FALSE,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fingerprint)
);

-- Sessions: Server-managed sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- Verification tokens: Email verify, magic links, password resets
CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users_custom(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email_verify', 'magic_link', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_email ON verification_tokens(email);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users_custom(email);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id, fingerprint);

-- Enable Row Level Security
ALTER TABLE users_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow service role full access (API routes use service role)
CREATE POLICY "Service role full access" ON users_custom FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON verification_tokens FOR ALL USING (true) WITH CHECK (true);
