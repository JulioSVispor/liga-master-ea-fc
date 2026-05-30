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
