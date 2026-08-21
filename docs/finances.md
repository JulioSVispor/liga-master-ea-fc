# Finanças

## Fonte de verdade

`teams.budget` é o saldo de transferências e `players.wage` compõe a folha. `max_wage_cap` limita a soma. `transfer_history` fornece o histórico exibido; patrocínios e ajustes administrativos complementam o domínio.

## Regras encontradas

- Agente livre debita o valor do jogador do comprador.
- Compra e leilão debitam comprador e creditam vendedor quando há vendedor.
- Troca aplica dinheiro oferecido e solicitado nos dois saldos.
- Operações de entrada validam orçamento e folha antes da alteração.
- Salário pode alterar valor conforme razão configurada pela liga na UI.

Valores são `numeric` no banco. No frontend, trate-os como números monetários com formatação `pt-BR`, evitando arredondamento de ponto flutuante em lógica crítica. A atualização do orçamento, posse e histórico deve ser uma transação única no banco.
