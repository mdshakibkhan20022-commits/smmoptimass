/*
# Server-side order placement for the reseller API

1. Changes
- New `place_order_for(user, service, link, quantity)` holds the order logic; only the server
  (service role, used by the reseller API) can call it.
- `place_order(service, link, quantity)` now calls it with the signed-in user (auth.uid()).

2. Security
- `place_order_for` EXECUTE revoked from PUBLIC, anon, authenticated; granted to service_role only.
*/

CREATE OR REPLACE FUNCTION place_order_for(p_user uuid, p_service bigint, p_link text, p_quantity int)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s services%ROWTYPE;
  src service_sources%ROWTYPE;
  p profiles%ROWTYPE;
  v_link text := trim(coalesce(p_link, ''));
  v_charge numeric;
  v_id bigint;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO p FROM profiles WHERE id = p_user FOR UPDATE;
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
REVOKE EXECUTE ON FUNCTION place_order_for(uuid, bigint, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION place_order_for(uuid, bigint, text, int) TO service_role;

CREATE OR REPLACE FUNCTION place_order(p_service bigint, p_link text, p_quantity int)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN place_order_for(auth.uid(), p_service, p_link, p_quantity);
END;
$$;
REVOKE EXECUTE ON FUNCTION place_order(bigint, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION place_order(bigint, text, int) TO authenticated;
