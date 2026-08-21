begin;

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  counterparty_team_id uuid references public.teams(id) on delete restrict,
  amount numeric(15,2) not null,
  balance_before numeric(15,2) not null,
  balance_after numeric(15,2) not null,
  transaction_type text not null,
  reference_type text not null,
  reference_id text,
  actor_id uuid references public.profiles(id) on delete set null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.financial_transactions enable row level security;
create policy financial_transactions_select_owner_or_admin
  on public.financial_transactions for select to authenticated
  using (
    (select public.is_admin()) or exists (
      select 1 from public.teams t
       where t.id = financial_transactions.team_id
         and t.user_id = (select auth.uid())
    )
  );
revoke all on public.financial_transactions from public, anon, authenticated;
grant select on public.financial_transactions to authenticated;

create or replace function private.team_wages(p_team_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    case
      when p.original_team_id = p_team_id and p.team_id <> p_team_id
        then p.wage * ((100 - coalesce(p.loan_salary_pct_dest, 0)) / 100.0)
      when p.team_id = p_team_id and p.original_team_id is not null
        then p.wage * (coalesce(p.loan_salary_pct_dest, 100) / 100.0)
      when p.team_id = p_team_id then p.wage
      else 0
    end
  ), 0)
  from public.players p
  where p.team_id = p_team_id or p.original_team_id = p_team_id;
$$;

