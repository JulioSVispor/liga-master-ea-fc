begin;

-- This migration is incremental over the recovered remote schema. It keeps the
-- database contained: tables remain read-only to API roles and every mutation
-- below derives the actor from auth.uid().
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_master()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_master() then
    raise exception 'Acesso restrito ao master' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;
revoke all on function private.require_master() from public, anon, authenticated;

create or replace function public.mark_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  update public.notifications
     set read = true
   where user_id = auth.uid() and coalesce(read, false) = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_update_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_key text; v_value text; v_count integer := 0;
begin
  perform private.require_admin();
  if jsonb_typeof(p_settings) <> 'object' or jsonb_object_length(p_settings) = 0 then
    raise exception 'Configurações inválidas' using errcode = '22023';
  end if;
  if jsonb_object_length(p_settings) > 50 then
    raise exception 'Limite de configurações excedido' using errcode = '22023';
  end if;

  for v_key, v_value in select key, value from jsonb_each_text(p_settings)
  loop
    if v_key !~ '^[a-z][a-z0-9_]{1,63}$' or length(v_value) > 500 then
      raise exception 'Configuração inválida: %', v_key using errcode = '22023';
    end if;
    insert into public.settings(key, value, updated_at)
    values (v_key, v_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs(admin_id, action_type, entity_name, details)
  values (auth.uid(), 'update_settings', 'settings',
          jsonb_build_object('keys', (select jsonb_agg(key order by key) from jsonb_object_keys(p_settings) key)));
  return jsonb_build_object('success', true, 'updated', v_count);
end;
$$;

create or replace function public.admin_create_season(p_name text, p_activate boolean default true)
returns public.seasons
language plpgsql
security definer
set search_path = ''
as $$
declare v_season public.seasons;
begin
  perform private.require_admin();
  if nullif(btrim(p_name), '') is null then
    raise exception 'Nome da temporada obrigatório' using errcode = '22023';
  end if;
  if p_activate then
    update public.seasons set status = 'completed' where status = 'active';
  end if;
  insert into public.seasons(name, status)
  values (left(btrim(p_name), 100), case when p_activate then 'active' else 'completed' end)
  returning * into v_season;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'create_season', 'seasons', v_season.id::text,
          jsonb_build_object('name', v_season.name, 'status', v_season.status));
  return v_season;
end;
$$;

create or replace function public.admin_set_season_status(p_season_id uuid, p_status text)
returns public.seasons
language plpgsql
security definer
set search_path = ''
as $$
declare v_season public.seasons;
begin
  perform private.require_admin();
  if p_status not in ('active', 'completed') then
    raise exception 'Status de temporada inválido' using errcode = '22023';
  end if;
  if p_status = 'active' then
    update public.seasons set status = 'completed' where status = 'active' and id <> p_season_id;
  end if;
  update public.seasons set status = p_status where id = p_season_id returning * into v_season;
  if not found then raise exception 'Temporada não encontrada' using errcode = 'P0002'; end if;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'set_season_status', 'seasons', p_season_id::text,
          jsonb_build_object('status', p_status));
  return v_season;
end;
$$;

create or replace function public.admin_set_market_window(p_season_id uuid, p_open boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.seasons set market_open = p_open where id = p_season_id;
  if not found then raise exception 'Temporada não encontrada' using errcode = 'P0002'; end if;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'set_market_window', 'seasons', p_season_id::text,
          jsonb_build_object('open', p_open));
  return p_open;
end;
$$;

