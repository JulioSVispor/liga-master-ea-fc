# Decisões arquiteturais registradas

| Decisão observada | Evidência | Consequência |
|---|---|---|
| Next.js App Router | `src/app` e `next@16` | rotas e layouts convivem no filesystem |
| Supabase como backend | clientes, SQL, Auth, Storage e RPCs | RLS e funções SQL fazem parte do contrato da aplicação |
| Um clube por usuário | `teams.user_id unique` | multi-tenancy futura exige novo modelo de participação |
| Transações críticas em RPC | `buy_*`, `accept_*`, `confirm_match` | atomicidade é a intenção; autorização precisa ser auditada |
| Dados EA/SoFIFA importados | Route Handlers de importação | dados externos precisam de credenciais e controles server-side |

Não foi possível inferir por que os scripts SQL são avulsos ou qual deles está aplicado em produção; não registrar isto como decisão intencional sem evidência.

## ADR-001 — Recuperação segura e APIs transacionais (2026-08-21)

- O estado de rollback é sempre somente leitura.
- Mutações críticas derivam identidade de `auth.uid()` e não recebem IDs de clube do cliente.
- Partidas, mercado, trocas, empréstimos e finanças são transações em RPC `SECURITY DEFINER` com `search_path=''` e grants explícitos.
- `financial_transactions` é o ledger imutável; `teams.budget` continua o saldo materializado.
- `public_profiles` e `team_directory` separam diretório compartilhável de PII e dados financeiros.
- O baseline remoto deve ser marcado como aplicado; scripts antigos não são fonte executável.
- A produção não recebe migrations sem backup verificável e validação local reproduzível.

## ADR-002 — Calendário e autorização no limite do servidor (2026-08-22)

- Layouts de `/dashboard` e `/admin` validam a identidade no servidor; o Proxy permanece apenas como rejeição antecipada.
- O algoritmo Berger é regra pura e testada, enquanto a substituição do calendário é uma única RPC transacional.
- Uma liga com resultado, disputa ou súmula reportada não pode ter o calendário regenerado.
- A classificação é sempre reparada a partir de partidas confirmadas por uma RPC administrativa auditável; nunca por ajustes manuais de pontos.
- A implantação continua bloqueada até haver backup verificável e validação das migrations em PostgreSQL/Supabase local.
