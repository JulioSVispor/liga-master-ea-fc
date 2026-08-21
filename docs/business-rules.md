# Regras de negócio

## Clube e elenco

- Cada perfil pode estar associado a um único time.
- Jogador sem `team_id` é agente livre. O valor e salário são atributos do jogador.
- Contratação, compra de anúncio, leilão e troca verificam orçamento e teto salarial nas RPCs encontradas.
- O dashboard alerta teto excedido; a mensagem afirma perda de pontos, mas essa penalidade não foi confirmada nos SQL auditados e deve ser tratada como regra de UX pendente de confirmação.

## Mercado

- Abertura é baseada em temporada ativa em várias RPCs; há também `market_open`/configurações em scripts e telas. A regra efetiva deve ser consolidada.
- Anúncio pode ser compra imediata ou leilão. Leilão exige lance acima do maior/preço inicial e encerra como vendido ou expirado.
- Troca registra dinheiro oferecido/solicitado e jogadores em direções `send`/`receive`; ao aceitar, confere propriedade, saldo e folha.

## Partidas e tabela

- Jogo começa `pending`, pode ser `dispute` ou `confirmed`. `confirm_match` evita confirmação dupla.
- Em liga, confirmação atualiza duas linhas de `league_teams`: 3 pontos por vitória, 1 por empate, estatísticas de gols e jogos.
- Eventos aceitos: gol, assistência, amarelo e vermelho. Vermelho e três amarelos programam suspensão para a próxima partida pendente encontrada.
- W.O. administrativo registra 3–0, 0–3 ou 0–0 e status confirmado.

## Papéis

`profiles.role` contém ao menos `user`, `admin` e, após atualização, `master`. Tela admin aceita `admin` ou `master`; políticas e funções `is_admin`/`is_master` são a referência no banco quando aplicadas.
