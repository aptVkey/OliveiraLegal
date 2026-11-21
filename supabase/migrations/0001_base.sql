-- Oliveira Legal · Backoffice — esquema base: membros da equipa e papéis
-- Executar no SQL Editor do Supabase (projeto alojado na UE).

create type public.member_role as enum
  ('socio', 'advogado', 'associado', 'estagiario', 'assistente', 'financeiro');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.member_role not null default 'assistente',
  hourly_rate numeric(10,2),          -- taxa cobrada ao cliente (€/h); se vazia usa a do papel
  cost_rate   numeric(10,2),          -- custo interno (€/h)
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Taxa horária padrão por papel
create table public.role_rates (
  role        public.member_role primary key,
  hourly_rate numeric(10,2) not null default 0
);
insert into public.role_rates (role, hourly_rate) values
  ('socio', 0), ('advogado', 0), ('associado', 0), ('estagiario', 0), ('assistente', 0), ('financeiro', 0);

-- Funções auxiliares (security definer evita recursão nas políticas)
create function public.current_role() returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

-- Perfil criado automaticamente quando um utilizador é convidado/criado
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Impede que um membro altere o próprio papel, taxas ou estado
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() is distinct from 'socio' and (
       new.role is distinct from old.role
    or new.hourly_rate is distinct from old.hourly_rate
    or new.cost_rate is distinct from old.cost_rate
    or new.active is distinct from old.active) then
    raise exception 'Sem permissão para alterar papel, taxas ou estado';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Segurança ao nível da linha
alter table public.profiles   enable row level security;
alter table public.role_rates enable row level security;

create policy "Membros veem a equipa" on public.profiles
  for select to authenticated using (public.is_member() or id = auth.uid());

create policy "Membro edita o próprio perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Sócios gerem a equipa" on public.profiles
  for all to authenticated using (public.current_role() = 'socio') with check (public.current_role() = 'socio');

create policy "Membros veem taxas por papel" on public.role_rates
  for select to authenticated using (public.is_member());

create policy "Sócios e financeiro gerem taxas" on public.role_rates
  for all to authenticated
  using (public.current_role() in ('socio', 'financeiro'))
  with check (public.current_role() in ('socio', 'financeiro'));

-- Primeiro sócio: depois de criar o utilizador em Authentication → Users, correr:
-- update public.profiles set role = 'socio', full_name = 'Nome' where id = (select id from auth.users where email = 'email@dominio.pt');
