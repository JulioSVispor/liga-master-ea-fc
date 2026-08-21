# UX Contract

## Product context

- Audience: treinadores e administradores adultos de comunidades brasileiras de EA FC.
- Primary jobs: ver a próxima obrigação, reportar/confirmar partida, negociar atleta e resolver exceções administrativas.
- Target market: Brasil, fundamentado em `PRODUCT.md`, `AGENTS.md` e `docs/`.
- Active locales: `pt-BR`.
- Language/content register: objetivo, adulto e futebolístico; revisão nativa pelo mantenedor do produto.
- Timezone/calendar policy: `America/Sao_Paulo`, calendário gregoriano, datas visíveis em `pt-BR`.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `BACKEND.md`, `docs/authentication.md`, migrations | Arquitetura / política RLS | 2026-08-21 |
| Partidas e classificação | `docs/matches.md`, `docs/competitions.md` | Especificação de domínio | 2026-08-21 |
| Mercado e financeiro | `docs/market.md`, `docs/finances.md` | Especificação de domínio | 2026-08-21 |
| Produto e público | `PRODUCT.md`, `AGENTS.md` | Brief de produto | 2026-08-21 |
| Decisões e dívida | `DECISIONS.md`, `ROADMAP.md` | ADR / roadmap | 2026-08-21 |

## Visual contract

- Project `DESIGN.md`: [DESIGN.md](./DESIGN.md).
- Token ownership model: runtime existente é canônico; `DESIGN.md` espelha as decisões.
- Runtime source: `src/app/globals.css`, `tailwind.config.js`, `src/components/ui`.
- Mapping/export/adapters: classes Tailwind usam os mesmos valores semânticos documentados.
- Token drift gate: lint + auditoria premium em CI.
- Supported themes: escuro; alto contraste do sistema deve permanecer legível.
- Review policy: alterações canônicas exigem revisão conjunta de `DESIGN.md` e componentes irmãos.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | `Table` planejada | `src/components/ui` | page | componente + E2E |
| Select/Listbox | `Select` | `src/components/ui/Select.js` | native temporário / authored | teclado + popup |
| Date | `Intl.DateTimeFormat` | `src/lib/utils/formatters.js` | typed / native | locale + E2E |
| Form | `FormField` | `src/components/ui/FormField.js` | create / edit | validação E2E |
| Scrollbar | CSS do app | `src/app/globals.css` | geometria por área | computed style |
| Toast | `Toast` | `src/components/ui/Toast.js` | success / warning / info / error | live region |
| CRUD | service/action + dialog | RPCs e `src/services` | return / stay | fluxo E2E |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | rótulo estável | tom + borda | anel 2 px | sem scale | sem ação + contraste | largura preservada | intent danger |
| Icon button | `aria-label` | superfície | anel 2 px | pressed | sem ação | spinner | tooltip/inline |
| Input | label visível | borda | anel 2 px | n/a | valor legível | bloqueado | mensagem associada |
| Secret input | masked | borda | anel 2 px | toggle acessível | sem ação | bloqueado | inline |
| Search | clear + 250 ms | borda | anel 2 px | n/a | sem ação | indicador | recuperável |
| Textarea | resize vertical | borda | anel 2 px | n/a | legível | bloqueado | inline |
| Table/list | cabeçalho estável | linha sutil | foco na ação | seleção explícita | n/a | skeleton | retry |

## Dataset navigation

- Admin tables: paginação de 25 linhas, colunas explícitas e filtros na URL.
- Exploratory lists: 24 itens; infinite scroll não é padrão.
- URL state: busca confirmada, filtros, sort, página e tamanho; texto de chat e dados sensíveis nunca entram na URL.
- Empty/no-results/error/loading: Empty State contextual, “limpar filtros”, Alert com retry e Skeleton com geometria final.
- Back/scroll restoration: volta preserva filtros/página e restaura scroll quando seguro.
- Selection scope: página; contador visível; mudança de filtro limpa seleção e devolve foco ao cabeçalho.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Reportar partida | submit | controles busy | lista/handshake | toast + linha atualizada | formulário preservado | título da partida | `docs/matches.md` |
| Confirmar/disputar | dialog | ação busy | lista | toast | dialog preservado | gatilho/linha | `docs/matches.md` |
| Comprar/lance | dialog | ação busy | mercado | saldo/listagem atualizados | manter valor e explicar regra | listagem | `docs/market.md` |
| Criar proposta | submit | formulário busy | propostas enviadas | toast | dados preservados | nova proposta | `docs/market.md` |
| Upload | input | progresso curto | mesma tela | preview + toast | manter arquivo selecionado | input | `docs/flows.md` |
| Cancel/back | secundária | n/a | tela anterior | sem toast | n/a | gatilho | padrão do app |

