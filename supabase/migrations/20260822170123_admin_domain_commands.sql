begin;

create or replace function public.admin_move_player(
  p_player_id bigint,
  p_target_team_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players;
  v_source public.teams;
  v_target public.teams;
  v_transfer_type text;
begin
  perform private.require_admin();
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Justificativa obrigatória' using errcode = '22023';
  end if;

  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'Jogador não encontrado' using errcode = 'P0002'; end if;
  if v_player.team_id is not distinct from p_target_team_id then
    raise exception 'Jogador já está no destino informado' using errcode = 'P0001';
  end if;

  perform 1 from public.teams
   where id in (v_player.team_id, p_target_team_id)
   order by id for update;

  if v_player.team_id is not null then
    select * into v_source from public.teams where id = v_player.team_id;
  end if;
  if p_target_team_id is not null then
    select * into v_target from public.teams where id = p_target_team_id;
    if not found then raise exception 'Clube de destino não encontrado' using errcode = 'P0002'; end if;
    if private.team_wages(p_target_team_id) + v_player.wage > v_target.max_wage_cap then
      raise exception 'A transferência excederia o teto salarial do destino' using errcode = '23514';
    end if;
  end if;

  update public.players set team_id = p_target_team_id where id = p_player_id;
  v_transfer_type := case when p_target_team_id is null then 'release' else 'trade' end;

  insert into public.transfer_history(
    player_id, player_name, player_position, player_rating, player_face_url,
    from_team_id, to_team_id, from_team_name, to_team_name, amount, transfer_type
  ) values (
    v_player.id, v_player.name, v_player.position, v_player.rating, v_player.face_url,
    v_player.team_id, p_target_team_id, coalesce(v_source.name, 'Agente Livre'),
    coalesce(v_target.name, 'Agente Livre'), v_player.value, v_transfer_type
  );

  insert into public.notifications(user_id, title, content)
  select t.user_id, 'Elenco alterado pela administração',
         case when t.id = p_target_team_id
           then format('%s foi adicionado ao seu elenco. Motivo: %s', v_player.name, left(btrim(p_reason), 500))
           else format('%s foi removido do seu elenco. Motivo: %s', v_player.name, left(btrim(p_reason), 500))
         end
    from public.teams t
   where t.id in (v_player.team_id, p_target_team_id) and t.user_id is not null;

  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'move_player', 'players', p_player_id::text,
          jsonb_build_object('from', v_player.team_id, 'to', p_target_team_id,
                             'reason', left(btrim(p_reason), 500)));
  return jsonb_build_object('success', true, 'player_id', p_player_id,
                            'from_team_id', v_player.team_id, 'to_team_id', p_target_team_id);
end;
$$;

create or replace function public.admin_update_player_financials(
  p_player_id bigint,
  p_wage numeric,
  p_value numeric,
  p_reason text
)
returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare v_player public.players; v_before jsonb;
begin
  perform private.require_admin();
  if p_wage < 0 or p_value < 0 or nullif(btrim(p_reason), '') is null then
    raise exception 'Valores e justificativa inválidos' using errcode = '22023';
  end if;
  select * into v_player from public.players where id = p_player_id for update;
  if not found then raise exception 'Jogador não encontrado' using errcode = 'P0002'; end if;
  v_before := jsonb_build_object('wage', v_player.wage, 'value', v_player.value);
  update public.players set wage = p_wage, value = p_value
   where id = p_player_id returning * into v_player;
  if v_player.team_id is not null and private.team_wages(v_player.team_id) >
      (select t.max_wage_cap from public.teams t where t.id = v_player.team_id) then
    raise exception 'A alteração excederia o teto salarial do clube' using errcode = '23514';
  end if;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'update_player_financials', 'players', p_player_id::text,
          jsonb_build_object('before', v_before, 'after', jsonb_build_object('wage', p_wage, 'value', p_value),
                             'reason', left(btrim(p_reason), 500)));
  return v_player;
end;
$$;

