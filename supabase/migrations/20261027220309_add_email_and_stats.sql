/*
# Business email setup, referral counts and admin stats

1. New Tables
- `email_settings` (single row, id = 1): SMTP host, port, username, password, sender name/email, secure flag, enabled flag.
  - `has_password` generated column so the admin UI can show whether a password is saved without ever reading it.
- `email_templates`: key (unique), name, subject, body, enabled. Seeded with welcome, payment_approved, ticket_reply, order_completed.
- `email_log`: every email the system sends (recipient, subject, kind, status, error).

2. New Functions
- `my_referral_count()`: number of accounts the caller referred.
- `admin_stats()`: totals for the admin overview (admin only).

3. Security
- All three email tables: RLS on, admin only (is_admin()).
- `email_settings.smtp_pass` is NOT selectable by any client role (column-level SELECT grant excludes it). Only the server email function reads it.
- `email_log` is read-only for admins; writes come only from the server (service_role).
*/

CREATE TABLE IF NOT EXISTS email_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  smtp_host text NOT NULL DEFAULT '',
  smtp_port int NOT NULL DEFAULT 465,
  smtp_secure boolean NOT NULL DEFAULT true,
  smtp_user text NOT NULL DEFAULT '',
  smtp_pass text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'SMM OPTIMA',
  from_email text NOT NULL DEFAULT '',
  has_password boolean GENERATED ALWAYS AS (smtp_pass <> '') STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_settings FROM anon, authenticated;
GRANT SELECT (id, enabled, smtp_host, smtp_port, smtp_secure, smtp_user, from_name, from_email, has_password, updated_at) ON email_settings TO authenticated;
GRANT UPDATE (enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_name, from_email, updated_at) ON email_settings TO authenticated;
GRANT SELECT, UPDATE ON email_settings TO service_role;

DROP POLICY IF EXISTS "admin_select_email_settings" ON email_settings;
CREATE POLICY "admin_select_email_settings" ON email_settings FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_update_email_settings" ON email_settings;
CREATE POLICY "admin_update_email_settings" ON email_settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO email_templates (key, name, subject, body) VALUES
  ('welcome', 'Welcome email', 'Welcome to SMM OPTIMA, {username}!', E'Hi {name},\n\nThanks for creating your SMM OPTIMA account. Add balance and place your first order in seconds.\n\nHappy growing!\nThe SMM OPTIMA team'),
  ('payment_approved', 'Payment approved', 'Your payment of {amount} was approved', E'Hi {name},\n\nWe have added {amount} to your balance. Your new balance is {balance}.\n\nThank you for choosing SMM OPTIMA.'),
  ('ticket_reply', 'Ticket reply', 'New reply on ticket #{ticket}', E'Hi {name},\n\nOur support team replied to your ticket #{ticket}:\n\n{message}\n\nSign in to your account to reply.'),
  ('order_completed', 'Order completed', 'Order #{order} completed', E'Hi {name},\n\nYour order #{order} has been completed.\n\nThank you for choosing SMM OPTIMA.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO authenticated;
GRANT SELECT ON email_templates TO service_role;
DROP POLICY IF EXISTS "admin_select_email_templates" ON email_templates;
CREATE POLICY "admin_select_email_templates" ON email_templates FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_insert_email_templates" ON email_templates;
CREATE POLICY "admin_insert_email_templates" ON email_templates FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_update_email_templates" ON email_templates;
CREATE POLICY "admin_update_email_templates" ON email_templates FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_delete_email_templates" ON email_templates;
CREATE POLICY "admin_delete_email_templates" ON email_templates FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'manual',
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_log_created_idx ON email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS email_log_user_kind_idx ON email_log (user_id, kind);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON email_log TO authenticated;
GRANT SELECT, INSERT ON email_log TO service_role;
DROP POLICY IF EXISTS "admin_select_email_log" ON email_log;
CREATE POLICY "admin_select_email_log" ON email_log FOR SELECT TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION my_referral_count()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM profiles WHERE referred_by = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION my_referral_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_referral_count() TO authenticated;

CREATE OR REPLACE FUNCTION admin_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT json_build_object(
    'users', (SELECT count(*) FROM profiles),
    'users_today', (SELECT count(*) FROM profiles WHERE created_at >= date_trunc('day', now())),
    'user_balance', (SELECT coalesce(sum(balance), 0) FROM profiles),
    'orders', (SELECT count(*) FROM orders),
    'orders_today', (SELECT count(*) FROM orders WHERE created_at >= date_trunc('day', now())),
    'active_orders', (SELECT count(*) FROM orders WHERE status IN ('pending', 'processing', 'in_progress')),
    'failed_orders', (SELECT count(*) FROM orders WHERE provider_error IS NOT NULL AND status = 'pending'),
    'revenue', (SELECT coalesce(sum(charge - refunded), 0) FROM orders WHERE status <> 'canceled'),
    'cost', (SELECT coalesce(sum(cost * CASE WHEN quantity > 0 THEN (quantity - coalesce(CASE WHEN status = 'partial' THEN remains END, 0))::numeric / quantity ELSE 0 END), 0) FROM orders WHERE status <> 'canceled'),
    'revenue_today', (SELECT coalesce(sum(charge - refunded), 0) FROM orders WHERE status <> 'canceled' AND created_at >= date_trunc('day', now())),
    'deposits', (SELECT coalesce(sum(amount_usd), 0) FROM payments WHERE status = 'approved' AND method IN ('bkash', 'stripe')),
    'pending_payments', (SELECT count(*) FROM payments WHERE status = 'pending'),
    'open_tickets', (SELECT count(*) FROM tickets WHERE status = 'open')
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_stats() TO authenticated;