create or replace function private.record_financial_transaction(
  p_team_id uuid,
  p_counterparty_team_id uuid,
  p_amount numeric,
  p_balance_before numeric,
  p_transaction_type text,
  p_reference_type text,
  p_reference_id text,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.financial_transactions(
    team_id,counterparty_team_id,amount,balance_before,balance_after,
    transaction_type,reference_type,reference_id,actor_id,description,metadata
  ) values (
    p_team_id,p_counterparty_team_id,p_amount,p_balance_before,p_balance_before+p_amount,
    p_transaction_type,p_reference_type,p_reference_id,auth.uid(),p_description,coalesce(p_metadata,'{}'::jsonb)
  );
end;
$$;

create or replace function private.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.teams t where t.user_id = auth.uid();
$$;

revoke all on function private.team_wages(uuid) from public, anon, authenticated;
revoke all on function private.record_financial_transaction(uuid,uuid,numeric,numeric,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function private.current_team_id() from public, anon, authenticated;

create or replace function public.get_team_wages(p_team_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.teams t where t.id=p_team_id and t.user_id=auth.uid()
  ) then raise exception 'Acesso negado' using errcode='42501'; end if;
  return private.team_wages(p_team_id);
end;
$$;

create or replace function public.admin_adjust_team_budget(p_team_id uuid,p_amount numeric,p_description text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_team public.teams;
begin
  if not public.is_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_amount=0 or nullif(btrim(p_description),'') is null then raise exception 'Ajuste inválido' using errcode='22023'; end if;
  select * into v_team from public.teams where id=p_team_id for update;
  if not found then raise exception 'Clube não encontrado' using errcode='P0002'; end if;
  if v_team.budget+p_amount<0 then raise exception 'O ajuste deixaria o orçamento negativo' using errcode='23514'; end if;
  update public.teams set budget=budget+p_amount where id=p_team_id;
  perform private.record_financial_transaction(p_team_id,null,p_amount,v_team.budget,'admin_adjustment','team',p_team_id::text,left(btrim(p_description),500));
  insert into public.audit_logs(admin_id,action_type,entity_name,entity_id,details)
  values(auth.uid(),'admin_adjust_team_budget','teams',p_team_id::text,jsonb_build_object('amount',p_amount,'description',p_description));
  return jsonb_build_object('success',true,'balance',v_team.budget+p_amount);
end;
$$;

create or replace function public.buy_free_agent(p_player_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_team public.teams; v_player public.players;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  select * into v_team from public.teams where user_id=auth.uid() for update;
  if not found then raise exception 'Clube não encontrado' using errcode='P0002'; end if;
  select * into v_player from public.players where id=p_player_id for update;
  if not found then raise exception 'Jogador não encontrado' using errcode='P0002'; end if;
  if v_player.team_id is not null then raise exception 'Jogador já possui clube' using errcode='P0001'; end if;
  if not exists(select 1 from public.seasons s where s.status='active' and coalesce(s.market_open,false)) then
    raise exception 'Mercado fechado' using errcode='P0001';
  end if;
  if v_team.budget < v_player.value then raise exception 'Orçamento insuficiente' using errcode='P0001'; end if;
  if private.team_wages(v_team.id)+v_player.wage > v_team.max_wage_cap then
    raise exception 'Teto salarial excedido' using errcode='P0001';
  end if;
  update public.teams set budget=budget-v_player.value where id=v_team.id;
  update public.players set team_id=v_team.id,original_team_id=null,loan_expires_at=null,loan_salary_pct_dest=null where id=p_player_id;
  perform private.record_financial_transaction(v_team.id,null,-v_player.value,v_team.budget,'free_agent_purchase','player',p_player_id::text,'Contratação de agente livre');
  insert into public.transfer_history(player_id,player_name,player_position,player_rating,player_face_url,to_team_id,to_team_name,amount,transfer_type)
  values(v_player.id,v_player.name,v_player.position,v_player.rating,v_player.face_url,v_team.id,v_team.name,v_player.value,'free_agent');
  return jsonb_build_object('success',true,'player_id',p_player_id,'balance',v_team.budget-v_player.value);
end;
$$;

create or replace function public.release_player(p_player_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_team public.teams; v_player public.players;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  select * into v_team from public.teams where user_id=auth.uid() for update;
  if not found then raise exception 'Clube não encontrado' using errcode='P0002'; end if;
  select * into v_player from public.players where id=p_player_id for update;
  if not found or v_player.team_id<>v_team.id or v_player.original_team_id is not null then
    raise exception 'Jogador não pertence ao clube em definitivo' using errcode='42501';
  end if;
  if exists(select 1 from public.market_listings ml where ml.player_id=p_player_id and ml.status='active') then
    raise exception 'Cancele o anúncio ativo antes da dispensa' using errcode='P0001';
  end if;
  update public.teams set budget=budget+v_player.value where id=v_team.id;
  update public.players set team_id=null where id=p_player_id;
  perform private.record_financial_transaction(v_team.id,null,v_player.value,v_team.budget,'player_release','player',p_player_id::text,'Dispensa de jogador');
  insert into public.transfer_history(player_id,player_name,player_position,player_rating,player_face_url,from_team_id,from_team_name,amount,transfer_type)
  values(v_player.id,v_player.name,v_player.position,v_player.rating,v_player.face_url,v_team.id,v_team.name,v_player.value,'release');
  return jsonb_build_object('success',true,'player_id',p_player_id,'balance',v_team.budget+v_player.value);
end;
$$;

create or replace function public.buy_player_via_buyout(p_player_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_player public.players; v_buyer public.teams; v_seller public.teams; v_price numeric;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  select * into v_buyer from public.teams where user_id=auth.uid() for update;
  if not found then raise exception 'Clube comprador não encontrado' using errcode='P0002'; end if;
  select * into v_player from public.players where id=p_player_id for update;
  if not found or v_player.team_id is null or v_player.original_team_id is not null then raise exception 'Jogador indisponível' using errcode='P0001'; end if;
  if v_player.team_id=v_buyer.id then raise exception 'Jogador já pertence ao clube' using errcode='P0001'; end if;
  v_price:=v_player.buyout_clause;
  if v_price is null or v_price<=0 then raise exception 'Jogador sem multa rescisória' using errcode='P0001'; end if;
  select * into v_seller from public.teams where id=v_player.team_id for update;
  if v_buyer.budget<v_price then raise exception 'Orçamento insuficiente' using errcode='P0001'; end if;
  if private.team_wages(v_buyer.id)+v_player.wage>v_buyer.max_wage_cap then raise exception 'Teto salarial excedido' using errcode='P0001'; end if;
  update public.teams set budget=budget-v_price where id=v_buyer.id;
  update public.teams set budget=budget+v_price where id=v_seller.id;
  update public.players set team_id=v_buyer.id where id=p_player_id;
  perform private.record_financial_transaction(v_buyer.id,v_seller.id,-v_price,v_buyer.budget,'buyout_purchase','player',p_player_id::text,'Pagamento de multa rescisória');
  perform private.record_financial_transaction(v_seller.id,v_buyer.id,v_price,v_seller.budget,'buyout_sale','player',p_player_id::text,'Recebimento de multa rescisória');
  insert into public.transfer_history(player_id,player_name,player_position,player_rating,player_face_url,from_team_id,to_team_id,from_team_name,to_team_name,amount,transfer_type)
  values(v_player.id,v_player.name,v_player.position,v_player.rating,v_player.face_url,v_seller.id,v_buyer.id,v_seller.name,v_buyer.name,v_price,'buyout');
  return jsonb_build_object('success',true,'player_id',p_player_id);
end;
$$;

create or replace function public.create_market_listing(
  p_player_id bigint,p_listing_type text,p_price numeric,
  p_buyout_price numeric default null,p_duration_hours integer default 24
)
returns public.market_listings
language plpgsql
security definer
set search_path = ''
as $$
declare v_team_id uuid; v_listing public.market_listings;
begin
  v_team_id:=private.current_team_id();
  if v_team_id is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if p_listing_type not in ('immediate_buy','auction') or p_price<=0 then raise exception 'Anúncio inválido' using errcode='22023'; end if;
  if p_listing_type='auction' and (p_duration_hours<1 or p_duration_hours>168) then raise exception 'Duração inválida' using errcode='22023'; end if;
  if p_buyout_price is not null and p_buyout_price<p_price then raise exception 'Compra imediata menor que lance inicial' using errcode='22023'; end if;
  perform 1 from public.teams where id=v_team_id for update;
  perform 1 from public.players where id=p_player_id and team_id=v_team_id and original_team_id is null for update;
  if not found then raise exception 'Jogador não pertence ao clube' using errcode='42501'; end if;
  if exists(select 1 from public.market_listings where player_id=p_player_id and status='active') then raise exception 'Jogador já anunciado' using errcode='23505'; end if;
  insert into public.market_listings(player_id,seller_team_id,listing_type,price,buyout_price,end_date)
  values(p_player_id,v_team_id,p_listing_type,p_price,p_buyout_price,
         case when p_listing_type='auction' then now()+make_interval(hours=>p_duration_hours) end)
  returning * into v_listing;
  return v_listing;
end;
$$;

create or replace function public.cancel_market_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_listing public.market_listings; v_team_id uuid:=private.current_team_id();
begin
  select * into v_listing from public.market_listings where id=p_listing_id for update;
  if not found then raise exception 'Anúncio não encontrado' using errcode='P0002'; end if;
  if v_listing.seller_team_id<>v_team_id and not public.is_admin() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if v_listing.status<>'active' then raise exception 'Anúncio não está ativo' using errcode='P0001'; end if;
  if exists(select 1 from public.market_bids where market_listing_id=p_listing_id and status='pending') then
    raise exception 'Leilão com lance não pode ser cancelado' using errcode='P0001';
  end if;
  update public.market_listings set status='cancelled' where id=p_listing_id;
  return jsonb_build_object('success',true,'listing_id',p_listing_id);
end;
$$;

create or replace function public.buy_market_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_listing public.market_listings; v_player public.players; v_buyer public.teams; v_seller public.teams; v_price numeric;
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  select * into v_listing from public.market_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' then raise exception 'Anúncio indisponível' using errcode='P0001'; end if;
  v_price:=case when v_listing.listing_type='auction' then v_listing.buyout_price else v_listing.price end;
  if v_price is null then raise exception 'Leilão não possui compra imediata' using errcode='P0001'; end if;
  select * into v_buyer from public.teams where user_id=auth.uid() for update;
  if not found then raise exception 'Clube comprador não encontrado' using errcode='P0002'; end if;
  if v_buyer.id=v_listing.seller_team_id then raise exception 'Não é possível comprar o próprio atleta' using errcode='P0001'; end if;
  if v_listing.seller_team_id is not null then select * into v_seller from public.teams where id=v_listing.seller_team_id for update; end if;
  select * into v_player from public.players where id=v_listing.player_id for update;
  if v_listing.seller_team_id is not null and v_player.team_id<>v_listing.seller_team_id then raise exception 'Posse do jogador mudou' using errcode='40001'; end if;
  if v_buyer.budget<v_price then raise exception 'Orçamento insuficiente' using errcode='P0001'; end if;
  if private.team_wages(v_buyer.id)+v_player.wage>v_buyer.max_wage_cap then raise exception 'Teto salarial excedido' using errcode='P0001'; end if;
  update public.teams set budget=budget-v_price where id=v_buyer.id;
  if v_seller.id is not null then update public.teams set budget=budget+v_price where id=v_seller.id; end if;
  update public.players set team_id=v_buyer.id,original_team_id=null,loan_expires_at=null,loan_salary_pct_dest=null where id=v_player.id;
  update public.market_listings set status='sold' where id=p_listing_id;
  update public.market_bids set status='outbid' where market_listing_id=p_listing_id and status='pending';
  perform private.record_financial_transaction(v_buyer.id,v_seller.id,-v_price,v_buyer.budget,'market_purchase','market_listing',p_listing_id::text,'Compra no mercado');
  if v_seller.id is not null then perform private.record_financial_transaction(v_seller.id,v_buyer.id,v_price,v_seller.budget,'market_sale','market_listing',p_listing_id::text,'Venda no mercado'); end if;
  insert into public.transfer_history(player_id,player_name,player_position,player_rating,player_face_url,from_team_id,to_team_id,from_team_name,to_team_name,amount,transfer_type)
  values(v_player.id,v_player.name,v_player.position,v_player.rating,v_player.face_url,v_seller.id,v_buyer.id,v_seller.name,v_buyer.name,v_price,'market');
  return jsonb_build_object('success',true,'listing_id',p_listing_id,'player_id',v_player.id);
end;
$$;

create or replace function public.place_auction_bid(p_listing_id uuid,p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_listing public.market_listings; v_bidder public.teams; v_player public.players; v_highest numeric;
begin
  if p_amount<=0 then raise exception 'Lance inválido' using errcode='22023'; end if;
  select * into v_listing from public.market_listings where id=p_listing_id for update;
  if not found or v_listing.status<>'active' or v_listing.listing_type<>'auction' or v_listing.end_date<=now() then raise exception 'Leilão indisponível' using errcode='P0001'; end if;
  select * into v_bidder from public.teams where user_id=auth.uid() for update;
  if not found then raise exception 'Clube não encontrado' using errcode='P0002'; end if;
  if v_bidder.id=v_listing.seller_team_id then raise exception 'Não é possível ofertar pelo próprio atleta' using errcode='P0001'; end if;
  select * into v_player from public.players where id=v_listing.player_id for update;
  select coalesce(max(bid_amount),v_listing.price) into v_highest from public.market_bids where market_listing_id=p_listing_id and status='pending';
  if p_amount<=v_highest then raise exception 'Lance deve superar o valor atual' using errcode='P0001'; end if;
  if v_bidder.budget<p_amount then raise exception 'Orçamento insuficiente' using errcode='P0001'; end if;
  if private.team_wages(v_bidder.id)+v_player.wage>v_bidder.max_wage_cap then raise exception 'Teto salarial excedido' using errcode='P0001'; end if;
  update public.market_bids set status='outbid' where market_listing_id=p_listing_id and status='pending';
  insert into public.market_bids(market_listing_id,bidder_team_id,bid_amount,status) values(p_listing_id,v_bidder.id,p_amount,'pending');
  return jsonb_build_object('success',true,'listing_id',p_listing_id,'amount',p_amount);
end;
$$;

create or replace function public.create_trade_offer(
  p_receiver_team_id uuid,p_offered_money numeric,p_requested_money numeric,
  p_send_player_ids bigint[],p_receive_player_ids bigint[]
)
returns public.trade_offers
language plpgsql
security definer
set search_path = ''
as $$
declare v_sender_id uuid:=private.current_team_id(); v_offer public.trade_offers;
begin
  if v_sender_id is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if v_sender_id=p_receiver_team_id or p_offered_money<0 or p_requested_money<0 then raise exception 'Proposta inválida' using errcode='22023'; end if;
  if cardinality(coalesce(p_send_player_ids,'{}'))+cardinality(coalesce(p_receive_player_ids,'{}'))=0 then raise exception 'Inclua ao menos um jogador' using errcode='22023'; end if;
  perform 1 from public.teams where id in(v_sender_id,p_receiver_team_id) order by id for update;
  if (select count(*) from public.teams where id in(v_sender_id,p_receiver_team_id))<>2 then raise exception 'Clube inválido' using errcode='P0002'; end if;
  perform 1 from public.players where id=any(coalesce(p_send_player_ids,'{}')) order by id for update;
  if exists(select 1 from unnest(coalesce(p_send_player_ids,'{}')) x where not exists(select 1 from public.players p where p.id=x and p.team_id=v_sender_id and p.original_team_id is null)) then raise exception 'Jogador oferecido inválido' using errcode='42501'; end if;
  perform 1 from public.players where id=any(coalesce(p_receive_player_ids,'{}')) order by id for update;
  if exists(select 1 from unnest(coalesce(p_receive_player_ids,'{}')) x where not exists(select 1 from public.players p where p.id=x and p.team_id=p_receiver_team_id and p.original_team_id is null)) then raise exception 'Jogador solicitado inválido' using errcode='42501'; end if;
  insert into public.trade_offers(sender_team_id,receiver_team_id,offered_money,requested_money,expires_at)
  values(v_sender_id,p_receiver_team_id,p_offered_money,p_requested_money,now()+interval '48 hours') returning * into v_offer;
  insert into public.trade_players(trade_offer_id,player_id,direction)
  select v_offer.id,x,'send' from unnest(coalesce(p_send_player_ids,'{}')) x
  union all select v_offer.id,x,'receive' from unnest(coalesce(p_receive_player_ids,'{}')) x;
  return v_offer;
end;
$$;

create or replace function public.respond_trade_offer(p_trade_id uuid,p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_offer public.trade_offers; v_sender public.teams; v_receiver public.teams; v_net numeric; v_p record;
begin
  if p_decision not in('accept','reject','cancel') then raise exception 'Decisão inválida' using errcode='22023'; end if;
  select * into v_offer from public.trade_offers where id=p_trade_id for update;
  if not found or v_offer.status<>'pending' or v_offer.expires_at<=now() then raise exception 'Proposta indisponível' using errcode='P0001'; end if;
  select * into v_sender from public.teams where id=v_offer.sender_team_id for update;
  select * into v_receiver from public.teams where id=v_offer.receiver_team_id for update;
  if p_decision='cancel' and v_sender.user_id<>auth.uid() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_decision in('accept','reject') and v_receiver.user_id<>auth.uid() then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_decision<>'accept' then
    update public.trade_offers set status=case p_decision when 'reject' then 'rejected' else 'cancelled' end where id=p_trade_id;
    return jsonb_build_object('success',true,'status',p_decision);
  end if;
  perform 1 from public.players p join public.trade_players tp on tp.player_id=p.id where tp.trade_offer_id=p_trade_id order by p.id for update;
  if exists(select 1 from public.trade_players tp join public.players p on p.id=tp.player_id where tp.trade_offer_id=p_trade_id and ((tp.direction='send' and p.team_id<>v_sender.id) or (tp.direction='receive' and p.team_id<>v_receiver.id) or p.original_team_id is not null)) then raise exception 'Posse de jogador mudou' using errcode='40001'; end if;
  v_net:=v_offer.requested_money-v_offer.offered_money;
  if v_sender.budget+v_net<0 or v_receiver.budget-v_net<0 then raise exception 'Orçamento insuficiente' using errcode='P0001'; end if;
  if private.team_wages(v_sender.id)-(select coalesce(sum(p.wage),0) from public.players p join public.trade_players tp on tp.player_id=p.id where tp.trade_offer_id=p_trade_id and tp.direction='send')+(select coalesce(sum(p.wage),0) from public.players p join public.trade_players tp on tp.player_id=p.id where tp.trade_offer_id=p_trade_id and tp.direction='receive')>v_sender.max_wage_cap then raise exception 'Teto salarial do proponente excedido' using errcode='P0001'; end if;
  if private.team_wages(v_receiver.id)-(select coalesce(sum(p.wage),0) from public.players p join public.trade_players tp on tp.player_id=p.id where tp.trade_offer_id=p_trade_id and tp.direction='receive')+(select coalesce(sum(p.wage),0) from public.players p join public.trade_players tp on tp.player_id=p.id where tp.trade_offer_id=p_trade_id and tp.direction='send')>v_receiver.max_wage_cap then raise exception 'Teto salarial do destinatário excedido' using errcode='P0001'; end if;
  update public.teams set budget=budget+v_net where id=v_sender.id;
  update public.teams set budget=budget-v_net where id=v_receiver.id;
  update public.players p set team_id=case tp.direction when 'send' then v_receiver.id else v_sender.id end from public.trade_players tp where tp.trade_offer_id=p_trade_id and tp.player_id=p.id;
  for v_p in select p.*,tp.direction from public.players p join public.trade_players tp on tp.player_id=p.id where tp.trade_offer_id=p_trade_id loop
    insert into public.transfer_history(player_id,player_name,player_position,player_rating,player_face_url,from_team_id,to_team_id,from_team_name,to_team_name,amount,transfer_type)
    values(v_p.id,v_p.name,v_p.position,v_p.rating,v_p.face_url,case when v_p.direction='send' then v_sender.id else v_receiver.id end,case when v_p.direction='send' then v_receiver.id else v_sender.id end,case when v_p.direction='send' then v_sender.name else v_receiver.name end,case when v_p.direction='send' then v_receiver.name else v_sender.name end,0,'trade');
  end loop;
  if v_net<>0 then
    perform private.record_financial_transaction(v_sender.id,v_receiver.id,v_net,v_sender.budget,'trade_settlement','trade_offer',p_trade_id::text,'Liquidação de troca');
    perform private.record_financial_transaction(v_receiver.id,v_sender.id,-v_net,v_receiver.budget,'trade_settlement','trade_offer',p_trade_id::text,'Liquidação de troca');
  end if;
  update public.trade_offers set status='accepted' where id=p_trade_id;
  return jsonb_build_object('success',true,'status','accepted');
end;
$$;

create or replace function public.accept_trade_offer(p_trade_id uuid) returns jsonb language sql security definer set search_path='' as $$ select public.respond_trade_offer(p_trade_id,'accept') $$;
create or replace function public.reject_trade_offer(p_trade_id uuid) returns jsonb language sql security definer set search_path='' as $$ select public.respond_trade_offer(p_trade_id,'reject') $$;
create or replace function public.cancel_trade_offer(p_trade_id uuid) returns jsonb language sql security definer set search_path='' as $$ select public.respond_trade_offer(p_trade_id,'cancel') $$;

create or replace function public.create_loan_offer(p_receiver_team_id uuid,p_player_id bigint,p_salary_share_pct integer,p_duration_weeks integer)
returns public.loan_offers language plpgsql security definer set search_path='' as $$
declare v_sender_id uuid:=private.current_team_id(); v_offer public.loan_offers;
begin
  if v_sender_id is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if v_sender_id=p_receiver_team_id or p_salary_share_pct not between 0 and 100 or p_duration_weeks not between 1 and 52 then raise exception 'Proposta inválida' using errcode='22023'; end if;
  perform 1 from public.players where id=p_player_id and team_id=v_sender_id and original_team_id is null for update;
  if not found then raise exception 'Jogador não pertence ao clube' using errcode='42501'; end if;
  insert into public.loan_offers(sender_team_id,receiver_team_id,player_id,salary_share_pct,duration_weeks,expires_at)
  values(v_sender_id,p_receiver_team_id,p_player_id,p_salary_share_pct,p_duration_weeks,now()+interval '48 hours') returning * into v_offer;
  return v_offer;
end $$;

create or replace function public.respond_loan_offer(p_offer_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_offer public.loan_offers; v_player public.players; v_receiver public.teams;
begin
  if p_decision not in('accept','reject','cancel') then raise exception 'Decisão inválida' using errcode='22023'; end if;
  select * into v_offer from public.loan_offers where id=p_offer_id for update;
  if not found or v_offer.status<>'pending' or v_offer.expires_at<=now() then raise exception 'Proposta indisponível' using errcode='P0001'; end if;
  if p_decision='cancel' and private.current_team_id()<>v_offer.sender_team_id then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_decision in('accept','reject') and private.current_team_id()<>v_offer.receiver_team_id then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_decision<>'accept' then update public.loan_offers set status=case p_decision when 'reject' then 'rejected' else 'cancelled' end where id=p_offer_id; return jsonb_build_object('success',true,'status',p_decision); end if;
  select * into v_receiver from public.teams where id=v_offer.receiver_team_id for update;
  select * into v_player from public.players where id=v_offer.player_id for update;
  if v_player.team_id<>v_offer.sender_team_id or v_player.original_team_id is not null then raise exception 'Posse do jogador mudou' using errcode='40001'; end if;
  if private.team_wages(v_receiver.id)+(v_player.wage*v_offer.salary_share_pct/100.0)>v_receiver.max_wage_cap then raise exception 'Teto salarial excedido' using errcode='P0001'; end if;
  update public.players set original_team_id=v_offer.sender_team_id,team_id=v_offer.receiver_team_id,loan_salary_pct_dest=v_offer.salary_share_pct,loan_expires_at=now()+make_interval(weeks=>v_offer.duration_weeks) where id=v_offer.player_id;
  insert into public.loans(player_id,owner_team_id,loan_team_id,loan_fee,status) values(v_offer.player_id,v_offer.sender_team_id,v_offer.receiver_team_id,0,'active');
  update public.loan_offers set status='accepted' where id=p_offer_id;
  return jsonb_build_object('success',true,'status','accepted');
end $$;

create or replace function public.accept_loan_offer(p_offer_id uuid) returns jsonb language sql security definer set search_path='' as $$ select public.respond_loan_offer(p_offer_id,'accept') $$;
create or replace function public.reject_loan_offer(p_offer_id uuid) returns jsonb language sql security definer set search_path='' as $$ select public.respond_loan_offer(p_offer_id,'reject') $$;
create or replace function public.cancel_loan_offer(p_offer_id uuid) returns jsonb language sql security definer set search_path='' as $$ select public.respond_loan_offer(p_offer_id,'cancel') $$;

create or replace function public.send_negotiation_message(p_trade_offer_id uuid,p_loan_offer_id uuid,p_message text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or nullif(btrim(p_message),'') is null or (p_trade_offer_id is null)=(p_loan_offer_id is null) then raise exception 'Mensagem inválida' using errcode='22023'; end if;
  if p_trade_offer_id is not null and not exists(select 1 from public.trade_offers o join public.teams t on t.id in(o.sender_team_id,o.receiver_team_id) where o.id=p_trade_offer_id and t.user_id=auth.uid()) then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_loan_offer_id is not null and not exists(select 1 from public.loan_offers o join public.teams t on t.id in(o.sender_team_id,o.receiver_team_id) where o.id=p_loan_offer_id and t.user_id=auth.uid()) then raise exception 'Acesso negado' using errcode='42501'; end if;
  insert into public.negotiation_messages(trade_offer_id,loan_offer_id,sender_id,message) values(p_trade_offer_id,p_loan_offer_id,auth.uid(),left(btrim(p_message),2000));
  return jsonb_build_object('success',true);
end $$;

-- Somente as novas assinaturas derivadas do JWT são expostas.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(),public.is_master(),public.get_team_wages(uuid) to authenticated;
grant execute on function public.update_own_profile(text,text,text),public.update_team_identity(text,text),public.update_team_profile(text,text,text,text),public.update_team_tactics(text,jsonb) to authenticated;
grant execute on function public.report_match(uuid,integer,integer,bigint,jsonb),public.confirm_match(uuid),public.dispute_match(uuid,text,text) to authenticated;
grant execute on function public.apply_walkover(uuid,text,text),public.resolve_match(uuid,jsonb),public.reopen_match(uuid,text) to authenticated;
grant execute on function public.buy_free_agent(bigint),public.release_player(bigint),public.buy_player_via_buyout(bigint),public.create_market_listing(bigint,text,numeric,numeric,integer),public.cancel_market_listing(uuid),public.buy_market_listing(uuid),public.place_auction_bid(uuid,numeric) to authenticated;
grant execute on function public.admin_adjust_team_budget(uuid,numeric,text) to authenticated;
grant execute on function public.create_trade_offer(uuid,numeric,numeric,bigint[],bigint[]),public.respond_trade_offer(uuid,text),public.accept_trade_offer(uuid),public.reject_trade_offer(uuid),public.cancel_trade_offer(uuid) to authenticated;
grant execute on function public.create_loan_offer(uuid,bigint,integer,integer),public.respond_loan_offer(uuid,text),public.accept_loan_offer(uuid),public.reject_loan_offer(uuid),public.cancel_loan_offer(uuid),public.send_negotiation_message(uuid,uuid,text) to authenticated;

commit;
