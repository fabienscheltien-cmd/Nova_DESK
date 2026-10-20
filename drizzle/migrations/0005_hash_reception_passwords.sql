CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.reception_accounts ADD COLUMN IF NOT EXISTS password_hash text;

-- Migration des comptes existants : empreinte SHA-256 du mot de passe actuel,
-- acceptée à la connexion pour préserver les accès en place.
UPDATE public.reception_accounts
SET password_hash = encode(extensions.digest(password, 'sha256'), 'hex')
WHERE password IS NOT NULL AND password_hash IS NULL;

COMMENT ON COLUMN public.reception_accounts.password IS 'DEPRECATED: remplacé par password_hash (haché PBKDF2). Ne plus lire ni écrire.';
COMMENT ON COLUMN public.reception_accounts.password_hash IS 'Haché PBKDF2 (pbkdf2:iterations:sel:hash) ou empreinte SHA-256 historique pour les comptes migrés.';