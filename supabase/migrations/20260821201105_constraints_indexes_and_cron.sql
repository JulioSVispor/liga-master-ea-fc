begin;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='teams_budget_nonnegative') then
    alter table public.teams add constraint teams_budget_nonnegative check(budget>=0) not valid;
    alter table public.teams validate constraint teams_budget_nonnegative;
  end if;
  if not exists(select 1 from pg_constraint where conname='teams_wage_cap_nonnegative') then
    alter table public.teams add constraint teams_wage_cap_nonnegative check(max_wage_cap>=0) not valid;
    alter table public.teams validate constraint teams_wage_cap_nonnegative;
  end if;
  if not exists(select 1 from pg_constraint where conname='players_financial_values_nonnegative') then
    alter table public.players add constraint players_financial_values_nonnegative check(wage>=0 and value>=0 and (buyout_clause is null or buyout_clause>=0)) not valid;
    alter table public.players validate constraint players_financial_values_nonnegative;
  end if;
  if not exists(select 1 from pg_constraint where conname='matches_distinct_teams') then
    alter table public.matches add constraint matches_distinct_teams check(home_team_id<>away_team_id) not valid;
    alter table public.matches validate constraint matches_distinct_teams;
  end if;
  if not exists(select 1 from pg_constraint where conname='matches_scores_nonnegative') then
    alter table public.matches add constraint matches_scores_nonnegative check((home_score is null or home_score>=0) and (away_score is null or away_score>=0)) not valid;
    alter table public.matches validate constraint matches_scores_nonnegative;
  end if;
  if not exists(select 1 from pg_constraint where conname='market_listing_values_valid') then
    alter table public.market_listings add constraint market_listing_values_valid check(price>0 and (buyout_price is null or buyout_price>=price)) not valid;
    alter table public.market_listings validate constraint market_listing_values_valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='market_bid_amount_positive') then
    alter table public.market_bids add constraint market_bid_amount_positive check(bid_amount>0) not valid;
    alter table public.market_bids validate constraint market_bid_amount_positive;
  end if;
  if not exists(select 1 from pg_constraint where conname='trade_money_nonnegative') then
    alter table public.trade_offers add constraint trade_money_nonnegative check(offered_money>=0 and requested_money>=0) not valid;
    alter table public.trade_offers validate constraint trade_money_nonnegative;
  end if;
  if not exists(select 1 from pg_constraint where conname='trade_distinct_teams') then
    alter table public.trade_offers add constraint trade_distinct_teams check(sender_team_id<>receiver_team_id) not valid;
    alter table public.trade_offers validate constraint trade_distinct_teams;
  end if;
  if not exists(select 1 from pg_constraint where conname='loan_offer_values_valid') then
    alter table public.loan_offers add constraint loan_offer_values_valid check(sender_team_id<>receiver_team_id and salary_share_pct between 0 and 100 and duration_weeks between 1 and 52) not valid;
    alter table public.loan_offers validate constraint loan_offer_values_valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='financial_transaction_arithmetic') then
    alter table public.financial_transactions add constraint financial_transaction_arithmetic check(balance_before+amount=balance_after and balance_before>=0 and balance_after>=0) not valid;
    alter table public.financial_transactions validate constraint financial_transaction_arithmetic;
  end if;
end $$;

create unique index if not exists market_listings_one_active_per_player
  on public.market_listings(player_id) where status='active';
create unique index if not exists market_bids_one_pending_per_listing
  on public.market_bids(market_listing_id) where status='pending';
create unique index if not exists trade_players_unique_player_per_offer
  on public.trade_players(trade_offer_id,player_id);

create index if not exists matches_season_id_idx on public.matches(season_id);
create index if not exists matches_league_id_idx on public.matches(league_id);
create index if not exists matches_home_team_id_idx on public.matches(home_team_id);
create index if not exists matches_away_team_id_idx on public.matches(away_team_id);
create index if not exists matches_round_id_idx on public.matches(round_id);
create index if not exists match_events_match_id_idx on public.match_events(match_id);
create index if not exists match_events_team_id_idx on public.match_events(team_id);
create index if not exists match_events_player_id_idx on public.match_events(player_id);
create index if not exists league_teams_team_id_idx on public.league_teams(team_id);
create index if not exists market_listings_seller_team_id_idx on public.market_listings(seller_team_id);
create index if not exists market_bids_bidder_team_id_idx on public.market_bids(bidder_team_id);
create index if not exists trade_offers_sender_team_id_idx on public.trade_offers(sender_team_id);
create index if not exists trade_offers_receiver_team_id_idx on public.trade_offers(receiver_team_id);
create index if not exists trade_players_player_id_idx on public.trade_players(player_id);
create index if not exists loan_offers_sender_team_id_idx on public.loan_offers(sender_team_id);
create index if not exists loan_offers_receiver_team_id_idx on public.loan_offers(receiver_team_id);
create index if not exists loan_offers_player_id_idx on public.loan_offers(player_id);
create index if not exists financial_transactions_team_created_idx on public.financial_transactions(team_id,created_at desc);

