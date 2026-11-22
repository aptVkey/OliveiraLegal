-- Remove a verificação de conflitos (funcionalidade retirada do backoffice)
drop function if exists public.conflict_check(text);
