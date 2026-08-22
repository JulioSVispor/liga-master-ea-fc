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

Cada passo exige preflight salvo, rollback de contenção preparado, testes de autorização, advisors, logs e invariantes comparadas. A implantação não avança com diferença inexplicada.

## Monitoramento por sete dias

- falhas e picos de Auth/API/Postgres/Storage;
- RPCs com `42501`, `40001`, `23514` e `P0001`;
- orçamento ou saldo de ledger negativo/divergente;
- classificação diferente da reconstrução por partidas confirmadas;
- alterações de `profiles.role` fora do fluxo master;
- leilões vencidos não encerrados e empréstimos vencidos não devolvidos.
