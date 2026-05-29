-- ==========================================
-- SCHEMA DO BANCO DE DADOS: LIGA MASTER EA FC 26
-- ==========================================

-- Limpar tabelas existentes para recriação limpa
drop table if exists public.suspensions cascade;
drop table if exists public.market_bids cascade;
drop table if exists public.market_listings cascade;
drop table if exists public.trade_players cascade;
drop table if exists public.trade_offers cascade;
drop table if exists public.match_events cascade;
drop table if exists public.matches cascade;
drop table if exists public.league_teams cascade;
drop table if exists public.leagues cascade;
drop table if exists public.seasons cascade;
drop table if exists public.players cascade;
drop table if exists public.teams cascade;
drop table if exists public.profiles cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Habilitar extensões necessárias (se houver)
create extension if not exists "uuid-ossp";

-- 1. Perfis de Usuários (Sincronizado com auth.users do Supabase)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    display_name text,
    avatar_url text,
    role text not null default 'user' check (role in ('admin', 'user')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) para perfis
alter table public.profiles enable row level security;

-- Criar trigger para criar perfil automaticamente ao cadastrar na Auth do Supabase
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, display_name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'user');
    return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- 2. Times (Clubes dos Participantes)
create table public.teams (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null unique, -- Um usuário gerencia apenas um time
    name text not null unique, -- Nome personalizado do time na liga
    real_club_name text not null, -- Nome do time correspondente no EA FC 26
    badge_url text, -- Escudo do time
    budget numeric(15, 2) not null default 50000000.00, -- Orçamento de transferências (ex: R$ 50M)
    max_wage_cap numeric(15, 2) not null default 15000.00, -- Teto salarial do elenco (padrão R$ 15.000)
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.teams enable row level security;


-- 3. Jogadores (Base de Dados Global vinda do EA FC 26 / SoFIFA)
create table public.players (
    id bigint primary key, -- ID oficial do jogador do EA FC / SoFIFA
    name text not null,
    common_name text,
    rating integer not null check (rating >= 0 and rating <= 99),
    potential integer not null check (potential >= 0 and potential <= 99),
    position text not null, -- Posição principal (ex: ST, LW, CB)
    face_url text,
    wage numeric(12, 2) not null default 0.00, -- Salário semanal oficial
    value numeric(15, 2) not null default 0.00, -- Valor de mercado calculado (10 * salário)
    team_id uuid references public.teams(id) on delete set null, -- NULL se for jogador livre (Free Agent)
    nation text,
    age integer,
    playstyles text[], -- Lista de estilos de jogo (ex: ['Finesse Shot', 'Technical'])
    playstyles_plus text[], -- Lista de PlayStyles+
    player_role jsonb, -- Funções/Focuses do jogador no EA FC 26
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_players_team_id on public.players(team_id);
create index idx_players_rating on public.players(rating);
alter table public.players enable row level security;


-- 4. Temporadas
create table public.seasons (
    id uuid default gen_random_uuid() primary key,
    name text not null, -- Ex: "Temporada 1", "Temporada 2"
    status text not null default 'active' check (status in ('active', 'completed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.seasons enable row level security;


-- 5. Ligas (Divisões em uma determinada temporada)
create table public.leagues (
    id uuid default gen_random_uuid() primary key,
    season_id uuid references public.seasons(id) on delete cascade not null,
    name text not null, -- Ex: "Série A", "Série B"
    division integer not null default 1, -- 1 para Série A, 2 para Série B, etc.
    status text not null default 'active' check (status in ('active', 'completed')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.leagues enable row level security;


-- 6. Associação de Times às Ligas por Temporada (Tabela de Cruzamento)
create table public.league_teams (
    id uuid default gen_random_uuid() primary key,
    league_id uuid references public.leagues(id) on delete cascade not null,
    team_id uuid references public.teams(id) on delete cascade not null,
    points integer not null default 0,
    played integer not null default 0,
    won integer not null default 0,
    drawn integer not null default 0,
    lost integer not null default 0,
    goals_for integer not null default 0,
    goals_against integer not null default 0,
    goals_difference integer not null default 0,
    unique(league_id, team_id)
);

alter table public.league_teams enable row level security;


-- 7. Partidas
create table public.matches (
    id uuid default gen_random_uuid() primary key,
    season_id uuid references public.seasons(id) on delete cascade not null,
    league_id uuid references public.leagues(id) on delete cascade, -- NULL se for copa/amistoso
    competition_type text not null check (competition_type in ('league', 'cup_group', 'cup_playoff', 'friendly')),
    home_team_id uuid references public.teams(id) on delete cascade not null,
    away_team_id uuid references public.teams(id) on delete cascade not null,
    home_score integer,
    away_score integer,
    status text not null default 'pending' check (status in ('pending', 'confirmed', 'dispute')),
    reported_by uuid references public.profiles(id) on delete set null,
    disputed_by uuid references public.profiles(id) on delete set null,
    dispute_reason text,
    dispute_proof_url text, -- Print de tela comprobatório
    round_number integer, -- Número da rodada
    match_date timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.matches enable row level security;


-- 8. Eventos de Partidas (Gols, Assistências e Cartões)
create table public.match_events (
    id uuid default gen_random_uuid() primary key,
    match_id uuid references public.matches(id) on delete cascade not null,
    team_id uuid references public.teams(id) on delete cascade not null,
    player_id bigint references public.players(id) on delete cascade not null,
    event_type text not null check (event_type in ('goal', 'assist', 'yellow_card', 'red_card')),
    minute integer
);

alter table public.match_events enable row level security;


-- 9. Propostas de Trocas Diretas (Trade Offers)
create table public.trade_offers (
    id uuid default gen_random_uuid() primary key,
    sender_team_id uuid references public.teams(id) on delete cascade not null,
    receiver_team_id uuid references public.teams(id) on delete cascade not null,
    offered_money numeric(15, 2) not null default 0.00,
    requested_money numeric(15, 2) not null default 0.00,
    status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    expires_at timestamp with time zone not null
);

alter table public.trade_offers enable row level security;


-- 10. Jogadores Envolvidos na Troca Direta
create table public.trade_players (
    id uuid default gen_random_uuid() primary key,
    trade_offer_id uuid references public.trade_offers(id) on delete cascade not null,
    player_id bigint references public.players(id) on delete cascade not null,
    direction text not null check (direction in ('send', 'receive')) -- 'send' = oferecido pelo sender, 'receive' = oferecido pelo receiver
);

alter table public.trade_players enable row level security;


-- 11. Listagens do Mercado (Compra Imediata e Leilões)
create table public.market_listings (
    id uuid default gen_random_uuid() primary key,
    player_id bigint references public.players(id) on delete cascade not null,
    seller_team_id uuid references public.teams(id) on delete cascade, -- NULL se listado pelo sistema (Jogador Livre)
    listing_type text not null check (listing_type in ('immediate_buy', 'auction')),
    price numeric(15, 2) not null, -- Preço fixo de compra ou lance mínimo do leilão
    buyout_price numeric(15, 2), -- Preço para compra imediata (em caso de leilão)
    status text not null default 'active' check (status in ('active', 'sold', 'expired', 'cancelled')),
    end_date timestamp with time zone, -- Data final se for leilão
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.market_listings enable row level security;


-- 12. Lances de Leilão (Market Bids)
create table public.market_bids (
    id uuid default gen_random_uuid() primary key,
    market_listing_id uuid references public.market_listings(id) on delete cascade not null,
    bidder_team_id uuid references public.teams(id) on delete cascade not null,
    bid_amount numeric(15, 2) not null,
    status text not null default 'pending' check (status in ('pending', 'won', 'outbid')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.market_bids enable row level security;


-- ========================================================
-- CRIAR POLÍTICAS RLS BÁSICAS (LEITURA LIBERADA A TODOS)
-- ========================================================

create policy "Permitir leitura para todos" on public.profiles for select using (true);
create policy "Permitir leitura para todos" on public.teams for select using (true);
drop policy if exists "Permitir leitura para todos" on public.players;
drop policy if exists "Permitir tudo para todos no players" on public.players;
create policy "Permitir tudo todos no players" on public.players for all using (true) with check (true);
create policy "Permitir leitura para todos" on public.seasons for select using (true);
create policy "Permitir leitura para todos" on public.leagues for select using (true);
create policy "Permitir leitura para todos" on public.league_teams for select using (true);
create policy "Permitir leitura para todos" on public.matches for select using (true);
create policy "Permitir leitura para todos" on public.match_events for select using (true);
create policy "Permitir leitura para todos" on public.trade_offers for select using (true);
create policy "Permitir leitura para todos" on public.trade_players for select using (true);
create policy "Permitir leitura para todos" on public.market_listings for select using (true);
create policy "Permitir leitura para todos" on public.market_bids for select using (true);

-- Permitir que usuários atualizem seus próprios registros
create policy "Permitir alteração de si mesmo" on public.profiles for update using (auth.uid() = id);
create policy "Permitir alteração do próprio time" on public.teams for update using (auth.uid() = user_id);


-- ========================================================
-- FUNÇÕES ESPECIAIS (RPC) PARA TRANSAÇÕES SEGURAS
-- ========================================================

-- Função para comprar um Agente Livre de forma segura
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
    -- 1. Verificar se a janela de transferências está aberta (existe temporada active)
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
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
        return json_build_object('success', false, 'message', 'Este jogador já pertence a outro time!');
    end if;

    -- 3. Obter orçamento e limite de salários do time
    select budget, max_wage_cap
    into v_team_budget, v_team_max_wage_cap
    from public.teams
    where id = p_team_id;

    if v_team_budget is null then
        return json_build_object('success', false, 'message', 'Time não encontrado!');
    end if;

    -- 4. Calcular folha salarial atual do time
    select coalesce(sum(wage), 0)
    into v_team_wages
    from public.players
    where team_id = p_team_id;

    -- 5. Validar orçamento
    if v_team_budget < v_player_value then
        return json_build_object('success', false, 'message', 'Orçamento insuficiente! Saldo: R$ ' || to_char(v_team_budget, 'FM999G999G990D00') || ', Preço: R$ ' || to_char(v_player_value, 'FM999G999G990D00'));
    end if;

    -- 6. Validar teto salarial (wage cap)
    if (v_team_wages + v_player_wage) > v_team_max_wage_cap then
        return json_build_object('success', false, 'message', 'Estouro do Teto Salarial! O salário de R$ ' || v_player_wage || ' fará a folha total (' || (v_team_wages + v_player_wage) || ') passar do teto máximo de R$ ' || v_team_max_wage_cap);
    end if;

    -- 7. Executar a compra
    -- Deduzir orçamento
    update public.teams
    set budget = budget - v_player_value
    where id = p_team_id;

    -- Vincular o jogador ao time
    update public.players
    set team_id = p_team_id
    where id = p_player_id;

    return json_build_object('success', true, 'message', 'Jogador contratado com sucesso!');
end;
$$ language plpgsql security definer;


-- Função para dispensar um jogador do time e reembolsar o valor
create or replace function public.release_player(p_player_id bigint, p_team_id uuid)
returns json as $$
declare
    v_player_value numeric(15, 2);
    v_player_team uuid;
    v_market_open boolean;
begin
    -- 1. Verificar se a janela de transferências está aberta
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Verificar se o jogador realmente pertence a esse time
    select value, team_id
    into v_player_value, v_player_team
    from public.players
    where id = p_player_id;

    if v_player_team is null or v_player_team != p_team_id then
        return json_build_object('success', false, 'message', 'Este jogador não pertence ao seu time!');
    end if;

    -- 3. Executar dispensa
    -- Remover o jogador do time
    update public.players
    set team_id = null
    where id = p_player_id;

    -- Reembolsar orçamento do time
    update public.teams
    set budget = budget + v_player_value
    where id = p_team_id;

    return json_build_object('success', true, 'message', 'Jogador dispensado com sucesso e valor de mercado reembolsado!');
end;
$$ language plpgsql security definer;


-- Função para comprar um anúncio do mercado de forma segura
create or replace function public.buy_market_listing(p_listing_id uuid, p_buyer_team_id uuid)
returns json as $$
declare
    v_player_id bigint;
    v_player_wage numeric(12, 2);
    v_seller_team_id uuid;
    v_price numeric(15, 2);
    v_buyer_budget numeric(15, 2);
    v_buyer_wages numeric(15, 2);
    v_buyer_max_wage_cap numeric(15, 2);
    v_listing_status text;
    v_market_open boolean;
begin
    -- 1. Verificar se a janela de transferências está aberta
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Obter dados da listagem e verificar status
    select player_id, seller_team_id, price, status
    into v_player_id, v_seller_team_id, v_price, v_listing_status
    from public.market_listings
    where id = p_listing_id;

    if v_listing_status is null then
        return json_build_object('success', false, 'message', 'Anúncio não encontrado!');
    end if;

    if v_listing_status != 'active' then
        return json_build_object('success', false, 'message', 'Este anúncio não está mais ativo!');
    end if;

    -- 3. Obter salário do jogador
    select wage into v_player_wage
    from public.players
    where id = v_player_id;

    -- 4. Obter orçamento e limite de salários do comprador
    select budget, max_wage_cap
    into v_buyer_budget, v_buyer_max_wage_cap
    from public.teams
    where id = p_buyer_team_id;

    if v_buyer_budget is null then
        return json_build_object('success', false, 'message', 'Comprador não encontrado!');
    end if;

    -- Impedir comprar o próprio jogador
    if v_seller_team_id = p_buyer_team_id then
        return json_build_object('success', false, 'message', 'Você não pode comprar seu próprio jogador!');
    end if;

    -- 5. Calcular folha salarial atual do comprador
    select coalesce(sum(wage), 0)
    into v_buyer_wages
    from public.players
    where team_id = p_buyer_team_id;

    -- 6. Validar orçamento do comprador
    if v_buyer_budget < v_price then
        return json_build_object('success', false, 'message', 'Orçamento insuficiente! Saldo: R$ ' || to_char(v_buyer_budget, 'FM999G999G990D00') || ', Preço: R$ ' || to_char(v_price, 'FM999G999G990D00'));
    end if;

    -- 7. Validar teto salarial do comprador
    if (v_buyer_wages + v_player_wage) > v_buyer_max_wage_cap then
        return json_build_object('success', false, 'message', 'Estouro do Teto Salarial! O salário de R$ ' || v_player_wage || ' fará a folha total (' || (v_buyer_wages + v_player_wage) || ') passar do teto máximo de R$ ' || v_buyer_max_wage_cap);
    end if;

    -- 8. Executar transação
    -- Deduzir dinheiro do comprador
    update public.teams
    set budget = budget - v_price
    where id = p_buyer_team_id;

    -- Adicionar dinheiro ao vendedor (se houver vendedor)
    if v_seller_team_id is not null then
        update public.teams
        set budget = budget + v_price
        where id = v_seller_team_id;
    end if;

    -- Transferir jogador
    update public.players
    set team_id = p_buyer_team_id
    where id = v_player_id;

    -- Finalizar anúncio
    update public.market_listings
    set status = 'sold'
    where id = p_listing_id;

    return json_build_object('success', true, 'message', 'Jogador adquirido com sucesso!');
end;
$$ language plpgsql security definer;


-- Função para registrar um lance em leilão de forma segura
create or replace function public.place_auction_bid(p_listing_id uuid, p_bidder_team_id uuid, p_amount numeric)
returns json as $$
declare
    v_highest_bid numeric(15, 2);
    v_min_price numeric(15, 2);
    v_listing_status text;
    v_end_date timestamp with time zone;
    v_bidder_budget numeric(15, 2);
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
    select budget into v_bidder_budget
    from public.teams
    where id = p_bidder_team_id;

    if v_bidder_budget < p_amount then
        return json_build_object('success', false, 'message', 'Orçamento insuficiente! Saldo atual: R$ ' || to_char(v_bidder_budget, 'FM999G999G990D00'));
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


-- Função para encerrar leilão e processar a transferência do jogador
create or replace function public.close_auction(p_listing_id uuid)
returns json as $$
declare
    v_player_id bigint;
    v_player_wage numeric(12, 2);
    v_seller_team_id uuid;
    v_winning_bidder_id uuid;
    v_winning_amount numeric(15, 2);
    v_buyer_wages numeric(15, 2);
    v_buyer_max_wage_cap numeric(15, 2);
    v_listing_status text;
    v_end_date timestamp with time zone;
begin
    -- 1. Obter dados do leilão
    select player_id, seller_team_id, status, end_date
    into v_player_id, v_seller_team_id, v_listing_status, v_end_date
    from public.market_listings
    where id = p_listing_id and listing_type = 'auction';

    if v_listing_status is null then
        return json_build_object('success', false, 'message', 'Leilão não encontrado!');
    end if;

    if v_listing_status != 'active' then
        return json_build_object('success', false, 'message', 'Este leilão não está mais ativo!');
    end if;

    -- 2. Encontrar o lance vencedor
    select bidder_team_id, bid_amount
    into v_winning_bidder_id, v_winning_amount
    from public.market_bids
    where market_listing_id = p_listing_id and status = 'pending'
    order by bid_amount desc
    limit 1;

    -- Se não houver lances
    if v_winning_bidder_id is null then
        update public.market_listings
        set status = 'expired'
        where id = p_listing_id;
        return json_build_object('success', true, 'message', 'Leilão encerrado sem lances.');
    end if;

    -- 3. Obter salário do jogador
    select wage into v_player_wage
    from public.players
    where id = v_player_id;

    -- 4. Verificar teto salarial do vencedor
    select coalesce(sum(wage), 0)
    into v_buyer_wages
    from public.players
    where team_id = v_winning_bidder_id;

    select max_wage_cap
    into v_buyer_max_wage_cap
    from public.teams
    where id = v_winning_bidder_id;

    -- 5. Executar a transferência financeira
    -- Deduzir dinheiro do vencedor
    update public.teams
    set budget = budget - v_winning_amount
    where id = v_winning_bidder_id;

    -- Pagar o vendedor
    if v_seller_team_id is not null then
        update public.teams
        set budget = budget + v_winning_amount
        where id = v_seller_team_id;
    end if;

    -- Transferir jogador
    update public.players
    set team_id = v_winning_bidder_id
    where id = v_player_id;

    -- Marcar lance como ganho
    update public.market_bids
    set status = 'won'
    where market_listing_id = p_listing_id and bidder_team_id = v_winning_bidder_id and status = 'pending';

    -- Fechar anúncio
    update public.market_listings
    set status = 'sold'
    where id = p_listing_id;

    return json_build_object('success', true, 'message', 'Leilão encerrado com sucesso!');
end;
$$ language plpgsql security definer;


-- Função para aceitar e liquidar proposta de troca direta (Trade)
create or replace function public.accept_trade_offer(p_trade_id uuid)
returns json as $$
declare
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
begin
    -- 1. Verificar se a janela de transferências está aberta
    select exists(select 1 from public.seasons where status = 'active') into v_market_open;
    if not v_market_open then
        return json_build_object('success', false, 'message', 'A janela de transferências está fechada!');
    end if;

    -- 2. Obter dados da proposta e verificar pendência
    select sender_team_id, receiver_team_id, offered_money, requested_money, status
    into v_sender_team_id, v_receiver_team_id, v_offered_money, v_requested_money, v_status
    from public.trade_offers
    where id = p_trade_id;

    if v_status is null then
        return json_build_object('success', false, 'message', 'Proposta de troca não encontrada!');
    end if;

    if v_status != 'pending' then
        return json_build_object('success', false, 'message', 'Esta proposta não está mais pendente!');
    end if;

    -- 3. Obter dados financeiros dos dois times
    select budget, max_wage_cap into v_sender_budget, v_sender_max_wage from public.teams where id = v_sender_team_id;
    select budget, max_wage_cap into v_receiver_budget, v_receiver_max_wage from public.teams where id = v_receiver_team_id;

    -- 4. Validar saldo do Proponente (Sender)
    if (v_sender_budget - v_offered_money + v_requested_money) < 0 then
        return json_build_object('success', false, 'message', 'O proponente não possui saldo suficiente para a troca!');
    end if;

    -- 5. Validar saldo do Destinatário (Receiver)
    if (v_receiver_budget + v_offered_money - v_requested_money) < 0 then
        return json_build_object('success', false, 'message', 'Você não possui saldo suficiente para aceitar essa troca!');
    end if;

    -- 6. Validar propriedade dos jogadores e calcular impacto salarial
    for v_player_id, v_direction in 
        select player_id, direction from public.trade_players where trade_offer_id = p_trade_id
    loop
        select team_id, wage into v_player_owner, v_player_wage from public.players where id = v_player_id;
        
        if v_direction = 'send' then
            if v_player_owner is null or v_player_owner != v_sender_team_id then
                return json_build_object('success', false, 'message', 'Erro: Um ou mais jogadores oferecidos não pertencem mais ao proponente.');
            end if;
            v_wages_sent := v_wages_sent + v_player_wage;
        else
            if v_player_owner is null or v_player_owner != v_receiver_team_id then
                return json_build_object('success', false, 'message', 'Erro: Um ou mais jogadores solicitados não pertencem mais a você.');
            end if;
            v_wages_received := v_wages_received + v_player_wage;
        end if;
    end loop;

    -- 7. Calcular folha salarial atual das equipes
    select coalesce(sum(wage), 0) into v_sender_current_wages from public.players where team_id = v_sender_team_id;
    select coalesce(sum(wage), 0) into v_receiver_current_wages from public.players where team_id = v_receiver_team_id;

    -- 8. Validar Teto Salarial do Proponente (Sender)
    if (v_sender_current_wages - v_wages_sent + v_wages_received) > v_sender_max_wage then
        return json_build_object('success', false, 'message', 'Erro: O proponente ultrapassará o teto salarial após a troca!');
    end if;

    -- 9. Validar Teto Salarial do Destinatário (Receiver)
    if (v_receiver_current_wages - v_wages_received + v_wages_sent) > v_receiver_max_wage then
        return json_build_object('success', false, 'message', 'Estouro de Teto Salarial! Aceitar esta troca fará sua folha passar de ' || v_receiver_max_wage);
    end if;

    -- 10. Executar a Troca
    update public.teams set budget = budget - v_offered_money + v_requested_money where id = v_sender_team_id;
    update public.teams set budget = budget + v_offered_money - v_requested_money where id = v_receiver_team_id;

    update public.players
    set team_id = v_receiver_team_id
    where id in (
        select player_id from public.trade_players where trade_offer_id = p_trade_id and direction = 'send'
    );

    update public.players
    set team_id = v_sender_team_id
    where id in (
        select player_id from public.trade_players where trade_offer_id = p_trade_id and direction = 'receive'
    );

    update public.trade_offers set status = 'accepted' where id = p_trade_id;

    -- Auto-cancelar conflitos
    update public.trade_offers
    set status = 'cancelled'
    where id in (
        select distinct t_off.id
        from public.trade_offers t_off
        join public.trade_players t_pl on t_pl.trade_offer_id = t_off.id
        where t_off.status = 'pending'
          and t_pl.player_id in (
              select player_id from public.trade_players where trade_offer_id = p_trade_id
          )
    );

    return json_build_object('success', true, 'message', 'Troca concluída com sucesso!');
end;
$$ language plpgsql security definer;


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


-- ========================================================
-- ATUALIZAÇÕES DE RLS (ROW LEVEL SECURITY)
-- ========================================================

-- Função auxiliar para checar se o usuário é admin
create or replace function public.is_admin()
returns boolean as $$
begin
    return exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
end;
$$ language plpgsql security definer;

-- 0. Políticas para PROFILES (Perfis)
drop policy if exists "Permitir inserção de perfil pelo próprio usuário" on public.profiles;
create policy "Permitir inserção de perfil pelo próprio usuário" on public.profiles for insert with check (auth.uid() = id);

-- 1. Políticas para TEAMS (Times)
drop policy if exists "Permitir inserção do próprio time" on public.teams;
drop policy if exists "Permitir tudo para admin no teams" on public.teams;
create policy "Permitir inserção do próprio time" on public.teams for insert with check (auth.uid() = user_id);
create policy "Permitir tudo para admin no teams" on public.teams for all using (public.is_admin());

-- 2. Políticas para MATCH_EVENTS (Eventos de Partidas)
drop policy if exists "Permitir inserção de eventos de partidas" on public.match_events;
drop policy if exists "Permitir exclusão de eventos de partidas" on public.match_events;
drop policy if exists "Permitir tudo para admin no match_events" on public.match_events;
create policy "Permitir inserção de eventos de partidas" on public.match_events for insert with check (auth.uid() is not null);
create policy "Permitir exclusão de eventos de partidas" on public.match_events for delete using (auth.uid() is not null);
create policy "Permitir tudo para admin no match_events" on public.match_events for all using (public.is_admin());

-- 3. Políticas para MATCHES (Partidas)
drop policy if exists "Permitir atualização de partidas" on public.matches;
drop policy if exists "Permitir tudo para admin no matches" on public.matches;
create policy "Permitir atualização de partidas" on public.matches for update using (auth.uid() is not null);
create policy "Permitir tudo para admin no matches" on public.matches for all using (public.is_admin());

-- 4. Políticas para MARKET_LISTINGS (Anúncios do Mercado)
drop policy if exists "Permitir inserção de anúncios no mercado" on public.market_listings;
drop policy if exists "Permitir atualização de anúncios no mercado" on public.market_listings;
drop policy if exists "Permitir tudo para admin no market_listings" on public.market_listings;
create policy "Permitir inserção de anúncios no mercado" on public.market_listings for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = seller_team_id));
create policy "Permitir atualização de anúncios no mercado" on public.market_listings for update using (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = seller_team_id));
create policy "Permitir tudo para admin no market_listings" on public.market_listings for all using (public.is_admin());

-- 5. Políticas para MARKET_BIDS (Lances de Leilão)
drop policy if exists "Permitir inserção de lances no mercado" on public.market_bids;
drop policy if exists "Permitir tudo para admin no market_bids" on public.market_bids;
create policy "Permitir inserção de lances no mercado" on public.market_bids for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = bidder_team_id));
create policy "Permitir tudo para admin no market_bids" on public.market_bids for all using (public.is_admin());

-- 6. Políticas para TRADE_OFFERS (Propostas de Trocas)
drop policy if exists "Permitir inserção de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir atualização de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir tudo para admin no trade_offers" on public.trade_offers;
create policy "Permitir inserção de propostas de trocas" on public.trade_offers for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = sender_team_id));
create policy "Permitir atualização de propostas de trocas" on public.trade_offers for update using (exists (select 1 from public.teams t where t.user_id = auth.uid() and (t.id = sender_team_id or t.id = receiver_team_id)));
create policy "Permitir tudo para admin no trade_offers" on public.trade_offers for all using (public.is_admin());

-- 7. Políticas para TRADE_PLAYERS (Jogadores na Troca)
drop policy if exists "Permitir inserção de jogadores na troca" on public.trade_players;
drop policy if exists "Permitir tudo para admin no trade_players" on public.trade_players;
create policy "Permitir inserção de jogadores na troca" on public.trade_players for insert with check (auth.uid() is not null);
create policy "Permitir tudo para admin no trade_players" on public.trade_players for all using (public.is_admin());

-- 8. Políticas de Admin para outras tabelas
drop policy if exists "Permitir tudo para admin no seasons" on public.seasons;
drop policy if exists "Permitir tudo para admin no leagues" on public.leagues;
drop policy if exists "Permitir tudo para admin no league_teams" on public.league_teams;
drop policy if exists "Permitir tudo para admin no players" on public.players;
drop policy if exists "Permitir tudo para admin no suspensions" on public.suspensions;
drop policy if exists "Permitir tudo para admin no profiles" on public.profiles;

create policy "Permitir tudo para admin no seasons" on public.seasons for all using (public.is_admin());
create policy "Permitir tudo para admin no leagues" on public.leagues for all using (public.is_admin());
create policy "Permitir tudo para admin no league_teams" on public.league_teams for all using (public.is_admin());
create policy "Permitir tudo para admin no players" on public.players for all using (public.is_admin());
create policy "Permitir tudo para admin no suspensions" on public.suspensions for all using (public.is_admin());
create policy "Permitir tudo para admin no profiles" on public.profiles for all using (public.is_admin());


