CREATE TABLE public.reception_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  reset_token text UNIQUE,
  reset_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reception_accounts TO service_role;
ALTER TABLE public.reception_accounts ENABLE ROW LEVEL SECURITY;