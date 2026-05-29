-- ========================================================
-- ATUALIZAÇÕES DA FASE 4: SUSPENSÕES E CONFIRMAÇÃO DE PARTIDAS
-- ========================================================

-- 13. Tabela de Suspensões de Jogadores
create table if not exists public.suspensions (
    id uuid default gen_random_uuid() primary key,
    player_id bigint references public.players(id) on delete cascade not null,
    season_id uuid references public.seasons(id) on delete cascade not null,
    match_id uuid references public.matches(id) on delete cascade, -- Partida na qual ele deve cumprir suspensão
    reason text not null check (reason in ('3_yellows', 'red_card')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para suspensões
alter table public.suspensions enable row level security;
drop policy if exists "Permitir leitura para todos" on public.suspensions;
create policy "Permitir leitura para todos" on public.suspensions for select using (true);

-- Função para registrar disputas de partidas
create or replace function public.dispute_match(
    p_match_id uuid,
    p_user_id uuid,
    p_reason text,
    p_proof_url text
)
returns json as $$
begin
    update public.matches
    set status = 'dispute',
        disputed_by = p_user_id,
        dispute_reason = p_reason,
        dispute_proof_url = p_proof_url
    where id = p_match_id and status = 'pending';
    
    return json_build_object('success', true, 'message', 'Partida colocada em disputa com sucesso!');
end;
$$ language plpgsql security definer;

-- Função para confirmar partida e processar classificação e suspensões
create or replace function public.confirm_match(p_match_id uuid)
returns json as $$
declare
    v_season_id uuid;
    v_league_id uuid;
    v_competition_type text;
    v_home_team_id uuid;
    v_away_team_id uuid;
    v_home_score integer;
    v_away_score integer;
    v_status text;
    v_event record;
    v_yellow_count integer;
    v_next_match_id uuid;
begin
    -- 1. Obter dados da partida
    select season_id, league_id, competition_type, home_team_id, away_team_id, home_score, away_score, status
    into v_season_id, v_league_id, v_competition_type, v_home_team_id, v_away_team_id, v_home_score, v_away_score, v_status
    from public.matches
    where id = p_match_id;

    if v_status is null then
        return json_build_object('success', false, 'message', 'Partida não encontrada!');
    end if;

    if v_status = 'confirmed' then
        return json_build_object('success', false, 'message', 'Esta partida já foi confirmada anteriormente!');
    end if;

    -- 2. Atualizar status da partida para confirmed
    update public.matches
    set status = 'confirmed'
    where id = p_match_id;

    -- 3. Se for jogo de liga, atualizar classificação
    if v_competition_type = 'league' and v_league_id is not null then
        -- Home Team Update
        update public.league_teams
        set
            played = played + 1,
            goals_for = goals_for + v_home_score,
            goals_against = goals_against + v_away_score,
            goals_difference = goals_difference + (v_home_score - v_away_score),
            won = won + case when v_home_score > v_away_score then 1 else 0 end,
            drawn = drawn + case when v_home_score = v_away_score then 1 else 0 end,
            lost = lost + case when v_home_score < v_away_score then 1 else 0 end,
            points = points + case
                when v_home_score > v_away_score then 3
                when v_home_score = v_away_score then 1
                else 0
            end
        where league_id = v_league_id and team_id = v_home_team_id;

        -- Away Team Update
        update public.league_teams
        set
            played = played + 1,
            goals_for = goals_for + v_away_score,
            goals_against = goals_against + v_home_score,
            goals_difference = goals_difference + (v_away_score - v_home_score),
            won = won + case when v_away_score > v_home_score then 1 else 0 end,
            drawn = drawn + case when v_away_score = v_home_score then 1 else 0 end,
            lost = lost + case when v_away_score < v_home_score then 1 else 0 end,
            points = points + case
                when v_away_score > v_home_score then 3
                when v_away_score = v_home_score then 1
                else 0
            end
        where league_id = v_league_id and team_id = v_away_team_id;
    end if;

    -- 4. Processar cartões e suspensões automáticas
    for v_event in
        select player_id, team_id, event_type
        from public.match_events
        where match_id = p_match_id and event_type in ('yellow_card', 'red_card')
    loop
        if v_event.event_type = 'red_card' then
            -- Achar a próxima partida pendente do time do jogador
            select id into v_next_match_id
            from public.matches
            where season_id = v_season_id
              and (home_team_id = v_event.team_id or away_team_id = v_event.team_id)
              and status = 'pending'
            order by round_number asc, match_date asc
            limit 1;

            if v_next_match_id is not null then
                insert into public.suspensions (player_id, season_id, match_id, reason)
                values (v_event.player_id, v_season_id, v_next_match_id, 'red_card');
            end if;

        elsif v_event.event_type = 'yellow_card' then
            -- Contar cartões amarelos do jogador na temporada atual em jogos confirmados
            select count(*) into v_yellow_count
            from public.match_events me
            join public.matches m on me.match_id = m.id
            where me.player_id = v_event.player_id
              and me.event_type = 'yellow_card'
              and m.season_id = v_season_id
              and m.status = 'confirmed';

            -- A cada 3 cartões amarelos acumulados (3, 6, 9...), aplica suspensão de 1 jogo
            if v_yellow_count > 0 and (v_yellow_count % 3) = 0 then
                -- Achar a próxima partida pendente do time do jogador
                select id into v_next_match_id
                from public.matches
                where season_id = v_season_id
                  and (home_team_id = v_event.team_id or away_team_id = v_event.team_id)
                  and status = 'pending'
                order by round_number asc, match_date asc
                limit 1;

                if v_next_match_id is not null then
                    insert into public.suspensions (player_id, season_id, match_id, reason)
                    values (v_event.player_id, v_season_id, v_next_match_id, '3_yellows');
                end if;
            end if;
        end if;
    end loop;

    return json_build_object('success', true, 'message', 'Partida confirmada e estatísticas atualizadas com sucesso!');
end;
$$ language plpgsql security definer;
