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
- Pendente de UX: migrar dialogs/toasts/selects locais para os componentes canônicos, dividir arquivos acima de 800 linhas e executar QA visual nas quatro larguras.

## Auditoria efetiva em 2026-08-22

- Produção: 12 usuários Auth, 11 perfis, 11 clubes, 15.908 jogadores e 147 partidas; o histórico de migrations remoto está vazio.
- Bloqueador confirmado: 26 funções `SECURITY DEFINER` executáveis por `anon`, uma view `SECURITY DEFINER`, escrita irrestrita em `settings` e mutações diretas legadas.
- Integridade: cinco registros de classificação divergem da reconstrução por partidas confirmadas e há um usuário Auth sem perfil.
- Código preparado: proteção server-side nos layouts, calendário Berger testável, substituição transacional do calendário, reparo auditável da classificação e shortlist autenticada por RPC.
- Gate mantido: não aplicar migrations nem reparar dados remotos antes de backup verificável e execução local; Docker/Podman não está disponível nesta máquina.
