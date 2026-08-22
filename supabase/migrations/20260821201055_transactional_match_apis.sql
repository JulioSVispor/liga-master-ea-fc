begin;

create or replace function private.rebuild_league_standings(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.league_teams
     set points = 0, played = 0, won = 0, drawn = 0, lost = 0,
         goals_for = 0, goals_against = 0, goals_difference = 0
   where league_id = p_league_id;

  with team_results as (
    select m.league_id, m.home_team_id as team_id,
           1 as played,
           (m.home_score > m.away_score)::int as won,
           (m.home_score = m.away_score)::int as drawn,
           (m.home_score < m.away_score)::int as lost,
           m.home_score as goals_for,
           m.away_score as goals_against
      from public.matches m
     where m.status = 'confirmed' and m.league_id = p_league_id
    union all
    select m.league_id, m.away_team_id,
           1,
           (m.away_score > m.home_score)::int,
           (m.away_score = m.home_score)::int,
           (m.away_score < m.home_score)::int,
           m.away_score,
           m.home_score
      from public.matches m
     where m.status = 'confirmed' and m.league_id = p_league_id
  ), totals as (
    select league_id, team_id,
           sum(played)::int played,
           sum(won)::int won,
           sum(drawn)::int drawn,
           sum(lost)::int lost,
           sum(goals_for)::int goals_for,
           sum(goals_against)::int goals_against
      from team_results
     group by league_id, team_id
  )
  update public.league_teams lt
     set played = t.played,
         won = t.won,
         drawn = t.drawn,
         lost = t.lost,
         goals_for = t.goals_for,
         goals_against = t.goals_against,
         goals_difference = t.goals_for - t.goals_against,
         points = (t.won * 3) + t.drawn
    from totals t
   where lt.league_id = t.league_id and lt.team_id = t.team_id;
end;
$$;

create or replace function private.rebuild_season_discipline(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card record;
  v_next_match uuid;
begin
  delete from public.suspensions
   where season_id = p_season_id
     and reason in ('auto:red_card', 'auto:three_yellows');

  for v_card in
    with cards as (
      select me.id, me.player_id, me.team_id, me.event_type,
             m.id match_id, m.match_date, m.season_id,
             case when m.competition_type = 'league' then 'league' else 'cup' end bucket,
             row_number() over (
               partition by me.player_id, m.season_id,
                 case when m.competition_type = 'league' then 'league' else 'cup' end,
                 me.event_type
               order by m.match_date, m.id, me.id
             ) card_number
        from public.match_events me
        join public.matches m on m.id = me.match_id
       where m.season_id = p_season_id
         and m.status = 'confirmed'
         and m.competition_type <> 'friendly'
         and me.event_type in ('yellow_card', 'red_card')
    )
    select * from cards
     where event_type = 'red_card'
        or (event_type = 'yellow_card' and card_number % 3 = 0)
     order by match_date, match_id, id
  loop
    select m.id into v_next_match
      from public.matches m
     where m.season_id = p_season_id
       and (m.home_team_id = v_card.team_id or m.away_team_id = v_card.team_id)
       and case when v_card.bucket = 'league'
                then m.competition_type = 'league'
                else m.competition_type in ('cup_group', 'cup_playoff') end
       and (m.match_date, m.id) > (v_card.match_date, v_card.match_id)
     order by m.match_date, m.id
     limit 1;

    if v_next_match is not null then
      insert into public.suspensions(player_id, season_id, match_id, reason)
      values (
        v_card.player_id,
        p_season_id,
        v_next_match,
        case when v_card.event_type = 'red_card'
             then 'auto:red_card' else 'auto:three_yellows' end
      );
    end if;
  end loop;
end;
$$;

revoke all on function private.rebuild_league_standings(uuid) from public, anon, authenticated;
revoke all on function private.rebuild_season_discipline(uuid) from public, anon, authenticated;

create or replace function public.report_match(
  p_match_id uuid,
  p_home_score integer,
  p_away_score integer,
  p_motm_player_id bigint default null,
  p_events_json jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_team_id uuid;
  v_event jsonb;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if p_home_score < 0 or p_away_score < 0 then raise exception 'Placar inválido' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_events_json, '[]'::jsonb)) <> 'array' then
    raise exception 'Eventos inválidos' using errcode = '22023';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;

  select t.id into v_team_id
    from public.teams t
   where t.user_id = auth.uid()
     and t.id in (v_match.home_team_id, v_match.away_team_id);

  if v_team_id is null then raise exception 'Clube não participa da partida' using errcode = '42501'; end if;
  if not v_match.released then raise exception 'Partida ainda não liberada' using errcode = 'P0001'; end if;
  if v_match.status <> 'pending' or v_match.reported_by is not null then
    raise exception 'Partida já reportada' using errcode = 'P0001';
  end if;

  if p_motm_player_id is not null and not exists (
    select 1 from public.players p
     where p.id = p_motm_player_id
       and p.team_id in (v_match.home_team_id, v_match.away_team_id)
  ) then
    raise exception 'Destaque inválido' using errcode = '22023';
  end if;

  delete from public.match_events where match_id = p_match_id;
  for v_event in select value from jsonb_array_elements(coalesce(p_events_json, '[]'::jsonb))
  loop
    if (v_event->>'event_type') not in ('goal','assist','yellow_card','red_card') then
      raise exception 'Tipo de evento inválido' using errcode = '22023';
    end if;
    if (v_event->>'team_id')::uuid not in (v_match.home_team_id, v_match.away_team_id) then
      raise exception 'Clube do evento inválido' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.players p
       where p.id = (v_event->>'player_id')::bigint
         and p.team_id = (v_event->>'team_id')::uuid
    ) then
      raise exception 'Jogador do evento inválido' using errcode = '22023';
    end if;

    insert into public.match_events(match_id, team_id, player_id, event_type, minute)
    values (
      p_match_id,
      (v_event->>'team_id')::uuid,
      (v_event->>'player_id')::bigint,
      v_event->>'event_type',
      nullif(v_event->>'minute','')::integer
    );
  end loop;

  update public.matches
     set home_score = p_home_score,
         away_score = p_away_score,
         motm_player_id = p_motm_player_id,
         reported_by = auth.uid(),
         disputed_by = null,
         dispute_reason = null,
         dispute_proof_url = null
   where id = p_match_id;

  insert into public.notifications(user_id, title, content)
  select t.user_id, 'Resultado aguardando confirmação',
         'O adversário reportou o resultado da partida.'
    from public.teams t
   where t.id in (v_match.home_team_id, v_match.away_team_id)
     and t.user_id is not null and t.user_id <> auth.uid();

  return jsonb_build_object('success', true, 'match_id', p_match_id);
