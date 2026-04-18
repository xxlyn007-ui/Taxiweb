-- ============================================================
-- Миграция: новые функции (город-адм, доставка, выплаты)
-- Запустить: psql $DATABASE_URL -f migrate-new-features.sql
-- ============================================================

-- 1. Добавить поля в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_company TEXT;

-- 2. Добавить поля в таблицу drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepts_deliveries BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS partner_company TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS delivery_balance REAL NOT NULL DEFAULT 0;

-- 3. Добавить поля в таблицу orders (для доставки)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS partner_company TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 4. Создать таблицу запросов на выплату
CREATE TABLE IF NOT EXISTS payout_requests (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id),
  amount REAL NOT NULL,
  payment_details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payout_driver_idx ON payout_requests(driver_id);
CREATE INDEX IF NOT EXISTS payout_status_idx ON payout_requests(status);

-- 5. Создать таблицу ежемесячных тарифов по городам
CREATE TABLE IF NOT EXISTS city_fees (
  id SERIAL PRIMARY KEY,
  city TEXT NOT NULL UNIQUE,
  monthly_fee REAL NOT NULL DEFAULT 2000,
  trial_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