create or replace function public.admin_finish_season(p_season_id uuid, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_pending integer;
begin
  perform private.require_admin();
  if p_force and not public.is_master() then
    raise exception 'Somente o master pode forçar o encerramento' using errcode = '42501';
  end if;
  perform 1 from public.seasons where id = p_season_id for update;
  if not found then raise exception 'Temporada não encontrada' using errcode = 'P0002'; end if;
  select count(*) into v_pending from public.matches
   where season_id = p_season_id and status <> 'confirmed';
  if v_pending > 0 and not p_force then
    raise exception 'Existem % partidas pendentes', v_pending using errcode = 'P0001';
  end if;
  update public.seasons set status = 'completed', market_open = false where id = p_season_id;
  insert into public.settings(key, value, updated_at) values ('season_stage', 'first_half', now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'finish_season', 'seasons', p_season_id::text,
          jsonb_build_object('force', p_force, 'pending_matches', v_pending));
  return jsonb_build_object('success', true, 'pending_matches', v_pending);
end;
$$;

create or replace function public.admin_create_league(p_season_id uuid, p_name text, p_division integer)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare v_league public.leagues;
begin
  perform private.require_admin();
  if nullif(btrim(p_name), '') is null or p_division < 1 then
    raise exception 'Dados da liga inválidos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.seasons where id = p_season_id) then
    raise exception 'Temporada não encontrada' using errcode = 'P0002';
  end if;
  insert into public.leagues(season_id, name, division, status)
  values (p_season_id, left(btrim(p_name), 100), p_division, 'active')
  returning * into v_league;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'create_league', 'leagues', v_league.id::text,
          jsonb_build_object('season_id', p_season_id, 'division', p_division));
  return v_league;
end;
$$;

create or replace function public.admin_add_team_to_league(p_league_id uuid, p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_season_id uuid; v_id uuid;
begin
  perform private.require_admin();
  select season_id into v_season_id from public.leagues where id = p_league_id for update;
  if not found then raise exception 'Liga não encontrada' using errcode = 'P0002'; end if;
  perform 1 from public.teams where id = p_team_id for update;
  if not found then raise exception 'Clube não encontrado' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.league_teams lt
    join public.leagues l on l.id = lt.league_id
    where l.season_id = v_season_id and lt.team_id = p_team_id
  ) then
    raise exception 'Clube já vinculado a uma divisão nesta temporada' using errcode = '23505';
  end if;
  insert into public.league_teams(league_id, team_id)
  values (p_league_id, p_team_id) returning id into v_id;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'add_team_to_league', 'league_teams', v_id::text,
          jsonb_build_object('league_id', p_league_id, 'team_id', p_team_id));
  return v_id;
end;
$$;

create or replace function public.admin_remove_team_from_league(p_league_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.league_teams;
begin
  perform private.require_admin();
  select * into v_row from public.league_teams where id = p_league_team_id for update;
  if not found then raise exception 'Participação não encontrada' using errcode = 'P0002'; end if;
  if exists (select 1 from public.matches where league_id = v_row.league_id and
      (home_team_id = v_row.team_id or away_team_id = v_row.team_id)) then
    raise exception 'Remova ou recrie o calendário antes de retirar o clube' using errcode = 'P0001';
  end if;
  delete from public.league_teams where id = p_league_team_id;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'remove_team_from_league', 'league_teams', p_league_team_id::text,
          jsonb_build_object('league_id', v_row.league_id, 'team_id', v_row.team_id));
  return true;
end;
$$;