create or replace function public.admin_create_cup(
  p_season_id uuid,
  p_cup_name text,
  p_start_round integer,
  p_team_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer; v_inserted integer;
begin
  perform private.require_admin();
  v_count := cardinality(p_team_ids);
  if nullif(btrim(p_cup_name), '') is null or p_start_round not in (1, 2, 3)
     or v_count not in (2, 4, 8) then
    raise exception 'Configuração de copa inválida' using errcode = '22023';
  end if;
  if (p_start_round = 1 and v_count <> 8) or (p_start_round = 2 and v_count <> 4)
     or (p_start_round = 3 and v_count <> 2) then
    raise exception 'Quantidade de clubes incompatível com a fase' using errcode = '22023';
  end if;
  if (select count(distinct team_id) from unnest(p_team_ids) team_id) <> v_count then
    raise exception 'A copa contém clubes duplicados' using errcode = '23505';
  end if;
  if (select count(*) from public.teams where id = any(p_team_ids)) <> v_count then
    raise exception 'Um ou mais clubes não existem' using errcode = 'P0002';
  end if;
  perform 1 from public.seasons where id = p_season_id for update;
  if not found then raise exception 'Temporada não encontrada' using errcode = 'P0002'; end if;
  if exists (select 1 from public.matches where season_id = p_season_id and league_id is null
      and cup_name = btrim(p_cup_name)) then
    raise exception 'Já existe uma copa com este nome na temporada' using errcode = '23505';
  end if;
  insert into public.matches(
    season_id, league_id, competition_type, cup_name, home_team_id, away_team_id,
    round_number, status, released
  )
  select p_season_id, null, 'cup_playoff', left(btrim(p_cup_name), 100),
         p_team_ids[i], p_team_ids[i + 1], p_start_round, 'pending', false
    from generate_series(1, v_count, 2) i;
  get diagnostics v_inserted = row_count;
  insert into public.audit_logs(admin_id, action_type, entity_name, details)
  values (auth.uid(), 'create_cup', 'matches',
          jsonb_build_object('season_id', p_season_id, 'cup_name', left(btrim(p_cup_name), 100),
                             'round', p_start_round, 'matches', v_inserted));
  return jsonb_build_object('success', true, 'matches', v_inserted);
end;
$$;

create or replace function public.admin_advance_cup(
  p_season_id uuid,
  p_cup_name text,
  p_current_round integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_winners uuid[]; v_count integer; v_inserted integer;
begin
  perform private.require_admin();
  if nullif(btrim(p_cup_name), '') is null or p_current_round not in (1, 2) then
    raise exception 'Fase inválida' using errcode = '22023';
  end if;
  perform 1 from public.matches
   where season_id = p_season_id and league_id is null and cup_name = btrim(p_cup_name)
     and round_number = p_current_round
   order by id for update;
  if not found then raise exception 'Fase não encontrada' using errcode = 'P0002'; end if;
  if exists (select 1 from public.matches where season_id = p_season_id and league_id is null
      and cup_name = btrim(p_cup_name) and round_number = p_current_round
      and (status <> 'confirmed' or home_score = away_score)) then
    raise exception 'Todos os jogos precisam estar confirmados e sem empate' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.matches where season_id = p_season_id and league_id is null
      and cup_name = btrim(p_cup_name) and round_number = p_current_round + 1) then
    raise exception 'A próxima fase já foi gerada' using errcode = '23505';
  end if;
  select array_agg(case when home_score > away_score then home_team_id else away_team_id end order by id)
    into v_winners
    from public.matches
   where season_id = p_season_id and league_id is null and cup_name = btrim(p_cup_name)
     and round_number = p_current_round;
  v_count := cardinality(v_winners);
  if v_count not in (2, 4) then raise exception 'Quantidade de classificados inválida' using errcode = 'P0001'; end if;
  insert into public.matches(
    season_id, league_id, competition_type, cup_name, home_team_id, away_team_id,
    round_number, status, released
  )
  select p_season_id, null, 'cup_playoff', btrim(p_cup_name), v_winners[i], v_winners[i + 1],
         p_current_round + 1, 'pending', false
    from generate_series(1, v_count, 2) i;
  get diagnostics v_inserted = row_count;
  insert into public.audit_logs(admin_id, action_type, entity_name, details)
  values (auth.uid(), 'advance_cup', 'matches',
          jsonb_build_object('season_id', p_season_id, 'cup_name', btrim(p_cup_name),
                             'from_round', p_current_round, 'matches', v_inserted));
  return jsonb_build_object('success', true, 'matches', v_inserted);
end;
$$;

create or replace function public.admin_reconcile_auth_user(
  p_user_id uuid,
  p_display_name text,
  p_team_name text,
  p_real_club_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user auth.users; v_budget numeric; v_cap numeric; v_team_id uuid;
begin
  perform private.require_master();
  if nullif(btrim(p_display_name), '') is null or nullif(btrim(p_team_name), '') is null
     or nullif(btrim(p_real_club_name), '') is null then
    raise exception 'Dados de reconciliação incompletos' using errcode = '22023';
  end if;
  select * into v_user from auth.users where id = p_user_id for update;
  if not found then raise exception 'Usuário Auth não encontrado' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where id = p_user_id)
     or exists (select 1 from public.teams where user_id = p_user_id) then
    raise exception 'Usuário já reconciliado' using errcode = '23505';
  end if;
  select coalesce(max(value::numeric) filter (where key = 'default_budget'), 50000000),
         coalesce(max(value::numeric) filter (where key = 'default_wage_cap'), 15000)
    into v_budget, v_cap from public.settings where key in ('default_budget', 'default_wage_cap');
  insert into public.profiles(id, email, display_name, role)
  values (p_user_id, lower(v_user.email), left(btrim(p_display_name), 100), 'user');
  insert into public.teams(user_id, name, real_club_name, budget, max_wage_cap)
  values (p_user_id, left(btrim(p_team_name), 100), left(btrim(p_real_club_name), 100), v_budget, v_cap)
  returning id into v_team_id;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'reconcile_auth_user', 'profiles', p_user_id::text,
          jsonb_build_object('team_id', v_team_id, 'source', 'manual_repair'));
  return jsonb_build_object('success', true, 'user_id', p_user_id, 'team_id', v_team_id);
end;
$$;

revoke all on function public.admin_move_player(bigint,uuid,text) from public, anon;
revoke all on function public.admin_update_player_financials(bigint,numeric,numeric,text) from public, anon;
revoke all on function public.admin_create_cup(uuid,text,integer,uuid[]) from public, anon;
revoke all on function public.admin_advance_cup(uuid,text,integer) from public, anon;
revoke all on function public.admin_reconcile_auth_user(uuid,text,text,text) from public, anon;
grant execute on function public.admin_move_player(bigint,uuid,text) to authenticated;
grant execute on function public.admin_update_player_financials(bigint,numeric,numeric,text) to authenticated;
grant execute on function public.admin_create_cup(uuid,text,integer,uuid[]) to authenticated;
grant execute on function public.admin_advance_cup(uuid,text,integer) to authenticated;
grant execute on function public.admin_reconcile_auth_user(uuid,text,text,text) to authenticated;

commit;
