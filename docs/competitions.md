# Competições

Temporadas agrupam ligas; ligas representam divisões e têm participantes em `league_teams`. A tabela classificatória é materializada nessa tabela, não calculada em cada leitura.

## Liga

Admin cria liga e vincula clubes. Fixtures são inseridos em `matches` com rodadas. Após confirmação, a RPC soma partida, gols e pontos. A classificação deve ordenar por pontos e critérios exibidos na página de standings; o schema armazena saldo de gols para isso.

## Copas

Partidas de copa usam `cup_group` ou `cup_playoff` e podem ter `cup_name`; o admin possui geração de fases/fixtures na página de competições. O schema não possui uma entidade `cups` dedicada: a organização é representada por campos nas partidas. Antes de criar regras novas de copa, avalie introduzir entidade explícita em migration.

## Temporada

`seasons.status` inicia ativa ou concluída; scripts posteriores adicionam flags de mercado. A tela de finalização executa operações administrativas de manutenção. Não foram encontrados testes transacionais que comprovem uma finalização reversível.
