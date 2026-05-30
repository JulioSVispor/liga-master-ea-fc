-- ========================================================
-- JANELA DE MERCADO INDEPENDENTE DA TEMPORADA
-- ========================================================

-- Adiciona campo de controle independente da janela de transferências
alter table public.seasons
    add column if not exists market_open boolean default false;

-- Comentário: antes, o mercado abria/fechava junto com seasons.status = 'active'
-- Agora, use market_open = true/false para controle independente
-- Atualizar as funções RPC existentes para checar market_open ao invés de status

-- Atualizar buy_free_agent para usar market_open
create or replace function public.buy_free_agent(p_player_id bigint, p_team_id uuid)
returns json as $$
declare
    v_player_wage numeric(12, 2);
    v_player_value numeric(15, 2);
    v_team_budget numeric(15, 2);
    v_team_wages numeric(15, 2);
    v_team_max_wage_cap numeric(15, 2);
    v_market_open boolean;
    v_already_owned boolean;
begin
    -- 1. Verificar se a janela de transferências está aberta (campo market_open)
    select exists(
        select 1 from public.seasons 
        where status = 'active' and market_open = true
    ) into v_market_open;
    
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Verificar se o jogador existe e já está em algum time
    select wage, value, (team_id is not null)
    into v_player_wage, v_player_value, v_already_owned
    from public.players
    where id = p_player_id;

    if v_player_wage is null then
        return json_build_object('success', false, 'message', 'Jogador não encontrado!');
    end if;

    if v_already_owned then
        return json_build_object('success', false, 'message', 'Este jogador já pertence a um time!');
    end if;

    -- 3. Verificar orçamento e teto salarial do time comprador
    select budget, max_wage_cap,
           (select coalesce(sum(wage), 0) from public.players where team_id = p_team_id)
    into v_team_budget, v_team_max_wage_cap, v_team_wages
    from public.teams
    where id = p_team_id;

    if v_team_budget is null then
        return json_build_object('success', false, 'message', 'Time não encontrado!');
    end if;

    if v_team_budget < v_player_value then
        return json_build_object('success', false, 'message', 'Orçamento insuficiente para contratar este jogador!');
    end if;

    if (v_team_wages + v_player_wage) > v_team_max_wage_cap then
        return json_build_object('success', false, 'message', 'Teto salarial seria excedido com esta contratação!');
    end if;

    -- 4. Realizar a transferência: atribuir jogador ao time e debitar orçamento
    update public.players set team_id = p_team_id where id = p_player_id;
    update public.teams set budget = budget - v_player_value where id = p_team_id;

    -- 5. Registrar no histórico financeiro
    insert into public.transfer_history (player_id, from_team_id, to_team_id, amount, transfer_type)
    values (p_player_id, null, p_team_id, v_player_value, 'immediate_buy');

    -- 6. Criar notícia de mercado
    insert into public.market_news (title, content, category, player_face_url)
    select 
        'Novo Reforço: ' || p.name,
        t.name || ' contratou ' || p.name || ' (Rating ' || p.rating || ') como Agente Livre.',
        'transfer',
        p.face_url
    from public.players p, public.teams t
    where p.id = p_player_id and t.id = p_team_id;

    return json_build_object('success', true, 'message', 'Jogador contratado com sucesso!');
end;
$$ language plpgsql security definer;
