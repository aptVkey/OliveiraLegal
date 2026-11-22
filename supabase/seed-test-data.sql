-- Dados de teste do backoffice: clientes, casos, tarefas, tempo e leads.
-- Corra no SQL Editor do Supabase. Tudo fica marcado com "[teste]".
-- Para remover só estes dados, corra supabase/remove-test-data.sql.
do $$
declare
  me uuid;
  a_imo uuid; a_com uuid; a_fam uuid; a_trab uuid; a_cont uuid; a_est uuid;
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
  k1 uuid; k2 uuid; k3 uuid; k4 uuid; k5 uuid; k6 uuid; k7 uuid;
  t uuid;
begin
  if exists (select 1 from public.clients where notes like '%[teste]%') then
    raise exception 'Os dados de teste já existem. Corra primeiro remove-test-data.sql.';
  end if;

  select id into me from public.profiles where role = 'socio' and active order by created_at limit 1;
  if me is null then raise exception 'Não há nenhum sócio ativo.'; end if;

  select id into a_imo  from public.practice_areas where name = 'Direito Imobiliário';
  select id into a_com  from public.practice_areas where name = 'Comercial e Societário';
  select id into a_fam  from public.practice_areas where name = 'Família e Sucessões';
  select id into a_trab from public.practice_areas where name = 'Direito do Trabalho';
  select id into a_cont from public.practice_areas where name = 'Contencioso e Arbitragem';
  select id into a_est  from public.practice_areas where name = 'Estrangeiros e Investimento';

  -- Clientes
  insert into public.clients (kind, name, nif, email, phone, address, rgpd_consent, consent_at, notes, created_by) values
    ('particular', 'Mariana Costa', '214567890', 'mariana.costa@exemplo.pt', '912 345 678', 'Rua das Flores 12, Albufeira', true, now(), 'Compra de apartamento em Albufeira. [teste]', me) returning id into c1;
  insert into public.clients (kind, name, nif, email, phone, address, rgpd_consent, consent_at, notes, created_by) values
    ('empresa', 'Algarve Sol Hotéis, Lda.', '509123456', 'geral@algarvesol.example.pt', '289 000 111', 'Av. da Liberdade 100, Albufeira', true, now(), 'Grupo hoteleiro, vários contratos. [teste]', me) returning id into c2;
  insert into public.clients (kind, name, nif, email, phone, address, rgpd_consent, consent_at, notes, created_by) values
    ('particular', 'Pedro e Inês Salvador', '198765432', 'salvador.familia@exemplo.pt', '965 432 109', 'Travessa do Mar 5, Guia', true, now(), 'Divórcio por mútuo consentimento. [teste]', me) returning id into c3;
  insert into public.clients (kind, name, nif, email, phone, address, rgpd_consent, notes, created_by) values
    ('empresa', 'Atlântico Imobiliária, S.A.', '508765432', 'juridico@atlantico.example.pt', '289 222 333', 'Rua do Comércio 8, Faro', false, 'Promotora, licenciamentos. [teste]', me) returning id into c4;
  insert into public.clients (kind, name, nif, email, phone, address, rgpd_consent, consent_at, notes, created_by) values
    ('particular', 'Rui Ferreira', '223344556', 'rui.ferreira@exemplo.pt', '938 111 222', 'Rua Nova 3, Loulé', true, now(), 'Despedimento sem justa causa. [teste]', me) returning id into c5;

  -- Casos (o responsável entra automaticamente na equipa do caso e do cliente)
  insert into public.cases (title, client_id, area_id, opposing_party, billing_type, fixed_fee, status, responsible_id, created_by, opened_at, description)
    values ('Compra do apartamento T2 — Praia da Oura', c1, a_imo, 'Construtora Mar Azul, Lda.', 'fixo', 1800, 'em_curso', me, me, current_date - 40, 'Caso de demonstração. [teste]') returning id into k1;
  insert into public.cases (title, client_id, area_id, opposing_party, billing_type, status, responsible_id, created_by, opened_at, description)
    values ('Contrato de exploração hoteleira', c2, a_com, 'Beach Club Operators, S.A.', 'hora', 'em_curso', me, me, current_date - 30, 'Caso de demonstração. [teste]') returning id into k2;
  insert into public.cases (title, client_id, area_id, billing_type, status, responsible_id, created_by, opened_at, description)
    values ('Alteração do pacto social', c2, a_com, 'hora', 'aberto', me, me, current_date - 12, 'Caso de demonstração. [teste]') returning id into k3;
  insert into public.cases (title, client_id, area_id, billing_type, fixed_fee, status, responsible_id, created_by, opened_at, description)
    values ('Divórcio por mútuo consentimento', c3, a_fam, 'fixo', 1200, 'em_curso', me, me, current_date - 25, 'Caso de demonstração. [teste]') returning id into k4;
  insert into public.cases (title, client_id, area_id, opposing_party, billing_type, fixed_fee, status, responsible_id, created_by, opened_at, description)
    values ('Licenciamento do loteamento Quinta do Sol', c4, a_imo, 'Câmara Municipal', 'avenca', 900, 'em_curso', me, me, current_date - 60, 'Caso de demonstração. [teste]') returning id into k5;
  insert into public.cases (title, client_id, area_id, opposing_party, billing_type, status, responsible_id, created_by, opened_at, description)
    values ('Impugnação de despedimento', c5, a_trab, 'Restauração Sul, Lda.', 'hora', 'em_curso', me, me, current_date - 18, 'Caso de demonstração. [teste]') returning id into k6;
  insert into public.cases (title, client_id, area_id, billing_type, fixed_fee, status, responsible_id, created_by, opened_at, closed_at, description)
    values ('Escritura de compra e venda (concluído)', c1, a_imo, 'fixo', 600, 'fechado', me, me, current_date - 120, current_date - 90, 'Caso de demonstração. [teste]') returning id into k7;

  -- Tarefas (cada uma com um só responsável)
  insert into public.tasks (case_id, title, status, priority, due_date, assignee_id, created_by) values
    (k1, 'Rever o contrato-promessa', 'concluida', 'alta', current_date - 20, me, me),
    (k1, 'Pedir certidão predial e caderneta', 'concluida', 'media', current_date - 15, me, me),
    (k1, 'Marcar a escritura', 'por_fazer', 'alta', current_date + 5, me, me),
    (k2, 'Analisar a minuta do contrato', 'em_curso', 'alta', current_date + 3, me, me),
    (k2, 'Reunião com a administração', 'por_fazer', 'media', current_date + 7, me, me),
    (k2, 'Redigir cláusulas de rescisão', 'por_fazer', 'media', current_date - 2, me, me),
    (k3, 'Preparar a ata da assembleia', 'por_fazer', 'media', current_date + 10, me, me),
    (k4, 'Acordo de regulação das responsabilidades parentais', 'em_curso', 'alta', current_date + 2, me, me),
    (k4, 'Entregar requerimento na Conservatória', 'por_fazer', 'media', current_date + 14, me, me),
    (k5, 'Responder ao pedido de elementos da Câmara', 'em_curso', 'alta', current_date - 1, me, me),
    (k5, 'Acompanhar o prazo de decisão', 'por_fazer', 'baixa', current_date + 20, me, me),
    (k6, 'Requerimento inicial (Tribunal do Trabalho)', 'em_curso', 'alta', current_date + 4, me, me),
    (k6, 'Recolher recibos e contrato de trabalho', 'concluida', 'media', current_date - 10, me, me),
    (k6, 'Preparar testemunhas', 'por_fazer', 'baixa', current_date + 18, me, me);

  -- Tempo registado nas tarefas (o caso vem da tarefa; taxa e custo ficam fixados)
  for t in select id from public.tasks where title = 'Rever o contrato-promessa' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at)
    values (me, t, true, 'Rever o contrato-promessa', date_trunc('day', now()) - interval '20 days' + interval '9 hours', date_trunc('day', now()) - interval '20 days' + interval '9 hours 95 minutes'); end loop;
  for t in select id from public.tasks where title = 'Pedir certidão predial e caderneta' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at)
    values (me, t, true, 'Pedir certidão predial e caderneta', date_trunc('day', now()) - interval '15 days' + interval '10 hours', date_trunc('day', now()) - interval '15 days' + interval '10 hours 35 minutes'); end loop;
  for t in select id from public.tasks where title = 'Analisar a minuta do contrato' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at) values
      (me, t, true, 'Análise inicial', date_trunc('day', now()) - interval '6 days' + interval '14 hours', date_trunc('day', now()) - interval '6 days' + interval '16 hours 30 minutes'),
      (me, t, true, 'Notas para a reunião', date_trunc('day', now()) - interval '3 days' + interval '9 hours', date_trunc('day', now()) - interval '3 days' + interval '10 hours 15 minutes'); end loop;
  for t in select id from public.tasks where title like 'Acordo de regulação%' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at) values
      (me, t, true, 'Redação do acordo', date_trunc('day', now()) - interval '8 days' + interval '15 hours', date_trunc('day', now()) - interval '8 days' + interval '17 hours'),
      (me, t, true, 'Revisão com os clientes', date_trunc('day', now()) - interval '4 days' + interval '11 hours', date_trunc('day', now()) - interval '4 days' + interval '12 hours'); end loop;
  for t in select id from public.tasks where title like 'Responder ao pedido de elementos%' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at) values
      (me, t, true, 'Levantamento de documentos', date_trunc('day', now()) - interval '5 days' + interval '10 hours', date_trunc('day', now()) - interval '5 days' + interval '11 hours 30 minutes'),
      (me, t, true, 'Rascunho da resposta', date_trunc('day', now()) - interval '2 days' + interval '16 hours', date_trunc('day', now()) - interval '2 days' + interval '16 hours 45 minutes'); end loop;
  for t in select id from public.tasks where title like 'Requerimento inicial%' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at)
    values (me, t, true, 'Requerimento inicial', date_trunc('day', now()) - interval '4 days' + interval '9 hours', date_trunc('day', now()) - interval '4 days' + interval '12 hours'); end loop;
  for t in select id from public.tasks where title like 'Recolher recibos%' loop
    insert into public.time_entries (member_id, task_id, billable, description, started_at, ended_at)
    values (me, t, true, 'Recolher recibos', date_trunc('day', now()) - interval '10 days' + interval '14 hours', date_trunc('day', now()) - interval '10 days' + interval '14 hours 50 minutes'); end loop;
  insert into public.time_entries (member_id, billable, description, started_at, ended_at)
    values (me, false, 'Formação interna e organização do arquivo', date_trunc('day', now()) - interval '1 day' + interval '16 hours', date_trunc('day', now()) - interval '1 day' + interval '17 hours');

  -- Leads em todas as fases
  insert into public.leads (name, company, email, phone, source, stage, area_id, owner_id, estimated_value, lost_reason, notes, created_by) values
    ('Joana Narques', 'Narques & Filhos, Lda.', 'joana@narques.example.pt', null, 'site', 'novo', a_com, me, 2500, null, 'Quer constituir uma sociedade. [teste]', me),
    ('Carlos Mendes', null, null, '917 000 123', 'indicacao', 'novo', a_imo, me, 900, null, 'Heranças e partilhas. [teste]', me),
    ('Sofia Almeida', null, 'sofia.almeida@exemplo.pt', null, 'telefone', 'contactado', a_fam, me, 1500, null, 'Regulação do poder paternal. [teste]', me),
    ('Grupo Vila Real', 'Vila Real Resorts', null, null, 'redes_sociais', 'reuniao', a_est, me, 8000, null, 'Investidores estrangeiros (vistos). [teste]', me),
    ('Miguel Duarte', 'Duarte Construções', null, null, 'site', 'proposta', a_cont, me, 4500, null, 'Litígio com fornecedor. Proposta enviada. [teste]', me),
    ('Teresa Lopes', null, null, null, 'indicacao', 'ganho', a_trab, me, 1200, null, 'Contrato de trabalho. [teste]', me),
    ('Hugo Pires', null, null, null, 'outro', 'perdido', a_imo, me, 700, 'Escolheu outro escritório', '[teste]', me);
end $$;
