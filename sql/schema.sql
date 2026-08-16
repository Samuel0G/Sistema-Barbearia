-- Schema do Sistema Samuca (agendamentos de barbearia)
-- Rode este arquivo uma vez no seu banco Neon/Vercel Postgres antes de usar o app.

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 10
);

INSERT INTO services (id, name, price, duration_minutes, buffer_minutes) VALUES
  ('corte', 'Corte Masculino', 'R$ 35', 40, 10),
  ('barba', 'Barba na Navalha', 'R$ 30', 20, 10),
  ('combo', 'Corte + Barba', 'R$ 60', 80, 10),
  ('combo-completo', 'Corte + Barba + Sobrancelha', 'R$ 70', 100, 10),
  ('sobrancelha', 'Sobrancelha', 'R$ 15', 20, 10)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  opening_time TEXT NOT NULL DEFAULT '07:00',
  closing_time TEXT NOT NULL DEFAULT '19:00',
  window_minutes INTEGER NOT NULL DEFAULT 60,
  lunch_enabled BOOLEAN NOT NULL DEFAULT false,
  lunch_start TEXT NOT NULL DEFAULT '12:00',
  lunch_end TEXT NOT NULL DEFAULT '13:00',
  closed_windows JSONB NOT NULL DEFAULT '{}',
  reopened_lunch_windows JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  service TEXT NOT NULL,
  service_id TEXT,
  barber TEXT NOT NULL,
  date DATE NOT NULL,
  window_start TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'agendado',
  origin TEXT NOT NULL DEFAULT 'online',
  status TEXT NOT NULL DEFAULT 'agendado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_appointments_date_barber
  ON appointments (date, barber, window_start);
