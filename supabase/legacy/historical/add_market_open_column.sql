-- Garante que a coluna market_open existe na tabela seasons
ALTER TABLE public.seasons
ADD COLUMN IF NOT EXISTS market_open BOOLEAN NOT NULL DEFAULT false;
