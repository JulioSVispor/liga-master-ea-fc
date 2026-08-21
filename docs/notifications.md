# Notificações e mural

`notifications` contém `user_id`, título, conteúdo, leitura e timestamp. O layout do dashboard busca notificações do usuário, apresenta contador e permite marcar itens como lidos. A criação ocorre em várias telas (escudo, arbitragem, ações administrativas), logo ainda não há um serviço central de notificações.

`market_news` é um feed editorial/automático. Triggers em scripts SQL criam notícias a partir de transferências e mudanças de estágio/configuração; a tela admin também cria e remove publicações.

Recomendação: centralizar tipos de evento e criação de notificações em função/RPC autorizada, registrar origem e adicionar preferências de entrega antes de introduzir e-mail ou push.
