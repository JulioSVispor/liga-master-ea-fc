# Supabase workflow

Somente arquivos em `supabase/migrations/` participam do fluxo de aplicação. Os SQLs antigos na raiz são evidência histórica e **não podem** ser executados em produção; em especial, `schema.sql` e `99_apply_all_updates.sql` são destrutivos/incompatíveis com o estado remoto.

## Ordem segura

1. Verificar backup gerenciado e exportar objetos do Storage.
2. Executar `runbooks/preflight.sql` e salvar o resultado.
3. Ativar `NEXT_PUBLIC_READ_ONLY_MODE=true` na aplicação.
4. Validar localmente com `supabase start`, `supabase db reset` e `supabase test db`.
5. Aplicar uma migration por vez: contenção, segurança, partidas, mercado, cadastro/Storage, constraints/Cron.
6. Após cada passo, executar `runbooks/postflight.sql`, advisors e logs.

Sem Docker, Supabase CLI funcional e backup verificável, o rollout remoto deve parar antes do passo 5.
