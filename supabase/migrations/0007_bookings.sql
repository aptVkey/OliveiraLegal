-- Oliveira Legal · Agendamento de consultas pagas (site → lead → Stripe)
-- • O visitante deixa os contactos → a lead fica logo guardada (fonte "site")
-- • Escolhe dia, hora, presencial/online e assunto → paga no Stripe Checkout
-- • O pagamento confirmado (webhook verificado no servidor) marca a reunião e move a lead para "Reunião"
-- Segurança: o site nunca fala diretamente com a base de dados. Só o servidor (chave secreta,
-- papel service_role) pode executar as funções públicas, e apenas estas — sem acesso às tabelas.

create type public.booking_mode   as enum ('presencial', 'online');
create type public.booking_status as enum ('rascunho', 'pendente', 'pago', 'cancelado', 'expirado', 'conflito');

-- ── Definições (geridas no backoffice) ────────────────────────────────
create table public.booking_settings (
  id                  int primary key default 1 check (id = 1),
  enabled             boolean not null default false,
  title               text not null default 'Marque a sua consulta' check (length(title) between 1 and 120),
  intro               text check (length(intro) <= 600),
  duration_min        int not null default 60  check (duration_min between 15 and 240),
  step_min            int not null default 60  check (step_min between 15 and 240),
  min_notice_hours    int not null default 24  check (min_notice_hours between 0 and 720),
  max_days_ahead      int not null default 30  check (max_days_ahead between 1 and 180),
  presencial_enabled  boolean not null default true,
  online_enabled      boolean not null default true,
  price_presencial    int not null default 7500 check (price_presencial between 50 and 10000000),  -- cêntimos
  price_online        int not null default 6000 check (price_online between 50 and 10000000),
  currency            text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  address             text check (length(address) <= 300),
  online_instructions text check (length(online_instructions) <= 600),
  notify_email        text check (notify_email is null or notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  check (presencial_enabled or online_enabled)
);
insert into public.booking_settings default values;

-- Horário semanal (dia ISO: 1 = segunda … 7 = domingo), em hora de Lisboa
create table public.booking_hours (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time   time not null,
  check (end_time > start_time)
);
insert into public.booking_hours (weekday, start_time, end_time)
select d, t.s, t.e from generate_series(1, 5) d,
  (values ('09:30'::time, '12:30'::time), ('14:30'::time, '18:00'::time)) t(s, e);

-- Dias sem marcações (férias, feriados)
create table public.booking_blocked (
  day    date primary key,
  reason text check (length(reason) <= 120)
);

-- ── Marcações ─────────────────────────────────────────────────────────
create sequence public.booking_ref_seq;
create table public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  reference             text unique not null default ('AG-' || lpad(nextval('public.booking_ref_seq')::text, 5, '0')),
  public_token          uuid not null unique default gen_random_uuid(),   -- só o browser de quem marcou o conhece
  lead_id               uuid references public.leads (id) on delete set null,
  name                  text not null check (length(trim(name)) between 1 and 120),
  email                 text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  phone                 text check (length(phone) <= 40),
  consent_at            timestamptz not null default now(),
  client_ip_hash        text,
  mode                  public.booking_mode,
  area_id               uuid references public.practice_areas (id) on delete set null,
  topic                 text check (length(topic) <= 1500),
  starts_at             timestamptz,
  ends_at               timestamptz,
  status                public.booking_status not null default 'rascunho',
  amount_cents          int,
  currency              text,
  hold_until            timestamptz,
  stripe_session_id     text unique,
  stripe_payment_intent text,
  paid_at               timestamptz,
  emails_sent_at        timestamptz,
  cancelled_at          timestamptz,
  cancelled_by          uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index on public.bookings (starts_at);
create index on public.bookings (lead_id);
create index on public.bookings (status, hold_until);
create index on public.bookings (client_ip_hash, created_at);
-- Dois pedidos ativos nunca se sobrepõem (proteção contra marcações em simultâneo)
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (tstzrange(starts_at, ends_at) with &&) where (status in ('pendente', 'pago'));

create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.touch_updated_at();
create trigger audit_bookings after insert or update or delete on public.bookings
  for each row execute function public.audit_row();

-- ── Funções internas ──────────────────────────────────────────────────
-- Liberta horários de pagamentos abandonados
create function public.booking_release_expired() returns void
language sql security definer set search_path = public as $$
  update public.bookings set status = 'expirado'
  where status = 'pendente' and hold_until < now();
$$;

-- Horários livres entre duas datas (hora de Lisboa)
create function public.booking_slots(p_from date, p_to date, p_ignore uuid default null)
returns table (starts_at timestamptz, day text, hour text)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.booking_settings where id = 1),
  today as (select (now() at time zone 'Europe/Lisbon')::date as d),
  days as (
    select g::date as day
    from s, today, generate_series(greatest(p_from, today.d), least(p_to, today.d + s.max_days_ahead), interval '1 day') g
    where s.enabled and p_to - p_from <= 62
  ),
  cand as (
    select (gs at time zone 'Europe/Lisbon') as st
    from days
    join public.booking_hours h on h.weekday = extract(isodow from days.day)
    cross join s
    cross join lateral generate_series(
      days.day + h.start_time,
      days.day + h.end_time - make_interval(mins => s.duration_min),
      make_interval(mins => s.step_min)) gs
    where not exists (select 1 from public.booking_blocked b where b.day = days.day)
  )
  select distinct c.st,
         to_char(c.st at time zone 'Europe/Lisbon', 'YYYY-MM-DD'),
         to_char(c.st at time zone 'Europe/Lisbon', 'HH24:MI')
  from cand c, s
  where c.st >= now() + make_interval(hours => s.min_notice_hours)
    and not exists (
      select 1 from public.bookings b
      where b.id is distinct from p_ignore
        and (b.status = 'pago' or (b.status = 'pendente' and b.hold_until > now()))
        and tstzrange(b.starts_at, b.ends_at) && tstzrange(c.st, c.st + make_interval(mins => s.duration_min)))
  order by 1;
