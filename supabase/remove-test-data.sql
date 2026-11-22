-- Remove apenas os dados criados por seed-test-data.sql (marcados com "[teste]").
do $$
declare cids uuid[]; kids uuid[];
begin
  select coalesce(array_agg(id), '{}') into cids from public.clients where notes like '%[teste]%';
  select coalesce(array_agg(id), '{}') into kids from public.cases where client_id = any(cids);
  delete from public.time_entries where case_id = any(kids) or (case_id is null and description = 'Formação interna e organização do arquivo');
  delete from public.tasks where case_id = any(kids);
  delete from public.cases where id = any(kids);
  delete from public.clients where id = any(cids);
  delete from public.leads where notes like '%[teste]%';
end $$;
