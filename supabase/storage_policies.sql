-- ========================================================
-- POLÍTICAS DE SEGURANÇA (RLS) PARA ARMAZENAMENTO (STORAGE)
-- ========================================================

-- Nota: RLS já vem habilitado por padrão em storage.objects no Supabase.
-- Não inclua a instrução "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY" pois ela exige privilégios de superusuário proprietário.


-- 1. POLÍTICAS DE LEITURA (SELECT) - Permite leitura pública dos escudos e troféus
DROP POLICY IF EXISTS "Shields públicos" ON storage.objects;
CREATE POLICY "Shields públicos" ON storage.objects
    FOR SELECT USING (bucket_id = 'shields');

DROP POLICY IF EXISTS "Trophies públicos" ON storage.objects;
CREATE POLICY "Trophies públicos" ON storage.objects
    FOR SELECT USING (bucket_id = 'trophies');

-- 2. POLÍTICAS DE INSERÇÃO (INSERT)
-- Permite que administradores façam upload para 'shields' e 'trophies'.
-- Permite que usuários autenticados façam upload apenas para a pasta 'user-shields/' no bucket 'shields'.
DROP POLICY IF EXISTS "Admin upload shields" ON storage.objects;
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
CREATE POLICY "Delete de escudos" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        (bucket_id = 'shields' AND (public.is_admin() OR name LIKE 'user-shields/%')) OR
        (bucket_id = 'trophies' AND public.is_admin())
    );
