-- ======================================
-- SCRIPT MESTRE DE ATUALIZAÇÕES
-- ======================================



-- ======================================
-- SCRIPT: add_market_open_column.sql
-- ======================================

-- Garante que a coluna market_open existe na tabela seasons
ALTER TABLE public.seasons
ADD COLUMN IF NOT EXISTS market_open BOOLEAN NOT NULL DEFAULT false;


-- ======================================
-- SCRIPT: add_released_column.sql
-- ======================================

-- Adiciona a coluna released na tabela de partidas para suportar o recurso de "Liberar Rodada"
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS released BOOLEAN NOT NULL DEFAULT false;




-- ======================================
-- SCRIPT: invite_system.sql
-- ======================================

-- ========================================================
-- SISTEMA DE CONVITES POR WHITELIST DE E-MAIL
-- ========================================================

-- Tabela de e-mails autorizados a se registrar na liga
create table if not exists public.allowed_emails (
    id uuid default gen_random_uuid() primary key,
    email text not null unique,
    display_name text,                              -- Nome sugerido pelo admin (opcional)
    added_by uuid references public.profiles(id) on delete set null,
    used boolean default false,                     -- true quando o participante completar o registro
    used_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.allowed_emails enable row level security;

-- Somente admins gerenciam a whitelist
drop policy if exists "Admin gerencia whitelist" on public.allowed_emails;
DROP POLICY IF EXISTS "Admin gerencia whitelist" ON public.allowed_emails;
create policy "Admin gerencia whitelist" on public.allowed_emails
    for all using (public.is_admin());

-- Comentário: a validação de e-mail no registro é feita via Server Action com service_role
-- A tabela NÃO precisa de select público — a verificação é feita no servidor


-- ======================================
-- SCRIPT: market_news.sql
-- ======================================

-- =========================================================================
-- MIGRAÇÃO: MURAL DE NOTÍCIAS DO MERCADO E ESTATÍSTICAS DE CARREIRA
-- Cole este script no SQL Editor do Supabase para criar as novas tabelas,
-- triggers de automação de notícias e a view de estatísticas dos jogadores.
-- =========================================================================

-- 1. Criar Tabela de Notícias
CREATE TABLE IF NOT EXISTS public.market_news (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    category text NOT NULL CHECK (category IN ('transfer', 'auction', 'finance', 'admin', 'stage', 'general')),
    badge_url text, -- Logo do time envolvido ou imagem de destaque
    player_face_url text, -- Avatar do jogador envolvido
    player_id bigint REFERENCES public.players(id) ON DELETE SET NULL,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para market_news
ALTER TABLE public.market_news ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir leitura de noticias para todos" ON public.market_news;
DROP POLICY IF EXISTS "Permitir leitura de noticias para todos" ON public.market_news;
CREATE POLICY "Permitir leitura de noticias para todos" ON public.market_news
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao apenas para admins ou sistema" ON public.market_news;
DROP POLICY IF EXISTS "Permitir insercao apenas para admins ou sistema" ON public.market_news;
CREATE POLICY "Permitir insercao apenas para admins ou sistema" ON public.market_news
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        ) OR auth.uid() IS NULL -- Permite que as triggers do banco executem inserções
    );

DROP POLICY IF EXISTS "Permitir exclusao apenas para admins" ON public.market_news;
DROP POLICY IF EXISTS "Permitir exclusao apenas para admins" ON public.market_news;
CREATE POLICY "Permitir exclusao apenas para admins" ON public.market_news
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );


-- 2. Atualizar as restrições da tabela transfer_history para aceitar novos tipos financeiros
ALTER TABLE public.transfer_history DROP CONSTRAINT IF EXISTS transfer_history_transfer_type_check;
ALTER TABLE public.transfer_history ADD CONSTRAINT transfer_history_transfer_type_check 
    CHECK (transfer_type IN ('buyout', 'immediate_buy', 'auction', 'trade', 'loan', 'release', 'salary_charge', 'sponsorship', 'reward', 'fine'));


-- 3. View para Estatísticas de Carreira dos Jogadores por Temporada
CREATE OR REPLACE VIEW public.view_players_career_stats AS
SELECT 
    me.player_id,
    m.season_id,
    s.name as season_name,
    p.name as player_name,
    p.face_url as player_face_url,
    sum(case when me.event_type = 'goal' then 1 else 0 end) as goals,
    sum(case when me.event_type = 'assist' then 1 else 0 end) as assists,
    coalesce((
        select count(*) from public.matches m2 
        where m2.season_id = m.season_id 
          and m2.motm_player_id = me.player_id 
          and m2.status = 'confirmed'
    ), 0) as motm_count
FROM public.match_events me
JOIN public.matches m ON m.id = me.match_id
JOIN public.seasons s ON s.id = m.season_id
JOIN public.players p ON p.id = me.player_id
GROUP BY me.player_id, m.season_id, s.name, p.name, p.face_url;


-- 4. Função do Trigger para gerar notícias automáticas de transferências
CREATE OR REPLACE FUNCTION public.process_transfer_news()
RETURNS trigger AS $$
DECLARE
    v_player_pos text;
    v_player_rating integer;
    v_badge_url text;
    v_title text;
    v_content text;
    v_category text := 'transfer';