## Navigation and responsive behavior

- Route title: `{Tela} | Liga Master`; erro e 403 têm título próprio.
- Route error / 403: mensagem objetiva, link seguro para `/dashboard`; sem renderização parcial de dados protegidos.
- Sidebar: persistente em `lg`, drawer abaixo; tabs com overflow somente quando não representam navegação primária.
- Responsive tables: esconder colunas auxiliares, nunca dados de decisão; detalhe por linha.
- Truncation: tooltip ou detalhe oferece valor completo.
- Focus: sticky surfaces não cobrem foco; anchors usam `scroll-margin-top`.

## Overlays and feedback

- Dialog primitive: `src/components/ui/Modal.js`, com foco, Escape e retorno ao gatilho.
- Destructive confirmations: explícitas; irreversíveis pedem digitação do nome/entidade.
- Toast: canto inferior direito desktop, região inferior segura mobile, 5 s, deduplicado por operação.
- Banner: manutenção global é persistente e `role=status`.
- Tooltip: atraso de 400 ms, fecha em Escape/blur; nunca contém informação essencial exclusiva.
- Unsaved changes: aviso ao fechar formulário substantivo.
- Layers: dialog 60 > drawer 50 > popover 40 > toast 70; banner global 100 durante contenção.

## Async and resilience

- Mutations críticas são pessimistas e idempotentes no banco; duplicate submit bloqueado.
- Offline: leitura stale pode ser mostrada com rótulo; escrita é bloqueada.
- Retry: queries 1 retry; mutações nunca repetem automaticamente sem idempotency key.
- Session expiry: redirecionar para login preservando apenas destino não sensível.
- Stale requests: React Query cancela/invalida por `userId/teamId`; logout limpa cache.
- Erro de mutation mantém dialog/form e devolve foco ao resumo/primeiro erro.

## Validation

- Regras puras no cliente apenas ajudam; schema, RLS e RPC são autoridade.
- Validação em blur após interação e em submit; erros inline e resumo quando houver múltiplos.
- Mensagens do servidor são mapeadas para linguagem de domínio sem expor existência de e-mail/usuário.
- Senhas nunca entram em logs, toast ou clipboard automático.

## Permission and clipboard

- Rotas são protegidas no servidor; navegação proibida é ocultada e URL direta retorna 403.
- Ação sem permissão é ocultada; ação temporariamente indisponível fica desabilitada com motivo.
- Clipboard mostra preview truncado e ação explícita; toast nunca repete segredo.

## Migration status

- Ledger: `ROADMAP.md` e auditoria premium.
- Primitives: `src/components/ui`; páginas legadas ainda contêm botões, dialogs e toasts locais.
- Slice atual: contenção, autenticação, partidas, mercado e financeiro.
- Gate de remoção: nenhum import legado, E2E dos fluxos e auditoria premium sem erro.

## Verification

- Static: `npm run audit:migrations`, `npm run lint`, `npm test`, `npm run build`.
- DB: `npm run test:db`, advisors Supabase e invariantes do runbook.
- Matrix: 360, 768, 1280 e 1440 px; teclado, zoom 200%, loading, vazio, erro e conteúdo longo.
- Accessibility: axe/Playwright, ordem de foco, contraste, live regions e reduced motion.
- Project audit: script `audit_project.py` do skill premium; resultado deve ser anexado ao rollout.
- CRUD/failure evidence: Playwright em cadastro, treinador, admin, mercado, partida e disputa.
