-- ========================================================
-- REFORÇO DE SEGURANÇA DAS POLÍTICAS RLS
-- ========================================================

-- CRÍTICO: Corrigir política de players
-- A política atual permite que QUALQUER usuário autenticado modifique jogadores
drop policy if exists "Permitir tudo para todos no players" on public.players;
drop policy if exists "Permitir tudo todos no players" on public.players;
drop policy if exists "Apenas admin modifica jogadores" on public.players;
drop policy if exists "Apenas admin atualiza jogadores" on public.players;
drop policy if exists "Apenas admin exclui jogadores" on public.players;
drop policy if exists "Leitura pública de jogadores" on public.players;

-- Leitura pública (qualquer um pode ver jogadores)
create policy "Leitura pública de jogadores" on public.players
    for select using (true);

-- Apenas admins podem inserir, atualizar ou deletar jogadores
create policy "Apenas admin insere jogadores" on public.players
    for insert with check (public.is_admin());

create policy "Apenas admin atualiza jogadores" on public.players
    for update using (public.is_admin());

create policy "Apenas admin exclui jogadores" on public.players
    for delete using (public.is_admin());

-- Exceção: funções RPC com SECURITY DEFINER ainda podem modificar players
-- (buy_free_agent, release_player, etc. rodam como superuser internamente)

-- Reforçar profiles: inserção apenas pelo próprio usuário ou admin
drop policy if exists "Permitir inserção de perfil pelo próprio usuário" on public.profiles;
create policy "Permitir inserção de perfil pelo próprio usuário" on public.profiles
    for insert with check (auth.uid() = id OR public.is_admin());

-- Reforçar teams: user_id não pode ser alterado pelo próprio usuário
-- O update fica restrito ao próprio dono ou admin
drop policy if exists "Permitir alteração do próprio time" on public.teams;
create policy "Permitir alteração do próprio time" on public.teams
    for update using (auth.uid() = user_id)
    with check (auth.uid() = user_id AND user_id = (select user_id from public.teams where id = teams.id));
