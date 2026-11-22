-- Oliveira Legal · Backoffice — notas da equipa em leads e clientes
-- • Notas escritas pela equipa (com autor, data e edição)
-- • Registo automático das mudanças de fase da lead
-- • Quando a lead vira cliente, todas as notas passam para o cliente (continuam ligadas à lead de origem)
-- • Conversão numa única operação atómica

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references public.leads (id) on delete set null,
  client_id  uuid references public.clients (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null default auth.uid(),
  kind       text not null default 'nota' check (kind in ('nota', 'sistema')),
  body       text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  check (lead_id is not null or client_id is not null)
);
create index on public.notes (lead_id, created_at desc);
create index on public.notes (client_id, created_at desc);

-- Uma nota escrita na lead depois de convertida passa também para o cliente
create function public.note_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.client_id is null then
    select client_id into new.client_id from public.leads where id = new.lead_id;
  end if;
  return new;
end $$;
create trigger notes_before_insert before insert on public.notes
  for each row execute function public.note_before_insert();

create function public.note_before_update() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end $$;
create trigger notes_before_update before update on public.notes
  for each row execute function public.note_before_update();

-- Apagar uma lead apaga as notas que só existiam nela; as que já passaram para o cliente ficam
create function public.lead_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notes where lead_id = old.id and client_id is null;
  return old;
end $$;
create trigger leads_before_delete before delete on public.leads
  for each row execute function public.lead_before_delete();

-- Histórico: cada mudança de fase fica registada na lead
create function public.lead_stage_note() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  names jsonb := '{"novo":"Novo","contactado":"Contactado","reuniao":"Reunião","proposta":"Proposta","ganho":"Ganho","perdido":"Perdido"}';
begin
  if new.stage is distinct from old.stage then
    insert into public.notes (lead_id, client_id, author_id, kind, body)
    values (new.id, new.client_id, auth.uid(), 'sistema',
            'Fase: ' || (names ->> old.stage::text) || ' → ' || (names ->> new.stage::text));
  end if;
  return null;
end $$;
create trigger leads_stage_note after update of stage on public.leads
  for each row execute function public.lead_stage_note();

-- Conversão atómica: cria o cliente, liga a lead e passa todas as notas para o cliente
create function public.convert_lead(p_lead uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l public.leads;
  cid uuid;
begin
  if not public.is_member() then raise exception 'Sem permissão'; end if;
  select * into l from public.leads where id = p_lead for update;
  if not found then raise exception 'Lead não encontrada'; end if;
  if l.client_id is not null then return l.client_id; end if;

  insert into public.clients (kind, name, email, phone, notes, created_by)
  values (
    (case when nullif(trim(l.company), '') is not null then 'empresa' else 'particular' end)::public.client_kind,
    coalesce(nullif(trim(l.company), ''), l.name),
    l.email, l.phone,
    nullif(concat_ws(E'\n',
      case when nullif(trim(l.company), '') is not null then 'Contacto: ' || l.name end, l.notes), ''),
    auth.uid())
  returning id into cid;

  update public.leads set client_id = cid, stage = 'ganho' where id = p_lead;
  update public.notes set client_id = cid where lead_id = p_lead and client_id is null;
  insert into public.notes (lead_id, client_id, author_id, kind, body)
  values (p_lead, cid, auth.uid(), 'sistema', 'Lead convertida em cliente');
  return cid;
end $$;

-- ── Segurança ──────────────────────────────────────────────────────────
alter table public.notes enable row level security;

create policy "ver notas" on public.notes for select to authenticated using (public.is_member());
create policy "escrever notas" on public.notes for insert to authenticated
  with check (public.is_member() and kind = 'nota' and author_id = auth.uid());
create policy "editar as próprias notas" on public.notes for update to authenticated
  using (kind = 'nota' and author_id = auth.uid()) with check (kind = 'nota' and author_id = auth.uid());
create policy "apagar notas" on public.notes for delete to authenticated
  using ((kind = 'nota' and author_id = auth.uid()) or public.current_role() = 'socio');

revoke all on public.notes from anon;
revoke update on public.notes from authenticated;
grant select, insert, delete on public.notes to authenticated;
grant update (body) on public.notes to authenticated;   -- só o texto; ligações e autor não se alteram

revoke execute on function public.convert_lead(uuid) from public, anon;
grant execute on function public.convert_lead(uuid) to authenticated;

create trigger audit_notes after insert or update or delete on public.notes
  for each row execute function public.audit_row();
