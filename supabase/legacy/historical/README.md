# Scripts históricos

Arquivos preservados apenas para rastreabilidade. Eles não são idempotentes, não passaram pela auditoria de migrations atual e não devem ser executados em ambiente local ou remoto.

Quando uma regra ainda for necessária, implemente-a como uma nova migration incremental em `supabase/migrations/`, com autorização, rollback operacional e testes correspondentes.
