-- Oliveira Legal · Backoffice — hierarquia Cliente → Caso → Tarefa e custos agregados
-- • Equipa do cliente (vários membros por cliente)
-- • Tempo ligado à tarefa (o caso passa a ser sempre o da tarefa)
-- • Custo interno de cada registo (custo/hora do membro no momento)
-- • Totais calculados por tarefa, caso e cliente (respeitam as permissões de quem consulta)

-- ── Equipa do cliente ──────────────────────────────────────────────────
create table public.client_members (
  client_id uuid not null references public.clients (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (client_id, member_id)
);
alter table public.client_members enable row level security;

create policy "ver equipa do cliente" on public.client_members for select to authenticated using (public.is_member());
create policy "gerir equipa do cliente" on public.client_members for insert to authenticated
  with check (public.current_role() in ('socio', 'advogado', 'associado'));
create policy "remover da equipa do cliente" on public.client_members for delete to authenticated
  using (public.current_role() in ('socio', 'advogado', 'associado'));

-- Quem entra na equipa de um caso passa a estar associado ao cliente desse caso
create function public.sync_client_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.client_members (client_id, member_id)
  select c.client_id, new.member_id from public.cases c where c.id = new.case_id
  on conflict do nothing;
  return null;
end $$;
create trigger case_members_sync_client after insert on public.case_members
  for each row execute function public.sync_client_member();

insert into public.client_members (client_id, member_id)
select distinct c.client_id, m.member_id from public.case_members m join public.cases c on c.id = m.case_id
on conflict do nothing;

-- ── Custo interno nos registos de tempo ───────────────────────────────
alter table public.time_entries add column cost_rate numeric(10,2) not null default 0;
alter table public.time_entries add column cost_amount numeric(12,2) generated always as
  (case when minutes is not null then round(minutes / 60.0 * cost_rate, 2) else 0 end) stored;
create index on public.time_entries (task_id);

-- Mesmas regras de 0003 + custo fixado no servidor + caso herdado da tarefa
create or replace function public.time_entry_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inc int;
  raw numeric;
  task_case uuid;
  mgr boolean := public.is_manager();
begin
  if tg_op = 'INSERT' then
    if new.member_id is null then new.member_id := auth.uid(); end if;
    if auth.uid() is not null and new.member_id <> auth.uid() and not mgr then
      raise exception 'Só pode registar tempo em seu nome';
    end if;
    new.rate := public.resolve_rate(new.member_id);
    new.cost_rate := coalesce((select cost_rate from public.profiles where id = new.member_id), 0);
    new.status := 'por_faturar';
    new.invoice_id := null;
  else
    if new.member_id <> old.member_id then
      raise exception 'Não é possível mudar o membro de um registo';
    end if;
    if auth.uid() is not null and not mgr then
      if old.status = 'faturado' then raise exception 'Registo já faturado: não pode ser alterado'; end if;
      new.rate := old.rate;
      new.cost_rate := old.cost_rate;
      new.status := old.status;
      new.invoice_id := old.invoice_id;
    end if;
  end if;

  -- O tempo de uma tarefa conta sempre para o caso dessa tarefa
  if new.task_id is not null then
    select case_id into task_case from public.tasks where id = new.task_id;
    if task_case is not null then new.case_id := task_case; end if;
  end if;

  if new.case_id is null and new.billable then
    raise exception 'Horas faturáveis têm de estar associadas a um caso';
  end if;

  if new.ended_at is not null and (tg_op = 'INSERT'
      or new.ended_at is distinct from old.ended_at or new.started_at is distinct from old.started_at) then
    select time_increment into inc from public.office_settings where id = 1;
    raw := extract(epoch from (new.ended_at - new.started_at)) / 60.0;
    new.minutes := greatest(inc, ceil(raw / inc) * inc)::int;
  end if;
  return new;
end $$;

update public.time_entries t set cost_rate = coalesce(p.cost_rate, 0)
from public.profiles p where p.id = t.member_id;

-- A equipa de um caso vê todo o tempo desse caso (para os totais do caso serem completos)
drop policy "ver tempo" on public.time_entries;
create policy "ver tempo" on public.time_entries for select to authenticated using (
  public.is_member() and (member_id = auth.uid() or public.is_manager()
    or (case_id is not null and public.can_see_case(case_id))));

-- ── Totais (security_invoker: cada um só soma o que pode ver) ─────────
create view public.task_totals with (security_invoker = true) as
select task_id,
  coalesce(sum(minutes), 0)::int as minutes,
  coalesce(sum(amount), 0)       as amount,
  coalesce(sum(cost_amount), 0)  as cost
from public.time_entries
where task_id is not null and ended_at is not null
group by task_id;

create view public.case_totals with (security_invoker = true) as
select case_id,
  coalesce(sum(minutes) filter (where billable), 0)::int     as billable_minutes,
  coalesce(sum(minutes) filter (where not billable), 0)::int as nonbillable_minutes,
  coalesce(sum(amount), 0)                                   as amount,
  coalesce(sum(cost_amount), 0)                              as cost,
  coalesce(sum(amount) filter (where status = 'por_faturar'), 0) as unbilled
from public.time_entries
where case_id is not null and ended_at is not null
group by case_id;

create view public.client_totals with (security_invoker = true) as
select k.client_id,
  count(*)::int                                          as cases_total,
  count(*) filter (where k.status <> 'fechado')::int     as cases_open,
  coalesce(sum(t.billable_minutes), 0)::int              as billable_minutes,
  coalesce(sum(t.nonbillable_minutes), 0)::int           as nonbillable_minutes,
  coalesce(sum(t.amount), 0)                             as amount,
  coalesce(sum(t.cost), 0)                               as cost,
  coalesce(sum(t.unbilled), 0)                           as unbilled
from public.cases k
left join public.case_totals t on t.case_id = k.id
group by k.client_id;

-- ── Permissões ─────────────────────────────────────────────────────────
revoke all on public.client_members, public.task_totals, public.case_totals, public.client_totals from anon;
grant select, insert, delete on public.client_members to authenticated;
grant select on public.task_totals, public.case_totals, public.client_totals to authenticated;
