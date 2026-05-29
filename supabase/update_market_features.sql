-- ========================================================
-- FASE 2: MERCADO PREMIUM (NEGOCIAÇÕES & FINANÇAS)
-- ========================================================

-- 1. Adicionar colunas necessárias na tabela `players`
alter table public.players add column if not exists buyout_clause numeric(15, 2);
alter table public.players add column if not exists original_team_id uuid references public.teams(id) on delete set null;
alter table public.players add column if not exists loan_salary_pct_dest integer check (loan_salary_pct_dest >= 0 and loan_salary_pct_dest <= 100);
alter table public.players add column if not exists loan_expires_at timestamp with time zone;

-- Criar índices para otimização
create index if not exists idx_players_original_team_id on public.players(original_team_id);
create index if not exists idx_players_loan_expires_at on public.players(loan_expires_at);


-- 2. Tabela de Propostas de Empréstimos (Loan Offers)
create table if not exists public.loan_offers (
    id uuid default gen_random_uuid() primary key,
    sender_team_id uuid references public.teams(id) on delete cascade not null, -- Time que propõe o empréstimo (destino)
    receiver_team_id uuid references public.teams(id) on delete cascade not null, -- Time dono do jogador (origem)
    player_id bigint references public.players(id) on delete cascade not null,
    salary_share_pct integer not null default 50 check (salary_share_pct >= 0 and salary_share_pct <= 100), -- % do salário pago pelo destino
    duration_weeks integer not null default 4, -- Duração em semanas/rodadas
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone not null
);

-- Habilitar RLS para loan_offers
alter table public.loan_offers enable row level security;

create policy "Permitir leitura de propostas de emprestimo para todos"
    on public.loan_offers for select using (true);

create policy "Permitir insercao de propostas de emprestimo"
    on public.loan_offers for insert with check (
        exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = sender_team_id)
    );

create policy "Permitir atualizacao de propostas de emprestimo"
    on public.loan_offers for update using (
        exists (select 1 from public.teams t where t.user_id = auth.uid() and (t.id = sender_team_id or t.id = receiver_team_id))
    );


-- 3. Tabela de Mensagens do Chat de Negociação (Negotiation Messages)
create table if not exists public.negotiation_messages (
    id uuid default gen_random_uuid() primary key,
    trade_offer_id uuid references public.trade_offers(id) on delete cascade,
    loan_offer_id uuid references public.loan_offers(id) on delete cascade,
    sender_id uuid references public.profiles(id) on delete cascade not null,
    message text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint at_least_one_parent check (trade_offer_id is not null or loan_offer_id is not null)
);

-- Habilitar RLS para negotiation_messages
alter table public.negotiation_messages enable row level security;

create policy "Permitir leitura de mensagens para os envolvidos"
    on public.negotiation_messages for select using (
        exists (
            select 1 from public.trade_offers t
            join public.teams s on s.id = t.sender_team_id
            join public.teams r on r.id = t.receiver_team_id
            where t.id = trade_offer_id and (s.user_id = auth.uid() or r.user_id = auth.uid())
        ) or exists (
            select 1 from public.loan_offers l
            join public.teams s on s.id = l.sender_team_id
            join public.teams r on r.id = l.receiver_team_id
            where l.id = loan_offer_id and (s.user_id = auth.uid() or r.user_id = auth.uid())
        )
    );

create policy "Permitir insercao de mensagens para os envolvidos"
    on public.negotiation_messages for insert with check (
        auth.uid() = sender_id and (
            exists (
                select 1 from public.trade_offers t
                join public.teams s on s.id = t.sender_team_id
                join public.teams r on r.id = t.receiver_team_id
                where t.id = trade_offer_id and (s.user_id = auth.uid() or r.user_id = auth.uid())
            ) or exists (
                select 1 from public.loan_offers l
                join public.teams s on s.id = l.sender_team_id
                join public.teams r on r.id = l.receiver_team_id
                where l.id = loan_offer_id and (s.user_id = auth.uid() or r.user_id = auth.uid())
            )
        )
    );


