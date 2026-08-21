-- Fase 0: contenção. Esta migration é deliberadamente conservadora.
-- O rollback permitido é reaplicar este estado, nunca restaurar grants vulneráveis.
begin;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Funções puramente consultivas usadas por políticas e pela UI em leitura.
do $migration$
begin
  if to_regprocedure('public.is_admin()') is not null then
    grant execute on function public.is_admin() to authenticated;
  end if;
  if to_regprocedure('public.is_master()') is not null then
    grant execute on function public.is_master() to authenticated;
  end if;
  if to_regprocedure('public.get_team_wages(uuid)') is not null then
    grant execute on function public.get_team_wages(uuid) to authenticated;
  end if;
end
$migration$;

-- Remove escrita de Storage por caminho compartilhado. A leitura pública dos
-- buckets é preservada; políticas seguras são criadas em migration posterior.
drop policy if exists "Upload de escudos" on storage.objects;
drop policy if exists "Update de escudos" on storage.objects;
drop policy if exists "Delete de escudos" on storage.objects;

commit;
