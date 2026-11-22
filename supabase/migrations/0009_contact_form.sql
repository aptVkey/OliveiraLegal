-- Formulário de contacto do site: cria (ou atualiza) a lead com origem "site".
-- Só o servidor do site (service_role) executa a função; nenhuma tabela fica exposta.

create table public.contact_requests (
  id         bigint generated always as identity primary key,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index contact_requests_ip_idx on public.contact_requests (ip_hash, created_at);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon, authenticated, service_role;

create function public.contact_submit(p_name text, p_email text, p_area text, p_message text, p_ip_hash text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  lid uuid;
  aid uuid;
  em text := lower(trim(p_email));
  note text;
begin
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Indique o seu nome.'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Indique um e-mail válido.'; end if;
  if length(trim(coalesce(p_message, ''))) < 5 then raise exception 'Escreva uma mensagem.'; end if;

  -- Limite contra abusos: no máximo 5 pedidos por hora a partir do mesmo endereço
  if p_ip_hash is not null then
    if (select count(*) from public.contact_requests
        where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Demasiados pedidos. Tente novamente mais tarde.';
    end if;
    insert into public.contact_requests (ip_hash) values (p_ip_hash);
    delete from public.contact_requests where created_at < now() - interval '2 days';
  end if;

  select id into aid from public.practice_areas where name = trim(p_area) and active;
  note := 'Mensagem enviada pelo formulário de contacto do site'
          || case when aid is null and trim(coalesce(p_area, '')) <> '' then ' (assunto: ' || trim(p_area) || ')' else '' end
          || E' (' || to_char(now() at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') || E'):\n' || trim(p_message);

  select id into lid from public.leads
  where lower(email) = em and client_id is null and stage not in ('ganho', 'perdido')
  order by created_at desc limit 1;

  if lid is null then
    insert into public.leads (name, email, source, stage, area_id, notes, created_by)
    values (trim(p_name), em, 'site', 'novo', aid, note, null)
    returning id into lid;
  else
    -- Nunca reescreve dados existentes: acrescenta a mensagem às notas
    update public.leads
       set notes = coalesce(notes || E'\n\n', '') || note, area_id = coalesce(area_id, aid), updated_at = now()
     where id = lid;
  end if;
  return lid;
end $$;

revoke execute on function public.contact_submit(text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.contact_submit(text, text, text, text, text) to service_role;