-- 4. Função Auxiliar: Obter folha salarial real do time considerando os empréstimos ativos
create or replace function public.get_team_wages(p_team_id uuid)
returns numeric as $$
declare
    v_wages numeric(15, 2);
begin
    -- 1. Soma dos salários de jogadores definitivos do time (que não estão emprestados para fora)
    -- 2. Mais a parte do salário dos jogadores emprestados PARA este time
    -- 3. Mais a parte do salário dos jogadores deste time emprestados PARA OUTROS times
    select coalesce(
        (select sum(wage) from public.players where team_id = p_team_id and original_team_id is null), 0
    ) + coalesce(
        (select sum(wage * (loan_salary_pct_dest / 100.0)) from public.players where team_id = p_team_id and original_team_id is not null), 0
    ) + coalesce(
        (select sum(wage * ((100 - loan_salary_pct_dest) / 100.0)) from public.players where original_team_id = p_team_id), 0
    ) into v_wages;
    
    return v_wages;
end;
$$ language plpgsql;


-- 5. Transação RPC: Pagar Multa Rescisória (Contratação Imediata)
create or replace function public.buy_player_via_buyout(p_player_id bigint, p_buyer_team_id uuid)
returns json as $$
declare
    v_player_name text;
    v_player_pos text;
    v_player_rating integer;
    v_player_face text;
    v_player_wage numeric(12, 2);
    v_player_value numeric(15, 2);
    v_buyout_clause numeric(15, 2);
    v_seller_team_id uuid;
    v_seller_team_name text;
    v_buyer_team_name text;
    v_buyer_budget numeric(15, 2);
    v_buyer_wages numeric(15, 2);
    v_buyer_max_wage_cap numeric(15, 2);
    v_market_open boolean;
begin
    -- 1. Verificar se a janela de transferências está aberta
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Obter informações do jogador (Se estiver emprestado, o dono é original_team_id)
    select name, position, rating, face_url, wage, value, buyout_clause, coalesce(original_team_id, team_id)
    into v_player_name, v_player_pos, v_player_rating, v_player_face, v_player_wage, v_player_value, v_buyout_clause, v_seller_team_id
    from public.players
    where id = p_player_id;

    if v_player_name is null then
        return json_build_object('success', false, 'message', 'Jogador não encontrado!');
    end if;

    if v_seller_team_id is null then
        return json_build_object('success', false, 'message', 'Este jogador é um Agente Livre! Contrate-o pelo mercado normal.');
    end if;

    if v_seller_team_id = p_buyer_team_id then
        return json_build_object('success', false, 'message', 'Este jogador já pertence ao seu clube!');
    end if;

    -- Se a multa rescisória não estiver cadastrada, calculamos dinamicamente (150% do valor de mercado)
    if v_buyout_clause is null or v_buyout_clause <= 0 then
        v_buyout_clause := v_player_value * 1.5;
    end if;

    -- 3. Obter orçamento e limite de salários do comprador e dados do vendedor
    select budget, max_wage_cap, name
    into v_buyer_budget, v_buyer_max_wage_cap, v_buyer_team_name
    from public.teams
    where id = p_buyer_team_id;

    select name into v_seller_team_name
    from public.teams
    where id = v_seller_team_id;

    -- 4. Validar orçamento do comprador
    if v_buyer_budget < v_buyout_clause then
        return json_build_object('success', false, 'message', 'Orçamento insuficiente para pagar a multa de R$ ' || to_char(v_buyout_clause, 'FM999G999G990D00') || '! Seu saldo: R$ ' || to_char(v_buyer_budget, 'FM999G999G990D00'));
    end if;

    -- 5. Validar teto salarial do comprador
    v_buyer_wages := public.get_team_wages(p_buyer_team_id);
    if (v_buyer_wages + v_player_wage) > v_buyer_max_wage_cap then
        return json_build_object('success', false, 'message', 'Estouro do Teto Salarial! O salário de R$ ' || v_player_wage || ' fará a folha total (' || (v_buyer_wages + v_player_wage) || ') passar do teto de R$ ' || v_buyer_max_wage_cap);
    end if;

    -- 6. Executar transação financeira
    -- Comprador paga a multa
    update public.teams
    set budget = budget - v_buyout_clause
    where id = p_buyer_team_id;

    -- Vendedor recebe a multa
    update public.teams
    set budget = budget + v_buyout_clause
    where id = v_seller_team_id;

    -- Cancelar qualquer listagem ativa no mercado desse jogador
    update public.market_listings
    set status = 'cancelled'
    where player_id = p_player_id and status = 'active';

    -- Atualizar o jogador (removemos empréstimo anterior, se houver, e associamos ao comprador definitivamente)
    update public.players
    set team_id = p_buyer_team_id,
        original_team_id = null,
        loan_salary_pct_dest = null,
        loan_expires_at = null
    where id = p_player_id;

    -- Registrar no histórico de transferências
    insert into public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, to_team_id, from_team_name, to_team_name, amount, transfer_type
    ) values (
        p_player_id, v_player_name, v_player_pos, v_player_rating, v_player_face,
        v_seller_team_id, p_buyer_team_id, v_seller_team_name, v_buyer_team_name,
        v_buyout_clause, 'buyout'
    );

    return json_build_object('success', true, 'message', 'Multa rescisória de R$ ' || to_char(v_buyout_clause, 'FM999G999G990D00') || ' paga com sucesso! O jogador agora pertence ao seu clube.');
