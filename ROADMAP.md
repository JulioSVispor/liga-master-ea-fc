# Roadmap e dívida técnica

| Fase | Objetivo | Prioridade | Dependências / risco |
|---|---|---|---|
| 0 — Segurança | Proteger importação, remover segredos do código, revisar RLS/RPCs | Crítica | schema efetivo e rotação de credenciais |
| 1 — Integridade | Criar migrations versionadas, consolidar schema e testar transações | Crítica | acesso ao projeto Supabase |
| 2 — Camadas | Mover regras cliente para services/actions/RPCs autorizadas | Alta | contratos de dados e testes |
| 3 — UX/performance | Dividir telas monolíticas, RSC/Suspense, paginação e estados vazios | Alta | desenho de componentes comuns |
| 4 — Produto | Refinar histórico, competições e comunicação conforme uso real | Média | validação da comunidade |

## Dívidas encontradas

- SQL manual, duplicado e sem histórico de aplicação verificável.
- Páginas cliente muito extensas e acesso ao banco espalhado.
- Chave de terceiro no código e endpoints administrativos aparentando falta de autorização server-side.
- UI base incompleta e ausência de testes automatizados observáveis.
- README ainda é o texto padrão do create-next-app.

## Estado da recuperação em 2026-08-21

- Preparado: contenção, migrations estruturais, RPCs de partidas/mercado, ledger, hook de convite, Storage seguro, constraints/Cron, guardas de rota no servidor e documentação operacional.
- Bloqueado por ambiente: reset/testes locais do Supabase (Docker ausente) e rollout remoto (backup/restauração não verificáveis pelas ferramentas disponíveis).
- Pendente antes de reativar administração: converter mutações administrativas legadas restantes em actions/RPCs, concluir views de leitura compatíveis, pgTAP de matriz completa e Playwright autenticado.
- Pendente de UX: concluir a migração de toasts/selects locais para os componentes canônicos e executar QA visual autenticado nas quatro larguras. Diálogos nativos foram removidos e as seis telas acima de 800 linhas foram separadas em controladores e views menores.

## Auditoria efetiva em 2026-08-22

- Produção: 12 usuários Auth, 11 perfis, 11 clubes, 15.908 jogadores e 147 partidas; o histórico de migrations remoto está vazio.
- Bloqueador confirmado: 26 funções `SECURITY DEFINER` executáveis por `anon`, uma view `SECURITY DEFINER`, escrita irrestrita em `settings` e mutações diretas legadas.
- Integridade: cinco registros de classificação divergem da reconstrução por partidas confirmadas e há um usuário Auth sem perfil.
- Código preparado: proteção server-side nos layouts, calendário Berger testável, substituição transacional do calendário, reparo auditável da classificação e shortlist autenticada por RPC.
- Gate mantido: não aplicar migrations nem reparar dados remotos antes de backup verificável e execução local; Docker/Podman não está disponível nesta máquina.

## Fechamento local em 2026-08-22

- Mutações diretas em componentes/features: `63 → 0`; comandos críticos foram convertidos em RPC e CRUD administrativo simples foi isolado em Route Handlers autenticados.
- Lint: `125 avisos → 0`; diálogos nativos: `14 → 0`; auditoria premium estrita: `0` achados.
- Testes unitários: `15 → 19`; E2E de contenção/autorização/recuperação: `8/8` em mobile e desktop; o runner agora encerra o servidor isolado corretamente no Windows; build de produção aprovado com 40 rotas.
- Migrations locais: 10 arquivos auditados estaticamente. Reset, pgTAP e concorrência real continuam bloqueados pela ausência de Docker/Postgres local reproduzível.
- Produção permanece deliberadamente inalterada: 81 advisors de segurança, 319 de performance e histórico remoto de migrations vazio até backup verificável e rollout controlado.
- O único usuário Auth órfão não possui convite nem metadados de clube suficientes; a migration fornece reparo master explícito, mas a decisão dos dados pertence à administração.
- Arquivos acima de 800 linhas: `6 → 0`, com separação de controladores, views e diálogos compartilhados para ligas, usuários, mercado, partidas, scouting e classificação.
- Ainda pendente: ampliar Playwright autenticado por papel, pgTAP completo, teste concorrente das RPCs e QA visual autenticado nas quatro larguras.