-- Garante cobertura para FKs futuras e atuais sem depender do nome do índice.
do $migration$
declare v_fk record; v_columns text; v_index_name text;
begin
  for v_fk in
    select c.oid,c.conrelid,n.nspname,t.relname,c.conname,c.conkey
      from pg_constraint c
      join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
     where c.contype='f' and n.nspname='public'
       and not exists(
         select 1 from pg_index i
          where i.indrelid=c.conrelid and i.indisvalid
            and (i.indkey::smallint[] @> c.conkey)
       )
  loop
    select string_agg(quote_ident(a.attname),',' order by u.ordinality)
      into v_columns
      from unnest(v_fk.conkey) with ordinality u(attnum,ordinality)
      join pg_attribute a on a.attrelid=v_fk.conrelid and a.attnum=u.attnum;
    v_index_name:=left('idx_'||v_fk.relname||'_'||replace(v_fk.conname,'_fkey','')||'_fk',63);
    execute format('create index if not exists %I on %I.%I (%s)',v_index_name,v_fk.nspname,v_fk.relname,v_columns);
  end loop;
end
$migration$;

create or replace function private.prevent_financial_transaction_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'O ledger financeiro é imutável' using errcode='55000';
end;
$$;
drop trigger if exists financial_transactions_immutable on public.financial_transactions;
create trigger financial_transactions_immutable
before update or delete on public.financial_transactions
for each row execute function private.prevent_financial_transaction_mutation();
revoke all on function private.prevent_financial_transaction_mutation() from public,anon,authenticated;

create or replace function public.close_due_auctions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_listing public.market_listings; v_bid public.market_bids; v_buyer public.teams; v_seller public.teams; v_player public.players; v_closed integer:=0;
begin
  for v_listing in
    select * from public.market_listings
     where status='active' and listing_type='auction' and end_date<=now()
     order by end_date,id for update skip locked
  loop
    loop
      select * into v_bid from public.market_bids
       where market_listing_id=v_listing.id and status='pending'
       order by bid_amount desc,created_at asc for update skip locked limit 1;
      if not found then
        update public.market_listings set status='expired' where id=v_listing.id;
        v_closed:=v_closed+1;
        exit;
      end if;
      perform 1 from public.teams where id in(v_bid.bidder_team_id,v_listing.seller_team_id) order by id for update;
      select * into v_buyer from public.teams where id=v_bid.bidder_team_id;
      select * into v_seller from public.teams where id=v_listing.seller_team_id;
      select * into v_player from public.players where id=v_listing.player_id for update;
      if v_player.team_id<>v_listing.seller_team_id or v_buyer.budget<v_bid.bid_amount or private.team_wages(v_buyer.id)+v_player.wage>v_buyer.max_wage_cap then
        update public.market_bids set status='outbid' where id=v_bid.id;
        continue;
      end if;
      update public.teams set budget=budget-v_bid.bid_amount where id=v_buyer.id;
      update public.teams set budget=budget+v_bid.bid_amount where id=v_seller.id;
      update public.players set team_id=v_buyer.id,original_team_id=null,loan_expires_at=null,loan_salary_pct_dest=null where id=v_player.id;
      update public.market_bids set status=case when id=v_bid.id then 'won' else 'outbid' end where market_listing_id=v_listing.id and status='pending';
      update public.market_listings set status='sold' where id=v_listing.id;
      perform private.record_financial_transaction(v_buyer.id,v_seller.id,-v_bid.bid_amount,v_buyer.budget,'auction_purchase','market_listing',v_listing.id::text,'Compra em leilão');
      perform private.record_financial_transaction(v_seller.id,v_buyer.id,v_bid.bid_amount,v_seller.budget,'auction_sale','market_listing',v_listing.id::text,'Venda em leilão');
      insert into public.transfer_history(player_id,player_name,player_position,player_rating,player_face_url,from_team_id,to_team_id,from_team_name,to_team_name,amount,transfer_type)
      values(v_player.id,v_player.name,v_player.position,v_player.rating,v_player.face_url,v_seller.id,v_buyer.id,v_seller.name,v_buyer.name,v_bid.bid_amount,'auction');
      v_closed:=v_closed+1;
      exit;
    end loop;
  end loop;
  return v_closed;
end;
$$;

create or replace function public.return_due_loans()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_player public.players; v_count integer:=0;
begin
  for v_player in select * from public.players where original_team_id is not null and loan_expires_at<=now() order by id for update skip locked loop
    update public.loans set status='completed' where player_id=v_player.id and status='active';
    update public.players set team_id=v_player.original_team_id,original_team_id=null,loan_salary_pct_dest=null,loan_expires_at=null where id=v_player.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.close_due_auctions() from public,anon,authenticated;
revoke all on function public.return_due_loans() from public,anon,authenticated;
grant execute on function public.close_due_auctions(),public.return_due_loans() to service_role;

create extension if not exists pg_cron with schema extensions;
do $$ begin
  if not exists(select 1 from cron.job where jobname='liga-master-close-auctions') then
    perform cron.schedule('liga-master-close-auctions','*/2 * * * *','select public.close_due_auctions()');
  end if;
  if not exists(select 1 from cron.job where jobname='liga-master-return-loans') then
    perform cron.schedule('liga-master-return-loans','15 * * * *','select public.return_due_loans()');
  end if;
end $$;

commit;