end;
$$ language plpgsql security definer;


-- 6. Transação RPC: Aceitar Proposta de Empréstimo
create or replace function public.accept_loan_offer(p_offer_id uuid)
returns json as $$
declare
    v_player_id bigint;
    v_player_name text;
    v_player_pos text;
    v_player_rating integer;
    v_player_face text;
    v_player_wage numeric(12, 2);
    v_sender_team_id uuid; -- time de destino (comprador temporario)
    v_receiver_team_id uuid; -- time proprietário original (vendedor temporario)
    v_salary_share_pct integer;
    v_duration_weeks integer;
    v_status text;
    v_market_open boolean;
    v_dest_wages numeric(15, 2);
    v_dest_max_wage_cap numeric(15, 2);
    v_sender_name text;
    v_receiver_name text;
    v_expires_at timestamp with time zone;
    v_wage_part numeric(12, 2);
begin
    -- 1. Janela de transferências aberta
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Obter dados da proposta
    select player_id, sender_team_id, receiver_team_id, salary_share_pct, duration_weeks, status
    into v_player_id, v_sender_team_id, v_receiver_team_id, v_salary_share_pct, v_duration_weeks, v_status
    from public.loan_offers
    where id = p_offer_id;

    if v_status is null then
        return json_build_object('success', false, 'message', 'Proposta de empréstimo não encontrada!');
    end if;

    if v_status != 'pending' then
        return json_build_object('success', false, 'message', 'Esta proposta não está mais pendente!');
    end if;

    -- 3. Obter dados do jogador
    select name, position, rating, face_url, wage
    into v_player_name, v_player_pos, v_player_rating, v_player_face, v_player_wage
    from public.players
    where id = v_player_id;

    -- Verificar se o jogador já está emprestado
    if (select original_team_id from public.players where id = v_player_id) is not null then
        return json_build_object('success', false, 'message', 'Este jogador já está emprestado no momento!');
    end if;

    -- 4. Validar teto salarial do time de destino (sender_team_id da oferta)
    select max_wage_cap, name into v_dest_max_wage_cap, v_sender_name
    from public.teams
    where id = v_sender_team_id;

    select name into v_receiver_name
    from public.teams
    where id = v_receiver_team_id;

    -- Folha atual do time de destino
    v_dest_wages := public.get_team_wages(v_sender_team_id);
    
    -- Parte do salário do jogador que o destino vai pagar
    v_wage_part := v_player_wage * (v_salary_share_pct / 100.0);
    if (v_dest_wages + v_wage_part) > v_dest_max_wage_cap then
        return json_build_object('success', false, 'message', 'Estouro do Teto Salarial no clube de destino! A folha total dele passará do limite de R$ ' || to_char(v_dest_max_wage_cap, 'FM999G999G990D00'));
    end if;

    -- 5. Atualizar jogador para status de emprestado
    v_expires_at := now() + (v_duration_weeks * interval '1 week');
    
    -- Cancelar qualquer listagem ativa no mercado desse jogador
    update public.market_listings
    set status = 'cancelled'
    where player_id = v_player_id and status = 'active';

    update public.players
    set team_id = v_sender_team_id,
        original_team_id = v_receiver_team_id,
        loan_salary_pct_dest = v_salary_share_pct,
        loan_expires_at = v_expires_at
    where id = v_player_id;

    -- 6. Atualizar status da oferta e rejeitar outras ofertas pendentes do mesmo jogador
    update public.loan_offers
    set status = 'accepted'
    where id = p_offer_id;

    update public.loan_offers
    set status = 'rejected'
    where player_id = v_player_id and status = 'pending' and id != p_offer_id;

    -- Registrar no histórico
    insert into public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, to_team_id, from_team_name, to_team_name, amount, transfer_type
    ) values (
        v_player_id, v_player_name, v_player_pos, v_player_rating, v_player_face,
        v_receiver_team_id, v_sender_team_id, v_receiver_name, v_sender_name,
        0, 'loan'
    );

    return json_build_object('success', true, 'message', 'Empréstimo aceito com sucesso! O jogador agora faz parte do clube de destino.');
