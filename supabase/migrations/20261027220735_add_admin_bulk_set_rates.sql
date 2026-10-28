/*
# Bulk price update for services

1. New Functions
- `admin_bulk_set_rates(p_items jsonb)`: takes a list of {id, rate} pairs and updates each service's price per 1000 in one call. Returns how many services were updated.

2. Security
- SECURITY DEFINER with a fixed search_path; checks is_admin() for the caller before doing anything.
- Rejects negative prices.
- EXECUTE revoked from PUBLIC and anon; granted to authenticated (non-admins are refused inside).
*/

CREATE OR REPLACE FUNCTION admin_bulk_set_rates(p_items jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Invalid input';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) e WHERE (e->>'rate')::numeric < 0) THEN
    RAISE EXCEPTION 'Price cannot be negative';
  END IF;

  UPDATE services s
  SET rate = (e->>'rate')::numeric
  FROM jsonb_array_elements(p_items) e
  WHERE s.id = (e->>'id')::bigint;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_bulk_set_rates(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_bulk_set_rates(jsonb) TO authenticated;