BEGIN
    -- Obter detalhes extras do jogador
    SELECT position, rating INTO v_player_pos, v_player_rating 
    FROM public.players WHERE id = NEW.player_id;

    -- Obter o escudo do time de destino (ou origem se for demissão)
    IF NEW.to_team_id IS NOT NULL THEN
        SELECT badge_url INTO v_badge_url FROM public.teams WHERE id = NEW.to_team_id;
    ELSE
        SELECT badge_url INTO v_badge_url FROM public.teams WHERE id = NEW.from_team_id;
    END IF;

    -- Determinar título e conteúdo com base no tipo de transação
    CASE NEW.transfer_type
        WHEN 'buyout' THEN
            v_title := '🚨 CONTRATAÇÃO BOMBA: ' || NEW.player_name || ' assina com o ' || NEW.to_team_name || '!';
            v_content := 'O ' || NEW.to_team_name || ' sacudiu o mercado ao pagar a multa rescisória contratual de R$ ' || 
                         to_char(NEW.amount, 'FM999G999G990D00') || ' e contratar o jogador ' || NEW.player_name || 
                         ' (' || COALESCE(v_player_pos, '--') || ', Rating ' || COALESCE(v_player_rating, 0) || ') que defendia as cores do ' || NEW.from_team_name || '.';
            v_category := 'transfer';
            
        WHEN 'immediate_buy' THEN
            v_title := '🤝 CONTRATAÇÃO CONCLUÍDA: ' || NEW.player_name || ' é do ' || NEW.to_team_name || '!';
            v_content := 'O ' || NEW.to_team_name || ' anunciou oficialmente a contratação definitiva do jogador ' || NEW.player_name || 
                         ' (' || COALESCE(v_player_pos, '--') || ', Rating ' || COALESCE(v_player_rating, 0) || ') vindo do ' || NEW.from_team_name || 
                         ' em uma transação fechada por R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || '.';
            v_category := 'transfer';

        WHEN 'auction' THEN
            v_title := '🔨 LEILÃO CONCLUÍDO: ' || NEW.player_name || ' vai para o ' || NEW.to_team_name || '!';
            v_content := 'Após uma intensa disputa de lances, o ' || NEW.to_team_name || ' venceu a concorrência e garantiu os direitos de ' || NEW.player_name || 
                         ' (' || COALESCE(v_player_pos, '--') || ', Rating ' || COALESCE(v_player_rating, 0) || ') pelo valor final de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || '.';
            v_category := 'auction';

        WHEN 'trade' THEN
            v_title := '🔄 TROCA DE JOGADORES: Acordo entre ' || NEW.from_team_name || ' e ' || NEW.to_team_name || '!';
            v_content := 'Os clubes ' || NEW.from_team_name || ' e ' || NEW.to_team_name || ' selaram uma negociação de troca envolvendo o jogador ' || NEW.player_name || 
                         ' (' || COALESCE(v_player_pos, '--') || ', Rating ' || COALESCE(v_player_rating, 0) || ') para o ' || NEW.to_team_name || 
                         '. O montante envolvido no acerto financeiro foi de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || '.';
            v_category := 'transfer';

        WHEN 'loan' THEN
            v_title := '🏃‍♂️ EMPRÉSTIMO FECHADO: ' || NEW.player_name || ' reforça o ' || NEW.to_team_name || '!';
            v_content := 'O ' || NEW.to_team_name || ' acertou o empréstimo temporário do jogador ' || NEW.player_name || 
                         ' (' || COALESCE(v_player_pos, '--') || ', Rating ' || COALESCE(v_player_rating, 0) || ') pertencente ao ' || NEW.from_team_name || 
                         ' até o fim do período estabelecido no contrato.';
            v_category := 'transfer';

        WHEN 'release' THEN
            v_title := '❌ RESCISÃO: ' || NEW.player_name || ' está livre no mercado!';
            v_content := 'O ' || NEW.from_team_name || ' anunciou a rescisão amigável de contrato com o jogador ' || NEW.player_name || 
                         ' (' || COALESCE(v_player_pos, '--') || ', Rating ' || COALESCE(v_player_rating, 0) || '). O atleta agora é um Agente Livre e está livre para assinar com qualquer time.';
            v_category := 'transfer';

        WHEN 'salary_charge' THEN
            v_title := '💵 FINANCEIRO: Salários debitados do ' || NEW.from_team_name || '!';
            v_content := 'O caixa do ' || NEW.from_team_name || ' teve o desconto automático de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || 
                         ' referente à folha salarial semanal do seu elenco nesta metade de rodadas jogadas.';
            v_category := 'finance';

        WHEN 'sponsorship' THEN
            v_title := '💼 PATROCÍNIO: Renda de patrocínio para o ' || NEW.to_team_name || '!';
            v_content := 'O departamento financeiro do ' || NEW.to_team_name || ' confirmou a entrada de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || 
                         ' referentes ao contrato de patrocínio vigente do clube.';
            v_category := 'finance';

        WHEN 'reward' THEN
            v_title := '🏆 PREMIAÇÃO: Bônus concedido ao ' || NEW.to_team_name || '!';
            -- Usar o player_name como descrição do motivo se contiver texto longo
            v_content := 'Parabéns ao ' || NEW.to_team_name || '! A diretoria da liga creditou um bônus financeiro de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || 
                         ' sob a justificativa oficial: ' || COALESCE(NEW.player_name, 'Premiação geral ou conquista de objetivos.') || '.';
            v_category := 'finance';

        WHEN 'fine' THEN
            v_title := '⚠️ FINANCEIRO: Multa aplicada ao ' || NEW.from_team_name || '!';
            v_content := 'A comissão organizadora da liga aplicou uma multa de R$ ' || to_char(NEW.amount, 'FM999G999G990D00') || 
                         ' ao ' || NEW.from_team_name || '. Motivo: ' || COALESCE(NEW.player_name, 'Infração de regras do campeonato ou indisciplina.') || '.';
            v_category := 'finance';

        ELSE
            RETURN NEW;
    END CASE;

    -- Inserir na tabela de notícias
    INSERT INTO public.market_news (
        title, content, category, badge_url, player_face_url, player_id, team_id
    ) VALUES (
        v_title, v_content, v_category, v_badge_url, NEW.player_face_url, NEW.player_id, COALESCE(NEW.to_team_id, NEW.from_team_id)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de transferências
DROP TRIGGER IF EXISTS trigger_on_transfer_history ON public.transfer_history;
CREATE TRIGGER trigger_on_transfer_history
    AFTER INSERT ON public.transfer_history
    FOR EACH ROW EXECUTE FUNCTION public.process_transfer_news();


-- 5. Função do Trigger para gerar notícias quando a fase da temporada mudar
CREATE OR REPLACE FUNCTION public.process_settings_stage_news()
RETURNS trigger AS $$
BEGIN
    IF NEW.key = 'season_stage' AND (OLD.value IS NULL OR OLD.value <> NEW.value) THEN
        CASE NEW.value
            WHEN 'first_half' THEN
                INSERT INTO public.market_news (title, content, category)
                VALUES (
                    '⚽ CAMPEONATO INICIADO: Turno está rolando!',
                    'A primeira metade da temporada começou! Os técnicos já podem marcar seus confrontos e postar seus resultados. Lembrem-se: o mercado de transferências e empréstimos está travado nesta fase de Turno.',
                    'stage'
                );
            WHEN 'mid_season_market' THEN
                INSERT INTO public.market_news (title, content, category)
                VALUES (
                    '🔄 JANELA DE TRANSFERÊNCIAS ABERTA!',
                    'Atenção técnicos! A janela de transferências do meio do campeonato está oficialmente aberta. Façam propostas de troca, solicitem empréstimos e assaltem os adversários pagando a multa rescisória!',
                    'stage'
                );
            WHEN 'second_half' THEN
                INSERT INTO public.market_news (title, content, category)
                VALUES (
                    '🔒 MERCADO FECHADO: Início do Returno!',
                    'A janela de transferências está oficialmente encerrada. Nenhuma movimentação de elencos poderá ser feita. Foco total nas rodadas finais do Returno rumo ao topo da tabela!',
                    'stage'
                );
            WHEN 'season_end_wages' THEN
                INSERT INTO public.market_news (title, content, category)
                VALUES (
                    '🧾 BALANÇO FINANCEIRO DE FIM DE TEMPORADA',
                    'As rodadas se encerraram! Entramos na etapa de fechamento de balanço financeiro, onde a liga processará os descontos semanais de folha de pagamento de todos os times.',
                    'stage'
                );
            ELSE
                -- Nada faz
        END CASE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de configurações de fase
DROP TRIGGER IF EXISTS trigger_on_settings_stage ON public.settings;
CREATE TRIGGER trigger_on_settings_stage
    AFTER UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.process_settings_stage_news();


-- ======================================
-- SCRIPT: market_window.sql
-- ======================================

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


-- ======================================
-- SCRIPT: master_plan_foundation.sql
-- ======================================

-- ==========================================
-- MASTER PLAN FOUNDATION: NOVAS TABELAS E ESTRUTURAS
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. Criação da Tabela Rounds (Rodadas)
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
    league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE, -- Pode ser nulo se for rodada de Copa
    name TEXT NOT NULL, -- Ex: "Rodada 1", "Semifinal"
    sequence_number INTEGER NOT NULL, -- Ordenação cronológica (1, 2, 3...)
    suggested_start_date TIMESTAMP WITH TIME ZONE,
    suggested_deadline TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('scheduled', 'open', 'finished', 'extended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para todos em rounds" ON public.rounds;
DROP POLICY IF EXISTS "Permitir tudo para admin em rounds" ON public.rounds;
DROP POLICY IF EXISTS "Permitir leitura para todos em rounds" ON public.rounds;
CREATE POLICY "Permitir leitura para todos em rounds" ON public.rounds FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir tudo para admin em rounds" ON public.rounds;
CREATE POLICY "Permitir tudo para admin em rounds" ON public.rounds FOR ALL USING (public.is_admin());

-- 2. Atualizar Tabela Matches (Partidas)
-- Adicionando a FK para a tabela rounds sem quebrar os dados atuais (por isso nullable)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.rounds(id) ON DELETE SET NULL;


-- 3. Criação da Tabela Audit Logs (Auditoria do Admin)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Quem executou a ação
    action_type TEXT NOT NULL, -- Ex: 'APPLY_WO', 'OPEN_MARKET', 'APPROVE_TRADE'
    entity_name TEXT NOT NULL, -- Tabela ou módulo afetado (ex: 'matches', 'market')
    entity_id TEXT, -- ID do registro afetado (usamos text pois pode ser uuid ou bigint)
    details JSONB, -- Contexto adicional (ex: { "winner": "team_a", "reason": "no_show" })
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas admin pode ler logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Apenas admin pode inserir logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Apenas admin pode ler logs" ON public.audit_logs;
CREATE POLICY "Apenas admin pode ler logs" ON public.audit_logs FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Apenas admin pode inserir logs" ON public.audit_logs;
CREATE POLICY "Apenas admin pode inserir logs" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin());


-- 4. Criação da Tabela Player Stats History (Legado das Temporadas Contínuas)
CREATE TABLE IF NOT EXISTS public.player_stats_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id BIGINT REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL, -- Time pelo qual ele jogou
    matches_played INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    motm_count INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(player_id, season_id, team_id) -- Impede duplicatas do mesmo jogador no mesmo time na mesma temporada
);

