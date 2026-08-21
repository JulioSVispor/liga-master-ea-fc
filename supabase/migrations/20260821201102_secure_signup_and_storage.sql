begin;

create unique index if not exists allowed_emails_email_lower_unique
  on public.allowed_emails (lower(email));

create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_email text:=lower(btrim(event->'user'->>'email'));
begin
  if v_email is null or not exists(
    select 1 from public.allowed_emails a
     where lower(a.email)=v_email and not coalesce(a.used,false)
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Não foi possível concluir o cadastro.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text:=lower(btrim(new.email));
  v_display_name text:=nullif(btrim(new.raw_user_meta_data->>'display_name'),'');
  v_team_name text:=nullif(btrim(new.raw_user_meta_data->>'team_name'),'');
  v_real_club_name text:=nullif(btrim(new.raw_user_meta_data->>'real_club_name'),'');
  v_budget numeric(15,2);
  v_wage_cap numeric(15,2);
begin
  perform 1 from public.allowed_emails a
   where lower(a.email)=v_email and not coalesce(a.used,false)
   for update;
  if not found then raise exception 'Não foi possível concluir o cadastro' using errcode='42501'; end if;
  if v_display_name is null or v_team_name is null or v_real_club_name is null then
    raise exception 'Dados do participante ou clube incompletos' using errcode='22023';
  end if;

  select coalesce((select s.value::numeric from public.settings s where s.key='default_budget'),50000000)
    into v_budget;
  select coalesce((select s.value::numeric from public.settings s where s.key='default_wage_cap'),15000)
    into v_wage_cap;

  insert into public.profiles(id,email,display_name,role)
  values(new.id,v_email,left(v_display_name,80),'user');

  insert into public.teams(user_id,name,real_club_name,budget,max_wage_cap)
  values(new.id,left(v_team_name,80),left(v_real_club_name,120),v_budget,v_wage_cap);

  update public.allowed_emails
     set used=true,used_at=now()
   where lower(email)=v_email;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

update storage.buckets
   set public=true,
       file_size_limit=2097152,
       allowed_mime_types=array['image/png','image/jpeg','image/webp']::text[]
 where id in ('shields','trophies');

drop policy if exists "Upload de escudos" on storage.objects;
drop policy if exists "Update de escudos" on storage.objects;
drop policy if exists "Delete de escudos" on storage.objects;
drop policy if exists shields_owner_insert on storage.objects;
drop policy if exists shields_owner_update on storage.objects;
drop policy if exists shields_owner_delete on storage.objects;
drop policy if exists trophies_admin_insert on storage.objects;
drop policy if exists trophies_admin_update on storage.objects;
drop policy if exists trophies_admin_delete on storage.objects;

create policy shields_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='shields'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy shields_owner_update on storage.objects
for update to authenticated
using (
  bucket_id='shields'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='shields'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy shields_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id='shields'
  and owner_id=(select auth.uid())::text
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

create policy trophies_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id='trophies' and owner_id=(select auth.uid())::text and (select public.is_admin()));
create policy trophies_admin_update on storage.objects
for update to authenticated
using (bucket_id='trophies' and (select public.is_admin()))
with check (bucket_id='trophies' and (select public.is_admin()));
create policy trophies_admin_delete on storage.objects
for delete to authenticated
using (bucket_id='trophies' and (select public.is_admin()));

commit;
