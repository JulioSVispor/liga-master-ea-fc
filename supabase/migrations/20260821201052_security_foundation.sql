begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'master')
  );
$$;

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'master'
  );
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_master() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_master() to authenticated;

-- Funções legadas permanecem revogadas até serem substituídas. Fixar o
-- search_path reduz a superfície caso uma assinatura seja reativada por engano.
do $migration$
declare v_function record;
begin
  for v_function in
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef
  loop
    execute format($sql$alter function %I.%I(%s) set search_path = ''$sql$,
                   v_function.nspname,v_function.proname,v_function.arguments);
  end loop;
end
$migration$;

do $migration$
begin
  if to_regclass('public.view_players_career_stats') is not null then
    execute 'alter view public.view_players_career_stats set (security_invoker = true)';
  end if;
end
$migration$;

drop view if exists public.public_profiles;
create table if not exists public.public_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text,
  avatar_url text
);

drop view if exists public.team_directory;
create table if not exists public.team_directory (
  id uuid primary key references public.teams(id) on delete cascade,
  name text not null,
  real_club_name text not null,
  badge_url text,
  uniform_url text,
  coach_name text
);
alter table public.team_directory add column if not exists coach_name text;

insert into public.public_profiles (id, display_name, avatar_url)
select p.id, p.display_name, p.avatar_url from public.profiles p
on conflict (id) do update
set display_name = excluded.display_name, avatar_url = excluded.avatar_url;

insert into public.team_directory (id, name, real_club_name, badge_url, uniform_url, coach_name)
select t.id, t.name, t.real_club_name, t.badge_url, t.uniform_url, p.display_name
from public.teams t left join public.profiles p on p.id=t.user_id
on conflict (id) do update
set name = excluded.name,
    real_club_name = excluded.real_club_name,
    badge_url = excluded.badge_url,
    uniform_url = excluded.uniform_url,
    coach_name = excluded.coach_name;

create or replace function private.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.public_profiles (id, display_name, avatar_url)
  values (new.id, new.display_name, new.avatar_url)
  on conflict (id) do update
  set display_name = excluded.display_name, avatar_url = excluded.avatar_url;
  update public.team_directory d set coach_name=new.display_name
   from public.teams t where t.id=d.id and t.user_id=new.id;
  return new;
end;
$$;

create or replace function private.sync_team_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_directory (id, name, real_club_name, badge_url, uniform_url, coach_name)
  values (new.id, new.name, new.real_club_name, new.badge_url, new.uniform_url,
          (select p.display_name from public.profiles p where p.id=new.user_id))
  on conflict (id) do update
  set name = excluded.name,
      real_club_name = excluded.real_club_name,
      badge_url = excluded.badge_url,
      uniform_url = excluded.uniform_url,
      coach_name = excluded.coach_name;
  return new;
end;
$$;

drop trigger if exists sync_public_profile_after_write on public.profiles;
create trigger sync_public_profile_after_write
after insert or update of display_name, avatar_url on public.profiles
for each row execute function private.sync_public_profile();

drop trigger if exists sync_team_directory_after_write on public.teams;
create trigger sync_team_directory_after_write
after insert or update of name, real_club_name, badge_url, uniform_url on public.teams
for each row execute function private.sync_team_directory();

alter table public.public_profiles enable row level security;
alter table public.team_directory enable row level security;
create policy public_profiles_read on public.public_profiles for select to anon, authenticated using (true);
create policy team_directory_read on public.team_directory for select to anon, authenticated using (true);

revoke all on public.public_profiles, public.team_directory from public, anon, authenticated;
grant select on public.public_profiles, public.team_directory to anon, authenticated;
revoke all on function private.sync_public_profile() from public, anon, authenticated;
revoke all on function private.sync_team_directory() from public, anon, authenticated;

