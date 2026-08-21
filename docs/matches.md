# Partidas

Uma partida liga temporada, competição e dois clubes. `competition_type` suporta liga, grupos/mata-mata de copa e amistoso; `league_id` pode ser nulo fora de liga.

## Ciclo

`pending` → placar/eventos reportados → `confirmed`, ou `pending` → `dispute` → decisão administrativa. A flag `released` controla se a partida foi liberada. `dispute_match` registra justificativa e prova; telas de arbitragem/admin podem confirmar ou aplicar W.O.

## Eventos e disciplina

`match_events` armazena gols, assistências, amarelos e vermelhos. Ao confirmar, a RPC processa cartões: vermelho e três amarelos em jogos confirmados geram uma suspensão apontada para a próxima partida pendente do time.

## Integridade

`confirm_match` impede dupla confirmação antes de atualizar tabela. Alterações manuais de placar/eventos após confirmação exigem processo de reversão: a implementação encontrada não documenta compensação automática de `league_teams` e suspensões.