ALTER TABLE public.player_stats_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para todos em stats_history" ON public.player_stats_history;
DROP POLICY IF EXISTS "Permitir tudo para admin em stats_history" ON public.player_stats_history;
DROP POLICY IF EXISTS "Permitir leitura para todos em stats_history" ON public.player_stats_history;
CREATE POLICY "Permitir leitura para todos em stats_history" ON public.player_stats_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Permitir tudo para admin em stats_history" ON public.player_stats_history;
CREATE POLICY "Permitir tudo para admin em stats_history" ON public.player_stats_history FOR ALL USING (public.is_admin());


-- ======================================
-- SCRIPT: migration_new_features.sql
-- ======================================

-- ==========================================
-- MIGRAÇÃO CORRIGIDA — Cole no SQL Editor do Supabase
-- ==========================================

-- 1. Tabela de Configurações
CREATE TABLE IF NOT EXISTS public.settings (
    key text PRIMARY KEY,
    value text NOT NULL DEFAULT '',
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura pública settings" ON public.settings;
DROP POLICY IF EXISTS "Leitura pública settings" ON public.settings;
CREATE POLICY "Leitura pública settings" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Escrita settings" ON public.settings;
DROP POLICY IF EXISTS "Escrita settings" ON public.settings;
CREATE POLICY "Escrita settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- 2. Valores padrão das configurações
INSERT INTO public.settings (key, value) VALUES
    ('league_name', 'Liga Master EA FC 26'),
    ('default_budget', '50000000'),
    ('default_wage_cap', '15000'),
    ('buyout_multiplier', '1.00'),
    ('salary_to_value_ratio', '20'),
    ('default_salary', '200'),
    ('wage_cap_enabled', 'false'),
    ('negotiations_enabled', 'false'),
    ('loan_enabled', 'false'),
    ('trade_enabled', 'false'),
    ('buyout_enabled', 'false'),
    ('allow_player_auction', 'false'),
    ('salary_window_open', 'false'),
    ('fire_player_enabled', 'true'),
    ('fire_player_penalty', 'none'),
    ('allow_shield_change', 'false'),
    ('allow_money_transfer', 'false'),
    ('auto_accept_proposals', 'false'),
    ('match_confirm_hours', '24'),
    ('auction_duration_value', '8'),
    ('auction_duration_unit', 'hours'),
    ('max_players_per_team', '26'),
    ('negotiations_no_contract', 'false'),
    ('allow_sponsor_change', 'false'),
    ('allow_repeated_shield', 'false'),
    ('statement_public', 'false'),
    ('modify_salary_on_buy', 'false'),
    ('fire_player_enabled', 'true'),
    ('salary_payer_loans', 'owner')
ON CONFLICT (key) DO NOTHING;

-- 3. Campos extras em teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS formation text DEFAULT '4-3-3';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS lineup jsonb DEFAULT '[]';

-- 4. Troféus
CREATE TABLE IF NOT EXISTS public.trophies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text,
    competition_name text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura trophies" ON public.trophies;
DROP POLICY IF EXISTS "Leitura trophies" ON public.trophies;
CREATE POLICY "Leitura trophies" ON public.trophies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin trophies" ON public.trophies;
DROP POLICY IF EXISTS "Admin trophies" ON public.trophies;
CREATE POLICY "Admin trophies" ON public.trophies FOR ALL USING (true) WITH CHECK (true);

-- 5. Troféus dos Times
CREATE TABLE IF NOT EXISTS public.team_trophies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    trophy_id uuid REFERENCES public.trophies(id) ON DELETE CASCADE,
    season_name text,
    awarded_at timestamptz DEFAULT now()
);
ALTER TABLE public.team_trophies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura team_trophies" ON public.team_trophies;
DROP POLICY IF EXISTS "Leitura team_trophies" ON public.team_trophies;
CREATE POLICY "Leitura team_trophies" ON public.team_trophies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin team_trophies" ON public.team_trophies;
DROP POLICY IF EXISTS "Admin team_trophies" ON public.team_trophies;
CREATE POLICY "Admin team_trophies" ON public.team_trophies FOR ALL USING (true) WITH CHECK (true);

