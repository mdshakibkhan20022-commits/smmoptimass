/*
# SMM OPTIMA business actions

All money-related changes happen here, on the server, so customers can never set their own
balance or prices.

1. Customer functions (signed-in users)
- `place_order(service, link, quantity)` – checks service is active, quantity is within min/max,
  computes price from the server's catalog minus tier discount, deducts balance and creates the order.
- `submit_bkash_payment(amount_bdt, trx_id, sender)` – records a manual bKash deposit for review.
- `request_refill(order)`, `request_cancel(order)` – flag eligible orders.
- `regenerate_api_key()`, `transfer_affiliate_earnings()`.

2. Admin functions (require role = admin)
- `admin_set_order_status`, `admin_review_payment` (credits balance + affiliate commission),
  `admin_adjust_balance`, `admin_update_user`.

3. Internal
- `settle_order` – applies a status and refunds canceled/partial orders exactly once.
  Callable only by the server (service role) and through the admin wrapper.

4. Security
- Every function is SECURITY DEFINER with a fixed search_path, derives the caller from auth.uid(),
  and EXECUTE is revoked from anon.
*/

CREATE OR REPLACE FUNCTION settle_order(p_order bigint, p_status text, p_start int, p_remains int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o orders%ROWTYPE;
  v_target numeric := 0;
  v_refund numeric := 0;
BEGIN
  IF p_status NOT IN ('pending','processing','in_progress','completed','partial','canceled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_status = 'canceled' THEN
    v_target := o.charge;
  ELSIF p_status = 'partial' THEN
    v_target := round(o.charge * least(greatest(coalesce(p_remains, o.remains, 0), 0), o.quantity)::numeric / o.quantity, 4);
  END IF;
  v_refund := greatest(v_target - o.refunded, 0);

  UPDATE orders SET status = p_status,
         start_count = coalesce(p_start, start_count),
         remains = coalesce(p_remains, remains),
         refunded = refunded + v_refund,
         updated_at = now()
   WHERE id = p_order;

  IF v_refund > 0 THEN
    UPDATE profiles SET balance = balance + v_refund,
           total_spent = greatest(total_spent - v_refund, 0)
     WHERE id = o.user_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION settle_order(bigint, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION settle_order(bigint, text, int, int) TO service_role;

CREATE OR REPLACE FUNCTION place_order(p_service bigint, p_link text, p_quantity int)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s services%ROWTYPE;
  src service_sources%ROWTYPE;
  p profiles%ROWTYPE;
  v_link text := trim(coalesce(p_link, ''));
  v_charge numeric;
  v_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO p FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR p.status <> 'active' THEN RAISE EXCEPTION 'Account not active'; END IF;

  SELECT sv.* INTO s FROM services sv JOIN categories c ON c.id = sv.category_id
   WHERE sv.id = p_service AND sv.active AND c.active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service unavailable'; END IF;

  IF char_length(v_link) < 3 OR char_length(v_link) > 500 THEN RAISE EXCEPTION 'Invalid link'; END IF;
  IF p_quantity IS NULL OR p_quantity < s.min_qty OR p_quantity > s.max_qty THEN
    RAISE EXCEPTION 'Quantity out of range';
  END IF;

  v_charge := round(s.rate * p_quantity / 1000.0 * (100 - tier_discount(p.total_spent)) / 100.0, 4);
  IF v_charge > p.balance THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT * INTO src FROM service_sources WHERE service_id = s.id;

  UPDATE profiles SET balance = balance - v_charge, total_spent = total_spent + v_charge WHERE id = p.id;

  INSERT INTO orders (user_id, service_id, service_name, link, quantity, charge, cost,
                      provider_id, provider_service_id, remains)
  VALUES (p.id, s.id, s.name, v_link, p_quantity, v_charge,
          round(coalesce(src.provider_rate, 0) * p_quantity / 1000.0, 4),
          src.provider_id, src.provider_service_id, p_quantity)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION place_order(bigint, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION place_order(bigint, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION submit_bkash_payment(p_amount_bdt numeric, p_trx text, p_sender text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st settings%ROWTYPE;
  v_usd numeric;
  v_id uuid;
  v_trx text := upper(trim(coalesce(p_trx, '')));
  v_sender text := trim(coalesce(p_sender, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO st FROM settings WHERE id = 1;
  IF p_amount_bdt IS NULL OR p_amount_bdt <= 0 OR p_amount_bdt > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF v_trx !~ '^[A-Z0-9]{6,20}$' THEN RAISE EXCEPTION 'Invalid transaction ID'; END IF;
  IF v_sender !~ '^[0-9+ ]{10,15}$' THEN RAISE EXCEPTION 'Invalid sender number'; END IF;
  v_usd := round(p_amount_bdt / st.usd_to_bdt, 4);
  IF v_usd < st.min_deposit_usd THEN RAISE EXCEPTION 'Below minimum deposit'; END IF;
  IF (SELECT count(*) FROM payments WHERE user_id = auth.uid() AND status = 'pending') >= 5 THEN
    RAISE EXCEPTION 'Too many pending payments';
  END IF;

  INSERT INTO payments (user_id, method, amount_usd, amount_bdt, trx_id, sender_number)
  VALUES (auth.uid(), 'bkash', v_usd, round(p_amount_bdt, 2), v_trx, v_sender)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION submit_bkash_payment(numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_bkash_payment(numeric, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION request_refill(p_order bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE orders o SET refill_status = 'requested', updated_at = now()
    FROM services s
   WHERE o.id = p_order AND o.user_id = auth.uid() AND s.id = o.service_id AND s.refill
     AND o.status IN ('completed','partial') AND o.refill_status IN ('none','failed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Refill not available'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION request_refill(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_refill(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION request_cancel(p_order bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR o.status NOT IN ('pending','processing','in_progress') THEN
    RAISE EXCEPTION 'Cancel not available';
  END IF;
  IF o.provider_order_id IS NULL AND o.status = 'pending' THEN
    PERFORM settle_order(o.id, 'canceled', NULL, o.quantity);
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM services s WHERE s.id = o.service_id AND s.cancel) THEN
    RAISE EXCEPTION 'Cancel not available';
  END IF;
  UPDATE orders SET cancel_requested = true, updated_at = now() WHERE id = o.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION request_cancel(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_cancel(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION regenerate_api_key()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text := encode(extensions.gen_random_bytes(16), 'hex');
BEGIN
  UPDATE profiles SET api_key = v_key WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not signed in'; END IF;
  RETURN v_key;
END;
$$;
REVOKE EXECUTE ON FUNCTION regenerate_api_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION regenerate_api_key() TO authenticated;

CREATE OR REPLACE FUNCTION transfer_affiliate_earnings()
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amount numeric;
BEGIN
  UPDATE profiles SET balance = balance + affiliate_earnings, affiliate_earnings = 0
   WHERE id = auth.uid() AND affiliate_earnings >= 1
   RETURNING balance INTO v_amount;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'Minimum transfer is $1'; END IF;
  RETURN v_amount;
END;
$$;
REVOKE EXECUTE ON FUNCTION transfer_affiliate_earnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION transfer_affiliate_earnings() TO authenticated;

-- Admin
CREATE OR REPLACE FUNCTION admin_set_order_status(p_order bigint, p_status text, p_start int, p_remains int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM settle_order(p_order, p_status, p_start, p_remains);
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_set_order_status(bigint, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_order_status(bigint, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION admin_review_payment(p_payment uuid, p_approve boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pay payments%ROWTYPE;
  v_ref uuid;
  v_rate numeric;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE payments SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         note = coalesce(p_note, ''), reviewed_at = now()
   WHERE id = p_payment AND status = 'pending'
   RETURNING * INTO pay;
  IF pay.id IS NULL THEN RAISE EXCEPTION 'Payment already reviewed'; END IF;
  IF p_approve THEN
    UPDATE profiles SET balance = balance + pay.amount_usd WHERE id = pay.user_id
      RETURNING referred_by INTO v_ref;
    IF v_ref IS NOT NULL THEN
      SELECT affiliate_rate INTO v_rate FROM settings WHERE id = 1;
      UPDATE profiles SET affiliate_earnings = affiliate_earnings + round(pay.amount_usd * v_rate / 100, 4)
       WHERE id = v_ref;
    END IF;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_review_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_review_payment(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_adjust_balance(p_user uuid, p_amount numeric, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 1000000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE profiles SET balance = balance + p_amount WHERE id = p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO payments (user_id, method, amount_usd, status, note, reviewed_at)
  VALUES (p_user, 'admin', p_amount, 'approved', coalesce(p_note, ''), now());
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_adjust_balance(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_adjust_balance(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin_update_user(p_user uuid, p_status text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own account here'; END IF;
  IF p_status NOT IN ('active','banned') OR p_role NOT IN ('user','admin') THEN RAISE EXCEPTION 'Invalid value'; END IF;
  UPDATE profiles SET status = p_status, role = p_role WHERE id = p_user;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_update_user(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_update_user(uuid, text, text) TO authenticated;
