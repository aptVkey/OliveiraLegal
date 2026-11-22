-- Oliveira Legal · Desempenho da base de dados
-- As regras de acesso (RLS) mantêm-se exatamente iguais. Muda apenas a forma como são avaliadas:
-- as verificações que não dependem da linha — quem é o utilizador, se é membro, o seu papel —
-- passam a ser calculadas uma vez por consulta, em vez de uma vez por cada linha lida.
-- (Recomendação oficial do Supabase: envolver auth.uid() e funções auxiliares em "select".)

-- ── Índices em falta ──────────────────────────────────────────────────
create index if not exists case_members_member_idx   on public.case_members (member_id);
create index if not exists client_members_member_idx on public.client_members (member_id);
create index if not exists cases_responsible_idx     on public.cases (responsible_id);
create index if not exists tasks_created_by_idx      on public.tasks (created_by);
create index if not exists time_entries_task_done_idx on public.time_entries (task_id) where ended_at is not null;
create index if not exists leads_open_email_idx      on public.leads (lower(email)) where client_id is null;
create index if not exists bookings_created_idx      on public.bookings (status, created_at);

-- ── Políticas: verificações por consulta, não por linha ───────────────
alter policy "sócio vê auditoria" on public.audit_log
  using (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "sócio gere dias bloqueados" on public.booking_blocked
  using (((select public."current_role"()) = 'socio'::public.member_role))
  with check (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver dias bloqueados" on public.booking_blocked
  using ((select public.is_member()));
alter policy "sócio gere horário" on public.booking_hours
  using (((select public."current_role"()) = 'socio'::public.member_role))
  with check (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver horário" on public.booking_hours
  using ((select public.is_member()));
alter policy "sócio altera agenda" on public.booking_settings
  using (((select public."current_role"()) = 'socio'::public.member_role))
  with check (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver definições de agenda" on public.booking_settings
  using ((select public.is_member()));
alter policy "ver marcações" on public.bookings
  using ((select public.is_member()));
alter policy "gerir equipa do caso" on public.case_members
  with check (public.can_edit_case(case_id));
alter policy "remover da equipa" on public.case_members
  using (public.can_edit_case(case_id));
alter policy "ver equipa do caso" on public.case_members
  using (public.can_see_case(case_id));
alter policy "criar casos" on public.cases
  with check (((select public."current_role"()) = ANY (ARRAY['socio'::public.member_role, 'advogado'::public.member_role, 'associado'::public.member_role])));
alter policy "editar casos" on public.cases
  using (((select public.is_member()) AND (((select public."current_role"()) = 'socio'::public.member_role) OR (responsible_id = (select auth.uid())) OR (created_by = (select auth.uid())) OR public.is_case_member(id))))
  with check (((select public.is_member()) AND (((select public."current_role"()) = 'socio'::public.member_role) OR (responsible_id = (select auth.uid())) OR (created_by = (select auth.uid())) OR public.is_case_member(id))));
alter policy "sócio apaga casos" on public.cases
  using (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver casos" on public.cases
  using (((select public.is_member()) AND ((select public.is_manager()) OR (responsible_id = (select auth.uid())) OR (created_by = (select auth.uid())) OR public.is_case_member(id))));
alter policy "gerir equipa do cliente" on public.client_members
  with check (((select public."current_role"()) = ANY (ARRAY['socio'::public.member_role, 'advogado'::public.member_role, 'associado'::public.member_role])));
alter policy "remover da equipa do cliente" on public.client_members
  using (((select public."current_role"()) = ANY (ARRAY['socio'::public.member_role, 'advogado'::public.member_role, 'associado'::public.member_role])));
alter policy "ver equipa do cliente" on public.client_members
  using ((select public.is_member()));
alter policy "criar clientes" on public.clients
  with check ((select public.is_member()));
alter policy "editar clientes" on public.clients
  using ((select public.is_member()))
  with check ((select public.is_member()));
alter policy "sócio apaga clientes" on public.clients
  using (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver clientes" on public.clients
  using ((select public.is_member()));
alter policy "editar pré-faturas" on public.invoices
  using ((select public.is_manager()))
  with check ((select public.is_manager()));
alter policy "ver pré-faturas" on public.invoices
  using ((select public.is_manager()));
alter policy "criar leads" on public.leads
  with check ((select public.is_member()));
alter policy "editar leads" on public.leads
  using ((select public.is_member()))
  with check ((select public.is_member()));
alter policy "sócio apaga leads" on public.leads
  using (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver leads" on public.leads
  using ((select public.is_member()));
alter policy "apagar notas" on public.notes
  using ((((kind = 'nota'::text) AND (author_id = (select auth.uid()))) OR ((select public."current_role"()) = 'socio'::public.member_role)));
alter policy "editar as próprias notas" on public.notes
  using (((kind = 'nota'::text) AND (author_id = (select auth.uid()))))
  with check (((kind = 'nota'::text) AND (author_id = (select auth.uid()))));
alter policy "escrever notas" on public.notes
  with check (((select public.is_member()) AND (kind = 'nota'::text) AND (author_id = (select auth.uid()))));
alter policy "ver notas" on public.notes
  using ((select public.is_member()));
alter policy "sócio altera definições" on public.office_settings
  using (((select public."current_role"()) = 'socio'::public.member_role))
  with check (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver definições" on public.office_settings
  using ((select public.is_member()));
alter policy "sócio gere áreas" on public.practice_areas
  using (((select public."current_role"()) = 'socio'::public.member_role))
  with check (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "ver áreas" on public.practice_areas
  using ((select public.is_member()));
alter policy "Membro edita o próprio perfil" on public.profiles
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));
alter policy "Membros veem a equipa" on public.profiles
  using (((select public.is_member()) OR (id = (select auth.uid()))));
alter policy "Sócios gerem a equipa" on public.profiles
  using (((select public."current_role"()) = 'socio'::public.member_role))
  with check (((select public."current_role"()) = 'socio'::public.member_role));
alter policy "Membros veem taxas por papel" on public.role_rates
  using ((select public.is_member()));
alter policy "Sócios e financeiro gerem taxas" on public.role_rates
  using (((select public."current_role"()) = ANY (ARRAY['socio'::public.member_role, 'financeiro'::public.member_role])))
  with check (((select public."current_role"()) = ANY (ARRAY['socio'::public.member_role, 'financeiro'::public.member_role])));
alter policy "apagar tarefas" on public.tasks
  using ((((select public."current_role"()) = 'socio'::public.member_role) OR (created_by = (select auth.uid()))));
alter policy "criar tarefas" on public.tasks
  with check (((select public.is_member()) AND (created_by = (select auth.uid())) AND ((case_id IS NULL) OR public.can_see_case(case_id))));
alter policy "editar tarefas" on public.tasks
  using (((select public.is_member()) AND (((select public."current_role"()) = 'socio'::public.member_role) OR (assignee_id = (select auth.uid())) OR (created_by = (select auth.uid())) OR ((case_id IS NOT NULL) AND public.can_edit_case(case_id)))));
alter policy "ver tarefas" on public.tasks
  using (((select public.is_member()) AND ((select public.is_manager()) OR (assignee_id = (select auth.uid())) OR (created_by = (select auth.uid())) OR ((case_id IS NOT NULL) AND public.can_see_case(case_id)))));
alter policy "apagar tempo" on public.time_entries
  using ((((member_id = (select auth.uid())) AND (status = 'por_faturar'::public.entry_status)) OR ((select public."current_role"()) = 'socio'::public.member_role)));
alter policy "editar tempo" on public.time_entries
  using (((select public.is_member()) AND ((member_id = (select auth.uid())) OR (select public.is_manager()))));
alter policy "registar tempo" on public.time_entries
  with check (((select public.is_member()) AND ((case_id IS NULL) OR public.can_see_case(case_id))));
alter policy "ver tempo" on public.time_entries
  using (((select public.is_member()) AND ((member_id = (select auth.uid())) OR (select public.is_manager()) OR ((case_id IS NOT NULL) AND public.can_see_case(case_id)))));
