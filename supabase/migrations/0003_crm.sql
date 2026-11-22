-- Oliveira Legal · Backoffice — CRM e gestão do escritório
-- Leads, clientes, casos, equipa por caso, tarefas, tempo, pré-faturas, auditoria.
-- Segurança: RLS em todas as tabelas; o papel "anon" não tem acesso a nada.

-- ── Tipos ──────────────────────────────────────────────────────────────
create type public.client_kind    as enum ('particular', 'empresa');
create type public.lead_stage     as enum ('novo', 'contactado', 'reuniao', 'proposta', 'ganho', 'perdido');
create type public.lead_source    as enum ('site', 'indicacao', 'redes_sociais', 'telefone', 'outro');
create type public.case_status    as enum ('aberto', 'em_curso', 'suspenso', 'fechado');
create type public.billing_type   as enum ('hora', 'fixo', 'avenca');
create type public.task_priority  as enum ('baixa', 'media', 'alta');
create type public.task_status    as enum ('por_fazer', 'em_curso', 'concluida');
create type public.entry_status   as enum ('por_faturar', 'faturado');
create type public.invoice_status as enum ('rascunho', 'emitida', 'anulada');

-- ── Tabelas ────────────────────────────────────────────────────────────
create table public.office_settings (
  id             int primary key default 1 check (id = 1),
  time_increment int not null default 6 check (time_increment between 1 and 60)  -- minutos
);
insert into public.office_settings default values;

create table public.practice_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.practice_areas (name) values
  ('Direito Imobiliário'), ('Comercial e Societário'), ('Família e Sucessões'),
  ('Direito do Trabalho'), ('Contencioso e Arbitragem'), ('Estrangeiros e Investimento');

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  kind         public.client_kind not null default 'particular',
  name         text not null check (length(trim(name)) > 0),
  nif          text,
  email        text,
  phone        text,
  address      text,
  notes        text,
  rgpd_consent boolean not null default false,
  consent_at   timestamptz,
  archived     boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) > 0),
  email           text,
  phone           text,
  company         text,
  source          public.lead_source not null default 'site',
  stage           public.lead_stage not null default 'novo',
  area_id         uuid references public.practice_areas (id) on delete set null,
  owner_id        uuid references public.profiles (id) on delete set null,
  estimated_value numeric(12,2),
  notes           text,
  lost_reason     text,
  client_id       uuid references public.clients (id) on delete set null,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create sequence public.case_ref_seq;
