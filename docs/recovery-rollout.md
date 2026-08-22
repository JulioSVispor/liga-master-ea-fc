# Rollout de recuperação

## Gate obrigatório

Antes de tocar produção, registrar: ID/data do backup gerenciado, resultado de teste de restauração quando disponível, dump lógico de `auth` e `public`, inventário/export dos objetos de Storage e saída do preflight. Backups do banco não incluem os arquivos armazenados no Storage.

## Sequência

| Ordem | Migration | Reativação permitida após aceite |
|---|---|---|
| 1 | `emergency_read_only` | leitura somente |
| 2 | `security_foundation` | login e perfil |
| 3 | `transactional_match_apis` | partidas |
| 4 | `transactional_market_apis` | mercado e financeiro |
| 5 | `secure_signup_and_storage` | cadastro e uploads |
| 6 | `constraints_indexes_and_cron` | administração gradual |
| 7 | `transactional_league_schedule` | geração de calendário, shortlist e reparo de classificação |
| 8 | `beta_security_completion` | comandos administrativos de temporada, divisões, papéis, finanças e W.O. |
| 9 | `admin_domain_commands` | copas, intervenções de elenco e reconciliação manual de Auth |

O arquivo `establish_migration_workflow` é um marcador vazio e não substitui o snapshot do schema remoto. Antes do rollout, gerar e revisar o baseline com `supabase db pull`, confirmar que ele foi apenas marcado no histórico remoto e provar equivalência por fingerprint. Não aplicar `schema.sql` nem scripts em `supabase/legacy/historical`.

Cada passo exige preflight salvo, rollback de contenção preparado, testes de autorização, advisors, logs e invariantes comparadas. A implantação não avança com diferença inexplicada.

As rotas de Auth que faziam pré-validação/consumo de convite são legadas e respondem `410`. O hook `Before User Created` precisa estar habilitado no Dashboard Auth, e a proteção contra senhas vazadas precisa ser ativada manualmente antes de reabrir o cadastro.

## Monitoramento por sete dias

- falhas e picos de Auth/API/Postgres/Storage;
- RPCs com `42501`, `40001`, `23514` e `P0001`;
- orçamento ou saldo de ledger negativo/divergente;
- classificação diferente da reconstrução por partidas confirmadas;
- alterações de `profiles.role` fora do fluxo master;
- leilões vencidos não encerrados e empréstimos vencidos não devolvidos.
