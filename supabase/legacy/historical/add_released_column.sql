-- Adiciona a coluna released na tabela de partidas para suportar o recurso de "Liberar Rodada"
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS released BOOLEAN NOT NULL DEFAULT false;

-- Opcional: Para evitar que os técnicos vejam as partidas antes da hora, atualize o RLS:
-- (Apenas se a funcionalidade de esconder partidas não liberadas estiver ativa)
-- CREATE POLICY "Ocultar partidas nao liberadas" ON public.matches 
-- FOR SELECT USING (released = true OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
