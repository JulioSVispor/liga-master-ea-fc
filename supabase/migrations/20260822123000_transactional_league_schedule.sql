begin;

create or replace function public.replace_league_schedule(
  p_league_id uuid,
  p_fixtures jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues;
  v_team_count integer;
  v_fixture_count integer;
  v_expected_single integer;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_fixtures) <> 'array' or jsonb_array_length(p_fixtures) = 0 then
    raise exception 'Calendário inválido' using errcode = '22023';
  end if;

  select * into v_league from public.leagues where id = p_league_id for update;
  if not found then raise exception 'Liga não encontrada' using errcode = 'P0002'; end if;

  perform 1 from public.league_teams where league_id = p_league_id for update;
  select count(*) into v_team_count from public.league_teams where league_id = p_league_id;
  if v_team_count < 2 then raise exception 'A liga precisa de pelo menos dois clubes' using errcode = '22023'; end if;

  if exists (select 1 from public.matches where league_id = p_league_id and (status <> 'pending' or reported_by is not null)) then
    raise exception 'Não é possível regenerar uma liga com resultados ou disputas' using errcode = 'P0001';
  end if;

  create temporary table pg_temp.requested_fixtures (
    home_team_id uuid not null,
    away_team_id uuid not null,
    round_number integer not null
  ) on commit drop;

  insert into pg_temp.requested_fixtures(home_team_id, away_team_id, round_number)
  select x.home_team_id, x.away_team_id, x.round_number
  from jsonb_to_recordset(p_fixtures) as x(home_team_id uuid, away_team_id uuid, round_number integer);

  select count(*) into v_fixture_count from pg_temp.requested_fixtures;
  if v_fixture_count <> jsonb_array_length(p_fixtures) then
    raise exception 'Há confrontos incompletos no calendário' using errcode = '22023';
  end if;
  v_expected_single := (v_team_count * (v_team_count - 1)) / 2;
  if v_fixture_count not in (v_expected_single, v_expected_single * 2) then
    raise exception 'Quantidade de confrontos incompatível com a liga' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_temp.requested_fixtures f
    where f.round_number < 1 or f.home_team_id = f.away_team_id
       or not exists (select 1 from public.league_teams lt where lt.league_id = p_league_id and lt.team_id = f.home_team_id)
       or not exists (select 1 from public.league_teams lt where lt.league_id = p_league_id and lt.team_id = f.away_team_id)
  ) then raise exception 'O calendário contém clube ou rodada inválida' using errcode = '22023'; end if;
  if exists (
    select round_number, team_id
    from (
      select round_number, home_team_id team_id from pg_temp.requested_fixtures
      union all
      select round_number, away_team_id from pg_temp.requested_fixtures
    ) appearances
    group by round_number, team_id having count(*) > 1
  ) then raise exception 'Um clube não pode jogar duas vezes na mesma rodada' using errcode = '23505'; end if;
  if exists (
    select least(home_team_id, away_team_id), greatest(home_team_id, away_team_id)
    from pg_temp.requested_fixtures
    group by least(home_team_id, away_team_id), greatest(home_team_id, away_team_id)
    having count(*) <> case when v_fixture_count = v_expected_single then 1 else 2 end
  ) then raise exception 'Confrontos ausentes ou duplicados' using errcode = '23505'; end if;
  if v_fixture_count = v_expected_single * 2 and exists (
    select 1 from pg_temp.requested_fixtures a
    where not exists (
      select 1 from pg_temp.requested_fixtures b
      where b.home_team_id = a.away_team_id and b.away_team_id = a.home_team_id
    )
  ) then raise exception 'O returno precisa inverter os mandos' using errcode = '22023'; end if;

  delete from public.matches where league_id = p_league_id;
  insert into public.matches(
    season_id, league_id, competition_type, home_team_id, away_team_id,
    round_number, status, released
  )
  select v_league.season_id, p_league_id, 'league', home_team_id, away_team_id,
         round_number, 'pending', false
  from pg_temp.requested_fixtures;

  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'replace_league_schedule', 'leagues', p_league_id::text,
          jsonb_build_object('fixture_count', v_fixture_count));

  return jsonb_build_object('success', true, 'fixture_count', v_fixture_count);
end;
$$;

revoke all on function public.replace_league_schedule(uuid,jsonb) from public, anon;
grant execute on function public.replace_league_schedule(uuid,jsonb) to authenticated;

create or replace function public.toggle_shortlist(p_player_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shortlist_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Jogador inválido' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || p_player_id::text, 0)
  );

  select id into v_shortlist_id
  from public.shortlists
  where user_id = auth.uid() and player_id = p_player_id
  for update;

  if found then
    delete from public.shortlists where id = v_shortlist_id;
    return jsonb_build_object('added', false);
  end if;

  insert into public.shortlists(user_id, player_id)
  values (auth.uid(), p_player_id);
  return jsonb_build_object('added', true);
end;
$$;

revoke all on function public.toggle_shortlist(bigint) from public, anon;
grant execute on function public.toggle_shortlist(bigint) to authenticated;
grant select on public.shortlists to authenticated;

create or replace function public.repair_league_standings(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id) then
    raise exception 'Liga não encontrada' using errcode = 'P0002';
  end if;

  perform 1 from public.leagues where id = p_league_id for update;
  perform private.rebuild_league_standings(p_league_id);
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'repair_league_standings', 'leagues', p_league_id::text,
          jsonb_build_object('source', 'confirmed_matches'));
  return jsonb_build_object('success', true, 'league_id', p_league_id);
end;
$$;

revoke all on function public.repair_league_standings(uuid) from public, anon;
grant execute on function public.repair_league_standings(uuid) to authenticated;

commit;
