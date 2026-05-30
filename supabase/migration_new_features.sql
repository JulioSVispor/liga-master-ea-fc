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
CREATE POLICY "Leitura pública settings" ON public.settings FOR SELECT USING (true);
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
CREATE POLICY "Leitura trophies" ON public.trophies FOR SELECT USING (true);
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
CREATE POLICY "Leitura team_trophies" ON public.team_trophies FOR SELECT USING (true);
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
CREATE POLICY "Leitura sponsorships" ON public.sponsorships FOR SELECT USING (true);
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
CREATE POLICY "Leitura loans" ON public.loans FOR SELECT USING (true);
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
CREATE POLICY "Shields públicos" ON storage.objects FOR SELECT USING (bucket_id = 'shields');
DROP POLICY IF EXISTS "Admin upload shields" ON storage.objects;
CREATE POLICY "Admin upload shields" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('shields','trophies'));
DROP POLICY IF EXISTS "Trophies públicos" ON storage.objects;
CREATE POLICY "Trophies públicos" ON storage.objects FOR SELECT USING (bucket_id = 'trophies');