-- 6. Lista de Espera
CREATE TABLE IF NOT EXISTS public.waitlist (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    whatsapp text,
    email text,
    preferred_team text,
    notes text,
    status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Admin waitlist" ON public.waitlist;
CREATE POLICY "Admin waitlist" ON public.waitlist FOR ALL USING (true) WITH CHECK (true);

-- 7. Patrocínios
CREATE TABLE IF NOT EXISTS public.sponsorships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sponsor_name text NOT NULL,
    logo_url text,
    value numeric(15,2) DEFAULT 0,
    duration_seasons int DEFAULT 1,
    team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura sponsorships" ON public.sponsorships;
DROP POLICY IF EXISTS "Leitura sponsorships" ON public.sponsorships;
CREATE POLICY "Leitura sponsorships" ON public.sponsorships FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin sponsorships" ON public.sponsorships;
DROP POLICY IF EXISTS "Admin sponsorships" ON public.sponsorships;
CREATE POLICY "Admin sponsorships" ON public.sponsorships FOR ALL USING (true) WITH CHECK (true);

-- 8. Empréstimos
CREATE TABLE IF NOT EXISTS public.loans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id bigint REFERENCES public.players(id) ON DELETE CASCADE,
    owner_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    loan_team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    loan_fee numeric(15,2) DEFAULT 0,
    status text DEFAULT 'pending' CHECK (status IN ('pending','active','returned','cancelled','rejected')),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura loans" ON public.loans;
DROP POLICY IF EXISTS "Leitura loans" ON public.loans;
CREATE POLICY "Leitura loans" ON public.loans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin loans" ON public.loans;
DROP POLICY IF EXISTS "Admin loans" ON public.loans;
CREATE POLICY "Admin loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);

-- 9. Atualizar constraint de status em market_listings
ALTER TABLE public.market_listings DROP CONSTRAINT IF EXISTS market_listings_status_check;
ALTER TABLE public.market_listings ADD CONSTRAINT market_listings_status_check
    CHECK (status IN ('pending','active','sold','expired','cancelled'));

-- 10. Buckets de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('shields', 'shields', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('trophies', 'trophies', true) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Shields públicos" ON storage.objects;
DROP POLICY IF EXISTS "Shields públicos" ON storage.objects;
CREATE POLICY "Shields públicos" ON storage.objects FOR SELECT USING (bucket_id = 'shields');
DROP POLICY IF EXISTS "Admin upload shields" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload shields" ON storage.objects;
CREATE POLICY "Admin upload shields" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('shields','trophies'));
DROP POLICY IF EXISTS "Trophies públicos" ON storage.objects;
DROP POLICY IF EXISTS "Trophies públicos" ON storage.objects;
CREATE POLICY "Trophies públicos" ON storage.objects FOR SELECT USING (bucket_id = 'trophies');


-- ======================================
-- SCRIPT: phase4_updates.sql
-- ======================================

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
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.suspensions;
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


-- ======================================
-- SCRIPT: rls_updates.sql
-- ======================================

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
DROP POLICY IF EXISTS "Permitir inserção de perfil pelo próprio usuário" ON public.profiles;
create policy "Permitir inserção de perfil pelo próprio usuário" on public.profiles for insert with check (auth.uid() = id);

-- 1. Políticas para TEAMS (Times)
drop policy if exists "Permitir inserção do próprio time" on public.teams;
drop policy if exists "Permitir tudo para admin no teams" on public.teams;
DROP POLICY IF EXISTS "Permitir inserção do próprio time" ON public.teams;
create policy "Permitir inserção do próprio time" on public.teams for insert with check (auth.uid() = user_id);
DROP POLICY IF EXISTS "Permitir tudo para admin no teams" ON public.teams;
create policy "Permitir tudo para admin no teams" on public.teams for all using (public.is_admin());

-- 2. Políticas para MATCH_EVENTS (Eventos de Partidas)
drop policy if exists "Permitir inserção de eventos de partidas" on public.match_events;
drop policy if exists "Permitir exclusão de eventos de partidas" on public.match_events;
drop policy if exists "Permitir tudo para admin no match_events" on public.match_events;
DROP POLICY IF EXISTS "Permitir inserção de eventos de partidas" ON public.match_events;
create policy "Permitir inserção de eventos de partidas" on public.match_events for insert with check (auth.uid() is not null);
DROP POLICY IF EXISTS "Permitir exclusão de eventos de partidas" ON public.match_events;
create policy "Permitir exclusão de eventos de partidas" on public.match_events for delete using (auth.uid() is not null);
DROP POLICY IF EXISTS "Permitir tudo para admin no match_events" ON public.match_events;
create policy "Permitir tudo para admin no match_events" on public.match_events for all using (public.is_admin());

-- 3. Políticas para MATCHES (Partidas)
drop policy if exists "Permitir atualização de partidas" on public.matches;
drop policy if exists "Permitir tudo para admin no matches" on public.matches;
DROP POLICY IF EXISTS "Permitir atualização de partidas" ON public.matches;
create policy "Permitir atualização de partidas" on public.matches for update using (auth.uid() is not null);
DROP POLICY IF EXISTS "Permitir tudo para admin no matches" ON public.matches;
create policy "Permitir tudo para admin no matches" on public.matches for all using (public.is_admin());

-- 4. Políticas para MARKET_LISTINGS (Anúncios do Mercado)
drop policy if exists "Permitir inserção de anúncios no mercado" on public.market_listings;
drop policy if exists "Permitir atualização de anúncios no mercado" on public.market_listings;
drop policy if exists "Permitir tudo para admin no market_listings" on public.market_listings;
DROP POLICY IF EXISTS "Permitir inserção de anúncios no mercado" ON public.market_listings;
create policy "Permitir inserção de anúncios no mercado" on public.market_listings for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = seller_team_id));
DROP POLICY IF EXISTS "Permitir atualização de anúncios no mercado" ON public.market_listings;
create policy "Permitir atualização de anúncios no mercado" on public.market_listings for update using (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = seller_team_id));
DROP POLICY IF EXISTS "Permitir tudo para admin no market_listings" ON public.market_listings;
create policy "Permitir tudo para admin no market_listings" on public.market_listings for all using (public.is_admin());

