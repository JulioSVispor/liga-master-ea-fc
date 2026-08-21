# Scout

O scout em `/dashboard/scouting` apresenta a base global de `players`, permite busca/filtros e shortlist. Atletas sem time são agentes livres e podem ser contratados por RPC; jogadores de outros clubes participam do mercado e negociações.

`shortlists` é privado por usuário segundo suas policies: cada registro associa `user_id` e `player_id`. As Server Actions `toggleShortlist` e `getShortlistedPlayerIds` operam esse recurso com a sessão do cookie.

Os dados de jogadores chegam de importação EA Ratings e sincronização SoFIFA. Esses dados são externos, podem ter fallback local/mock em caso de indisponibilidade e não devem ser tratados como verdade esportiva permanente sem uma política de atualização.
