# Rollback operacional

O rollback nunca repõe políticas ou grants antigos. Em qualquer falha:

1. manter `NEXT_PUBLIC_READ_ONLY_MODE=true`;
2. reaplicar a migration `emergency_read_only` em uma nova migration de contenção, se necessário;
3. interromper cadastro por e-mail no painel Auth;
4. cancelar a reativação do módulo afetado;
5. comparar `preflight.sql` e `postflight.sql`;
6. restaurar backup somente se houver perda/corrupção comprovada e com janela aprovada.

Migrations estruturais posteriores exigem rollback específico previamente revisado, mas esse rollback também termina no estado de contenção. Não usar `schema.sql`, `99_apply_all_updates.sql`, `DROP TABLE` ou restauração parcial sem reconciliar Auth, banco e Storage.
