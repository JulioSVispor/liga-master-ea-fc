-- Execute em modo somente leitura e exporte o resultado antes de cada migration.
select now() at time zone 'utc' as captured_at_utc;
select 'auth_users' invariant,count(*)::numeric value from auth.users
union all select 'profiles',count(*) from public.profiles
union all select 'teams',count(*) from public.teams
union all select 'players',count(*) from public.players
union all select 'confirmed_matches',count(*) from public.matches where status='confirmed'
union all select 'active_listings',count(*) from public.market_listings where status='active'
union all select 'transfer_history',count(*) from public.transfer_history
union all select 'storage_objects',count(*) from storage.objects
order by invariant;

select id,name,budget,max_wage_cap,
       (select count(*) from public.players p where p.team_id=t.id) squad_size
from public.teams t order by id;

select 'negative_team_values' issue,count(*) rows from public.teams where budget<0 or max_wage_cap<0
union all select 'same_team_matches',count(*) from public.matches where home_team_id=away_team_id
union all select 'negative_scores',count(*) from public.matches where home_score<0 or away_score<0
union all select 'duplicate_active_listing_players',count(*) from (select player_id from public.market_listings where status='active' group by player_id having count(*)>1) d
union all select 'duplicate_pending_listing_bids',count(*) from (select market_listing_id from public.market_bids where status='pending' group by market_listing_id having count(*)>1) d;