end;
$$ language plpgsql security definer;


-- 7. Transação RPC: Devolver Jogador de Empréstimo
create or replace function public.return_loan_player(p_player_id bigint)
returns json as $$
declare
    v_player_name text;
    v_player_pos text;
    v_player_rating integer;
    v_player_face text;
    v_original_team_id uuid;
    v_dest_team_id uuid;
    v_original_name text;
    v_dest_name text;
begin
    select name, position, rating, face_url, original_team_id, team_id
    into v_player_name, v_player_pos, v_player_rating, v_player_face, v_original_team_id, v_dest_team_id
    from public.players
    where id = p_player_id;

    if v_original_team_id is null then
        return json_build_object('success', false, 'message', 'Este jogador não está emprestado.');
    end if;

    select name into v_original_name from public.teams where id = v_original_team_id;
    select name into v_dest_name from public.teams where id = v_dest_team_id;

    -- Retorna o jogador ao dono original
    update public.players
    set team_id = v_original_team_id,
        original_team_id = null,
        loan_salary_pct_dest = null,
        loan_expires_at = null
    where id = p_player_id;

    -- Registrar no histórico
    insert into public.transfer_history (
        player_id, player_name, player_position, player_rating, player_face_url,
        from_team_id, to_team_id, from_team_name, to_team_name, amount, transfer_type
    ) values (
        p_player_id, v_player_name, v_player_pos, v_player_rating, v_player_face,
        v_dest_team_id, v_original_team_id, v_dest_name, v_original_name,
        0, 'release'
    );

    return json_build_object('success', true, 'message', 'Jogador devolvido com sucesso ao time de origem.');
end;
$$ language plpgsql security definer;


-- 8. Transação RPC: Checar e retornar todos os empréstimos expirados
create or replace function public.check_and_return_loans()
returns json as $$
declare
    v_returned_count integer := 0;
    r record;
begin
    for r in 
        select id from public.players
        where original_team_id is not null and loan_expires_at < now()
    loop
        perform public.return_loan_player(r.id);
        v_returned_count := v_returned_count + 1;
    end loop;

    return json_build_object('success', true, 'returned_count', v_returned_count);
end;
$$ language plpgsql security definer;