-- 5. Políticas para MARKET_BIDS (Lances de Leilão)
drop policy if exists "Permitir inserção de lances no mercado" on public.market_bids;
drop policy if exists "Permitir tudo para admin no market_bids" on public.market_bids;
DROP POLICY IF EXISTS "Permitir inserção de lances no mercado" ON public.market_bids;
create policy "Permitir inserção de lances no mercado" on public.market_bids for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = bidder_team_id));
DROP POLICY IF EXISTS "Permitir tudo para admin no market_bids" ON public.market_bids;
create policy "Permitir tudo para admin no market_bids" on public.market_bids for all using (public.is_admin());

-- 6. Políticas para TRADE_OFFERS (Propostas de Trocas)
drop policy if exists "Permitir inserção de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir atualização de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir tudo para admin no trade_offers" on public.trade_offers;
DROP POLICY IF EXISTS "Permitir inserção de propostas de trocas" ON public.trade_offers;
create policy "Permitir inserção de propostas de trocas" on public.trade_offers for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = sender_team_id));
DROP POLICY IF EXISTS "Permitir atualização de propostas de trocas" ON public.trade_offers;
create policy "Permitir atualização de propostas de trocas" on public.trade_offers for update using (exists (select 1 from public.teams t where t.user_id = auth.uid() and (t.id = sender_team_id or t.id = receiver_team_id)));
DROP POLICY IF EXISTS "Permitir tudo para admin no trade_offers" ON public.trade_offers;
create policy "Permitir tudo para admin no trade_offers" on public.trade_offers for all using (public.is_admin());

-- 7. Políticas para TRADE_PLAYERS (Jogadores na Troca)
drop policy if exists "Permitir inserção de jogadores na troca" on public.trade_players;
drop policy if exists "Permitir tudo para admin no trade_players" on public.trade_players;
DROP POLICY IF EXISTS "Permitir inserção de jogadores na troca" ON public.trade_players;
create policy "Permitir inserção de jogadores na troca" on public.trade_players for insert with check (auth.uid() is not null);
DROP POLICY IF EXISTS "Permitir tudo para admin no trade_players" ON public.trade_players;
create policy "Permitir tudo para admin no trade_players" on public.trade_players for all using (public.is_admin());

-- 8. Políticas de Admin para outras tabelas
drop policy if exists "Permitir tudo para admin no seasons" on public.seasons;
drop policy if exists "Permitir tudo para admin no leagues" on public.leagues;
drop policy if exists "Permitir tudo para admin no league_teams" on public.league_teams;
drop policy if exists "Permitir tudo para admin no players" on public.players;
drop policy if exists "Permitir tudo para admin no suspensions" on public.suspensions;
drop policy if exists "Permitir tudo para admin no profiles" on public.profiles;

DROP POLICY IF EXISTS "Permitir tudo para admin no seasons" ON public.seasons;
create policy "Permitir tudo para admin no seasons" on public.seasons for all using (public.is_admin());
DROP POLICY IF EXISTS "Permitir tudo para admin no leagues" ON public.leagues;
create policy "Permitir tudo para admin no leagues" on public.leagues for all using (public.is_admin());
DROP POLICY IF EXISTS "Permitir tudo para admin no league_teams" ON public.league_teams;
create policy "Permitir tudo para admin no league_teams" on public.league_teams for all using (public.is_admin());
drop policy if exists "Permitir leitura para todos" on public.players;
drop policy if exists "Permitir tudo para todos no players" on public.players;
DROP POLICY IF EXISTS "Permitir tudo para todos no players" ON public.players;
create policy "Permitir tudo para todos no players" on public.players for all using (true) with check (true);
DROP POLICY IF EXISTS "Permitir tudo para admin no suspensions" ON public.suspensions;
create policy "Permitir tudo para admin no suspensions" on public.suspensions for all using (public.is_admin());
DROP POLICY IF EXISTS "Permitir tudo para admin no profiles" ON public.profiles;
create policy "Permitir tudo para admin no profiles" on public.profiles for all using (public.is_admin());


-- ======================================
-- SCRIPT: season_rounds_wo.sql
-- ======================================

-- ========================================================
-- SISTEMA DE LIBERAÇÃO DE RODADAS, W.O. E MASTER RESET
-- ========================================================

-- 1. Adicionar coluna "released" na tabela public.matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS released boolean DEFAULT false;
-- Atualizar partidas existentes para TRUE para evitar que jogos em andamento sejam bloqueados
UPDATE public.matches SET released = true;

