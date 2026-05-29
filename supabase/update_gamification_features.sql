-- ========================================================
-- FASE 4: GAMIFICAÇÃO, NOTIFICAÇÕES E SEPARAÇÃO DE SUSPENSÕES
-- ========================================================

-- 1. Adicionar coluna MOTM (Melhor da Partida) na tabela `matches`
alter table public.matches add column if not exists motm_player_id bigint references public.players(id) on delete set null;

-- 2. Adicionar campos de Uniforme na tabela `teams`
alter table public.teams add column if not exists uniform_url text;

-- 3. Criar Tabela de Conquistas (Achievements/Troféus)
create table if not exists public.achievements (
    id uuid default gen_random_uuid() primary key,
    team_id uuid references public.teams(id) on delete cascade not null,
    title text not null, -- Ex: "Campeão da Série A", "Vice-Campeão da Copa"
    season_name text not null, -- Ex: "Temporada 1"
    icon text default '🏆', -- Emojis de troféu
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para achievements
alter table public.achievements enable row level security;

create policy "Permitir leitura de conquistas para todos"
    on public.achievements for select using (true);

create policy "Permitir tudo para admin no achievements"
    on public.achievements for all using (public.is_admin());


-- 4. Criar Tabela de Notificações
create table if not exists public.notifications (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null, -- Usuário destinatário
    title text not null,
    content text not null,
    read boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para notifications
alter table public.notifications enable row level security;

create policy "Permitir leitura das proprias notificacoes"
    on public.notifications for select using (auth.uid() = user_id);

create policy "Permitir atualizacao das proprias notificacoes"
    on public.notifications for update using (auth.uid() = user_id);

create policy "Permitir insercao de notificacoes"
    on public.notifications for insert with check (auth.uid() is not null);


-- 5. Atualizar a função confirm_match para separar o acúmulo de cartões e suspensões por competição
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

    -- 4. Processar cartões e suspensões automáticas separadas por competição
    for v_event in
        select player_id, team_id, event_type
        from public.match_events
        where match_id = p_match_id and event_type in ('yellow_card', 'red_card')
    loop
        v_next_match_id := null;
        v_yellow_count := 0;

        if v_event.event_type = 'red_card' then
            -- Se vermelho for em jogo de liga, cumpre suspensão na próxima partida pendente de liga
            if v_competition_type = 'league' then
                select id into v_next_match_id
                from public.matches
                where season_id = v_season_id
                  and competition_type = 'league'
                  and (home_team_id = v_event.team_id or away_team_id = v_event.team_id)
                  and status = 'pending'
                order by round_number asc, match_date asc
                limit 1;
            -- Se vermelho for em jogos de copa, cumpre suspensão na próxima partida pendente de copa
            elsif v_competition_type in ('cup_group', 'cup_playoff') then
                select id into v_next_match_id
                from public.matches
                where season_id = v_season_id
                  and competition_type in ('cup_group', 'cup_playoff')
                  and (home_team_id = v_event.team_id or away_team_id = v_event.team_id)
                  and status = 'pending'
                order by round_number asc, match_date asc
                limit 1;
            end if;

            if v_next_match_id is not null then
                insert into public.suspensions (player_id, season_id, match_id, reason)
                values (v_event.player_id, v_season_id, v_next_match_id, 'red_card');
            end if;

        elsif v_event.event_type = 'yellow_card' then
            -- Acúmulo de amarelos na liga
            if v_competition_type = 'league' then
                select count(*) into v_yellow_count
                from public.match_events me
                join public.matches m on me.match_id = m.id
                where me.player_id = v_event.player_id
                  and me.event_type = 'yellow_card'
                  and m.season_id = v_season_id
                  and m.competition_type = 'league'
                  and m.status = 'confirmed';

                if v_yellow_count > 0 and (v_yellow_count % 3) = 0 then
                    select id into v_next_match_id
                    from public.matches
                    where season_id = v_season_id
                      and competition_type = 'league'
                      and (home_team_id = v_event.team_id or away_team_id = v_event.team_id)
                      and status = 'pending'
                    order by round_number asc, match_date asc
                    limit 1;
                end if;

            -- Acúmulo de amarelos nas copas
            elsif v_competition_type in ('cup_group', 'cup_playoff') then
                select count(*) into v_yellow_count
                from public.match_events me
                join public.matches m on me.match_id = m.id
                where me.player_id = v_event.player_id
                  and me.event_type = 'yellow_card'
                  and m.season_id = v_season_id
                  and m.competition_type in ('cup_group', 'cup_playoff')
                  and m.status = 'confirmed';

                if v_yellow_count > 0 and (v_yellow_count % 3) = 0 then
                    select id into v_next_match_id
                    from public.matches
                    where season_id = v_season_id
                      and competition_type in ('cup_group', 'cup_playoff')
                      and (home_team_id = v_event.team_id or away_team_id = v_event.team_id)
                      and status = 'pending'
                    order by round_number asc, match_date asc
                    limit 1;
                end if;
            end if;

            if v_next_match_id is not null then
                insert into public.suspensions (player_id, season_id, match_id, reason)
                values (v_event.player_id, v_season_id, v_next_match_id, '3_yellows');
            end if;
        end if;
    end loop;

    return json_build_object('success', true, 'message', 'Partida confirmada e estatísticas atualizadas com sucesso!');
end;
$$ language plpgsql security definer;
