# Autenticação e autorização

## Autenticação

O cliente `@supabase/ssr` mantém a sessão do navegador em cookies. O proxy e os layouts de `/dashboard` e `/admin` usam esses cookies para validar o usuário no Supabase. Login, registro e recuperação de senha são telas cliente. O trigger `handle_new_user` pretende inserir um perfil em `public.profiles` quando um usuário nasce em `auth.users`.

### Recuperação de senha

`/forgot-password` envia um link com retorno para `/reset-password`. Abra o link no mesmo navegador em que fez a solicitação para que o cliente possa trocar o código PKCE pelo verificador guardado na origem. A tela só libera a alteração após validar que a sessão veio de recuperação, aplica a política mínima de senha e encerra a sessão após a troca. Se tiver um link do fluxo anterior com tokens no fragmento, solicite um novo.

O Site URL e todos os domínios usados no desenvolvimento e em produção devem autorizar `/reset-password` em **Auth > URL Configuration > Redirect URLs**. Sem essa configuração, o Supabase redireciona para o Site URL padrão e o fluxo não chega à tela correta.

## Convites

`allowed_emails` implementa a whitelist. A elegibilidade é verificada exclusivamente pelo hook `Before User Created`; o trigger de criação revalida e consome o convite na mesma transação que cria perfil e clube. As rotas legadas de pré-validação e consumo respondem `410` para não enumerar convites nem reabrir uma janela de corrida.

## Autorização

- treinador: dono do clube e de sua shortlist/notificações;
- admin/master: acesso ao painel, manutenção e decisões de liga;
- RLS deve restringir linhas; componentes cliente somente escondem/mostram navegação.

Não usar `user_metadata` para autorização. Papel vem de `profiles` no modelo atual; quaisquer changes de papel devem ser validados pelo banco/servidor e auditados. Service role é exclusivo de backend e nunca deve ter prefixo `NEXT_PUBLIC_`.
