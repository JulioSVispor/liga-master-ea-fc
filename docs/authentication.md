# Autenticação e autorização

## Autenticação

Supabase Auth mantém a sessão do browser. Login, registro e recuperação de senha são telas cliente. O trigger `handle_new_user` pretende inserir um perfil em `public.profiles` quando um usuário nasce em `auth.users`.

## Convites

`allowed_emails` implementa whitelist: a rota de validação normaliza e consulta e-mail; a rota de consumo marca `used`. Ambas usam cliente de servidor com service role. O registro deve considerar a janela entre validar e consumir: a exclusividade/consumo atômico precisa ser garantida no banco para evitar corrida.

## Autorização

- treinador: dono do clube e de sua shortlist/notificações;
- admin/master: acesso ao painel, manutenção e decisões de liga;
- RLS deve restringir linhas; componentes cliente somente escondem/mostram navegação.

Não usar `user_metadata` para autorização. Papel vem de `profiles` no modelo atual; quaisquer changes de papel devem ser validados pelo banco/servidor e auditados. Service role é exclusivo de backend e nunca deve ter prefixo `NEXT_PUBLIC_`.
