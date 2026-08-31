ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'termine';

CREATE TABLE public.booking_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_status public.booking_status,
  to_status public.booking_status NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_status_history TO anon;
GRANT SELECT, INSERT ON public.booking_status_history TO authenticated;
GRANT ALL ON public.booking_status_history TO service_role;

ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public manage status history" ON public.booking_status_history FOR ALL USING (true) WITH CHECK (true);