create table public.cases (
  id             uuid primary key default gen_random_uuid(),
  reference      text unique,
  title          text not null check (length(trim(title)) > 0),
  client_id      uuid not null references public.clients (id) on delete restrict,
  area_id        uuid references public.practice_areas (id) on delete set null,
  opposing_party text,
  status         public.case_status not null default 'aberto',
  billing_type   public.billing_type not null default 'hora',
  fixed_fee      numeric(12,2),
  responsible_id uuid references public.profiles (id) on delete set null,
  description    text,
  opened_at      date not null default current_date,
  closed_at      date,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.case_members (
  case_id   uuid not null references public.cases (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (case_id, member_id)
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid references public.cases (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  description  text,
  assignee_id  uuid references public.profiles (id) on delete set null,
  due_date     date,
  priority     public.task_priority not null default 'media',
  status       public.task_status not null default 'por_fazer',
  completed_at timestamptz,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create sequence public.invoice_seq;
create table public.invoices (
  id         uuid primary key default gen_random_uuid(),
  number     text not null unique,
  client_id  uuid not null references public.clients (id) on delete restrict,
  status     public.invoice_status not null default 'rascunho',
  total      numeric(12,2) not null default 0,
  notes      text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  case_id     uuid references public.cases (id) on delete restrict,
  task_id     uuid references public.tasks (id) on delete set null,
  description text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,                       -- nulo = cronómetro a correr
  minutes     int check (minutes >= 0),
  billable    boolean not null default true,
  rate        numeric(10,2) not null default 0,  -- taxa fixada no momento do registo
  amount      numeric(12,2) generated always as
                (case when billable and minutes is not null then round(minutes / 60.0 * rate, 2) else 0 end) stored,
  status      public.entry_status not null default 'por_faturar',
  invoice_id  uuid references public.invoices (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (case_id is not null or billable = false)
);
-- Um só cronómetro ativo por membro
create unique index time_entries_one_running on public.time_entries (member_id) where ended_at is null;

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  at         timestamptz not null default now()
);

create index on public.leads (stage);
create index on public.cases (client_id);
create index on public.cases (status);
create index on public.tasks (assignee_id, status);
create index on public.tasks (case_id);
create index on public.time_entries (member_id, started_at);
create index on public.time_entries (case_id);
create index on public.time_entries (invoice_id);

-- ── Funções de acesso ──────────────────────────────────────────────────
create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() in ('socio', 'financeiro'), false)
$$;

create function public.is_case_member(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.case_members m where m.case_id = p_case and m.member_id = auth.uid())
$$;

create function public.can_see_case(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() and (
    public.is_manager()
    or exists (select 1 from public.cases c where c.id = p_case
               and (c.responsible_id = auth.uid() or c.created_by = auth.uid()))
    or exists (select 1 from public.case_members m where m.case_id = p_case and m.member_id = auth.uid())
  )
$$;

create function public.can_edit_case(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() and (
    public.current_role() = 'socio'
    or exists (select 1 from public.cases c where c.id = p_case
               and (c.responsible_id = auth.uid() or c.created_by = auth.uid()))
    or exists (select 1 from public.case_members m where m.case_id = p_case and m.member_id = auth.uid())
  )
$$;

-- Taxa horária de um membro: a do próprio, senão a do papel
create function public.resolve_rate(p_member uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(p.hourly_rate, r.hourly_rate, 0)
  from public.profiles p left join public.role_rates r on r.role = p.role
  where p.id = p_member
$$;

-- ── Gatilhos ───────────────────────────────────────────────────────────
create trigger clients_updated_at  before update on public.clients  for each row execute function public.touch_updated_at();
create trigger leads_updated_at    before update on public.leads    for each row execute function public.touch_updated_at();
create trigger cases_updated_at    before update on public.cases    for each row execute function public.touch_updated_at();
create trigger tasks_updated_at    before update on public.tasks    for each row execute function public.touch_updated_at();
create trigger invoices_updated_at before update on public.invoices for each row execute function public.touch_updated_at();
create trigger entries_updated_at  before update on public.time_entries for each row execute function public.touch_updated_at();

-- Referência do caso (AAAA/0001) e responsável por omissão
create function public.case_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reference := to_char(current_date, 'YYYY') || '/' || lpad(nextval('public.case_ref_seq')::text, 4, '0');
  if new.responsible_id is null then new.responsible_id := auth.uid(); end if;
  return new;
end $$;
create trigger cases_before_insert before insert on public.cases for each row execute function public.case_before_insert();

-- O responsável entra sempre na equipa do caso
create function public.case_sync_responsible() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.responsible_id is not null then
    insert into public.case_members (case_id, member_id) values (new.id, new.responsible_id)
    on conflict do nothing;
  end if;
  return null;
end $$;
create trigger cases_sync_responsible after insert or update of responsible_id on public.cases
  for each row execute function public.case_sync_responsible();

create function public.task_before_write() returns trigger
language plpgsql as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    new.completed_at := now();
  elsif new.status <> 'concluida' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_before_write before insert or update on public.tasks for each row execute function public.task_before_write();

-- Registos de tempo: taxa fixada no servidor, arredondamento, regras de edição
create function public.time_entry_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inc int;
  raw numeric;
  mgr boolean := public.is_manager();
begin
  if tg_op = 'INSERT' then
    if new.member_id is null then new.member_id := auth.uid(); end if;
    if auth.uid() is not null and new.member_id <> auth.uid() and not mgr then
      raise exception 'Só pode registar tempo em seu nome';
    end if;
    new.rate := public.resolve_rate(new.member_id);
    new.status := 'por_faturar';
    new.invoice_id := null;
  else
    if new.member_id <> old.member_id then
      raise exception 'Não é possível mudar o membro de um registo';
    end if;
    if auth.uid() is not null and not mgr then
      if old.status = 'faturado' then raise exception 'Registo já faturado: não pode ser alterado'; end if;
      new.rate := old.rate;
      new.status := old.status;
      new.invoice_id := old.invoice_id;
    end if;
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
create trigger time_entries_before_write before insert or update on public.time_entries
  for each row execute function public.time_entry_before_write();

-- Auditoria (quem fez o quê e quando)
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor_id, table_name, row_id, action)
  values (auth.uid(), tg_table_name, case when tg_op = 'DELETE' then old.id else new.id end, lower(tg_op));
  return null;
end $$;
create trigger audit_clients  after insert or update or delete on public.clients      for each row execute function public.audit_row();
create trigger audit_leads    after insert or update or delete on public.leads        for each row execute function public.audit_row();
create trigger audit_cases    after insert or update or delete on public.cases        for each row execute function public.audit_row();
create trigger audit_tasks    after insert or update or delete on public.tasks        for each row execute function public.audit_row();
create trigger audit_entries  after insert or update or delete on public.time_entries for each row execute function public.audit_row();
create trigger audit_invoices after insert or update or delete on public.invoices     for each row execute function public.audit_row();
create trigger audit_profiles after insert or update or delete on public.profiles     for each row execute function public.audit_row();

-- ── Operações de faturação (só sócios e financeiro) ───────────────────
create function public.create_pre_invoice(p_client uuid, p_notes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv uuid;
  tot numeric;
begin
  if not public.is_manager() then raise exception 'Sem permissão para faturar'; end if;
  if not exists (
    select 1 from public.time_entries t join public.cases c on c.id = t.case_id
    where c.client_id = p_client and t.status = 'por_faturar' and t.billable and t.ended_at is not null
  ) then
    raise exception 'Este cliente não tem horas por faturar';
  end if;

  insert into public.invoices (client_id, number, notes)
  values (p_client, 'PF-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 4, '0'), p_notes)
  returning id into inv;

  update public.time_entries t set status = 'faturado', invoice_id = inv
  from public.cases c
  where c.id = t.case_id and c.client_id = p_client
    and t.status = 'por_faturar' and t.billable and t.ended_at is not null;

  select coalesce(sum(amount), 0) into tot from public.time_entries where invoice_id = inv;
  update public.invoices set total = tot where id = inv;
  return inv;
end $$;

create function public.cancel_pre_invoice(p_invoice uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Sem permissão para faturar'; end if;
  if (select status from public.invoices where id = p_invoice) = 'emitida' then
    raise exception 'Uma pré-fatura já emitida não pode ser anulada aqui';
  end if;
  update public.time_entries set status = 'por_faturar', invoice_id = null where invoice_id = p_invoice;
  update public.invoices set status = 'anulada' where id = p_invoice;
end $$;

-- ── Verificação de conflitos de interesses ────────────────────────────
-- Devolve só a existência de coincidências, sem expor detalhes de casos a que o membro não tem acesso.
create function public.conflict_check(q text)
returns table (kind text, label text, detail text)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'Cliente'::text, c.name, coalesce('NIF ' || c.nif, '')
    from public.clients c
    where public.is_member() and length(trim(q)) >= 3
      and (c.name ilike '%' || trim(q) || '%' or c.nif = trim(q))
    union all
    select 'Lead', l.name, coalesce(l.company, '')
    from public.leads l
    where public.is_member() and length(trim(q)) >= 3
      and (l.name ilike '%' || trim(q) || '%' or l.company ilike '%' || trim(q) || '%')
    union all
    select 'Parte contrária', k.opposing_party, 'Processo ' || k.reference
    from public.cases k
    where public.is_member() and length(trim(q)) >= 3
      and k.opposing_party ilike '%' || trim(q) || '%'
  ) r limit 30
$$;

-- ── Segurança ao nível da linha ───────────────────────────────────────
alter table public.office_settings enable row level security;
alter table public.practice_areas  enable row level security;
alter table public.clients         enable row level security;
alter table public.leads           enable row level security;
alter table public.cases           enable row level security;
alter table public.case_members    enable row level security;
alter table public.tasks           enable row level security;
alter table public.invoices        enable row level security;
alter table public.time_entries    enable row level security;
alter table public.audit_log       enable row level security;

create policy "ver definições"   on public.office_settings for select to authenticated using (public.is_member());
create policy "sócio altera definições" on public.office_settings for update to authenticated
  using (public.current_role() = 'socio') with check (public.current_role() = 'socio');

create policy "ver áreas"        on public.practice_areas for select to authenticated using (public.is_member());
create policy "sócio gere áreas" on public.practice_areas for all to authenticated
  using (public.current_role() = 'socio') with check (public.current_role() = 'socio');

create policy "ver clientes"     on public.clients for select to authenticated using (public.is_member());
create policy "criar clientes"   on public.clients for insert to authenticated with check (public.is_member());
create policy "editar clientes"  on public.clients for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "sócio apaga clientes" on public.clients for delete to authenticated using (public.current_role() = 'socio');

create policy "ver leads"        on public.leads for select to authenticated using (public.is_member());
create policy "criar leads"      on public.leads for insert to authenticated with check (public.is_member());
create policy "editar leads"     on public.leads for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "sócio apaga leads" on public.leads for delete to authenticated using (public.current_role() = 'socio');

-- Colunas da própria linha (e não can_see_case) para o INSERT ... RETURNING ver o caso acabado de criar
create policy "ver casos" on public.cases for select to authenticated using (
  public.is_member() and (public.is_manager() or responsible_id = auth.uid() or created_by = auth.uid()
    or public.is_case_member(id)));
create policy "criar casos"      on public.cases for insert to authenticated
  with check (public.current_role() in ('socio', 'advogado', 'associado'));
create policy "editar casos" on public.cases for update to authenticated
  using (public.is_member() and (public.current_role() = 'socio' or responsible_id = auth.uid()
    or created_by = auth.uid() or public.is_case_member(id)))
  with check (public.is_member() and (public.current_role() = 'socio' or responsible_id = auth.uid()
    or created_by = auth.uid() or public.is_case_member(id)));
create policy "sócio apaga casos" on public.cases for delete to authenticated using (public.current_role() = 'socio');

create policy "ver equipa do caso"  on public.case_members for select to authenticated using (public.can_see_case(case_id));
create policy "gerir equipa do caso" on public.case_members for insert to authenticated with check (public.can_edit_case(case_id));
create policy "remover da equipa"    on public.case_members for delete to authenticated using (public.can_edit_case(case_id));

create policy "ver tarefas" on public.tasks for select to authenticated using (
  public.is_member() and (public.is_manager() or assignee_id = auth.uid() or created_by = auth.uid()
    or (case_id is not null and public.can_see_case(case_id))));
create policy "criar tarefas" on public.tasks for insert to authenticated with check (
  public.is_member() and created_by = auth.uid() and (case_id is null or public.can_see_case(case_id)));
create policy "editar tarefas" on public.tasks for update to authenticated using (
  public.is_member() and (public.current_role() = 'socio' or assignee_id = auth.uid() or created_by = auth.uid()
    or (case_id is not null and public.can_edit_case(case_id))));
create policy "apagar tarefas" on public.tasks for delete to authenticated using (
  public.current_role() = 'socio' or created_by = auth.uid());

create policy "ver tempo" on public.time_entries for select to authenticated using (
  public.is_member() and (member_id = auth.uid() or public.is_manager()
    or (case_id is not null and exists (select 1 from public.cases c where c.id = case_id and c.responsible_id = auth.uid()))));
create policy "registar tempo" on public.time_entries for insert to authenticated with check (
  public.is_member() and (case_id is null or public.can_see_case(case_id)));
create policy "editar tempo" on public.time_entries for update to authenticated using (
  public.is_member() and (member_id = auth.uid() or public.is_manager()));
create policy "apagar tempo" on public.time_entries for delete to authenticated using (
  (member_id = auth.uid() and status = 'por_faturar') or public.current_role() = 'socio');

create policy "ver pré-faturas"    on public.invoices for select to authenticated using (public.is_manager());
create policy "editar pré-faturas" on public.invoices for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "sócio vê auditoria" on public.audit_log for select to authenticated using (public.current_role() = 'socio');

-- ── Permissões da API ─────────────────────────────────────────────────
revoke all on public.office_settings, public.practice_areas, public.clients, public.leads, public.cases,
  public.case_members, public.tasks, public.invoices, public.time_entries, public.audit_log from anon;

grant select, update on public.office_settings to authenticated;
grant select, insert, update, delete on public.practice_areas, public.clients, public.leads, public.cases,
  public.case_members, public.tasks, public.time_entries to authenticated;
grant select, update on public.invoices to authenticated;
grant select on public.audit_log to authenticated;

revoke execute on function public.create_pre_invoice(uuid, text), public.cancel_pre_invoice(uuid),
  public.conflict_check(text), public.resolve_rate(uuid) from public, anon;
grant execute on function public.is_manager(), public.is_case_member(uuid), public.can_see_case(uuid), public.can_edit_case(uuid),
  public.resolve_rate(uuid), public.create_pre_invoice(uuid, text), public.cancel_pre_invoice(uuid),
  public.conflict_check(text) to authenticated;