-- 2. Alterar a restrição check na coluna profiles.role para aceitar 'master'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('master', 'admin', 'user'));

-- 3. Atualizar função is_admin() para incluir 'master'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'master')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar função auxiliar is_master() para operações super-administrativas
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'master'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC para Resetar todos os elencos de uma vez (liberar todos os jogadores para agentes livres)
CREATE OR REPLACE FUNCTION public.reset_all_squads()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player record;
BEGIN
    -- Validar se o chamador é master
    IF NOT public.is_master() THEN
        RETURN json_build_object('success', false, 'message', 'Não autorizado! Apenas o cargo Master da Liga pode resetar todos os elencos.');
    END IF;

    -- Registrar as dispensas no histórico de transferências antes de liberar os times
    FOR v_player IN 
        SELECT id, name, position, rating, face_url, team_id FROM public.players WHERE team_id IS NOT NULL
    LOOP
        INSERT INTO public.transfer_history (
            player_id, player_name, player_position, player_rating, player_face_url,
            from_team_id, from_team_name, amount, transfer_type
        )
        SELECT 
            v_player.id, v_player.name, v_player.position, v_player.rating, v_player.face_url,
            t.id, t.name, 0.00, 'release'
        FROM public.teams t
        WHERE t.id = v_player.team_id;
    END LOOP;

    -- Remover vínculo de todos os jogadores com qualquer time
    UPDATE public.players
    SET team_id = NULL;

    RETURN json_build_object('success', true, 'message', 'Todos os elencos de todos os times foram liberados com sucesso!');
END;
$$;

-- 6. RPC para Restaurar orçamentos e tetos salariais de todos os times aos valores padrão configurados na liga
CREATE OR REPLACE FUNCTION public.reset_all_budgets()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_default_budget numeric(15, 2);
    v_default_wage_cap numeric(15, 2);
BEGIN
    -- Validar se o chamador é master
    IF NOT public.is_master() THEN
        RETURN json_build_object('success', false, 'message', 'Não autorizado! Apenas o cargo Master da Liga pode redefinir finanças em lote.');
    END IF;

    -- Obter os parâmetros de settings ou usar fallback
    SELECT coalesce((SELECT value::numeric FROM public.settings WHERE key = 'default_budget'), 50000000.00) INTO v_default_budget;
    SELECT coalesce((SELECT value::numeric FROM public.settings WHERE key = 'default_wage_cap'), 15000.00) INTO v_default_wage_cap;

    -- Redefinir valores de orçamento e teto salarial de todos os times
    UPDATE public.teams
    SET budget = v_default_budget,
        max_wage_cap = v_default_wage_cap;

    RETURN json_build_object('success', true, 'message', 'Orçamentos e limites teto de todas as equipes redefinidos para os valores padrões da liga.');
END;
$$;

-- 7. RPC para Deletar todos os clubes, históricos e contas de usuários comuns (iniciar do absoluto zero)
CREATE OR REPLACE FUNCTION public.delete_all_clubs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_users_deleted integer;
    v_teams_deleted integer;
BEGIN
    -- Validar se o chamador é master
    IF NOT public.is_master() THEN
        RETURN json_build_object('success', false, 'message', 'Não autorizado! Apenas o cargo Master da Liga pode deletar todos os clubes.');
    END IF;

    -- 1. Excluir propostas, lances de mercado, anúncios, histórico, eventos de jogos e suspensões
    DELETE FROM public.market_bids;
    DELETE FROM public.market_listings;
    DELETE FROM public.trade_players;
    DELETE FROM public.trade_offers;
    DELETE FROM public.transfer_history;
    DELETE FROM public.match_events;
    DELETE FROM public.matches;
    DELETE FROM public.league_teams;
    DELETE FROM public.suspensions;
    DELETE FROM public.notifications;

    -- 2. Devolver todos os jogadores para agentes livres (team_id = NULL)
    UPDATE public.players SET team_id = NULL;

    -- 3. Contabilizar e excluir todos os times
    SELECT count(*) INTO v_teams_deleted FROM public.teams;
    DELETE FROM public.teams;

    -- 4. Excluir contas de usuários (profiles com role = 'user') da autenticação (auth.users)
    -- Isso ativará o cascade no profile
    DELETE FROM auth.users 
    WHERE id IN (
        SELECT id FROM public.profiles WHERE role = 'user'
    );
    
    GET DIAGNOSTICS v_users_deleted = ROW_COUNT;

    RETURN json_build_object(
        'success', true, 
        'message', 'Limpeza geral concluída! ' || v_teams_deleted || ' times removidos e ' || v_users_deleted || ' contas de usuários excluídas.'
    );
END;
$$;


-- ======================================
-- SCRIPT: security_hardening.sql
-- ======================================

-- ========================================================
-- REFORÇO DE SEGURANÇA DAS POLÍTICAS RLS
-- ========================================================

-- CRÍTICO: Corrigir política de players
-- A política atual permite que QUALQUER usuário autenticado modifique jogadores
drop policy if exists "Permitir tudo para todos no players" on public.players;
drop policy if exists "Permitir tudo todos no players" on public.players;
drop policy if exists "Apenas admin modifica jogadores" on public.players;
drop policy if exists "Apenas admin atualiza jogadores" on public.players;
drop policy if exists "Apenas admin exclui jogadores" on public.players;
drop policy if exists "Leitura pública de jogadores" on public.players;

-- Leitura pública (qualquer um pode ver jogadores)
DROP POLICY IF EXISTS "Leitura pública de jogadores" ON public.players;
create policy "Leitura pública de jogadores" on public.players
    for select using (true);

-- Apenas admins podem inserir, atualizar ou deletar jogadores
DROP POLICY IF EXISTS "Apenas admin insere jogadores" ON public.players;
create policy "Apenas admin insere jogadores" on public.players
    for insert with check (public.is_admin());

DROP POLICY IF EXISTS "Apenas admin atualiza jogadores" ON public.players;
create policy "Apenas admin atualiza jogadores" on public.players
    for update using (public.is_admin());

DROP POLICY IF EXISTS "Apenas admin exclui jogadores" ON public.players;
create policy "Apenas admin exclui jogadores" on public.players
    for delete using (public.is_admin());

-- Exceção: funções RPC com SECURITY DEFINER ainda podem modificar players
-- (buy_free_agent, release_player, etc. rodam como superuser internamente)

