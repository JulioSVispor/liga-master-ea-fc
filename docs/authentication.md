# Autenticação e autorização

## Autenticação

Supabase Auth mantém a sessão do browser. Login, registro e recuperação de senha são telas cliente. O trigger `handle_new_user` pretende inserir um perfil em `public.profiles` quando um usuário nasce em `auth.users`.

### Recuperação de senha

`/forgot-password` envia um link com retorno para `/reset-password`. A tela de retorno só permite a alteração quando existe uma sessão de recuperação válida, aplica a política mínima de senha e encerra a sessão após a troca.

O Site URL e todos os domínios usados no desenvolvimento e em produção devem autorizar `/reset-password` em **Auth > URL Configuration > Redirect URLs**. Sem essa configuração, o Supabase redireciona para o Site URL padrão e o fluxo não chega à tela correta.

## Convites

`allowed_emails` implementa whitelist: a rota de validação normaliza e consulta e-mail; a rota de consumo marca `used`. Ambas usam cliente de servidor com service role. O registro deve considerar a janela entre validar e consumir: a exclusividade/consumo atômico precisa ser garantida no banco para evitar corrida.

## Autorização

- treinador: dono do clube e de sua shortlist/notificações;
- admin/master: acesso ao painel, manutenção e decisões de liga;
- RLS deve restringir linhas; componentes cliente somente escondem/mostram navegação.

Não usar `user_metadata` para autorização. Papel vem de `profiles` no modelo atual; quaisquer changes de papel devem ser validados pelo banco/servidor e auditados. Service role é exclusivo de backend e nunca deve ter prefixo `NEXT_PUBLIC_`.