create or replace function public.admin_move_team_between_leagues(
  p_team_id uuid, p_source_league_id uuid, p_target_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_source_season uuid; v_target_season uuid;
begin
  perform private.require_admin();
  if p_source_league_id = p_target_league_id then
    raise exception 'Liga de destino deve ser diferente' using errcode = '22023';
  end if;
  perform 1 from public.leagues where id in (p_source_league_id, p_target_league_id) order by id for update;
  select season_id into v_source_season from public.leagues where id = p_source_league_id;
  select season_id into v_target_season from public.leagues where id = p_target_league_id;
  if v_source_season is null or v_target_season is null then raise exception 'Liga não encontrada' using errcode = 'P0002'; end if;
  if v_source_season <> v_target_season then raise exception 'As ligas devem pertencer à mesma temporada' using errcode = '22023'; end if;
  if exists (select 1 from public.matches where league_id = p_source_league_id and
      (home_team_id = p_team_id or away_team_id = p_team_id) and (status <> 'pending' or reported_by is not null)) then
    raise exception 'Clube com resultado não pode ser movido' using errcode = 'P0001';
  end if;
  delete from public.matches where league_id = p_source_league_id and
    (home_team_id = p_team_id or away_team_id = p_team_id) and status = 'pending' and reported_by is null;
  delete from public.league_teams where league_id = p_source_league_id and team_id = p_team_id;
  if not found then raise exception 'Clube não pertence à liga de origem' using errcode = 'P0002'; end if;
  if exists (select 1 from public.league_teams where league_id = p_target_league_id and team_id = p_team_id) then
    raise exception 'Clube já pertence à liga de destino' using errcode = '23505';
  end if;
  insert into public.league_teams(league_id, team_id) values (p_target_league_id, p_team_id);
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'move_team_between_leagues', 'teams', p_team_id::text,
          jsonb_build_object('from', p_source_league_id, 'to', p_target_league_id));
  return true;
end;
$$;

create or replace function public.admin_set_round_release(
  p_season_id uuid, p_round_number integer, p_released boolean,
  p_league_id uuid default null, p_cup_name text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  perform private.require_admin();
  if p_round_number < 1 or ((p_league_id is null) = (nullif(btrim(p_cup_name), '') is null)) then
    raise exception 'Escopo da rodada inválido' using errcode = '22023';
  end if;
  update public.matches
     set released = p_released
   where season_id = p_season_id and round_number = p_round_number
     and ((p_league_id is not null and league_id = p_league_id)
       or (p_league_id is null and league_id is null and cup_name = btrim(p_cup_name)));
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'Nenhuma partida encontrada para a rodada' using errcode = 'P0002'; end if;
  insert into public.audit_logs(admin_id, action_type, entity_name, details)
  values (auth.uid(), 'set_round_release', 'matches',
          jsonb_build_object('season_id', p_season_id, 'league_id', p_league_id,
            'cup_name', p_cup_name, 'round', p_round_number, 'released', p_released,
            'matches', v_count));
  return v_count;
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_old_role text;
begin
  perform private.require_master();
  if p_role not in ('user', 'admin', 'master') then
    raise exception 'Papel inválido' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and p_role <> 'master' then
    raise exception 'O master não pode remover o próprio papel' using errcode = 'P0001';
  end if;
  select role into v_old_role from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Perfil não encontrado' using errcode = 'P0002'; end if;
  update public.profiles set role = p_role where id = p_user_id;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'set_user_role', 'profiles', p_user_id::text,
          jsonb_build_object('before', v_old_role, 'after', p_role));
  return p_role;
end;
$$;

create or replace function public.admin_update_team_financials(
  p_team_id uuid, p_budget numeric, p_max_wage_cap numeric, p_reason text
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare v_team public.teams; v_delta numeric;
begin
  perform private.require_admin();
  if p_budget < 0 or p_max_wage_cap < 0 or nullif(btrim(p_reason), '') is null then
    raise exception 'Dados financeiros inválidos' using errcode = '22023';
  end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception 'Clube não encontrado' using errcode = 'P0002'; end if;
  v_delta := p_budget - v_team.budget;
  update public.teams set budget = p_budget, max_wage_cap = p_max_wage_cap
   where id = p_team_id returning * into v_team;
  if v_delta <> 0 then
    perform private.record_financial_transaction(
      p_team_id, null, v_delta, p_budget - v_delta, 'admin_adjustment', 'teams', p_team_id::text, left(btrim(p_reason), 500)
    );
  end if;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'update_team_financials', 'teams', p_team_id::text,
          jsonb_build_object('budget', p_budget, 'max_wage_cap', p_max_wage_cap, 'reason', p_reason));
  return v_team;
end;
$$;

