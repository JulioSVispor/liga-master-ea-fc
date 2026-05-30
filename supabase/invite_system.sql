-- ========================================================
-- SISTEMA DE CONVITES POR WHITELIST DE E-MAIL
-- ========================================================

-- Tabela de e-mails autorizados a se registrar na liga
create table if not exists public.allowed_emails (
    id uuid default gen_random_uuid() primary key,
    email text not null unique,
    display_name text,                              -- Nome sugerido pelo admin (opcional)
    added_by uuid references public.profiles(id) on delete set null,
    used boolean default false,                     -- true quando o participante completar o registro
    used_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.allowed_emails enable row level security;

-- Somente admins gerenciam a whitelist
drop policy if exists "Admin gerencia whitelist" on public.allowed_emails;
create policy "Admin gerencia whitelist" on public.allowed_emails
    for all using (public.is_admin());

-- Comentário: a validação de e-mail no registro é feita via Server Action com service_role
-- A tabela NÃO precisa de select público — a verificação é feita no servidor
