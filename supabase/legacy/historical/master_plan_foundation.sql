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
CREATE POLICY "Permitir leitura para todos em rounds" ON public.rounds FOR SELECT USING (true);
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
CREATE POLICY "Apenas admin pode ler logs" ON public.audit_logs FOR SELECT USING (public.is_admin());
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
CREATE POLICY "Permitir leitura para todos em stats_history" ON public.player_stats_history FOR SELECT USING (true);
CREATE POLICY "Permitir tudo para admin em stats_history" ON public.player_stats_history FOR ALL USING (public.is_admin());
