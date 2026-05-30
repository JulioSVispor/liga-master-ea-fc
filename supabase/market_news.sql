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
CREATE POLICY "Permitir leitura de noticias para todos" ON public.market_news
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao apenas para admins ou sistema" ON public.market_news;
CREATE POLICY "Permitir insercao apenas para admins ou sistema" ON public.market_news
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        ) OR auth.uid() IS NULL -- Permite que as triggers do banco executem inserções
    );

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
