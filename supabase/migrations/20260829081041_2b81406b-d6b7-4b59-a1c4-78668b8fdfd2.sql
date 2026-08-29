CREATE TABLE public.email_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_verifications_email ON public.email_verifications (email);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verifications TO authenticated;
GRANT ALL ON public.email_verifications TO service_role;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_verifications_open_select" ON public.email_verifications FOR SELECT USING (true);
CREATE POLICY "email_verifications_open_insert" ON public.email_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "email_verifications_open_update" ON public.email_verifications FOR UPDATE USING (true) WITH CHECK (true);