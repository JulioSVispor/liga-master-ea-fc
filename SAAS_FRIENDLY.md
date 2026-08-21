## Preparação para uma Evolução Comercial (SaaS Friendly)

Embora o objetivo atual da plataforma seja atender exclusivamente à comunidade da Liga Master, toda a arquitetura deverá seguir a filosofia **SaaS Friendly**.

Isso **não significa** implementar desde já uma arquitetura Multi-Tenant completa ou antecipar necessidades que ainda não existem. O objetivo é manter o sistema simples, performático e de fácil manutenção, tomando decisões que reduzam o impacto de uma eventual evolução para um produto comercial.

A proposta é evitar acoplamentos e limitações arquiteturais que possam tornar uma futura migração excessivamente complexa, preservando a velocidade de desenvolvimento da versão atual.

### Princípios

Toda nova funcionalidade deverá seguir os seguintes princípios:

* Priorizar simplicidade enquanto a plataforma atender apenas uma comunidade.
* Evitar regras, configurações e comportamentos excessivamente globais quando isso puder dificultar futuras evoluções.
* Desenvolver módulos independentes e desacoplados, favorecendo reutilização e manutenção.
* Projetar novas funcionalidades pensando em escalabilidade, sem adicionar complexidade desnecessária ao projeto.
* Adotar uma arquitetura flexível, preparada para evoluir conforme novas necessidades surgirem.

### Diretrizes Arquiteturais

Sempre que uma nova funcionalidade for desenvolvida, sua modelagem deverá ser avaliada considerando uma possível expansão futura para múltiplas comunidades.

Isso não significa implementar Multi-Tenancy neste momento, mas sim evitar decisões que dificultem essa evolução.

Como diretriz geral:

* Centralizar configurações da plataforma em estruturas organizadas e facilmente extensíveis.
* Reduzir o acoplamento entre módulos como Mercado, Competições, Financeiro, Usuários, Estatísticas, Notificações e Administração.
* Projetar novas entidades de forma que possam, futuramente, ser associadas a uma comunidade específica sem exigir grandes alterações estruturais.
* Manter uma arquitetura orientada a domínios (Domain-Oriented), favorecendo organização, escalabilidade e facilidade de manutenção.
* Sempre que possível, encapsular regras de negócio em serviços, ações ou camadas específicas, evitando lógica distribuída pela interface.

### O que não será implementado neste momento

Para preservar a simplicidade da aplicação, as seguintes funcionalidades somente serão consideradas quando houver necessidade real:

* Arquitetura Multi-Tenant completa.
* Isolamento de dados entre comunidades por meio de políticas específicas de RLS.
* Sistema de autenticação para múltiplas organizações.
* White Label.
* API pública para integrações externas.
* Infraestrutura dedicada para operação como SaaS.

### Objetivo

Esta diretriz tem como finalidade garantir que a plataforma continue evoluindo de forma sustentável, sem comprometer sua simplicidade atual.

Caso, futuramente, exista interesse em disponibilizar o sistema para outras comunidades ou comercializá-lo como um produto, a arquitetura já estará preparada para essa evolução, reduzindo significativamente o esforço de migração e evitando grandes refatorações.

Em outras palavras, a plataforma seguirá a filosofia **SaaS Friendly**: desenvolver pensando no futuro, mas implementando apenas o que gera valor para o presente.
