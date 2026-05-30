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
