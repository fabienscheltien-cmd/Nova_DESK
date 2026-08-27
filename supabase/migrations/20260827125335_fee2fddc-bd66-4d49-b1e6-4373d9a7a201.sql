ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

INSERT INTO public.allowed_domains (domain, label, active)
VALUES ('novazen.fr', 'Nova Zen', true), ('example.com', 'Démonstration', true)
ON CONFLICT DO NOTHING;