end;
$$;

create or replace function public.confirm_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;
  if v_match.status <> 'pending' or v_match.reported_by is null then
    raise exception 'Partida não está aguardando confirmação' using errcode = 'P0001';
  end if;
  if v_match.reported_by = auth.uid() then
    raise exception 'Quem reporta não pode confirmar' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.teams t
     where t.user_id = auth.uid()
       and t.id in (v_match.home_team_id, v_match.away_team_id)
  ) then
    raise exception 'Somente o adversário pode confirmar' using errcode = '42501';
  end if;

  update public.matches set status = 'confirmed' where id = p_match_id;
  insert into public.notifications(user_id,title,content)
  values(v_match.reported_by,'Resultado confirmado','O adversário confirmou o resultado reportado.');
  if v_match.league_id is not null then
    perform private.rebuild_league_standings(v_match.league_id);
  end if;
  perform private.rebuild_season_discipline(v_match.season_id);
  return jsonb_build_object('success', true, 'match_id', p_match_id);
end;
$$;

drop function if exists public.dispute_match(uuid, uuid, text, text);
create or replace function public.dispute_match(p_match_id uuid, p_reason text, p_proof_url text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_match public.matches;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason,''))) < 10 then
    raise exception 'Descreva a divergência com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;
  if v_match.status <> 'pending' or v_match.reported_by is null then
    raise exception 'Partida não pode ser contestada' using errcode = 'P0001';
  end if;
  if v_match.reported_by = auth.uid() or not exists (
    select 1 from public.teams t where t.user_id = auth.uid()
      and t.id in (v_match.home_team_id, v_match.away_team_id)
  ) then
    raise exception 'Somente o adversário pode contestar' using errcode = '42501';
  end if;
  update public.matches
     set status = 'dispute', disputed_by = auth.uid(),
         dispute_reason = left(btrim(p_reason), 2000),
         dispute_proof_url = nullif(btrim(p_proof_url), '')
   where id = p_match_id;
  insert into public.notifications(user_id,title,content)
  values(v_match.reported_by,'Resultado contestado','O resultado reportado foi encaminhado para arbitragem.');
  return jsonb_build_object('success', true, 'match_id', p_match_id);
end;
$$;

