-- ========================================================
-- FASE 3: ESCALAÇÃO MANUAL & BANCO TÁTICO
-- ========================================================

-- 1. Adicionar coluna lineup (jsonb) na tabela teams para persistir a escalação
alter table public.teams add column if not exists lineup jsonb default '[]'::jsonb;

-- Nota: O formato salvo em lineup será uma array JSON com os IDs dos 11 jogadores titulares.
-- Exemplo: [158023, 208012, 182039, ...]
-- Os suplentes/reservas serão calculados automaticamente como os jogadores do elenco que NÃO estão nesta array.
