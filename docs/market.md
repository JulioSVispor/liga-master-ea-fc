# Mercado

O mercado usa `players`, `market_listings`, `market_bids`, `trade_offers`, `trade_players`, `loan_offers`, `loans` e `transfer_history`.

## Modos

- **Agente livre:** `buy_free_agent` verifica temporada, posse nula, orçamento e folha; reduz saldo e atribui o atleta.
- **Compra imediata:** `buy_market_listing` transfere saldo entre clubes, jogador e estado do anúncio.
- **Leilão:** `place_auction_bid` invalida lances pendentes anteriores; `close_auction` encontra o vencedor ou expira o anúncio.
- **Troca:** `accept_trade_offer` valida os dois lados, dinheiro, propriedade e teto antes de trocar atletas.
- **Empréstimo/buyout:** há funções e tabelas nos scripts de atualização; a UI de negociações expõe parte desse domínio.

## Restrições a preservar

Não comprar ou ofertar o próprio jogador; não permitir saldo negativo, atleta que mudou de dono ou folha acima do teto. A transação deve ser atômica e registrar `transfer_history` para manter o feed/auditoria consistente.

## Lacunas observadas

As RPCs usam parâmetros de ID de time. Documentação não prova que todas conferem o chamador autenticado, então a RLS não basta quando a função é `SECURITY DEFINER`. Também não há worker/cron versionado para encerrar automaticamente leilões ou devolver empréstimos; existe `check_and_return_loans`, mas não foi encontrada agenda de execução.
