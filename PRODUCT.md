# Produto — Liga Master EA FC

## Visão

Liga Master é uma plataforma para comunidades organizarem campeonatos de EA FC. O jogo acontece no console; a plataforma preserva as regras, o elenco, as finanças, as partidas e a história da competição.

O público são treinadores e administradores adultos, com pouco tempo. A experiência deve responder rapidamente ao que o usuário precisa fazer, sem mecânicas de coleção ou gamificação arcade.

## Escopo atual

| Domínio | Implementado no repositório |
|---|---|
| Clube | cadastro, escudo, elenco, formação, escalação, orçamento e teto salarial |
| Mercado | agentes livres, anúncios, leilões, trocas, empréstimos e histórico de transferências |
| Competição | temporadas, ligas, rodadas, jogos, eventos, classificação, W.O. e disputas |
| Administração | participantes, importação de jogadores, janela, arbitragem, notícias, troféus, patrocínios e auditoria |
| Comunicação | mural de mercado, notificações e mensagens de negociação |

## Não é

- Ultimate Team; não há cartas especiais, packs, boosts ou raridades.
- Um simulador do jogo EA FC; placares e eventos são registrados após a partida externa.
- Um ERP genérico. A informação deve servir a uma decisão de liga ou clube.

## Conceitos

- **Treinador:** usuário autenticado que administra no máximo um clube (`teams.user_id` é único).
- **Liga/temporada:** uma temporada possui divisões; `league_teams` guarda a tabela classificatória por liga.
- **Janela:** a temporada ativa e configurações em `settings` governam as operações de mercado.
- **Folha:** soma de `players.wage` do clube, limitada por `teams.max_wage_cap`.

Veja [regras de negócio](docs/business-rules.md) e [fluxos](docs/flows.md).
