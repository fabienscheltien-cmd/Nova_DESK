CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  reception_email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_services (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  price_cents integer,
  PRIMARY KEY (site_id, service_id)
);
GRANT ALL ON public.site_services TO service_role;
ALTER TABLE public.site_services ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_pickup_schedules (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  pickup_info text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, category_id)
);
GRANT ALL ON public.site_pickup_schedules TO service_role;
ALTER TABLE public.site_pickup_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.allowed_domains ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;