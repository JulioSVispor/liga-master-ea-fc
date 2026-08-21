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
CREATE POLICY "Usuários podem ver sua própria shortlist" 
ON public.shortlists FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem adicionar jogadores na sua shortlist" 
ON public.shortlists FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem remover jogadores da sua shortlist" 
ON public.shortlists FOR DELETE 
USING (auth.uid() = user_id);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_shortlists_user_id ON public.shortlists(user_id);
CREATE INDEX IF NOT EXISTS idx_shortlists_player_id ON public.shortlists(player_id);
