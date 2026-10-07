CREATE TABLE public.domain_pickup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.allowed_domains(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  pickup_info text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_pickup_schedules TO anon, authenticated;
GRANT ALL ON public.domain_pickup_schedules TO service_role;
ALTER TABLE public.domain_pickup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public manage pickup schedules" ON public.domain_pickup_schedules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);