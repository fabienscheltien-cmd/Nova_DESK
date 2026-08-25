revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_allowed_user() from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_allowed_user() to authenticated, service_role;