-- Accès public sans identification : ouverture complète des tables applicatives à anon
alter table public.bookings alter column user_id drop not null;

grant select, insert, update, delete on public.bookings to anon;
grant select, insert, update, delete on public.booking_items to anon;
grant select, insert, update, delete on public.services to anon;
grant select, insert, update, delete on public.service_categories to anon;
grant select, insert, update, delete on public.allowed_domains to anon;

-- Catalogue
drop policy if exists "allowed users read categories" on public.service_categories;
drop policy if exists "admins manage categories" on public.service_categories;
create policy "public manage categories" on public.service_categories
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "allowed users read services" on public.services;
drop policy if exists "admins manage services" on public.services;
create policy "public manage services" on public.services
  for all to anon, authenticated using (true) with check (true);

-- Réservations
drop policy if exists "admins manage bookings" on public.bookings;
drop policy if exists "cancel own bookings" on public.bookings;
drop policy if exists "create own bookings" on public.bookings;
drop policy if exists "read own bookings" on public.bookings;
create policy "public manage bookings" on public.bookings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "admins manage booking items" on public.booking_items;
drop policy if exists "create own booking items" on public.booking_items;
drop policy if exists "read own booking items" on public.booking_items;
create policy "public manage booking items" on public.booking_items
  for all to anon, authenticated using (true) with check (true);

-- Domaines autorisés (conservés pour usage futur, gérés depuis l'admin ouvert)
drop policy if exists "admins manage domains" on public.allowed_domains;
drop policy if exists "authenticated read domains" on public.allowed_domains;
create policy "public manage domains" on public.allowed_domains
  for all to anon, authenticated using (true) with check (true);