-- Reforçar profiles: inserção apenas pelo próprio usuário ou admin
drop policy if exists "Permitir inserção de perfil pelo próprio usuário" on public.profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfil pelo próprio usuário" ON public.profiles;
create policy "Permitir inserção de perfil pelo próprio usuário" on public.profiles
    for insert with check (auth.uid() = id OR public.is_admin());

-- Reforçar teams: user_id não pode ser alterado pelo próprio usuário
-- O update fica restrito ao próprio dono ou admin
drop policy if exists "Permitir alteração do próprio time" on public.teams;
DROP POLICY IF EXISTS "Permitir alteração do próprio time" ON public.teams;
create policy "Permitir alteração do próprio time" on public.teams
    for update using (auth.uid() = user_id)
    with check (auth.uid() = user_id AND user_id = (select user_id from public.teams where id = teams.id));


-- ======================================
-- SCRIPT: shortlist_migration.sql
-- ======================================

-- Tabela de Lista de Observação (Shortlist)
CREATE TABLE IF NOT EXISTS public.shortlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES public.players(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    
    -- Evitar que o usuário adicione o mesmo jogador duas vezes
    UNIQUE(user_id, player_id)
);

-- Habilitar RLS
ALTER TABLE public.shortlists ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Usuários podem ver sua própria shortlist" ON public.shortlists;
CREATE POLICY "Usuários podem ver sua própria shortlist" 
ON public.shortlists FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem adicionar jogadores na sua shortlist" ON public.shortlists;
CREATE POLICY "Usuários podem adicionar jogadores na sua shortlist" 
ON public.shortlists FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem remover jogadores da sua shortlist" ON public.shortlists;
CREATE POLICY "Usuários podem remover jogadores da sua shortlist" 
ON public.shortlists FOR DELETE 
USING (auth.uid() = user_id);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_shortlists_user_id ON public.shortlists(user_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_player_id ON public.shortlists(player_id);


-- ======================================
-- SCRIPT: storage_policies.sql
-- ======================================

-- ========================================================
-- POLÍTICAS DE SEGURANÇA (RLS) PARA ARMAZENAMENTO (STORAGE)
-- ========================================================

-- Nota: RLS já vem habilitado por padrão em storage.objects no Supabase.
-- Não inclua a instrução "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY" pois ela exige privilégios de superusuário proprietário.


-- 1. POLÍTICAS DE LEITURA (SELECT) - Permite leitura pública dos escudos e troféus
DROP POLICY IF EXISTS "Shields públicos" ON storage.objects;
DROP POLICY IF EXISTS "Shields públicos" ON storage.objects;
CREATE POLICY "Shields públicos" ON storage.objects
    FOR SELECT USING (bucket_id = 'shields');

DROP POLICY IF EXISTS "Trophies públicos" ON storage.objects;
DROP POLICY IF EXISTS "Trophies públicos" ON storage.objects;
CREATE POLICY "Trophies públicos" ON storage.objects
    FOR SELECT USING (bucket_id = 'trophies');

-- 2. POLÍTICAS DE INSERÇÃO (INSERT)
-- Permite que administradores façam upload para 'shields' e 'trophies'.
-- Permite que usuários autenticados façam upload apenas para a pasta 'user-shields/' no bucket 'shields'.
DROP POLICY IF EXISTS "Admin upload shields" ON storage.objects;
DROP POLICY IF EXISTS "Upload de escudos" ON storage.objects;
DROP POLICY IF EXISTS "Upload de escudos" ON storage.objects;
CREATE POLICY "Upload de escudos" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (bucket_id = 'shields' AND (public.is_admin() OR name LIKE 'user-shields/%')) OR
        (bucket_id = 'trophies' AND public.is_admin())
    );

-- 3. POLÍTICAS DE ATUALIZAÇÃO (UPDATE) - CRÍTICO para upload com "upsert: true"
-- A biblioteca do Supabase exige SELECT + INSERT + UPDATE para substituir arquivos existentes (upsert).
DROP POLICY IF EXISTS "Update de escudos" ON storage.objects;
DROP POLICY IF EXISTS "Update de escudos" ON storage.objects;
CREATE POLICY "Update de escudos" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        (bucket_id = 'shields' AND (public.is_admin() OR name LIKE 'user-shields/%')) OR
        (bucket_id = 'trophies' AND public.is_admin())
    )
    WITH CHECK (
        (bucket_id = 'shields' AND (public.is_admin() OR name LIKE 'user-shields/%')) OR
        (bucket_id = 'trophies' AND public.is_admin())
    );

-- 4. POLÍTICAS DE EXCLUSÃO (DELETE)
DROP POLICY IF EXISTS "Delete de escudos" ON storage.objects;
DROP POLICY IF EXISTS "Delete de escudos" ON storage.objects;
CREATE POLICY "Delete de escudos" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        (bucket_id = 'shields' AND (public.is_admin() OR name LIKE 'user-shields/%')) OR
        (bucket_id = 'trophies' AND public.is_admin())
    );


-- ======================================
-- SCRIPT: update_gamification_features.sql
-- ======================================

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

DROP POLICY IF EXISTS "Permitir leitura de conquistas para todos" ON public.achievements;
create policy "Permitir leitura de conquistas para todos"
    on public.achievements for select using (true);

DROP POLICY IF EXISTS "Permitir tudo para admin no achievements" ON public.achievements;
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

DROP POLICY IF EXISTS "Permitir leitura das proprias notificacoes" ON public.notifications;
create policy "Permitir leitura das proprias notificacoes"
    on public.notifications for select using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Permitir atualizacao das proprias notificacoes" ON public.notifications;
create policy "Permitir atualizacao das proprias notificacoes"
    on public.notifications for update using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Permitir insercao de notificacoes" ON public.notifications;
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


-- ======================================
-- SCRIPT: update_market_features.sql
-- ======================================

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

DROP POLICY IF EXISTS "Permitir leitura de propostas de emprestimo para todos" ON public.loan_offers;
create policy "Permitir leitura de propostas de emprestimo para todos"
    on public.loan_offers for select using (true);

DROP POLICY IF EXISTS "Permitir insercao de propostas de emprestimo" ON public.loan_offers;
create policy "Permitir insercao de propostas de emprestimo"
    on public.loan_offers for insert with check (
        exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = sender_team_id)
    );

