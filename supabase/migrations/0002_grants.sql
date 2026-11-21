-- Permissões da API para utilizadores com sessão (a RLS continua a limitar cada linha).
-- O papel "anon" (sem sessão) não recebe nada.
grant usage on schema public to authenticated;

grant select, update on public.profiles   to authenticated;
grant select, insert, update, delete on public.role_rates to authenticated;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_member()    to authenticated;