$$;

-- ── Funções chamadas pelo servidor do site (service_role) ─────────────
-- Configuração pública: apenas o que o visitante precisa de ver
create function public.booking_public_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', s.enabled, 'title', s.title, 'intro', s.intro, 'duration', s.duration_min,
    'currency', s.currency, 'maxDays', s.max_days_ahead, 'address', s.address,
    'modes', (select coalesce(jsonb_agg(m), '[]') from (
        select jsonb_build_object('id', 'presencial', 'price', s.price_presencial) m where s.presencial_enabled
        union all
        select jsonb_build_object('id', 'online', 'price', s.price_online) where s.online_enabled) x),
    'areas', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name), '[]')
              from public.practice_areas a where a.active))
  from public.booking_settings s where s.id = 1;
$$;

-- Passo 1: guarda a lead (reaproveita uma lead aberta com o mesmo e-mail) e cria o rascunho
create function public.booking_start(p_name text, p_email text, p_phone text, p_ip_hash text, p_token uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  lid uuid;
  em text := lower(trim(p_email));
begin
  if not (select enabled from public.booking_settings where id = 1) then
    raise exception 'As marcações online estão temporariamente indisponíveis.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Indique o seu nome.'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Indique um e-mail válido.'; end if;

  -- Continuar um rascunho já existente (o visitante voltou ao passo 1)
  if p_token is not null then
    select * into b from public.bookings where public_token = p_token for update;
    if found and b.status in ('rascunho', 'expirado', 'pendente') and b.email = em then
      update public.bookings set name = trim(p_name), phone = nullif(trim(p_phone), '') where id = b.id;
      return b.public_token;
    end if;
  end if;

  -- Limite contra abusos: no máximo 8 pedidos por hora a partir do mesmo endereço
  if p_ip_hash is not null and (select count(*) from public.bookings
      where client_ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 8 then
    raise exception 'Demasiados pedidos. Tente novamente mais tarde.';
  end if;

  select id into lid from public.leads
  where lower(email) = em and client_id is null and stage not in ('ganho', 'perdido')
  order by created_at desc limit 1;

  if lid is null then
    insert into public.leads (name, email, phone, source, stage, notes, created_by)
    values (trim(p_name), em, nullif(trim(p_phone), ''), 'site', 'novo', 'Pedido de marcação de consulta no site.', null)
    returning id into lid;
  else
    -- Nunca reescreve dados existentes: só completa o que falta
    update public.leads set phone = coalesce(phone, nullif(trim(p_phone), '')) where id = lid;
  end if;

  insert into public.bookings (lead_id, name, email, phone, client_ip_hash)
  values (lid, trim(p_name), em, nullif(trim(p_phone), ''), p_ip_hash)
  returning * into b;

  insert into public.notes (lead_id, author_id, kind, body)
  values (lid, null, 'sistema', 'Iniciou uma marcação de consulta no site (' || b.reference || ').');
  return b.public_token;
end $$;

-- Passo final: reserva o horário durante o pagamento e devolve o que o Stripe precisa
create function public.booking_checkout(p_token uuid, p_starts_at timestamptz, p_mode public.booking_mode,
                                        p_area uuid, p_topic text)
returns table (id uuid, reference text, name text, email text, amount_cents int, currency text,
               starts_at timestamptz, ends_at timestamptz, mode public.booking_mode, hold_until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.booking_settings;
  price int;
begin
  select * into s from public.booking_settings where booking_settings.id = 1;
  if not s.enabled then raise exception 'As marcações online estão temporariamente indisponíveis.'; end if;

  select * into b from public.bookings where public_token = p_token for update;
  if not found then raise exception 'Marcação não encontrada. Recomece, por favor.'; end if;
  if b.status in ('pago', 'conflito') then raise exception 'Esta marcação já está paga.'; end if;
  if b.status = 'cancelado' then raise exception 'Esta marcação foi cancelada. Recomece, por favor.'; end if;

  if p_mode = 'presencial' and s.presencial_enabled then price := s.price_presencial;
  elsif p_mode = 'online' and s.online_enabled then price := s.price_online;
  else raise exception 'Escolha o tipo de reunião.';
  end if;
  if p_area is not null and not exists (select 1 from public.practice_areas a where a.id = p_area and a.active) then
    raise exception 'Área inválida.';
  end if;

  perform public.booking_release_expired();
  if not exists (
    select 1 from public.booking_slots((p_starts_at at time zone 'Europe/Lisbon')::date,
                                       (p_starts_at at time zone 'Europe/Lisbon')::date, b.id) x
    where x.starts_at = p_starts_at) then
    raise exception 'Este horário já não está disponível. Escolha outro, por favor.';
  end if;

  begin
    update public.bookings set
      status = 'pendente', mode = p_mode, area_id = p_area, topic = nullif(trim(p_topic), ''),
      starts_at = p_starts_at, ends_at = p_starts_at + make_interval(mins => s.duration_min),
      amount_cents = price, currency = s.currency,
      hold_until = now() + interval '40 minutes', stripe_session_id = null
    where bookings.id = b.id
    returning * into b;
  exception when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro, por favor.';
  end;

  if b.lead_id is not null and p_area is not null then
    update public.leads set area_id = coalesce(area_id, p_area) where leads.id = b.lead_id;
  end if;

  return query select b.id, b.reference, b.name, b.email, b.amount_cents, b.currency,
                      b.starts_at, b.ends_at, b.mode, b.hold_until;
end $$;

create function public.booking_attach_session(p_id uuid, p_session text) returns void
language sql security definer set search_path = public as $$
  update public.bookings set stripe_session_id = p_session where id = p_id and status = 'pendente';
$$;

-- Webhook do Stripe (assinatura já verificada no servidor). Idempotente:
-- devolve a marcação só na primeira vez que fica paga, para os e-mails saírem uma única vez.
create function public.booking_mark_paid(p_session text, p_payment_intent text, p_amount int)
returns setof public.bookings
language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  when_txt text;
begin
  select * into b from public.bookings where stripe_session_id = p_session for update;
  if not found or b.status in ('pago', 'conflito') then return; end if;
  if p_amount is distinct from b.amount_cents then
    raise exception 'Valor pago (%) diferente do esperado (%) na marcação %', p_amount, b.amount_cents, b.reference;
  end if;

  begin
    update public.bookings set status = 'pago', paid_at = now(), stripe_payment_intent = p_payment_intent
    where id = b.id returning * into b;
  exception when exclusion_violation then
    -- Pagamento tardio e o horário entretanto foi para outra pessoa: o escritório tem de reagendar
    update public.bookings set status = 'conflito', paid_at = now(), stripe_payment_intent = p_payment_intent
    where id = b.id returning * into b;
  end;

  when_txt := to_char(b.starts_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY "às" HH24:MI');
  if b.lead_id is not null then
    update public.leads set stage = 'reuniao' where id = b.lead_id and stage in ('novo', 'contactado');
    insert into public.notes (lead_id, author_id, kind, body)
    values (b.lead_id, null, 'sistema',
      case when b.status = 'pago'
        then 'Consulta paga e marcada (' || b.reference || '): ' || when_txt || ', ' || b.mode::text || '.'
        else 'Pagamento recebido (' || b.reference || ') mas o horário de ' || when_txt || ' já estava ocupado — reagendar com o cliente.'
      end);
  end if;
  return next b;
end $$;

create function public.booking_mark_emailed(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.bookings set emails_sent_at = now() where id = p_id;
$$;

create function public.booking_expire_session(p_session text) returns void
language sql security definer set search_path = public as $$
  update public.bookings set status = 'expirado' where stripe_session_id = p_session and status = 'pendente';
$$;

-- Estado para a página de regresso do Stripe (só com o token secreto)
create function public.booking_public_status(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', status, 'reference', reference, 'startsAt', starts_at,
                            'mode', mode, 'email', email)
  from public.bookings where public_token = p_token;
$$;

-- Dados para os e-mails de confirmação (morada, link da reunião, e-mail do escritório)
create function public.booking_email_context(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'reference', b.reference, 'name', b.name, 'email', b.email, 'phone', b.phone,
    'mode', b.mode, 'status', b.status, 'topic', b.topic, 'area', a.name,
    'startsAt', b.starts_at, 'endsAt', b.ends_at, 'amountCents', b.amount_cents, 'currency', b.currency,
    'address', s.address, 'onlineInstructions', s.online_instructions, 'notifyEmail', s.notify_email)
  from public.bookings b
  cross join public.booking_settings s
  left join public.practice_areas a on a.id = b.area_id
  where b.id = p_id and s.id = 1 and b.status in ('pago', 'conflito');
$$;

-- ── Ações da equipa (backoffice) ──────────────────────────────────────
-- Cancelar não reembolsa: o reembolso faz-se no painel do Stripe.
create function public.booking_cancel(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if not public.is_member() then raise exception 'Sem permissão'; end if;
  select * into b from public.bookings where id = p_id for update;
  if not found then raise exception 'Marcação não encontrada'; end if;
  if b.status = 'cancelado' then return; end if;
  update public.bookings set status = 'cancelado', cancelled_at = now(), cancelled_by = auth.uid() where id = p_id;
  if b.lead_id is not null then
    insert into public.notes (lead_id, author_id, kind, body)
    values (b.lead_id, auth.uid(), 'sistema', 'Marcação ' || b.reference || ' cancelada pela equipa.');
  end if;
end $$;

-- ── Segurança ──────────────────────────────────────────────────────────
alter table public.booking_settings enable row level security;
alter table public.booking_hours    enable row level security;
alter table public.booking_blocked  enable row level security;
alter table public.bookings         enable row level security;

create policy "ver definições de agenda"    on public.booking_settings for select to authenticated using (public.is_member());
create policy "sócio altera agenda"         on public.booking_settings for update to authenticated
  using (public.current_role() = 'socio') with check (public.current_role() = 'socio');
create policy "ver horário"                 on public.booking_hours for select to authenticated using (public.is_member());
create policy "sócio gere horário"          on public.booking_hours for all to authenticated
  using (public.current_role() = 'socio') with check (public.current_role() = 'socio');
create policy "ver dias bloqueados"         on public.booking_blocked for select to authenticated using (public.is_member());
create policy "sócio gere dias bloqueados"  on public.booking_blocked for all to authenticated
  using (public.current_role() = 'socio') with check (public.current_role() = 'socio');
create policy "ver marcações"               on public.bookings for select to authenticated using (public.is_member());

revoke all on public.booking_settings, public.booking_hours, public.booking_blocked, public.bookings
  from anon, authenticated, service_role;
revoke all on sequence public.booking_ref_seq from anon, authenticated, service_role;
grant select, update on public.booking_settings to authenticated;
grant select, insert, update, delete on public.booking_hours, public.booking_blocked to authenticated;
grant select on public.bookings to authenticated;   -- alterações só através das funções acima

revoke execute on function
  public.booking_release_expired(), public.booking_slots(date, date, uuid), public.booking_public_config(),
  public.booking_start(text, text, text, text, uuid),
  public.booking_checkout(uuid, timestamptz, public.booking_mode, uuid, text),
  public.booking_attach_session(uuid, text), public.booking_mark_paid(text, text, int),
  public.booking_mark_emailed(uuid), public.booking_expire_session(text), public.booking_public_status(uuid),
  public.booking_cancel(uuid), public.booking_email_context(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.booking_slots(date, date, uuid), public.booking_public_config(),
  public.booking_start(text, text, text, text, uuid),
  public.booking_checkout(uuid, timestamptz, public.booking_mode, uuid, text),
  public.booking_attach_session(uuid, text), public.booking_mark_paid(text, text, int),
  public.booking_mark_emailed(uuid), public.booking_expire_session(text), public.booking_public_status(uuid),
  public.booking_email_context(uuid)
to service_role;
grant execute on function public.booking_cancel(uuid), public.booking_slots(date, date, uuid) to authenticated;
