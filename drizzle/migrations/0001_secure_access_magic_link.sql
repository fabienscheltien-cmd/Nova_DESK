-- Identification par lien magique (Supabase Auth) et fermeture de l'accès anonyme.
-- Les collaborateurs ne voient que leurs réservations ; l'administration passe
-- par des fonctions serveur (clé service_role), jamais par le navigateur.

-- 1. Retrait des droits ouverts à tous
REVOKE ALL ON public.bookings, public.booking_items, public.services, public.service_categories,
  public.allowed_domains, public.email_verifications, public.booking_status_history FROM anon;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.bookings, public.booking_items, public.services,
  public.service_categories, public.allowed_domains, public.booking_status_history FROM authenticated;
--> statement-breakpoint
REVOKE ALL ON public.email_verifications FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON public.services, public.service_categories TO anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.bookings, public.booking_items, public.booking_status_history TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "public manage categories" ON public.service_categories;
--> statement-breakpoint
DROP POLICY IF EXISTS "public manage services" ON public.services;
--> statement-breakpoint
DROP POLICY IF EXISTS "public manage bookings" ON public.bookings;
--> statement-breakpoint
DROP POLICY IF EXISTS "public manage booking items" ON public.booking_items;
--> statement-breakpoint
DROP POLICY IF EXISTS "public manage domains" ON public.allowed_domains;
--> statement-breakpoint
DROP POLICY IF EXISTS "public manage status history" ON public.booking_status_history;
--> statement-breakpoint
DROP POLICY IF EXISTS "email_verifications_open_select" ON public.email_verifications;
--> statement-breakpoint
DROP POLICY IF EXISTS "email_verifications_open_insert" ON public.email_verifications;
--> statement-breakpoint
DROP POLICY IF EXISTS "email_verifications_open_update" ON public.email_verifications;
--> statement-breakpoint

-- 2. Lecture : catalogue public, réservations limitées à leur propriétaire
CREATE POLICY "read catalogue categories" ON public.service_categories
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "read catalogue services" ON public.services
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.owns_booking(_booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_allowed_user() AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = _booking_id
      AND (
        b.user_id = auth.uid()
        -- réservations créées avant l'identification par lien magique
        OR (b.user_id IS NULL AND lower(b.contact_email) = lower(auth.jwt() ->> 'email'))
      )
  )
$$;
--> statement-breakpoint
CREATE POLICY "read own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.owns_booking(id));
--> statement-breakpoint
CREATE POLICY "read own booking items" ON public.booking_items
  FOR SELECT TO authenticated USING (public.owns_booking(booking_id));
--> statement-breakpoint
CREATE POLICY "read own status history" ON public.booking_status_history
  FOR SELECT TO authenticated USING (public.owns_booking(booking_id));
--> statement-breakpoint

-- 3. Écritures collaborateur : uniquement via fonctions contrôlées, prix calculés en base
CREATE OR REPLACE FUNCTION public.create_booking(
  _dropoff_date date,
  _dropoff_slot text,
  _notes text,
  _items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _total int := 0;
  _it jsonb;
  _qty int;
  _svc public.services%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_allowed_user() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'invalid_items' USING ERRCODE = '22023';
  END IF;
  IF _dropoff_date IS NULL OR _dropoff_date < current_date
     OR coalesce(length(_dropoff_slot), 0) NOT BETWEEN 1 AND 50
     OR length(coalesce(_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'invalid_booking' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bookings (user_id, contact_email, dropoff_date, dropoff_slot, notes)
  VALUES (auth.uid(), lower(auth.jwt() ->> 'email'), _dropoff_date, _dropoff_slot,
          nullif(trim(_notes), ''))
  RETURNING id INTO _id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it ->> 'quantity')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 99 THEN
      RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO _svc FROM public.services WHERE id = (_it ->> 'service_id')::uuid AND active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unknown_service' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.booking_items (booking_id, service_id, service_name, quantity, unit_price_cents)
    VALUES (_id, _svc.id, _svc.name, _qty, _svc.price_cents);
    _total := _total + _svc.price_cents * _qty;
  END LOOP;

  UPDATE public.bookings SET total_cents = _total WHERE id = _id;
  RETURN _id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.cancel_my_booking(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.owns_booking(_booking_id) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.bookings SET status = 'cancelled'
  WHERE id = _booking_id AND status = 'pending' AND paid_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_cancellable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.booking_status_history (booking_id, from_status, to_status)
  VALUES (_booking_id, 'pending', 'cancelled');
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.pay_my_booking(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _status public.booking_status;
BEGIN
  IF NOT public.owns_booking(_booking_id) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO _status FROM public.bookings
  WHERE id = _booking_id AND paid_at IS NULL AND status <> 'cancelled'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_payable' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bookings
  SET paid_at = now(),
      payment_method = 'en_ligne',
      status = CASE WHEN _status = 'delivered' THEN 'termine'::public.booking_status ELSE _status END
  WHERE id = _booking_id;
  IF _status = 'delivered' THEN
    INSERT INTO public.booking_status_history (booking_id, from_status, to_status)
    VALUES (_booking_id, 'delivered', 'termine');
  END IF;
END;
$$;
--> statement-breakpoint

-- 4. Modification des prestations par l'accueil : atomique, réservée au serveur
CREATE OR REPLACE FUNCTION public.admin_replace_booking_items(
  _booking_id uuid,
  _items jsonb,
  _note text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total int := 0;
  _it jsonb;
  _qty int;
  _svc public.services%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.bookings
  WHERE id = _booking_id AND paid_at IS NULL AND status NOT IN ('termine', 'cancelled')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_editable' USING ERRCODE = '22023';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'invalid_items' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.booking_items WHERE booking_id = _booking_id;
  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_it ->> 'quantity')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 99 THEN
      RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO _svc FROM public.services WHERE id = (_it ->> 'service_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unknown_service' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.booking_items (booking_id, service_id, service_name, quantity, unit_price_cents)
    VALUES (_booking_id, _svc.id, _svc.name, _qty, _svc.price_cents);
    _total := _total + _svc.price_cents * _qty;
  END LOOP;

  UPDATE public.bookings
  SET total_cents = _total,
      modified_by_reception_at = now(),
      modification_note = nullif(left(trim(coalesce(_note, '')), 300), '')
  WHERE id = _booking_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.owns_booking(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_booking(date, text, text, jsonb) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.cancel_my_booking(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.pay_my_booking(uuid) FROM PUBLIC, anon;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_replace_booking_items(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.owns_booking(uuid) TO authenticated, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_booking(date, text, text, jsonb) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cancel_my_booking(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.pay_my_booking(uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_replace_booking_items(uuid, jsonb, text) TO service_role;