-- W.O. is idempotent only for the same previously audited operation; otherwise
-- a confirmed match must be explicitly reopened first.
create or replace function public.apply_walkover(p_match_id uuid, p_winner_type text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_match public.matches; v_home integer; v_away integer;
begin
  perform private.require_admin();
  if p_winner_type not in ('home','away') then raise exception 'Vencedor inválido' using errcode = '22023'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Justificativa obrigatória' using errcode = '22023'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;
  v_home := case when p_winner_type = 'home' then 3 else 0 end;
  v_away := case when p_winner_type = 'away' then 3 else 0 end;
  if exists (
    select 1 from public.audit_logs
     where action_type = 'apply_walkover' and entity_name = 'matches'
       and entity_id = p_match_id::text and details->>'winner_type' = p_winner_type
  ) and v_match.status = 'confirmed' and v_match.home_score = v_home and v_match.away_score = v_away then
    return jsonb_build_object('success', true, 'match_id', p_match_id, 'idempotent', true);
  end if;
  if v_match.status = 'confirmed' then
    raise exception 'Partida confirmada precisa ser reaberta antes de novo W.O.' using errcode = 'P0001';
  end if;
  delete from public.match_events where match_id = p_match_id;
  update public.matches set home_score = v_home, away_score = v_away,
    status = 'confirmed', reported_by = auth.uid(), disputed_by = null,
    dispute_reason = null, dispute_proof_url = null, motm_player_id = null
  where id = p_match_id;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'apply_walkover', 'matches', p_match_id::text,
          jsonb_build_object('winner_type', p_winner_type, 'reason', left(btrim(p_reason), 1000)));
  if v_match.league_id is not null then perform private.rebuild_league_standings(v_match.league_id); end if;
  perform private.rebuild_season_discipline(v_match.season_id);
  return jsonb_build_object('success', true, 'match_id', p_match_id, 'idempotent', false);
end;
$$;

revoke all on function public.mark_notifications_read() from public, anon;
revoke all on function public.admin_update_settings(jsonb) from public, anon;
revoke all on function public.admin_create_season(text,boolean) from public, anon;
revoke all on function public.admin_set_season_status(uuid,text) from public, anon;
revoke all on function public.admin_set_market_window(uuid,boolean) from public, anon;
revoke all on function public.admin_finish_season(uuid,boolean) from public, anon;
revoke all on function public.admin_create_league(uuid,text,integer) from public, anon;
revoke all on function public.admin_add_team_to_league(uuid,uuid) from public, anon;
revoke all on function public.admin_remove_team_from_league(uuid) from public, anon;
revoke all on function public.admin_move_team_between_leagues(uuid,uuid,uuid) from public, anon;
revoke all on function public.admin_set_round_release(uuid,integer,boolean,uuid,text) from public, anon;
revoke all on function public.admin_set_user_role(uuid,text) from public, anon;
revoke all on function public.admin_update_team_financials(uuid,numeric,numeric,text) from public, anon;
revoke all on function public.apply_walkover(uuid,text,text) from public, anon;

grant execute on function public.mark_notifications_read() to authenticated;
grant execute on function public.admin_update_settings(jsonb) to authenticated;
grant execute on function public.admin_create_season(text,boolean) to authenticated;
grant execute on function public.admin_set_season_status(uuid,text) to authenticated;
grant execute on function public.admin_set_market_window(uuid,boolean) to authenticated;
grant execute on function public.admin_finish_season(uuid,boolean) to authenticated;
grant execute on function public.admin_create_league(uuid,text,integer) to authenticated;
grant execute on function public.admin_add_team_to_league(uuid,uuid) to authenticated;
grant execute on function public.admin_remove_team_from_league(uuid) to authenticated;
grant execute on function public.admin_move_team_between_leagues(uuid,uuid,uuid) to authenticated;
grant execute on function public.admin_set_round_release(uuid,integer,boolean,uuid,text) to authenticated;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
grant execute on function public.admin_update_team_financials(uuid,numeric,numeric,text) to authenticated;
grant execute on function public.apply_walkover(uuid,text,text) to authenticated;

commit;