create or replace view public.match_schedule
with (security_invoker = true)
as
select m.*,
  jsonb_build_object('id',h.id,'name',h.name,'badge_url',h.badge_url,'real_club_name',h.real_club_name) as home_team,
  jsonb_build_object('id',a.id,'name',a.name,'badge_url',a.badge_url,'real_club_name',a.real_club_name) as away_team,
  jsonb_build_object('name',s.name) as seasons,
  case when l.id is null then null else jsonb_build_object('name',l.name) end as leagues,
  case when p.id is null then null else jsonb_build_object('id',p.id,'name',p.name) end as motm_player
from public.matches m
join public.team_directory h on h.id=m.home_team_id
join public.team_directory a on a.id=m.away_team_id
join public.seasons s on s.id=m.season_id
left join public.leagues l on l.id=m.league_id
left join public.players p on p.id=m.motm_player_id;

create or replace view public.market_catalog
with (security_invoker = true)
as
select ml.*,
  to_jsonb(p) as players,
  case when d.id is null then null else jsonb_build_object('id',d.id,'name',d.name,'badge_url',d.badge_url) end as teams
from public.market_listings ml
join public.players p on p.id=ml.player_id
left join public.team_directory d on d.id=ml.seller_team_id;

revoke all on public.match_schedule,public.market_catalog from public,anon,authenticated;
grant select on public.match_schedule,public.market_catalog to authenticated;

-- Perfis: dados privados somente para o titular ou administração.
alter table public.profiles enable row level security;
drop policy if exists "Permitir alteração de si mesmo" on public.profiles;
drop policy if exists "Permitir inserção de perfil pelo próprio usuário" on public.profiles;
drop policy if exists "Permitir leitura para todos" on public.profiles;
drop policy if exists "Permitir tudo para admin no profiles" on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

-- Clubes: o diretório público é a única leitura compartilhada. Orçamento e
-- teto ficam limitados ao proprietário e à administração.
alter table public.teams enable row level security;
drop policy if exists "Permitir alteração do próprio time" on public.teams;
drop policy if exists "Permitir inserção do próprio time" on public.teams;
drop policy if exists "Permitir leitura para todos" on public.teams;
drop policy if exists "Permitir tudo para admin no teams" on public.teams;
create policy teams_select_owner_or_admin
  on public.teams for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

-- Configurações são legíveis, mas nenhuma tabela aceita escrita direta.
alter table public.settings enable row level security;
drop policy if exists "Escrita settings" on public.settings;
drop policy if exists "Leitura pública settings" on public.settings;
drop policy if exists "Permitir leitura de settings para todos" on public.settings;
drop policy if exists "Permitir tudo para admin no settings" on public.settings;
create policy settings_read
  on public.settings for select to anon, authenticated using (true);

-- Negociações e empréstimos: apenas envolvidos ou administradores.
drop policy if exists "Permitir leitura para todos" on public.trade_offers;
drop policy if exists "Permitir leitura de propostas de emprestimo para todos" on public.loan_offers;
drop policy if exists "Permitir inserção de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir atualização de propostas de trocas" on public.trade_offers;
drop policy if exists "Permitir insercao de propostas de emprestimo" on public.loan_offers;
drop policy if exists "Permitir atualizacao de propostas de emprestimo" on public.loan_offers;
drop policy if exists "Permitir tudo para admin no trade_offers" on public.trade_offers;

create policy trade_offers_select_involved
  on public.trade_offers for select to authenticated
  using (
    (select public.is_admin()) or exists (
      select 1 from public.teams t
      where t.user_id = (select auth.uid())
        and t.id in (trade_offers.sender_team_id, trade_offers.receiver_team_id)
    )
  );

create policy loan_offers_select_involved
  on public.loan_offers for select to authenticated
  using (
    (select public.is_admin()) or exists (
      select 1 from public.teams t
      where t.user_id = (select auth.uid())
        and t.id in (loan_offers.sender_team_id, loan_offers.receiver_team_id)
    )
  );

drop policy if exists "Permitir leitura para todos" on public.trade_players;
drop policy if exists "Permitir inserção de jogadores na troca" on public.trade_players;
drop policy if exists "Permitir tudo para admin no trade_players" on public.trade_players;
create policy trade_players_select_involved
  on public.trade_players for select to authenticated
  using (
    (select public.is_admin()) or exists (
      select 1
      from public.trade_offers o
      join public.teams t on t.id in (o.sender_team_id, o.receiver_team_id)
      where o.id = trade_players.trade_offer_id
        and t.user_id = (select auth.uid())
    )
  );

