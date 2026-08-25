-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Allowed domains
create table public.allowed_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.allowed_domains to authenticated;
grant all on public.allowed_domains to service_role;
alter table public.allowed_domains enable row level security;

create or replace function public.is_allowed_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or exists (
    select 1 from public.allowed_domains d
    where d.active
      and lower(d.domain) = lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2))
  )
$$;

create policy "authenticated read domains" on public.allowed_domains for select to authenticated using (true);
create policy "admins manage domains" on public.allowed_domains for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Catalogue
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.service_categories to authenticated;
grant all on public.service_categories to service_role;
alter table public.service_categories enable row level security;

create policy "allowed users read categories" on public.service_categories for select to authenticated
  using (public.is_allowed_user());
create policy "admins manage categories" on public.service_categories for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  name text not null,
  description text,
  price_cents int not null default 0,
  lead_time_hours int not null default 24,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;

create policy "allowed users read services" on public.services for select to authenticated
  using (public.is_allowed_user());
create policy "admins manage services" on public.services for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Bookings
create type public.booking_status as enum ('pending', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reference text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status public.booking_status not null default 'pending',
  dropoff_date date not null,
  dropoff_slot text not null,
  location text,
  notes text,
  total_cents int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;

create policy "read own bookings" on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "create own bookings" on public.bookings for insert to authenticated
  with check (user_id = auth.uid() and public.is_allowed_user());
create policy "cancel own bookings" on public.bookings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admins manage bookings" on public.bookings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid not null references public.services(id),
  service_name text not null,
  quantity int not null default 1,
  unit_price_cents int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.booking_items to authenticated;
grant all on public.booking_items to service_role;
alter table public.booking_items enable row level security;

create policy "read own booking items" on public.booking_items for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and (b.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))));
create policy "create own booking items" on public.booking_items for insert to authenticated
  with check (exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "admins manage booking items" on public.booking_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger bookings_updated_at before update on public.bookings
for each row execute function public.update_updated_at_column();

-- Seed
insert into public.allowed_domains (domain, label) values ('entreprise.com', 'Domaine de démonstration');

insert into public.service_categories (id, name, slug, description, icon, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'Pressing', 'pressing', 'Nettoyage et repassage de vos vêtements', 'shirt', 1),
  ('22222222-2222-4222-8222-222222222222', 'Cordonnerie', 'cordonnerie', 'Réparation et entretien de vos chaussures', 'footprints', 2),
  ('33333333-3333-4333-8333-333333333333', 'Retouches', 'retouches', 'Ajustements et réparations textiles', 'scissors', 3),
  ('44444444-4444-4444-8444-444444444444', 'Colis & courses', 'colis', 'Réception de colis et petites courses', 'package', 4);

insert into public.services (category_id, name, description, price_cents, lead_time_hours, sort_order) values
  ('11111111-1111-4111-8111-111111111111', 'Chemise', 'Nettoyage + repassage, sur cintre', 550, 48, 1),
  ('11111111-1111-4111-8111-111111111111', 'Pantalon', 'Nettoyage à sec + pli', 750, 48, 2),
  ('11111111-1111-4111-8111-111111111111', 'Costume 2 pièces', 'Veste + pantalon, nettoyage à sec', 1900, 72, 3),
  ('11111111-1111-4111-8111-111111111111', 'Manteau', 'Nettoyage à sec longue pièce', 2400, 96, 4),
  ('22222222-2222-4222-8222-222222222222', 'Ressemelage cuir', 'Semelle cuir première qualité', 4900, 120, 1),
  ('22222222-2222-4222-8222-222222222222', 'Talons', 'Remplacement de bonbouts', 1900, 72, 2),
  ('22222222-2222-4222-8222-222222222222', 'Cirage & nourrissage', 'Entretien complet du cuir', 1200, 24, 3),
  ('33333333-3333-4333-8333-333333333333', 'Ourlet pantalon', 'Simple, à la machine', 1400, 72, 1),
  ('33333333-3333-4333-8333-333333333333', 'Changement de fermeture', 'Zip veste ou pantalon', 2200, 96, 2),
  ('33333333-3333-4333-8333-333333333333', 'Reprise de couture', 'Petite réparation textile', 900, 48, 3),
  ('44444444-4444-4444-8444-444444444444', 'Réception de colis', 'Stockage sécurisé jusqu''à 7 jours', 300, 2, 1),
  ('44444444-4444-4444-8444-444444444444', 'Envoi de colis', 'Dépôt en point relais', 800, 24, 2),
  ('44444444-4444-4444-8444-444444444444', 'Course de proximité', 'Pharmacie, pressing externe, etc.', 1500, 24, 3);