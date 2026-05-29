-- ========================================================
-- ATUALIZAÇÕES DE RLS (ROW LEVEL SECURITY)
-- ========================================================

-- Função auxiliar para checar se o usuário é admin
create or replace function public.is_admin()
returns boolean as $$
begin
    return exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
end;
$$ language plpgsql security definer;

-- 0. Políticas para PROFILES (Perfis)
drop policy if exists "Permitir inserção de perfil pelo próprio usuário" on public.profiles;
create policy "Permitir inserção de perfil pelo próprio usuário" on public.profiles for insert with check (auth.uid() = id);

-- 1. Políticas para TEAMS (Times)
drop policy if exists "Permitir inserção do próprio time" on public.teams;
drop policy if exists "Permitir tudo para admin no teams" on public.teams;
create policy "Permitir inserção do próprio time" on public.teams for insert with check (auth.uid() = user_id);
create policy "Permitir tudo para admin no teams" on public.teams for all using (public.is_admin());

-- 2. Políticas para MATCH_EVENTS (Eventos de Partidas)
drop policy if exists "Permitir inserção de eventos de partidas" on public.match_events;
drop policy if exists "Permitir exclusão de eventos de partidas" on public.match_events;
drop policy if exists "Permitir tudo para admin no match_events" on public.match_events;
create policy "Permitir inserção de eventos de partidas" on public.match_events for insert with check (auth.uid() is not null);
create policy "Permitir exclusão de eventos de partidas" on public.match_events for delete using (auth.uid() is not null);
create policy "Permitir tudo para admin no match_events" on public.match_events for all using (public.is_admin());

-- 3. Políticas para MATCHES (Partidas)
drop policy if exists "Permitir atualização de partidas" on public.matches;
drop policy if exists "Permitir tudo para admin no matches" on public.matches;
create policy "Permitir atualização de partidas" on public.matches for update using (auth.uid() is not null);
create policy "Permitir tudo para admin no matches" on public.matches for all using (public.is_admin());

-- 4. Políticas para MARKET_LISTINGS (Anúncios do Mercado)
drop policy if exists "Permitir inserção de anúncios no mercado" on public.market_listings;
drop policy if exists "Permitir atualização de anúncios no mercado" on public.market_listings;
drop policy if exists "Permitir tudo para admin no market_listings" on public.market_listings;
create policy "Permitir inserção de anúncios no mercado" on public.market_listings for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = seller_team_id));
create policy "Permitir atualização de anúncios no mercado" on public.market_listings for update using (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = seller_team_id));
create policy "Permitir tudo para admin no market_listings" on public.market_listings for all using (public.is_admin());

-- 5. Políticas para MARKET_BIDS (Lances de Leilão)
drop policy if exists "Permitir inserção de lances no mercado" on public.market_bids;
drop policy if exists "Permitir tudo para admin no market_bids" on public.market_bids;
create policy "Permitir inserção de lances no mercado" on public.market_bids for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = bidder_team_id));
create policy "Permitir tudo para admin no market_bids" on public.market_bids for all using (public.is_admin());

-- 6. Políticas para TRADE_OFFERS (Propostas de Trocas)
drop policy if exists "Permitir inserção de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir atualização de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir tudo para admin no trade_offers" on public.trade_offers;
create policy "Permitir inserção de propostas de trocas" on public.trade_offers for insert with check (exists (select 1 from public.teams t where t.user_id = auth.uid() and t.id = sender_team_id));
create policy "Permitir atualização de propostas de trocas" on public.trade_offers for update using (exists (select 1 from public.teams t where t.user_id = auth.uid() and (t.id = sender_team_id or t.id = receiver_team_id)));
create policy "Permitir tudo para admin no trade_offers" on public.trade_offers for all using (public.is_admin());

-- 7. Políticas para TRADE_PLAYERS (Jogadores na Troca)
drop policy if exists "Permitir inserção de jogadores na troca" on public.trade_players;
drop policy if exists "Permitir tudo para admin no trade_players" on public.trade_players;
create policy "Permitir inserção de jogadores na troca" on public.trade_players for insert with check (auth.uid() is not null);
create policy "Permitir tudo para admin no trade_players" on public.trade_players for all using (public.is_admin());

-- 8. Políticas de Admin para outras tabelas
drop policy if exists "Permitir tudo para admin no seasons" on public.seasons;
drop policy if exists "Permitir tudo para admin no leagues" on public.leagues;
drop policy if exists "Permitir tudo para admin no league_teams" on public.league_teams;
drop policy if exists "Permitir tudo para admin no players" on public.players;
drop policy if exists "Permitir tudo para admin no suspensions" on public.suspensions;
drop policy if exists "Permitir tudo para admin no profiles" on public.profiles;

create policy "Permitir tudo para admin no seasons" on public.seasons for all using (public.is_admin());
create policy "Permitir tudo para admin no leagues" on public.leagues for all using (public.is_admin());
create policy "Permitir tudo para admin no league_teams" on public.league_teams for all using (public.is_admin());
drop policy if exists "Permitir leitura para todos" on public.players;
drop policy if exists "Permitir tudo para todos no players" on public.players;
create policy "Permitir tudo para todos no players" on public.players for all using (true) with check (true);
create policy "Permitir tudo para admin no suspensions" on public.suspensions for all using (public.is_admin());
create policy "Permitir tudo para admin no profiles" on public.profiles for all using (public.is_admin());