drop policy if exists "Permitir insercao de mensagens para os envolvidos" on public.negotiation_messages;
-- A leitura existente já é restrita aos envolvidos; a escrita passa a RPC.

drop policy if exists "Permitir insercao de notificacoes" on public.notifications;
drop policy if exists "Permitir insercao pelo sistema/funcoes" on public.transfer_history;

drop policy if exists "Permitir inserção de notícias do mercado" on public.market_news;
drop policy if exists "Permitir insercao de noticias do mercado" on public.market_news;

create or replace function public.update_own_profile(
  p_display_name text,
  p_avatar_url text default null,
  p_whatsapp text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if nullif(btrim(p_display_name), '') is null then raise exception 'Nome obrigatório' using errcode = '22023'; end if;

  update public.profiles
     set display_name = left(btrim(p_display_name), 80),
         avatar_url = coalesce(nullif(btrim(p_avatar_url), ''), avatar_url),
         whatsapp = nullif(btrim(p_whatsapp), '')
   where id = auth.uid()
   returning * into v_profile;

  if not found then raise exception 'Perfil não encontrado' using errcode = 'P0002'; end if;
  return v_profile;
end;
$$;

create or replace function public.update_team_identity(
  p_badge_url text default null,
  p_uniform_url text default null
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  update public.teams
     set badge_url = coalesce(nullif(btrim(p_badge_url), ''), badge_url),
         uniform_url = coalesce(nullif(btrim(p_uniform_url), ''), uniform_url)
   where user_id = auth.uid()
   returning * into v_team;
  if not found then raise exception 'Clube não encontrado' using errcode = 'P0002'; end if;
  return v_team;
end;
$$;

create or replace function public.update_team_profile(
  p_name text,p_real_club_name text,p_badge_url text default null,p_uniform_url text default null
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare v_team public.teams;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if nullif(btrim(p_name),'') is null or nullif(btrim(p_real_club_name),'') is null then raise exception 'Nome do clube obrigatório' using errcode='22023'; end if;
  update public.teams set
    name=left(btrim(p_name),80),real_club_name=left(btrim(p_real_club_name),120),
    badge_url=coalesce(nullif(btrim(p_badge_url),''),badge_url),
    uniform_url=coalesce(nullif(btrim(p_uniform_url),''),uniform_url)
  where user_id=auth.uid() returning * into v_team;
  if not found then raise exception 'Clube não encontrado' using errcode='P0002'; end if;
  return v_team;
end;
$$;

create or replace function public.update_team_tactics(p_formation text, p_lineup jsonb)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if p_formation not in ('4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2') then
    raise exception 'Formação inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_lineup, '[]'::jsonb)) <> 'array' then
    raise exception 'Escalação inválida' using errcode = '22023';
  end if;
  update public.teams
     set formation = p_formation, lineup = coalesce(p_lineup, '[]'::jsonb)
   where user_id = auth.uid()
   returning * into v_team;
  if not found then raise exception 'Clube não encontrado' using errcode = 'P0002'; end if;
  return v_team;
end;
$$;

revoke all on function public.update_own_profile(text,text,text) from public, anon;
revoke all on function public.update_team_identity(text,text) from public, anon;
revoke all on function public.update_team_profile(text,text,text,text) from public, anon;
revoke all on function public.update_team_tactics(text,jsonb) from public, anon;
grant execute on function public.update_own_profile(text,text,text) to authenticated;
grant execute on function public.update_team_identity(text,text) to authenticated;
grant execute on function public.update_team_profile(text,text,text,text) to authenticated;
grant execute on function public.update_team_tactics(text,jsonb) to authenticated;

grant select on public.profiles, public.teams, public.settings,
  public.trade_offers, public.trade_players, public.loan_offers,
  public.negotiation_messages, public.notifications, public.transfer_history
to authenticated;

commit;