create or replace function public.apply_walkover(p_match_id uuid, p_winner_type text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_match public.matches;
begin
  if not public.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if p_winner_type not in ('home','away') then raise exception 'Vencedor inválido' using errcode = '22023'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Justificativa obrigatória' using errcode = '22023'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;
  delete from public.match_events where match_id = p_match_id;
  update public.matches
     set home_score = case when p_winner_type='home' then 3 else 0 end,
         away_score = case when p_winner_type='away' then 3 else 0 end,
         status = 'confirmed', reported_by = auth.uid(), disputed_by = null,
         dispute_reason = null, dispute_proof_url = null, motm_player_id = null
   where id = p_match_id;
  insert into public.audit_logs(admin_id, action_type, entity_name, entity_id, details)
  values (auth.uid(), 'apply_walkover', 'matches', p_match_id::text,
          jsonb_build_object('winner_type',p_winner_type,'reason',p_reason));
  if v_match.league_id is not null then perform private.rebuild_league_standings(v_match.league_id); end if;
  perform private.rebuild_season_discipline(v_match.season_id);
  return jsonb_build_object('success', true, 'match_id', p_match_id);
end;
$$;

create or replace function public.resolve_match(p_match_id uuid, p_resolution jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_match public.matches; v_event jsonb;
begin
  if not public.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if jsonb_typeof(p_resolution) <> 'object' then raise exception 'Resolução inválida' using errcode = '22023'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;
  if v_match.status = 'confirmed' then
    raise exception 'Reabra a partida antes de alterar um resultado confirmado' using errcode = 'P0001';
  end if;
  if coalesce((p_resolution->>'home_score')::int,-1) < 0 or coalesce((p_resolution->>'away_score')::int,-1) < 0 then
    raise exception 'Placar inválido' using errcode = '22023';
  end if;
  if nullif(p_resolution->>'motm_player_id', '') is not null and not exists (
    select 1 from public.players p
     where p.id = (p_resolution->>'motm_player_id')::bigint
       and p.team_id in (v_match.home_team_id, v_match.away_team_id)
  ) then raise exception 'Destaque inválido' using errcode = '22023'; end if;
  if p_resolution ? 'events' then
    if jsonb_typeof(p_resolution->'events') <> 'array' then
      raise exception 'Eventos inválidos' using errcode = '22023';
    end if;
    delete from public.match_events where match_id = p_match_id;
    for v_event in select value from jsonb_array_elements(p_resolution->'events') loop
      if (v_event->>'event_type') not in ('goal','assist','yellow_card','red_card')
         or (v_event->>'team_id')::uuid not in (v_match.home_team_id, v_match.away_team_id)
         or not exists (
           select 1 from public.players p
            where p.id = (v_event->>'player_id')::bigint
              and p.team_id = (v_event->>'team_id')::uuid
         ) then raise exception 'Evento inválido' using errcode = '22023'; end if;
      insert into public.match_events(match_id,team_id,player_id,event_type,minute)
      values (p_match_id,(v_event->>'team_id')::uuid,(v_event->>'player_id')::bigint,
              v_event->>'event_type',nullif(v_event->>'minute','')::int);
    end loop;
  end if;
  update public.matches set
    home_score=(p_resolution->>'home_score')::int,
    away_score=(p_resolution->>'away_score')::int,
    motm_player_id=nullif(p_resolution->>'motm_player_id','')::bigint,
    status='confirmed', reported_by=auth.uid(), disputed_by=null,
    dispute_reason=null, dispute_proof_url=null
  where id=p_match_id;
  insert into public.audit_logs(admin_id,action_type,entity_name,entity_id,details)
  values(auth.uid(),'resolve_match','matches',p_match_id::text,p_resolution);
  insert into public.notifications(user_id,title,content)
  select t.user_id, 'Partida homologada', 'A arbitragem definiu e confirmou o resultado da partida.'
    from public.teams t
   where t.id in (v_match.home_team_id, v_match.away_team_id) and t.user_id is not null;
  if v_match.league_id is not null then perform private.rebuild_league_standings(v_match.league_id); end if;
  perform private.rebuild_season_discipline(v_match.season_id);
  return jsonb_build_object('success',true,'match_id',p_match_id);
end;
$$;

create or replace function public.reopen_match(p_match_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_match public.matches;
begin
  if not public.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Justificativa obrigatória' using errcode = '22023'; end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if not found then raise exception 'Partida não encontrada' using errcode = 'P0002'; end if;
  insert into public.audit_logs(admin_id,action_type,entity_name,entity_id,details)
  values(auth.uid(),'reopen_match','matches',p_match_id::text,
         jsonb_build_object('reason',p_reason,'before',to_jsonb(v_match)));
  delete from public.match_events where match_id=p_match_id;
  update public.matches set home_score=null,away_score=null,motm_player_id=null,
    status='pending',reported_by=null,disputed_by=null,dispute_reason=null,dispute_proof_url=null
  where id=p_match_id;
  insert into public.notifications(user_id,title,content)
  select t.user_id, 'Partida reaberta', 'A arbitragem reabriu a partida para um novo reporte.'
    from public.teams t
   where t.id in (v_match.home_team_id, v_match.away_team_id) and t.user_id is not null;
  if v_match.league_id is not null then perform private.rebuild_league_standings(v_match.league_id); end if;
  perform private.rebuild_season_discipline(v_match.season_id);
  return jsonb_build_object('success',true,'match_id',p_match_id);
end;
$$;

revoke all on function public.report_match(uuid,integer,integer,bigint,jsonb) from public, anon;
revoke all on function public.confirm_match(uuid) from public, anon;
revoke all on function public.dispute_match(uuid,text,text) from public, anon;
revoke all on function public.apply_walkover(uuid,text,text) from public, anon;
revoke all on function public.resolve_match(uuid,jsonb) from public, anon;
revoke all on function public.reopen_match(uuid,text) from public, anon;
grant execute on function public.report_match(uuid,integer,integer,bigint,jsonb) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.dispute_match(uuid,text,text) to authenticated;
grant execute on function public.apply_walkover(uuid,text,text) to authenticated;
grant execute on function public.resolve_match(uuid,jsonb) to authenticated;
grant execute on function public.reopen_match(uuid,text) to authenticated;

commit;
