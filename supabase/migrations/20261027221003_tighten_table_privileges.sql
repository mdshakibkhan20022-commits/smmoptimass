/*
# Tighten table privileges

The platform's default grants gave the anon and authenticated roles full read/write on every table, which meant
row-level policies were the only guard and customers could edit privileged columns on their own rows
(for example their balance, role or ban status). This migration resets privileges to exactly what the app uses.

1. Changes
- Revoke all table privileges from `anon` and `authenticated` on every app table, then grant back the minimum:
  - Public catalog (`announcements`, `categories`, `services`, `settings`): SELECT for anon + authenticated.
  - Admin-managed tables (`announcements`, `categories`, `services`, `providers`, `service_sources`, `email_templates`): full CRUD for authenticated; existing policies limit writes to admins.
  - `settings`: UPDATE on editable columns only (admins, by policy).
  - `profiles`: SELECT, and UPDATE only on `full_name` and `whatsapp`.
  - `orders`, `payments`, `email_log`: SELECT only. All writes go through checked server functions.
  - `tickets`: SELECT, INSERT (subject, order_ref), UPDATE (status).
  - `ticket_messages`: SELECT, INSERT (ticket_id, message).
  - `email_settings`: SELECT on every column except the SMTP password; UPDATE on editable columns.
- `service_role` keeps full access for server functions.

2. Policy change
- `tickets` update: customers may only close their own ticket; admins may set any status.
*/

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['announcements','categories','services','settings','providers','service_sources','profiles','orders','payments','tickets','ticket_messages','email_settings','email_templates','email_log']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT SELECT ON announcements, categories, services, settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON announcements, categories, services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON providers, service_sources, email_templates TO authenticated;

GRANT UPDATE (site_name, bkash_number, bkash_account_type, usd_to_bdt, min_deposit_usd, affiliate_rate, whatsapp, telegram, support_email, notice, updated_at) ON settings TO authenticated;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (full_name, whatsapp) ON profiles TO authenticated;

GRANT SELECT ON orders, payments, email_log TO authenticated;

GRANT SELECT ON tickets TO authenticated;
GRANT INSERT (subject, order_ref) ON tickets TO authenticated;
GRANT UPDATE (status) ON tickets TO authenticated;

GRANT SELECT ON ticket_messages TO authenticated;
GRANT INSERT (ticket_id, message) ON ticket_messages TO authenticated;

GRANT SELECT (id, enabled, smtp_host, smtp_port, smtp_secure, smtp_user, from_name, from_email, has_password, updated_at) ON email_settings TO authenticated;
GRANT UPDATE (enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_name, from_email, updated_at) ON email_settings TO authenticated;

DROP POLICY IF EXISTS "tickets_update_own_or_admin" ON tickets;
CREATE POLICY "tickets_update_own_or_admin" ON tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (is_admin() OR (user_id = auth.uid() AND status = 'closed'));
