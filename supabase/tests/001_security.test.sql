begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(not has_table_privilege('anon','public.profiles','UPDATE'),'anon não atualiza profiles');
select ok(not has_table_privilege('authenticated','public.teams','UPDATE'),'authenticated não atualiza teams diretamente');
select ok(not has_table_privilege('authenticated','public.matches','UPDATE'),'authenticated não atualiza partidas diretamente');
select ok(not has_table_privilege('authenticated','public.notifications','INSERT'),'cliente não insere notificações');
select ok(not has_function_privilege('anon','public.buy_free_agent(bigint)','EXECUTE'),'anon não compra agente livre');
select ok(has_function_privilege('authenticated','public.buy_free_agent(bigint)','EXECUTE'),'authenticated usa RPC autorizada');
select ok(not has_function_privilege('authenticated','public.buy_free_agent(bigint,uuid)','EXECUTE'),'assinatura legada com team_id segue revogada');
select ok(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prosecdef
     and not exists(
       select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) setting
        where setting like 'search_path=%'
     )
),'SECURITY DEFINER usa search_path vazio');
select ok(not exists(
  select 1 from information_schema.routine_privileges
   where specific_schema='public' and grantee in('PUBLIC','anon') and privilege_type='EXECUTE'
),'PUBLIC e anon não executam funções públicas');

select * from finish();
rollback;
