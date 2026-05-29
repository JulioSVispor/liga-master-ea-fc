-- ========================================================
-- FASE 1: SEGURANÇA & BLINDAGEM RLS (SUPABASE)
-- ========================================================

-- 1. Blindagem de RLS na tabela `players`
-- Remover políticas anteriores que permitiam tudo a todos
drop policy if exists "Permitir tudo para todos no players" on public.players;
drop policy if exists "Permitir tudo todos no players" on public.players;
drop policy if exists "Permitir tudo para admin no players" on public.players;
drop policy if exists "Permitir leitura para todos" on public.players;

-- Criar novas políticas de acesso seguro
create policy "Permitir leitura para todos no players"
    on public.players for select
    using (true);

create policy "Permitir tudo para admin no players"
    on public.players for all
    using (public.is_admin());


-- 2. Restrição de RLS em `matches` por Time envolvido
drop policy if exists "Permitir atualização de partidas" on public.matches;
drop policy if exists "Permitir tudo para admin no matches" on public.matches;

create policy "Permitir atualização de partidas por times envolvidos"
    on public.matches for update
    using (
        exists (
            select 1 from public.teams t
            where t.user_id = auth.uid()
            and (t.id = home_team_id or t.id = away_team_id)
        )
    );

create policy "Permitir tudo para admin no matches"
    on public.matches for all
    using (public.is_admin());


-- 3. Restrição de RLS na inserção e exclusão de `match_events` por time envolvido
drop policy if exists "Permitir inserção de eventos de partidas" on public.match_events;
drop policy if exists "Permitir exclusão de eventos de partidas" on public.match_events;
drop policy if exists "Permitir tudo para admin no match_events" on public.match_events;

create policy "Permitir inserção de eventos por times envolvidos"
    on public.match_events for insert
    with check (
        exists (
            select 1 from public.matches m
            join public.teams t on (t.id = m.home_team_id or t.id = m.away_team_id)
            where m.id = match_id and t.user_id = auth.uid()
        )
    );

create policy "Permitir exclusão de eventos por times envolvidos"
    on public.match_events for delete
    using (
        exists (
            select 1 from public.matches m
            join public.teams t on (t.id = m.home_team_id or t.id = m.away_team_id)
            where m.id = match_id and t.user_id = auth.uid()
        )
    );

create policy "Permitir tudo para admin no match_events"
    on public.match_events for all
    using (public.is_admin());


-- 4. Atualizar o RPC `place_auction_bid` para validar teto salarial antes de aceitar lances
create or replace function public.place_auction_bid(p_listing_id uuid, p_bidder_team_id uuid, p_amount numeric)
returns json as $$
declare
    v_highest_bid numeric(15, 2);
    v_min_price numeric(15, 2);
    v_listing_status text;
    v_end_date timestamp with time zone;
    v_bidder_budget numeric(15, 2);
    v_bidder_wages numeric(15, 2);
    v_bidder_max_wage_cap numeric(15, 2);
    v_player_wage numeric(12, 2);
    v_market_open boolean;
    v_seller_team_id uuid;
begin
    -- 1. Verificar se a janela de transferências está aberta
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Verificar listagem
    select price, status, end_date, seller_team_id
    into v_min_price, v_listing_status, v_end_date, v_seller_team_id
    from public.market_listings
    where id = p_listing_id and listing_type = 'auction';

    if v_listing_status is null then
        return json_build_object('success', false, 'message', 'Leilão não encontrado!');
    end if;

    if v_listing_status != 'active' or v_end_date < now() then
        return json_build_object('success', false, 'message', 'Este leilão já expirou ou está inativo!');
    end if;

    -- Impedir dar lance no próprio jogador
    if v_seller_team_id = p_bidder_team_id then
        return json_build_object('success', false, 'message', 'Você não pode dar lances no seu próprio jogador!');
    end if;

    -- 3. Obter maior lance atual
    select coalesce(max(bid_amount), 0)
    into v_highest_bid
    from public.market_bids
    where market_listing_id = p_listing_id;

    -- Se não houver lances, o lance mínimo é o preço inicial do leilão
    if v_highest_bid = 0 then
        v_highest_bid := v_min_price;
    end if;

    -- 4. Validar valor do lance
    if p_amount <= v_highest_bid then
        return json_build_object('success', false, 'message', 'O seu lance de R$ ' || to_char(p_amount, 'FM999G999G990D00') || ' deve ser maior que o maior lance atual de R$ ' || to_char(v_highest_bid, 'FM999G999G990D00'));
    end if;

    -- 5. Validar orçamento do licitante
    select budget, max_wage_cap
    into v_bidder_budget, v_bidder_max_wage_cap
    from public.teams
    where id = p_bidder_team_id;

    if v_bidder_budget is null then
        return json_build_object('success', false, 'message', 'Time licitante não encontrado!');
    end if;

    if v_bidder_budget < p_amount then
        return json_build_object('success', false, 'message', 'Orçamento insuficiente! Saldo atual: R$ ' || to_char(v_bidder_budget, 'FM999G999G990D00'));
    end if;

    -- 5.1 Validar teto salarial (Checar se o salário semanal do jogador somado à folha estoura o teto)
    select p.wage into v_player_wage
    from public.players p
    join public.market_listings m on m.player_id = p.id
    where m.id = p_listing_id;

    select coalesce(sum(wage), 0) into v_bidder_wages
    from public.players
    where team_id = p_bidder_team_id;

    if (v_bidder_wages + v_player_wage) > v_bidder_max_wage_cap then
        return json_build_object('success', false, 'message', 'Estouro do Teto Salarial! O salário de R$ ' || v_player_wage || ' fará a folha total (' || (v_bidder_wages + v_player_wage) || ') passar do teto de R$ ' || v_bidder_max_wage_cap);
    end if;

    -- 6. Atualizar lances anteriores do mesmo leilão para 'outbid'
    update public.market_bids
    set status = 'outbid'
    where market_listing_id = p_listing_id and status = 'pending';

    -- 7. Inserir o novo lance como 'pending' (aguardando encerramento do leilão)
    insert into public.market_bids (market_listing_id, bidder_team_id, bid_amount, status)
    values (p_listing_id, p_bidder_team_id, p_amount, 'pending');

    return json_build_object('success', true, 'message', 'Lance registrado com sucesso!');
end;
$$ language plpgsql security definer;
