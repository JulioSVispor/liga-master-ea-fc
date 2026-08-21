-- Autorizações que precisam permanecer verdadeiras após toda migration.
select has_table_privilege('anon','public.profiles','UPDATE') anon_updates_profiles,
       has_table_privilege('authenticated','public.teams','UPDATE') authenticated_updates_teams,
       has_table_privilege('authenticated','public.matches','UPDATE') authenticated_updates_matches,
       has_table_privilege('authenticated','public.notifications','INSERT') authenticated_inserts_notifications;

select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
       p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname,arguments;

select lt.league_id,lt.team_id,lt.points,lt.played,lt.won,lt.drawn,lt.lost,
       lt.goals_for,lt.goals_against,lt.goals_difference
from public.league_teams lt order by lt.league_id,lt.team_id;