DROP POLICY IF EXISTS "Permitir atualizacao de propostas de emprestimo" ON public.loan_offers;
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

DROP POLICY IF EXISTS "Permitir leitura de mensagens para os envolvidos" ON public.negotiation_messages;
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

DROP POLICY IF EXISTS "Permitir insercao de mensagens para os envolvidos" ON public.negotiation_messages;
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


-- ======================================
-- SCRIPT: update_profile_negotiations.sql
-- ======================================

-- 1. Adicionar colunas necessárias
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS formation text DEFAULT '4-3-3';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cup_name text;

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
DROP POLICY IF EXISTS "Permitir leitura do historico para todos" ON public.transfer_history;
CREATE POLICY "Permitir leitura do historico para todos" ON public.transfer_history 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao pelo sistema/funcoes" ON public.transfer_history;
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
DROP POLICY IF EXISTS "Permitir leitura de settings para todos" ON public.settings;
CREATE POLICY "Permitir leitura de settings para todos" ON public.settings 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir tudo para admin no settings" ON public.settings;
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


-- ======================================
-- SCRIPT: update_rls_security.sql
-- ======================================

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
DROP POLICY IF EXISTS "Permitir leitura para todos no players" ON public.players;
create policy "Permitir leitura para todos no players"
    on public.players for select
    using (true);

DROP POLICY IF EXISTS "Permitir tudo para admin no players" ON public.players;
create policy "Permitir tudo para admin no players"
    on public.players for all
    using (public.is_admin());


-- 2. Restrição de RLS em `matches` por Time envolvido
drop policy if exists "Permitir atualização de partidas" on public.matches;
drop policy if exists "Permitir tudo para admin no matches" on public.matches;

DROP POLICY IF EXISTS "Permitir atualização de partidas por times envolvidos" ON public.matches;
create policy "Permitir atualização de partidas por times envolvidos"
    on public.matches for update
    using (
        exists (
            select 1 from public.teams t
            where t.user_id = auth.uid()
            and (t.id = home_team_id or t.id = away_team_id)
        )
    );

DROP POLICY IF EXISTS "Permitir tudo para admin no matches" ON public.matches;
create policy "Permitir tudo para admin no matches"
    on public.matches for all
    using (public.is_admin());


-- 3. Restrição de RLS na inserção e exclusão de `match_events` por time envolvido
drop policy if exists "Permitir inserção de eventos de partidas" on public.match_events;
drop policy if exists "Permitir exclusão de eventos de partidas" on public.match_events;
drop policy if exists "Permitir tudo para admin no match_events" on public.match_events;

DROP POLICY IF EXISTS "Permitir inserção de eventos por times envolvidos" ON public.match_events;
create policy "Permitir inserção de eventos por times envolvidos"
    on public.match_events for insert
    with check (
        exists (
            select 1 from public.matches m
            join public.teams t on (t.id = m.home_team_id or t.id = m.away_team_id)
            where m.id = match_id and t.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Permitir exclusão de eventos por times envolvidos" ON public.match_events;
create policy "Permitir exclusão de eventos por times envolvidos"
    on public.match_events for delete
    using (
        exists (
            select 1 from public.matches m
            join public.teams t on (t.id = m.home_team_id or t.id = m.away_team_id)
            where m.id = match_id and t.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Permitir tudo para admin no match_events" ON public.match_events;
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


-- ======================================
-- SCRIPT: update_season_phases.sql
-- ======================================

-- =========================================================================
-- MIGRAÇÃO PARA FASES DO CAMPEONATO & COBRANÇA FINANCEIRA DE SALÁRIOS
-- Cole este script no SQL Editor do Supabase para criar a função de débito.
-- =========================================================================

-- 1. Nova Função RPC para cobrar salários personalizados em lote
CREATE OR REPLACE FUNCTION public.deduct_custom_salaries(p_team_ids uuid[], p_amounts numeric[], p_rounds_label text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i integer;
    v_team_id uuid;
    v_amount numeric(15,2);
    v_team_name text;
    v_user_id uuid;
    v_count integer := 0;
BEGIN
    -- Validar se o usuário que está chamando é admin
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Não autorizado! Apenas administradores podem deduzir salários.');
    END IF;

    -- Iterar pelos arrays correspondentes de times e valores
    FOR i IN 1 .. array_length(p_team_ids, 1) LOOP
        v_team_id := p_team_ids[i];
        v_amount := p_amounts[i];

        IF v_amount IS NOT NULL AND v_amount > 0 THEN
            SELECT name, user_id INTO v_team_name, v_user_id FROM public.teams WHERE id = v_team_id;

            IF v_team_name IS NOT NULL THEN
                -- Descontar a verba do orçamento de transferências do time
                UPDATE public.teams
                SET budget = budget - v_amount
                WHERE id = v_team_id;

                v_count := v_count + 1;

                -- Inserir notificação amigável para o técnico do time
                IF v_user_id IS NOT NULL THEN
                    INSERT INTO public.notifications (user_id, title, content, read)
                    VALUES (
                        v_user_id,
                        'Balanço Financeiro (Salários)',
                        'O orçamento de transferências do seu time foi debitado em R$ ' || to_char(v_amount, 'FM999G999G990D00') || ' referente ao pagamento de salários do elenco na temporada (' || p_rounds_label || ').',
                        false
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'message', 'Balanço financeiro concluído! Débito efetuado com sucesso para ' || v_count || ' equipes.'
    );
END;
$$;

-- 2. Inserir configurações iniciais padrão de fases (se já não existirem)
INSERT INTO public.settings (key, value) VALUES
    ('season_stage', 'first_half'),
    ('season_rounds_per_half', '10')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ======================================
-- SCRIPT: update_tactical_lineup.sql
-- ======================================

-- ========================================================
-- FASE 3: ESCALAÇÃO MANUAL & BANCO TÁTICO
-- ========================================================

-- 1. Adicionar coluna lineup (jsonb) na tabela teams para persistir a escalação
alter table public.teams add column if not exists lineup jsonb default '[]'::jsonb;

-- Nota: O formato salvo em lineup será uma array JSON com os IDs dos 11 jogadores titulares.
-- Exemplo: [158023, 208012, 182039, ...]
-- Os suplentes/reservas serão calculados automaticamente como os jogadores do elenco que NÃO estão nesta array.
