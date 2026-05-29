-- 1. Adicionar colunas necessárias
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS formation text DEFAULT '4-3-3';

-- 2. Tabela de Histórico de Negociações (Transfer History)
CREATE TABLE IF NOT EXISTS public.transfer_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id bigint REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    player_name text NOT NULL,
    player_position text,
    player_rating integer,
    player_face_url text,
    from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    from_team_name text,
    to_team_name text,
    amount numeric(15, 2) NOT NULL,
    transfer_type text NOT NULL CHECK (transfer_type IN ('buyout', 'immediate_buy', 'auction', 'trade', 'loan', 'release')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para transfer_history
ALTER TABLE public.transfer_history ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem e criar novas políticas
DROP POLICY IF EXISTS "Permitir leitura do historico para todos" ON public.transfer_history;
CREATE POLICY "Permitir leitura do historico para todos" ON public.transfer_history 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao pelo sistema/funcoes" ON public.transfer_history;
CREATE POLICY "Permitir insercao pelo sistema/funcoes" ON public.transfer_history 
    FOR INSERT WITH CHECK (true);


-- 3. Atualizar Funções Especiais para Registrar o Histórico Automaticamente

-- A. Comprar Agente Livre (buy_free_agent)
CREATE OR REPLACE FUNCTION public.buy_free_agent(p_player_id bigint, p_team_id uuid)
RETURNS json AS $$
DECLARE
    v_player_wage numeric(12, 2);
    v_player_value numeric(15, 2);
    v_team_budget numeric(15, 2);
    v_team_wages numeric(15, 2);
    v_team_max_wage_cap numeric(15, 2);
    v_market_open boolean;
    v_already_owned boolean;
BEGIN
    -- 1. Verificar se a janela de transferências está aberta (existe temporada active)
    SELECT exists(SELECT 1 FROM public.seasons WHERE status = 'active') INTO v_market_open;
    IF NOT v_market_open THEN
        RETURN json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    END IF;

    -- 2. Verificar se o jogador existe e já está em algum time
    SELECT wage, value, (team_id IS NOT NULL)
    INTO v_player_wage, v_player_value, v_already_owned
    FROM public.players
    WHERE id = p_player_id;

    IF v_player_wage IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Jogador não encontrado!');
    END IF;

    IF v_already_owned THEN
        RETURN json_build_object('success', false, 'message', 'Este jogador já pertence a outro time!');
    END IF;

    -- 3. Obter orçamento e limite de salários do time
    SELECT budget, max_wage_cap
    INTO v_team_budget, v_team_max_wage_cap
    FROM public.teams
    WHERE id = p_team_id;

    IF v_team_budget IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Time não encontrado!');
    END IF;

    -- 4. Calcular folha salarial atual do time
    SELECT coalesce(sum(wage), 0)
    INTO v_team_wages
    FROM public.players
    WHERE team_id = p_team_id;

    -- 5. Validar orçamento
    IF v_team_budget < v_player_value THEN
        RETURN json_build_object('success', false, 'message', 'Orçamento insuficiente! Saldo: R$ ' || to_char(v_team_budget, 'FM999G999G990D00') || ', Preço: R$ ' || to_char(v_player_value, 'FM999G999G990D00'));
    END IF;

    -- 6. Validar teto salarial (wage cap)
    IF (v_team_wages + v_player_wage) > v_team_max_wage_cap THEN
        RETURN json_build_object('success', false, 'message', 'Estouro do Teto Salarial! O salário de R$ ' || v_player_wage || ' fará a folha total (' || (v_team_wages + v_player_wage) || ') passar do teto máximo de R$ ' || v_team_max_wage_cap);
    END IF;

    -- 7. Executar a compra
    -- Deduzir orçamento
    UPDATE public.teams
    SET budget = budget - v_player_value
    WHERE id = p_team_id;

    -- Vincular o jogador ao time
    UPDATE public.players
    SET team_id = p_team_id
    WHERE id = p_player_id;

    -- Registrar no histórico
    INSERT INTO public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        to_team_id, to_team_name, amount, transfer_type
    )
    SELECT 
        p.id, p.name, p.position, p.rating, p.face_url,
        t.id, t.name, v_player_value, 'immediate_buy'
    FROM public.players p, public.teams t
    WHERE p.id = p_player_id AND t.id = p_team_id;

    RETURN json_build_object('success', true, 'message', 'Jogador contratado com sucesso!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Dispensar Jogador (release_player)
CREATE OR REPLACE FUNCTION public.release_player(p_player_id bigint, p_team_id uuid)
RETURNS json AS $$
DECLARE
    v_player_value numeric(15, 2);
    v_player_team uuid;
    v_market_open boolean;
BEGIN
    -- 1. Verificar se a janela de transferências está aberta
    SELECT exists(SELECT 1 FROM public.seasons WHERE status = 'active') INTO v_market_open;
    IF NOT v_market_open THEN
        RETURN json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    END IF;

    -- 2. Verificar se o jogador realmente pertence a esse time
    SELECT value, team_id
    INTO v_player_value, v_player_team
    FROM public.players
    WHERE id = p_player_id;

    IF v_player_team IS NULL OR v_player_team != p_team_id THEN
        RETURN json_build_object('success', false, 'message', 'Este jogador não pertence ao seu time!');
    END IF;

    -- Registrar no histórico antes de remover o time
    INSERT INTO public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, from_team_name, amount, transfer_type
    )
    SELECT 
        p.id, p.name, p.position, p.rating, p.face_url,
        t.id, t.name, v_player_value, 'release'
    FROM public.players p, public.teams t
    WHERE p.id = p_player_id AND t.id = p_team_id;

    -- 3. Executar dispensa
    -- Remover o jogador do time
    UPDATE public.players
    SET team_id = NULL
    WHERE id = p_player_id;

    -- Reembolsar orçamento do time
    UPDATE public.teams
    SET budget = budget + v_player_value
    WHERE id = p_team_id;

    RETURN json_build_object('success', true, 'message', 'Jogador dispensado com sucesso e valor de mercado reembolsado!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Comprar Listagem do Mercado (buy_market_listing)
CREATE OR REPLACE FUNCTION public.buy_market_listing(p_listing_id uuid, p_buyer_team_id uuid)
RETURNS json AS $$
DECLARE
    v_player_id bigint;
    v_player_wage numeric(12, 2);
    v_seller_team_id uuid;
    v_price numeric(15, 2);
    v_buyer_budget numeric(15, 2);
    v_buyer_wages numeric(15, 2);
    v_buyer_max_wage_cap numeric(15, 2);
    v_listing_status text;
    v_market_open boolean;
BEGIN
    -- 1. Verificar se a janela de transferências está aberta
    SELECT exists(SELECT 1 FROM public.seasons WHERE status = 'active') INTO v_market_open;
    IF NOT v_market_open THEN
        RETURN json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    END IF;

    -- 2. Obter dados da listagem e verificar status
    SELECT player_id, seller_team_id, price, status
    INTO v_player_id, v_seller_team_id, v_price, v_listing_status
    FROM public.market_listings
    WHERE id = p_listing_id;

    IF v_listing_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Anúncio não encontrado!');
    END IF;

    IF v_listing_status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Este anúncio não está mais ativo!');
    END IF;

    -- 3. Obter salário do jogador
    SELECT wage INTO v_player_wage
    FROM public.players
    WHERE id = v_player_id;

    -- 4. Obter orçamento e limite de salários do comprador
    SELECT budget, max_wage_cap
    INTO v_buyer_budget, v_buyer_max_wage_cap
    FROM public.teams
    WHERE id = p_buyer_team_id;

    IF v_buyer_budget IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Comprador não encontrado!');
    END IF;

    -- Impedir comprar o próprio jogador
    IF v_seller_team_id = p_buyer_team_id THEN
        RETURN json_build_object('success', false, 'message', 'Você não pode comprar seu próprio jogador!');
    END IF;

    -- 5. Calcular folha salarial atual do comprador
    SELECT coalesce(sum(wage), 0)
    INTO v_buyer_wages
    FROM public.players
    WHERE team_id = p_buyer_team_id;

    -- 6. Validar orçamento do comprador
    IF v_buyer_budget < v_price THEN
        RETURN json_build_object('success', false, 'message', 'Orçamento insuficiente! Saldo: R$ ' || to_char(v_buyer_budget, 'FM999G999G990D00') || ', Preço: R$ ' || to_char(v_price, 'FM999G999G990D00'));
    END IF;

    -- 7. Validar teto salarial do comprador
    IF (v_buyer_wages + v_player_wage) > v_buyer_max_wage_cap THEN
        RETURN json_build_object('success', false, 'message', 'Estouro do Teto Salarial! O salário de R$ ' || v_player_wage || ' fará a folha total (' || (v_buyer_wages + v_player_wage) || ') passar do teto máximo de R$ ' || v_buyer_max_wage_cap);
    END IF;

    -- Registrar no histórico
    INSERT INTO public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, from_team_name, to_team_id, to_team_name, amount, transfer_type
    )
    SELECT 
        p.id, p.name, p.position, p.rating, p.face_url,
        v_seller_team_id, (SELECT name FROM public.teams WHERE id = v_seller_team_id),
        t.id, t.name, v_price, 'immediate_buy'
    FROM public.players p, public.teams t
    WHERE p.id = v_player_id AND t.id = p_buyer_team_id;

    -- 8. Executar transação
    -- Deduzir dinheiro do comprador
    UPDATE public.teams
    SET budget = budget - v_price
    WHERE id = p_buyer_team_id;

    -- Adicionar dinheiro ao vendedor (se houver vendedor)
    IF v_seller_team_id IS NOT NULL THEN
        UPDATE public.teams
        SET budget = budget + v_price
        WHERE id = v_seller_team_id;
    END IF;

    -- Transferir jogador
    UPDATE public.players
    SET team_id = p_buyer_team_id
    WHERE id = v_player_id;

    -- Finalizar anúncio
    UPDATE public.market_listings
    SET status = 'sold'
    WHERE id = p_listing_id;

    RETURN json_build_object('success', true, 'message', 'Jogador adquirido com sucesso!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. Fechar Leilão (close_auction)
CREATE OR REPLACE FUNCTION public.close_auction(p_listing_id uuid)
RETURNS json AS $$
DECLARE
    v_player_id bigint;
    v_player_wage numeric(12, 2);
    v_seller_team_id uuid;
    v_winning_bidder_id uuid;
    v_winning_amount numeric(15, 2);
    v_buyer_wages numeric(15, 2);
    v_buyer_max_wage_cap numeric(15, 2);
    v_listing_status text;
    v_end_date timestamp with time zone;
BEGIN
    -- 1. Obter dados do leilão
    SELECT player_id, seller_team_id, status, end_date
    INTO v_player_id, v_seller_team_id, v_listing_status, v_end_date
    FROM public.market_listings
    WHERE id = p_listing_id AND listing_type = 'auction';

    IF v_listing_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Leilão não encontrado!');
    END IF;

    IF v_listing_status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Este leilão não está mais ativo!');
    END IF;

    -- 2. Encontrar o lance vencedor
    SELECT bidder_team_id, bid_amount
    INTO v_winning_bidder_id, v_winning_amount
    FROM public.market_bids
    WHERE market_listing_id = p_listing_id AND status = 'pending'
    ORDER BY bid_amount DESC
    LIMIT 1;

    -- Se não houver lances
    IF v_winning_bidder_id IS NULL THEN
        UPDATE public.market_listings
        SET status = 'expired'
        WHERE id = p_listing_id;
        RETURN json_build_object('success', true, 'message', 'Leilão encerrado sem lances.');
    END IF;

    -- 3. Obter salário do jogador
    SELECT wage INTO v_player_wage
    FROM public.players
    WHERE id = v_player_id;

    -- 4. Verificar teto salarial do vencedor
    SELECT coalesce(sum(wage), 0)
    INTO v_buyer_wages
    FROM public.players
    WHERE team_id = v_winning_bidder_id;

    SELECT max_wage_cap
    INTO v_buyer_max_wage_cap
    FROM public.teams
    WHERE id = v_winning_bidder_id;

    -- Registrar no histórico
    INSERT INTO public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, from_team_name, to_team_id, to_team_name, amount, transfer_type
    )
    SELECT 
        p.id, p.name, p.position, p.rating, p.face_url,
        v_seller_team_id, (SELECT name FROM public.teams WHERE id = v_seller_team_id),
        t.id, t.name, v_winning_amount, 'auction'
    FROM public.players p, public.teams t
    WHERE p.id = v_player_id AND t.id = v_winning_bidder_id;

    -- 5. Executar a transferência financeira
    -- Deduzir dinheiro do vencedor
    UPDATE public.teams
    SET budget = budget - v_winning_amount
    WHERE id = v_winning_bidder_id;

    -- Pagar o vendedor
    IF v_seller_team_id IS NOT NULL THEN
        UPDATE public.teams
        SET budget = budget + v_winning_amount
        WHERE id = v_seller_team_id;
    END IF;

    -- Transferir jogador
    UPDATE public.players
    SET team_id = v_winning_bidder_id
    WHERE id = v_player_id;

    -- Marcar lance como ganho
    UPDATE public.market_bids
    SET status = 'won'
    WHERE market_listing_id = p_listing_id AND bidder_team_id = v_winning_bidder_id AND status = 'pending';

    -- Fechar anúncio
    UPDATE public.market_listings
    SET status = 'sold'
    WHERE id = p_listing_id;

    RETURN json_build_object('success', true, 'message', 'Leilão encerrado com sucesso!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- E. Aceitar Proposta de Troca (accept_trade_offer)
CREATE OR REPLACE FUNCTION public.accept_trade_offer(p_trade_id uuid)
RETURNS json AS $$
DECLARE
    v_sender_team_id uuid;
    v_receiver_team_id uuid;
    v_offered_money numeric(15, 2);
    v_requested_money numeric(15, 2);
    v_status text;
    v_market_open boolean;
    
    v_sender_budget numeric(15, 2);
    v_receiver_budget numeric(15, 2);
    v_sender_max_wage numeric(15, 2);
    v_receiver_max_wage numeric(15, 2);
    
    v_sender_current_wages numeric(15, 2);
    v_receiver_current_wages numeric(15, 2);
    
    v_wages_sent numeric(15, 2) := 0;
    v_wages_received numeric(15, 2) := 0;
    
    v_player_id bigint;
    v_player_wage numeric(12, 2);
    v_player_owner uuid;
    v_direction text;
BEGIN
    -- 1. Verificar se a janela de transferências está aberta
    SELECT exists(SELECT 1 FROM public.seasons WHERE status = 'active') INTO v_market_open;
    IF NOT v_market_open THEN
        RETURN json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    END IF;

    -- 2. Obter dados da proposta e verificar pendência
    SELECT sender_team_id, receiver_team_id, offered_money, requested_money, status
    INTO v_sender_team_id, v_receiver_team_id, v_offered_money, v_requested_money, v_status
    FROM public.trade_offers
    WHERE id = p_trade_id;

    IF v_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Proposta de troca não encontrada!');
    END IF;

    IF v_status != 'pending' THEN
        RETURN json_build_object('success', false, 'message', 'Esta proposta não está mais pendente!');
    END IF;

    -- 3. Obter dados financeiros dos dois times
    SELECT budget, max_wage_cap INTO v_sender_budget, v_sender_max_wage FROM public.teams WHERE id = v_sender_team_id;
    SELECT budget, max_wage_cap INTO v_receiver_budget, v_receiver_max_wage FROM public.teams WHERE id = v_receiver_team_id;

    -- 4. Validar saldo do Proponente (Sender)
    IF (v_sender_budget - v_offered_money + v_requested_money) < 0 THEN
        RETURN json_build_object('success', false, 'message', 'O proponente não possui saldo suficiente para a troca!');
    END IF;

    -- 5. Validar saldo do Destinatário (Receiver)
    IF (v_receiver_budget + v_offered_money - v_requested_money) < 0 THEN
        RETURN json_build_object('success', false, 'message', 'Você não possui saldo suficiente para aceitar essa troca!');
    END IF;

    -- 6. Validar propriedade dos jogadores e calcular impacto salarial
    FOR v_player_id, v_direction IN 
        SELECT player_id, direction FROM public.trade_players WHERE trade_offer_id = p_trade_id
    LOOP
        SELECT team_id, wage INTO v_player_owner, v_player_wage FROM public.players WHERE id = v_player_id;
        
        IF v_direction = 'send' THEN
            IF v_player_owner IS NULL OR v_player_owner != v_sender_team_id THEN
                RETURN json_build_object('success', false, 'message', 'Erro: Um ou mais jogadores oferecidos não pertencem mais ao proponente.');
            END IF;
            v_wages_sent := v_wages_sent + v_player_wage;
        ELSE
            IF v_player_owner IS NULL OR v_player_owner != v_receiver_team_id THEN
                RETURN json_build_object('success', false, 'message', 'Erro: Um ou mais jogadores solicitados não pertencem mais a você.');
            END IF;
            v_wages_received := v_wages_received + v_player_wage;
        END IF;
    END LOOP;

    -- 7. Calcular folha salarial atual das equipes
    SELECT coalesce(sum(wage), 0) INTO v_sender_current_wages FROM public.players WHERE team_id = v_sender_team_id;
    SELECT coalesce(sum(wage), 0) INTO v_receiver_current_wages FROM public.players WHERE team_id = v_receiver_team_id;

    -- 8. Validar Teto Salarial do Proponente (Sender)
    IF (v_sender_current_wages - v_wages_sent + v_wages_received) > v_sender_max_wage THEN
        RETURN json_build_object('success', false, 'message', 'Erro: O proponente ultrapassará o teto salarial após a troca!');
    END IF;

    -- 9. Validar Teto Salarial do Destinatário (Receiver)
    IF (v_receiver_current_wages - v_wages_received + v_wages_sent) > v_receiver_max_wage THEN
        RETURN json_build_object('success', false, 'message', 'Estouro de Teto Salarial! Aceitar esta troca fará sua folha passar de ' || v_receiver_max_wage);
    END IF;

    -- Registrar cada jogador trocado no histórico antes de alterar seu team_id
    INSERT INTO public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, from_team_name, to_team_id, to_team_name, amount, transfer_type
    )
    SELECT 
        p.id, p.name, p.position, p.rating, p.face_url,
        v_sender_team_id, (SELECT name FROM public.teams WHERE id = v_sender_team_id),
        v_receiver_team_id, (SELECT name FROM public.teams WHERE id = v_receiver_team_id),
        v_offered_money, 'trade'
    FROM public.players p
    JOIN public.trade_players tp ON tp.player_id = p.id
    WHERE tp.trade_offer_id = p_trade_id AND tp.direction = 'send';

    INSERT INTO public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, from_team_name, to_team_id, to_team_name, amount, transfer_type
    )
    SELECT 
        p.id, p.name, p.position, p.rating, p.face_url,
        v_receiver_team_id, (SELECT name FROM public.teams WHERE id = v_receiver_team_id),
        v_sender_team_id, (SELECT name FROM public.teams WHERE id = v_sender_team_id),
        v_requested_money, 'trade'
    FROM public.players p
    JOIN public.trade_players tp ON tp.player_id = p.id
    WHERE tp.trade_offer_id = p_trade_id AND tp.direction = 'receive';

    -- 10. Executar a Troca
    UPDATE public.teams SET budget = budget - v_offered_money + v_requested_money WHERE id = v_sender_team_id;
    UPDATE public.teams SET budget = budget + v_offered_money - v_requested_money WHERE id = v_receiver_team_id;

    UPDATE public.players
    SET team_id = v_receiver_team_id
    WHERE id IN (
        SELECT player_id FROM public.trade_players WHERE trade_offer_id = p_trade_id AND direction = 'send'
    );

    UPDATE public.players
    SET team_id = v_sender_team_id
    WHERE id IN (
        SELECT player_id FROM public.trade_players WHERE trade_offer_id = p_trade_id AND direction = 'receive'
    );

    UPDATE public.trade_offers SET status = 'accepted' WHERE id = p_trade_id;

    -- Auto-cancelar conflitos
    UPDATE public.trade_offers
    SET status = 'cancelled'
    WHERE id IN (
        SELECT DISTINCT t_off.id
        from public.trade_offers t_off
        join public.trade_players t_pl on t_pl.trade_offer_id = t_off.id
        where t_off.status = 'pending'
          and t_pl.player_id in (
              select player_id from public.trade_players where trade_offer_id = p_trade_id
          )
    );

    RETURN json_build_object('success', true, 'message', 'Troca concluída com sucesso!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- F. Resetar Elenco (reset_squad)
CREATE OR REPLACE FUNCTION public.reset_squad(p_team_id uuid)
RETURNS json AS $$
DECLARE
    v_player record;
BEGIN
    -- Verificar se o time existe
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id) THEN
        RETURN json_build_object('success', false, 'message', 'Time não encontrado!');
    END IF;

    -- Registrar as dispensas no histórico antes de remover os times
    FOR v_player IN 
        SELECT id, name, position, rating, face_url FROM public.players WHERE team_id = p_team_id
    LOOP
        INSERT INTO public.transfer_history (
            player_id, player_name, player_position, player_rating, player_face_url,
            from_team_id, from_team_name, amount, transfer_type
        )
        SELECT 
            v_player.id, v_player.name, v_player.position, v_player.rating, v_player.face_url,
            t.id, t.name, 0.00, 'release'
        FROM public.teams t
        WHERE t.id = p_team_id;
    END LOOP;

    -- Remover todos os jogadores do time
    UPDATE public.players
    SET team_id = NULL
    WHERE team_id = p_team_id;

    RETURN json_build_object('success', true, 'message', 'Elenco liberado com sucesso e histórico registrado!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Tabela de Configurações Globais (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir leitura de settings para todos" ON public.settings;
CREATE POLICY "Permitir leitura de settings para todos" ON public.settings 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir tudo para admin no settings" ON public.settings;
CREATE POLICY "Permitir tudo para admin no settings" ON public.settings 
    FOR ALL USING (public.is_admin());

-- Valores Padrão Iniciais
INSERT INTO public.settings (key, value) VALUES
    ('league_name', 'Liga Master EA FC'),
    ('default_budget', '50000000.00'),
    ('default_wage_cap', '15000.00'),
    ('buyout_multiplier', '1.50')
ON CONFLICT (key) DO NOTHING;


-- G. Purgar Jogadores Livres (purge_free_agents)
CREATE OR REPLACE FUNCTION public.purge_free_agents()
RETURNS json AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    -- Excluir da listagem do mercado ativa para evitar erros de FK
    DELETE FROM public.market_listings
    WHERE player_id IN (SELECT id FROM public.players WHERE team_id IS NULL);

    DELETE FROM public.players
    WHERE team_id IS NULL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN json_build_object('success', true, 'message', 'Purgados ' || v_deleted_count || ' jogadores livres com sucesso!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
